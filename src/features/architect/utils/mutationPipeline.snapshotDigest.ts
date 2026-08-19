/** Stable compare-before-write digest for raw Firestore mutation documents. */

import { deterministicStateDigest } from '@/features/architect/utils/contractSource';

function toDigestMaterial(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toDigestMaterial);
  if (typeof value === 'object') {
    const timestamp = value as { toDate?: () => Date };
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, toDigestMaterial(entry)])
    );
  }
  throw new Error(`Mutation snapshot cannot contain ${typeof value}.`);
}

export function mutationSnapshotDigest(value: unknown): string {
  return deterministicStateDigest(toDigestMaterial(value));
}
