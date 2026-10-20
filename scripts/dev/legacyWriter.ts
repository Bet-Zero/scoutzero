/**
 * FILE: scripts/dev/legacyWriter.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Old bulk writers cannot enforce reviewed deltas or preserve history. */
export function stopLegacyWriter(): never {
  throw new Error('Legacy bulk publication is retired. Use the reviewed maintenance publication plan; draft installation stays on its separately approved release route. No writes performed.');
}
