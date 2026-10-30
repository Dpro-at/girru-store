# Slack

An app for Girru, as a preview: it receives the messages your Slack app sends to Girru and keeps a log. Sending to Slack is not built yet; nothing leaves Girru.

## What it does

- **Incoming**: Slack's Events API posts to `https://<your Girru>/api/ext/slack/webhook`. Only requests signed with your signing secret, at most five minutes old, are accepted; the URL check (`url_verification`) is answered after the same check. Messages from people (not bots) are kept once each.
- **Outgoing**: `POST /send` and the `slack_send` tool log the message in Girru and say that it was not sent. Adding the app never gives this tool to an agent by itself.
- **Settings**: in Girru's Extensions page (the form) or `PUT /config`: bot token, signing secret, app-level token, workspace URL. A field left empty keeps the saved value.

## Limits

- No signing secret saved: every webhook request is refused.
- Messages are not answered and not passed to an agent.
- `slack_send` works only for an active owner or admin.

## What it reaches

- Nothing outside Girru: it only receives what Slack sends.

## Its data

- The settings are in Girru's app settings; a settings row an older Girru kept in `app_slack__slack_config` is still read under them.
- `app_slack__slack_messages`: the messages it received and logged.

## API

Under `/api/ext/slack/`, for an active owner or admin: `POST /send`, `GET /messages?channel=&limit=` (at most 200), `GET /status`, `PUT /config`. Public, signed by Slack: `POST /webhook`.

## Checks

`node apps/slack/checks/webhook.check.mjs` (in the Girru Store repository, Node 22.5 or later, no packages) checks the signature rules and the routes with a stand-in for Girru.

## Licence

MIT.
