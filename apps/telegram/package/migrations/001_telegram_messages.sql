-- Tables an older Girru made for Telegram, kept with their rows when the app moved to the
-- Girru Store. The app does not write them any more: its messages are in Girru's channel log.

CREATE TABLE IF NOT EXISTS app_telegram__telegram_messages (
  id           TEXT PRIMARY KEY,
  chat_id      TEXT NOT NULL,
  chat_type    TEXT,
  content      TEXT NOT NULL,
  user_id      TEXT,
  username     TEXT,
  first_name   TEXT,
  last_name    TEXT,
  timestamp    TEXT NOT NULL,
  direction    TEXT NOT NULL DEFAULT 'incoming',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS app_telegram__idx_telegram_messages_chat
  ON app_telegram__telegram_messages(chat_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS app_telegram__telegram_config (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  bot_token      TEXT,
  webhook_url    TEXT,
  allowed_users  TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
