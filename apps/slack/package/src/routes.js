/**
 * Slack API Routes - Pure JavaScript
 * Mounted at /api/ext/slack/. Owner or admin only, except /webhook, which needs Slack's signature.
 */

import { randomUUID } from 'node:crypto';
import { registerRawBodyParsers, verifySlackRequest } from './verify.js';
import { MESSAGES, NOT_CONNECTED, logOutgoing, readConfig, validChannel, validText } from './messages.js';

export function createSlackRoutes(api) {
  return async function registerSlackRoutes(fastify) {
    const db = api.db;
    // Keep the raw body: /webhook verifies Slack's signature over it.
    registerRawBodyParsers(fastify);

    /**
     * POST /api/ext/slack/send - Log a message for a Slack channel
     */
    fastify.post('/send', {
      schema: {
        tags: ['Slack'],
        description: 'Log a message for a Slack channel (sending is not built yet)',
        body: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            text: { type: 'string' },
            thread_ts: { type: 'string' },
          },
          required: ['channel', 'text'],
        },
      },
    }, async (request, reply) => {
      const { channel, text, thread_ts } = request.body;
      if (!validChannel(channel) || !validText(text)) return reply.status(400).send({ error: 'Invalid channel or message length' });
      const messageId = logOutgoing(db, { channel, text, thread_ts });
      return { success: true, messageId, note: NOT_CONNECTED };
    });

    /**
     * POST /api/ext/slack/webhook - Receive Slack events (public, signed by Slack)
     */
    fastify.post('/webhook', {
      schema: {
        tags: ['Slack'],
        description: 'Receive Slack events and messages',
      },
    }, async (request, reply) => {
      // Only requests signed with the configured signing secret, within five minutes, are
      // accepted. No secret configured: every request is refused.
      let signingSecret = null;
      try {
        const saved = readConfig(api).signing_secret;
        signingSecret = typeof saved === 'string' && saved ? saved : null;
      } catch {
        signingSecret = null;
      }
      if (!verifySlackRequest(request, signingSecret)) {
        return reply.status(401).send({ error: 'Invalid Slack signature' });
      }

      const event = request.body || {};
      if (event.type === 'url_verification') {
        return { challenge: event.challenge };
      }

      const message = event.event;
      if (message?.type === 'message' && !message.bot_id && typeof message.channel === 'string') {
        // Slack sends an event again when it got no answer in time: the same one is kept once.
        db.prepare(`
          INSERT OR IGNORE INTO ${MESSAGES} (id, channel_id, content, user_id, timestamp, thread_ts, direction)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(message.ts || `msg_${randomUUID()}`),
          message.channel,
          typeof message.text === 'string' ? message.text : '',
          typeof message.user === 'string' ? message.user : 'unknown',
          String(message.ts || new Date().toISOString()),
          typeof message.thread_ts === 'string' ? message.thread_ts : null,
          'incoming'
        );
      }

      return { ok: true };
    });

    /**
     * GET /api/ext/slack/messages - Recent messages
     */
    fastify.get('/messages', {
      schema: {
        tags: ['Slack'],
        description: 'Get recent Slack messages',
        querystring: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            limit: { type: 'number', default: 50 },
          },
        },
      },
    }, async (request) => {
      const { channel } = request.query;
      const limit = Math.max(1, Math.min(200, Math.floor(Number(request.query.limit) || 50)));
      const messages = channel
        ? db.prepare(`SELECT * FROM ${MESSAGES} WHERE channel_id = ? ORDER BY timestamp DESC LIMIT ?`).all(channel, limit)
        : db.prepare(`SELECT * FROM ${MESSAGES} ORDER BY timestamp DESC LIMIT ?`).all(limit);
      return { messages };
    });

    /**
     * GET /api/ext/slack/status - Settings present and message counts; never a secret
     */
    fastify.get('/status', {
      schema: {
        tags: ['Slack'],
        description: 'Get Slack settings and message counts',
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
        configured: !!config?.bot_token,
        webhookReady: !!config?.signing_secret,
        connected: false, // sending to Slack is not built yet
        stats: {
          totalMessages: stats.total || 0,
          incoming: stats.incoming || 0,
          outgoing: stats.outgoing || 0,
        },
      };
    });

    /**
     * PUT /api/ext/slack/config - Save the settings; a field left out or empty keeps its saved value
     */
    fastify.put('/config', {
      schema: {
        tags: ['Slack'],
        description: 'Update Slack bot configuration',
        body: {
          type: 'object',
          properties: {
            bot_token: { type: 'string', maxLength: 500 },
            signing_secret: { type: 'string', maxLength: 500 },
            app_token: { type: 'string', maxLength: 500 },
            allowed_channels: { type: 'array', maxItems: 200, items: { type: 'string', maxLength: 80 } },
            workspace_url: { type: 'string', maxLength: 2000 },
            webhook_url: { type: 'string', maxLength: 2000 },
          },
        },
      },
    }, async (request) => {
      const body = request.body || {};
      const next = { ...(api.getConfig() || {}) };
      for (const key of ['bot_token', 'signing_secret', 'app_token', 'workspace_url', 'webhook_url']) {
        if (typeof body[key] === 'string' && body[key] !== '') next[key] = body[key];
      }
      if (Array.isArray(body.allowed_channels)) next.allowed_channels = body.allowed_channels;
      api.setConfig(next);
      api.log('info', 'Slack settings saved');
      return { success: true };
    });
  };
}
