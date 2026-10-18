import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { digest } from './cloudData.js';
import { canonical } from './cloudPipeline.js';
import { privateDirectory, privateJson } from './cloudStorage.js';
import { maintenanceContext } from './maintenanceContext.js';

export const bytesHash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export type RunRequest = { operation: 'contracts' | 'stats' | 'teams'; season: string; asOf: string; inventory: Record<string, any> };
type Result = { status: 'processed' | 'no-games' | 'fallback' | 'missing' | 'failed' | 'withheld'; files: { path: string; sha256: string; bytes: number }[] };
export async function openMaintenanceRun(dir: string, request: RunRequest, resume: boolean) {
  maintenanceContext(request.season, request.asOf);
  const requestSha256 = digest(canonical(request));
  if (!Object.keys(request.inventory).length || Object.keys(request.inventory).some(id => !/^[\p{L}\p{M}\p{N}_-]+$/u.test(id))) throw new Error('Explicit nonempty inventory required');
  const manifestPath = path.join(dir, 'run.json');
  let results: Record<string, Result> = {};
  let captureStartedAt: string | null = new Date().toISOString();
  if (resume) {
    const old = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (old.version !== 1 || old.requestSha256 !== requestSha256) throw new Error('Resume input generation, inventory or season changed');
    results = old.results; captureStartedAt = old.captureStartedAt || null;
  } else {
    await privateDirectory(dir);
    await writeFile(manifestPath, JSON.stringify({ version: 1, requestSha256, request, captureStartedAt, results }), { mode: 0o600, flag: 'wx' });
  }
  async function verified(id: string) {
    const result = results[id];
    if (!result || !['processed', 'no-games', 'fallback'].includes(result.status)) return false;
    for (const file of result.files) {
      if (path.isAbsolute(file.path) || file.path.split('/').some(p => !p || p === '..' || p === '.')) throw new Error('Unsafe run output');
      const target = path.join(dir, file.path);
      if (!(await lstat(target)).isFile()) throw new Error('Run output is not a regular file');
      const bytes = await readFile(target);
      if (bytesHash(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error('Resume output generation changed');
    }
    return true;
  }
  async function record(id: string, status: Result['status'], files: string[]) {
    if (!(id in request.inventory)) throw new Error('Unexpected run member');
    const artifacts = [];
    for (const file of files) {
      const bytes = await readFile(path.join(dir, file));
      artifacts.push({ path: file, sha256: bytesHash(bytes), bytes: bytes.length });
    }
    results[id] = { status, files: artifacts };
    await privateJson(manifestPath, { version: 1, requestSha256, request, captureStartedAt, results });
  }
  function coverage() {
    const count = (status: Result['status']) => Object.values(results).filter(v => v.status === status).length;
    const missing = Object.keys(request.inventory).filter(id => !results[id]);
    return { expected: Object.keys(request.inventory).length, processed: count('processed'), noGames: count('no-games'),
      fallback: count('fallback'), missing: count('missing') + missing.length, failed: count('failed'), withheld: count('withheld'),
      complete: !missing.length && Object.values(results).every(v => ['processed', 'no-games', 'fallback'].includes(v.status)),
      requestSha256 };
  }
  return { verified, record, coverage, captureStartedAt };
}
