import { randomUUID } from 'node:crypto';

/**
 * The app's message log, in its own table, and its settings. Sending to Slack itself is not
 * built yet: an outgoing message is logged only, and every answer says so.
 */

export const MESSAGES = 'app_slack__slack_messages';
export const CONFIG = 'app_slack__slack_config';
export const MAX_TEXT = 40000; // Slack's limit for one message

export const NOT_CONNECTED = 'Slack sending is not built yet: the message was logged in Girru only';

/** Log an outgoing message; returns its id. */
export function logOutgoing(db, { channel, text, thread_ts }) {
  const messageId = `slack_${randomUUID()}`;
  db.prepare(`
    INSERT INTO ${MESSAGES} (id, channel_id, content, user_id, username, timestamp, thread_ts, direction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(messageId, channel, text, 'bot', 'Girru Bot', new Date().toISOString(), thread_ts || null, 'outgoing');
  return messageId;
}

const SETTINGS = ['bot_token', 'signing_secret', 'app_token', 'allowed_channels', 'workspace_url', 'webhook_url'];

/**
 * The settings: those saved in Girru's app settings (the Extensions form and PUT /config),
 * over a row an older Girru kept in the settings table.
 */
export function readConfig(api) {
  let row = {};
  try { row = api.db.prepare(`SELECT * FROM ${CONFIG} WHERE id = 1`).get() || {}; } catch { row = {}; }
  const saved = api.getConfig() || {};
  const out = {};
  for (const key of SETTINGS) {
    const value = saved[key] !== undefined && saved[key] !== '' && saved[key] !== null ? saved[key] : row[key];
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

export const validChannel = (v) => typeof v === 'string' && /^[#A-Za-z0-9._-]{1,80}$/.test(v);
export const validText = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT;
