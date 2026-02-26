# Refactoring Plan 5: Decompose `useTradeMachine.js`

## Instructions for Cursor

Follow these refactoring instructions exactly. This is a pure structural refactor — no logic changes. The public API (hook return values) must stay identical so callers don't need to change.

**Rules:**

- All new files must be `.ts`
- Use `@/` import aliases (maps to `src/`)
- Use named exports only
- After completing, run the validation commands listed at the end
- Update ALL imports across the entire codebase that reference moved/renamed files, including test files

**Note:** If Plans 2-3 were already completed, imports from `capLegalityValidation.js` and `mutationPipeline.js` will have changed to their new paths under `capValidation/` and `mutationPipeline/`. Use the current import paths you find in the file.

---

## What We're Refactoring

**File:** `src/features/architect/hooks/useTradeMachine.js` (1,258 lines)

**Why:** Mixes utility functions (team code resolution, pick rules), async data fetching, memoized computations, and validation state into one massive hook. Each concern has clear extraction boundaries.

## Target Structure

```
src/features/architect/hooks/tradeMachine/
├── index.ts
├── useTradeMachine.ts               (orchestrator, ~400 lines)
├── useTradeValidation.ts            (~250 lines)
├── utils/
│   ├── teamCodeResolution.ts        (~100 lines)
│   ├── pickRulesResolver.ts         (~100 lines)
│   └── capExceptionAugmenter.ts     (~100 lines)
└── hooks/
    └── useTradeAssets.ts             (~200 lines)
```

## Step-by-Step

1. Extract `utils/teamCodeResolution.ts` — `resolveTeamCodeLike` (line ~46) and any merge helpers. These are pure functions with no React dependencies.

2. Extract `utils/pickRulesResolver.ts` — `extractPickIdsFromEntitlements` (line ~118), `resolvePickRulesForEntitlements` (line ~136). These are async Firestore-dependent functions. Note: `resolvePickRulesForEntitlements` uses try-catch with console.warn fallback — preserve this error handling exactly.

3. Extract `utils/capExceptionAugmenter.ts` — `getCapTotalsForYear` (line ~157), `getMLEBAEForYear` (line ~175), `augmentTeamWithExceptions` (line ~193). These are pure computation functions.

4. Extract `hooks/useTradeAssets.ts` — the `useMemo` computations for `incomingAssets`, `capSnapshots`, `teamSummaries`. This becomes a hook that takes the trade teams and cap data as parameters and returns the computed assets.

5. Extract `useTradeValidation.ts` — `handleValidate` callback (line ~1009) + validation state (`isValidating`, `validationResult`, `lastValidatedDraftKeyRef`, `validatedAtRef`). This becomes a hook that takes the trade state and returns validation state + the validate function.

6. Rewrite `useTradeMachine.ts` as an orchestrator that:
   - Imports utility functions from `utils/`
   - Calls `useTradeAssets()` for computed trade data
   - Calls `useTradeValidation()` for validation state
   - Composes and returns the same flat interface the hook currently returns

7. Create `index.ts` with `export { useTradeMachine } from './useTradeMachine'`

8. Update the import in any file that imports useTradeMachine (search the codebase for all references)

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run test:trade -- --reporter=dot
npm run test:architect -- --reporter=dot
```

Also manually verify the Trade Machine still loads, can add teams, add players, and validate a trade.
