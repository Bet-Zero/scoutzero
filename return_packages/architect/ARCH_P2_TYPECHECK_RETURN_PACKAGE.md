# ARCH P2 — Typecheck Stabilization Return Package

**Date:** 2026-02-14
**Status:** ✅ COMPLETE — `npm run typecheck` exits 0

---

## Executive Summary

| Gate           | Before | After |
|----------------|--------|-------|
| `npm run typecheck` | ❌ 655 errors (pre-install) / 27 errors (post-install) | ✅ 0 errors — exit 0 |
| `npm run build`     | ✅ pass | ✅ pass |
| `npm run test -- --run` | ✅ 230 files, 3015 pass | ✅ 230 files, 3015 pass |

The vast majority of errors (628 of 655) were caused by missing `node_modules` (type declarations not present until `npm install` runs). The remaining 27 real type errors were in test files (26) and one scrape script (1). All were fixed with minimal, behavior-preserving changes.

---

## Error Triage Table

### Category A: Architect Runtime Source Files — 0 errors

No errors in architect runtime source files after `npm install`.

### Category B: Non-Architect Runtime Source Files — 0 errors

No errors in non-architect runtime source files after `npm install`.

### Category C: Tests — 26 errors (FIXED)

| Error Code | Count | File | Root Cause | Fix Applied |
|------------|-------|------|------------|-------------|
| TS2345 | 8 | `src/tests/architect/dare/phase17_3_ladders_and_conversion_guardrail.test.ts` | `makeLadder` return type not assignable to `ProtectionLadder` due to extra `'convey'` in ifTriggered union | Added return type annotation `: ProtectionLadder` and cast `ifTriggered as 'roll' \| 'convert' \| 'cancel'` |
| TS2339 | 4 | `src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts` | Firestore `data()` returns `unknown`; accessing `.roster` and `.contract` on unknown | Added type assertions: `as Record<string, unknown>` for team data, `as Record<string, Record<string, unknown>>` for player data |
| TS2556 | 3 | `src/tests/architect/pickRightWizard.vacuumApply.test.tsx` | Spread `...args: unknown[]` can't be passed to mock functions without rest params | Changed `unknown[]` → `any[]` in mock factory; added `..._args: any[]` to mock fn definitions |
| TS2739 | 5 | `src/tests/architect/vacuumE3.advancedEditorLock.test.tsx` | `baseFormState` missing `underlyingStatus` and `swapType` properties required by `EntitlementFormState` | Added missing properties and explicit type annotation |
| TS2493 | 3 | `src/tests/architect/vacuumE3.advancedEditorLock.test.tsx` | `vi.fn(() => ...)` with no params produces empty tuple type for `.mock.calls[0][0]` | Changed `vi.fn(() => ...)` → `vi.fn((_json: string) => ...)` |
| TS2345 | 3 | `src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts` | Test envelope objects missing `transfers` property required by `OverlayEnvelope` | Added `transfers: {}` to all three test envelope objects |

### Category D: Scripts/Tooling — 1 error (FIXED)

| Error Code | Count | File | Root Cause | Fix Applied |
|------------|-------|------|------------|-------------|
| TS2322 | 1 | `team-scrape/shared/firestore_staging/scripts/stage_team.ts` | Object literal not structurally assignable to `BaseTeamDoc & {...}` (extra/mismatched fields) | Changed local variable to `Record<string, unknown>`, added return type assertion |

---

## File-by-File Change List

### 1. `src/tests/architect/dare/phase17_3_ladders_and_conversion_guardrail.test.ts`
- Added `ProtectionLadder` to type imports
- Added `: ProtectionLadder` return type to `makeLadder()` function
- Added `as 'roll' | 'convert' | 'cancel'` cast on `ifTriggered` in map

### 2. `src/tests/architect/dare/phaseD4_true_e2e_emulator_gate.emulator.test.ts`
- Added `as Record<string, unknown> | undefined` assertion to `atlBaseSnap.data()`
- Extracted `atlRoster` variable with proper typing
- Added `as Record<string, Record<string, unknown>> | undefined` to `playerSnap.data()`

### 3. `src/tests/architect/pickRightWizard.vacuumApply.test.tsx`
- Changed mock function parameter types from `unknown[]` to `any[]` (3 mock fn definitions)
- Changed vi.mock factory args from `unknown[]` to `any[]` (7 entries)

### 4. `src/tests/architect/vacuumE3.advancedEditorLock.test.tsx`
- Added import for `EntitlementFormState` type
- Added `underlyingStatus: 'clean'` and `swapType: ''` to `baseFormState`
- Added `: EntitlementFormState` type annotation to `baseFormState`
- Changed 3× `vi.fn(() => ...)` to `vi.fn((_json: string) => ...)`

### 5. `src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts`
- Added `transfers: {}` to 3 test envelope objects (lines ~84, ~240, ~275)

### 6. `team-scrape/shared/firestore_staging/scripts/stage_team.ts`
- Changed `baseDoc` variable type from explicit `BaseTeamDoc & {...}` to `Record<string, unknown>`
- Added explicit return type assertion at function end
- Changed `deadCap: []` to `deadCap: [] as BaseTeamDoc['deadCap']`

---

## Validation Results

| Validation | Status | Details |
|------------|--------|---------|
| `npm run typecheck` | ✅ PASS | Exit code 0, zero errors |
| `npm run build` | ✅ PASS | Built in ~9.5s, standard chunk size warnings |
| `npm run test -- --run` | ✅ PASS | 230 files, 3015 passed, 1 skipped, 3 todo |

---

## ts-ignore / ts-expect-error Usages

**None added.** All fixes use proper type annotations, assertions, or structural fixes. No `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck` directives were introduced.

---

## Logs

- Before: [`return_packages/architect/_logs/ARCH_P2_typecheck_before.txt`](./_logs/ARCH_P2_typecheck_before.txt)
- After: [`return_packages/architect/_logs/ARCH_P2_typecheck_after.txt`](./_logs/ARCH_P2_typecheck_after.txt)
- Build: [`return_packages/architect/_logs/ARCH_P2_build.txt`](./_logs/ARCH_P2_build.txt)
- Test: [`return_packages/architect/_logs/ARCH_P2_test.txt`](./_logs/ARCH_P2_test.txt)
