<!-- 72878d00-45b2-4ad4-8e66-ed8e31fdf1e1 90dde23c-2fbd-4d46-8319-6421a6c2faa2 -->

# Cursor Workflow Plan

## PLAN_INTENT

Document and enforce the Cursor rules/process inside the repo so any future tasks can reference a canonical plan + chunk structure.

## SCOPE

- In scope:
  - Store the existing rules doc in a plan directory
  - Provide chunk/workspace templates for future steps
- Out of scope:
  - Altering project behavior beyond documentation scaffolding

## IMPLEMENTATION_SCOPE

Create `docs/workspace-rules/plan.md` referencing the existing rules, add chunk template directory, and note how workspaces tie in.

## CONTEXT_SNAPSHOT

- Rules currently described outside `plans/`
- We need consistent structure for future Cursor-related tasks
- Project uses plan/chunk/workspace pattern for large initiatives
- Workspaces live in `cursor_work/<slug>/` for temporary scratch space during chunk execution

## CHUNK_INDEX

- chunk_01 — Scaffold plan + templates — completed

## CURRENT_STATE

currentChunk: none
status: completed
lastUpdated: 2025-01-13
blockers: none

## PERMANENT_FILE_MAP

- Plan files: `docs/workspace-rules/`
- Chunk files: `docs/workspace-rules/chunks/`
- Workspaces: `cursor_work/<slug>/` (temporary, git-ignored)

## REVISION_LOG

- 2025-01-13 — Initial plan creation and scaffolding
- 2025-01-13 — Added NON-NEGOTIABLES and PRE-EXECUTION SELF-CHECK to AGENTS.md

## KNOWN_LIMITATIONS

- No automation yet to enforce these rules
- Rules document referenced but not yet integrated into plan structure

## RELATED_DOCS

- `AGENTS.md` — Project-level AI instructions and conventions
- `COMMUNICATION_RULES.md` — **CRITICAL**: How to communicate with user (ask questions about direction, make technical decisions)
- `WHEN_TO_USE_PLAN_MODE.md` — **IMPORTANT**: When to use plan mode vs. direct requests
- `DOCUMENTATION_UPDATE_RULES.md` — **CRITICAL**: Mandatory documentation updates for significant changes
- `CREATING_PERMANENT_DOCS.md` — **CRITICAL**: When and how to create permanent documentation files
- `DEVELOPER_GUIDE.md` — Detailed file structure and component logic
- `PROJECT_SCHEMA.md` — Repo structure and validation rules

## WORKSPACE_USAGE

**Design Principle: Design for Cleanup**

Workspaces (`cursor_work/<slug>/`) are temporary scratch directories used during chunk execution. The system is designed so that cleanup is natural and automatic.

**File Placement Rules:**

- **Permanent files** (final code/docs) → Save directly to `src/`, `data/`, `docs/`, `tools/`, `tests/`
- **Temporary files** → Save to workspace `temp/` (will be automatically deleted)

**What goes in workspace:**

- Test scripts → `temp/scripts/`
- One-time use scripts → `temp/scripts/`
- Interim documentation → `temp/docs/`
- Test outputs/results → `temp/output/`
- Experiments → `drafts/`
- Notes → `notes/` (kept for audit)

**Cleanup when chunk completes:**

- `temp/` directory → **DELETED** (everything temporary)
- `drafts/` directory → **DELETED** (experiments moved or discarded)
- `notes/` directory → **KEPT** (minimal audit trail)
- Result: Only permanent files remain in repo

📄 See `FILE_PLACEMENT_GUIDE.md` for detailed decision tree and examples.
