import { DraftSourceBaselineZ } from '@/schemas/draftSourceBaseline';

export type DraftSourceKind = 'team' | 'entitlement' | 'pickRule';

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

/**
 * Source adoption must not retroactively change a saved simulation. Existing
 * worlds (including descendants and fresh worlds without a qualified draft
 * baseline initializer) retain the pre-adoption draft fields. World overrides
 * still merge normally AFTER this projection. No timestamps infer enrollment.
 *
 * The baseline is immutable across subsequent source corrections: retain the
 * first prior value per field. Only draft fields are projected, so roster and
 * salary fallback behavior is untouched. Explicit adoption into saved worlds
 * remains a separate, unfinished product capability.
 */
export function readDraftSourceForWorld(
  document: Record<string, unknown>,
  worldId: string | null,
  kind: DraftSourceKind
): Record<string, unknown> | null {
  if (!Object.hasOwn(document, 'draftSourceBaseline')) return document;
  const baseline = DraftSourceBaselineZ.parse(document.draftSourceBaseline);
  for (const field of Object.keys(baseline.fields)) {
    if (!DRAFT_FIELDS[kind].has(field)) {
      throw new Error(
        'Draft source baseline contains a non-draft or identity field'
      );
    }
  }
  if (
    !baseline.beforeExists &&
    (kind === 'team' || Object.keys(baseline.fields).length)
  ) {
    throw new Error('Invalid absent draft source baseline');
  }
  const result = { ...document };
  delete result.draftSourceBaseline;
  if (!worldId) return result;
  if (!baseline.beforeExists) return null;
  for (const [field, previous] of Object.entries(baseline.fields)) {
    if (previous.present) result[field] = previous.value;
    else delete result[field];
  }
  return result;
}
