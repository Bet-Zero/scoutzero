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
