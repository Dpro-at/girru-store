#!/usr/bin/env node
// Builds index.json from the item folders (apps/, mcp/, skills/, specialties/), one
// manifest.json per item. The rules match what Girru accepts (its parseStoreIndex), so
// an item that passes here shows in the Store. `--check` fails if index.json is out of date.
// Node 20+, no packages.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const KINDS = { apps: 'app', mcp: 'mcp', skills: 'skill', specialties: 'specialty' };
const CATEGORIES = ['marketing', 'sales', 'developer', 'worlds', 'trading', 'productivity', 'more'];
const PRICING = ['free']; // later: 'one-time', 'subscription' (paid apps, not open yet)
const FIELDS = ['id', 'kind', 'name', 'summary', 'description', 'icon', 'maker', 'version', 'updated', 'category', 'permissions', 'worksWith', 'languages', 'pricing'];
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ICON = /^[a-z][a-z-]{0,39}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// A package: the files Girru downloads for an app (apps/<id>/package/). Plain text and images only.
const PACKAGE_EXT = /\.(js|mjs|json|sql|md|css|svg|png|txt)$/i;
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const MAX_FILES = 300, MAX_BYTES = 5 * 1024 * 1024;
const sha = (b) => createHash('sha256').update(b).digest('hex');
function readPackage(where, dir) {
  if (!fs.existsSync(dir)) return null;
  const files = [];
  let total = 0;
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(dir, rel)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      const st = fs.lstatSync(path.join(dir, r));
      if (st.isSymbolicLink()) fail(where, `package/${r} is a link`);
      if (!SEGMENT.test(name)) fail(where, `package/${r}: names are letters, digits, . _ - only`);
      if (st.isDirectory()) { walk(r); continue; }
      if (!PACKAGE_EXT.test(name)) fail(where, `package/${r}: only .js .mjs .json .sql .md .css .svg .png .txt files`);
      const bytes = fs.readFileSync(path.join(dir, r));
      total += bytes.length;
      files.push({ path: r, sha256: sha(bytes), size: bytes.length });
    }
  };
  walk('');
  if (!files.some((f) => f.path === 'agentplayer.plugin.json')) fail(where, 'package/agentplayer.plugin.json is missing');
  // Its tables must be named after it, so removing it never touches Girru's own data.
  const prefix = `${path.basename(path.dirname(dir)).replace(/-/g, '_')}_`;
  for (const f of files.filter((x) => x.path.endsWith('.sql'))) {
    for (const m of fs.readFileSync(path.join(dir, f.path), 'utf8').matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z_][A-Za-z0-9_]*)/gi)) {
      if (!m[1].toLowerCase().startsWith(prefix)) fail(where, `package/${f.path} makes table ${m[1]}: tables must start with ${prefix}`);
    }
  }
  if (files.length > MAX_FILES || total > MAX_BYTES) fail(where, `a package holds at most ${MAX_FILES} files and 5 MB`);
  return { files, sha256: sha(JSON.stringify(files)) };
}
const CONTROL = /[\u0000-\u001f\u007f‪-‮⁦-⁩]/;

function fail(where, why) { throw new Error(`${where}: ${why}`); }
const str = (v, max, where, name, need = true) => {
  if (typeof v !== 'string' || (need && !v.trim()) || v.length > max || CONTROL.test(v)) fail(where, `${name} must be text of at most ${max} characters`);
  return v;
};
const strs = (v, max, each, where, name) => {
  if (!Array.isArray(v) || v.length > max) fail(where, `${name} must be a list of at most ${max}`);
  return v.map((x) => str(x, each, where, name));
};

function readItem(folder, dir) {
  const where = `${folder}/${dir}/manifest.json`;
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(ROOT, folder, dir, 'manifest.json'), 'utf8')); } catch { fail(where, 'missing or not JSON'); }
  for (const k of Object.keys(m)) if (!FIELDS.includes(k)) fail(where, `unknown field "${k}"`);
  if (m.id !== dir || !ID.test(m.id)) fail(where, 'id must equal the folder name (a-z, 0-9, -)');
  if (m.kind !== KINDS[folder]) fail(where, `kind must be "${KINDS[folder]}" in ${folder}/`);
  if (!CATEGORIES.includes(m.category)) fail(where, `category must be one of ${CATEGORIES.join(', ')}`);
  if (m.icon !== null && (typeof m.icon !== 'string' || !ICON.test(m.icon))) fail(where, 'icon must be a Girru icon name or null');
  if (m.version !== null && (typeof m.version !== 'string' || m.version.length > 80)) fail(where, 'version must be text or null');
  if (m.updated !== null && (typeof m.updated !== 'string' || !DATE.test(m.updated))) fail(where, 'updated must be YYYY-MM-DD or null');
  if (!m.pricing || typeof m.pricing !== 'object' || !PRICING.includes(m.pricing.model) || Object.keys(m.pricing).length !== 1) fail(where, 'pricing must be { "model": "free" } (paid apps are not open yet)');
  const pkg = folder === 'apps' ? readPackage(where, path.join(ROOT, folder, dir, 'package')) : null;
  if (pkg && (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(m.version))) fail(where, 'an app with a package needs a version like 1.0.0');
  if (pkg) {
    const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, folder, dir, 'package', 'agentplayer.plugin.json'), 'utf8'));
    if (plugin.id !== m.id || plugin.version !== m.version) fail(where, 'package/agentplayer.plugin.json must have the same id and version');
  }
  return {
    id: m.id, kind: m.kind, source: 'girru',
    name: str(m.name, 150, where, 'name'), summary: str(m.summary, 200, where, 'summary'), description: str(m.description, 3000, where, 'description'),
    icon: m.icon, maker: str(m.maker, 150, where, 'maker'), verified: true, version: m.version, updated: m.updated, category: m.category,
    permissions: strs(m.permissions, 60, 200, where, 'permissions'), worksWith: strs(m.worksWith, 20, 120, where, 'worksWith'), languages: strs(m.languages, 20, 60, where, 'languages'),
    pricing: { model: m.pricing.model },
    ...(pkg ? { package: pkg } : {}),
  };
}

export function buildIndex() {
  const items = [];
  for (const folder of Object.keys(KINDS)) {
    const base = path.join(ROOT, folder);
    for (const dir of fs.readdirSync(base).sort()) {
      if (dir.startsWith('.')) continue; // .gitkeep
      if (!fs.statSync(path.join(base, dir)).isDirectory()) fail(`${folder}/${dir}`, 'only item folders belong here');
      items.push(readItem(folder, dir));
    }
  }
  const ids = new Set();
  for (const i of items) { if (ids.has(i.id)) fail(i.id, 'the same id is used twice'); ids.add(i.id); }
  const byNew = [...items].sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? '') || a.id.localeCompare(b.id));
  return {
    schema: 1,
    featured: ids.has('genvr') ? 'genvr' : null,
    collections: [
      // A collection lists at most 60 items (Girru refuses more): Girru's own apps here; its skills and specialties have their own places.
      { id: 'made-by-girru', title: 'Made by Girru', items: items.filter((i) => i.maker === 'Girru' && i.kind === 'app').slice(0, 60).map((i) => i.id) },
      { id: 'new', title: 'New in the store', items: byNew.slice(0, 12).map((i) => i.id) },
    ],
    items,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const built = buildIndex();
    // Girru's own limits: past them the Store refuses the whole index.
    if (built.items.length > 2000 || built.collections.length > 20 || built.collections.some((c) => c.items.length > 60)) throw new Error('index.json is over Girru\'s limits (2000 items, 20 collections, 60 items each)');
    const text = JSON.stringify(built, null, 2) + '\n';
    const file = path.join(ROOT, 'index.json');
    if (process.argv.includes('--check')) {
      const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (now !== text) { console.error('index.json is out of date: run node scripts/build-index.mjs and commit it'); process.exit(1); }
      console.log('index.json is up to date');
    } else { fs.writeFileSync(file, text); console.log(`index.json: ${JSON.parse(text).items.length} items`); }
  } catch (error) { console.error(error.message); process.exit(1); }
}
