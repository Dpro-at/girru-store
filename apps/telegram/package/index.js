/**
 * Telegram for Girru
 * Entry point - pure JavaScript only
 *
 * The bot runs on Girru's channel host (api.hostChannel): the host keeps the Telegram
 * connection, the allowed senders, the restricted agent turn and the message log, and adds
 * the settings routes under /api/ext/telegram/ (owner or admin only).
 */

import { telegramSendTool } from './src/tool.js';

let channel = null;

export default {
  id: 'telegram',
  name: 'Telegram',
  version: '2.2.0',

  async register(api) {
    // 1. Its tables (kept from older Girru versions) are made by Girru when the app is added.
    if (typeof api.hostChannel !== 'function') throw new Error('This Telegram app needs a Girru with the channel host; update Girru');

    // 2. The bot connection and its routes
    channel = api.hostChannel();

    // 3. AI agent tool
    api.registerTool(telegramSendTool(api, channel));

    api.log('info', 'Telegram bot ready');
  },

  async onDisable(api) {
    await channel?.stop();
    api.unregisterTool('telegram_send');
    api.log('info', 'Telegram bot disabled');
  },
};
