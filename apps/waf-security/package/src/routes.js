/**
 * WAF Security API Routes - Pure JavaScript
 * All routes mounted at /api/ext/waf-security/. Girru lets only an active owner or admin reach
 * them and tells each request who it is (request.authUserId); each user sees only their own
 * scans and campaigns.
 */

import {
  detectWAF,
  selfAudit,
  getPayloadCategories,
} from './engine.js';
import { checkTarget, TargetError } from './target.js';
import { startScan } from './scanner.js';
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  runCampaign,
  deleteCampaign,
} from './campaign-service.js';
import { calculateSecurityScore, generateRecommendations } from './scoring.js';
import { allowPrivateTargets, saveSettings, SettingsError } from './settings.js';

/**
 * User of this request, as verified by Girru's route guard.
 * (Used to decode the token without checking its signature.)
 * @throws {Error} without one
 */
function getUserIdFromRequest(request) {
  if (!request.authUserId) throw new Error('Unauthorized: no signed-in user');
  return String(request.authUserId);
}

/** 401 / 429 / 400 for what the caller can fix, 500 otherwise. */
function statusOf(err, fallback) {
  if (err instanceof TargetError) return 400;
  if (err.message.includes('Unauthorized')) return 401;
  if (err.message.includes('Rate limit')) return 429;
  if (err.message.startsWith('Invalid')) return 400;
  return fallback;
}

/**
 * Validate scan request parameters
 * @throws {Error} if validation fails
 */
function validateScanRequest(body) {
  const { url, mode, categories } = body || {};

  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL: must be a non-empty string');
  }

  if (mode && !['quick', 'full'].includes(mode)) {
    throw new Error('Invalid mode: must be "quick" or "full"');
  }

  if (categories && (!Array.isArray(categories) || categories.length > 20 || categories.some((c) => typeof c !== 'string'))) {
    throw new Error('Invalid categories: must be a list of group names');
  }

  return {
    url,
    mode: mode || 'quick',
    categories: categories || []
  };
}

/** The address of this Girru's own backend, for the self-audit. */
export function ownBackendUrl() {
  return process.env.BACKEND_URL || `http://${process.env.HOST || 'localhost'}:${process.env.PORT || '41522'}`;
}

export function createWafRoutes(api) {
  return async function registerWafRoutes(fastify) {
    const db = api.db;

    /**
     * GET /payloads - List all payload categories
     */
    fastify.get('/payloads', async () => {
      const categories = getPayloadCategories(db);
      return { categories };
    });

    /**
     * GET /settings, PUT /settings - Whether scans may reach local and private network addresses
     */
    fastify.get('/settings', async () => ({ allowPrivateTargets: allowPrivateTargets(api) }));

    fastify.put('/settings', async (request, reply) => {
      try {
        return saveSettings(api, getUserIdFromRequest(request), { allowPrivateTargets: request.body?.allowPrivateTargets });
      } catch (err) {
        if (err instanceof SettingsError) return reply.status(err.message.startsWith('Only') ? 403 : 400).send({ error: err.message });
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });

    /**
     * POST /detect - Detect WAF on target URL
     */
    fastify.post('/detect', async (request, reply) => {
      try {
        getUserIdFromRequest(request);
        const allowPrivate = allowPrivateTargets(api);
        const url = await checkTarget(request.body?.url, { allowPrivate });
        return await detectWAF(url, { allowPrivate });
      } catch (err) {
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });

    /**
     * POST /scan - Start a full WAF scan
     */
    fastify.post('/scan', async (request, reply) => {
      try {
        const userId = getUserIdFromRequest(request);
        const { url, categories, mode } = validateScanRequest(request.body);
        const { scanId } = await startScan(db, { userId, url, mode, categories, allowPrivate: allowPrivateTargets(api) });
        return { scanId, status: 'started' };
      } catch (err) {
        return reply.status(statusOf(err, 400)).send({ error: err.message });
      }
    });

    /**
     * GET /scan/:id - Get scan results
     */
    fastify.get('/scan/:id', async (request, reply) => {
      try {
        const userId = getUserIdFromRequest(request);
        const scan = db.prepare('SELECT * FROM app_waf_security__waf_scans WHERE id = ? AND user_id = ?').get(request.params.id, userId);
        if (!scan) {
          return reply.status(404).send({ error: 'Scan not found' });
        }
        if (scan.results_json) {
          try { scan.results = JSON.parse(scan.results_json); } catch { scan.results = null; }
          delete scan.results_json;
        }
        return scan;
      } catch (err) {
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });

    /**
     * GET /scans - List the user's scans
     */
    fastify.get('/scans', async (request, reply) => {
      try {
        const userId = getUserIdFromRequest(request);
        const scans = db.prepare(`
          SELECT id, target_url, scan_type, waf_detected, waf_type, waf_confidence,
                 total_payloads, blocked_count, passed_count, bypass_rate,
                 risk_level, status, started_at, ended_at, created_at
          FROM app_waf_security__waf_scans
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 50
        `).all(userId);
        return { scans };
      } catch (err) {
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });

    /**
     * DELETE /scans/:id - Delete a scan
     */
    fastify.delete('/scans/:id', async (request, reply) => {
      try {
        const userId = getUserIdFromRequest(request);
        const result = db.prepare('DELETE FROM app_waf_security__waf_scans WHERE id = ? AND user_id = ?').run(request.params.id, userId);
        if (result.changes === 0) {
          return reply.status(404).send({ error: 'Scan not found' });
        }
        return { success: true };
      } catch (err) {
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });

    /**
     * POST /self - Self-audit of this Girru (its own address only)
     */
    fastify.post('/self', async (request, reply) => {
      try {
        getUserIdFromRequest(request);
        return await selfAudit(ownBackendUrl());
      } catch (err) {
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });

    // ==========================================================================
    // CAMPAIGN ROUTES
    // ==========================================================================

    /** The campaign when it is this user's, else a reply was sent. */
    const ownCampaign = (request, reply) => {
      const userId = getUserIdFromRequest(request);
      const campaign = getCampaign(db, request.params.id);
      if (!campaign || campaign.user_id !== userId) {
        reply.status(404).send({ error: 'Campaign not found' });
        return null;
      }
      return campaign;
    };

    /**
     * POST /campaigns - Create new campaign
     */
    fastify.post('/campaigns', async (request, reply) => {
      try {
        const userId = getUserIdFromRequest(request);
        return await createCampaign(db, userId, request.body || {}, { allowPrivate: allowPrivateTargets(api) });
      } catch (err) {
        return reply.status(statusOf(err, 400)).send({ error: err.message });
      }
    });

    /**
     * GET /campaigns - List all campaigns
     */
    fastify.get('/campaigns', async (request, reply) => {
      try {
        const userId = getUserIdFromRequest(request);
        return { campaigns: listCampaigns(db, userId) };
      } catch (err) {
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });

    /**
     * GET /campaigns/:id - Get campaign details
     */
    fastify.get('/campaigns/:id', async (request, reply) => {
      try {
        const campaign = ownCampaign(request, reply);
        if (!campaign) return reply;
        const scans = db.prepare(`
          SELECT * FROM app_waf_security__waf_campaign_scans
          WHERE campaign_id = ?
          ORDER BY run_number DESC, stage ASC
        `).all(campaign.id);
        const comparisons = db.prepare(`
          SELECT * FROM app_waf_security__waf_campaign_comparisons
          WHERE campaign_id = ?
          ORDER BY created_at DESC
        `).all(campaign.id);
        return { ...campaign, scans, comparisons };
      } catch (err) {
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });

    /**
     * POST /campaigns/:id/run - Run campaign
     */
    fastify.post('/campaigns/:id/run', async (request, reply) => {
      try {
        const campaign = ownCampaign(request, reply);
        if (!campaign) return reply;
        if (campaign.status === 'running') return reply.status(409).send({ error: 'Campaign is already running' });
        const allowPrivate = allowPrivateTargets(api);
        await checkTarget(campaign.target_domain, { allowPrivate });
        runCampaign(db, campaign.id, { allowPrivate }).catch(err => {
          console.error('[Campaign Run] Error:', err.message);
        });
        return { campaignId: campaign.id, status: 'started', message: 'Campaign execution started' };
      } catch (err) {
        return reply.status(statusOf(err, 400)).send({ error: err.message });
      }
    });

    /**
     * DELETE /campaigns/:id - Delete campaign
     */
    fastify.delete('/campaigns/:id', async (request, reply) => {
      try {
        const campaign = ownCampaign(request, reply);
        if (!campaign) return reply;
        deleteCampaign(db, campaign.id);
        return { success: true };
      } catch (err) {
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });

    /**
     * GET /campaigns/:id/score - Get detailed security score
     */
    fastify.get('/campaigns/:id/score', async (request, reply) => {
      try {
        const campaign = ownCampaign(request, reply);
        if (!campaign) return reply;
        const latestScan = db.prepare(`
          SELECT cs.*, s.results_json
          FROM app_waf_security__waf_campaign_scans cs
          INNER JOIN app_waf_security__waf_scans s ON cs.scan_id = s.id
          WHERE cs.campaign_id = ? AND cs.stage = 4
          ORDER BY cs.run_number DESC
          LIMIT 1
        `).get(campaign.id);
        if (!latestScan || !latestScan.results_json) {
          return reply.status(404).send({ error: 'No completed scans found' });
        }
        const scanResults = JSON.parse(latestScan.results_json);
        const score = calculateSecurityScore(scanResults);
        const recommendations = generateRecommendations(scanResults, score);
        return { score, recommendations, scanId: latestScan.scan_id, runNumber: latestScan.run_number };
      } catch (err) {
        return reply.status(statusOf(err, 500)).send({ error: err.message });
      }
    });
  };
}
