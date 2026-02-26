# Structural Refactoring Plans for Cursor

## Context

The project has grown to ~155K lines in `src/` with several files far exceeding maintainable size. The codebase is 68% JS / 32% TS, with `strict: false` in tsconfig. AGENTS.md mandates `.ts`/`.tsx` for all new files, `@/` imports, named exports, and components under 200 lines. These refactoring plans are designed to be fed to Cursor one at a time, in priority order. Each plan is self-contained.

**Execution order matters.** Plans are numbered by priority. Earlier plans create files that later plans may reference. Do them in order.

---

## Plan 1: Decompose `useArchitectActions.ts` (2,035 lines → ~6 files)

**File:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

**Why first:** This is the most-touched file in the codebase. Every mutation flows through it. Splitting it reduces merge conflicts and makes each domain independently testable.

### Target Structure

```
src/features/architect/GMDashboard/hooks/
├── useArchitectActions.ts          (orchestrator, ~250 lines)
├── actions/
│   ├── useSigningActions.ts        (~300 lines)
│   ├── useContractActions.ts       (~250 lines)
│   ├── useOfferSheetActions.ts     (~300 lines)
│   ├── useRosterActions.ts         (~200 lines)
│   └── useMutationCore.ts          (~350 lines)
└── types/
    └── architectActionTypes.ts     (~200 lines)
```

### Step-by-Step Instructions for Cursor

**Step 1: Extract types**

- Create `src/features/architect/GMDashboard/hooks/types/architectActionTypes.ts`
- Move all 13 TypeScript interfaces from lines 40-232 of `useArchitectActions.ts` into this file
- Export each interface as a named export
- In `useArchitectActions.ts`, replace the interfaces with `import type { ... } from './types/architectActionTypes'`

**Step 2: Extract mutation core**

- Create `src/features/architect/GMDashboard/hooks/actions/useMutationCore.ts`
- Move these functions into it:
  - `persistMutation` (line ~465)
  - `reportMutationError` (line ~507)
  - `syncTeamFromMutationResult` (line ~519)
  - `applyTradeToCapSheet` (line ~614, this is 266 lines — the largest helper)
- Export as a `useMutationCore()` hook that takes the shared dependencies (worldId, setTeamCapSheet, setFreeAgents, etc.) and returns `{ persistMutation, reportMutationError, syncTeamFromMutationResult, applyTradeToCapSheet }`

**Step 3: Extract signing actions**

- Create `src/features/architect/GMDashboard/hooks/actions/useSigningActions.ts`
- Move: `handleSign` (line ~880), `handleSignAndTrade` (line ~1045)
- Hook signature: `useSigningActions({ mutationCore, worldId, currentYear, ... })` — receives the shared mutation core from Step 2
- Export as named export

**Step 4: Extract offer sheet actions**

- Create `src/features/architect/GMDashboard/hooks/actions/useOfferSheetActions.ts`
- Move: `handleStoreOfferSheet` (line ~1126), `handleMatchOfferSheet` (line ~1190), `handleDeclineOfferSheet` (line ~1229), `handleFinalizeOfferSheet` (line ~1268)

**Step 5: Extract contract actions**

- Create `src/features/architect/GMDashboard/hooks/actions/useContractActions.ts`
- Move: `handleSaveContract` (line ~1533), `handleExtendContract` (line ~1604), `handleOptionDecision` (line ~1785), `handleEditContract` (line ~1391)

**Step 6: Extract roster actions**

- Create `src/features/architect/GMDashboard/hooks/actions/useRosterActions.ts`
- Move: `handleWaiveContract` (line ~1684), `handleCapSheetAction` (line ~1495), `handleRenounceRights` (line ~1953), `handleSetDeadCap` (line ~1352), `handleSetExceptions` (line ~1372), `handleUpdateRoster` (line ~1964)

**Step 7: Rewrite orchestrator**

- `useArchitectActions.ts` becomes a thin orchestrator that:
  1. Calls `useMutationCore()` for shared infrastructure
  2. Calls each domain hook, passing mutation core
  3. Spreads all returned handlers into one flat return object
  4. The return type and interface stay identical — callers don't change

### Validation

- `npm run typecheck`
- `npm run test:architect -- --reporter=dot`
- Verify GMDashboard still renders and can execute a signing, trade, extension, and waive

---

## Plan 2: Decompose `capLegalityValidation.js` (3,952 lines → ~8 files)

**File:** `src/features/architect/utils/capLegalityValidation.js`

**Why:** Largest utility file. Contains 6 exported validators and 45+ helper functions. Breaking it up makes individual CBA rules testable and navigable.

### Target Structure

```
src/features/architect/utils/capValidation/
├── index.ts                        (re-exports all validators)
├── signingValidator.ts             (~1,200 lines — largest, could split further later)
├── extensionValidator.ts           (~350 lines)
├── optionValidator.ts              (~600 lines)
├── waiveValidator.ts               (~200 lines)
├── offerSheetValidator.ts          (~200 lines)
├── renounceValidator.ts            (~80 lines)
├── shared/
│   ├── contractStructureRules.ts   (~300 lines)
│   ├── exceptionEligibility.ts     (~150 lines)
│   └── validationConstants.ts      (~100 lines)
└── README.md
```

### Step-by-Step Instructions for Cursor

**Step 1: Create the directory and constants file**

- Create `src/features/architect/utils/capValidation/`
- Create `shared/validationConstants.ts` — move all constants: `SIGNING_YEARS_LIMITS`, `EXTENSION_YEARS_LIMITS`, `RAISE_LIMITS`, and the 15+ other constants scattered through the file

**Step 2: Extract shared contract structure rules**

- Create `shared/contractStructureRules.ts`
- Move: `validateSalaryRowSchema` (line ~639), `validateGuaranteesPolicy` (line ~711), `validateOptionsPolicy` (line ~787), `validateContractRows` (line ~837), `validateDeadCap` (line ~888), `validateExceptions` (line ~963)
- These are used by multiple validators

**Step 3: Extract shared exception eligibility**

- Create `shared/exceptionEligibility.ts`
- Move: `validateExceptionEligibility` (line ~2029), `resolveSigningMechanism` (line ~469), `normalizeSigningTerms` (line ~1169)

**Step 4: Extract each validator into its own file**

- `signingValidator.ts` ← `validateSigning` (line ~2199) + its 15 helper functions (`validateSigningRaises`, `validateSigningTermsAndRaises`, `getSigningTermsForPlayer`, `validateOfferSheetTerms`, etc.)
- `extensionValidator.ts` ← `validateExtension` (line ~3273) + `validateExtensionTermsAndRaises` (line ~1920)
- `optionValidator.ts` ← `validateOptionDecision` (line ~3425) + cap hold helpers
- `waiveValidator.ts` ← `validateWaive` (line ~3167) + stretch helpers
- `offerSheetValidator.ts` ← `validateOfferSheetResolution` (line ~3819)
- `renounceValidator.ts` ← `validateRenounceRights` (line ~3758)

**Step 5: Create index.ts**

- Re-export all 6 validators by name: `export { validateSigning } from './signingValidator'` etc.
- This preserves the existing import interface

**Step 6: Update imports across codebase**

- Find all files importing from `capLegalityValidation.js` (likely mutationPipeline.js, useArchitectActions.ts, and test files)
- Change imports to use `@/features/architect/utils/capValidation`
- Delete the original `capLegalityValidation.js`

**Step 7: Convert to TypeScript during extraction**

- All new files are `.ts`
- Add parameter types and return types to each validator function
- Return type should be `{ violations: string[], warnings: string[] }` (or a named `ValidationResult` type in validationConstants.ts)

### Validation

- `npm run typecheck`
- `npm run test:architect -- --reporter=dot`
- `npm run test:trade -- --reporter=dot`

---

## Plan 3: Decompose `mutationPipeline.js` (3,433 lines → ~10 files)

**File:** `src/features/architect/utils/mutationPipeline.js`

**Why:** Second-largest file. Contains the entire mutation lifecycle (load → compute → validate → persist) plus 14 compute handlers. Splitting by domain makes each mutation type independently readable.

### Target Structure

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

### Step-by-Step Instructions for Cursor

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

### Validation

- `npm run typecheck`
- `npm run test:architect -- --reporter=dot`
- `npm run test:trade -- --reporter=dot`

---

## Plan 4: Decompose God Components (4 components → ~20 focused files)

### 4A: EditContractModal.jsx (1,343 lines → 4 files)

**File:** `src/shared/components/EditContractModal.jsx`

**Target:**

```
src/shared/components/editContractModal/
├── index.ts
├── EditContractModal.tsx            (orchestrator, ~400 lines)
├── ContractActionForm.tsx           (~350 lines)
├── CapImpactSummary.tsx             (~250 lines)
└── ValidationWarningsPanel.tsx      (~200 lines)
```

**Instructions:**

1. Create `editContractModal/` directory
2. Extract `ContractActionForm.tsx` — all form inputs (action type, years, salary), form state (`useState` for form fields), and change handlers. Props: `{ action, player, rules, teamCapSheet, onActionChange, onTeamChange }`
3. Extract `CapImpactSummary.tsx` — the cap impact tiles section. Pure display component. Props: `{ player, action, formInputs, teamCapSheet }`
4. Extract `ValidationWarningsPanel.tsx` — validation warnings and rule violations display. Props: `{ validationResult, playerRules }`
5. Rewrite `EditContractModal.tsx` as orchestrator that renders these three sub-components
6. Create `index.ts` with `export { EditContractModal } from './EditContractModal'`
7. Update the import in any file that imports EditContractModal (it was at `@/shared/components/EditContractModal`)

### 4B: TradeTeamCard.jsx (931 lines → 5 files)

**File:** `src/features/architect/tradeMachine/TradeTeamCard.jsx`

**Target:**

```
src/features/architect/tradeMachine/tradeTeamCard/
├── index.ts
├── TradeTeamCard.tsx                (orchestrator, ~350 lines)
├── SalaryDisplayHeader.tsx          (~200 lines)
├── AllowableIncomingPanel.tsx       (~150 lines)
├── IncomingPlayersList.tsx          (~200 lines)
└── TabNavigation.tsx                (~80 lines)
```

**Instructions:**

1. Extract `SalaryDisplayHeader.tsx` — outgoing/incoming salary display with adjustment indicators, estimate labels, loading states, collapsible sections
2. Extract `AllowableIncomingPanel.tsx` — allowable incoming amount, salary matching rule labels, hard cap limiter status, TPE availability
3. Extract `IncomingPlayersList.tsx` — incoming players with absorption mode selector (Match/TPE/FA Exception)
4. Extract `TabNavigation.tsx` — Players/Picks/Exceptions tab selector with counts
5. Orchestrator renders header → salary → tabs → content → incoming → allowable

### 4C: TieramidBoard.jsx (1,057 lines → 6 files)

**File:** `src/features/tierMaker/TieramidBoard.jsx`

**Target:**

```
src/features/tierMaker/tieramidBoard/
├── index.ts
├── TieramidBoard.tsx                (orchestrator, ~350 lines)
├── PyramidGrid.tsx                  (~200 lines)
├── PoolSection.tsx                  (~100 lines)
├── ControlsToolbar.tsx              (~150 lines)
├── hooks/
│   ├── useTierListPersistence.ts    (~150 lines)
│   └── useTierListData.ts           (~150 lines)
└── utils/
    └── dataProcessor.ts             (~100 lines)
```

**Instructions:**

1. Extract `utils/dataProcessor.ts` — pure functions: `processPlayers`, `buildPlayersMap`, `normalizeRows`, `normalizeRowsForCapacity`, `getInitialRows`
2. Extract `hooks/useTierListData.ts` — Firebase queries for lists, tier lists, processed player data
3. Extract `hooks/useTierListPersistence.ts` — save/load/create tier list logic, draft mode initialization/reporting
4. Extract `PyramidGrid.tsx` — pyramid visual rendering with tiles and position controls (lines ~694-909)
5. Extract `PoolSection.tsx` — pool display with place buttons (lines ~911-935)
6. Extract `ControlsToolbar.tsx` — save/load/new/add-team/add-list buttons and selectors (lines ~937-1005)

### 4D: SeasonAdvanceModal.jsx (789 lines → 6 files)

**File:** `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`

**Target:**

```
src/features/architect/GMDashboard/components/seasonAdvanceModal/
├── index.ts
├── SeasonAdvanceModal.tsx           (orchestrator + wizard state, ~250 lines)
├── DataSummaryStep.tsx              (~150 lines)
├── OptionDecisionsStep.tsx          (~100 lines)
├── ConfirmationStep.tsx             (~80 lines)
├── ResultSteps.tsx                  (~60 lines — Processing + Complete combined)
└── utils/
    └── seasonAdvanceHelpers.ts      (~150 lines)
```

**Instructions:**

1. Extract `utils/seasonAdvanceHelpers.ts` — pure functions: `findPlayersWithOptions`, `findExpiringContracts`, `findExpiringCapHolds`, `findExpiringTPEs`
2. Extract each wizard step as a component — they're already isolated as `renderXxxStep()` functions
3. Orchestrator keeps wizard state (currentStep, optionDecisions, isProcessing, error, result) and renders the correct step

### Validation for All Components

- `npm run typecheck`
- `npm run build` (verify no broken imports)
- `npm run test:architect -- --reporter=dot`
- Manual: verify each component renders correctly in the UI

---

## Plan 5: Decompose `useTradeMachine.js` (1,258 lines → ~5 files)

**File:** `src/features/architect/hooks/useTradeMachine.js`

### Target Structure

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

### Instructions

1. Extract `utils/teamCodeResolution.ts` — `resolveTeamCodeLike` (line ~46) and merge helpers
2. Extract `utils/pickRulesResolver.ts` — `extractPickIdsFromEntitlements` (line ~118), `resolvePickRulesForEntitlements` (line ~136). These are async Firestore-dependent functions.
3. Extract `utils/capExceptionAugmenter.ts` — `getCapTotalsForYear` (line ~157), `getMLEBAEForYear` (line ~175), `augmentTeamWithExceptions` (line ~193)
4. Extract `hooks/useTradeAssets.ts` — the `useMemo` computations for `incomingAssets`, `capSnapshots`, `teamSummaries`
5. Extract `useTradeValidation.ts` — `handleValidate` callback (line ~1009) + validation state (`isValidating`, `validationResult`, refs)
6. Rewrite `useTradeMachine.ts` as orchestrator composing these hooks/utils

### Validation

- `npm run typecheck`
- `npm run test:trade -- --reporter=dot`
- `npm run test:architect -- --reporter=dot`

---

## Plan 6: Enable `strict: true` Incrementally

**File:** `tsconfig.json`

**Why:** Currently `strict: false` — implicit `any` everywhere defeats TypeScript's value. This should happen after the refactors above so it applies to the newly-created clean files.

### Instructions

1. Don't flip `strict: true` globally yet. Instead, add these incremental flags:

   ```json
   "strictNullChecks": true,
   "noImplicitAny": true
   ```

2. Run `npm run typecheck` and fix errors file by file
3. For files that are too noisy, add `// @ts-expect-error` with a TODO comment, or create a `tsconfig.strict-exclude.json` that extends the base config but excludes legacy JS files
4. Priority files to fix first: all the newly-created `.ts` files from Plans 1-5 (they should be clean from the start)

### Validation

- `npm run typecheck`
- `npm run build`

---

## Plan 7: Barrel Files & Import Standardization

**Why:** 57 index files exist but coverage is inconsistent. Standardizing makes the codebase more navigable.

### Instructions

1. **Add missing barrel files** for these feature directories that lack them:
   - `src/features/architect/GMDashboard/index.ts`
   - `src/features/architect/tradeMachine/index.ts`
   - `src/features/tierMaker/index.ts`
   - `src/features/roster/index.ts`
   - `src/features/ranker/index.ts`

2. **Pattern to follow** (matches existing convention):

   ```ts
   export { ComponentName } from './ComponentName';
   export { useHookName } from './hooks/useHookName';
   ```

3. **Sweep relative imports**: Search for `../../../` (3+ levels deep) in non-test files and convert to `@/` alias imports. The codebase is already 10:1 in favor of `@/` — this just cleans up the stragglers.

### Validation

- `npm run typecheck`
- `npm run build`

---

## Execution Summary

| # | Plan | Estimated Scope | Key Files |
|---|------|----------------|-----------|
| 1 | Split useArchitectActions.ts | 2,035 lines → 6 files | `GMDashboard/hooks/useArchitectActions.ts` |
| 2 | Split capLegalityValidation.js | 3,952 lines → 8 files | `utils/capLegalityValidation.js` |
| 3 | Split mutationPipeline.js | 3,433 lines → 10 files | `utils/mutationPipeline.js` |
| 4 | Split 4 god components | 4,120 lines → ~20 files | EditContractModal, TradeTeamCard, TieramidBoard, SeasonAdvanceModal |
| 5 | Split useTradeMachine.js | 1,258 lines → 5 files | `hooks/useTradeMachine.js` |
| 6 | Enable strict TypeScript | Config + fix pass | `tsconfig.json` + all `.ts` files |
| 7 | Barrel files & imports | New index files + import cleanup | Feature directories |

**Total: ~14,800 lines of code reorganized into ~55 focused files.**

### Rules for All Plans (from AGENTS.md)

- All new files must be `.ts`/`.tsx`
- Use `@/` import alias everywhere
- Use named exports (no default exports except page views)
- Components must be under 200 lines
- Run `npm run validate:project` after structural changes
- New directories need `README.md` and `index.ts`
