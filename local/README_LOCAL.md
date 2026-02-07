# Local Website Integration

This folder contains a local version of the Render site pointing to your
local streaming stack (`ronaut-radio-app`).

## Files
- `index.local.html` — same UI as production, but API/stream URLs point to localhost.
- `assets/` — copied from `website/assets` for local serving.
- `css/` — placeholder CSS file to avoid 404s (replace with real CSS when available).

## Prerequisites
1) Run the local stack in `ronaut-radio-app`:
   - HLS: `http://localhost:8080/live/hls/stream.m3u8`
   - API: `http://localhost:8080/api/now-playing`
   - WS: `ws://localhost:8080/ws/`

2) Serve this repo locally (recommended):
   ```bash
   cd /Users/andreabenedetti/GitRepos/ronaut-radio-website
   python3 -m http.server 8081
   ```

3) Open the local site:
   ```
   http://localhost:8081/local/index.local.html
   ```

## Notes
- This does not change the production Render site.
- The local page uses the same assets and layout as `website/index.html`.
- Missing images/CSS in this repo are stubbed with placeholders for local testing.
- The waveform visualizer needs a user interaction (click play) to unlock audio.
