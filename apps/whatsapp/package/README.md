# WhatsApp

An app for Girru, as a preview: it receives the WhatsApp messages Twilio sends to Girru and keeps a log. Sending through Twilio is not built yet; nothing leaves Girru.

## What it does

- **Incoming**: set your Twilio WhatsApp number's incoming message webhook to `https://<your Girru>/api/ext/whatsapp/webhook`. Only requests with a valid `X-Twilio-Signature` for your auth token and that exact address (the saved webhook URL, or `PUBLIC_URL` plus the path) are accepted. When you list allowed numbers, messages from other numbers are not kept. Each message is kept once; media is kept as its address only, never fetched.
- **Outgoing**: `POST /send` and the `whatsapp_send` tool log the message in Girru and say that it was not sent. Adding the app never gives this tool to an agent by itself.
- **Settings**: in Girru's Extensions page (the form) or `PUT /config`: Account SID, auth token, WhatsApp number, webhook URL, allowed numbers. A field left empty keeps the saved value.

## Limits

- No auth token saved, or no webhook URL and no `PUBLIC_URL`: every webhook request is refused.
- Messages are not answered and not passed to an agent.
- `whatsapp_send` works only for an active owner or admin; numbers in E.164 form, media addresses https only.

## What it reaches

- Nothing outside Girru: it only receives what Twilio sends.

## Its data

- The settings are in Girru's app settings; a settings row an older Girru kept in `app_whatsapp__whatsapp_config` is still read under them.
- `app_whatsapp__whatsapp_messages`: the messages it received and logged, with phone numbers.

## API

Under `/api/ext/whatsapp/`, for an active owner or admin: `POST /send`, `GET /messages?number=&limit=` (at most 200), `GET /status`, `PUT /config`. Public, signed by Twilio: `POST /webhook`.

## Checks

`node apps/whatsapp/checks/webhook.check.mjs` (in the Girru Store repository, Node 22.5 or later, no packages) checks the signature rules and the routes with a stand-in for Girru.

## Licence

MIT.
