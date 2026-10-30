-- Slack messages and settings (also the tables an older Girru made for Slack, kept with their rows).

CREATE TABLE IF NOT EXISTS app_slack__slack_messages (
  id           TEXT PRIMARY KEY,
  channel_id   TEXT NOT NULL,
  channel_name TEXT,
  workspace_id TEXT,
  content      TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  username     TEXT,
  timestamp    TEXT NOT NULL,
  thread_ts    TEXT,
  direction    TEXT NOT NULL DEFAULT 'incoming',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS app_slack__idx_slack_messages_channel
  ON app_slack__slack_messages(channel_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS app_slack__idx_slack_messages_thread
  ON app_slack__slack_messages(thread_ts);

CREATE TABLE IF NOT EXISTS app_slack__slack_config (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  bot_token         TEXT,
  signing_secret    TEXT,
  app_token         TEXT,
  allowed_channels  TEXT,
  webhook_url       TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
