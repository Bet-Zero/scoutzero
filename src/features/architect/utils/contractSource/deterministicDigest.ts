/** Deterministic JSON and digest helpers shared by governed contract sources. */

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

export function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(
        'Canonical contract data cannot contain a non-finite number.'
      );
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalStringify(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(
        'Canonical contract data must contain only plain objects.'
      );
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort(compareCodePoints)
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
      .join(',')}}`;
  }
  throw new Error(`Canonical contract data cannot contain ${typeof value}.`);
}

export function deterministicStateDigest(value: unknown): string {
  const bytes = new TextEncoder().encode(canonicalStringify(value));
  let hash = FNV_OFFSET;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

export async function sha256Digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const browserSubtle = globalThis.crypto?.subtle;
  let digest: ArrayBuffer;
  if (browserSubtle) {
    digest = await browserSubtle.digest('SHA-256', bytes);
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    const { webcrypto } = await import('node:crypto');
    digest = await webcrypto.subtle.digest('SHA-256', bytes);
  } else {
    throw new Error('SHA-256 verification is unavailable in this runtime.');
  }
  return `sha256:${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}
