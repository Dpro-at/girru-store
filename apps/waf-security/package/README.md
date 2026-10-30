# WAF Security Scanner

An app for Girru: test how a website's firewall (WAF) handles common attack requests, repeat the test on a schedule, and check this Girru's own security settings.

Only test sites you own or have permission to test.

## What it does

- **Scan**: first looks for signs of a known firewall in the site's answers (Cloudflare, AWS WAF, Imperva, Akamai, F5, ModSecurity, Sucuri, Wordfence). Then sends test requests from its library, each as a `test=` query parameter, and counts which were blocked (403, 406, 429 or 503, a redirect to a block page, or no answer) and which got through. Quick mode sends 3 requests from each of 2 groups; full mode sends all of them.
- **Test library**: 100 request patterns in 11 groups (SQL injection, XSS, XXE, path traversal, command injection, SSRF, LFI, prototype pollution, template injection, insecure deserialization, request smuggling). The app adds them itself the first time it starts.
- **Campaigns**: the same site tested in four stages (detection, baseline, evasion, verification), now or daily, weekly or monthly. Each run gets a score and is compared with the run before; a drop of more than 5 points is marked as a regression.
- **Self-audit**: checks this Girru's own answers for 14 security headers, open CORS, SQL error messages, a protected address answering without sign-in, missing rate limits and stack traces in errors.
- **Agent tool**: `waf_scan` (a site address, or `self` for the self-audit). Adding the app never gives this tool to an agent by itself.

## Limits

- Local and private network addresses (localhost, 10.x, 192.168.x, 169.254.x and the like) are refused, for every request and every redirect, unless the owner turns on `allowPrivateTargets` in its settings. Only Girru's owner can change that setting; each change is logged with who made it.
- 10 scans running at once and 100 scans a day per user; each campaign stage counts as a scan. At most 50 campaigns per user, and a campaign runs once at a time.
- The `waf_scan` tool works only for an active owner or admin, like the page.
- A scheduled campaign runs only while the person who made it is still an active owner or admin of this Girru.

## What it reaches

- The websites you enter, with the test requests above.
- This Girru's own address (`BACKEND_URL`, or its local port), for the self-audit only.

## Its data

Its own tables only, all named `app_waf_security__...`:

- `app_waf_security__waf_scans`: scans and their results
- `app_waf_security__waf_rate_limits`: scans per user per day
- `app_waf_security__waf_payload_library`: the test library
- `app_waf_security__waf_campaigns`, `..._waf_campaign_stages`, `..._waf_campaign_scans`, `..._waf_campaign_comparisons`, `..._waf_campaign_notifications`: campaigns, their stages, runs, comparisons and notes

## API

Under `/api/ext/waf-security/`, for an active owner or admin; each user sees only their own scans and campaigns:
`GET /payloads`, `GET /settings`, `PUT /settings` (owner only), `POST /detect`, `POST /scan`, `GET /scan/:id`, `GET /scans`, `DELETE /scans/:id`, `POST /self`, `GET/POST /campaigns`, `GET/DELETE /campaigns/:id`, `POST /campaigns/:id/run`, `GET /campaigns/:id/score`.

## Licence

MIT.
