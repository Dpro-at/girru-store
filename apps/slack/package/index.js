/**
 * Slack for Girru
 * Entry point - pure JavaScript only
 */

import { createSlackRoutes } from './src/routes.js';
import { createSlackSendTool } from './src/tool.js';

export default {
  id: 'slack',
  name: 'Slack',
  version: '2.1.0',

  async register(api) {
    // 1. Its tables are made by Girru when the app is added (only its own migrations, recorded).
    // 2. Routes under /api/ext/slack/ (owner or admin; /webhook needs Slack's signature)
    api.registerRoutes(createSlackRoutes(api));

    // 3. AI agent tool
    api.registerTool(createSlackSendTool(api));

    api.log('info', 'Slack channel ready');
  },

  async onDisable(api) {
    api.unregisterTool('slack_send');
    api.log('info', 'Slack channel disabled');
  },
};
