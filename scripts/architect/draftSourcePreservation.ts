/** Offline preparation only. No Firestore client, credential or write capability. */
import { isDeepStrictEqual } from 'node:util';
import { DraftSourceBaselineZ } from '../../src/schemas/draftSourceBaseline.js';
import {
  readDraftSourceForWorld,
  type DraftSourceKind,
} from '../../src/features/architect/utils/entitlements/draftSourceBaseline.js';
import {
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
  ARCHITECT_BASE_PICK_RULES_PATH,
  ARCHITECT_BASE_TEAMS_PATH,
} from '../../src/constants/collections.js';

type FirestoreValue =
  | { nullValue: null }
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function encode(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isSafeInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(encode) } };
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, encode(item)])
        ),
      },
    };
  }
  throw new Error('DRAFT_SOURCE_VALUE_REJECTED');
}

export type DraftSourcePreparedChange = {
  path: string;
  kind: DraftSourceKind;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  updateTime?: string;
};

/**
 * Produce one atomic commit BODY for later, separately authorized publication.
 * No endpoint/caller is provided. Existing records carry updateTime guards and
 * draft-only masks; absent records carry exists:false. No deletes or transforms.
 * Evidence qualification and exact owner approval remain mandatory outside this
 * mechanical builder. It is not a credentialed publication entry point.
 */
export function prepareDraftSourceCommit(changes: DraftSourcePreparedChange[]) {
  const collections = {
    team: ARCHITECT_BASE_TEAMS_PATH,
    entitlement: ARCHITECT_BASE_ENTITLEMENTS_PATH,
    pickRule: ARCHITECT_BASE_PICK_RULES_PATH,
  };
  if (
    !changes.length ||
    changes.length > 500 ||
    new Set(changes.map((c) => c.path)).size !== changes.length
  ) {
    throw new Error('DRAFT_SOURCE_COMMIT_SCOPE');
  }
  const writes = changes.map((change) => {
    const [collection, id, extra] = change.path.split('/');
    if (
      collection !== collections[change.kind] ||
      !id ||
      extra !== undefined ||
      !/^[A-Za-z0-9:_-]+$/.test(id)
    ) {
      throw new Error('DRAFT_SOURCE_COMMIT_PATH');
    }
    if (
      change.before &&
      (!change.updateTime ||
        !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(change.updateTime) ||
        !Number.isFinite(Date.parse(change.updateTime)))
    ) {
      throw new Error('DRAFT_SOURCE_UPDATE_TIME_REQUIRED');
    }
    const prepared = preserveDraftSourceBaseline(
      change.before,
      change.after,
      change.kind
    );
    const fields = change.before
      ? Object.fromEntries(
          prepared.updateMask.map((key) => [key, prepared.after[key]])
        )
      : prepared.after;
    return {
      update: {
        name: `projects/scoutzero-bf1ae/databases/(default)/documents/${change.path}`,
        fields: Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [key, encode(value)])
        ),
      },
      ...(change.before
        ? { updateMask: { fieldPaths: prepared.updateMask } }
        : {}),
      currentDocument: change.before
        ? { updateTime: change.updateTime! }
        : { exists: false as const },
    };
  });
  return { writes };
}

/** Preserve the FIRST pre-adoption value, including absence, for every changed field. */
export function preserveDraftSourceBaseline(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  kind: DraftSourceKind
): { after: Record<string, unknown>; updateMask: string[] } {
  if (
    Object.hasOwn(after, 'draftSourceBaseline') &&
    !isDeepStrictEqual(after.draftSourceBaseline, before?.draftSourceBaseline)
  ) {
    throw new Error('DRAFT_BASELINE_OVERWRITE_REJECTED');
  }
  if (before && Object.keys(before).some((key) => !Object.hasOwn(after, key))) {
    throw new Error('DRAFT_SOURCE_FIELD_DELETION_REJECTED');
  }
  const changed = Object.keys(after).filter(
    (key) =>
      key !== 'draftSourceBaseline' &&
      !isDeepStrictEqual(before?.[key], after[key])
  );
  const baseline =
    before && Object.hasOwn(before, 'draftSourceBaseline')
      ? DraftSourceBaselineZ.parse(before.draftSourceBaseline)
      : {
          schemaVersion: 1 as const,
          beforeExists: before !== null,
          fields: {},
        };
  const fields = { ...baseline.fields };
  if (baseline.beforeExists) {
    for (const key of changed) {
      if (!Object.hasOwn(fields, key)) {
        fields[key] =
          before && Object.hasOwn(before, key)
            ? { present: true, value: before[key] }
            : { present: false };
      }
    }
  }
  const result = { ...after, draftSourceBaseline: { ...baseline, fields } };
  const prior = readDraftSourceForWorld(result, 'saved-world', kind);
  const expected = before
    ? readDraftSourceForWorld(before, 'saved-world', kind)
    : null;
  if (!isDeepStrictEqual(prior, expected)) {
    throw new Error('DRAFT_SOURCE_PRESERVATION_MISMATCH');
  }
  return { after: result, updateMask: [...changed, 'draftSourceBaseline'] };
}
