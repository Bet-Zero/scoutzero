/** Private, immutable recovery objects in the existing Google project. No database writer. */
import { applicationDefault } from 'firebase-admin/app';
import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { privateDirectory } from './cloudStorage.js';
import { CLOUD_DATA_PROJECT_NUMBER, CLOUD_DATA_BUCKET } from './cloudAccessPolicy.js';

export const RECOVERY_PROJECT_NUMBER = CLOUD_DATA_PROJECT_NUMBER;
export const RECOVERY_PREFIX = 'scoutzero-cloud-development/v1/';
export const DEFAULT_RECOVERY_BUCKET = CLOUD_DATA_BUCKET;
export const bytesHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export type RecoveryStore = {
  kind: 'gcs' | 'local-diagnostic';
  location: string;
  assertPrivate(): Promise<void>;
  get(key: string): Promise<Buffer>;
  put(key: string, bytes: Buffer): Promise<void>;
};
const MAX_FILE_BYTES = 268435456;
function assertKey(key: string) {
  if (!/^(blobs\/[a-f0-9]{64}|manifests\/[a-f0-9]{64}\.json)$/.test(key)) throw new Error('Invalid recovery object identity');
}
function assertObject(key: string, bytes: Buffer) {
  assertKey(key);
  if (bytes.length > MAX_FILE_BYTES || key.split('/')[1].replace(/\.json$/, '') !== bytesHash(bytes)) throw new Error('Recovery object identity or size mismatch');
}
export function assertRecoveryBucket(metadata: any, bucket: string) {
  if (!/^[a-z0-9][a-z0-9.-]{2,220}[a-z0-9]$/.test(bucket) || bucket.endsWith('.appspot.com') || bucket.endsWith('.firebasestorage.app') ||
      metadata.name !== bucket || String(metadata.projectNumber) !== RECOVERY_PROJECT_NUMBER ||
      metadata.iamConfiguration?.publicAccessPrevention !== 'enforced' || metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true) {
    throw new Error('Recovery requires a private uniform-access bucket in the existing ScoutZero project; app buckets are excluded');
  }
}
export async function googleRecoveryStore(bucket: string, request: typeof fetch = fetch, accessToken?: () => Promise<string>): Promise<RecoveryStore> {
  // Validate the name before using it in a URL or attempting authentication.
  if (!/^[a-z0-9][a-z0-9.-]{2,220}[a-z0-9]$/.test(bucket) || bucket.includes('..')) throw new Error('Invalid recovery bucket');
  const credential = applicationDefault();
  const send = async (url: string, init: RequestInit = {}) => {
    let token: string;
    try { token = accessToken ? await accessToken() : (await credential.getAccessToken()).access_token; }
    catch { throw new Error('No renewable Google identity is configured for source reads and private recovery'); }
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try { response = await request(url, { ...init, redirect: 'error', headers: { ...init.headers, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(120000) }); }
      catch { if (attempt === 3) throw new Error('Private recovery network request failed'); await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt)); continue; }
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) return response;
      await response.body?.cancel(); await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  };
  const objectUrl = (key: string) => {
    assertKey(key);
    return 'https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(bucket) + '/o/' + encodeURIComponent(RECOVERY_PREFIX + key) + '?alt=media';
  };
  const get = async (key: string) => {
    const response = await send(objectUrl(key));
    if (!response.ok) throw new Error('Private recovery object read failed: HTTP ' + response.status);
    if (Number(response.headers.get('content-length')) > 268435456) throw new Error('Recovery object exceeds the supported per-file limit');
    const chunks: Uint8Array[] = []; let count = 0;
    for await (const chunk of response.body as any as AsyncIterable<Uint8Array>) {
      count += chunk.length; if (count > 268435456) throw new Error('Recovery object exceeds the supported per-file limit'); chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  };
  return {
    kind: 'gcs', location: 'gs://' + bucket + '/' + RECOVERY_PREFIX,
    async assertPrivate() {
      const response = await send('https://storage.googleapis.com/storage/v1/b/' + encodeURIComponent(bucket));
      if (!response.ok) throw new Error('Private recovery bucket metadata unavailable: HTTP ' + response.status);
      assertRecoveryBucket(await response.json(), bucket);
      // Firebase rules are a separate access path. Do not put recovery data in
      // a Firebase-registered bucket, even if its Google IAM policy is private.
      const firebase = await send('https://firebasestorage.googleapis.com/v1beta/projects/' + RECOVERY_PROJECT_NUMBER + '/buckets/' + encodeURIComponent(bucket));
      if (firebase.status !== 404 || (await firebase.json()).error?.status !== 'NOT_FOUND') throw new Error('Cannot establish that recovery storage is separate from Firebase app storage');
    },
    get,
    async put(key, bytes) {
      assertObject(key, bytes);
      const response = await send('https://storage.googleapis.com/upload/storage/v1/b/' + encodeURIComponent(bucket) + '/o?uploadType=media&ifGenerationMatch=0&name=' + encodeURIComponent(RECOVERY_PREFIX + key),
        { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(bytes) });
      if (!response.ok && response.status !== 412) throw new Error('Immutable recovery upload failed: HTTP ' + response.status);
      // Existing objects are never overwritten. Verify both a new upload and
      // an idempotent retry by reading the remote bytes, not a local receipt.
      if (!bytes.equals(await get(key))) throw new Error('Remote recovery object has conflicting bytes');
    },
  };
}

/** Diagnostic only: this cannot produce an off-workspace durability claim. */
export async function localRecoveryStore(root: string): Promise<RecoveryStore> {
  try { if ((await lstat(root)).isSymbolicLink()) throw new Error('Recovery store cannot be a link'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await privateDirectory(root);
  if (!(await lstat(root)).isDirectory() || (await lstat(root)).isSymbolicLink()) throw new Error('Recovery store must be a real private directory');
  const file = async (key: string) => {
    assertKey(key); const dir = path.join(root, key.split('/')[0]);
    try { if ((await lstat(dir)).isSymbolicLink()) throw new Error('Recovery store directories cannot be links'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await privateDirectory(dir);
    if (!(await lstat(dir)).isDirectory() || (await lstat(dir)).isSymbolicLink()) throw new Error('Recovery store directories cannot be links');
    return path.join(root, key);
  };
  return { kind: 'local-diagnostic', location: path.resolve(root), async assertPrivate() {},
    async get(key) { const target = await file(key); if (!(await lstat(target)).isFile()) throw new Error('Recovery object must be a regular file'); return readFile(target); },
    async put(key, bytes) { assertObject(key, bytes); const target = await file(key); try { await writeFile(target, bytes, { mode: 0o600, flag: 'wx' }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; if (!(await lstat(target)).isFile() || !bytes.equals(await readFile(target))) throw new Error('Recovery object has conflicting bytes'); } },
  };
}
