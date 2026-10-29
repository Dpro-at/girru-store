#!/usr/bin/env node
// Builds index.json from the item folders (apps/, mcp/, skills/, specialties/), one
// manifest.json per item. The rules match what Girru accepts (its parseStoreIndex), so
// an item that passes here shows in the Store. `--check` fails if index.json is out of date.
// Node 20+, no packages.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const KINDS = { apps: 'app', mcp: 'mcp', skills: 'skill', specialties: 'specialty' };
const CATEGORIES = ['marketing', 'sales', 'developer', 'worlds', 'trading', 'productivity', 'more'];
const PRICING = ['free']; // later: 'one-time', 'subscription' (paid apps, not open yet)
const FIELDS = ['id', 'kind', 'name', 'summary', 'description', 'icon', 'maker', 'version', 'updated', 'category', 'permissions', 'worksWith', 'languages', 'pricing'];
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ICON = /^[a-z][a-z-]{0,39}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
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
  return {
    id: m.id, kind: m.kind, source: 'girru',
    name: str(m.name, 150, where, 'name'), summary: str(m.summary, 200, where, 'summary'), description: str(m.description, 3000, where, 'description'),
    icon: m.icon, maker: str(m.maker, 150, where, 'maker'), verified: true, version: m.version, updated: m.updated, category: m.category,
    permissions: strs(m.permissions, 60, 200, where, 'permissions'), worksWith: strs(m.worksWith, 20, 120, where, 'worksWith'), languages: strs(m.languages, 20, 60, where, 'languages'),
    pricing: { model: m.pricing.model },
  };
}

export function buildIndex() {
  const items = [];
  for (const folder of Object.keys(KINDS)) {
    const base = path.join(ROOT, folder);
    for (const dir of fs.readdirSync(base).sort()) {
      if (dir.startsWith('.')) continue;
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
      { id: 'made-by-girru', title: 'Made by Girru', items: items.filter((i) => i.maker === 'Girru').map((i) => i.id) },
      { id: 'new', title: 'New in the store', items: byNew.slice(0, 12).map((i) => i.id) },
    ],
    items,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const text = JSON.stringify(buildIndex(), null, 2) + '\n';
    const file = path.join(ROOT, 'index.json');
    if (process.argv.includes('--check')) {
      const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (now !== text) { console.error('index.json is out of date: run node scripts/build-index.mjs and commit it'); process.exit(1); }
      console.log('index.json is up to date');
    } else { fs.writeFileSync(file, text); console.log(`index.json: ${JSON.parse(text).items.length} items`); }
  } catch (error) { console.error(error.message); process.exit(1); }
}
