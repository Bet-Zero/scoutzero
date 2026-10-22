/** Offline preparation only. No Firestore client, credential or write capability. */
import { isDeepStrictEqual } from 'node:util';
import { DraftSourceRevisionZ } from '../../src/schemas/draftSourceBaseline.js';
import {
  readDraftSourceForWorld,
  assertDraftRevisionFields,
  DRAFT_SOURCE_VERSION,
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

/** Exact initial-proof addition. Existing production rules are never templated. */
export function draftSourceReadRuleAddition(
  entitlementId: string,
  pickId: string
): string {
  if (![entitlementId, pickId].every((id) => /^[A-Za-z0-9:_-]+$/.test(id))) {
    throw new Error('DRAFT_SOURCE_RULE_ID');
  }
  return `
    // BZE-321 bounded source review: authenticated, approved IDs only.
    match /${ARCHITECT_BASE_ENTITLEMENTS_PATH}/{sourceId} {
      allow get, list: if request.auth != null && sourceId == '${entitlementId}';
      allow write: if false;
    }
    match /${ARCHITECT_BASE_PICK_RULES_PATH}/{sourceId} {
      allow get, list: if request.auth != null && sourceId == '${pickId}';
      allow write: if false;
    }
`;
}

/** Compile and permission tests on the exact private bytes remain mandatory. */
export function verifyDraftSourceReadRuleAddition(
  baseline: string,
  proposed: string,
  entitlementId: string,
  pickId: string
): void {
  const addition = draftSourceReadRuleAddition(entitlementId, pickId);
  const index = proposed.indexOf(addition);
  if (
    index < 0 ||
    proposed.indexOf(addition, index + 1) !== -1 ||
    baseline.includes('BZE-321 bounded source review:') ||
    proposed.slice(0, index) + proposed.slice(index + addition.length) !==
      baseline
  ) {
    throw new Error('DRAFT_SOURCE_RULES_NOT_ADDITIVE');
  }
}

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
      (change.kind === 'entitlement' && change.before?.id !== id) ||
      (change.kind === 'pickRule' && change.after.pickId !== id)
    ) {
      throw new Error('DRAFT_SOURCE_DOCUMENT_IDENTITY');
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

/** Append a qualified immutable revision without replacing ANY legacy root field. */
export function preserveDraftSourceBaseline(
  before: Record<string, unknown> | null,
  desired: Record<string, unknown>,
  kind: DraftSourceKind
): { after: Record<string, unknown>; updateMask: string[] } {
  if (
    Object.hasOwn(desired, 'draftSourceRevisions') &&
    !isDeepStrictEqual(
      desired.draftSourceRevisions,
      before?.draftSourceRevisions
    )
  ) {
    throw new Error('DRAFT_REVISION_OVERWRITE_REJECTED');
  }
  const legacy = { ...(before ?? {}) };
  delete legacy.draftSourceRevisions;
  const current = { ...desired };
  delete current.draftSourceRevisions;
  if (Object.keys(legacy).some((key) => !Object.hasOwn(current, key))) {
    throw new Error('DRAFT_SOURCE_FIELD_DELETION_REJECTED');
  }
  const revisions =
    before && Object.hasOwn(before, 'draftSourceRevisions')
      ? DraftSourceRevisionZ.parse(before.draftSourceRevisions)
      : {
          schemaVersion: 1 as const,
          legacyExists: before !== null,
          versions: {},
        };
  const fields = Object.fromEntries(
    Object.entries(current).filter(
      ([key, value]) => !isDeepStrictEqual(legacy[key], value)
    )
  );
  assertDraftRevisionFields(fields, kind, revisions.legacyExists);
  if (
    revisions.versions[DRAFT_SOURCE_VERSION] &&
    !isDeepStrictEqual(revisions.versions[DRAFT_SOURCE_VERSION], fields)
  ) {
    throw new Error('IMMUTABLE_DRAFT_REVISION_CONFLICT');
  }
  const result = {
    ...legacy,
    draftSourceRevisions: {
      ...revisions,
      versions: { ...revisions.versions, [DRAFT_SOURCE_VERSION]: fields },
    },
  };
  if (
    !isDeepStrictEqual(readDraftSourceForWorld(result, null, kind), current) ||
    !isDeepStrictEqual(
      readDraftSourceForWorld(result, 'saved-world', kind),
      revisions.legacyExists ? legacy : null
    )
  ) {
    throw new Error('DRAFT_SOURCE_PRESERVATION_MISMATCH');
  }
  return { after: result, updateMask: ['draftSourceRevisions'] };
}
