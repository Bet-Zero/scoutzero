# Refactoring Plan 4D: Decompose `SeasonAdvanceModal.jsx`

## Instructions for Cursor

Follow these refactoring instructions exactly. This is a pure structural refactor — no logic changes. The visual layout and behavior must remain identical.

**Rules:**

- All new files must be `.tsx` (components) or `.ts` (utils)
- Use `@/` import aliases (maps to `src/`)
- Use named exports only
- Keep each component under 200 lines
- After completing, run the validation commands listed at the end
- Update ALL imports across the entire codebase that reference moved/renamed files, including test files

---

## What We're Refactoring

**File:** `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx` (789 lines)

**Why:** Contains a multi-step wizard with 5 distinct render functions, helper utilities for data extraction, and modal shell logic all in one file. Each wizard step is already a natural extraction boundary.

## Target Structure

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

## Step-by-Step

1. Extract `utils/seasonAdvanceHelpers.ts` — pure data extraction functions: `findPlayersWithOptions`, `findExpiringContracts`, `findExpiringCapHolds`, `findExpiringTPEs`. These are currently defined as helper functions at the top of the file (lines ~43-184). They have no React dependencies.

2. Extract `DataSummaryStep.tsx` — the `renderSummaryStep()` function (lines ~404-509) becomes its own component. Props: `{ fromSeason, toSeason, expiringContracts, hasOptions, playersWithOptions, expiringCapHolds, expiringTPEs, worldId }`

3. Extract `OptionDecisionsStep.tsx` — the `renderOptionsStep()` function (lines ~511-580) becomes its own component. Props: `{ playersWithOptions, optionDecisions, toSeason, onOptionChange }`

4. Extract `ConfirmationStep.tsx` — the `renderConfirmationStep()` function (lines ~582-635) becomes its own component. Props: `{ fromSeason, toSeason, optionDecisions, playersWithOptions }`

5. Extract `ResultSteps.tsx` — combine `renderProcessingStep()` (lines ~637-645) and `renderCompleteStep()` (lines ~647-662) into one small component since they're both tiny. Props: `{ isProcessing, toSeason, result }`

6. Rewrite `SeasonAdvanceModal.tsx` as the orchestrator. It keeps:
   - Wizard state (currentStep, optionDecisions, isProcessing, error, result)
   - Navigation logic (handleNext, handleBack, handleAdvanceSeason)
   - Modal shell (backdrop, header, footer buttons)
   - Renders the correct step component based on currentStep

7. Create `index.ts` with `export { SeasonAdvanceModal } from './SeasonAdvanceModal'`

8. Update the import in any file that imports SeasonAdvanceModal (search the codebase for all references)

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run build
npm run test:architect -- --reporter=dot
```

Also manually verify the Season Advance modal still opens from the GM Dashboard, all wizard steps render correctly, and advancing a season completes successfully.
