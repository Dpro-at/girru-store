// Checks for the WhatsApp app's package, run from the Girru Store repository:
//   node apps/whatsapp/checks/webhook.check.mjs
// Node 22.5 or later (node:sqlite), no packages, no network. A stand-in for Girru gives the app
// a database with its own migrations, its settings and the owner check; the routes are called
// directly, the way Girru's route scope would call them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWhatsAppRoutes } from '../package/src/routes.js';
import { createWhatsAppSendTool } from '../package/src/tool.js';
import { twilioSignature, verifyTwilioRequest } from '../package/src/verify.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../package/migrations/001_whatsapp_messages.sql', import.meta.url), 'utf8'));
let saved = {};
const api = {
  db, getConfig: () => saved, setConfig: (c) => { saved = c; }, log() {},
  authorizeChannelUser(userId) { if (userId !== 'owner') throw new Error('not an active owner or admin'); },
};
const routes = {};
const scope = {
  hasContentTypeParser: () => false, removeContentTypeParser() {}, addContentTypeParser() {},
  post: (path, _opts, fn) => { routes[`POST ${path}`] = fn; }, get: (path, _opts, fn) => { routes[`GET ${path}`] = fn; },
  put: (path, _opts, fn) => { routes[`PUT ${path}`] = fn; },
};
await createWhatsAppRoutes(api)(scope);
const call = async (key, request) => {
  let status = 200; let sent;
  const reply = { status(code) { status = code; return this; }, type() { return this; }, send(body) { sent = body; return this; } };
  const out = await routes[key]({ headers: {}, query: {}, url: '/api/ext/whatsapp/webhook', ...request }, reply);
  return { status, body: out === reply ? sent : out };
};
const count = () => db.prepare('SELECT COUNT(*) AS n FROM app_whatsapp__whatsapp_messages').get().n;
const WEBHOOK = 'https://girru.example.test/api/ext/whatsapp/webhook';
const params = { MessageSid: 'SM1', From: 'whatsapp:+15550001', To: 'whatsapp:+15550002', Body: 'hello' };
const post = (signature, body = params) => call('POST /webhook', { body, headers: signature ? { 'x-twilio-signature': signature } : {} });

// The signature rules.
const req = (sig, body = params) => ({ headers: { 'x-twilio-signature': sig }, body });
assert.equal(verifyTwilioRequest(req(twilioSignature('t', WEBHOOK, params)), 't', WEBHOOK), true);
assert.equal(verifyTwilioRequest(req(twilioSignature('t', WEBHOOK, params)), null, WEBHOOK), false, 'no token');
assert.equal(verifyTwilioRequest(req(twilioSignature('t', WEBHOOK, params)), 't', null), false, 'no URL');
assert.equal(verifyTwilioRequest(req(twilioSignature('t', WEBHOOK, params), { ...params, Body: 'changed' }), 't', WEBHOOK), false, 'changed body');
assert.equal(verifyTwilioRequest({ headers: {}, body: params }, 't', WEBHOOK), false, 'unsigned');

// The public webhook: refused until a token is saved, then only signed requests for the saved URL count.
const savedEnv = process.env.PUBLIC_URL; delete process.env.PUBLIC_URL;
assert.equal((await post(twilioSignature('x', WEBHOOK, params))).status, 401, 'no token saved');
assert.equal((await call('PUT /config', { body: { auth_token: 'wa-token' } })).status, 200);
assert.equal((await post(twilioSignature('wa-token', WEBHOOK, params))).status, 401, 'no webhook URL and no PUBLIC_URL');
process.env.PUBLIC_URL = 'https://girru.example.test';
assert.equal((await post(twilioSignature('wa-token', WEBHOOK, params))).status, 200, 'PUBLIC_URL plus the path');
if (savedEnv === undefined) delete process.env.PUBLIC_URL; else process.env.PUBLIC_URL = savedEnv;
await call('PUT /config', { body: { webhook_url: WEBHOOK } });
assert.equal((await post(null)).status, 401, 'unsigned');
assert.equal((await post(twilioSignature('other', WEBHOOK, params))).status, 401, 'wrong token');
assert.equal((await post(twilioSignature('wa-token', 'https://evil.example.test/x', params))).status, 401, 'wrong URL');
assert.equal(count(), 1);
const ok = await post(twilioSignature('wa-token', WEBHOOK, params));
assert.equal(ok.status, 200); assert.match(ok.body, /<Response><\/Response>/);
assert.equal(count(), 1, 'Twilio sends again: kept once');

// Allowed numbers: with a list, other senders are not kept (Twilio still gets its answer).
await call('PUT /config', { body: { allowed_numbers: ['+15550009'] } });
const other = { ...params, MessageSid: 'SM2' };
assert.equal((await post(twilioSignature('wa-token', WEBHOOK, other), other)).status, 200);
assert.equal(count(), 1, 'not on the list: not kept');
const listed = { ...params, MessageSid: 'SM3', From: 'whatsapp:+15550009' };
await post(twilioSignature('wa-token', WEBHOOK, listed), listed);
assert.equal(count(), 2);

// Settings: an empty field keeps the saved value; status never shows a secret.
await call('PUT /config', { body: { auth_token: '' } });
assert.equal(saved.auth_token, 'wa-token');
assert.ok(!JSON.stringify((await call('GET /status', {})).body).includes('wa-token'));

// /send and the agent tool check their input; the tool runs only for an active owner or admin.
assert.equal((await call('POST /send', { body: { to: '12345', body: 'hi' } })).status, 400);
assert.equal((await call('POST /send', { body: { to: '+15550001', body: 'hi', mediaUrl: 'http://10.0.0.1/x' } })).status, 400);
assert.equal((await call('POST /send', { body: { to: '+15550001', body: 'hi' } })).body.success, true);
assert.equal((await call('GET /messages', { query: { limit: 100000 } })).body.messages.length, 3);
const tool = createWhatsAppSendTool(api);
assert.equal((await tool.execute({ to: '+15550001', body: 'hi' }, {})).is_error, true, 'no user');
assert.equal((await tool.execute({ to: '+15550001', body: 'hi' }, { userId: 'member' })).is_error, true, 'not an owner');
assert.equal((await tool.execute({ to: '+15550001', body: 'hi', mediaUrl: 'file:///etc/passwd' }, { userId: 'owner' })).is_error, true);
const sent = await tool.execute({ to: '+15550001', body: 'hi' }, { userId: 'owner' });
assert.equal(sent.is_error, undefined); assert.match(sent.content[0].text, /not built yet/);

console.log('whatsapp checks passed');
