# Architect TypeScript Hardening — Deferred Work

**Status as of 2026-04-16:** The 7-sweep type quality pass is complete. `tsc --noEmit` is clean. Every remaining `any`, `as never`, and catch-all type alias has a justifying comment in source. This document catalogs the work that was _intentionally deferred_ — cases where narrowing is correct but requires a coordinated architectural change beyond a single-file edit.

---

## Item 1 — Export `PickRuleDoc` and fix prop types in TradeSummaryPanel / TradeReceiptPanel

**Effort:** Small (~30 min)

**The problem:**
`TradeSummaryPanel.tsx` and `TradeReceiptPanel.tsx` both call a function that expects `Record<string, PickRuleDoc>`. The prop passed in is typed `Record<string, unknown>` because `PickRuleDoc` is not exported from its source file. Both call sites use `pickRulesById as any` to silence the error.

**Where the fix lives:**

- `src/features/architect/utils/entitlements/entitlementPickRowProjection.ts` — add `export` to the `PickRuleDoc` type definition
- `src/features/architect/tradeMachine/TradeSummaryPanel.tsx` — update prop type and remove `as any`
- `src/features/architect/tradeMachine/TradeReceiptPanel.tsx` — same

**What to verify after:** Both components still render pick rows correctly. No runtime change expected.

---

## Item 2 — Narrow `ArchitectMutationPayload` to include legacy `receiving`/`playersReceiving` fields

**Effort:** Small–Medium (~1–2 hrs)

**The problem:**
Two functions in `src/features/architect/utils/leagueInvariants.ts` — `extractIncomingPlayers` and `validateMutationLeagueInvariants` — accept `payload: any` because they access fields (`payload.teams[].receiving`, `payload.teams[].playersReceiving`) that don't exist in the formal `ArchitectMutationPayload` type. These are legacy field names from earlier versions of the trade payload shape that some code paths still send.

**Where the fix lives:**

- Audit all call sites of `validateMutationLeagueInvariants` to confirm which payload shape(s) are actually passed
- Either: add `receiving?: string[]; playersReceiving?: string[]` to the team entries in `ArchitectMutationPayload`, or create a `LegacyMutationPayload` intersection type
- Update `extractIncomingPlayers` and `validateMutationLeagueInvariants` signatures to use the narrowed type
- Remove `payload: any` from both function signatures

**What to verify after:** `validateMutationLeagueInvariants` tests (if any); confirm trade execution still passes league invariant checks.

---

## Item 3 — Resolve `ArchitectContract` catch-all index signature

**Effort:** Medium (~half day)

**The problem:**
`ArchitectContract` (defined in `src/features/architect/utils/constants/types.ts` or similar) carries `[key: string]: unknown` because callers access fields like `contract.years`, `contract.contractYears`, `contract.salariesByYear`, etc. that were never explicitly declared. The catch-all silences errors across dozens of call sites.

**Where the fix lives:**

1. Run a grep for all field accesses on `ArchitectContract`-typed variables: `contract\.years`, `contract\.contractYears`, `contract\.firstYearSalary`, `contract\.salariesByYear`, `contract\.originalLength`, etc.
2. Add all observed fields as explicit optional fields on `ArchitectContract`
3. Remove `[key: string]: unknown`
4. Fix any remaining type errors at call sites

**What to verify after:** `tsc --noEmit` clean. Mutation pipeline tests pass (these exercise contract reads heavily).

---

## Item 4 — Split `ArchitectMutationTeamRecord.totals` into load type vs. compute type

**Effort:** Medium–Large (~1 day)

**The problem:**
`ArchitectMutationTeamRecord.totals` is typed `Record<string, unknown> | null` because it is dual-shaped depending on context:

- **Computed path** (result of `computeTeamCapTotals`): shape is `TeamCapTotals` with fields like `yearKey`, `playersTotal`, `capHit`, `totalSalary`
- **Firestore load path**: shape is `TeamTotals` from Firestore (uses `.passthrough()` in Zod), with fields like `totalSalary`, `capHit` but NOT `yearKey`/`playersTotal`

These two shapes are structurally incompatible. Dozens of test fixtures use the Firestore shape. Narrowing to either concrete type breaks the other path.

**Where the fix lives:**

1. Define a `LoadedTeamCapTotals` type (Firestore shape: `totalSalary`, `capHit`, optional loose fields)
2. Define or confirm `ComputedTeamCapTotals` type (the output of `computeTeamCapTotals`)
3. Change `totals` to a union: `LoadedTeamCapTotals | ComputedTeamCapTotals | null`
4. Add type guards where code switches between the two shapes, or unify the shapes if they can be made compatible
5. Update test fixtures to use the proper shape

**What to verify after:** All cap totals tests, cap sheet display, season advance tests (which recompute totals). Full `tsc --noEmit`.

---

## Item 5 — Fix `as never` casts caused by JS-migrated utility functions

**Effort:** Large (~1–2 days)

**The problem:**
Several components (`TradePlayerRow.tsx`, `CapImpactTiles.tsx`, `OutgoingPlayersList.tsx`, `EntitlementPickRow.tsx`, `miscRules.ts`) use `as never` casts to pass arguments to JS-migrated utility functions. The casts exist because the utility functions were migrated from JS to TS with internal types that either:

- Expect a branded `SeasonId` type (not `string | number`)
- Expect an internal player/team shape not assignable from the local component's types

**Specific cast sites:**

| File                      | Cast(s)                                                                     | Root cause                                                                 |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `TradePlayerRow.tsx`      | `player as never`, `yearKey as never`, context objects `as never` (5 casts) | JS-migrated utils expect internal player shape; `PlayerLike` is too narrow |
| `CapImpactTiles.tsx`      | `yearKey as never` (4×), `sends as never`, `incomingPlayers as never`       | Branded `SeasonId` vs `string\|number` mismatch                            |
| `OutgoingPlayersList.tsx` | `player as never`, `yearKey as never`                                       | Same pattern as TradePlayerRow                                             |
| `EntitlementPickRow.tsx`  | `entitlement as never`, args `as never`                                     | `EntitlementLike` doesn't satisfy `ProjectionEntitlement` required fields  |
| `miscRules.ts`            | `allTeams as never`                                                         | Validator expects internal team shape                                      |

**Recommended approach:**
The cleanest fix is to export the internal types from the JS-migrated utilities and widen the function signatures to accept the component-side types — not to make the components conform to internal types.

1. Identify which utility functions are being called at each `as never` cast site
2. For `SeasonId` branded type mismatches: either un-brand `SeasonId` (make it `string | number`) or add an overload/widened signature
3. For player/team shape mismatches: export the expected type and check if `PlayerLike` in the component can be extended to satisfy it, or widen the utility function's parameter type
4. For `EntitlementLike` vs `ProjectionEntitlement`: add the missing required fields to `EntitlementLike` or make the required fields optional in `ProjectionEntitlement`

**What to verify after:** All trade machine render tests. Entitlement display tests. No visual regression in trade summary UI.

---

## Item 6 — Source-scan guardrail test failures (pre-existing, unrelated to type hardening)

**Status:** 57 test failures exist in the suite today. These are NOT regressions from the type hardening pass. The majority are source-scan tests from phases 61, 64, and 65 that grep for specific code patterns (variable names, call signatures) that changed shape during earlier refactors.

**Affected test files:**

- `phase61_persistence_contract_allowlist_guardrails.test.js`
- `phase64_tpe_canonicalization_no_legacy_persist_guardrails.test.js`
- `phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`

These tests need their grep patterns updated to match the current code shape. This is distinct from type hardening — it is a test maintenance task.

---

## Summary table

| #   | Item                                       | Effort       | Touches tests?                   |
| --- | ------------------------------------------ | ------------ | -------------------------------- |
| 1   | Export `PickRuleDoc`, fix prop types       | Small        | No                               |
| 2   | `leagueInvariants.ts` payload field audit  | Small–Med    | Yes (league invariant tests)     |
| 3   | `ArchitectContract` catch-all removal      | Medium       | Yes (mutation pipeline tests)    |
| 4   | `totals` dual-shape split                  | Medium–Large | Yes (cap totals, season advance) |
| 5   | `as never` casts in trade components/utils | Large        | Yes (trade machine render tests) |
| 6   | Source-scan guardrail test pattern updates | Medium       | Yes (phases 61, 64, 65 tests)    |

Items 1 and 2 can be done independently at any time. Items 3, 4, and 5 each require reading a breadth of call sites before touching anything. Item 6 is test maintenance entirely separate from type work.
