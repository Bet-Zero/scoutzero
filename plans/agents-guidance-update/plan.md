# Align AGENTS plan/chunk rules and data hook guidance

## PLAN_INTENT

Align `AGENTS.md` with clarified rules for plan mode vs. chunks (multi-step vs. large), and correct the data hook guidance around `usePlayerData` so it matches the current codebase and TS migration posture.

## SCOPE

- In scope:
  - Update `AGENTS.md` text for plan mode usage vs. chunk usage per clarified thresholds.
  - Document how to treat single-step vs. multi-step vs. large tasks.
  - Diagnose the current `usePlayerData`/`useSimplePlayerData` situation and adjust guidance in `AGENTS.md` accordingly.
- Out of scope:
  - Changing hook implementations or migrating them to TypeScript.
  - Feature changes, UI updates, or Firestore logic changes.
  - Editing other docs beyond `AGENTS.md` unless needed for consistency (not expected).

## IMPLEMENTATION_SCOPE

- Inspect existing hooks and documentation references for `usePlayerData` and `useSimplePlayerData`.
- Update `AGENTS.md` to:
  - Clarify plan vs. chunk expectations (single-step = no plan; multi-step = plan; large = plan + chunks).
  - Note chunk usage reserved for large multi-phase work.
  - Update the Firestore guidance to reference the current canonical hook(s) based on diagnosis.
- Keep scope to documentation edits only.

## CONTEXT SNAPSHOT

Important background for this plan:

- Systems involved: Documentation only (`AGENTS.md`).
- Key folders and files: `AGENTS.md`, `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md`, `src/shared/hooks/usePlayerData.ts`, `src/shared/hooks/useSimplePlayerData.ts`, `DEVELOPER_GUIDE.md` references.
- Relevant docs: `docs/workspace-rules/WORKFLOW_CHECKLIST.md`, `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md`, `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md`.
- Known constraints: No code changes requested; keep instructions concise and aligned with existing workflow docs.
- **Questions asked and answered**: User clarified policy — single-step: no plan; multi-step: plan (chunks optional based on size); large: plan + chunks.
- **Technical decisions made**: Treat `useSimplePlayerData` as the active list hook with `usePlayerDetail` for full profiles unless diagnosis reveals a different canonical entry point.

## CHUNK_INDEX

- none — scoped plan (chunks not used; tracked via PROGRESS)

**Note**: Chunks are ONLY for massive multi-phase plans. Most plans should use the PROGRESS section below instead.

## PROGRESS

**Status**: 🟢 Completed

**Progress**: ✅✅✅ 3/3 tasks completed

**Completed**:

- ✅ Diagnosed current hook usage (`usePlayerData` vs `useSimplePlayerData` vs TS posture).
- ✅ Updated `AGENTS.md` for plan/chunk guidance per clarified rules.
- ✅ Updated `AGENTS.md` data hook guidance to point to the correct canonical hook(s).

**Next Steps**:

- [ ] None — plan complete.

**Blockers**: None

**Last Updated**: 2025-11-29 05:04

## PERMANENT_FILE_MAP

- `AGENTS.md` (guidance updates)
- Plan file: `plans/agents-guidance-update/plan.md` (tracking)

## REVISION_LOG

- 2025-11-29: Initialized plan; updated `AGENTS.md` plan/chunk rules and data hook guidance.

## KNOWN_LIMITATIONS

- No hook implementation changes; diagnosis only informs documentation.
- TS migration considerations noted but not executed.
