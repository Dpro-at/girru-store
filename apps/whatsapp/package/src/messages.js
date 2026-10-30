import { randomUUID } from 'node:crypto';

/**
 * The app's message log, in its own table, and its settings. Sending through Twilio is not
 * built yet: an outgoing message is logged only, and every answer says so.
 */

export const MESSAGES = 'app_whatsapp__whatsapp_messages';
export const CONFIG = 'app_whatsapp__whatsapp_config';
export const MAX_TEXT = 1600; // Twilio's limit for one WhatsApp message

export const NOT_CONNECTED = 'WhatsApp sending is not built yet: the message was logged in Girru only';

const SETTINGS = ['account_sid', 'auth_token', 'from_number', 'webhook_url', 'allowed_numbers'];

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

/** The allowed numbers as a list (saved as a list, JSON text or comma-separated text). */
export function allowedNumbers(config) {
  let value = config.allowed_numbers;
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { value = JSON.parse(value); } catch { /* comma-separated */ }
  }
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  return list.map((n) => String(n).trim()).filter(Boolean);
}

/** Log an outgoing message; returns its id. */
export function logOutgoing(db, { to, body, mediaUrl }) {
  const messageId = `wa_${randomUUID()}`;
  db.prepare(`
    INSERT INTO ${MESSAGES} (id, from_number, to_number, content, media_url, status, timestamp, direction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(messageId, 'bot', to, body, mediaUrl || null, 'logged', new Date().toISOString(), 'outgoing');
  return messageId;
}

export const validNumber = (v) => typeof v === 'string' && /^\+[1-9][0-9]{6,14}$/.test(v);
export const validText = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT;
export const validMediaUrl = (v) => v === undefined || v === null || v === '' || (typeof v === 'string' && v.length <= 2000 && /^https:\/\//.test(v));
