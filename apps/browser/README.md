# Browser

Browser is developed in the Girru applications repository. The local macOS arm64 trial uses the full CEF Chrome runtime, official Playwright MCP and a Girru workspace inside the main desktop window. It is not a published, independently downloadable native runtime yet. The local integration folder is intentionally not named `package/` until Store distribution is ready. The Store metadata intentionally has no installable version.

## Current layout

Girru owns the tabs, address field, navigation buttons and device-size controls. Chromium runs in a separate local process; its original windows are transparent, offscreen and ignore mouse input in embedded mode. The active page is rendered into the Girru workspace through a loopback-only frame bridge, and authenticated owner input is forwarded to that page. This is a live local browser surface, not an iframe of the remote site. The native process boundary keeps Chromium and its extensions separate from Girru's Electron process.

The current frame-based surface is a local trial, not a claim of complete native-view integration. On macOS, an owner-only sheet now presents native Chrome dialog text and actions through the runtime’s own Cocoa accessibility objects, excluding web content. Actions are bound to the live native dialog and button, preserve native enabled state, and reject stale requests. The original install delay remains in Chrome; there is no automatic acceptance or CRX sideload path. The owner verified installation from this embedded sheet. Optional extension permissions and other dialog types still require separate acceptance. Website permission requests use CEF callbacks with the requesting origin and requested capabilities; agent contexts are denied and unknown permission bits fail closed. Downloads, file pickers, clipboard edge cases, accessibility of the rendered web page, audio/video and high-frame-rate content also need separate embedded acceptance. Chrome Web Store installation was verified in both the earlier native proof and the embedded owner-reviewed flow. This verifies the tested extension, not universal compatibility with every Store item. Keep Store distribution unavailable until the remaining acceptance and platform-packaging gaps are resolved.

## Source layout

- `native/`: macOS CEF bootstrap, sandboxed helpers, Chrome request contexts, native prompt presentation and bounded local control commands.
- `extension/`: original Girru start/import pages and device popup, with the Girru mark.
- `runtime/`: native process lifecycle, authenticated owner/agent broker, per-agent official MCP connections and CEF CDP attachment adapter.
- `integration/`: local-only Girru extension registering `browser_workspace`; the native Chromium binary and user profiles are never included in this package.

The older Electron-only experiment remains under `runtime/src/main.cjs` and the `start:electron-preview` script for comparison. It is not the accepted Chrome Web Store foundation.

## Local development

Use Node.js 24 and `npm ci --prefix runtime`. Playwright browser downloads are unnecessary. The verified CEF SDK and build tools live in ignored `.local-runtime/`. The verified local SDK is CEF 156.0.15+gcf671c0 with Chromium 156.0.8078.80. The current native CMake project targets macOS arm64; Windows, Linux and Intel Mac native packaging are not verified.

Build `native/` with CMake, specifying `CEF_ROOT`, then run `npm run stage:native --prefix runtime`. Start with `npm start --prefix runtime`. `GIRRU_BROWSER_PROFILE` chooses a dedicated browser data directory. Never point it at a running Chrome or Girru profile. `GIRRU_BROWSER_EMBEDDED=1` hides native Chromium windows for the Girru workspace. `GIRRU_CHROMIUM_EXECUTABLE` is a trusted host override, never a page/model parameter.

The Girru desktop integration uses trusted `DPRO_BROWSER_ROOT` and optional `DPRO_BROWSER_PROFILE` settings. Opening Browser starts the sidecar; `/api/browser/app` is answered by the local UI bridge only after the backend verifies the caller is the owner. Connection tokens and native paths are never returned to the page. The agent extension uses the host-selected `DPRO_BROWSER_CONNECTION_FILE`.

## Chrome data

The first-run import page discovers actual Chrome profile names from the operating system's standard Chrome data root. Imports happen only after selecting a profile and fields. Bookmarks, bounded history and whitelisted homepage/bookmark-bar settings are supported by the importer. An extension list opens the original store entries for individual installation.

Password and cookie databases are never read or decrypted by the importer. Password import is delegated to the native browser's secure importer; optional cookie JSON requires a user-selected export. Protected sessions may need fresh sign-in. These native import dialogs still need embedded acceptance. Imported owner sessions are not automatically delegated to agent contexts.

## Agent tabs

The backend pairs each call with its trusted agent and chat identity. A model cannot supply another agent identity. Each agent receives a private ephemeral credential and sees only its own pages through the official MCP scope. Agents in the same authorized chat share a workspace browsing context while retaining separate tabs; separate chats use separate native Chrome profiles. Opening a tab never creates thousands of unused pages. Limits are 48 live tabs overall and eight per participant.

`browser_workspace` follows Girru's existing tool grants and approvals. Installing Browser does not enable it for every agent. It offers navigation, snapshots with element references, clicking, typing, forms, selection, waiting, screenshots and owned-tab management. It does not expose arbitrary JavaScript, uploads, installation, cookies, unrestricted output paths or owner controls. Treat website content as untrusted input.

The standard MCP stdio adapter is `node runtime/scripts/mcp.mjs` with `GIRRU_BROWSER_CONNECTION` pointing to that participant's private connection file. Tokens never appear on stdout or in URLs.

## Checks

- `npm test --prefix runtime`: tab ownership, 5000 idle agents, serialization, unsafe command rejection, authenticated pairing, Chrome importer boundaries and CEF target attachment.
- With the native runtime open, set `GIRRU_BROWSER_OWNER_CONNECTION` and run `node runtime/scripts/smoke.cjs`: actual concurrent navigation and snapshots, separate context cookies and standard stdio MCP. The script serves only local disposable pages.
- The Browser security workflow runs extended JavaScript/TypeScript CodeQL queries. Native Cocoa/CEF code is built and reviewed separately; the JavaScript scan does not cover Objective-C++.
- Girru host tests cover the owner-only launcher, closed command schema, safe projections and existing footer integration. Actual chat and embedded pointer/keyboard/device behavior are separate acceptance checks.

CEF retains its BSD notices in `native/CEF-LICENSE.txt`; Chromium binaries retain their bundled third-party notices. Playwright MCP is Apache-2.0, the MCP SDK and Girru source are MIT. Original upstream copyright/license notices must remain. Runtime binaries, credentials, browser data and local build caches are not committed.
