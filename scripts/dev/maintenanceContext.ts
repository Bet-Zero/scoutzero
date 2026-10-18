/**
 * FILE: scripts/dev/maintenanceContext.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Shared dated run contract. Season is its start year; no clock-based fallback. */
export function maintenanceContext(season: string, asOf: string) {
  const match = /^(20\d{2})-(\d{2})$/.exec(season);
  if (!match || match[2] !== String(Number(match[1]) + 1).slice(-2)) throw new Error('Explicit season YYYY-YY is required');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(asOf)) throw new Error('Explicit UTC as-of timestamp is required');
  const date = new Date(asOf);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== asOf.slice(0, 19)) throw new Error('Invalid as-of timestamp');
  return { season, startYear: Number(match[1]), asOf: date.toISOString() };
}
