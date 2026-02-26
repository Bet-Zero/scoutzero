# Refactoring Plan 2: Decompose `capLegalityValidation.js`

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

**File:** `src/features/architect/utils/capLegalityValidation.js` (3,952 lines)

**Why:** Largest utility file. Contains 6 exported validators and 45+ helper functions. Breaking it up makes individual CBA rules testable and navigable.

## Target Structure

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

## Step-by-Step

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

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run test:architect -- --reporter=dot
npm run test:trade -- --reporter=dot
```
