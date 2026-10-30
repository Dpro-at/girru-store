# SEO Keyword Tracker & Analytics

An app for Girru: track where your sites rank for the keywords you choose, check search results through the search APIs you add, and follow your competitors' positions.

## What it does

- **Keyword tracking**: positions over time, per device and country.
- **Search result checks**: through one of nine search APIs (Serper, SerpApi, ValueSERP, SearchApi, Serply, ScrapingAnt, ScrapingRobot, SpaceSerp, HasData). When one fails, the next one with a key is tried.
- **Competitors**: their positions for your tracked keywords.
- **Google Search Console**: connect a site with Google sign-in (read-only access). Syncing its reports is not ready yet.
- **Agent tools**: `seo_track_keyword`, `seo_analyze_serp`, `seo_research_keywords`, `seo_competitor_analysis`, `seo_get_stats`, `seo_show_rankings`. Adding the app never gives these tools to an agent by itself.

## Setup

1. Add the app from the Girru Store and start Girru again.
2. Save at least one search API key in Girru's credentials, named `<api>-api-key`, for example `serper-api-key` (https://serper.dev) or `serpapi-api-key` (https://serpapi.com).
3. Optional, for Google Search Console: create OAuth credentials (Web application) in the Google Cloud console with the Search Console API turned on, add the redirect address `<your Girru address>/api/ext/seo/oauth/google/callback`, and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `BACKEND_URL` for the backend.

## What it reaches

- The search APIs you saved a key for, with the keyword, device and country you track.
- Google sign-in and token addresses (accounts.google.com, oauth2.googleapis.com) only when you connect Search Console.
- Your search API keys in Girru's credentials, read when it calls the API.

## Its data

Its own tables only, all named `app_seo__...`:

- `app_seo__seo_domains`: your sites
- `app_seo__seo_keywords`: tracked keywords and their history
- `app_seo__seo_scraper_jobs`: search checks
- `app_seo__seo_search_analytics`: Search Console data
- `app_seo__seo_gsc_sync_log`: Search Console syncs
- `app_seo__seo_settings`: your settings

## API

Under `/api/ext/seo/`, for signed-in users; each user sees only their own sites:
`GET/POST /domains`, `PUT/DELETE /domains/:id`, `GET/POST /keywords`, `PUT/DELETE /keywords/:id`, `POST /scrape/:id`, `POST /scrape-all`, `GET /jobs`, `GET/PUT /settings`, `GET /oauth/google/authorize`, `GET /oauth/google/callback`, `POST /oauth/google/revoke/:domain_id`.

## Licence

MIT.
