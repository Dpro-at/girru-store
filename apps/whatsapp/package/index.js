/**
 * WhatsApp for Girru
 * Entry point - pure JavaScript only
 */

import { createWhatsAppRoutes } from './src/routes.js';
import { createWhatsAppSendTool } from './src/tool.js';

export default {
  id: 'whatsapp',
  name: 'WhatsApp',
  version: '2.1.0',

  async register(api) {
    // 1. Its tables are made by Girru when the app is added (only its own migrations, recorded).
    // 2. Routes under /api/ext/whatsapp/ (owner or admin; /webhook needs Twilio's signature)
    api.registerRoutes(createWhatsAppRoutes(api));

    // 3. AI agent tool
    api.registerTool(createWhatsAppSendTool(api));

    api.log('info', 'WhatsApp channel ready');
  },

  async onDisable(api) {
    api.unregisterTool('whatsapp_send');
    api.log('info', 'WhatsApp channel disabled');
  },
};
