import { DraftSourceRevisionZ } from '@/schemas/draftSourceBaseline';

export type DraftSourceKind = 'team' | 'entitlement' | 'pickRule';
export const DRAFT_SOURCE_VERSION = '1';

const DRAFT_FIELDS: Record<DraftSourceKind, ReadonlySet<string>> = {
  team: new Set(['entitlementIds']),
  entitlement: new Set([
    'holderTeam',
    'description',
    'originalTeam',
    'sourceAsOf',
    'sourceArtifactSha256',
    'evidenceRowRefs',
  ]),
  pickRule: new Set([
    'protections',
    'conditions',
    'ownershipSource',
    'evidenceRowRefs',
    'updatedAtISO',
    'source',
    'sourceAsOf',
    'sourceArtifactSha256',
  ]),
};
const NEW_RULE_IDENTITY = new Set(['pickId', 'seasonYear', 'round']);

export function assertDraftRevisionFields(
  fields: Record<string, unknown>,
  kind: DraftSourceKind,
  legacyExists: boolean
): void {
  if (!legacyExists && kind !== 'pickRule')
    throw new Error('Draft source creation is not qualified');
  for (const [field, value] of Object.entries(fields)) {
    if (
      value === undefined ||
      (!DRAFT_FIELDS[kind].has(field) &&
        !(!legacyExists && NEW_RULE_IDENTITY.has(field)))
    ) {
      throw new Error(
        'Draft source revision contains a non-draft or identity field'
      );
    }
  }
  if (
    !legacyExists &&
    (typeof fields.pickId !== 'string' ||
      !Number.isInteger(fields.seasonYear) ||
      ![1, 2].includes(fields.round as number))
  ) {
    throw new Error('New draft rule identity is incomplete');
  }
  if (!legacyExists) {
    const tuple = /^([A-Z]{3})_([0-9]{4})_(1st|2nd)$/.exec(
      String(fields.pickId)
    );
    if (
      !tuple ||
      Number(tuple[2]) !== fields.seasonYear ||
      (tuple[3] === '1st' ? 1 : 2) !== fields.round
    ) {
      throw new Error('New draft rule identity is inconsistent');
    }
  }
}

/**
 * The existing root fields are the immutable legacy baseline. Version-aware
 * world-free readers project the explicitly supported source revision; older
 * clients continue reading exactly their original fields. A new rule stores
 * its entire revision under the envelope, so old rule readers see no terms.
 *
 * Saved worlds retain legacy source fallback before normal world overrides.
 * Fresh-world enrollment remains unfinished; dates never imply enrollment.
 * Later revisions append immutable versions and cannot replace older versions.
 */
export function readDraftSourceForWorld(
  document: Record<string, unknown>,
  worldId: string | null,
  kind: DraftSourceKind
): Record<string, unknown> | null {
  if (!Object.hasOwn(document, 'draftSourceRevisions')) return document;
  const revisions = DraftSourceRevisionZ.parse(document.draftSourceRevisions);
  if (!revisions.legacyExists && kind !== 'pickRule') {
    throw new Error('Draft source creation is not qualified');
  }
  const legacy = { ...document };
  delete legacy.draftSourceRevisions;
  const fields = revisions.versions[DRAFT_SOURCE_VERSION];
  // Future-only staged records cannot change an older client's selected source.
  if (worldId || !fields) return revisions.legacyExists ? legacy : null;
  assertDraftRevisionFields(fields, kind, revisions.legacyExists);
  if (
    kind === 'pickRule' &&
    !revisions.legacyExists &&
    document.pickId !== undefined &&
    document.pickId !== fields.pickId
  ) {
    throw new Error('Draft rule document identity differs from its revision');
  }
  return { ...legacy, ...fields };
}
