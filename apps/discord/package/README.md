# Discord

An app for Girru: a Discord bot connected to your agent, in the server channels you choose. Text only.

## What it does

- **Incoming**: messages from the sender IDs you allow, in the channel IDs you allow (and your server, when you set its ID), are saved and, when you turn on automatic replies, answered by your primary agent. The agent works as the owner who saved the settings, with a restricted set of tools: in that conversation it may only answer the same channel or another allowed channel.
- **Outgoing**: the `discord_send` tool sends plain text through the bot. The bot never mentions anyone. Adding the app never gives this tool to an agent by itself.
- **Settings**: in Girru's Settings, Channels: the bot token, the allowed sender and channel IDs and automatic replies (off at first).

In the Discord Developer Portal, turn on Message Content Intent and invite the bot with View Channel and Send Messages.

## Limits

- An empty list of allowed senders or channels lets no one in.
- 2000 characters per message; longer agent answers are sent in parts.
- Direct messages, attachments, embeds, reactions and slash commands are not handled.
- One Girru per bot token.

## What it reaches

- Discord's API and Gateway, with the bot token you save.

## Its data

- The bot settings are in Girru's app settings (the token is never sent back to the page).
- Messages are in Girru's channel log (`channel_events`), which Girru's channel host keeps.
- `app_discord__discord_messages` and `app_discord__discord_config`: tables older Girru versions made for Discord, kept with their rows; the app does not write them.

## API

Under `/api/ext/discord/`, for an active owner or admin: `GET /status`, `GET /config`, `PUT /config`, `POST /connect`, `POST /send` (`{ channelId, content }`), `GET /messages?limit=`. `POST /webhook` answers 410.

## Needs

A Girru with the channel host (`hostChannel` in the app API).

## Licence

MIT.
