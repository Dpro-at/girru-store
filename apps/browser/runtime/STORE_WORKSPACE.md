# Full Browser Store runtime

The small `package/` is the separately enabled agent automation host. It does not contain the native owner workspace. Desktop clients that support full Browser installation require both the reviewed package and a platform archive in the app manifest's existing `runtime` field.

Stage an already compiled native application with `scripts/stage-store-runtime.cjs`, providing explicit source, native input, fresh output, current manifest version and target platform. The script never builds, downloads, changes versions or publishes. It copies only runtime source/dependencies, the extension and the native application; contained links are flattened into regular files and external links/cycles are refused. This is necessary because the installer rejects archive links and special files. Test the staged native application and its signature before distribution; staging is not signing or notarization acceptance.

Archive the staging folder contents at the archive root, without a containing directory. The root includes `browser-runtime.json` (protocolVersion 1, version and platform), `runtime/`, `extension/` and `native/`. Native paths are `GirruBrowser.app/Contents/MacOS/GirruBrowser` on macOS, `girru-browser` on Linux and `GirruBrowser.exe` on Windows. No browsing profile, cookies, credentials or user data may be present.

Only after testing and separately approving publication, attach the actual release archive URL, exact SHA-256 and compressed size under `runtime.archives[platform]` in the Browser manifest. The runtime version must equal the existing manifest version. Do not invent an archive URL/checksum or advertise unsupported platforms. Rebuild the catalogue with the existing index builder only after those real assets exist. No native release assets are created or uploaded by this change.

The desktop installer verifies the archive before unpacking and switches a private current pointer only after completeness/platform/version checks. Installing the owner workspace does not grant agents Browser tools or import an existing Chrome profile. Old agent-only installations remain distinguishable and can acquire the workspace when a reviewed platform archive becomes available.


## macOS acceptance isolation

Chromium initializes Seatbelt policies in its helper processes. A process already
inside a `sandbox-exec` profile cannot initialize those policies again. Native
startup now distinguishes this failure from a denied ProcessSingleton socket.
Normal workspace startup never adds `--no-sandbox` or silently retries without it.
For local acceptance only, an external test driver may inject `--no-sandbox`
while an OS-enforced outer policy denies original home/keychain reads and
non-loopback network. That test establishes embedded navigation/frame wiring,
not acceptance of normal helper sandboxing, signing or distribution.
The outer policy must allow only the trial's Unix socket path, including macOS's
canonical `/private/var/folders/.../T/app.girru.browser.*/SingletonSocket` form.
Normal helper sandbox acceptance can run without an outer Seatbelt wrapper in an
explicitly authorized disposable profile. Never import an existing browser profile.
An unsigned local native application can stall cookie initialization while waiting
for macOS Safe Storage access. For synthetic test data only, the test driver may
inject Chromium's `--use-mock-keychain` switch into a freshly created, explicitly
bounded test profile. This does not disable the renderer/GPU sandbox. Never add
this switch to normal owner startup or reuse that profile for real credentials.
Real Keychain and signing acceptance remain distribution prerequisites.

Owner tabs are created through the native host so they retain the native request
context and lifecycle. Owner navigation acknowledges a committed document rather
than waiting indefinitely for the complete `load` lifecycle event; the embedded
frame and tab state continue updating as the page loads. Agent tool navigation
keeps its existing behavior. Closing waits for the managed launcher and bounds
graceful shutdown so reopening cannot attach to a dying broker.
