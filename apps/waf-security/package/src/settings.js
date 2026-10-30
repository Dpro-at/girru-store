/**
 * The app's one setting, kept in its Girru extension config: whether scans may reach local and
 * private network addresses. Off unless the owner turns it on; anything unreadable counts as off.
 * Only Girru's active owner may change it; each change is logged and kept with who made it.
 */

export function allowPrivateTargets(api) {
  try {
    return api.getConfig()?.allowPrivateTargets === true;
  } catch {
    return false;
  }
}

/** True only for Girru's active owner (not an admin); any doubt means no. */
export function isActiveOwner(api, userId) {
  if (!userId) return false;
  try {
    const user = api.db.prepare('SELECT role, status FROM users WHERE id = ?').get(String(userId));
    return !!user && user.role === 'owner' && user.status === 'active';
  } catch {
    return false;
  }
}

/** An active owner or admin, by Girru's own check (the one the scheduler uses); any doubt means no. */
export function mayUseApp(api, userId) {
  if (!userId || typeof api.authorizeChannelUser !== 'function') return false;
  try {
    api.authorizeChannelUser(String(userId)); // throws unless an active owner or admin
    return true;
  } catch {
    return false;
  }
}

export class SettingsError extends Error {}

export function saveSettings(api, userId, { allowPrivateTargets }) {
  if (typeof allowPrivateTargets !== 'boolean') throw new SettingsError('allowPrivateTargets must be true or false');
  if (!isActiveOwner(api, userId)) throw new SettingsError('Only the owner can change this setting');
  let config = {};
  try { config = api.getConfig() || {}; } catch { config = {}; }
  const before = config.allowPrivateTargets === true;
  if (before !== allowPrivateTargets) {
    api.setConfig({ ...config, allowPrivateTargets, allowPrivateTargetsChangedBy: String(userId), allowPrivateTargetsChangedAt: new Date().toISOString() });
    api.log('warn', `Scans to local and private network addresses turned ${allowPrivateTargets ? 'on' : 'off'}`, { userId: String(userId) });
  }
  return { allowPrivateTargets };
}
