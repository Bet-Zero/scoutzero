# MUTATION_PIPELINE_CATCHALL_NARROWING_PASS — EXECUTION RETURN PACKAGE

**Date:** 2026-03-24
**Files changed:** 2 (`mutationPipeline.ts` + new test file)

---

## 1. Summary

Pass completed **partially**. All three target boundaries were fully audited. One was partially improved (catch-all narrowed with 2 explicit fields; catch-all itself retained as load-bearing). Two are deliberate non-changes with documented justification. Runtime behavior is unchanged. All validations pass.

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/features/architect/utils/mutationPipeline.ts` | Added `firstYearSalary?: number \| null` and `year1Salary?: number \| null` to `ArchitectMutationContract` (previously implicit — only accessed via catch-all) |
| `src/tests/architect/mutationPipeline.catchallNarrowing.test.ts` | New — 4 behavioral checks covering all three target boundaries |

---

## 3. Deliberate Non-Changes

### Boundary 1: `ArchitectMutationContract[key: string]: unknown`

**Partially improved**: `firstYearSalary` and `year1Salary` are now explicitly declared. These were the only two undeclared fields accessed anywhere in the file (both in `deriveContractSummary`, lines 1979-1980). The catch-all itself was NOT removed.

**Why the catch-all remains (full analysis):**

`useArchitectActions.ts` defines:

```typescript
type LocalContract = ArchitectMutationContract &
  Omit<Partial<BasePlayerContract>, 'birdRights' | 'freeAgency' | 'salariesByYear'> & {
    salariesByYear?: SalaryByYear[];
    ...
  };
```

Removing the catch-all causes TypeScript to strictly intersect the `salariesByYear` types from `ArchitectMutationContract` (`ArchitectMutationSalaryRow[]`) and the override (`SalaryByYear[]`). This reveals that `ArchitectMutationSalaryRow` is not assignable to `SalaryByYear` for multiple reasons:

| Field | `ArchitectMutationSalaryRow` | `SalaryByYear` | Incompatibility |
|-------|------------------------------|----------------|-----------------|
| `season` | `string \| null \| undefined` (optional) | `string` (required) | optionality + nullability |
| `salary` | `number \| string \| null \| undefined` | `number \| undefined` | `string` not allowed |
| `capHit` | `number \| string \| null \| undefined` | `number \| undefined` | `string` not allowed |
| `guaranteedAmount` | `number \| string \| null \| undefined` | `number \| undefined` | `string` not allowed |

`ArchitectMutationSalaryRow` is an **input-boundary type**: the UI layer sends salary values as strings and season as an optional field. `SalaryByYear` is the **canonical schema type** (Zod-derived, strict numbers, required season). The catch-all bridges this gap in the `LocalContract` intersection pattern.

A parallel type `SignAndTradeSalaryRow` in `useArchitectActions.ts` has the same `season?: string` pattern.

**What would be required to remove the catch-all:**

**Option A — Schema alignment:** Make `ArchitectMutationSalaryRow` match `SalaryByYear` exactly:

- `season: string` (required, non-nullable)
- `salary?: number` (remove `string`)
- `capHit?: number` (remove `string`)
- `guaranteedAmount?: number` (remove `string`)
- Then fix all call sites that currently pass strings (add explicit `Number()` coercions in the normalization layer)
- Also fix `SignAndTradeSalaryRow` in `useArchitectActions.ts`

**Option B — Structural decoupling:** Restructure `LocalContract` to not extend `ArchitectMutationContract` for salary data — cleanly separate the pipeline payload type from the canonical UI type.

Both options require a dedicated audit of the `salariesByYear` data flow before touching code.

---

### Boundary 2: `ArchitectTradePayloadTeam.picksOut / picksIn: Record<string, unknown>[]`

**Unchanged.** These fields are never read or written in `mutationPipeline.ts`. In the broader system:

- `normalizeTradeInput.ts` marks the shape as "intentionally unstable"
- `tradeContext/types.ts:36` inherits via `NonNullable<ArchitectTradePayloadTeam['picksIn']>` — any narrowing cascades into the validation layer
- `validateInput.ts` casts them to `Array<ValidateInputPick | null>` when consuming

**What would be required:** A formal pick-payload schema at the input boundary + explicit normalization step before the data enters the validation chain.

---

### Boundary 3: `ArchitectMutationTeamRecord.totals: Record<string, unknown> | null`

**Unchanged.** The field receives two structurally incompatible shapes at runtime:

- `TeamCapTotals` (computed via `computeTeamCapTotals` — `yearKey`, `playersTotal`, `deadMoneyTotal`, `totalCapAllocations`, etc.)
- `TeamTotals` from Firestore (`totalSalary`, `capHit`, `guaranteedSalary`, etc.; Zod schema uses `.passthrough()`)

Dozens of existing test fixtures use `TeamTotals`-shaped objects (`{ totalSalary: 0, capHit: 0 }`), confirming the dual-shape reality is load-bearing. The `TeamTotalsZ.passthrough()` means the Firestore-loaded shape has genuinely open-ended fields.

**What would be required:** Separate input (Firestore-loaded) and output (computed) totals types — a coordinated architectural change across team loading, computation, and persistence paths.

---

## 4. Validation Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | **PASS** |
| `npm run test:node -- --reporter=dot src/tests/architect/mutationPipeline.catchallNarrowing.test.ts` | **PASS** (4/4 tests) |
| `npm run build` | **PASS** (pre-existing chunk-size and dynamic-import warnings only — not introduced by this pass) |

---

## 5. Standing Failures

None.

---

## 6. Recommended Next Step

The `ArchitectMutationContract` catch-all is the dominant remaining blocker. Its root cause is now precisely documented: `ArchitectMutationSalaryRow` is a permissive input-boundary type (strings for numeric fields, optional season) while `SalaryByYear` is the strict canonical type. The path forward is **Option A** above — a dedicated `salariesByYear` schema alignment pass:

1. Audit all sites that create or populate `ArchitectMutationSalaryRow` objects (search for `normalizeSalaryRow`, `salariesByYear:`, and cast sites)
2. Determine which coerce strings to numbers before use (these can be safely narrowed after adding `Number()` at ingress)
3. Make the field changes in `ArchitectMutationSalaryRow` and `SignAndTradeSalaryRow` together
4. Remove the catch-all from `ArchitectMutationContract`

This is a focused, contained pass — `ArchitectMutationSalaryRow` only exists in one file.
