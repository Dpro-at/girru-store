# Telegram

An app for Girru: a Telegram bot you made with @BotFather, connected to your agent. Text only.

## What it does

- **Incoming**: messages from the sender IDs you allow are saved and, when you turn on automatic replies, answered by your primary agent. The agent works as the owner who saved the settings, with a restricted set of tools: in that conversation it may only answer the same chat.
- **Outgoing**: the `telegram_send` tool sends plain text through the bot. Adding the app never gives this tool to an agent by itself.
- **Settings**: in Girru's Settings, Channels: the bot token, the allowed sender IDs and automatic replies (off at first).

The connection uses long polling, so Girru needs no public address. If the bot already has a webhook, the app refuses to start rather than remove it: remove it first.

## Limits

- An empty list of allowed senders lets no one in.
- 4096 characters per message; longer agent answers are sent in parts.
- Attachments, keyboards and custom commands are not handled.
- One Girru per bot token.

## What it reaches

- Telegram's Bot API, with the bot token you save.

## Its data

- The bot settings are in Girru's app settings (the token is never sent back to the page).
- Messages are in Girru's channel log (`channel_events`), which Girru's channel host keeps.
- `app_telegram__telegram_messages` and `app_telegram__telegram_config`: tables older Girru versions made for Telegram, kept with their rows; the app does not write them.

## API

Under `/api/ext/telegram/`, for an active owner or admin: `GET /status`, `GET /config`, `PUT /config`, `POST /connect`, `POST /send` (`{ chatId, text }`), `GET /messages?limit=`. `POST /webhook` answers 410.

## Needs

A Girru with the channel host (`hostChannel` in the app API).

## Licence

MIT.
