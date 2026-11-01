# MineBeacon

A responsive, Minecraft-inspired server status dashboard. It checks a starter watchlist and lets visitors look up any Java/Bedrock server hostname or IP.

The watchlist makes one status API request per second, rotating between servers. With three servers, each individual server is checked about every three seconds. Polling pauses while the tab is hidden. Status APIs may cache results, so this cadence does not guarantee the Minecraft server itself was freshly pinged every second.

## Free status API

The browser calls `https://api.mcsrvstat.us/3/{address}` directly. No API key or backend is required. The API is community-provided, so requests can be rate-limited or temporarily unavailable. The UI reports that without breaking the page. Please review the provider's usage policy before operating at scale.

## Run locally

Open `index.html` in a browser, or serve this directory with any static file server, for example `python3 -m http.server 8000`.

## Publish with GitHub Pages

1. Create a GitHub repository and push these files to its default branch.
2. In repository **Settings → Pages**, choose **Deploy from a branch**, select the default branch and `/ (root)`, then save.
3. GitHub Pages will publish the static site. No build step is required.

## Name ideas

- Blockwatch (current working name)
- CraftPulse
- ServerSprout
- ChunkSignal
- MineBeacon
- Redstone Radar

Check availability of your chosen repository name and domain before settling on branding.
