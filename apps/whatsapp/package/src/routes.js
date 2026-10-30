/**
 * WhatsApp API Routes - Pure JavaScript
 * Mounted at /api/ext/whatsapp/. Owner or admin only, except /webhook, which needs Twilio's signature.
 */

import { randomUUID } from 'node:crypto';
import { registerRawBodyParsers, verifyTwilioRequest, publicRequestUrl } from './verify.js';
import { MESSAGES, NOT_CONNECTED, allowedNumbers, logOutgoing, readConfig, validMediaUrl, validNumber, validText } from './messages.js';

const TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export function createWhatsAppRoutes(api) {
  return async function registerWhatsAppRoutes(fastify) {
    const db = api.db;
    // Twilio posts form-encoded bodies; keep the raw body for signature checks.
    registerRawBodyParsers(fastify);

    /**
     * POST /api/ext/whatsapp/send - Log a WhatsApp message
     */
    fastify.post('/send', {
      schema: {
        tags: ['WhatsApp'],
        description: 'Log a WhatsApp message (sending through Twilio is not built yet)',
        body: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            body: { type: 'string' },
            mediaUrl: { type: 'string' },
          },
          required: ['to', 'body'],
        },
      },
    }, async (request, reply) => {
      const { to, body, mediaUrl } = request.body;
      if (!validNumber(to) || !validText(body) || !validMediaUrl(mediaUrl)) return reply.status(400).send({ error: 'Invalid number, message length or media address' });
      const messageId = logOutgoing(db, { to, body, mediaUrl });
      return { success: true, messageId, note: NOT_CONNECTED };
    });

    /**
     * POST /api/ext/whatsapp/webhook - Receive WhatsApp messages (public, signed by Twilio)
     */
    fastify.post('/webhook', {
      schema: {
        tags: ['WhatsApp'],
        description: 'Receive incoming WhatsApp messages from Twilio',
      },
    }, async (request, reply) => {
      // Only requests carrying a valid X-Twilio-Signature for the saved auth token and the
      // saved webhook URL (or PUBLIC_URL) are accepted. Anything not set: refused.
      let config = {};
      try {
        config = readConfig(api);
      } catch {
        config = {};
      }
      const url = (typeof config.webhook_url === 'string' && config.webhook_url) || publicRequestUrl(request);
      if (!verifyTwilioRequest(request, config.auth_token, url)) {
        return reply.status(401).send({ error: 'Invalid Twilio signature' });
      }

      const message = request.body || {};
      const from = typeof message.From === 'string' ? message.From.replace('whatsapp:', '') : 'unknown';
      const allowed = allowedNumbers(config);
      // With allowed numbers saved, a message from any other number is not kept.
      if (!allowed.length || allowed.includes(from)) {
        // Twilio sends a message again when it got no answer in time: the same one is kept once.
        db.prepare(`
          INSERT OR IGNORE INTO ${MESSAGES} (id, from_number, to_number, content, media_url, status, timestamp, direction)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          typeof message.MessageSid === 'string' && message.MessageSid ? message.MessageSid : `wa_${randomUUID()}`,
          from,
          typeof message.To === 'string' ? message.To.replace('whatsapp:', '') : 'bot',
          typeof message.Body === 'string' ? message.Body : '',
          typeof message.MediaUrl0 === 'string' ? message.MediaUrl0 : null,
          'received',
          new Date().toISOString(),
          'incoming'
        );
      }

      // An empty TwiML answer: nothing is sent back.
      return reply.type('text/xml').send(TWIML);
    });

    /**
     * GET /api/ext/whatsapp/messages - Recent messages
     */
    fastify.get('/messages', {
      schema: {
        tags: ['WhatsApp'],
        description: 'Get recent WhatsApp messages',
        querystring: {
          type: 'object',
          properties: {
            number: { type: 'string' },
            limit: { type: 'number', default: 50 },
          },
        },
      },
    }, async (request) => {
      const { number } = request.query;
      const limit = Math.max(1, Math.min(200, Math.floor(Number(request.query.limit) || 50)));
      const messages = number
        ? db.prepare(`SELECT * FROM ${MESSAGES} WHERE from_number = ? OR to_number = ? ORDER BY timestamp DESC LIMIT ?`).all(number, number, limit)
        : db.prepare(`SELECT * FROM ${MESSAGES} ORDER BY timestamp DESC LIMIT ?`).all(limit);
      return { messages };
    });

    /**
     * GET /api/ext/whatsapp/status - Settings present and message counts; never a secret
     */
    fastify.get('/status', {
      schema: {
        tags: ['WhatsApp'],
        description: 'Get WhatsApp settings and message counts',
      },
    }, async () => {
      const config = readConfig(api);
      const stats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
          SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing
        FROM ${MESSAGES}
      `).get();

      return {
        configured: !!config.account_sid,
        webhookReady: !!config.auth_token,
        connected: false, // sending through Twilio is not built yet
        stats: {
          totalMessages: stats.total || 0,
          incoming: stats.incoming || 0,
          outgoing: stats.outgoing || 0,
        },
      };
    });

    /**
     * PUT /api/ext/whatsapp/config - Save the settings; a field left out or empty keeps its saved value
     */
    fastify.put('/config', {
      schema: {
        tags: ['WhatsApp'],
        description: 'Update WhatsApp/Twilio configuration',
        body: {
          type: 'object',
          properties: {
            account_sid: { type: 'string', maxLength: 200 },
            auth_token: { type: 'string', maxLength: 500 },
            from_number: { type: 'string', maxLength: 40 },
            webhook_url: { type: 'string', maxLength: 2000 },
            allowed_numbers: { type: 'array', maxItems: 500, items: { type: 'string', maxLength: 40 } },
          },
        },
      },
    }, async (request) => {
      const body = request.body || {};
      const next = { ...(api.getConfig() || {}) };
      for (const key of ['account_sid', 'auth_token', 'from_number', 'webhook_url']) {
        if (typeof body[key] === 'string' && body[key] !== '') next[key] = body[key];
      }
      if (Array.isArray(body.allowed_numbers)) next.allowed_numbers = body.allowed_numbers;
      api.setConfig(next);
      api.log('info', 'WhatsApp settings saved');
      return { success: true };
    });
  };
}
