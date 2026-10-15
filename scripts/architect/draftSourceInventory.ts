/** BZE-321 source adoption preflight. This module cannot write to Firestore. */
import { TeamListFull } from '../../src/constants/teamList.js';
import {
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
  ARCHITECT_BASE_PICK_RULES_PATH,
  ARCHITECT_BASE_TEAMS_PATH,
} from '../../src/constants/collections.js';
import { verifyRealDraftReviewPackage } from '../../src/features/architect/utils/draftPickRealReview.js';
import { REAL_DRAFT_REVIEW_PIN } from '../../src/features/architect/utils/draftPickRealReviewPin.js';
import {
  DRAFT_REVIEW_PROJECT_ID,
  verifyDraftReviewBytes,
} from '../../server/draftReviewFirestore.js';
import { readDraftSourceForWorld } from '../../src/features/architect/utils/entitlements/draftSourceBaseline.js';

/** Decode only draft fields selected for reconciliation; raw snapshots stay intact. */
function decodeDraftField(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('SOURCE_DRAFT_FIELD_INVALID');
  const field = value as Record<string, unknown>;
  if (Object.keys(field).length !== 1)
    throw new Error('SOURCE_DRAFT_FIELD_INVALID');
  if (typeof field.stringValue === 'string') return field.stringValue;
  if (typeof field.booleanValue === 'boolean') return field.booleanValue;
  if (field.nullValue === null) return null;
  if (
    typeof field.integerValue === 'string' &&
    /^-?[0-9]+$/.test(field.integerValue) &&
    Number.isSafeInteger(Number(field.integerValue))
  )
    return Number(field.integerValue);
  if (
    typeof field.doubleValue === 'number' &&
    Number.isFinite(field.doubleValue)
  )
    return field.doubleValue;
  if (
    field.arrayValue &&
    typeof field.arrayValue === 'object' &&
    !Array.isArray(field.arrayValue)
  ) {
    const values = (field.arrayValue as Record<string, unknown>).values ?? [];
    if (!Array.isArray(values)) throw new Error('SOURCE_DRAFT_FIELD_INVALID');
    return values.map(decodeDraftField);
  }
  if (
    field.mapValue &&
    typeof field.mapValue === 'object' &&
    !Array.isArray(field.mapValue)
  ) {
    const fields = (field.mapValue as Record<string, unknown>).fields ?? {};
    if (!fields || typeof fields !== 'object' || Array.isArray(fields))
      throw new Error('SOURCE_DRAFT_FIELD_INVALID');
    return Object.fromEntries(
      Object.entries(fields).map(([key, nested]) => [
        key,
        decodeDraftField(nested),
      ])
    );
  }
  throw new Error('SOURCE_DRAFT_FIELD_INVALID');
}

type Loaded = Awaited<ReturnType<typeof verifyRealDraftReviewPackage>>;
export type DraftSourceDocument = {
  name: string;
  updateTime: string;
  fields: Record<string, unknown>;
};
export type DraftSourceSnapshot = {
  capturedAt: string;
  inventorySha256: string;
  documents: Record<string, DraftSourceDocument | null>;
};
const root = `projects/${DRAFT_REVIEW_PROJECT_ID}/databases/(default)/documents/`;
const safeId = (id: string) => {
  if (!id || id === '.' || id === '..' || /[/\u0000-\u001f\u007f]/.test(id))
    throw new Error('SOURCE_DOCUMENT_ID_REJECTED');
  return id;
};

/** IDs locate records only. They NEVER establish a holder or active right. */
export function draftSourceReadPaths(loaded: Loaded): string[] {
  if (
    ARCHITECT_BASE_TEAMS_PATH !== 'architect_baseTeams' ||
    ARCHITECT_BASE_ENTITLEMENTS_PATH !== 'architect_baseEntitlements' ||
    ARCHITECT_BASE_PICK_RULES_PATH !== 'architect_basePickRules'
  )
    throw new Error('SOURCE_COLLECTION_OVERRIDE_REJECTED');
  const retained = loaded.release.foundation.retained;
  const picks = new Set(
    retained.entitlements.flatMap(
      (row) => row.baselineUnderlyingAssetIdsUnchanged
    )
  );
  const paths = [
    ...TeamListFull.map((team) => `${ARCHITECT_BASE_TEAMS_PATH}/${team.code}`),
    ...retained.entitlements.map(
      (row) =>
        `${ARCHITECT_BASE_ENTITLEMENTS_PATH}/${safeId(row.entitlementId)}`
    ),
    ...[...picks]
      .sort()
      .map((id) => `${ARCHITECT_BASE_PICK_RULES_PATH}/${safeId(id)}`),
  ];
  if (new Set(paths).size !== paths.length)
    throw new Error('SOURCE_DUPLICATE_ID');
  return paths;
}

/** Caller supplies the existing bounded GET reader, not URLs or write operations. */
export async function inspectDraftSourceInventory(
  bytes: Buffer,
  read: (
    url: string,
    maximum: number,
    absentAllowed: boolean
  ) => Promise<unknown>
): Promise<DraftSourceSnapshot> {
  verifyDraftReviewBytes(bytes);
  const loaded = await verifyRealDraftReviewPackage(
    bytes.toString('utf8'),
    REAL_DRAFT_REVIEW_PIN
  );
  return collectDraftSourceInventory(loaded, read);
}

/** Pure-path collector exported for synthetic failure tests; not a credential entry point. */
export async function collectDraftSourceInventory(
  loaded: Loaded,
  read: (
    url: string,
    maximum: number,
    absentAllowed: boolean
  ) => Promise<unknown>
): Promise<DraftSourceSnapshot> {
  const paths = draftSourceReadPaths(loaded);
  const documents: DraftSourceSnapshot['documents'] = {};
  // Bounded concurrency completes known-document GETs within the short token life.
  // No collection listing permission, arbitrary query, world read, or source write.
  for (let offset = 0; offset < paths.length; offset += 8) {
    await Promise.all(
      paths.slice(offset, offset + 8).map(async (path) => {
        const name = root + path;
        const value = await read(
          `https://firestore.googleapis.com/v1/${root}${path.split('/').map(encodeURIComponent).join('/')}`,
          1500000,
          true
        );
        if (value === null) {
          documents[path] = null; // Only the bounded reader's HTTP 404 is absence.
          return;
        }
        const doc = value as DraftSourceDocument;
        if (
          !doc ||
          doc.name !== name ||
          typeof doc.updateTime !== 'string' ||
          !Number.isFinite(Date.parse(doc.updateTime)) ||
          !doc.fields ||
          typeof doc.fields !== 'object' ||
          Array.isArray(doc.fields)
        )
          throw new Error('SOURCE_DOCUMENT_SHAPE_REJECTED');
        documents[path] = doc;
      })
    );
  }
  return {
    capturedAt: new Date().toISOString(),
    inventorySha256: loaded.data.inventorySha256,
    documents,
  };
}

/** Check completeness before using absence to propose any create or team patch. */
export function reconcileDraftSourceInventory(
  loaded: Loaded,
  snapshot: DraftSourceSnapshot
) {
  const paths = draftSourceReadPaths(loaded);
  if (
    snapshot.inventorySha256 !== loaded.data.inventorySha256 ||
    JSON.stringify(Object.keys(snapshot.documents).sort()) !==
      JSON.stringify([...paths].sort())
  )
    throw new Error('SOURCE_SNAPSHOT_INCOMPLETE');
  const state = (path: string) =>
    snapshot.documents[path] === null ? 'absent' : 'present';
  const memberships = TeamListFull.map(({ code }) => {
    const document = snapshot.documents[`${ARCHITECT_BASE_TEAMS_PATH}/${code}`];
    if (!document) throw new Error('SOURCE_TEAM_MISSING');
    let values: unknown;
    try {
      const draftFields = Object.fromEntries(
        ['entitlementIds', 'draftSourceRevisions']
          .filter((key) => Object.hasOwn(document.fields, key))
          .map((key) => [key, decodeDraftField(document.fields[key])])
      );
      const active = readDraftSourceForWorld(draftFields, null, 'team')!;
      values = Object.hasOwn(active, 'entitlementIds')
        ? active.entitlementIds
        : [];
    } catch {
      throw new Error('SOURCE_TEAM_MEMBERSHIP_INVALID');
    }
    if (
      !Array.isArray(values) ||
      values.some((v) => typeof v !== 'string') ||
      new Set(values).size !== values.length
    )
      throw new Error('SOURCE_TEAM_MEMBERSHIP_INVALID');
    return {
      team: code,
      entitlementIds: values as string[],
      updateTime: document.updateTime,
    };
  });
  return {
    // Keep every retained entry and all unresolved IDs, including archival aliases.
    entitlements: loaded.data.records.map((row) => ({
      entitlementId: row.entitlementId,
      role: row.role,
      definition: state(
        `${ARCHITECT_BASE_ENTITLEMENTS_PATH}/${row.entitlementId}`
      ),
      linkedTeams: memberships
        .filter((m) => m.entitlementIds.includes(row.entitlementId))
        .map((m) => m.team),
      pickRules: loaded.release.foundation.retained.entitlements
        .find((e) => e.entitlementId === row.entitlementId)!
        .baselineUnderlyingAssetIdsUnchanged.map((pickId) => ({
          pickId,
          state: state(`${ARCHITECT_BASE_PICK_RULES_PATH}/${pickId}`),
        })),
      unresolvedDependencyIds: loaded.data.unresolved
        .filter((d) => d.entitlementIds.includes(row.entitlementId))
        .map((d) => d.dependencyId),
      // Supported component evidence is not itself an approved source mutation.
      adoption: 'requires-qualified-field-mapping-and-owner-approval' as const,
    })),
    memberships,
    unresolved: loaded.data.unresolved,
    writesPerformed: 0 as const,
  };
}
