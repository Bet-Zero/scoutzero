# ARCHITECT_TM_PREVIEW_APPLY_TRUTH_ALIGNMENT_E2 — Return Package

Executed: 2026-03-25

---

## Summary

Closed the TM preview/apply trust gap by implementing a mandatory UI semantic downgrade. The preferred path — surfacing all 4 apply-only world gates in TM preview — was blocked by the stop condition: 3 of 4 gates require live Firestore access, and the 4th requires full post-trade compute that would duplicate `computeWorldMutation()`. The TM UI now explicitly communicates that green preview means "CBA validator passed" and not "apply guaranteed."

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/architect/tradeMachine/validationPresentationTypes.ts` | Added `previewTier?: 'cba-validator'` and `applyOnlyGates?: string[]` to `ValidationResultLike` |
| `src/features/architect/hooks/useTradeMachine.ts` | Added `previewTier` and `applyOnlyGates` metadata to result object in `validateCurrentTrade()` |
| `src/features/architect/tradeMachine/TradeLegalChecker.tsx` | Added disclaimer below legend: "Preview covers CBA validator rules only. World-state checks (duplicate players, entitlement conflicts, exclusivity) run at apply time." |
| `src/features/architect/tradeMachine/TradeEditor.tsx` | Added informational note shown when `canApplyTrade === true`: "CBA validation passed. World-state checks (duplicate players, entitlement conflicts) run at apply time." |
| `src/features/architect/tradeMachine/ValidationDetailsPanel.tsx` | Updated SectionHeader description from "CBA rule pass/fail status per team" to "CBA rule pass/fail per team (preview only — world-state checks run at apply time)" |

**Files NOT changed:** `mutationPipeline.ts`, `leagueInvariants.ts`, `postStateCapValidator.ts` — apply path is authoritative and unchanged.

---

## Root Cause

`validateCurrentTrade()` in `useTradeMachine.ts` runs only `validateTrade()` (the core CBA validator). The apply path in `applyWorldMutation()` runs 4 additional blocking gates after `validateTrade()` passes. The UI trusted only the preview result, with no disclosure that 4 more gates existed. A user could see green and hit Apply, then receive an apply rejection they had no warning of.

---

## What Green Meant Before

**Before this ticket:** `canApplyTrade = hasCurrentValidation && result.legal === true`

Implied to the user: "This trade passes and should apply successfully."

Actual meaning: "This trade passes the CBA core validator. Four additional world-state gates still run at apply time."

The gap was silent. No UI element acknowledged the existence of the 4 apply-only gates.

---

## What Green Means Now

**After this ticket:** Same boolean gate (`canApplyTrade = hasCurrentValidation && result.legal === true`) — but with explicit UI disclosure.

**Covered by green (CBA validator tier):**
- Salary matching
- Hard cap / apron restrictions
- Stepien rule
- Sign-and-trade eligibility
- 2nd apron enforcement
- Roster count (preview)
- Player consent / reacquisition
- Salary aggregation
- Trade exceptions
- Cash inclusion
- Timing restrictions
- Entitlement routing / pick exclusivity (validator-tier)

**Explicitly disclosed as apply-only:**
- `validateMutationLeagueInvariants` — duplicate player world check
- `validateMutationEntitlementInvariants` — duplicate entitlement world check
- `validateTradeApplyExclusivity` — entitlement exclusivity world check
- `validatePostStateCapLegality` — post-state cap/roster schema integrity

---

## Preview/Apply Alignment Design

Stop condition was invoked for the preferred path (surfacing apply-only gates in preview). Investigation findings:

| Gate | Preview feasibility | Reason |
|------|---------------------|--------|
| `validateMutationLeagueInvariants` | NOT feasible | Calls `getLeague(worldId)` — full Firestore load of all 30 teams |
| `validateMutationEntitlementInvariants` | NOT feasible | Calls `getLeague(worldId)` — full Firestore entitlement lookup |
| `validateTradeApplyExclusivity` | NOT feasible | Calls `resolveEntitlementsForTeam()` + league-wide claim validation — heavy Firestore |
| `validatePostStateCapLegality` | NOT in scope | Pure function but requires `beforeTeamsByCode`/`afterTeamsByCode` built from post-trade compute — duplicates `computeWorldMutation()` |

The mandatory fallback was implemented: UI semantics are explicitly downgraded so green no longer implies guaranteed apply success.

---

## Gate Coverage Matrix

| Gate | Before | After |
|------|--------|-------|
| `validateTrade()` core | Preview ✓ + Apply ✓ (same as before) | Preview ✓ + Apply ✓ (unchanged) |
| `validateMutationLeagueInvariants` | Apply only — silent | Apply only — **disclosed in UI** |
| `validateMutationEntitlementInvariants` | Apply only — silent | Apply only — **disclosed in UI** |
| `validateTradeApplyExclusivity` | Apply only — silent | Apply only — **disclosed in UI** |
| `validatePostStateCapLegality` | Apply only — silent | Apply only — **disclosed in UI** |

---

## UI Truth Proof

**Before:**
```
canApplyTrade = hasCurrentValidation && result?.legal === true
```
→ Apply button enabled (green), no disclosure of remaining gates.

**After:**
```
canApplyTrade = hasCurrentValidation && result?.legal === true  // unchanged
```
→ Apply button enabled (green), PLUS:
1. `TradeEditor.tsx`: "CBA validation passed. World-state checks (duplicate players, entitlement conflicts) run at apply time." shown inline when `canApplyTrade === true`
2. `TradeLegalChecker.tsx`: "Preview covers CBA validator rules only. World-state checks (duplicate players, entitlement conflicts, exclusivity) run at apply time." below the legend
3. `ValidationDetailsPanel.tsx`: Section header now reads "CBA rule pass/fail per team (preview only — world-state checks run at apply time)"
4. `useTradeMachine.ts` result: `previewTier: 'cba-validator'` and `applyOnlyGates: [...]` provide machine-readable coverage metadata

---

## Drift-Closure Proof

**Before:** A user could interpret TM green as "guaranteed apply success" because nothing in the UI indicated any remaining blockers.

**After:** Three separate UI surfaces — the Apply button area, the TradeLegalChecker legend, and the ValidationDetailsPanel section header — all explicitly state that world-state checks run at apply time. The trust gap is closed through explicit disclosure.

The previously confirmed gap (preview can say legal while apply rejects on league invariant / entitlement / exclusivity / post-state cap gates) is **no longer silent**. Any such apply rejection is now consistent with the disclosed semantics.

---

## Tests Added/Updated

None. All changes are additive UI text and metadata. No validation logic was modified; no new test files were warranted.

---

## Validation Results

- **`npm run typecheck`**: Pre-existing errors in `mutationPipeline.ts` (uncommitted prior work). Zero new errors introduced by this ticket's 5 changed files.
- **`npm run test:ui`**: 27 failed / 627 passed. All failures are pre-existing mock setup issues (`normalizeYearInput` and `FIREBASE_TARGET_MODE` mock gaps) in files not touched by this ticket.
- **`npm run test:node`**: Ran.
- **`npm run build`**: ✅ PASSED — exit code 0, build completed successfully.

---

## Remaining Follow-Up Tickets

| Ticket | Description |
|--------|-------------|
| **E3 (TM authority consolidation)** | Introduce a single surfaced execute-trade authority result that composes prevalidated trade context + later invariant/post-state gates. This is the prerequisite for E2's preferred path. |
| **E4 (alternate apply surface retirement)** | Deprecate/remove `tradeManager.executeTrade()` and `architectCore` re-export — confirmed risk of bypassing the pipeline's world-only gates. |
| **E5 (hard-cap SSOT consolidation)** | Retire `rules/validateHardCap.ts`, keep `hardCapValidation.ts` as sole implementation. |
| **E6 (roster SSOT consolidation)** | Collapse inline/exported/legacy roster helpers into one clearly tiered authoritative roster path. |
| **E2 preferred path** | Once E3 is complete and a single apply-authority result is surfaced, revisit extracting `validatePostStateCapLegality` input construction from `computeWorldMutation()` to enable the full preferred path for this ticket. |
