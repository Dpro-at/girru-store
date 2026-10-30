// Checks for the Slack app's package, run from the Girru Store repository:
//   node apps/slack/checks/webhook.check.mjs
// Node 22.5 or later (node:sqlite), no packages, no network. A stand-in for Girru gives the app
// a database with its own migrations, its settings and the owner check; the routes are called
// directly, the way Girru's route scope would call them (raw body kept, as its parser does).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createSlackRoutes } from '../package/src/routes.js';
import { createSlackSendTool } from '../package/src/tool.js';
import { slackSignature, verifySlackRequest } from '../package/src/verify.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../package/migrations/001_slack_messages.sql', import.meta.url), 'utf8'));
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
await createSlackRoutes(api)(scope);
const call = async (key, request) => {
  let status = 200;
  const reply = { status(code) { status = code; return this; }, send(body) { return { status, body }; } };
  const out = await routes[key]({ headers: {}, query: {}, ...request }, reply);
  return out && typeof out.status === 'number' && 'body' in out ? out : { status, body: out };
};
const count = () => db.prepare('SELECT COUNT(*) AS n FROM app_slack__slack_messages').get().n;
const SECRET = 'slack-signing-secret-for-checks';
const now = Math.floor(Date.now() / 1000);
const signed = (raw, { ts = now, secret = SECRET } = {}) => ({
  rawBody: raw, body: JSON.parse(raw),
  headers: { 'x-slack-request-timestamp': String(ts), 'x-slack-signature': slackSignature(secret, String(ts), raw) },
});

// The signature rules.
const raw = JSON.stringify({ type: 'url_verification', challenge: 'abc' });
assert.equal(verifySlackRequest(signed(raw), SECRET), true);
assert.equal(verifySlackRequest(signed(raw), null), false, 'no secret');
assert.equal(verifySlackRequest(signed(raw, { secret: 'wrong' }), SECRET), false, 'wrong secret');
assert.equal(verifySlackRequest(signed(raw, { ts: now - 600 }), SECRET), false, 'too old');
assert.equal(verifySlackRequest({ ...signed(raw), rawBody: raw.replace('abc', 'xyz') }, SECRET), false, 'changed body');
assert.equal(verifySlackRequest({ ...signed(raw), rawBody: undefined }, SECRET), false, 'no raw body');
assert.equal(verifySlackRequest({ ...signed(raw), headers: {} }, SECRET), false, 'unsigned');

// The public webhook: refused with no secret saved, then only signed requests count.
const event = JSON.stringify({ event: { type: 'message', ts: '1.2', channel: 'C1', text: 'hi', user: 'U1' } });
assert.equal((await call('POST /webhook', signed(raw))).status, 401, 'no secret saved: refused');
assert.equal((await call('PUT /config', { body: { signing_secret: SECRET, bot_token: 'xoxb-check' } })).status, 200);
const ok = await call('POST /webhook', signed(raw));
assert.equal(ok.status, 200); assert.equal(ok.body.challenge, 'abc');
assert.equal((await call('POST /webhook', signed(event, { secret: 'wrong' }))).status, 401);
assert.equal((await call('POST /webhook', { ...signed(event), headers: {} })).status, 401);
assert.equal(count(), 0, 'nothing kept from refused requests');
assert.equal((await call('POST /webhook', signed(event))).status, 200);
assert.equal((await call('POST /webhook', signed(event))).status, 200, 'Slack sends again: kept once');
assert.equal(count(), 1);

// Settings: an empty field keeps the saved value; status never shows a secret.
await call('PUT /config', { body: { signing_secret: '', bot_token: '' } });
assert.equal(saved.signing_secret, SECRET);
const status = await call('GET /status', {});
assert.equal(status.body.configured, true);
assert.ok(!JSON.stringify(status.body).includes(SECRET) && !JSON.stringify(status.body).includes('xoxb-check'));

// A settings row an older Girru kept in the table still counts, under the saved settings.
saved = {};
db.prepare('INSERT INTO app_slack__slack_config (id, signing_secret) VALUES (1, ?)').run('old-secret');
assert.equal((await call('POST /webhook', signed(raw, { secret: 'old-secret' }))).status, 200);
saved = { signing_secret: SECRET };
assert.equal((await call('POST /webhook', signed(raw, { secret: 'old-secret' }))).status, 401, 'the saved settings win');

// /send and /messages check their input and limits.
assert.equal((await call('POST /send', { body: { channel: 'C1', text: '' } })).status, 400);
assert.equal((await call('POST /send', { body: { channel: '../x', text: 'hi' } })).status, 400);
assert.equal((await call('POST /send', { body: { channel: 'C1', text: 'hi' } })).body.success, true);
assert.equal((await call('GET /messages', { query: { limit: 100000 } })).body.messages.length, 2);

// The agent tool: only for an active owner or admin; it only logs.
const tool = createSlackSendTool(api);
assert.equal((await tool.execute({ channel: 'C1', text: 'hi' }, {})).is_error, true, 'no user');
assert.equal((await tool.execute({ channel: 'C1', text: 'hi' }, { userId: 'member' })).is_error, true, 'not an owner');
assert.equal((await tool.execute({ channel: 'C1', text: '' }, { userId: 'owner' })).is_error, true);
const sent = await tool.execute({ channel: 'C1', text: 'hi' }, { userId: 'owner' });
assert.equal(sent.is_error, undefined); assert.match(sent.content[0].text, /not built yet/);
assert.equal(count(), 3);

console.log('slack checks passed');
