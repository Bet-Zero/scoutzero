# Refactoring Plan 7: Barrel Files & Import Standardization

## Instructions for Cursor

Follow these instructions to standardize barrel files (index.ts) and clean up import paths across the codebase.

**Rules:**

- All new files must be `.ts`
- Use `@/` import aliases (maps to `src/`)
- Use named exports only
- After completing, run the validation commands listed at the end

---

## What We're Doing

**Why:** 57 index files exist across the codebase but coverage is inconsistent. Some feature directories have them, others don't. Additionally, a small number of files still use deep relative imports (`../../../`) instead of the `@/` alias. Standardizing both improves navigability and developer experience.

## Step-by-Step

**Step 1: Add missing barrel files**

Create `index.ts` files for these feature directories that currently lack them:

- `src/features/architect/GMDashboard/index.ts`
- `src/features/architect/tradeMachine/index.ts`
- `src/features/tierMaker/index.ts`
- `src/features/roster/index.ts`
- `src/features/ranker/index.ts`

**Pattern to follow** (matches the existing convention used elsewhere in the codebase):

```ts
// Example: src/features/architect/tradeMachine/index.ts
export { TradeTeamCard } from './tradeTeamCard';
export { TradeMachineView } from './TradeMachineView';
// ... other public components/hooks from this directory
```

Only export components and hooks that are used outside the directory. Internal-only files should NOT be re-exported.

**Step 2: Sweep deep relative imports**

Search for `../../../` (3+ levels of relative imports) in non-test `.ts`, `.tsx`, `.js`, `.jsx` files and convert them to `@/` alias imports.

The codebase is already 10:1 in favor of `@/` aliases — this just cleans up the remaining stragglers.

Example conversion:

```ts
// Before
import { formatSalary } from '../../../shared/utils/formatting/basicFormatting';

// After
import { formatSalary } from '@/shared/utils/formatting/basicFormatting';
```

**Do NOT change imports in test files** — those can use relative paths and changing them is lower priority.

**Step 3: Verify barrel files created by Plans 1-5**

If Plans 1-5 were completed, verify that each new directory has an `index.ts`:

- `src/features/architect/GMDashboard/hooks/actions/` (from Plan 1) — may not need one since the orchestrator imports directly
- `src/features/architect/utils/capValidation/` (from Plan 2) — should have `index.ts`
- `src/features/architect/utils/mutationPipeline/` (from Plan 3) — should have `index.ts`
- All component directories from Plan 4 — should each have `index.ts`
- `src/features/architect/hooks/tradeMachine/` (from Plan 5) — should have `index.ts`

If any are missing, create them following the same pattern.

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run build
npm run validate:project
```

All three must pass. The `validate:project` command specifically checks structural conventions.
