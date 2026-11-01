# MineBeacon

A responsive Minecraft server status scout featuring the Minetrack live WebSocket feed for tracked server discovery and player counts, expandable status bars, additional server detail checks, client-side server filtering and sorting, per-device favorites, and a dark-first theme that follows the visitor's system color preference.

Expanded rows show live player counts, capacity when reported by the detail API, version, software, latency, host/port, MOTD, public player samples, and source-specific diagnostics. Live-feed servers are discovered and added automatically; direct detail checks continue in the background at one request per second, so each server is checked roughly once per list size in seconds. The graph stores up to 60 locally observed live-feed and direct-check samples per server for 24 hours; tooltips identify each sample's source. New visitors start with an empty local history.

Minetrack's public WebSocket at `wss://minetrack.me` supplies live tracked-server configuration, player counts, and probe errors. MineBeacon reconnects automatically and keeps its direct mcsrvstat checks for MOTD, version, software, and richer status details. The two sources can disagree, and the expanded row calls that out. Live feed servers are added to the directory automatically. The graph combines live-feed observations with this browser's direct detail checks, and tooltips identify the source.

## Run locally

Open `index.html` in a browser, or serve this directory with any static file server, for example `python3 -m http.server 8000`.

## Publish with GitHub Pages

The included GitHub Actions workflow deploys the static site from the `master` branch. Push changes to trigger a deployment.

## Name ideas

- MineBeacon
- CraftPulse
- ChunkSignal
- ServerSprout
- Redstone Radar
