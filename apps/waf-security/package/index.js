/**
 * WAF Security Scanner for Girru
 * Entry point - pure JavaScript only
 */

import { createWafRoutes } from './src/routes.js';
import { createWafScanTool } from './src/tool.js';
import { seedLibrary } from './src/seed.js';
import { processScheduledCampaigns } from './src/campaign-service.js';
import { allowPrivateTargets } from './src/settings.js';

export default {
  id: 'waf-security',
  name: 'WAF Security Scanner',
  version: '1.1.0',

  async register(api) {
    // 1. Its tables are made by Girru when the app is added (only its own migrations, recorded).
    // 2. The test library and campaign stages, into empty tables only
    const added = seedLibrary(api.db);
    if (added) api.log('info', `Added ${added} starting rows to the test library`);

    // 3. Routes under /api/ext/waf-security/
    api.registerRoutes(createWafRoutes(api));

    // 4. AI agent tool
    api.registerTool(createWafScanTool(api));

    // 5. Scheduled campaigns, checked every hour; each runs only while its owner is an active owner or admin
    api.registerCronJob('0 * * * *', async () => {
      const executed = await processScheduledCampaigns(api.db, {
        allowPrivate: allowPrivateTargets(api),
        mayRun: (userId) => {
          if (typeof api.authorizeChannelUser !== 'function') return false;
          api.authorizeChannelUser(userId); // throws unless an active owner or admin
          return true;
        },
      });
      if (executed > 0) api.log('info', `Executed ${executed} scheduled WAF campaigns`);
    }, 'campaign-scheduler');

    api.log('info', 'WAF Security Scanner ready');
  },

  async onDisable(api) {
    api.unregisterTool('waf_scan');
    try { api.unregisterCronJob('campaign-scheduler'); } catch { /* not registered */ }
    api.log('info', 'WAF Security Scanner disabled');
  },
};
