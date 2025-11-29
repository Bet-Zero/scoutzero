# TS migrate player data hooks and retire legacy usage

## PLAN_INTENT

TypeScript-migrate the primary player data hooks and remove any remaining dependence on the deprecated season hook, keeping guidance and imports aligned.

## SCOPE

- In scope:
  - Convert `useSimplePlayerData` and `usePlayerData` to TypeScript with file headers.
  - Ensure diagnostics/exports remain intact and imports keep working.
  - Remove/replace any lingering `useSeasonPlayerData` usage; clean up stale references if found.
  - Update documentation references to reflect the new hook filenames/roles where touched.
- Out of scope:
  - Changing Firestore read logic or schemas.
  - Refactoring `enrichPlayerData` beyond typing needs.
  - Broader TS migration beyond these hooks.

## IMPLEMENTATION_SCOPE

- Rename `.js` hooks to `.ts`, add headers per template, and type key surfaces (players, error, diagnostics).
- Keep runtime behavior identical (real-time subscription, enrichment, diagnostics wrapper).
- Audit the codebase for `useSeasonPlayerData` imports; replace with `useSimplePlayerData`/`usePlayerData` or remove dead usage if any.
- Adjust documentation mentions to match new filenames and canonical hooks if encountered.
- No chunks unless scope grows; single plan file only.

## CONTEXT SNAPSHOT

- Systems involved: Firestore read hooks, enrichment utilities.
- Key folders/files: `src/shared/hooks/useSimplePlayerData.js` → `.ts`, `src/shared/hooks/usePlayerData.js` → `.ts`, `src/shared/hooks/usePlayerDetail.js` (reference), `src/features/roster/utils/enrichPlayerData.js`.
- Relevant docs: `AGENTS.md`, `docs/runbooks/application-integration-notes.md` (notes on hooks).
- Known constraints: Keep behavior unchanged; TS strict is off but prefer reasonable typing.
- **Questions asked and answered**: User confirmed rules—multi-step → plan mode; large → plan + chunks. Requested both follow-ups (TS migration + retire deprecated hook usage).
- **Technical decisions made**: Use TypeScript for hooks; maintain diagnostics wrapper; prefer base hook unless diagnostics required.

## CHUNK_INDEX

- none — plan-only (no chunks; scope is moderate)

**Note**: Chunks are ONLY for massive multi-phase plans. Most plans should use the PROGRESS section below instead.

## PROGRESS

**Status**: 🟢 Completed

**Progress**: ✅✅✅ 3/3 tasks completed

**Completed**:

- ✅ Migrate `useSimplePlayerData` to TypeScript with header and typings; ensure build-safe behavior unchanged.
- ✅ Migrate `usePlayerData` to TypeScript with header and diagnostics intact.
- ✅ Audit/retire `useSeasonPlayerData` usage; no active imports found (only legacy docs mention).

**Next Steps**:

- [ ] None – plan complete.

**Blockers**: None

**Last Updated**: 2025-11-29 05:12

## PERMANENT_FILE_MAP

- `src/shared/hooks/useSimplePlayerData.ts`
- `src/shared/hooks/usePlayerData.ts`
- Docs references if adjusted (`AGENTS.md`, `docs/runbooks/application-integration-notes.md`)

## REVISION_LOG

- 2025-11-29: Plan created to migrate player hooks to TS and retire legacy hook usage.
- 2025-11-29: Completed TS migrations, updated references, confirmed no active `useSeasonPlayerData` imports.

## KNOWN_LIMITATIONS

- Enrichment utility remains JS; typed surfaces limited to hook outputs.
- No chunk tracking since scope is moderate; revisit if scope expands.
