/** Retain public foundation responses privately with their actual capture time. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function retainFoundationSource(outputDir: string, url: string, body: Uint8Array) {
  const dir = path.join(outputDir, 'raw');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const capturedAt = new Date().toISOString();
  const name = randomUUID();
  const bytes = Buffer.from(body);
  writeFileSync(path.join(dir, name + '.body'), bytes, { mode: 0o600, flag: 'wx' });
  writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ url, capturedAt,
    file: name + '.body', bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2), { mode: 0o600, flag: 'wx' });
}
