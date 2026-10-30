/**
 * Discord for Girru
 * Entry point - pure JavaScript only
 *
 * The bot runs on Girru's channel host (api.hostChannel): the host keeps the Discord
 * connection, the allowed senders and channels, the restricted agent turn and the message
 * log, and adds the settings routes under /api/ext/discord/ (owner or admin only).
 */

import { discordSendTool } from './src/tool.js';

let channel = null;

export default {
  id: 'discord',
  name: 'Discord',
  version: '2.2.0',

  async register(api) {
    // 1. Its tables (kept from older Girru versions) are made by Girru when the app is added.
    if (typeof api.hostChannel !== 'function') throw new Error('This Discord app needs a Girru with the channel host; update Girru');

    // 2. The bot connection and its routes
    channel = api.hostChannel();

    // 3. AI agent tool
    api.registerTool(discordSendTool(api, channel));

    api.log('info', 'Discord channel ready');
  },

  async onDisable(api) {
    await channel?.stop();
    api.unregisterTool('discord_send');
    api.log('info', 'Discord channel disabled');
  },
};
