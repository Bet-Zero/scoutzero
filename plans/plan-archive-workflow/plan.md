# Add plan archive workflow and gitignore rule

## PLAN_INTENT

Add a first-class archive path for completed plans (`plans/_archive/<slug>/`), document the move/cleanup steps in the workflow, and ensure git tracks archived plans while keeping temps/drafts cleaned.

## SCOPE

- In scope:
  - Define/archive location: `plans/_archive/<slug>/`.
  - Update AGENTS/WORKFLOW docs to include archiving after plan completion and temp/draft cleanup.
  - Add gitignore entry for archive temp/draft subfolders if needed while keeping plan files tracked.
  - Update PROJECT_SCHEMA to reflect the new archive directory.
- Out of scope:
  - Moving existing plans into the archive.
  - Changing chunk templates or adding automation scripts.

## IMPLEMENTATION_SCOPE

- Create `plans/_archive/` directory.
- Update `AGENTS.md` and `docs/workspace-rules/WORKFLOW_CHECKLIST.md` to describe archiving and cleanup.
- Ensure git tracking: plans stay tracked; only temp/drafts remain ephemeral. Add `.gitignore` entry if necessary for archive temp/drafts (if ever created).
- Update `PROJECT_SCHEMA.md` to note the archive path.
- No chunks expected; single pass.

## CONTEXT SNAPSHOT

- Systems involved: plan workflow docs, gitignore, project schema.
- Key folders/files: `AGENTS.md`, `docs/workspace-rules/WORKFLOW_CHECKLIST.md`, `PROJECT_SCHEMA.md`, `plans/_archive/`.
- Relevant docs: `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md` (cleanup), `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md`.
- Known constraints: Keep audit trail; don't invent new top-level dirs—`plans/_archive/` is inside `plans/`.
- **Questions asked and answered**: User chose option 1 (tracked archive under `plans/_archive/`).
- **Technical decisions made**: Archive lives in repo; temp/draft cleanup remains mandatory.

## CHUNK_INDEX

- none — plan-only (no chunks)

**Note**: Chunks are ONLY for massive multi-phase plans. Most plans should use the PROGRESS section below instead.

## PROGRESS

**Status**: 🟢 Completed

**Progress**: ✅✅✅ 3/3 tasks completed

**Completed**:

- ✅ Create archive folder and update gitignore/schema if needed.
- ✅ Update AGENTS and WORKFLOW checklist with archive + cleanup steps.
- ✅ Sanity-check instructions for consistency and finalize.

**Next Steps**:

- [ ] None — plan complete.

**Blockers**: None

**Last Updated**: 2025-11-29 05:28

## PERMANENT_FILE_MAP

- `plans/_archive/` (new)
- `AGENTS.md`
- `docs/workspace-rules/WORKFLOW_CHECKLIST.md`
- `PROJECT_SCHEMA.md`

## REVISION_LOG

- 2025-11-29: Plan created to add archive workflow for plans.
- 2025-11-29: Implemented archive directory, updated AGENTS/WORKFLOW, updated PROJECT_SCHEMA.

## KNOWN_LIMITATIONS

- No automation for moving plans; manual move documented only.
