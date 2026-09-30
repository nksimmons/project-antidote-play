# The Antidote Project

Good games. No strings. An MIT-licensed, dependency-free PWA arcade built with vanilla HTML, CSS, and JavaScript.

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
- Sudoku and Blocks are clearly marked coming soon, not playable prototypes.

## Structure

```text
index.html / styles.css / app.js   Launcher, routes, installation
manifest.json / sw.js              PWA metadata and release cache
icons/                            Local install icons
games/2048/engine.js               Pure movement and scoring rules
games/2048/game.js                 Mountable game, controls, saved state
games/2048/index.html              Standalone game entry point
tests/                            Node built-in test suite
```

Routes: `#/library`, `#/about`, `#/play/2048`. The standalone game also works at `games/2048/`. Hash routing requires no server rewrite and supports hosting under a subdirectory.

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

GitHub Pages manages its own cache headers; no custom header configuration is required. Installed clients download a new release when the browser checks the service worker; use **Update ready** in the footer when offered. HTTPS is provided by the default `github.io` URL, enabling installation and offline play after the initial load. Sudoku and Blocks remain upcoming; 2048 is playable in this release.

## Offline and release updates

The service worker atomically precaches the full release, including all game assets, at the first successful visit. The footer confirms completion. Shipped assets are cache-first; unknown paths are not cached. No third-party requests are made by the application. An unsuccessful install leaves the prior release available. Offline availability requires that the browser retain site storage.

Use `npm run build` for each release; it automatically versions the service worker. If deploying the source directory directly instead, update `VERSION` in `sw.js` yourself. Add every new game asset to `ASSETS`; missing files intentionally fail installation instead of creating a partially offline release. Keep old release assets available during deployment, and deploy atomically if your host supports it. Updated workers wait until the user selects **Update ready**, or all old tabs close. Game state is saved before animation, so accepting an update preserves the current board. Activation removes only old Antidote caches for this deployment path, leaving other apps and subdirectory deployments intact.

Deploy `dist/` to an HTTPS static host. Where you control response headers, serve `sw.js` and HTML with `Cache-Control: no-cache` and correct MIME types. Do not add analytics, external fonts, tracking, accounts, monetization, or CDN dependencies. Configure the host's request logging according to your privacy policy; application privacy does not disable host access logs.

## Persistence and accessibility

Only `antidote:2048:save` and `antidote:2048:best` are written to localStorage. Data stays on the device and is removed by clearing site data. Undo applies only to the last move in the current mounted game; the best score never decreases. Simultaneous tabs are independent; the most recently saved board wins.

The UI includes keyboard focus indicators, semantic navigation, reduced-motion support, labeled movement buttons, a board description with row values, and polite move/result announcements. Swiping suppresses scrolling only on the board. No motion, sound, network access, or install prompt is required to play after assets load.

## Verify a release

1. Run `npm test`, then load the launcher and wait for “Ready for offline play.”
2. Play via arrows/WASD, swipe, and movement buttons; test undo and restart.
3. Reload `#/play/2048` and confirm the saved board and best score.
4. In browser developer tools, go offline, reload the launcher and standalone game, and play.
5. Check mobile widths, zoom, keyboard navigation, and reduced motion.
6. Bump the worker version and reload online; verify the update button and preserved game state.

MIT licensing permits reuse, including commercial forks. The project's own zero-monetization commitment remains a project policy.
