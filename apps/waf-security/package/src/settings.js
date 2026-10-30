/**
 * The app's one setting, kept in its Girru extension config: whether scans may reach local and
 * private network addresses. Off unless the owner turns it on; anything unreadable counts as off.
 */

export function allowPrivateTargets(api) {
  try {
    return api.getConfig()?.allowPrivateTargets === true;
  } catch {
    return false;
  }
}

export function saveSettings(api, { allowPrivateTargets }) {
  let config = {};
  try { config = api.getConfig() || {}; } catch { config = {}; }
  api.setConfig({ ...config, allowPrivateTargets: allowPrivateTargets === true });
  return { allowPrivateTargets: allowPrivateTargets === true };
}
