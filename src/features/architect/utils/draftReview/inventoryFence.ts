/** Rules-enforced membership fence on the existing world metadata document.
 * Only the trusted initializer may opt a world in. A client marker is not proof
 * of origin; deploy the matching rules before using any fenced world.
 */
export function requireDraftInventoryRevision(
  metadata: Record<string, unknown>
): number {
  const revision = metadata.draftInventoryRevision;
  if (
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    revision >= Number.MAX_SAFE_INTEGER
  )
    throw new Error(
      'Draft review requires a valid enforced inventory revision.'
    );
  return revision;
}

/**
 * The fence advance an ordinary (non-draft-review) commit must carry. In a
 * fenced world, firestore.rules advancesDraftInventory requires every team,
 * entitlement and event commit to set the revision to exactly the committed
 * value plus one, so a commit built on a stale read is denied. A world that
 * never opted in is left unchanged.
 */
export function ordinaryDraftInventoryAdvance(
  metadata: Record<string, unknown> | undefined
): { draftInventoryRevision?: number } {
  if (!metadata || !('draftInventoryRevision' in metadata)) return {};
  return {
    draftInventoryRevision: requireDraftInventoryRevision(metadata) + 1,
  };
}
