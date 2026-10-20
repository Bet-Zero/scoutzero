/** Source generations and disposable test sessions have separate lifetimes. */
import { cp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { privateDirectory, privateJson } from './cloudStorage.js';

export function runtimeDirectory(sourceDir: string, sha256: string) {
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid runtime baseline');
  return path.resolve(sourceDir, 'sessions', sha256);
}

export async function prepareRuntime(sourceDir: string, sha256: string) {
  const dir = runtimeDirectory(sourceDir, sha256);
  await privateDirectory(path.join(sourceDir, 'sessions'));
  await privateDirectory(dir);
  const manifest = path.join(dir, 'session.json');
  if (!existsSync(manifest)) {
    // One-time adoption of BZE-322 state, only when it names this exact source.
    let marker: { sha256?: string } = {};
    try { marker = JSON.parse(await readFile(path.join(sourceDir, 'state-source.json'), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Existing runtime marker is invalid'); }
    if (marker.sha256 === sha256) {
      for (const name of ['state', 'state-source.json', 'proof.json', 'browser-state.json', 'saved-list.png', 'resumed-list.png']) {
        const from = path.join(sourceDir, name);
        if (existsSync(from)) await cp(from, path.join(dir, name), { recursive: true, errorOnExist: true, force: false });
      }
    }
    await privateJson(manifest, { version: 1, sourceSha256: sha256, createdAt: new Date().toISOString(), isolatedProject: 'demo-architect-review' });
  }
  return dir;
}
