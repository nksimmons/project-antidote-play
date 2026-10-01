import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateManager } from '../pwa.js';

class Worker extends EventTarget {
  constructor(state) { super(); this.state = state; this.messages = []; }
  transition(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
  postMessage(message) { this.messages.push(message); }
}

function fixture({ controlled = true, waiting = null } = {}) {
  const serviceWorker = new EventTarget();
  serviceWorker.controller = controlled ? {} : null;
  const registration = new EventTarget();
  registration.active = controlled ? new Worker('activated') : null;
  registration.waiting = waiting;
  registration.installing = null;
  registration.update = async () => {};
  let options;
  serviceWorker.register = async (url, settings) => { options = settings; return registration; };
  const changes = [];
  let reloads = 0;
  const manager = createUpdateManager({ serviceWorker, scriptURL: '/arcade/sw.js', onChange: state => changes.push(state), reload: () => reloads++ });
  return { manager, registration, serviceWorker, changes, get options() { return options; }, get reloads() { return reloads; } };
}

test('registration bypasses the HTTP cache and detects an already waiting release', async () => {
  const worker = new Worker('installed');
  const f = fixture({ waiting: worker });
  await f.manager.start();
  assert.equal(f.options.updateViaCache, 'none');
  assert.equal(f.changes.at(-1).waiting, true);
  assert.deepEqual(worker.messages, []);
  f.manager.apply();
  assert.deepEqual(worker.messages, [{ type: 'ACTIVATE_UPDATE' }]);
});

test('update check handles installed state before registration.waiting is populated', async () => {
  const f = fixture();
  const worker = new Worker('installing');
  f.registration.update = async () => {
    f.registration.installing = worker;
    f.registration.dispatchEvent(new Event('updatefound'));
    setTimeout(() => { worker.transition('installed'); f.registration.installing = null; }, 0);
  };
  await f.manager.start(); await f.manager.check();
  assert.equal(f.changes.at(-1).waiting, true);
  assert.equal(f.changes.at(-1).checking, false);
  assert.equal(f.changes.at(-1).ready, true);
  f.manager.apply();
  assert.equal(worker.messages.length, 1);
});

test('existing tabs reload once on controller changes, including updates accepted in another tab', async () => {
  const f = fixture(); await f.manager.start();
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(f.reloads, 1);
});

test('first installation claims the page without a reload loop', async () => {
  const f = fixture({ controlled: false }); await f.manager.start();
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(f.reloads, 0); assert.equal(f.changes.at(-1).ready, true);
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(f.reloads, 1);
});

test('offline update failures preserve readiness and release the checking button', async () => {
  const f = fixture(); await f.manager.start();
  f.registration.update = async () => { throw new Error('Offline'); };
  await f.manager.check();
  assert.equal(f.changes.at(-1).checking, false);
  assert.equal(f.changes.at(-1).ready, true);
  assert.ok(f.changes.some(state => state.message?.includes('keep playing offline')));
});

test('unchanged release reports up to date and does not force activation', async () => {
  const f = fixture(); await f.manager.start(); await f.manager.check(); f.manager.apply();
  assert.ok(f.changes.some(state => state.message === 'You’re up to date.'));
  assert.equal(f.reloads, 0);
});
