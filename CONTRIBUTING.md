# Adding to the Girru Store

1. Fork this repository and add one folder for your item under `apps/`, `mcp/`, `skills/` or `specialties/`, with a `manifest.json` (see the README).
2. Run `node scripts/build-index.mjs` and commit the updated `index.json`.
3. Open a pull request that says what the item does and why it asks for each permission.

## Review

- Every pull request is first checked by an automated security review: what the item can reach, what it sends, and whether it asks for more than it needs.
- Then a maintainer reviews it by hand. Nothing is merged before both.
- Items that hide what they do, collect data they do not need, or name other products to imitate them are refused.

## Rules

- English only, in the manifest and in the item's files.
- One item per pull request.
- No secrets, keys or personal data in any file.
- `pricing` stays `{ "model": "free" }`; paid items are not open yet.
