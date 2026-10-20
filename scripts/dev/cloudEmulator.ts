/** Official emulator pin: older releases reject the existing 8 MB world batch. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VERSION = '1.22.0';
const SHA256 = '9b6498b7f62714d67f48f59b3818883cd682dbcd46b9f59511de81c97bb5166c';
const SIZE = 136707194;
export async function ensureCloudFirestoreEmulator(download = false) {
  const file = path.resolve('.scoutzero-dev/tools/emulators/cloud-firestore-emulator-v' + VERSION + '.jar');
  const valid = (bytes: Buffer) => bytes.length === SIZE && createHash('sha256').update(bytes).digest('hex') === SHA256;
  try { if (valid(await readFile(file))) return file; } catch { /* Setup downloads missing artifacts. */ }
  if (!download) throw new Error('Verified Firestore emulator missing or corrupt; run cloud:setup');
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = file + '.' + process.pid + '.tmp';
  try {
    const response = await fetch('https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v' + VERSION + '.jar', { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error('Official Firestore emulator download failed: ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!valid(bytes)) throw new Error('Official Firestore emulator integrity check failed');
    await writeFile(temporary, bytes, { mode: 0o600 });
    await rename(temporary, file);
    return file;
  } finally { await rm(temporary, { force: true }); }
}
