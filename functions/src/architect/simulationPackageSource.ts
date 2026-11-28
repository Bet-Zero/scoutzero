/**
 * Where a SIMULATION package comes from (V1 item D2, built switched off).
 *
 * - Local demo emulator: a private file named by `<PREFIX>_FILE`.
 * - Live: a private Cloud Storage object named by `<PREFIX>_OBJECT`
 *   (gs://bucket/path), or a private Firestore release document when
 *   `SCOUTZERO_SIMULATION_PACKAGE_SOURCE=firestore`. Both require the live
 *   switch. The runtime reads the release by its pin through the Admin SDK.
 *
 * Either way the bytes must match the pinned `<PREFIX>_SHA256` digest.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
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
export const PRIVATE_PACKAGES_COLLECTION = 'architect_privateSimulationPackages';
const MAX_COMPRESSED_BYTES = 1_000_000;
const MAX_RELEASE_BYTES = 32 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;

export type ReadStorageObject = (
  bucket: string,
  path: string
) => Promise<Buffer>;
type ReadFirestorePackage = (documentId: string) => Promise<unknown>;

export function isSimulationLiveEnabled(env = process.env): boolean {
  return env.SCOUTZERO_SIMULATION_LIVE === 'true';
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

const readFromFirestore: ReadFirestorePackage = async (documentId) => {
  const document = await admin.firestore()
    .collection(PRIVATE_PACKAGES_COLLECTION)
    .doc(documentId)
    .get();
  return document.data()?.brotli;
};

/** Verified package bytes, or null when no package is configured or live. */
export async function readSimulationPackageBytes(
  kind: SimulationPackageKind,
  readObject: ReadStorageObject = readFromStorage,
  readFirestore: ReadFirestorePackage = readFromFirestore,
  env = process.env
): Promise<Buffer | null> {
  const prefix = PREFIX[kind];
  const label = LABEL[kind];
  const file = env[`${prefix}_FILE`];
  const object = env[`${prefix}_OBJECT`];
  const firestore = env.SCOUTZERO_SIMULATION_PACKAGE_SOURCE === 'firestore';
  const pinned = env[`${prefix}_SHA256`] ?? '';
  if (!file && !object && !firestore) return null;
  if (file && object)
    throw new Error(`${label} input names both a local file and an object.`);
  if (firestore && (file || object))
    throw new Error(`${label} input names more than one source.`);
  let bytes: Buffer;
  if (file) {
    if (!isLocalDemoEmulator())
      throw new Error(`${label} inputs require the local demo emulator.`);
    bytes = readFileSync(file);
  } else if (firestore) {
    if (!isSimulationLiveEnabled(env)) return null;
    if (!SHA256.test(pinned)) throw new Error(`${label} input digest mismatch.`);
    const compressed = await readFirestore(`${kind}-${pinned}`);
    if (!Buffer.isBuffer(compressed) || compressed.length > MAX_COMPRESSED_BYTES)
      throw new Error(`${label} Firestore release is missing or invalid.`);
    try {
      bytes = brotliDecompressSync(compressed, { maxOutputLength: MAX_RELEASE_BYTES });
    } catch {
      throw new Error(`${label} Firestore release could not be decompressed.`);
    }
  } else {
    if (!isSimulationLiveEnabled(env)) return null;
    const match = /^gs:\/\/([a-z0-9][a-z0-9._-]*)\/(.+)$/.exec(object ?? '');
    if (!match)
      throw new Error(`${label} object must be a gs://bucket/path name.`);
    bytes = await readObject(match[1], match[2]);
  }
  if (
    !SHA256.test(pinned) ||
    createHash('sha256').update(bytes).digest('hex') !== pinned
  )
    throw new Error(`${label} input digest mismatch.`);
  return bytes;
}
