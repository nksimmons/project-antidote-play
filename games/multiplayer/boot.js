import { createPeerClasses, connectWithRetry } from './transport.js';
import { roomFromLocation, sessionIdentity, safeAvatar } from './session.js';
import { multiplayerConfig } from './config.js';
import { setupPWA } from '../../pwa.js';

const entry = document.querySelector('script[data-game]');
const sessions = new Set();
const status = message => { document.querySelector('#network-status').textContent = message; };
let overrides = {};
const config = () => ({ ...multiplayerConfig, ...overrides });
const peers = createPeerClasses({ load: () => import('./vendor/trystero.js'), config, status });
window.TrysteroHostPeer = class extends peers.HostPeer {
  constructor(appId) { super(appId); sessions.add(this); }
};
window.AntidoteMultiplayer = {
  room: roomFromLocation(location),
  identity() {
    let storage;
    try { storage = sessionStorage; } catch { /* Private storage may be blocked. */ }
    return sessionIdentity(storage, entry.dataset.game, roomFromLocation(location));
  },
  storage: {
    getItem(key) { try { return localStorage.getItem(key); } catch { return null; } },
    setItem(key, value) { try { localStorage.setItem(key, value); } catch { /* Keep playing without saved profiles. */ } },
  },
  safeAvatar, status,
  connect(options) {
    const session = connectWithRetry({ ...options, PlayerPeer: peers.PlayerPeer, status });
    sessions.add(session);
    document.querySelector('#retry-connection').hidden = false;
    return session;
  },
  inviteUrl(id) {
    const url = new URL('player.html', location.href);
    url.search = ''; url.hash = new URLSearchParams({ room: id }).toString();
    return url.href;
  },
};

document.querySelector('#retry-connection').addEventListener('click', () => {
  for (const session of sessions) session.retry?.();
});
document.querySelector('#network-settings').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  const relay = form.elements.relay.value.trim();
  const turn = form.elements.turn.value.trim();
  if ((relay && !/^wss:\/\//.test(relay)) || (turn && !/^turns?:[^\s]+$/.test(turn))) {
    status('Use a wss:// signaling URL and a turn: or turns: relay URL.'); return;
  }
  overrides = {};
  if (relay) overrides.relayConfig = { urls: [relay] };
  if (turn) overrides.turnConfig = [{ urls: turn, username: form.elements.username.value, credential: form.elements.credential.value }];
  status('Connection settings applied for this tab. Create an invite or retry joining. Both players must use the same signaling relay.');
});
document.querySelector('#copy-invite').addEventListener('click', async () => {
  const text = document.querySelector('#combined-join-url, #lobby-url')?.textContent;
  if (!text?.startsWith('http')) { status('Choose Invite friends first.'); return; }
  try { await navigator.clipboard.writeText(text); status('Invite copied. Send it to a friend.'); }
  catch { status('Select and copy the invite link shown in the lobby.'); }
});
window.addEventListener('pagehide', () => { for (const session of sessions) session.destroy(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

// Preserve original standalone game scripts and their shared lexical globals.
// They run only after the common connection API is ready.
for (const path of entry.dataset.scripts.split(' ')) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = path;
    script.onload = resolve; script.onerror = reject; document.body.append(script);
  });
}
setupPWA({ beforeReload: () => !sessions.size || confirm('Updating will leave this multiplayer room. Update now?') });
