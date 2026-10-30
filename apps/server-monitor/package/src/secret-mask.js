/**
 * Secret masking for this app's answers: a stored secret is never sent back, not even in part.
 * Answers carry a fixed placeholder and has_<key>: true; a placeholder sent back on update
 * means "keep the stored secret".
 */

export const SECRET_PLACEHOLDER = '••••••••';

/** True when a value sent by a client is a placeholder (ours, or "****" / "abcd...wxyz"), not a new secret. */
export function isMaskedSecret(value) {
  if (typeof value !== 'string' || value === '') return false;
  if (value.includes('•')) return true;
  if (/^\*{4,}$/.test(value)) return true;
  if (/^.{4}\.\.\..{4}$/.test(value)) return true;
  return false;
}

const SECRET_KEY = /(pass(word|phrase)?|secret|token|api[_-]?key|apikey|private[_-]?key|credentials?(_json)?|auth[_-]?key|access[_-]?key)$/i;
export const isSecretKey = (key) => SECRET_KEY.test(key);

/** A copy with every secret-looking key replaced by the placeholder, and has_<key>: true added. */
export function maskSecretFields(config) {
  if (!config || typeof config !== 'object') return config;
  const out = { ...config };
  for (const [key, value] of Object.entries(config)) {
    if (!isSecretKey(key) || value === null || value === undefined || value === '') continue;
    out[key] = SECRET_PLACEHOLDER;
    out[`has_${key}`] = true;
  }
  return out;
}

/** The incoming entry with placeholders swapped back for the stored secrets; has_<key> markers dropped. */
export function restoreMaskedFields(incoming, stored) {
  const out = { ...incoming };
  for (const [key, value] of Object.entries(incoming)) {
    if (key.startsWith('has_') && isSecretKey(key.slice(4)) && typeof value === 'boolean') {
      delete out[key];
      continue;
    }
    if (isSecretKey(key) && isMaskedSecret(value)) {
      if (stored && stored[key] !== undefined) out[key] = stored[key];
      else delete out[key];
    }
  }
  return out;
}
