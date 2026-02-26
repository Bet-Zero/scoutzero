# Refactoring Plan 1: Decompose `useArchitectActions.ts`

## Instructions for Cursor

Follow these refactoring instructions exactly. This is a pure structural refactor — no logic changes. The public API (function names, parameters, return values) must stay identical so callers don't need to change.

**Rules:**

- All new files must be `.ts` / `.tsx`
- Use `@/` import aliases (maps to `src/`)
- Use named exports only
- After completing, run the validation commands listed at the end
- Update ALL imports across the entire codebase that reference moved/renamed files, including test files

---

## What We're Refactoring

**File:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (2,035 lines)

**Why:** This is the most-touched file in the codebase. Every mutation flows through it. Splitting it reduces merge conflicts and makes each domain independently testable.

## Target Structure

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

## Step-by-Step

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

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run test:architect -- --reporter=dot
```

Also manually verify GMDashboard still renders and can execute a signing, trade, extension, and waive.
