# Cursor Workflow Checklist

## Starting a New Plan

- [ ] **Create plan directory**: `mkdir -p plans/<plan-slug>/chunks`
- [ ] **Copy plan template**: Copy `plans/_templates/plan.template.md` to `plans/<plan-slug>/plan.md`
- [ ] **Fill in plan sections**:
  - [ ] Set `<PLAN_TITLE>` in header
  - [ ] Write `PLAN_INTENT` (high-level goal)
  - [ ] Define `SCOPE` (in scope / out of scope)
  - [ ] Write `IMPLEMENTATION_SCOPE` (what we're actually building)
  - [ ] Document `CONTEXT_SNAPSHOT` (systems, files, docs, constraints)
  - [ ] Initialize `CHUNK_INDEX` (start with chunk_01)
  - [ ] Set `CURRENT_STATE` (status: not_started)
  - [ ] Map `PERMANENT_FILE_MAP` (where work will live)
  - [ ] Initialize `REVISION_LOG`
  - [ ] Document `KNOWN_LIMITATIONS`

## Creating a New Chunk

- [ ] **Create chunk file**: Copy `plans/_templates/chunk.template.md` to `plans/<plan-slug>/chunks/chunk_XX.md`
- [ ] **Fill in chunk sections**:
  - [ ] Set chunk number and `<TITLE>` in header
  - [ ] Write `GOAL` (what this chunk accomplishes)
  - [ ] List `INPUTS` (dependencies, files, prior chunks)
  - [ ] Define `OUTPUTS` (what should exist when complete)
  - [ ] Break down `TASKS` (checklist of steps)
  - [ ] List `FILES_TO_TOUCH` (files to create/edit/remove)
  - [ ] Write `TEST_PLAN` (how to verify correctness)
  - [ ] Set `STATE` (status: not_started)
  - [ ] Initialize `ERROR_LOG` (empty, add entries if failures occur)
  - [ ] Add `NOTES / DECISIONS` (important choices)
- [ ] **Update plan.md**:
  - [ ] Add chunk to `CHUNK_INDEX`
  - [ ] Update `CURRENT_STATE` if this is the active chunk

## Setting Up a Workspace (if needed)

- [ ] **Create workspace directory**: `mkdir -p cursor_work/<slug>/{notes,drafts,temp/{scripts,docs,output}}`
- [ ] **Copy workspace template**: Copy `cursor_work/_templates/workspace_readme.template.md` to `cursor_work/<slug>/README.md`
- [ ] **Fill in workspace README**:
  - [ ] Set `<WORKSPACE_SLUG>`
  - [ ] Link to plan: `plans/<PLAN_SLUG>/plan.md`
  - [ ] Link to chunk: `plans/<PLAN_SLUG>/chunks/chunk_XX.md`
  - [ ] Describe `GOAL` (what this workspace is for)
  - [ ] Document `STRUCTURE` (notes/, drafts/, temp/)
  - [ ] Review `RULES` (temporary, must move to permanent locations)

## Executing a Chunk

- [ ] **Update chunk state**: Set `STATE.status` to `in_progress`
- [ ] **Update plan state**: Set `CURRENT_STATE.currentChunk` to `chunk_XX` and `status` to `in_progress`
- [ ] **Work through tasks**:
  - [ ] Complete each task in `TASKS` checklist
  - [ ] Check off tasks as completed
  - [ ] Update `FILES_TO_TOUCH` if files change during execution
- [ ] **Use workspace for temporary files**:
  - [ ] **Before creating any file, decide**: Permanent or temporary?
  - [ ] **Permanent files** (final code/docs) → Save directly to `src/`, `data/`, `docs/`, `tools/`, `tests/`
  - [ ] **Temporary files** → Save to workspace:
    - Test scripts → `cursor_work/<slug>/temp/scripts/`
    - One-time use scripts → `cursor_work/<slug>/temp/scripts/`
    - Interim docs → `cursor_work/<slug>/temp/docs/`
    - Test outputs → `cursor_work/<slug>/temp/output/`
    - Experiments → `cursor_work/<slug>/drafts/`
    - Notes → `cursor_work/<slug>/notes/`
- [ ] **Add file headers** (only for permanent files in `src/`, `data/`, `docs/`, `tools/`, `tests/`):
  - [ ] Copy `docs/templates/file_header.template.txt`
  - [ ] Fill in `<RELATIVE_PATH_FROM_REPO_ROOT>`
  - [ ] Fill in `PURPOSE`
  - [ ] Fill in `OWNERSHIP` (feature/domain)
  - [ ] Add `HISTORY` entry with plan/chunk reference
  - [ ] Add `LINKS` to plan and latest chunk
- [ ] **Run test plan**:
  - [ ] Execute each test in `TEST_PLAN`
  - [ ] Verify all outputs match expectations
- [ ] **Handle errors** (if any):
  - [ ] Add entry to `ERROR_LOG` with date, error summary, cause, decision
  - [ ] Update `STATE.nextAction` with recovery steps
  - [ ] Set `STATE.status` to `blocked` if cannot proceed

## Completing a Chunk

- [ ] **Verify all outputs exist**:
  - [ ] Check `OUTPUTS` list - all items should be present
  - [ ] Verify `FILES_TO_TOUCH` - all files created/updated as expected
- [ ] **Run final verification**:
  - [ ] Complete all items in `TEST_PLAN`
  - [ ] Run linting/validation if applicable
  - [ ] Manual checks pass
- [ ] **Assess documentation updates** (see `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md`):
  - [ ] **Significant changes?** (structure, schemas, features, APIs, scripts) → Update documentation
  - [ ] **Minor changes only?** (bug fixes, refactoring, tweaks) → Skip, note reason in chunk file
  - [ ] **If significant**: Update relevant documentation (structural → `PROJECT_SCHEMA.md`, schemas → `npm run schema:generate`, components → `npm run docs`, etc.)
  - [ ] **Verification**: Run `npm run validate:project` and `npm run schema:check` if documentation updated
- [ ] **Update chunk state**:
  - [ ] Set `STATE.status` to `completed`
  - [ ] Set `STATE.lastRun` to current timestamp
  - [ ] Set `STATE.lastResult` to "success" or summary
  - [ ] Clear `STATE.nextAction` (or set to "n/a")
- [ ] **Update plan.md**:
  - [ ] Mark chunk as `completed` in `CHUNK_INDEX`
  - [ ] Update `CURRENT_STATE.currentChunk` to next chunk (or `none` if done)
  - [ ] Update `CURRENT_STATE.status` accordingly
  - [ ] Update `CURRENT_STATE.lastUpdated` timestamp
- [ ] **Clean up workspace** (if used):
  - [ ] **Verify**: All permanent files already in `src/`, `data/`, `docs/`, `tools/`, `tests/` (not in workspace)
  - [ ] **Delete**: `cursor_work/<slug>/temp/` directory entirely (all temporary files)
  - [ ] **Delete**: `cursor_work/<slug>/drafts/` directory (experiments should be moved or discarded)
  - [ ] **Keep**: `cursor_work/<slug>/notes/` (minimal audit trail only)
  - [ ] **Update**: Workspace README with cleanup timestamp
  - [ ] **Verify**: Workspace only contains `notes/` and `README.md` after cleanup

## Completing a Plan

- [ ] **Verify all chunks completed**:
  - [ ] All chunks in `CHUNK_INDEX` marked `completed`
  - [ ] All `OUTPUTS` from all chunks verified
- [ ] **Final plan update**:
  - [ ] Set `CURRENT_STATE.status` to `completed`
  - [ ] Set `CURRENT_STATE.currentChunk` to `none`
  - [ ] Update `CURRENT_STATE.lastUpdated` timestamp
  - [ ] Add final entry to `REVISION_LOG`
- [ ] **Documentation**:
  - [ ] Ensure all file headers reference correct plan/chunk
  - [ ] Update any related docs referenced in `RELATED_DOCS`
  - [ ] Verify `PERMANENT_FILE_MAP` is accurate

## Ongoing Maintenance

- [ ] **When modifying files from a plan**:
  - [ ] Update file header `HISTORY` with new entry
  - [ ] Update file header `LINKS` to latest chunk if changed
- [ ] **When plan scope changes**:
  - [ ] Update `IMPLEMENTATION_SCOPE` if diverging from `PLAN_INTENT`
  - [ ] Add entry to `REVISION_LOG`
  - [ ] Update `CHUNK_INDEX` if chunks added/removed
- [ ] **When blockers occur**:
  - [ ] Set `CURRENT_STATE.status` to `blocked`
  - [ ] Document blocker in `CURRENT_STATE.blockers`
  - [ ] Update affected chunk `STATE.status` to `blocked`
  - [ ] Add entry to chunk `ERROR_LOG` if applicable

## Quick Reference

**Template Locations:**

- Plan: `plans/_templates/plan.template.md`
- Chunk: `plans/_templates/chunk.template.md`
- Workspace: `cursor_work/_templates/workspace_readme.template.md`
- File Header: `docs/templates/file_header.template.txt`

**Directory Structure:**

- Plans: `plans/<plan-slug>/plan.md`
- Chunks: `plans/<plan-slug>/chunks/chunk_XX.md`
- Workspaces: `cursor_work/<slug>/` (git-ignored, temporary)

**State Values:**

- Plan/Chunk status: `not_started` | `in_progress` | `blocked` | `completed`
