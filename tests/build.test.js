import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

test('release packaging is repeatable, excludes development files, and versions asset changes', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'antidote-build-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const source = join(temporary, 'source');
  const output = join(temporary, 'site');
  // A real release gives this fixture exactly the publicly shipped files.
  await buildSite(undefined, source);
  await writeFile(join(source, 'private-development-note.txt'), 'Not a website asset');
  await cp(new URL('../sw.js', import.meta.url), join(source, 'sw.js'));
  const originalWorker = await readFile(join(source, 'sw.js'), 'utf8');
  const first = await buildSite(source, output);
  const files = await readdir(output);
  assert.ok(files.includes('.nojekyll'));
  assert.ok(files.includes('manifest.json'));
  assert.ok(!files.includes('private-development-note.txt'));
  assert.ok(!files.includes('tests'));
  assert.ok(!files.includes('.github'));
  assert.match(await readFile(join(output, 'sw.js'), 'utf8'), new RegExp(`const VERSION = '${first.version}';`));
  assert.equal(await readFile(join(source, 'sw.js'), 'utf8'), originalWorker);
  assert.equal((await buildSite(source, output)).version, first.version);
  await writeFile(join(source, 'styles.css'), 'body { background: green; }');
  assert.notEqual((await buildSite(source, output)).version, first.version);
});
