# The Antidote Project

Good games. No strings. An MIT-licensed, PWA arcade with locally bundled multiplayer libraries built with vanilla HTML, CSS, and JavaScript.

## Run locally

Requires Python 3 for the development server and Node.js 18+ for tests and release packaging. No npm install or build step is needed for local development.

```sh
npm run dev
# Open http://localhost:4173
npm test
```

You can also serve this directory with any static HTTP server. Service workers need HTTPS or localhost; opening index.html as a file is not supported.

## Included

- Responsive arcade shell with game filters, philosophy page, install guidance, and offline status.
- Complete 2048 with animated movement, swipe/keyboard/button controls, one-step undo, restart confirmation, win/continue and game-over states.
- Local saved board and best score, with graceful fallback when browser storage is unavailable.
- Sudoku with unique generated puzzles, three clue-density settings, pencil notes, conflict checks, hints, undo, and a local solved-puzzle count.
- LexiTrack with 4×4–7×7 boards, timed rounds, swipe/typed word submission, avatars and up to eight online players; solo play works offline.
- Stones of Five with 19×19 boards, captures, 2–4 players, four bot levels, avatars and shared undo voting; bots work offline.
- Blocks with a seven-piece bag, rotation and wall adjustments, landing preview, line scoring, increasing speed, keyboard/touch controls, pause, and a local best score.

## Structure

```text
index.html / styles.css / app.js   Launcher, routes, installation
manifest.json / sw.js              PWA metadata and release cache
icons/                            Local install icons
games/2048/engine.js               Pure movement and scoring rules
games/2048/game.js                 Mountable game, controls, saved state
games/2048/index.html              Standalone game entry point
games/sudoku/                     Sudoku generator, solver, UI, standalone entry
games/blocks/                     Falling-block rules, UI, standalone entry
games/lexitrack/                  Imported word game and offline ENABLE dictionary
games/stones-of-five/             Imported Pente-style game, board renderer and bots
games/multiplayer/                Shared WebRTC lifecycle, settings and vendored libraries
games/shared.js / shared.css       Storage helpers and common game presentation
tests/                            Node built-in test suite
```

Routes: `#/library`, `#/about`, `#/play/2048`, `#/play/sudoku`, and `#/play/blocks`. Each game also has a standalone entry at `games/2048/`, `games/sudoku/`, or `games/blocks/`. Hash routing requires no server rewrite and supports hosting under a subdirectory.

## Publish on GitHub Pages

The included workflow tests and deploys the arcade whenever changes are pushed to `main`. Pull requests run tests and package the site without deploying.

1. In [the repository's Pages settings](https://github.com/nksimmons/project-antidote-play/settings/pages), set **Build and deployment → Source → GitHub Actions**. See [GitHub's Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
2. Commit and push the project, including `.github/workflows/pages.yml`, to `main`.
3. In **Actions**, wait for **Deploy arcade to GitHub Pages** to succeed. If the code was already pushed before Pages was enabled, select that workflow and **Run workflow** on `main`.
4. Open [the arcade](https://nksimmons.github.io/project-antidote-play/) or [2048 directly](https://nksimmons.github.io/project-antidote-play/#/play/2048). These URLs become available after the first successful deployment.

No personal access token or extra deployment secrets are needed; the workflow uses GitHub's built-in token with Pages deployment permissions. The repository must have GitHub Actions and GitHub Pages available under its account plan.

`npm run build` packages only the website and license into `dist/`. It generates a service-worker version from the release contents, so changes to any shipped file trigger an offline update automatically. Source files stay unchanged. All asset URLs, the manifest, and the worker scope are relative, so the same package works at `/project-antidote-play/`, at the domain root, or under another repository name. Forks should use their own Pages URL.

To preview the deployment artifact locally:

```sh
npm run build
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist
```

GitHub Pages manages its own cache headers; no custom header configuration is required. Installed clients download a new release when the browser checks the service worker; use **Reload to update** in the update bar when offered. **Check for updates** requests a fresh check without clearing saved games. HTTPS is provided by the default `github.io` URL, enabling installation and offline play after the initial load. All five games and the word list are included in the offline release. Online multiplayer itself requires connectivity.

## Offline and release updates

The service worker atomically precaches the full release, including all game assets, at the first successful visit. The footer confirms completion. On deployed sites, shipped assets are cache-first; unknown paths are not cached. On localhost and loopback addresses, shipped assets are network-first with `cache: no-store`, falling back to the installed release if the development server is unavailable. This makes source edits appear on ordinary reloads while preserving local offline testing. Solo games make no multiplayer requests. Inviting or joining friends enables third-party signaling/STUN connections, as described below. An unsuccessful install leaves the prior release available. Offline availability requires that the browser retain site storage.

Use `npm run build` for each release; it automatically versions the service worker. If deploying the source directory directly instead, update `VERSION` in `sw.js` yourself. Add every new game asset to `ASSETS`; missing files intentionally fail installation instead of creating a partially offline release. Keep old release assets available during deployment, and deploy atomically if your host supports it. The launcher and standalone games check on startup, when returning to the tab, when connectivity returns, and once a minute while visible. Workers are checked with `updateViaCache: none`. Updated workers wait until the user selects **Reload to update**, or all old tabs close. Accepting an update reloads other open arcade tabs (multiplayer tabs ask before leaving a room) to keep their code consistent with the active worker. 2048, Sudoku, and Blocks save their boards. Live multiplayer rooms and solo sessions in the two imported games are held in memory; host reloads end those sessions. Activation removes only old Antidote caches for this deployment path, leaving other apps and subdirectory deployments intact.

Deploy `dist/` to an HTTPS static host. Where you control response headers, serve `sw.js` and HTML with `Cache-Control: no-cache` and correct MIME types. Do not add analytics, external fonts, tracking, accounts, monetization, or CDN dependencies. Configure the host's request logging according to your privacy policy; application privacy does not disable host access logs.

## Persistence and accessibility

Each game writes only its own localStorage keys: `antidote:2048:save` / `:best`, `antidote:sudoku:save` / `:solved`, and `antidote:blocks:save` / `:best`. Data stays on the device and is removed by clearing site data. 2048 remembers one undo step; Sudoku remembers up to 100 edits during the current visit. Best scores never decrease. Simultaneous tabs are independent; the most recently saved board wins. These keys share the site's origin, so copies under different paths on the same origin share saves.

Sudoku validates uniqueness as clues are removed. Easy, medium, and hard target 42, 34, and 28 givens; uniqueness can leave extra clues. These are clue-density settings, not a solver-derived difficulty rating. Checks compare entered values to the unique solution; conflicts are also underlined without needing a check. Hints count toward the current puzzle and solved puzzles are counted once, including assisted completions.

Blocks scores 100/300/500/800 points for clearing 1/2/3/4 lines, multiplied by the current level. Soft drops earn one point per row and hard drops two. A fresh seven-piece bag prevents long piece droughts. The fall interval starts at 850 ms, decreases by 65 ms every 10 lines, and bottoms out at 100 ms. Pieces lock on a blocked downward step; there is no separate lock delay. Leaving the page, switching windows, or opening a dialog pauses play. Reloaded games always start paused.

The UI includes keyboard focus indicators, semantic navigation, reduced-motion support, labeled movement buttons, a board description with row values, and polite move/result announcements. Swiping suppresses scrolling only on the board. No install prompt is required. Network access is optional for solo games; online multiplayer requires it.

## Verify a release

1. Run `npm test`, then load the launcher and wait for “Ready for offline play.”
2. Play via arrows/WASD, swipe, and movement buttons; test undo and restart.
3. Reload `#/play/2048` and confirm the saved board and best score.
4. In browser developer tools, go offline, reload the launcher and standalone game, and play.
5. Check mobile widths, zoom, keyboard navigation, and reduced motion.
6. Rebuild and publish a changed release; use **Check for updates**, then **Reload to update**, and verify preserved game state in both the launcher and standalone games.
7. Play Sudoku using notes, erase, undo, check, and hints; confirm completion increments the solved count only once after reload.
8. Play Blocks using movement, rotation, soft/hard drops, and pause; reload to confirm the board and best score, then check a game-over restart.

MIT licensing permits reuse, including commercial forks. The project's own zero-monetization commitment remains a project policy.

## If an older copy is stuck

Older releases expose **Update ready** in the footer. Use it once to install the new update controls, or hard-refresh once to load the new client. Future releases show a prominent update bar. There is no need to clear site data, which would erase saved games. Adding a query string to a game URL does not bypass the production service-worker cache.

For local source work, use `npm run dev`. A server pointed at `dist/` or a copied preview folder serves that built snapshot; rebuild (and recopy, if applicable) to change it. A browser refresh cannot rebuild a snapshot.

## Multiplayer games

Open `games/lexitrack/` or `games/stones-of-five/` from the library. Both are static pages and work under GitHub Pages repository paths. `#/play/lexitrack` and `#/play/stones-of-five` also redirect there. The original separate dedicated-host and Express/WebSocket servers are not deployed: each game's host also plays.

1. Enter a name and start playing. LexiTrack can start solo; Stones needs a friend or at least one bot.
2. Multiplayer works best when everyone is on the same Wi-Fi or local network; internet access is still needed to connect. To play with friends, choose **Invite friends**, then **Copy invite** or scan the QR code. Opening a player page without an invite cannot join a room.
3. Keep the host tab open and active. Guest refreshes reconnect with a room-specific session token and receive current authoritative state. Closing/reloading the host ends the room; there is no host migration or saved multiplayer match. Browser background suspension can delay timers/connections.
4. If joining fails, check that the invitation is current and the host is online, then use **Retry connection**. Automatic retries are bounded and leave the old room before trying again. Actions made while disconnected are not queued for later replay.

Invites contain a random 128-bit room identifier plus the current host's peer ID. The fragment keeps the invite out of HTTP request URLs. Share links privately: anyone possessing one can attempt to join. Session tokens reserve seats, but this is a casual host-authoritative game, not an anti-cheat system. The host can see submitted words and game state.

**Networking limits:** GitHub Pages hosts static files; it cannot provide signaling or TURN. Trystero 0.25.4 uses public Nostr relays for encrypted WebRTC signaling and STUN for connectivity. Game messages use encrypted RTC data channels. Public infrastructure sees connection metadata including IP addresses and has no availability guarantee. No analytics, accounts, or tracking identifiers are added. Online opponents may also learn each other's IP addresses through WebRTC.

Some NAT/firewall combinations require TURN; code cannot force a direct connection through every network. Deployment maintainers can customize `games/multiplayer/config.js`; players do not configure relay services. Never commit permanent TURN secrets. A production TURN credential service should issue short-lived credentials; operating one is outside this static repository. A custom Nostr signaling relay must be configured consistently for all clients. The in-game technical explanation and connection-settings form have been removed; networking details remain here and in the arcade's About page.

A future manual pairing mode could exchange a complete WebRTC offer and answer (including gathered ICE candidates) through QR codes or copy/paste. That removes the public signaling service. With an empty ICE server list, it may work on a shared local network, but browser privacy restrictions, Wi-Fi client isolation and NAT can still prevent connections. Automatic LAN broadcast/discovery is not available to an ordinary browser page; BroadcastChannel only connects same-origin contexts within a browser. Manual pairing is not implemented in this release.

The original protocol adapters were replaced with one readable adapter around the pinned current API. It owns room cleanup, closes connections once, targets messages to the host/player, validates protocol and message sizes, exposes real failures, and bounds retries. Per-tab, per-room seat tokens avoid the original same-browser identity collision. Pente rejects stale revisions and malformed coordinates; undo voting now includes the host and expires after 20 seconds. LexiTrack validates words on the host, retains selected settings, fixes Qu search, and sends acknowledged words and counts back to guests.

LexiTrack preserves the existing browser version's scoring: length 3/4/5/6/7/8+ earns 1/1/2/3/5/11, plus 1 for 8+ letters and 2 for a unique word. Shared words still receive base points. This differs from classic Boggle's shared-word cancellation. It now uses the original repo's public-domain ENABLE list rather than CSW19, so some accepted words differ. Profiles (names and drawn avatars) are stored locally and shared only with room participants; seat tokens live in sessionStorage. Match scores are not saved across host reloads.

### Multiplayer verification

`npm test` covers room destruction, peer filtering, message limits, timeouts/retries, identity isolation, stale moves, undo voting, captures, wins, bots, Qu paths, scoring and retained settings, in addition to the original arcade tests. The service-worker test checks every shipped game file is precached. For browser verification, open a host and guest in separate tabs, play moves/words, refresh the guest, finish a round, and test host/guest undo. Also test two real devices on different networks before relying on a specific TURN deployment; a same-machine pass does not prove arbitrary NAT traversal.

See `THIRD_PARTY_NOTICES.txt` for source commits and library/dictionary licenses. `node scripts/vendor.mjs` rebuilds the checked-in WebRTC/QR assets from pinned public npm packages using a temporary directory. Normal development, tests, and deployment builds need no package installation or runtime CDN.
