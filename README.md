# MineBeacon

A responsive Minecraft server status scout featuring a ten-server rotating list, expandable status bars, a Java/Bedrock address search, and a dark-first theme that follows the visitor's system color preference.

Each expanded server row displays online/max players, a capacity meter, version, detected software, response time, resolved host/port, MOTD, any public player samples, and server/API diagnostics when available. The player graph and uptime strip use only status checks observed in the visitor's browser, stored locally for up to 24 hours and capped at 60 checks per server. New visitors start with an empty graph. A single API request is made per second and rotates through the list, so each of the ten listed realms is checked approximately every ten seconds. The provider may cache status results, and public server data may be unavailable or incomplete. Server favicons are shown when supplied by the status API; the site also uses Minecraft.net artwork with a CSS fallback.

## Free status API

The browser calls `https://api.mcsrvstat.us/3/{address}` directly. No API key or backend is required. The service documents support for status, player counts, version, software, MOTD and other optional fields. API availability, caching, and rate policies are outside this site's control. Review the provider's usage terms before operating at scale.

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
