# Refactoring Plan 3: Decompose `mutationPipeline.js`

## Instructions for Cursor

Follow these refactoring instructions exactly. This is a pure structural refactor — no logic changes. The public API (function names, parameters, return values) must stay identical so callers don't need to change.

**Rules:**

- All new files must be `.ts` / `.tsx`
- Use `@/` import aliases (maps to `src/`)
- Use named exports only
- After completing, run the validation commands listed at the end
- Update ALL imports across the entire codebase that reference moved/renamed files, including test files

**Note:** If Plan 2 was already completed, `capLegalityValidation.js` has been replaced by `capValidation/index.ts`. Imports from the old path should now point to `@/features/architect/utils/capValidation`.

---

## What We're Refactoring

**File:** `src/features/architect/utils/mutationPipeline.js` (3,433 lines)

**Why:** Second-largest file. Contains the entire mutation lifecycle (load → compute → validate → persist) plus 14 compute handlers. Splitting by domain makes each mutation type independently readable.

## Target Structure

```
src/features/architect/utils/mutationPipeline/
├── index.ts                          (re-exports applyWorldMutation, computeWorldMutation)
├── core/
│   ├── stateLoader.ts                (~250 lines)
│   ├── computeDispatcher.ts          (~200 lines)
│   ├── mutationValidator.ts          (~300 lines)
│   ├── persistenceLayer.ts           (~200 lines)
│   └── sanitization.ts               (~150 lines)
├── handlers/
│   ├── tradeHandler.ts               (~550 lines)
│   ├── signingHandler.ts             (~350 lines)
│   ├── contractHandler.ts            (~260 lines)
│   ├── offerSheetHandler.ts          (~420 lines)
│   └── rosterHandler.ts              (~200 lines)
└── README.md
```

## Step-by-Step

**Step 1: Extract sanitization utilities**

- Create `src/features/architect/utils/mutationPipeline/core/sanitization.ts`
- Move: `findUndefinedPaths` (line ~142), `removeUndefinedDeep` (line ~174), `sanitizeTransientFieldsForPersistence` (line ~234), `guardAgainstUndefined` (line ~274), `sanitizePayloadForOverride` (line ~368)
- These are pure functions with no external dependencies

**Step 2: Extract compute handlers by domain**

- `handlers/tradeHandler.ts`: `computeTradeResult` (line ~1095, ~400 lines), `computeSignAndTradeResult` (line ~3219), `computeSetExceptionsResult` (line ~2101), `computeSetDeadCapResult` (line ~3400)
- `handlers/signingHandler.ts`: `computeSigningResult` (line ~1494), `computeStoreOfferSheetResult` (line ~2618)
- `handlers/contractHandler.ts`: `computeExtensionResult` (line ~1774), `computeOptionResult` (line ~1863)
- `handlers/offerSheetHandler.ts`: `computeMatchOfferSheetResult` (line ~2772), `computeDeclineOfferSheetResult` (line ~2855), `computeFinalizeMatchedOfferSheetResult` (line ~2938), `computeFinalizeDeclinedOfferSheetResult` (line ~3050)
- `handlers/rosterHandler.ts`: `computeWaiveResult` (line ~1665), `computeRenounceResult` (line ~2023)

**Step 3: Extract pipeline layers**

- `core/stateLoader.ts`: `loadStateForMutation` (line ~696, ~230 lines)
- `core/computeDispatcher.ts`: `computeWorldMutation` (line ~925, ~170 lines) — the switch statement that routes to the correct handler. Import handlers from Step 2.
- `core/mutationValidator.ts`: `validateMutation` (line ~2166, ~290 lines)
- `core/persistenceLayer.ts`: `persistWorldMutation` (line ~2457, ~160 lines) — uses sanitization from Step 1

**Step 4: Create orchestrator index**

- `index.ts` exports `applyWorldMutation` (composes: loadState → compute → validate → persist) and `computeWorldMutation`
- This is the thin entry point (~50 lines) that wires the pipeline together

**Step 5: Update imports**

- All files importing from `mutationPipeline.js` switch to `@/features/architect/utils/mutationPipeline`
- Delete original `mutationPipeline.js`

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run test:architect -- --reporter=dot
npm run test:trade -- --reporter=dot
```
