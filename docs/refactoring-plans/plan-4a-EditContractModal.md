# Refactoring Plan 4A: Decompose `EditContractModal.jsx`

## Instructions for Cursor

Follow these refactoring instructions exactly. This is a pure structural refactor — no logic changes. The visual layout and behavior must remain identical.

**Rules:**

- All new files must be `.tsx`
- Use `@/` import aliases (maps to `src/`)
- Use named exports only
- Keep each component under 200 lines
- After completing, run the validation commands listed at the end
- Update ALL imports across the entire codebase that reference moved/renamed files, including test files

---

## What We're Refactoring

**File:** `src/shared/components/EditContractModal.jsx` (1,343 lines)

**Why:** Far exceeds the 200-line component limit. Handles form inputs, cap impact calculations, and validation display all in one file.

## Target Structure

```
src/shared/components/editContractModal/
├── index.ts
├── EditContractModal.tsx            (orchestrator, ~400 lines)
├── ContractActionForm.tsx           (~350 lines)
├── CapImpactSummary.tsx             (~250 lines)
└── ValidationWarningsPanel.tsx      (~200 lines)
```

## Step-by-Step

1. Create `src/shared/components/editContractModal/` directory

2. Extract `ContractActionForm.tsx` — all form inputs (action type selector, years, salary inputs), form state (`useState` for form fields), and change handlers. Props: `{ action, player, rules, teamCapSheet, onActionChange, onTeamChange }`

3. Extract `CapImpactSummary.tsx` — the cap impact tiles section. Pure display component. Props: `{ player, action, formInputs, teamCapSheet }`

4. Extract `ValidationWarningsPanel.tsx` — validation warnings and rule violations display. Props: `{ validationResult, playerRules }`

5. Rewrite `EditContractModal.tsx` as an orchestrator that renders these three sub-components. It owns the modal dialog wrapper, coordinates state between sub-components, and handles the commit action.

6. Create `index.ts` with `export { EditContractModal } from './EditContractModal'`

7. Update the import in any file that imports EditContractModal (it was previously at `@/shared/components/EditContractModal`)

## Validation

Run these commands after completing all steps:

```bash
npm run typecheck
npm run build
npm run test:architect -- --reporter=dot
```

Also manually verify the Edit Contract modal still opens, displays correctly, and can commit a contract action.
