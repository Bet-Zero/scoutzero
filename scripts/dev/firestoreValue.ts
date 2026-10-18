/** Canonical REST representation of identical stored Firestore values, without decoding their types. */
import { digest } from './cloudData.js';
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function canonicalFirestore(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalFirestore);
  if ('nullValue' in value) return { nullValue: 'NULL_VALUE' };
  if ('mapValue' in value) return { mapValue: { fields: canonicalFirestore(value.mapValue.fields || {}) } };
  if ('arrayValue' in value) return { arrayValue: { values: (value.arrayValue.values || []).map(canonicalFirestore) } };
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, canonicalFirestore(item)]));
}
export const firestoreFieldHash = (fields: unknown) => digest(canonical(fields === undefined ? { absentFirestoreField: true } : canonicalFirestore(fields)));
