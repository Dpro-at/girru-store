# Agent Connect

This app reuses `agent-connect-dpro` 0.2.0 and its 33 existing messaging integrations. It does not reimplement their transports. Telegram and Discord use the package's Node transports; other integrations retain their optional isolated Python setup.

`package/runtime-packages.npm` pins the existing library and its locked dependencies in 36 archives on the official npm registry by name, version, path, exact size and SHA-256. Girru verifies and unpacks them before activating the app. It runs no npm command or package install script. Each archive retains its published license and notices. No Python environment, provider dependency or new account is installed or signed in automatically. Previously enabled connections can resume on an in-place update or a first add over a legacy enabled configuration. After removal, enable channels explicitly again.

A compatible Girru host provides the existing channel integration/security boundary. An older host without that capability is asked to update; the Store plugin does not import the runtime or register routes there. New installations start off; saved enable/disable choices are preserved. Use Settings › Channels to review sender/conversation allowlists and explicitly enable a channel, then restart when asked. Send tools retain their per-agent grants and restricted channel-turn policy.

Removal stops channels and removes program files. Existing channel settings, credentials, delivery history and separate provider state remain. Re-adding preserves them and keeps previously disabled channels off. No live provider/account verification is implied by installing the app.

The reserved `runtime-packages.npm` filename is a host capability gate: older clients list the card but reject its package as unsupported, so they cannot install or remove it through the Store. New hosts understand the bounded descriptor. This protects the existing built-in channel configuration on older clients.
