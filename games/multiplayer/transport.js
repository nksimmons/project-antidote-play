// A small, testable adapter around the pinned Trystero API. Games only exchange
// targeted, versioned JSON messages; room lifetime belongs to exactly one peer.
export function parseInvite(value) {
  const match = /^v1\.([a-f0-9]{32})\.([A-Za-z0-9_-]{8,128})$/.exec(value || '');
  if (!match) throw new Error('Invalid invite. Ask the host for a fresh link.');
  return { roomId: match[1], hostId: match[2] };
}

export function createPeerClasses({ load, config = () => ({}), status = () => {}, randomId = () => crypto.randomUUID().replaceAll('-', ''), timeout = 35_000 }) {
  class Events {
    handlers = new Map();
    on(type, handler) { const list = this.handlers.get(type) || []; list.push(handler); this.handlers.set(type, list); return this; }
    emit(type, ...args) { for (const handler of this.handlers.get(type) || []) handler(...args); }
  }
  class Connection extends Events {
    open = false;
    closed = false;
    constructor(peer) { super(); this.peer = peer; }
    activate(send) { if (this.closed) return; this.sendAction = send; this.open = true; clearTimeout(this.timer); this.emit('open'); }
    send(data) {
      if (!this.open || this.closed) return false;
      Promise.resolve().then(() => this.sendAction({ v: 1, data })).catch(error => this.close(error));
      return true;
    }
    receive(message, limit) {
      if (!this.open || message?.v !== 1 || !message.data || typeof message.data !== 'object' || Array.isArray(message.data)) return;
      if (typeof message.data.type !== 'string' || JSON.stringify(message).length > limit) return;
      this.emit('data', message.data);
    }
    close(error, notify = true) {
      if (this.closed) return;
      this.closed = true; this.open = false; this.sendAction = null; clearTimeout(this.timer);
      if (notify) this.emit('close', error);
    }
  }
  class Peer extends Events {
    destroyed = false;
    connections = new Map();
    constructor(appId) { super(); this.appId = appId; }
    async join(roomId) {
      const library = await load();
      if (this.destroyed) return null;
      this.room = library.joinRoom({ ...config(), appId: this.appId }, roomId, {
        onJoinError: () => status('Could not reach a player. Check that both devices are online and using the current invite.'),
      });
      return library;
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      for (const connection of this.connections.values()) connection.close(null, false);
      this.connections.clear();
      this.room?.leave(); this.room = null;
    }
    fail(error) { if (!this.destroyed) { status(error.message); this.emit('error', error); } }
  }
  class HostPeer extends Peer {
    constructor(appId) {
      super(appId);
      this.start().catch(error => this.fail(error));
    }
    async start() {
      const roomId = randomId();
      const library = await this.join(roomId);
      if (!library) return;
      this.id = `v1.${roomId}.${library.selfId}`;
      const outbound = this.room.makeAction('host');
      const inbound = this.room.makeAction('player');
      this.room.onPeerJoin = peerId => {
        if (this.destroyed || this.connections.has(peerId)) return;
        const connection = new Connection(peerId);
        this.connections.set(peerId, connection);
        this.emit('connection', connection);
        connection.activate(data => outbound.send(data, { target: peerId }));
        status('Friend connected. Keep this host tab open.');
      };
      inbound.onMessage = (message, { peerId }) => this.connections.get(peerId)?.receive(message, 24_000);
      this.room.onPeerLeave = peerId => {
        this.connections.get(peerId)?.close(new Error('Player disconnected.'));
        this.connections.delete(peerId);
        status('A player disconnected. Their seat is reserved for reconnection.');
      };
      status('Invite ready. Keep this host tab open; friends need an internet connection.');
      this.emit('open', this.id);
    }
  }
  class PlayerPeer extends Peer {
    constructor(appId) { super(appId); queueMicrotask(() => { if (!this.destroyed) this.emit('open'); }); }
    connect(invite) {
      if (this.connection) throw new Error('This peer is already joining a room.');
      const connection = this.connection = new Connection();
      this.connections.set('host', connection);
      connection.timer = setTimeout(() => connection.close(new Error('Connection timed out. Check that the host tab is open, then try again.')), timeout);
      this.start(invite, connection).catch(error => connection.close(error));
      return connection;
    }
    async start(invite, connection) {
      const { roomId, hostId } = parseInvite(invite);
      connection.peer = hostId;
      if (!await this.join(roomId)) return;
      const outbound = this.room.makeAction('player');
      const inbound = this.room.makeAction('host');
      this.room.onPeerJoin = peerId => {
        if (peerId === hostId && !this.destroyed && !connection.open) {
          status('Connected to the host.');
          connection.activate(data => outbound.send(data, { target: hostId }));
        }
      };
      inbound.onMessage = (message, { peerId }) => { if (peerId === hostId) connection.receive(message, 512_000); };
      this.room.onPeerLeave = peerId => { if (peerId === hostId) connection.close(new Error('Host disconnected.')); };
    }
  }
  return { HostPeer, PlayerPeer };
}

// One retry timer, one peer, and no queue of gameplay actions to replay later.
export function connectWithRetry({ PlayerPeer, appId, invite, onOpen, onData, onClose = () => {}, status = () => {}, delay = 2_000, maxRetries = 3 }) {
  let peer, connection, timer, stopped = false, retries = 0;
  const session = {
    send(data) { return connection?.send(data) || false; },
    get open() { return !!connection?.open; },
    retry() { if (!stopped) { retries = 0; start(); } },
    destroy() { stopped = true; clearTimeout(timer); peer?.destroy(); connection = null; },
  };
  function start() {
    clearTimeout(timer); peer?.destroy(); connection = null;
    if (stopped) return;
    status('Connecting to the host…');
    const current = peer = new PlayerPeer(appId);
    let failed = false;
    const fail = error => {
      if (failed || stopped || peer !== current) return;
      failed = true; current.destroy(); connection = null; onClose();
      status(error?.message || 'Connection lost.');
      if (retries < maxRetries) timer = setTimeout(start, delay * 2 ** retries++);
      else status('Could not connect. Ask the host for a fresh invite, then Retry connection.');
    };
    current.on('error', fail);
    current.on('open', () => {
      if (stopped || current !== peer) return;
      connection = current.connect(invite);
      connection.on('open', () => { retries = 0; onOpen(session); });
      connection.on('data', onData);
      connection.on('close', fail);
    });
  }
  try { parseInvite(invite); start(); } catch (error) { status(error.message); }
  return session;
}
