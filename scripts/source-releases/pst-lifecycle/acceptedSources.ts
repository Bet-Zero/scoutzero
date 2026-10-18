/**
 * FILE: scripts/source-releases/pst-lifecycle/acceptedSources.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Reviewed source-acceptance registry. Never populate from a supplied command-line digest. */
export const HISTORICAL_PST_DIGEST = '44a18a7c339906ab147cc026d0e598d6d7ee655a2427c767fdce1685cd30cb7a';
const acceptedSources: Readonly<Record<string, { predecessor: string | null; receipt: string }>> = Object.freeze({
  [HISTORICAL_PST_DIGEST]: { predecessor: null, receipt: 'https://linear.app/bzero/issue/BZE-305' },
});

export function requireAcceptedPstSource(digest: string, predecessor: string | null) {
  const accepted = Object.hasOwn(acceptedSources, digest) ? acceptedSources[digest] : undefined;
  if (!accepted || accepted.predecessor !== predecessor) throw new Error('Unknown or unaccepted PST source release; register only after independent private-source acceptance');
  return accepted;
}
