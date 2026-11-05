# Girru Store

Everything people can add to [Girru](https://github.com/Dpro-at/Girru): apps, MCP servers, skills and specialties. The Store inside Girru reads this repository's `index.json`, so a new item shows up without a new Girru release.

## Layout

```
apps/<id>/manifest.json         an app (a page, tools and data of its own)
mcp/<id>/manifest.json          an MCP server
skills/<id>/manifest.json       a skill (written guidance)
specialties/<id>/manifest.json  a specialty (a job an agent can have)
index.json                      built from the folders: never edit it by hand
```

One folder per item; the folder name is the item's id.

## A manifest

```json
{
  "id": "genvr",
  "kind": "app",
  "name": "GenVR",
  "summary": "3D worlds for your agents.",
  "description": "What it does, in plain words.",
  "icon": "globe",
  "maker": "Girru",
  "version": null,
  "updated": "2026-10-29",
  "category": "worlds",
  "permissions": ["What it asks for, in plain words"],
  "worksWith": [],
  "languages": ["English"],
  "pricing": { "model": "free" }
}
```

- `kind`: `app`, `mcp`, `skill` or `specialty` (it must match the folder it is in).
- `category`: `marketing`, `sales`, `developer`, `worlds`, `trading`, `productivity` or `more`.
- `icon`: a Girru icon name, or `null` for the item's first letter.
- `permissions`: every thing the item can do, said plainly. Adding an item never gives its tools to an agent by itself.
- `pricing`: only `{ "model": "free" }` today. Paid items come later; the field is there so they fit without changing the format.

## An app's package

An app that Girru can add has a `package/` folder next to its manifest:

```
apps/<id>/manifest.json
apps/<id>/package/agentplayer.plugin.json   same id and version as the manifest
apps/<id>/package/index.js                   its code (the plugin's "main")
apps/<id>/package/migrations/001_*.sql       its tables, named app_<id>__... only
```

`build-index` lists every file of the package with its size and SHA-256 in `index.json`. Girru gets each file, checks it against that list before writing anything, puts the app in the owner's data folder (never in the program), runs only the app's own migrations, and turns it on. A migration may only contain `CREATE TABLE IF NOT EXISTS` and `CREATE [UNIQUE] INDEX IF NOT EXISTS` for the app's own tables, named `app_<id>__...` (with `-` as `_`; ids never contain `--`), so an app can never change, read into or remove Girru's own data. Allowed files (lower-case extensions): `.js .mjs .json .sql .md .css .svg .png .txt`, at most 300 files and 5 MB. The exact root file `runtime-packages.npm` is also accepted for the reviewed Agent Connect runtime descriptor described below.

## Build the index

```bash
node scripts/build-index.mjs
```

`node scripts/build-index.mjs --check` fails when `index.json` is out of date; it runs on every pull request.

## Adding an item

See [CONTRIBUTING.md](CONTRIBUTING.md). Every addition is checked for security and reviewed before it is merged.

## Licence

MIT, see [LICENSE](LICENSE). Each item may carry its own licence in its folder.

## An app's runtime

An app whose program is too large for a package (the Code editor) lists a `runtime` in its manifest instead: one `.tar.gz` per platform, published as a release asset of this repository (tag `<id>-v<version>`) or, for Code, of [nabu-code](https://github.com/9mtm/nabu-code) (tag `code-v<version>`), with its size and SHA-256.

```json
"version": "1.0.0",
"runtime": {
  "version": "1.0.0",
  "protocolVersion": 1,
  "archives": {
    "darwin-arm64": { "url": "https://github.com/9mtm/nabu-code/releases/download/code-v1.0.0/girru-code-1.0.0-darwin-arm64.tar.gz", "sha256": "<64 hex>", "size": 123456789 }
  }
}
```

Platforms: `darwin-arm64`, `darwin-x64`, `win32-x64`, `linux-x64`. `runtime.version` equals the manifest `version`. Girru downloads only the archive for the computer it runs on, checks its size and SHA-256 before unpacking, unpacks plain files and folders only (no links, every path inside the folder) into its own app folder, and offers the newer version as an update. An app has a package or a manifest-level `runtime`, never both. Agent Connect’s reserved npm descriptor is part of its package, rather than a manifest-level `runtime`; the package file limits do not count the separately bounded pinned archives. The archives are made by Girru's own packer (`packages/desktop/scripts/pack-code-runtime.cjs`); nabu-code's release also carries `girru-store-runtime.json`, the exact `runtime` entry to copy into the manifest.


## Agent Connect

Agent Connect uses the existing `agent-connect-dpro` 0.2.0 package and its 33 integrations. Its reviewed `runtime-packages.npm` descriptor pins the library and 35 dependencies to exact npm archive URLs, sizes and SHA-256 hashes. Girru extracts these archives into the app folder without invoking npm or running package scripts. The descriptor is a reserved root package file; older Girru clients list the catalogue but cannot add this app until they support that file.

Get Agent Connect from the Store, restart Girru, then open Settings → Channels to enable it and configure a connection. Getting the app does not connect an account or install Python. Telegram and Discord use the existing Node transports; the other integrations need the package's existing optional Python environment. An in-place update preserves the owner's existing enabled setting. Removing the app stops its connections and keeps channel settings, credentials, history and provider state. Re-adding it leaves it disabled until the owner enables it again and restarts Girru.

## Optional app host packages

Call Center, Trading and Browser use `app-host.npm` protocol 1 and require an updated Girru host. Older clients keep the catalogue but ignore these packages. Dependency archives are pinned by name, version, path, byte size and SHA-256 and extracted without lifecycle scripts. They do not include a browser download.

Call Center and Browser program files are maintained as JavaScript in their `package/` folders. Trading uses the existing UI source in the Girru repository; reproduce its renderer with the already installed build dependencies:

```sh
node /path/to/Girru/packages/core-ui/scripts/build-store-trading.cjs --store-dir /absolute/path/to/girru-store
node scripts/build-index.mjs
node scripts/build-index.mjs --check
```

Review the program before publishing. Backend programs have Node privileges, and the Trading renderer runs as trusted same-origin application code. Its client adapter is not a third-party sandbox. Get does not itself grant agent tools or paper execution consent. Removal keeps saved data and permission decisions; enabling, re-adding or removing an app may require restarting Girru.

Browser is the existing Puppeteer API/tool engine. It uses an existing Puppeteer cache or an operator-configured absolute `GIRRU_BROWSER_EXECUTABLE`; it never imports an existing browsing profile. Native browser workspace and Playwright MCP distribution remain separate work.

A manifest may set `"hidden": true` to omit an item temporarily from the generated catalogue and collections while retaining its package. Remove the flag to list it again.
