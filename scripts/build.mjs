import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = ['index.html', 'styles.css', 'app.js', 'manifest.json', 'sw.js', 'icons', 'games', 'LICENSE'];

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported release asset: ${path}`);
  }
  return files.sort();
}

export async function buildSite(source = root, output = join(root, 'dist')) {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const asset of assets) await cp(join(source, asset), join(output, asset), { recursive: true });
  await writeFile(join(output, '.nojekyll'), '');

  // Change the worker on every asset change, even when its source is untouched.
  // This prevents installed cache-first clients from being stuck on old games.
  const hash = createHash('sha256');
  const files = await listFiles(output);
  for (const file of files) {
    hash.update(file).update('\0').update(await readFile(join(output, file))).update('\0');
  }
  const version = `release-${hash.digest('hex').slice(0, 16)}`;
  const workerPath = join(output, 'sw.js');
  const worker = await readFile(workerPath, 'utf8');
  const versionDeclaration = /^const VERSION = '[^']+';$/m;
  if (!versionDeclaration.test(worker)) throw new Error('Cannot locate the service worker release version.');
  await writeFile(workerPath, worker.replace(versionDeclaration, `const VERSION = '${version}';`));
  return { version, files: files.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildSite();
  console.log(`Built ${result.files} static files in dist/ (${result.version}).`);
}
