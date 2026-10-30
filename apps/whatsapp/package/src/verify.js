/**
 * Twilio request signatures (X-Twilio-Signature). The public /webhook route must prove the
 * request came from Twilio before touching any data. Every check fails closed: a missing auth
 * token, header or URL means the request is refused.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

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

/**
 * Twilio signature: base64 HMAC-SHA1 (key = auth token) of the full webhook URL followed by
 * every POST parameter name and value, sorted by name.
 */
export function twilioSignature(authToken, url, params = {}) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + (params[key] ?? ''), url);
  return createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

/** True only when the auth token, URL and signature are present and the signature matches. */
export function verifyTwilioRequest(request, authToken, url) {
  if (!authToken || typeof authToken !== 'string' || !url) return false;
  const signature = request.headers['x-twilio-signature'];
  if (typeof signature !== 'string' || !signature) return false;
  const params = request.body && typeof request.body === 'object' ? request.body : {};
  return safeEqual(signature, twilioSignature(authToken, url, params));
}

/**
 * The public URL Twilio called for this request: PUBLIC_URL (or `baseUrl`) plus the path and
 * query as received. Null when no public base URL is set.
 */
export function publicRequestUrl(request, baseUrl = process.env.PUBLIC_URL) {
  if (!baseUrl) return null;
  return `${String(baseUrl).replace(/\/+$/, '')}${request.url}`;
}
