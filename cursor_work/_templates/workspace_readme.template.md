# Workspace: <WORKSPACE_SLUG>

## ORIGIN

Plan: plans/<PLAN_SLUG>/plan.md

Chunk: plans/<PLAN_SLUG>/chunks/chunk_XX.md

## GOAL

What this workspace is being used to explore/build for this chunk.

## STRUCTURE

- notes/ → scratch notes

- drafts/ → partial code, experiments

- temp/ → throwaway scripts/data/results
  - temp/scripts/

  - temp/docs/

  - temp/output/

## RULES - DESIGN FOR CLEANUP

**Before creating any file, ask:**

- **Is this permanent?** → Save directly to `src/`, `data/`, `docs/`, `tools/`, or `tests/`
- **Is this temporary?** → Save to workspace `temp/` (will be deleted)

**What goes where:**

**Permanent locations** (only final, production-ready files):

- `src/` - Final React components, hooks, utils
- `data/` - Final data files, configs
- `docs/` - Final documentation
- `tools/` - Final, reusable scripts
- `tests/` - Final test files

**Workspace temp/** (everything temporary - will be deleted):

- `temp/scripts/` - Test scripts, one-time use scripts, experiments
- `temp/docs/` - Interim documentation, notes about process
- `temp/output/` - Test results, generated data, logs
- `drafts/` - Code experiments, prototypes
- `notes/` - Scratch notes (may be kept for audit)

**Cleanup when chunk completes:**

- ✅ `temp/` directory → **DELETED** (everything in here is temporary)
- ✅ `drafts/` directory → **DELETED** (experiments moved to permanent or discarded)
- ⚠️ `notes/` directory → **KEPT** (minimal audit trail only)
- ✅ README → Updated with cleanup timestamp

**Remember**: If you're not sure if a file should be permanent, put it in `temp/`. You can always move it later, but temporary files will be automatically cleaned up.
