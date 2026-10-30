# Server Monitor

An app for Girru: a preview of a monitoring dashboard for WHM/cPanel, Linux, AWS S3 and SSH servers.

**Today every figure it returns is sample data.** It makes no connection to any server, runs no commands and has no background checks.

## What it does

- **Dashboard data**: load, disk, accounts, services, SSL, email queue and backups for each server, plus uptime (90 days), load history, pulse, bandwidth, S3 buckets, hosted sites and hosting news. All sample data.
- **Per-server details**: accounts, services, logs, backups, SSL, email, PHP, MySQL, DNS, bandwidth, cron, ports, blacklists, security, email authentication and packages. All sample data.
- **Server entries**: add, change and remove servers (name, cPanel or SSH, host, port, user name, password or API token). Only these fields are kept; host and port are checked. They are kept in memory until Girru restarts. A saved password or token is never sent back, not even in part: answers carry a placeholder and `has_<field>: true`, and sending the placeholder back keeps the saved value. "Test connection" tests nothing and says so.

## What it reaches

Nothing outside Girru.

## Its data

No tables. Server entries live in memory only.

## API

Under `/api/ext/server-monitor/`, for an active owner or admin:
`GET /dashboard`, `/sites`, `/s3/summary`, `/updates/releases`, `/bandwidth`, `/uptime`, `/load-history`, `/pulse`, `/whm/servers`, `/whm/server/:serverId/<accounts|services|logs|backups|ssl|email|php|mysql|dns|bandwidth|cron|ports|blacklist|security|email-auth|packages>`, `GET/POST /settings/servers`, `PUT/DELETE /settings/servers/:id`, `POST /settings/servers/:id/test`.

## Licence

MIT.
