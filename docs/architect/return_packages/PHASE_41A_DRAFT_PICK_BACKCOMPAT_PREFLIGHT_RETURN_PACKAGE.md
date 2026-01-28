# PHASE 41A — Draft Pick Utils Back-Compat Removal Readiness — PREFLIGHT RETURN PACKAGE

**DATE:** 2026-01-28
**AUTHOR:** Antigravity

## 1. PREFLIGHT GOAL

Determine whether it is safe to remove the backward-compat fallback in `src/features/architect/utils/draftPickUtils.js` that currently supports `teamIsAtOrAboveSecondApron` (legacy) alongside `teamIsSecondApron` (new).

## 2. FINDINGS

### 2.1 Repo-Wide Usage Scan

A grep search for `teamIsAtOrAboveSecondApron` and `isFrozenPick` revealed the following:

- **Definition**: `src/features/architect/utils/draftPickUtils.js`
  - Destructures `teamIsAtOrAboveSecondApron` to use as a fallback.
- **Production Caller**: `src/features/architect/utils/tradeMachine/rules/validateStepien.ts`
  - Imports and calls `isFrozenPick`.
  - **Status:** Uses the **NEW** key (`teamIsSecondApron: true`). It does *not* pass the legacy key to the utility.
- **Tests**: `src/tests/architect/phase40_secondApron_drift_guardrails.test.js`
  - Explicitly tests the backward compatibility by passing `{ teamIsAtOrAboveSecondApron: true }`.
- **Legacy/Other**: `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
  - Does not import or use `draftPickUtils.js`. Implements its own logic inline.

### 2.2 Categorization

| Category | File | Usage Type | Notes |
| :--- | :--- | :--- | :--- |
| **Production** | `src/features/architect/utils/draftPickUtils.js` | Definition | The utility itself (to be updated). |
| **Production** | `src/features/architect/utils/tradeMachine/rules/validateStepien.ts` | Caller | Safe. Uses `teamIsSecondApron` explicitly. |
| **Test** | `src/tests/architect/phase40_secondApron_drift_guardrails.test.js` | Test Case | Tests the back-compat logic. Will need update. |
| **Docs** | `docs/...` | Reference | Master Key docs and previous return packages. |

### 2.3 Risk Check

- **Runtime Payloads**: The `isFrozenPick` function takes a context options object as its second argument. This object is constructed ephemerally at runtime (e.g., inside `validateStepien.ts`).
- **Implicit Spreading**: No evidence was found of code spreading a state object (like `postTradeStatus`) directly into the `isFrozenPick` options. `validateStepien.ts` explicitly constructs the options object:

  ```typescript
  isFrozenPick(p, {
    teamId: team.teamId || '',
    teamIsSecondApron: true,
    currentSeason: yearKey,
  });
  ```

- **Conclusion**: There are no hidden dependencies or persisted payloads that would break if the parameter support is removed.

## 3. CONCLUSION

**STATUS: GO for Removal**

It is safe to remove `teamIsAtOrAboveSecondApron` from `draftPickUtils.js` immediately. The only required updates are:

1. Modify `draftPickUtils.js` to remove the destructive assignment and fallback logic.
2. Update `phase40_secondApron_drift_guardrails.test.js` to remove the test case verifying legacy support (or update it to verify it *ignores* legacy/only accepts new).

## 4. NEXT STEPS (Phase 41 Execution)

1. Edit `src/features/architect/utils/draftPickUtils.js` to remove `teamIsAtOrAboveSecondApron`.
2. Remove/Update legacy test cases in `src/tests/architect/phase40_secondApron_drift_guardrails.test.js`.
