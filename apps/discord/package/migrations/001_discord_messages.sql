-- Tables an older Girru made for Discord, kept with their rows when the app moved to the
-- Girru Store. The app does not write them any more: its messages are in Girru's channel log.

CREATE TABLE IF NOT EXISTS app_discord__discord_messages (
  id           TEXT PRIMARY KEY,
  channel_id   TEXT NOT NULL,
  guild_id     TEXT,
  content      TEXT NOT NULL,
  author       TEXT NOT NULL,
  author_id    TEXT NOT NULL,
  timestamp    TEXT NOT NULL,
  direction    TEXT NOT NULL DEFAULT 'incoming',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS app_discord__idx_discord_messages_channel
  ON app_discord__discord_messages(channel_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS app_discord__discord_config (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  bot_token        TEXT,
  client_id        TEXT,
  guild_id         TEXT,
  allowed_channels TEXT,
  webhook_url      TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
