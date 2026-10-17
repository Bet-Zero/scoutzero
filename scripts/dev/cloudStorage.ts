/** Private immutable generations, published through one atomic directory pointer. */
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readlink, rename, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function privateDirectory(dir: string) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
}

export async function privateJson(file: string, value: unknown) {
  await privateDirectory(path.dirname(file));
  const temporary = file + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
  await rename(temporary, file);
}

async function immutable(file: string, bytes: string) {
  try { await writeFile(file, bytes, { mode: 0o600, flag: 'wx' }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (await readFile(file, 'utf8') !== bytes) throw new Error('Retained baseline has conflicting bytes');
  }
}

export async function retainBaseline(snapshot: unknown, report: { sha256: string }, dir: string) {
  const bytes = JSON.stringify(snapshot);
  if (createHash('sha256').update(bytes).digest('hex') !== report.sha256) throw new Error('Baseline hash mismatch');
  const generations = path.join(dir, 'baselines');
  const generation = path.join(generations, report.sha256);
  await privateDirectory(dir);
  await privateDirectory(generations);
  await privateDirectory(generation);
  await immutable(path.join(generation, 'source.json'), bytes);
  await immutable(path.join(generation, 'coverage.json'), JSON.stringify(report, null, 2));
  await activateBaseline(dir, report.sha256);
}

export async function activateBaseline(dir: string, sha256: string) {
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid baseline identity');
  const generation = path.join(dir, 'baselines', sha256);
  const bytes = await readFile(path.join(generation, 'source.json'), 'utf8');
  const report = JSON.parse(await readFile(path.join(generation, 'coverage.json'), 'utf8'));
  if (createHash('sha256').update(bytes).digest('hex') !== sha256 || report.sha256 !== sha256) throw new Error('Baseline integrity mismatch');
  const pointer = path.join(dir, '.baseline-current');
  const next = pointer + '.' + randomUUID();
  await symlink(path.join('baselines', sha256), next);
  // The source/coverage pair becomes visible as one generation, never half a pair.
  await rename(next, pointer);
  for (const name of ['source.json', 'coverage.json']) {
    const alias = path.join(dir, name);
    let isAlias = false;
    try { isAlias = (await lstat(alias)).isSymbolicLink() && await readlink(alias) === '.baseline-current/' + name; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (!isAlias) {
      const link = alias + '.' + randomUUID();
      await symlink('.baseline-current/' + name, link);
      await rename(link, alias);
    }
  }
}

export async function readBaseline<T>(dir: string): Promise<{ snapshot: T; report: { sha256: string } }> {
  let source = dir;
  try {
    const target = await readlink(path.join(dir, '.baseline-current'));
    if (!/^baselines\/[a-f0-9]{64}$/.test(target)) throw new Error('Invalid baseline pointer');
    source = path.join(dir, target);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const [snapshot, report] = await Promise.all([
    readFile(path.join(source, 'source.json'), 'utf8'), readFile(path.join(source, 'coverage.json'), 'utf8'),
  ]);
  return { snapshot: JSON.parse(snapshot) as T, report: JSON.parse(report) };
}
