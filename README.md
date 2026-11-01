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

## Run locally

Open `index.html` directly, or use any static server, for example:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Publish with GitHub Pages

The included GitHub Actions workflow deploys the static site from `master`. Push changes to trigger a deployment.

## Name ideas

- MineBeacon (current name)
- CraftPulse
- ChunkSignal
- ServerSprout
- Redstone Radar
