/**
 * FILE: scripts/dev/maintenanceErrors.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Keep diagnostics useful without reflecting private JSON or remote response bodies. */
export function maintenanceErrorMessage(error: unknown) {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'ENOENT') return 'Required private input or run was not found';
  if (code === 'EEXIST') return 'Output generation already exists; use a new directory or exact-run resume';
  if (code === 'EACCES') return 'Private input or output is not accessible';
  if (error instanceof SyntaxError) return 'Invalid private JSON input';
  if (error instanceof Error && error.name === 'Error') return error.message.replace(/https?:\/\/\S+/g, '[URL]').replace(/[\r\n]+/g, ' ').slice(0, 240);
  return 'Input validation or transport failed; inspect private run evidence';
}
