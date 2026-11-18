/* Security app UI logic — ships inside the app package (apps/waf-security/package/ui/).
 * Plain browser JS, no build step. Talks to the app's own backend at /api/ext/waf-security/*.
 *
 * Auth: the UI runs inside the Girru shell (an embedded frame, same origin as the backend). On
 * load it asks the parent shell for the owner's session token over postMessage; the shell replies
 * with { token, theme }. Requests then carry Authorization: Bearer <token>. If no shell answers
 * (opened directly), it falls back to same-origin cookies so a remembered session still works.
 * The token is kept only in memory here and never logged or persisted. */
(function () {
  'use strict';
  var API = '/api/ext/waf-security';
  var token = null;

  /* ---- token + theme handshake with the host shell ---- */
  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
  }
  window.addEventListener('message', function (e) {
    // Only the shell that embeds this page (same origin, the parent frame) may hand us a token or
    // theme — never another frame or origin. The page and its backend are same-origin by design.
    if (e.source !== window.parent || e.origin !== location.origin) return;
    var d = e.data || {};
    if (d.type === 'girru:token') { token = d.token || null; applyTheme(d.theme); render(); }
    else if (d.type === 'girru:theme') applyTheme(d.theme);
  });
  try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'girru:need-token' }, location.origin); } catch (_) {}

  /* ---- fetch helpers ---- */
  function headers() { var h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token; return h; }
  async function api(method, path, body) {
    var res = await fetch(API + path, {
      method: method,
      headers: headers(),
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) { var msg = 'request failed'; try { msg = (await res.json()).error || msg; } catch (_) {} throw new Error(msg); }
    return res.status === 204 ? null : res.json();
  }
  var get = function (p) { return api('GET', p); };
  var post = function (p, b) { return api('POST', p, b); };
  var del = function (p) { return api('DELETE', p); };

  /* ---- icons (same stroke set as the shell's UiIcon names) ---- */
  var PATHS = {
    home: 'M3 11l9-8 9 8M5 10v10h14V10', server: 'M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01',
    globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    bug: 'M8 7a4 4 0 018 0M6 11h12M5 15h14M12 7v12M4 11v4M20 11v4', calendar: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4',
    shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z', gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM4 12h2M18 12h2M12 4v2M12 18v2',
    search: 'M11 4a7 7 0 105 12 7 7 0 00-5-12zM20 20l-4-4', plus: 'M12 5v14M5 12h14', play: 'M7 5l12 7-12 7z',
    refresh: 'M4 11a8 8 0 0114-5l2 2M20 13a8 8 0 01-14 5l-2-2', check: 'M5 13l4 4L19 7',
  };
  function icon(name, size) { size = size || 16; return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + (PATHS[name] || PATHS.shield) + '"/></svg>'; }
  function sevColor(s) { return { critical: '#d1242f', high: '#e8590c', medium: '#d9a300', low: '#1f883d', info: '#6b7280' }[s] || '#6b7280'; }
  function dot(s) { return '<span style="display:inline-block;width:8px;height:8px;border-radius:8px;flex:0 0 auto;background:' + sevColor(s) + '"></span>'; }
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var PLACES = [['overview', 'Overview', 'home'], ['servers', 'Servers', 'server'], ['sites', 'Sites', 'globe'], ['findings', 'Findings', 'bug'], ['campaigns', 'Campaigns', 'calendar'], ['this-girru', 'This Girru', 'shield'], ['settings', 'Settings', 'gear']];
  var SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

  var state = { place: 'overview', needs: [], findings: [], assets: [], selAsset: null, selFinding: null, detail: null, self: null, settings: null, error: '', busy: false };

  function sidebar() {
    var h = '<p class="section-label">Security</p>';
    PLACES.forEach(function (p) {
      var badge = (p[0] === 'findings' && state.needs.length) ? '<span class="badge">' + state.needs.length + '</span>' : '';
      h += '<button class="nav-item' + (state.place === p[0] ? ' active' : '') + '" data-place="' + p[0] + '" title="' + p[1] + '">' + icon(p[2]) + '<span>' + p[1] + '</span>' + badge + '</button>';
    });
    document.getElementById('sidebar').innerHTML = h;
  }
  function empty(ic, line) { return '<div class="empty">' + icon(ic, 24) + '<p>' + esc(line) + '</p></div>'; }
  function errBar() { return state.error ? '<div class="notice">' + esc(state.error) + '</div>' : ''; }

  /* ---- place views ---- */
  function viewOverview() {
    var h = errBar() + '<header class="tools"><strong>Overview</strong><span class="quiet">What needs you now</span></header>';
    if (!state.needs.length) return h + empty('check', "You're clear. Nothing needs you right now.");
    h += '<ul class="list">';
    state.needs.forEach(function (n) { h += '<li class="row" data-goto="findings">' + dot(n.severity) + '<span class="row-main">' + esc(n.text) + '</span><span class="quiet">' + esc(n.where || '') + '</span></li>'; });
    return h + '</ul>';
  }
  function viewAssets(kind) {
    var title = kind === 'server' ? 'Servers' : 'Sites', addLbl = kind === 'server' ? 'Add server' : 'Add site';
    var h = '<div class="split"><section class="list-pane">' + errBar() + '<header class="tools"><strong>' + title + '</strong><button class="primary" data-add="' + kind + '">' + icon('plus') + ' ' + addLbl + '</button></header>';
    if (!state.assets.length) h += empty(kind === 'server' ? 'server' : 'globe', kind === 'server' ? 'Add a server you own to watch its ports, services and certificate.' : 'Add a site you own to test its headers, certificate and firewall.');
    else {
      h += '<ul class="list">';
      state.assets.forEach(function (a) {
        var cov = a.coverage && a.coverage.total ? (a.coverage.issue + ' issue(s) · ' + a.coverage.ok + ' clean') : 'not checked yet';
        h += '<li class="row' + (state.selAsset && state.selAsset.id === a.id ? ' sel' : '') + '" data-asset="' + esc(a.id) + '">' + icon(kind === 'server' ? 'server' : 'globe') + '<span class="row-main">' + esc(a.label) + '</span><span class="quiet">' + esc(cov) + '</span></li>';
      });
      h += '</ul>';
    }
    h += '</section><aside class="inspector">';
    var a = state.selAsset;
    if (a) {
      h += '<h3 class="insp-title">' + esc(a.label) + '</h3><p class="quiet">' + esc(a.base_url || a.host) + (a.is_private ? ' · private address' : '') + '</p><dl class="dl"><dt>Last checked</dt><dd>' + esc(a.last_checked_at || 'never') + '</dd><dt>Coverage</dt><dd>' + (a.coverage ? (a.coverage.total + ' checks · ' + a.coverage.ok + ' clean · ' + a.coverage.issue + ' issue(s) · ' + a.coverage.notTested + ' not tested') : '—') + '</dd></dl><div class="insp-actions"><button class="primary" data-scan="' + esc(a.id) + '"' + (state.busy ? ' disabled' : '') + '>' + icon('play') + ' ' + (state.busy ? 'Scanning…' : 'Scan now') + '</button><button class="ghost" data-forget="' + esc(a.id) + '">Forget</button></div>';
    } else h += empty('search', 'Select an item to see its details.');
    return h + '</aside></div>';
  }
  function viewFindings() {
    var fs = state.findings.slice().sort(function (a, b) { return SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity); });
    var h = '<div class="split"><section class="list-pane">' + errBar() + '<header class="tools"><strong>Findings</strong><span class="quiet">By severity</span></header>';
    if (!fs.length) h += empty('check', 'No open findings. Run a scan from Servers or Sites.');
    else { h += '<ul class="list">'; fs.forEach(function (f) { h += '<li class="row' + (state.selFinding && state.selFinding.id === f.id ? ' sel' : '') + '" data-finding="' + esc(f.id) + '">' + dot(f.severity) + '<span class="row-main">' + esc(f.title) + '</span><span class="quiet">' + esc(f.where_url || '') + '</span></li>'; }); h += '</ul>'; }
    h += '</section><aside class="inspector">';
    var d = state.detail;
    if (d) {
      h += '<h3 class="insp-title">' + esc(d.title) + '</h3><p class="quiet">' + esc(d.severity) + ' · ' + esc(d.category) + ' · ' + esc(d.status) + '</p>';
      if (d.summary) h += '<p>' + esc(d.summary) + '</p>';
      if (d.fix_hint) h += '<p><strong>Fix:</strong> ' + esc(d.fix_hint) + '</p>';
      h += '<h4 class="h4">Evidence</h4>';
      (d.evidence || []).forEach(function (e) { h += '<details class="evidence" open><summary>' + esc(e.role) + ' · ' + esc(e.kind) + (e.integrity_ok === false ? ' ⚠ hash mismatch' : '') + '</summary><pre class="pre">' + esc(String(e.body).slice(0, 2000)) + '</pre></details>'; });
      h += '<div class="insp-actions"><button class="primary" data-retest="reproduced">' + icon('refresh') + ' Retest</button><button class="ghost" data-retest="fixed">Mark fixed</button></div>';
    } else h += empty('search', 'Select a finding to see its evidence and retest it.');
    return h + '</aside></div>';
  }
  function viewCampaigns() {
    var h = errBar() + '<header class="tools"><strong>Campaigns</strong><span class="quiet">Scheduled checks</span></header>';
    if (!state.campaigns || !state.campaigns.length) return h + empty('calendar', 'Save a test to repeat it on a schedule and watch its score over time.');
    h += '<ul class="list">'; state.campaigns.forEach(function (c) { h += '<li class="row">' + icon('calendar') + '<span class="row-main">' + esc(c.name) + '</span><span class="quiet">' + esc(c.target_domain || '') + '</span></li>'; }); return h + '</ul>';
  }
  function viewThisGirru() {
    var h = errBar() + '<header class="tools"><strong>This Girru</strong><button class="primary" data-self="1"' + (state.busy ? ' disabled' : '') + '>' + icon('shield') + ' ' + (state.busy ? 'Checking…' : 'Run self-audit') + '</button></header>';
    if (!state.self) return h + empty('shield', "Check this Girru's own security headers, CORS, sign-in and rate limits.");
    h += '<ul class="list">'; (state.self.issues || []).forEach(function (i) { h += '<li class="row">' + dot(i.severity) + '<span class="row-main">' + esc(i.detail) + '</span><span class="quiet">' + esc(i.recommendation || '') + '</span></li>'; }); return h + '</ul>';
  }
  function viewSettings() {
    var s = state.settings || { allowPrivateTargets: false, noiseProfile: 'quiet' };
    return errBar() + '<header class="tools"><strong>Settings</strong><span class="quiet">Advanced options</span></header><div style="max-width:560px;padding:16px"><label class="check"><input type="checkbox" data-set="allowPrivateTargets"' + (s.allowPrivateTargets ? ' checked' : '') + '> Allow private / owned network addresses (logged)</label><label class="field"><span>Scan pacing</span><select class="input" data-set="noiseProfile"><option value="quiet"' + (s.noiseProfile === 'quiet' ? ' selected' : '') + '>Quiet (gentlest)</option><option value="balanced"' + (s.noiseProfile === 'balanced' ? ' selected' : '') + '>Balanced</option><option value="aggressive"' + (s.noiseProfile === 'aggressive' ? ' selected' : '') + '>Aggressive (fastest)</option></select></label><p class="quiet">Sensor pairing tokens, the payload library and the waf_scan agent permission also live here.</p></div>';
  }

  function render() {
    sidebar();
    var m = document.getElementById('main'), p = state.place;
    if (p === 'overview') m.innerHTML = viewOverview();
    else if (p === 'servers') m.innerHTML = viewAssets('server');
    else if (p === 'sites') m.innerHTML = viewAssets('site');
    else if (p === 'findings') m.innerHTML = viewFindings();
    else if (p === 'campaigns') m.innerHTML = viewCampaigns();
    else if (p === 'this-girru') m.innerHTML = viewThisGirru();
    else if (p === 'settings') m.innerHTML = viewSettings();
  }

  /* ---- data loading per place ---- */
  async function loadBadges() { try { var o = await get('/overview'); state.needs = (o && o.needsYou) || []; } catch (e) { state.needs = []; } }
  async function loadPlace() {
    state.error = '';
    try {
      if (state.place === 'overview') { await loadBadges(); }
      else if (state.place === 'servers' || state.place === 'sites') { var k = state.place === 'servers' ? 'server' : 'site'; var d = await get('/assets?kind=' + k); state.assets = (d && d.assets) || []; }
      else if (state.place === 'findings') { var f = await get('/findings?status=open'); state.findings = (f && f.findings) || []; }
      else if (state.place === 'campaigns') { var c = await get('/campaigns'); state.campaigns = (c && c.campaigns) || []; }
      else if (state.place === 'settings') { state.settings = await get('/settings'); }
    } catch (e) { state.error = 'Could not load: ' + e.message; }
    render();
  }

  function go(place) { state.place = place; state.selAsset = null; state.selFinding = null; state.detail = null; state.self = null; render(); loadPlace(); }

  /* ---- interactions ---- */
  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-place],[data-goto],[data-asset],[data-finding],[data-scan],[data-forget],[data-add],[data-retest],[data-self]');
    if (!t) return;
    if (t.dataset.place) return go(t.dataset.place);
    if (t.dataset.goto) return go(t.dataset.goto);
    if (t.dataset.asset) { state.selAsset = state.assets.filter(function (a) { return a.id === t.dataset.asset; })[0] || null; return render(); }
    if (t.dataset.finding) { try { state.selFinding = { id: t.dataset.finding }; state.detail = await get('/findings/' + t.dataset.finding); render(); } catch (err) { state.error = err.message; render(); } return; }
    if (t.dataset.scan) { state.busy = true; render(); try { await post('/assets/' + t.dataset.scan + '/scan'); await loadPlace(); await loadBadges(); } catch (err) { state.error = err.message; } state.busy = false; render(); return; }
    if (t.dataset.forget) { try { await del('/assets/' + t.dataset.forget); state.selAsset = null; await loadPlace(); } catch (err) { state.error = err.message; render(); } return; }
    if (t.dataset.retest && state.selFinding) { try { await post('/findings/' + state.selFinding.id + '/retest', { verdict: t.dataset.retest, oppositeCheck: 'Manual retest from the inspector.' }); state.detail = await get('/findings/' + state.selFinding.id); await loadBadges(); render(); } catch (err) { state.error = err.message; render(); } return; }
    if (t.dataset.self) { state.busy = true; render(); try { state.self = await post('/self', {}); } catch (err) { state.error = err.message; } state.busy = false; render(); return; }
    if (t.dataset.add) { alert('Use the inspector form to add a ' + t.dataset.add + ' (coming in the add step).'); return; }
  });
  document.addEventListener('change', async function (e) {
    var t = e.target.closest('[data-set]'); if (!t) return;
    var patch = {}; patch[t.dataset.set] = t.type === 'checkbox' ? t.checked : t.value;
    try { state.settings = await api('PUT', '/settings', patch); } catch (err) { state.error = err.message; render(); }
  });

  /* first paint (works before the token arrives; reloads once it does) */
  render();
  loadPlace();
})();
