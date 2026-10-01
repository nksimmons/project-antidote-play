import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, access } from 'node:fs/promises';

const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const version = source.match(/const VERSION = '([^']+)'/)[1];
function worker({ failInstall = false } = {}) {
  const events = {};
  const deleted = [];
  const requests = [];
  const cachedResponse = new Response('cached release');
  let claimed = false;
  let skipped = false;
  let network = 0;
  const context = {
    URL, Request,
    self: {
      location: { href: 'https://example.test/arcade/sw.js' },
      addEventListener: (type, handler) => { events[type] = handler; },
      clients: { claim: async () => { claimed = true; } },
      skipWaiting: () => { skipped = true; },
    },
    caches: {
      open: async () => ({
        addAll: async list => { requests.push(...list); if (failInstall) throw new Error('Network unavailable'); },
        match: async () => cachedResponse,
      }),
      keys: async () => ['antidote-%2Farcade%2F-v0', `antidote-%2Farcade%2F-${version}`, 'antidote-%2Fother%2F-v0', 'unrelated-cache'],
      delete: async key => { deleted.push(key); },
    },
    fetch: async () => { network++; return new Response('network'); },
  };
  vm.runInNewContext(source, context);
  return { events, requests, deleted, get claimed() { return claimed; }, get skipped() { return skipped; }, get network() { return network; } };
}

test('install precaches every shipped asset using deployment-relative URLs', async () => {
  const sw = worker();
  let task;
  sw.events.install({ waitUntil: promise => { task = promise; } });
  await task;
  assert.equal(sw.requests.length, 29);
  for (const request of sw.requests) {
    assert.equal(request.cache, 'reload');
    assert.ok(request.url.startsWith('https://example.test/arcade/'));
    const path = new URL(request.url).pathname.replace('/arcade/', '');
    await access(new URL(`../${path || 'index.html'}`, import.meta.url));
  }
  assert.equal(sw.skipped, false);
});

test('failed precaching rejects installation without deleting the existing release', async () => {
  const sw = worker({ failInstall: true });
  let task;
  sw.events.install({ waitUntil: promise => { task = promise; } });
  await assert.rejects(task, /Network unavailable/);
  assert.deepEqual(sw.deleted, []);
  assert.equal(sw.skipped, false);
});

test('activation cleans only old versions for this deployment and claims clients', async () => {
  const sw = worker();
  let task;
  sw.events.activate({ waitUntil: promise => { task = promise; } });
  await task;
  assert.deepEqual(sw.deleted, ['antidote-%2Farcade%2F-v0']);
  assert.equal(sw.claimed, true);
});

test('known assets are served from cache including query variants', async () => {
  const sw = worker();
  let response;
  sw.events.fetch({ request: new Request('https://example.test/arcade/games/2048/game.js?v=1'), respondWith: promise => { response = promise; } });
  assert.equal(await (await response).text(), 'cached release');
  assert.equal(sw.network, 0);
});

test('unknown URLs, other origins, and writes are never intercepted', () => {
  const sw = worker();
  for (const request of [
    new Request('https://example.test/arcade/unknown'),
    new Request('https://example.test/other/index.html'),
    new Request('https://external.test/arcade/index.html'),
    new Request('https://example.test/arcade/index.html', { method: 'POST' }),
  ]) sw.events.fetch({ request, respondWith: () => assert.fail('Unexpected cache interception') });
});

test('updates activate early only on an explicit activation message', () => {
  const sw = worker();
  sw.events.message({ data: { type: 'UNRELATED' } });
  assert.equal(sw.skipped, false);
  sw.events.message({ data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(sw.skipped, true);
});
