# GenVR runtime

Girru adds the reviewed GenVR SDK archive through the Store. The JavaScript and browser assets use the same archive on the supported platforms; Girru checks its size and SHA-256 before unpacking it. No account keys or project data are included in the archive.

Removing GenVR removes its program files. Existing worlds, account connection, voice data and project records stay in their existing locations. Adding it again makes those projects available again.

The SDK is licensed under AGPL-3.0-only; its archive includes LICENSE. Corresponding source for this version is available as the [preview.20 source archive](https://github.com/Dpro-at/genvr-world-sdk/releases/download/v0.3.0-preview.20/3d-world-sdk-0.3.0-preview.20-source.tgz), SHA-256 `c846292c79d66473e65bb24439c0f3b7f40bd35544dd5332092c80f9e37ac868`.

This runtime needs a compatible Girru version with GenVR Store support. Earlier Girru versions that include GenVR continue to use their included copy.

Removing GenVR keeps account settings and worlds. Re-adding it changes the managed program launch, so agent tool permissions must be reviewed again. Installation verifies the published archive SHA-256; local runtime protection and per-asset checks guard its program files afterward.
