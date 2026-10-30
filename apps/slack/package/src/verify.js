/**
 * Slack request signatures (X-Slack-Signature, v0). The public /webhook route must prove the
 * request came from Slack before touching any data. Every check fails closed: a missing
 * secret, header or raw body means the request is refused.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SLACK_MAX_AGE_SECONDS = 5 * 60;

/** Constant-time string comparison (false for different lengths or non-strings). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** JSON and form body parsers on this route scope that keep the raw body on `request.rawBody`. */
export function registerRawBodyParsers(fastify) {
  for (const type of ['application/json', 'application/x-www-form-urlencoded']) {
    if (fastify.hasContentTypeParser(type)) fastify.removeContentTypeParser(type);
  }
  fastify.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 1024 * 1024 }, (request, body, done) => {
    request.rawBody = body;
    if (!body) return done(null, {});
    try {
      done(null, JSON.parse(body));
    } catch (error) {
      error.statusCode = 400;
      done(error);
    }
  });
  fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 1024 * 1024 }, (request, body, done) => {
    request.rawBody = body;
    done(null, Object.fromEntries(new URLSearchParams(body)));
  });
}

export function slackSignature(signingSecret, timestamp, rawBody) {
  return 'v0=' + createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex');
}

/**
 * Verify a Slack request: signing secret configured, timestamp within five minutes
 * (replay window), and the v0 signature over the raw body.
 */
export function verifySlackRequest(request, signingSecret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!signingSecret) return false;
  const timestamp = request.headers['x-slack-request-timestamp'];
  const signature = request.headers['x-slack-signature'];
  if (typeof timestamp !== 'string' || !/^\d{1,12}$/.test(timestamp)) return false;
  if (typeof signature !== 'string') return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > SLACK_MAX_AGE_SECONDS) return false;
  if (typeof request.rawBody !== 'string') return false;
  return safeEqual(signature, slackSignature(signingSecret, timestamp, request.rawBody));
}
