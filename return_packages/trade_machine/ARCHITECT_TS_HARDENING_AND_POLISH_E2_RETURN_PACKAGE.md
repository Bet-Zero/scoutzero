# ARCHITECT_TS_HARDENING_AND_POLISH_E2 — EXECUTION RETURN PACKAGE

## 1. Summary

The second hardening pass completed **fully** across all three primary target files. Runtime behavior is **unchanged**. The pass stayed **inside scope** — no workflow redesigns, no component splits, no broad contract/schema rewrites. Architect's type quality improved materially again:

- 3 index signature bags (`[key: string]: unknown`) removed from `useCapValidation.ts`
- 2 nested type shapes closed with full canonical field coverage (`extensionEligibility`, `extensionTerms`)
- 1 missing field added (`eligibleDate`) that was accessed at runtime but never declared in the type
- 2 dead props removed (`playersMap`) across CapSheet and CapSheetFull
- 2 callback signatures narrowed from `unknown` to observed shapes
- 1 string literal union added (`CapSheetActionType`) replacing a loose `string`
- 1 function parameter narrowed from `unknown` to `string | null | undefined`
- 1 double-cast (`as unknown as`) eliminated
- 2 opaque `Parameters<typeof ...>` casts replaced with readable explicit casts
- 1 unnecessary `as string` cast removed

The EditContractModal boundary cast (`as unknown`) was tested for removal but **could not be eliminated** without widening into EditContractModal's local type system. Left in place as documented.

## 2. Files Changed

### In-scope runtime files edited
| File | Changes |
|------|---------|
| `src/features/architect/hooks/useCapValidation.ts` | Closed `extensionEligibility` + `extensionTerms` sub-types, removed 3 index signatures, added `eligibleDate`, simplified casts |
| `src/features/architect/capSheet/CapSheet/CapSheet.tsx` | Removed dead `playersMap` prop, narrowed callback signatures, replaced opaque capHolds cast |
| `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx` | Removed dead `playersMap` prop, added `CapSheetActionType` union, narrowed `normalizeFAType`, removed `computeTeamCapTotals` cast |
| `src/features/architect/GMDashboard/sections/CapSheetSection.tsx` | Removed `playersMap` JSX pass (prop removed from CapSheet) |
| `src/features/architect/GMDashboard/sections/CapTableSection.tsx` | Removed `playersMap` JSX pass (prop removed from CapSheetFull) |

### Tests added
| File | Purpose |
|------|---------|
| `src/tests/architect/architectHardeningE2.polish.test.ts` | 9 regression tests covering `buildSigningGuardrails` output shapes |

### Return package
| File |
|------|
| `return_packages/trade_machine/ARCHITECT_TS_HARDENING_AND_POLISH_E2_RETURN_PACKAGE.md` |

## 3. Hardening Changes Completed

### `useCapValidation.ts`
- **Closed `extensionEligibility`**: Removed `[key: string]: unknown` index signature, added 3 missing canonical fields (`eligibleDate`, `blockers`, `extensionType`). `eligibleDate` was already accessed at CapSheet.tsx:179 and CapSheetFull.tsx:90 but never declared.
- **Closed `extensionTerms`**: Removed `[key: string]: unknown`, added 3 missing canonical fields (`raisePercentage`, `basedOn`, `notes`).
- **Removed `CapValidationPlayer` index signature**: Hook only accesses `player.contract`; structural subtyping handles wider caller objects.
- **Removed `ContractDataLike` index signature**: All accessed fields are explicitly declared; callers pass objects with extra properties via structural compatibility.
- **Exception type casts**: Replaced double `as keyof typeof` lookup with `in` guard (line 245). Removed unnecessary `as string` cast (line 470).
- **`calculateTeamCapHitLocal`**: Eliminated `as unknown as` double-cast — `CalculateCapHitOptions.getContractYearSlice` already accepts `any` for the player parameter, so direct assignment works.
- **Deliberate non-change**: `SalaryByYearLike.season` kept as required `string` (not made optional to match EditContractModal's `ContractSalaryRowLike`). The hook's defensive `String(y.season)` is a fallback, not an expected path.

### `CapSheet.tsx`
- **Removed `playersMap?: unknown`**: Dead prop — never destructured or referenced in component body. Cascade: removed from CapSheetSection.tsx JSX pass.
- **Narrowed callbacks**: `onSetDeadCap` parameter narrowed from `unknown` to `unknown[]` (matching ManageDeadMoneyModal's `onSave` signature). `onSetExceptions` parameter narrowed from `unknown` to `Record<string, unknown>`. Return type simplified to `void` for compatibility with test mocks.
- **Replaced `capHolds` cast**: Changed from opaque `as Parameters<typeof getActiveUnsignedCapHoldsByEndYear>[0]` to explicit `as CapHold[]` with direct import.

### `CapSheetFull.tsx`
- **Removed `playersMap?: unknown`**: Dead prop. Cascade: removed from CapTableSection.tsx JSX pass.
- **Added `CapSheetActionType`**: Exported literal union `'rfa' | 'ufa' | 'po' | 'to' | 'renounce'` replacing loose `string` on `onActionClick.action`.
- **Narrowed `normalizeFAType`**: Parameter from `unknown` to `string | null | undefined`, added explicit return type `string | null`.
- **Removed `computeTeamCapTotals` cast**: The `as Parameters<typeof computeTeamCapTotals>[0]` cast was unnecessary — structural compatibility holds between the component's `TeamCapSheetLike` and the function's parameter type.

### `NumericLike` — deliberate non-narrowing
`NumericLike` was kept as `number | string | null | undefined` in both CapSheet files. Verification showed that Firestore data loads without Zod validation (direct `as` cast, no schema parsing), so legacy data with string amounts could flow through. Both components already use `Number()` defensively. Narrowing would hide this fragility rather than fix it.

## 4. Types Improved

| Improvement | Before | After |
|-------------|--------|-------|
| `RulesProfileLike.extensionEligibility` | Open bag with `[key: string]: unknown` | Closed: `isEligible`, `reason`, `eligibleDate`, `blockers`, `extensionType` |
| `RulesProfileLike.extensionTerms` | Open bag with `[key: string]: unknown` | Closed: 7 explicit fields, no index signature |
| `CapValidationPlayer` | `{ contract?: ...; [key: string]: unknown }` | `{ contract?: ContractLike \| null }` |
| `ContractDataLike` | 5 fields + `[key: string]: unknown` | 5 explicit fields, no index signature |
| `CapSheet.onSetDeadCap` | `(deadCap: unknown) => unknown` | `(deadCap: unknown[]) => void` |
| `CapSheet.onSetExceptions` | `(exceptions: unknown) => unknown` | `(exceptions: Record<string, unknown>) => void` |
| `CapSheetFull.onActionClick.action` | `string` | `CapSheetActionType` (5-member literal union) |
| `CapSheetFull.normalizeFAType` | `(type: unknown) => ...` | `(type: string \| null \| undefined): string \| null` |
| `calculateTeamCapHitLocal` | `as unknown as (...)` double-cast | Direct assignment (no cast on `getContractYearSlice`) |
| capHolds casts (both files) | `as Parameters<typeof ...>[0]` | `as CapHold[]` explicit import |
| `computeTeamCapTotals` cast | `as Parameters<typeof computeTeamCapTotals>[0]` | No cast needed |
| Dead `playersMap` props | `unknown` on both components | Removed entirely |

## 5. Validation / Regression Coverage Run

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | **PASS** | 0 errors |
| `npm run test:node -- --reporter=dot src/tests/architect/architectHardeningE2.polish.test.ts` | **PASS** | 9/9 tests, 12ms |
| `npm run build` | **PASS** | 42s, no errors |
| `npm run validate:project` | **PASS** | All validations passed |

### Intentionally skipped
| Command | Reason |
|---------|--------|
| `npm run test:full` | Not allowed by default per execution prompt |
| `npm run test:architect` | Not allowed by default per execution prompt |
| `npm run test:trade` | Not allowed by default per execution prompt |
| `npm run test:diff` | Not allowed by default per execution prompt |

### Test stabilization
None required. No existing tests failed due to the hardening changes.

## 6. Remaining Weak Areas

### EditContractModal boundary cast (high)
`src/shared/components/EditContractModal.tsx:525` — `as unknown) as { ... }` remains. Root causes:
1. `PlayerLike.contract.salariesByYear` uses `ContractSalaryRowLike` where `season` is optional; hook's `SalaryByYearLike` requires it
2. `SigningGuardrailsLike` in EditContractModal drops `qoAmount`, `birdRightsType`, `canSignToMax` from the full `SigningGuardrails`
3. `TeamCapSheetLike` in EditContractModal includes `[key: string]: unknown` and `PlayerLike[]` vs hook's `CapValidationPlayer[]`

Fixing requires either aligning EditContractModal's local types with the hook's types, or making the hook types more permissive. Both are multi-file scope widening.

### Parent container `any` callbacks (medium)
`CapSheetSection.tsx` and `CapTableSection.tsx` still use `(...args: any[]) => any` for callbacks. These erase type information at the container boundary. The cap sheet components now have tighter prop types, but the parents cast through `any`.

### `PlayerRulesProfileTeamCapSheet` shared type (medium)
`src/features/architect/types/playerRulesProfiles.ts` — `capHolds?: unknown[]`, `deadCap?: unknown[]`, `exceptions?: Record<string, unknown>`. These broad types propagate through all cap sheet components and force casts at every boundary.

### `NumericLike` still broad (low)
Both CapSheet files keep `NumericLike = number | string | null | undefined` for `CapHoldLike.amount`. This is correct while Firestore data loads without schema validation. If Zod parsing is added to the team data loader, `NumericLike` can be narrowed.

### `schemaAdapter.ts` (low)
`UnknownRecord` usage is intentional defensive typing. Low value to harden further in isolation.

## 7. Post-Pass Status

Architect has **materially advanced again**. The two hardening passes together have:
- Eliminated all `any`-family patterns (E1)
- Closed the most significant index signature bags (E2)
- Added typed literal unions for known value sets (E2)
- Narrowed callback and function parameter types to observed shapes (E2)
- Added `eligibleDate` to close a type-vs-runtime gap (E2)
- Added 21 regression tests across both passes

The remaining weak areas are now **smaller and more clearly bounded**:
- EditContractModal cast is a cross-file type alignment issue (not a local weakness)
- Parent container `any` callbacks are a container-level pattern (not component-level)
- `PlayerRulesProfileTeamCapSheet` shared type broadness is a shared-types concern (not architect-specific)

Architect is still **partially hardened** in the sense that these remaining weak areas exist, but the highest-value local improvements are now done.

## 8. Recommended Next Actions

1. **EditContractModal type alignment** — align `PlayerLike`, `SigningGuardrailsLike`, and `TeamCapSheetLike` with the hook's types to eliminate the `as unknown` boundary cast. This is a focused cross-file scope with clear boundaries.

2. **Parent container callback typing** — tighten `CapSheetSection.tsx` and `CapTableSection.tsx` callback signatures from `(...args: any[]) => any` to match child component prop types.

3. **`PlayerRulesProfileTeamCapSheet` narrowing** — replace `unknown[]` on `capHolds`, `deadCap`, etc. with canonical `CapHold[]`, `DeadCapItemLike[]`. This would eliminate casts across all cap sheet components.

4. **Firestore data validation** — add Zod parsing at the team data loader boundary to enforce `CapHoldItemZ` and other schemas. This would make `NumericLike` narrowing safe.

The recommended next lane is **#1 (EditContractModal type alignment)** as it has the highest remaining impact and clear scope boundaries.
