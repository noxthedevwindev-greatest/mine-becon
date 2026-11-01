# MineBeacon

A Minecraft server discovery site with live player counts, server status details, 24-hour player history, favorites, and a real-time leaderboard. The home page is an introduction, with dedicated Servers, Leaderboard, About, and individual server profile pages. The site is dark by default and follows the visitor's system color preference.

## Pages

- `index.html` introduces MineBeacon and shows a small live network summary.
- `servers.html` contains the searchable directory, favorites, address checker, live counts, expandable details, and 24-hour graph cards.
- `leaderboard.html` ranks Minetrack-tracked servers by current players and reports their 24-hour peak.
- `server.html?address=mc.example.net` shows an individual server profile, diagnostics, MOTD, metadata, live status, and hoverable daily history. Profiles work for any address checked by MCSRVStat, while Minetrack live counts and history are available for servers in its feed.
- `about.html` documents data sources, limitations, and privacy.
- `404.html` provides a themed not-found page. `sitemap.xml` and `robots.txt` describe the public pages to crawlers.

## Data sources

Minetrack's public WebSocket at `wss://minetrack.me` provides tracked server discovery, live player counts, probe errors, and the 24-hour graph. The graph request returns a sample series for the past day, and the client adds new live points when Minetrack publishes them. The interactive graph tooltip shows the exact timestamp and player count at the selected point. MCSRVStat at `https://api.mcsrvstat.us/3/` supplies extra server details, including version, software, latency, MOTD, capacity, icons, and diagnostics where available. Both sources are independent and can disagree. The interface surfaces those differences instead of claiming certainty. No API credentials or backend are required.

The directory seeds ten featured communities and adds Minetrack's configured servers dynamically. Duplicates are collapsed by address. Favorites and a small fallback history are kept in browser local storage. Server detail checks rotate in the background to avoid firing every request simultaneously.

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
