# Wave 8 — `mutationPipeline.compute.ts` + `mutationPipeline.helpers.ts` Split Plan

**Goal:** Break the two largest remaining pure-TypeScript files into focused modules.

**Scope:** Two files only.

| File | Before | After (est.) |
|------|--------|--------------|
| `mutationPipeline.compute.ts` | 2,472 lines | ~640 lines (orchestrator) |
| `mutationPipeline.helpers.ts` | 2,292 lines | ~1,130 lines |

---

## Target 1 — `mutationPipeline.compute.ts` (Steps 1–3)

### Structure of the current file

| Lines | Content |
|-------|---------|
| 1–105 | Imports |
| 106–453 | Trade utilities + `computeTradeResult` |
| 454–631 | Signing utilities (`resolveSigningMechanismForPipeline`, `toFiniteAmount`, `toCapHoldComputationPlayer`, `consumeSigningExceptionUsage`) |
| 632–1421 | Signing/waive/extend/option/renounce compute functions |
| 1482–2249 | Offer sheet compute functions (5 functions) |
| 2250–2384 | `computeSignAndTradeResult` |
| 2386–2472 | Tail utilities: `getMutationActionType`, `computeSetDeadCapResult` |

### Why these splits are clean

The offer sheet functions (1482–2249) share no state with the signing/trade
sections — they operate on a distinct set of current state fields. The
signing cluster (632–1421) uses shared signing utilities but doesn't call
trade or offer-sheet functions. The trade section (106–631) is foundational
for trade + sign-and-trade but is self-contained as a unit.

---

### Step 1 — Extract `mutationPipeline.compute.offerSheets.ts`

**What moves:** All 5 offer-sheet lifecycle compute functions (L1482–L2249).

**Functions:**
- `computeStoreOfferSheetResult`
- `computeMatchOfferSheetResult`
- `computeDeclineOfferSheetResult`
- `computeFinalizeMatchedOfferSheetResult`
- `computeFinalizeDeclinedOfferSheetResult`

**Dependencies (imports the new file needs):**
- Types from `./mutationPipeline.types` (many offer-sheet state types)
- Helpers from `./mutationPipeline.helpers` (state guards, normalizers)
- Read utilities from `./mutationPipeline.read` (offer-sheet read helpers)

**Pattern:** Same barrel pattern — `compute.ts` gets
`export * from './mutationPipeline.compute.offerSheets'` and an explicit
import for the 5 functions (since `export *` doesn't make them available
internally).

**Gate:** TypeScript clean + `npm run test:architect -- --reporter=dot`.

**Est. size:** ~580 lines. `compute.ts` drops from 2,472 → ~1,892.

---

### Step 2 — Extract `mutationPipeline.compute.signings.ts`

**What moves:** All non-trade, non-offer-sheet compute functions (L454–L1421
after Step 1 shifts line numbers).

**Functions:**
- `resolveSigningMechanismForPipeline`, `toFiniteAmount`,
  `toFiniteIntegerOrNull`, `sumContractValueFromRows`,
  `toCapHoldComputationPlayer`, `consumeSigningExceptionUsage`
  (signing utilities)
- `computeSigningResult`
- `computeWaiveResult`
- `computeExtensionResult`
- `computeOptionResult`
- `computeRenounceResult`
- `MANUAL_EXCEPTION_MUTATION_KEYS`, `MANUAL_EXCEPTION_MUTATION_KEY_SET`,
  `mergeManualExceptionSnapshot`, `computeSetExceptionsResult`

**Note:** `mergeManualExceptionSnapshot` is already re-exported from
`useArchitectActions.types.ts`. After extraction, importing files can use
`mutationPipeline.compute.signings.ts` directly, or continue via the barrel.

**Dependencies (imports the new file needs):**
- Types from `./mutationPipeline.types`
- Helpers from `./mutationPipeline.helpers` (state guards, normalizers)
- Cap/signing rules from external modules (same set as current compute.ts)

**Gate:** TypeScript clean + tests green.

**Est. size:** ~800 lines. `compute.ts` drops to ~1,092.

---

### Step 3 — Extract `mutationPipeline.compute.trade.ts`

**What moves:** Trade utilities and `computeTradeResult` (L106–L453).

**Functions:**
- `getTradeValidationApplyTimeSlice`
- `computeTradeResult` (and all its internal trade-validation helpers)

**Note:** `computeSignAndTradeResult` (line ~1,440 in the post-Step-2 file)
calls `computeTradeResult`. After extraction, `compute.ts` imports
`computeTradeResult` from `compute.trade.ts`.

**Dependencies (imports the new file needs):**
- Types from `./mutationPipeline.types`
- Helpers from `./mutationPipeline.helpers`
- Trade-context imports (tradeContext, tradeExecutionAuthority)
- Read utilities

**Gate:** TypeScript clean + `npm run test:architect -- --reporter=dot`
(only pre-existing phase 66–70 failures).

**Est. size:** ~450 lines. `compute.ts` drops to ~640 (orchestrator:
`computeSignAndTradeResult` + `getMutationActionType` +
`computeSetDeadCapResult` + barrel exports).

---

## Target 2 — `mutationPipeline.helpers.ts` (Step 4)

### Why not split further

The bottom half of helpers.ts (team materialization + state guards +
persistence manifests, lines 1648–2292) is called by BOTH `compute.ts`
AND `read.ts`. Moving it to a separate file risks circular imports unless
done carefully. Keep it in `helpers.ts`.

The top section — the **player normalizer stack** (lines 451–1582, ~1,130
lines) — is strictly consumed by the read pipeline and by the player
snapshot builder. It has no upstream callers in helpers.ts itself.
Extracting it is mechanical and low-risk.

---

### Step 4 — Extract `mutationPipeline.helpers.playerNorm.ts`

**What moves:** All player bio/contract/representation normalizers
(L451–L1582).

**Includes:**
- `normalizeCurrentStatePlayerBioDisplay`
- `normalizeCurrentStatePlayerBioDraft`
- `normalizeCurrentStatePlayerBio`
- `normalizeCurrentStatePlayerBirdRights`
- `normalizeCurrentStatePlayerContractBirdRights`
- `normalizeCurrentStatePlayerContractIncentives`
- `normalizeCurrentStatePlayerContractGuarantee*` (entry + schedule)
- `normalizeCurrentStatePlayerContractTradeEligibility*`
- `normalizeCurrentStatePlayerContractFreeAgency`
- `normalizeCurrentStatePlayerContractSalaryRow` + `SalaryRows`
- `projectCurrentStatePlayerContractIngress` (3 overloads)
- `pickCurrentStatePlayerContractSlice`
- `normalizeCurrentStatePlayerContract`
- `normalizeCurrentStatePlayerFutureContract`
- `normalizeCurrentStatePlayerRepresentation`
- `normalizeCurrentStatePlayerSource`
- `normalizeCurrentStatePlayerOverridePersistenceSidecar`
- `normalizeCurrentStatePlayerDraft`
- `normalizeCurrentStatePlayerRfaContext`
- `normalizeCurrentStatePlayerRfaBoundary`
- `buildCurrentStatePlayerSnapshot`
- `toCurrentStatePlayer`
- `normalizeCurrentStatePlayerSnapshot`

**What stays in `helpers.ts`:**
- All field-key constants (L104–L114)
- Team code + contract key constants (L121–L189)
- `EMPTY_WRITES_SUMMARY`
- Type conversion utilities (`asLooseRecord`, `removeUndefinedDeep`,
  `toOptional*`, etc.)
- Team materialization + state guards (`requireBasicTeamState`, etc.)
- Writes summary utilities
- Player ID + persistence manifest builders

**Dependencies (imports the new file needs):**
- Types from `./mutationPipeline.types`
- Type conversion utilities from `./mutationPipeline.helpers` (these stay
  in the bottom half — use `import type` or value import as needed)
- External imports (capHolds, seasonFormat, contractUtils, etc.)

**Gate:** TypeScript clean + `npm run test:architect -- --reporter=dot`.

**Est. size:** ~1,130 lines. `helpers.ts` drops from 2,292 → ~1,130.

---

## What remains in each file after all steps

### `mutationPipeline.compute.ts` (~640 lines)
- Imports + `export *` barrels for the 3 submodules
- `computeSignAndTradeResult` — stays here because it orchestrates both
  trade and signing, and separating it would require passing too many params
- `getMutationActionType`
- `computeSetDeadCapResult`

### `mutationPipeline.helpers.ts` (~1,130 lines)
- Field-key constants + team code constants
- `EMPTY_WRITES_SUMMARY`
- Type conversion utilities (pure scalar conversions)
- Team materialization + state guards (shared by read + compute — cannot move)
- Writes summary + player ID utilities
- Persistence manifest builders

---

## Difficulty note

**Steps 1–3** (compute.ts): All mechanical — pure TypeScript, no React, no
hooks. The main work is identifying what each submodule imports. TypeScript
will catch any missed imports immediately. Expect 1–2 fix iterations per step.

**Step 4** (helpers.ts): Moderate difficulty. The player normalizer stack
calls `toOptional*` utilities that remain in helpers.ts. The new file will
need to import these utilities back from `./mutationPipeline.helpers`.
Watch for this direction: `playerNorm.ts` → `helpers.ts` is fine (leaf
imports from sibling); avoid `helpers.ts` → `playerNorm.ts`.

---

## One step at a time

Execute one step per session. Start with Step 1 — the offer-sheet cluster
is the cleanest extraction (5 independent functions, tight domain boundary,
no cross-calls with signing or trade sections).
