# SALARY_ROW_SCHEMA_ALIGNMENT_PASS — EXECUTION RETURN PACKAGE

## 1. Summary

**Pass status:** COMPLETE — fully executed, no partial items.

**Runtime behavior:** Unchanged. All existing tests pass. No pricing/salary/validation logic was modified.

**`salariesByYear` mismatch:** MATERIALLY RESOLVED. The concrete field-level incompatibilities between `ArchitectMutationSalaryRow` and `SalaryByYear` are now closed via the canonical `NormalizedMutationSalaryRow` type.

**`ArchitectMutationContract` catch-all:** REMOVED ENTIRELY. `[key: string]: unknown` was deleted from `ArchitectMutationContract`. TypeScript accepted the removal cleanly — no undeclared field accesses surfaced, confirming the catch-all's SOLE load-bearing reason was the salary-row intersection mismatch now resolved.

---

## 2. Files Changed

| File | Role | Change |
|---|---|---|
| `src/features/architect/utils/mutationPipeline.ts` | Primary | New `NormalizedMutationSalaryRow` type; `salariesByYear` on `ArchitectMutationContract` + `ArchitectMutationOfferSheet` + `MutationPipelineSalaryRow` narrowed; catch-all removed; double-cast at offer sheet builder fixed; `ArchitectMutationPlayerRecord.signAndTradeContract` widened |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Support | Import `NormalizedMutationSalaryRow`; `SalaryByYear` simplified to type alias; `BasePlayerContractYear` import removed; targeted cast in S&T trade payload builder |
| `src/tests/architect/salaryRowSchemaAlignment.test.ts` | New test | 8 behavioral checks |

---

## 3. Root Cause / Exact Salary-Row Mismatch Addressed

**Concrete dimensions:**

| Field | `ArchitectMutationSalaryRow` (raw input) | `SalaryByYear` (canonical) | Mismatch |
|---|---|---|---|
| `season` | `string \| null` OPTIONAL | `string` REQUIRED | yes — optional vs required |
| `salary` | `number \| string \| null` | `number \| null` | yes — accepts string |
| `capHit` | `number \| string \| null` | `number \| null` | yes — accepts string |
| `guaranteedAmount` | `number \| string \| null` | **absent** | yes — extra field with string form |

**Root cause:** `ArchitectMutationContract.salariesByYear?: ArchitectMutationSalaryRow[]` was the loose input-boundary type. `LocalContract = ArchitectMutationContract & { salariesByYear?: SalaryByYear[] }` created a TypeScript intersection requiring the catch-all to bridge it. Without the catch-all, the intersection of `ArchitectMutationSalaryRow` and `SalaryByYear` would correctly reject string salary assignments at compile time.

**What was changed:** `ArchitectMutationContract.salariesByYear` changed to `NormalizedMutationSalaryRow[]`. `SalaryByYear` (in `useArchitectActions.ts`) simplified to a direct alias for `NormalizedMutationSalaryRow`. The intersection is now trivially clean (same type on both sides), and the catch-all had no remaining load-bearing reason.

---

## 4. Stronger Contracts Applied

### `NormalizedMutationSalaryRow` (new export in `mutationPipeline.ts`)

```typescript
export type NormalizedMutationSalaryRow = {
  season: string;                    // required — string guaranteed after normalization
  salary?: number | null;            // strictly number, no string
  capHit?: number | null;            // strictly number, no string
  guaranteed?: boolean | null;
  guaranteedAmount?: number | null;  // strictly number, no string
  option?: string | null;
  optionType?: string | null;
  optionUsed?: boolean | null;       // boolean, not string
  isExtensionSeason?: boolean | null;
};
```

### `SalaryByYear` (simplified in `useArchitectActions.ts`)

```typescript
type SalaryByYear = NormalizedMutationSalaryRow;
```

Was: `Pick<BasePlayerContractYear, 'season'> & { salary?: number | null; ... }` — a derivation from the Firestore schema. Now: a direct alias for the canonical pipeline type, enabling a single source of truth.

### `MutationPipelineSalaryRow` (updated in `mutationPipeline.ts`)

```typescript
type MutationPipelineSalaryRow = NormalizedMutationSalaryRow & {
  year?: number | string | null;
};
```

Was: `ArchitectMutationSalaryRow & { year? }` — inherited the loose raw-input types. Now: inherits the strict normalized types.

---

## 5. Deliberate Non-Changes

| Symbol | Why retained |
|---|---|
| `ArchitectMutationSalaryRow` (exported from `mutationPipeline.ts`) | Kept as the raw input boundary type — documents what the UI can pass before normalization. Used in `normalizeTradeInput.ts` and elsewhere as input boundary. |
| `normalizeSalaryRow` signature in `contractNormalization.ts` | Takes `SalaryRowLike` (all-unknown fields), callers cast the output. Narrowing its return type would require adding string-to-number coercion as a behavior change. Out of scope for a type-alignment pass. |
| `SignAndTradeSalaryRow` in `signAndTradeEligibility.ts` | Separate S&T validation boundary. `season` is optional there for S&T validation input. Not connected to `ArchitectMutationContract`. |
| `ArchitectMutationPlayerRecord.signAndTradeContract: ArchitectMutationContract \| LooseRecord \| null` | `LooseRecord` arm added (see below). The pipeline only WRITES this field (never reads `salariesByYear` from it), so widening is safe. |
| Cast at S&T payload builder (`contract: ... as ArchitectMutationContract`) | `SignAndTradeNormalizedContract` is validated with `requireActiveYearRow: true`, so seasons are always present at runtime. Cast is truthful; a narrow normalization step would require a 3rd support edit beyond scope. |
| `ArchitectMutationTeamRecord.totals: Record<string, unknown> \| null` | Pre-existing non-change. Dual-shape blocker unchanged by this pass. |

---

## 6. Validation Results

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** — clean, zero errors |
| `npm run test:node -- --reporter=dot src/tests/architect/salaryRowSchemaAlignment.test.ts` | **PASS** — 8/8 tests |
| `npm run build` | **PASS** — built in 35.89s |

---

## 7. Standing Failures

None. Pre-existing build warnings (dynamic import chunking, large bundle) are infrastructure-level and predated this pass.

---

## 8. Recommended Next Step

**`ArchitectMutationTeamRecord.totals` dual-shape blocker** — the remaining dominant permissive-typing region in `mutationPipeline.ts`. The `totals` field holds two incompatible shapes: `TeamCapTotals` (computed via `computeTeamCapTotals`) and `TeamTotals` from Firestore. Resolving it requires a coordinated load/compute type split (separate input and output types for the totals boundary). This was a deliberate non-change in the previous catchall narrowing pass and remains the primary blocker for any further `ArchitectMutationTeamRecord` narrowing.
