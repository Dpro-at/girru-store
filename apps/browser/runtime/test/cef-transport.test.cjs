const {test}=require('node:test'),assert=require('node:assert/strict');
const {WebSocket,WebSocketServer}=require('ws');
const {createCefTransport}=require('../src/cef-transport.cjs');
test('CEF native tab creation rearms the same Playwright root session without leaking internal responses',async t=>{
 const upstream=new WebSocketServer({host:'127.0.0.1',port:0});await new Promise(r=>upstream.on('listening',r));let attaches=0;
 upstream.on('connection',socket=>socket.on('message',bytes=>{const m=JSON.parse(bytes);if(m.method==='Target.setAutoAttach'){assert.deepEqual(m.params.filter,[{type:'page'},{type:'service_worker'},{exclude:true}]);attaches++;socket.send(JSON.stringify({id:m.id,result:{}}));if(attaches>1)socket.send(JSON.stringify({method:'Target.attachedToTarget',params:{targetInfo:{type:'page',targetId:'native-tab'}}}));}else if(m.method==='Target.createTarget')socket.send(JSON.stringify({id:m.id,sessionId:m.sessionId,result:{targetId:'native-tab'}}));}));
 const bridge=await createCefTransport(`ws://127.0.0.1:${upstream.address().port}`),socket=new WebSocket(bridge.url);await new Promise(r=>socket.on('open',r));
 t.after(async()=>{socket.terminate();await bridge.close();for(const s of upstream.clients)s.terminate();await new Promise(r=>upstream.close(r));});
 const messages=[];let resolve;const done=new Promise(r=>resolve=r);socket.on('message',bytes=>{const m=JSON.parse(bytes);messages.push(m);if(m.method==='Target.attachedToTarget')resolve();});
 socket.send(JSON.stringify({id:1,method:'Target.setAutoAttach',params:{autoAttach:true,waitForDebuggerOnStart:true,flatten:true}}));
 socket.send(JSON.stringify({id:2,sessionId:'browser-session',method:'Target.createTarget',params:{url:'about:blank'}}));
 await Promise.race([done,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Native tab was not attached')),2000);timer.unref();})]);
 assert.equal(attaches,2);assert.ok(messages.some(m=>m.id===2&&m.result.targetId==='native-tab'));assert.ok(messages.every(m=>m.id===undefined||m.id>=0));
});
