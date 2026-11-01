'use strict';
const http = require('node:http');
const {randomBytes} = require('node:crypto');
const {WebSocket, WebSocketServer} = require('ws');

/** CEF needs auto-attach refreshed after native Chrome targets are created. */
async function createCefTransport(upstream) {
  const endpoint = new URL(upstream);
  if (endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1') throw Error('Local Chromium required.');
  const capability = '/' + randomBytes(32).toString('hex');
  const server = http.createServer((_, res) => { res.writeHead(404); res.end(); });
  const sockets = new Set();
  const refreshers = new Set();
  const web = new WebSocketServer({noServer:true, maxPayload:64 * 1024 * 1024});
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== capability || req.headers.origin) return socket.destroy();
    web.handleUpgrade(req, socket, head, ws => web.emit('connection', ws));
  });
  web.on('connection', downstream => {
    const remote = new WebSocket(endpoint);
    sockets.add(downstream); sockets.add(remote);
    const pending = [], requests = new Map(), internal = new Set();
    let autoAttach, nextId = -1, scheduled = false;
    const send = message => remote.readyState === WebSocket.OPEN ? remote.send(message) : pending.push(message);
    const refresh = () => {
      if (!autoAttach || scheduled) return;
      scheduled = true;
      setImmediate(() => {
        scheduled = false;
        if (remote.readyState !== WebSocket.OPEN) return;
        const id = nextId--; internal.add(id);
        remote.send(JSON.stringify({id, method:'Target.setAutoAttach', params:autoAttach}));
      });
    };
    refreshers.add(refresh);
    remote.on('open', () => { for (const message of pending.splice(0)) remote.send(message); });
    downstream.on('message', bytes => {
      let message;
      try { message = JSON.parse(bytes.toString()); } catch { return downstream.close(1003); }
      if (message.method === 'Target.setAutoAttach' && !message.sessionId) {
        message.params.filter = [{type:'page'}, {type:'service_worker'}, {exclude:true}];
        autoAttach = message.params.autoAttach ? message.params : undefined;
      }
      if (message.method === 'Target.createTarget') requests.set(message.id, message.method);
      send(JSON.stringify(message));
    });
    remote.on('message', bytes => {
      let message;
      try { message = JSON.parse(bytes.toString()); } catch { return remote.close(1003); }
      if (internal.delete(message.id)) return;
      if (downstream.readyState === WebSocket.OPEN) downstream.send(bytes.toString());
      if (requests.delete(message.id) && message.result?.targetId) refresh();
    });
    for (const [socket, other] of [[downstream, remote], [remote, downstream]]) {
      socket.on('error', () => other.terminate());
      socket.on('close', () => { sockets.delete(socket); refreshers.delete(refresh); other.terminate(); });
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url:`ws://127.0.0.1:${server.address().port}${capability}`,
    refresh() { for (const refresh of refreshers) refresh(); },
    async close() { for (const socket of sockets) socket.terminate(); web.close(); await new Promise(resolve => server.close(resolve)); }
  };
}
module.exports = {createCefTransport};
