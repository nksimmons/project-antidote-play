import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeerClasses, connectWithRetry, parseInvite } from '../games/multiplayer/transport.js';
import { roomFromLocation, sessionIdentity, safeAvatar } from '../games/multiplayer/session.js';
import { multiplayerConfig } from '../games/multiplayer/config.js';

const roomId = 'a'.repeat(32);
const invite = `v1.${roomId}.host123456`;
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  const rooms = [], sent = [];
  const classes = createPeerClasses({
    randomId: () => roomId, timeout: 1000,
    load: async () => ({ selfId: 'host123456', joinRoom(config, id) {
      const actions = {};
      const room = { config, id, actions, leaves: 0,
        makeAction(name) { return actions[name] = { send: async (data, target) => sent.push({ name, data, target }) }; },
        leave() { this.leaves++; },
      }; rooms.push(room); return room;
    } }), ...options,
  });
  return { ...classes, rooms, sent };
}

test('host IDs are published, messages are targeted and versioned, leave closes exactly once', async () => {
  const f = fixture(); const host = new f.HostPeer('test');
  let connection, closes = 0, messages = 0;
  host.on('connection', c => { connection = c; c.on('close', () => closes++); c.on('data', () => messages++); });
  await tick();
  assert.equal(host.id, invite);
  const room = f.rooms[0]; room.onPeerJoin('guest');
  assert.equal(connection.open, true);
  connection.send({ type: 'state' }); await tick();
  assert.deepEqual(f.sent[0], { name: 'host', data: { v: 1, data: { type: 'state' } }, target: { target: 'guest' } });
  room.actions.player.onMessage({ v: 2, data: { type: 'move' } }, { peerId: 'guest' });
  room.actions.player.onMessage({ v: 1, data: { type: 'move', junk: 'x'.repeat(24000) } }, { peerId: 'guest' });
  room.actions.player.onMessage({ v: 1, data: { type: 'move' } }, { peerId: 'guest' });
  assert.equal(messages, 1);
  room.onPeerLeave('guest'); room.onPeerLeave('guest');
  assert.equal(connection.open, false); assert.equal(closes, 1);
  assert.equal(connection.send({ type: 'move' }), false);
  host.destroy(); host.destroy(); assert.equal(room.leaves, 1);
});

test('player accepts state only from its invited host and releases the old room', async () => {
  const f = fixture(); const player = new f.PlayerPeer('test');
  const connection = player.connect(invite); let received = 0;
  connection.on('data', () => received++); await tick();
  const room = f.rooms[0]; room.onPeerJoin('stranger'); assert.equal(connection.open, false);
  room.onPeerJoin('host123456'); assert.equal(connection.open, true);
  room.actions.host.onMessage({ v: 1, data: { type: 'state' } }, { peerId: 'stranger' });
  room.actions.host.onMessage({ v: 1, data: { type: 'state' } }, { peerId: 'host123456' });
  assert.equal(received, 1);
  player.destroy(); assert.equal(connection.open, false); assert.equal(room.leaves, 1);
});

test('leaving while the library loads cannot open a ghost room', async () => {
  let finish; let joins = 0;
  const { HostPeer } = createPeerClasses({ randomId: () => roomId, load: () => new Promise(r => { finish = r; }) });
  const host = new HostPeer('test'); host.destroy();
  finish({ joinRoom() { joins++; } }); await tick(); assert.equal(joins, 0);
});

test('a timed-out join closes once and retry replaces the room without replaying moves', async t => {
  const f = fixture({ timeout: 15 }); let closed = 0;
  const session = connectWithRetry({ ...f, appId: 'test', invite, onOpen() {}, onData() {}, onClose() { closed++; }, delay: 5, maxRetries: 1 });
  t.after(() => session.destroy());
  assert.equal(session.send({ type: 'place-stone' }), false);
  await new Promise(r => setTimeout(r, 60));
  assert.equal(f.rooms.length, 2); assert.equal(closed, 2);
  assert.ok(f.rooms.every(r => r.leaves === 1)); assert.equal(f.sent.length, 0);
});

test('hosts and retried guests retain TURN transports without replacing default STUN', async t => {
  const f = fixture({ config: () => multiplayerConfig, timeout: 15 });
  const host = new f.HostPeer('test');
  const session = connectWithRetry({ ...f, appId: 'test', invite, onOpen() {}, onData() {}, delay: 5, maxRetries: 1 });
  t.after(() => { host.destroy(); session.destroy(); });
  await new Promise(r => setTimeout(r, 60));
  assert.equal(f.rooms.length, 3);
  for (const { config } of f.rooms) {
    assert.equal(config.rtcConfig.iceTransportPolicy, 'all');
    assert.equal(config.rtcConfig.iceServers, undefined); // Let Trystero append TURN to its STUN defaults.
    const servers = config.turnConfig;
    const urls = servers.flatMap(server => server.urls);
    assert.ok(urls.some(url => /^turn:.*\?transport=udp$/.test(url)));
    assert.ok(urls.some(url => /^turn:.*:443\?transport=tcp$/.test(url)));
    assert.ok(urls.some(url => /^turns:.*:443\?transport=tcp$/.test(url)));
    assert.ok(servers.every(server => server.username && server.credential));
  }
});

test('refresh keeps a seat; rooms and tabs have distinct identities; unavailable storage still works', () => {
  function storage() { const map = new Map(); return { getItem: k => map.get(k), setItem: (k,v) => map.set(k,v) }; }
  const first = storage(); let id = 0; const random = () => `id-${id++}`;
  const seat = sessionIdentity(first, 'words', invite, random);
  assert.equal(sessionIdentity(first, 'words', invite, random), seat);
  assert.notEqual(sessionIdentity(storage(), 'words', invite, random), seat);
  assert.notEqual(sessionIdentity(first, 'words', 'another-room', random), seat);
  assert.doesNotThrow(() => sessionIdentity(null, 'words', invite, random));
  assert.equal(roomFromLocation({ hash: `#room=${invite}`, search: '' }), invite);
  assert.equal(parseInvite(invite).hostId, 'host123456');
  for (const bad of ['', 'undefined', 'AAAAAA-short', `v2.${roomId}.host123456`]) assert.throws(() => parseInvite(bad));
  assert.deepEqual(safeAvatar({ bgColor: 'red;anything', drawing: '" onerror="bad' }), { bgColor: '#457b9d', drawing: null });
});
