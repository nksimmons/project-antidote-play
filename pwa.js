// Keep update handling identical in the launcher and standalone games.
export function createUpdateManager({ serviceWorker, scriptURL, onChange, reload }) {
  let registration;
  let waiting;
  let checking = false;
  let ready = !!serviceWorker.controller;
  let controlled = ready;
  let reloading = false;
  const watched = new WeakSet();
  const emit = message => onChange({ ready, checking, waiting: !!waiting, message });

  function inspect() {
    waiting = registration.waiting || (waiting?.state === 'installed' ? waiting : null);
    ready = !!registration.active;
    emit();
  }
  function watch(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    const changed = () => {
      if (worker.state === 'installed' && (registration.active || serviceWorker.controller)) {
        // registration.waiting may not yet be populated during statechange.
        waiting = worker;
        emit();
      } else if (worker.state === 'activated') {
        waiting = null; ready = true; emit();
      } else if (worker.state === 'redundant') {
        if (waiting === worker) waiting = null;
        emit('Update download failed. Your saved release is still available.');
      }
    };
    worker.addEventListener('statechange', changed);
    changed();
  }
  serviceWorker.addEventListener('controllerchange', () => {
    // Also reload other tabs when one tab accepts an update, so their scripts
    // stay in sync with the newly controlling worker. First install needs none.
    if (controlled && !reloading) { reloading = true; reload(); return; }
    controlled = true; ready = true; emit();
  });

  return {
    async start() {
      try {
        registration = await serviceWorker.register(scriptURL, { updateViaCache: 'none' });
        inspect();
        watch(registration.installing);
        registration.addEventListener('updatefound', () => watch(registration.installing));
      } catch { emit('Offline setup unavailable. Try checking again when online.'); }
    },
    async check() {
      if (checking) return;
      if (!registration) { await this.start(); if (!registration) return; }
      if (registration.waiting || waiting) { inspect(); return; }
      checking = true; emit('Checking for updates…');
      try {
        await registration.update();
        inspect();
        const worker = registration.installing;
        if (worker && !['installed','activated','redundant'].includes(worker.state)) {
          emit('Downloading the latest arcade…');
          await new Promise(resolve => {
            const changed = () => {
              if (['installed','activated','redundant'].includes(worker.state)) {
                worker.removeEventListener('statechange', changed); resolve();
              }
            };
            worker.addEventListener('statechange', changed); changed();
          });
        }
        inspect();
        emit(waiting ? undefined : worker?.state === 'redundant' ? 'Update download failed. Try again when online.' : 'You’re up to date.');
      } catch { emit('Couldn’t check for updates. You can keep playing offline.'); }
      finally { checking = false; emit(); }
    },
    apply() {
      const worker = registration?.waiting || waiting;
      if (!worker || worker.state !== 'installed') return;
      emit('Updating the arcade…');
      worker.postMessage({ type: 'ACTIVATE_UPDATE' });
    },
  };
}

export function setupPWA({ beforeReload = () => true } = {}) {
  const host = document.createElement('aside');
  host.className = 'pwa-updates';
  host.setAttribute('aria-label', 'Arcade updates');
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pwa-update-button';
  button.textContent = 'Check for updates';
  host.append(status, button);
  document.querySelector('.site-header').after(host);
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = 'Offline installation needs HTTPS or localhost';
    button.disabled = true; return;
  }
  let current = {};
  let message;
  function render(next = current) {
    current = next;
    if (next.message) message = next.message;
    host.classList.toggle('update-available', next.waiting);
    status.textContent = next.waiting ? 'A fresh arcade is ready. Saved games stay with you.' : message || (next.ready ? 'Ready for offline play' : 'Preparing offline play…');
    button.textContent = next.waiting ? 'Reload to update' : next.checking ? 'Checking…' : 'Check for updates';
    button.disabled = next.checking && !next.waiting;
    const footer = document.querySelector('#connection');
    if (footer) footer.textContent = next.ready ? (navigator.onLine ? 'Ready for offline play' : 'Offline. Play on.') : 'Preparing offline play';
  }
  const manager = createUpdateManager({
    serviceWorker: navigator.serviceWorker,
    scriptURL: new URL('./sw.js', import.meta.url).href,
    onChange: render,
    reload: () => {
      if (beforeReload()) location.reload();
      else render({ ...current, message: 'Update installed. Finish this game, then reload.' });
    },
  });
  button.addEventListener('click', () => current.waiting ? manager.apply() : manager.check());
  let lastCheck = 0;
  const check = () => {
    if (document.hidden || !navigator.onLine || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now(); manager.check();
  };
  window.addEventListener('online', () => { lastCheck = 0; check(); });
  window.addEventListener('offline', () => render());
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
  setInterval(check, 60_000);
  manager.start().then(check);
}
