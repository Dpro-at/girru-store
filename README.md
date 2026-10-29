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

## Build the index

```bash
node scripts/build-index.mjs
```

`node scripts/build-index.mjs --check` fails when `index.json` is out of date; it runs on every pull request.

## Adding an item

See [CONTRIBUTING.md](CONTRIBUTING.md). Every addition is checked for security and reviewed before it is merged.

## Licence

MIT, see [LICENSE](LICENSE). Each item may carry its own licence in its folder.
