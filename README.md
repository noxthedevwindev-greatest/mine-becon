# MineBeacon

A Minecraft server discovery site with live player counts, server status details, 24-hour player history, favorites, and a real-time leaderboard. The home page is an introduction, with dedicated Servers, Player Stats, About, and individual server profile pages. The site is dark by default and follows the visitor's system color preference.

## Pages

- `index.html` introduces MineBeacon and shows a small live network summary.
- `servers.html` contains the searchable directory, favorites, address checker, live counts, expandable details, and 24-hour graph cards.
- `leaderboard.html` is the Player Stats browser. It combines Minetrack's fast live feed with the broader MinecraftServer.ID community directory, showing searchable, filterable multiplayer-style rows with player counts, edition, version, mode tags, uptime, and community vote metrics.
- `server.html?address=mc.example.net` shows an individual server profile, diagnostics, MOTD, metadata, live status, and hoverable daily history. Profiles work for any address checked by MCSRVStat, while Minetrack live counts and history are available for servers in its feed.
- `about.html` documents data sources, limitations, and privacy.
- `404.html` provides a themed not-found page. `sitemap.xml` and `robots.txt` describe the public pages to crawlers.

## Data sources

Minetrack's public WebSocket at `wss://minetrack.me` provides tracked server discovery, live player counts, probe errors, and the 24-hour graph. MinecraftServer.ID's public API expands the directory with its community listings, current/max player snapshots, edition, version, tags, uptime and vote metrics. Its directory focuses on Indonesian servers, allows unauthenticated public requests, and applies rate limits. Directory counts are provider snapshots that may refresh around every five minutes, not second-by-second pings. The browser refreshes its catalog every minute and caches it locally. MCSRVStat at `https://api.mcsrvstat.us/3/` supplies extra on-demand server details. Sources are independent and can disagree. No API credentials or backend are required.

The directory seeds ten featured communities and merges Minetrack's configured servers with MinecraftServer.ID's public directory; duplicate hostnames are collapsed. Minetrack counts refresh as the WebSocket publishes updates. Favorites and a small fallback history are kept in browser local storage.

A backend is optional for browsing. With it configured, visitors can save custom servers locally and send them for moderated shared listing. The API and daily snapshot collector run on Vercel with MongoDB Atlas; no database credential is placed in browser code. Server icons use a browser Cache Storage service worker and are retained until the browser clears or evicts site data. Yearly snapshots begin only after the daily collector is deployed, so pre-deployment history cannot be recovered.

## Configure shared submissions and yearly history

1. Create a Vercel project linked to this repository and a MongoDB Atlas database. Give the Atlas database user access only to the MineBeacon database and configure Atlas network access for the Vercel deployment.
2. The database credential previously pasted into chat must be rotated in Atlas. Do not reuse it. Never put a MongoDB URI in a commit, browser JavaScript, or a public GitHub Pages setting.
3. Add these GitHub repository Actions secrets: `MONGODB_URI` (the newly rotated URI), `CRON_SECRET` (a long random value), `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. Manually run the `Deploy MineBeacon API` workflow. It transfers only runtime secrets to Vercel and deploys the API. GitHub Pages stays static and receives no database credentials.
4. After the first deploy, set `MINEBEACON_API_BASE` in `api-config.js` to the public Vercel project origin, then push to `master` to publish the connected frontend. The API accepts browser requests only from this GitHub Pages origin.
5. Community submissions are saved locally immediately and queued as `pending` in MongoDB. Review records in the `communityServers` collection and change `status` to `approved` to publish them. Daily catalog snapshots and up to 12 approved custom server probes are stored in `playerSnapshots`; history starts at deployment and is not backfilled.

Browser image caching uses Cache Storage and requests persistent storage where supported, but browsers can still clear or evict site data. It is best-effort, not guaranteed forever.

## Run locally

Open `index.html` directly, or use any static server, for example:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Publish with GitHub Pages

The included GitHub Actions workflow deploys the static site from `master`. Push changes to trigger a deployment. The API workflow is separate and requires the secrets above.

## Name ideas

- MineBeacon (current name)
- CraftPulse
- ChunkSignal
- ServerSprout
- Redstone Radar
