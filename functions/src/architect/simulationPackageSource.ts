/**
 * Where a SIMULATION package comes from (V1 item D2, built switched off).
 *
 * - Local demo emulator: a private file named by `<PREFIX>_FILE`.
 * - Live: a private Cloud Storage object named by `<PREFIX>_OBJECT`
 *   (gs://bucket/path), read only when `SCOUTZERO_SIMULATION_LIVE` is
 *   exactly "true". Without that switch a configured object is ignored, so
 *   deploying this code changes nothing.
 *
 * Either way the bytes must match the pinned `<PREFIX>_SHA256` digest.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';

export type SimulationPackageKind = 'financial' | 'draft';
const PREFIX: Record<SimulationPackageKind, string> = {
  financial: 'SCOUTZERO_SIMULATION_FINANCIAL',
  draft: 'SCOUTZERO_SIMULATION_DRAFT',
};
const LABEL: Record<SimulationPackageKind, string> = {
  financial: 'Simulation financial',
  draft: 'Simulation draft',
};

export type ReadStorageObject = (
  bucket: string,
  path: string
) => Promise<Buffer>;

export function isSimulationLiveEnabled(): boolean {
  return process.env.SCOUTZERO_SIMULATION_LIVE === 'true';
}

function isLocalDemoEmulator(): boolean {
  return (
    process.env.FUNCTIONS_EMULATOR === 'true' &&
    (process.env.GCLOUD_PROJECT ?? '').startsWith('demo-') &&
    /^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
  );
}

const readFromStorage: ReadStorageObject = async (bucket, path) => {
  const [bytes] = await admin.storage().bucket(bucket).file(path).download();
  return bytes;
};

/** Verified package bytes, or null when no package is configured or live. */
export async function readSimulationPackageBytes(
  kind: SimulationPackageKind,
  readObject: ReadStorageObject = readFromStorage
): Promise<Buffer | null> {
  const prefix = PREFIX[kind];
  const label = LABEL[kind];
  const file = process.env[`${prefix}_FILE`];
  const object = process.env[`${prefix}_OBJECT`];
  if (!file && !object) return null;
  if (file && object)
    throw new Error(`${label} input names both a local file and an object.`);
  let bytes: Buffer;
  if (file) {
    if (!isLocalDemoEmulator())
      throw new Error(`${label} inputs require the local demo emulator.`);
    bytes = readFileSync(file);
  } else {
    if (!isSimulationLiveEnabled()) return null;
    const match = /^gs:\/\/([a-z0-9][a-z0-9._-]*)\/(.+)$/.exec(object ?? '');
    if (!match)
      throw new Error(`${label} object must be a gs://bucket/path name.`);
    bytes = await readObject(match[1], match[2]);
  }
  const pinned = process.env[`${prefix}_SHA256`] ?? '';
  if (
    !/^[0-9a-f]{64}$/.test(pinned) ||
    createHash('sha256').update(bytes).digest('hex') !== pinned
  )
    throw new Error(`${label} input digest mismatch.`);
  return bytes;
}
