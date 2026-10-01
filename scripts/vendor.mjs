// Optional maintenance command. Normal builds use the checked-in assets.
import { mkdtemp, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'antidote-vendor-'));
try {
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, dependencies: {
    trystero: '0.25.4', '@trystero-p2p/core': '0.25.4', '@trystero-p2p/nostr': '0.25.4',
    '@noble/secp256k1': '3.2.0', 'qrcode-generator': '1.4.4', esbuild: '0.25.12',
  } }));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit' });
  const { build } = await import(pathToFileURL(join(directory, 'node_modules/esbuild/lib/main.js')));
  const output = new URL('../games/multiplayer/vendor/', import.meta.url);
  await build({ entryPoints: [join(directory, 'node_modules/trystero/dist/index.mjs')], bundle: true, format: 'esm', minify: true, legalComments: 'inline', outfile: fileURLToPath(new URL('trystero.js', output)) });
  await cp(join(directory, 'node_modules/qrcode-generator/qrcode.js'), new URL('qrcode.js', output));
  console.log('Vendored pinned WebRTC and QR assets. Review licenses when changing versions.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
