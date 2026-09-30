import { mountGame, readBest } from './games/2048/game.js';

const main = document.querySelector('#main');
const connection = document.querySelector('#connection');
let disposeGame;
let filter = 'all';
let installPrompt;
let registration;
let offlineReady = false;
let applyingUpdate = false;

function renderLibrary() {
  main.innerHTML = `
    <section class="hero" aria-labelledby="welcome"><div><span class="eyebrow"><span class="dot"></span>THE ANTIDOTE TO THE EVERYDAY SCROLL</span><h1 id="welcome">Good games.<br><em>No strings.</em></h1><p>A small arcade for a clearer head. Thoughtfully made,<br class="desktop-break"> endlessly replayable, and entirely yours.</p></div><div class="hero-stamp" aria-label="100 percent free, forever"><span>LESS NOISE</span><strong>100% free</strong><span>MORE PLAY</span></div></section>
    <section aria-label="Game library"><div class="library-toolbar"><div class="filters" role="group" aria-label="Filter games"><button class="filter" data-filter="all" aria-pressed="true">All games</button><button class="filter" data-filter="logic" aria-pressed="false">Logic</button><button class="filter" data-filter="arcade" aria-pressed="false">Arcade</button></div><span class="edition">THE STARTER COLLECTION — VOL. 01</span></div>
    <div class="game-grid">
      <article class="game-card" data-genre="logic"><div class="game-art art-2048" aria-hidden="true"><span class="art-label">THE ONE-MORE-TRY CLASSIC</span><div class="mini-2048"><span>2</span><span class="tile-8">8</span><span>4</span><span class="tile-16">16</span><span class="tile-2048">2048</span><span class="tile-8">8</span><span>4</span><span class="tile-64">64</span><span class="tile-16">16</span></div></div><div class="card-body"><div class="card-heading"><h2>2048</h2><span class="genre">SLIDE & COMBINE</span></div><p>A few tiles. A little strategy. A surprisingly good way to find your flow.</p><a class="card-button" href="#/play/2048"><span id="play-label">Let's play</span><span aria-hidden="true">↗</span></a><div class="card-meta"><span>PERSONAL BEST: ${readBest().toLocaleString()}</span><span>∞ POSSIBILITIES</span></div></div></article>
      <article class="game-card" data-genre="logic"><div class="game-art art-sudoku" aria-hidden="true"><span class="art-label">A QUIET KIND OF CHALLENGE</span><div class="sudoku-art"><span>1</span><span></span><span>3</span><span></span><span>5</span><span></span><span>7</span><span></span><span>9</span></div></div><div class="card-body"><div class="card-heading"><h2>Sudoku</h2><span class="genre">THINK & SOLVE</span></div><p>Find a little order in the everyday.<br>One satisfying square at a time.</p><button class="card-button" disabled><span>Coming soon</span><span aria-hidden="true">◷</span></button><div class="card-meta"><span>IN THE WORKSHOP</span><span>01–09</span></div></div></article>
      <article class="game-card" data-genre="arcade"><div class="game-art art-blocks" aria-hidden="true"><span class="art-label">MAKE ROOM FOR PLAY</span><div class="blocks-art">${Array.from({ length: 25 }, (_, i) => `<i class="${[0,1,3,4,5,8,9,10,14,15].includes(i) ? 'blank' : ''}"></i>`).join('')}</div></div><div class="card-body"><div class="card-heading"><h2>Blocks</h2><span class="genre">DROP & CLEAR</span></div><p>Everything falls into place.<br>Well, with a little help from you.</p><button class="card-button" disabled><span>Coming soon</span><span aria-hidden="true">◷</span></button><div class="card-meta"><span>IN THE WORKSHOP</span><span>FIND YOUR FIT</span></div></div></article>
    </div></section>
    <section class="principles" aria-label="Our promises"><div class="principle"><span class="principle-icon" aria-hidden="true">◈</span><div><h3>Your time is yours.</h3><p>No ads, no paywalls, no interruptions.<br>Just the good part.</p></div></div><div class="principle"><span class="principle-icon" aria-hidden="true">♧</span><div><h3>Off the grid? All good.</h3><p>Load once, play anywhere.<br>Your next move needs no signal.</p></div></div><a class="principle" href="#/about"><span class="principle-icon" aria-hidden="true">↗</span><div><h3>Open by nature.</h3><p>No tracking. No accounts.<br>Read about the project →</p></div></a></section>`;
  main.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; applyFilter(); }));
  applyFilter();
}

function applyFilter() {
  main.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
  main.querySelectorAll('[data-genre]').forEach(card => { card.hidden = filter !== 'all' && card.dataset.genre !== filter; });
}

function renderAbout() {
  main.innerHTML = `<article class="about"><span class="eyebrow">THE ANTIDOTE PROJECT</span><h1>A little less noise.<br>A little more play.</h1><p>Remember when a game was just a game? No pop-ups between moves. No coins to buy. No account to create. We think that should still be the default.</p><h2>Built with respect.</h2><p>Antidote is a small, open-source collection of classic games. Everything here is free. There are no ads, microtransactions, analytics scripts, external fonts, or third-party requests.</p><h2>Your game stays with you.</h2><p>Your 2048 board and best score are stored in your browser on this device. They are never sent to us. Clearing site data removes saved progress; private browsing or device storage cleanup can also remove it. The web host may keep ordinary server request logs; the app itself collects nothing.</p><h2>A pocket arcade, signal optional.</h2><p>Once the arcade is ready for offline play, every asset in this release is saved locally. You can install it to your home screen or keep playing in your browser. New releases are downloaded together, so an interrupted update leaves your existing release available.</p><h2>Small on purpose.</h2><p>Vanilla JavaScript. Native browser features. No runtime dependencies. The source is licensed under MIT, so you can study it, change it, or build your own arcade.</p><a class="card-button" href="#/library">Find your next game <span aria-hidden="true">→</span></a></article>`;
}

function route({ focus = true } = {}) {
  disposeGame?.();
  disposeGame = undefined;
  const path = location.hash.slice(1) || '/library';
  let section = 'library';
  if (path === '/play/2048') {
    document.title = '2048 — Antidote';
    disposeGame = mountGame(main);
  } else if (path === '/about') {
    section = 'about';
    document.title = 'Our philosophy — Antidote';
    renderAbout();
  } else if (path === '/library' || path === '/') {
    document.title = 'Antidote — Good games. No strings.';
    renderLibrary();
  } else {
    document.title = 'Page not found — Antidote';
    main.innerHTML = '<section class="about"><span class="eyebrow">A SMALL DETOUR</span><h1>This game isn’t here.</h1><p>Head back to the arcade to find something to play.</p><a class="card-button" href="#/library">Back to the arcade →</a></section>';
  }
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (focus) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

window.addEventListener('hashchange', () => route());
route({ focus: false });

const installButton = document.querySelector('#install-button');
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event;
});
installButton.addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = undefined;
    await prompt.prompt();
  } else document.querySelector('#install-dialog').showModal();
});
window.addEventListener('appinstalled', () => { installPrompt = undefined; installButton.hidden = true; });
if (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) installButton.hidden = true;

function updateConnection(message) {
  connection.replaceChildren();
  connection.append(document.createElement('i'), document.createTextNode(message || (offlineReady ? (navigator.onLine ? 'Ready for offline play' : 'Offline. Play on.') : 'Offline setup incomplete')));
  if (registration?.waiting) {
    const button = document.createElement('button');
    button.textContent = 'Update ready ↻';
    button.addEventListener('click', () => { applyingUpdate = true; registration.waiting?.postMessage({ type: 'ACTIVATE_UPDATE' }); });
    connection.append(button);
  }
}
window.addEventListener('online', () => updateConnection());
window.addEventListener('offline', () => updateConnection());

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applyingUpdate) { location.reload(); return; }
    offlineReady = true; updateConnection();
  });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    registration = reg;
    offlineReady = !!reg.active;
    updateConnection(offlineReady ? undefined : 'Saving arcade for offline play');
    function watch(worker) {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') { offlineReady = true; updateConnection(); }
        else if (worker.state === 'installed') updateConnection(offlineReady ? undefined : 'Finishing offline setup');
        else if (worker.state === 'redundant' && !offlineReady) updateConnection('Offline setup failed. Reload to retry.');
      });
    }
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
  }).catch(() => updateConnection('Offline setup unavailable. Reload to retry.'));
} else updateConnection('Offline installation needs HTTPS or localhost');
