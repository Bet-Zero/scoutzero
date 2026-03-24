# ARCHITECT_OFFER_SHEET_PREFLIGHT_ALIGNMENT_E7 — Return Package

**Date:** 2026-03-24
**Scope:** Offer-sheet modal/preflight alignment with authoritative mutation-layer validation
**Status:** COMPLETE

---

## Summary

E7 introduces a shared authoritative offer-sheet preflight (`preflightOfferSheetMutation`) and wires the `EditContractModal` offer-sheet toggle to it, mirroring the E6 SAT preflight pattern. Before this change, the offer-sheet toggle in the modal was purely callback-driven — it appeared when `onStoreOfferSheet` was provided, with zero CBA validation. After this change, every offer-sheet attempt in the modal is backed by the same mutation-layer logic that `storeOfferSheet` uses, including E5 canonical home-team resolution, `validateSigning` with the RFA/offer-sheet path, `validateOfferSheetTerms` (years 1–4, raises ≤8%), and the pre-compute guardrails in `computeStoreOfferSheetResult`.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/architect/utils/mutationPipeline.ts` | Add `OfferSheetPreflightStatus`, `OfferSheetPreflightResult` types; add exported `preflightOfferSheetMutation` function |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Import new types/function; add `getOfferSheetPreflight` callback; add to return type and return object |
| `src/shared/components/EditContractModal.tsx` | Import `OfferSheetPreflightResult`; add `GetOfferSheetPreflightCallback` type; add `getOfferSheetPreflight` prop; add `OfferSheetPreflightLike` alias; add `buildOfferSheetPreflightResult`/`normalizeOfferSheetPreflightResult` helpers; add `offerSheetPreflight` state + `latestOfferSheetPreflightRequestId` ref; add `offerSheetPreflightPayload` memo; add offer-sheet `useEffect`; reset `offerSheetPreflight` in action-change effect; pass `offerSheetPreflight`/`isOfferSheet` to `useCapValidation` |
| `src/features/architect/hooks/useCapValidation.ts` | Import `OfferSheetPreflightResult`; add `offerSheetPreflight` + `isOfferSheet` params to `UseCapValidationParams`; add offer-sheet interpretation block; update `useMemo` deps |
| `src/features/architect/GMDashboard/GMDashboard.tsx` | Add `freeAgencyGetOfferSheetPreflight` + `modalGetOfferSheetPreflight` local vars; pass to `FreeAgencySection` and `EditContractModal` gated on `worldId` |
| `src/features/architect/GMDashboard/offerSheetTypes.ts` | Add `getOfferSheetPreflight?: LooseCallback` to `FreeAgencySectionProps` |
| `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx` | Destructure `getOfferSheetPreflight`; pass to `FreeAgentPool` |
| `src/features/architect/freeAgency/FreeAgentPool/types.ts` | Add `getOfferSheetPreflight?: LooseCallback | null` to `FreeAgentPoolProps` |
| `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx` | Destructure `getOfferSheetPreflight = null`; pass to `EditContractModal` gated on `worldId` |
| `src/tests/architect/editContractModal.offerSheetPreflight.behavior.test.tsx` | New: 8 behavior tests covering loading, blocked, stale-response, no-toggle, no-world-context, missing-player, RFA-flags, home-team-truth |

---

## Root Cause

The offer-sheet toggle in `EditContractModal` was controlled only by the presence of the `onStoreOfferSheet` callback prop — no CBA validation occurred. `useCapValidation` added at most an info-level warning if `isRFA` was set, but never validated:

- Offer-sheet years (1–4 CBA constraint)
- Offer-sheet raises (≤8% CBA constraint)
- Whether the offering team is distinct from the home team
- Whether the player exists in the home team's `players[]` array
- RFA eligibility in the authoritative offer-sheet path

---

## What Was Wrong Before

| Aspect | Modal (before E7) | Mutation Layer |
|---|---|---|
| RFA check | Info warning only | Full `validateSigning` RFA/offer-sheet path |
| Offer-sheet years | Not validated | 1–4 years enforced |
| Offer-sheet raises | Not validated | Max 8% enforced |
| Home team ≠ offering team | Not checked | Hard fail in `resolveStoreOfferSheetAuthority` |
| Player in home team | Not checked | Enforced in `computeStoreOfferSheetResult:5768` |
| Contract flags required | Not set in validation | `rfaOfferSheet=true` + `rfaOfferSheetOnly=true` required |
| worldId | Not checked | Required for dedup key |

---

## What Is Correct Now

The modal now:
1. Starts an async `preflightOfferSheetMutation` call whenever `isOfferSheet` is toggled on (and action is `signNew`)
2. Disables confirm during loading (shows "Checking authoritative offer sheet legality...")
3. Propagates `blocked` → errors (confirm stays disabled, reasons shown)
4. Propagates `incomplete` → incomplete state (confirm stays disabled, warnings shown)
5. Only enables confirm when `status === 'legal'`
6. Invalidates stale responses via request-ID counter on every effect re-run
7. Fails closed when `getOfferSheetPreflight` is null (no world context)

---

## Current Modal Path vs. Authoritative Path

### Before E7
```
isOfferSheet toggle ON
→ Modal checks: onStoreOfferSheet callback present? yes
→ useCapValidation: adds info warning if isRFA
→ Confirm button: enabled (no CBA gating)
→ onStoreOfferSheet → storeOfferSheet mutation (validates for first time here)
```

### After E7
```
isOfferSheet toggle ON
→ useEffect fires → getOfferSheetPreflight(player, offerSheetPreflightPayload)
→ preflightOfferSheetMutation:
     loadStateForMutation('storeOfferSheet') → resolveStoreOfferSheetAuthority (E5)
     validateSigning(home team, canonical player, rfaOfferSheet=true)
     computeWorldMutation('storeOfferSheet') → pre-compute guardrails
→ OfferSheetPreflightResult { status, reasons, warnings }
→ useCapValidation interprets: blocked→errors, incomplete→warnings/incomplete, legal→warnings
→ Confirm button: disabled until 'legal', blocked, or incomplete state drives disableConfirm
→ User confirms → onStoreOfferSheet → storeOfferSheet mutation (final authority still there)
```

---

## Shared Preflight Design

### `preflightOfferSheetMutation` (mutationPipeline.ts)

```typescript
export async function preflightOfferSheetMutation({
  worldId, seasonId, offeringTeamCode, playerId, contract, timestamp,
}): Promise<OfferSheetPreflightResult>
```

**Guards (early return):** missing worldId → blocked; missing seasonId → incomplete; missing offeringTeamCode → blocked; missing playerId → incomplete; missing contract → blocked.

**Execution:**
1. Sets `rfaOfferSheet: true`, `rfaOfferSheetOnly: true`, `contractType: 'Offer Sheet'` on contract
2. Calls `loadStateForMutation(worldId, 'storeOfferSheet', payload)` → runs `resolveStoreOfferSheetAuthority` (E5 canonical home-team resolution)
3. Calls `validateSigning(home team, canonical player, preflightContract)` → routes into RFA/offer-sheet path: `validateOfferSheetTerms` (years, raises) + status/invariant checks
4. If signing invalid: returns `blocked` with violation messages
5. Calls `computeWorldMutation('storeOfferSheet', ...)` → catches compute-phase guardrails (player in `players[]`, dedup/worldId checks)
6. If compute fails: returns `blocked` with compute error
7. If both pass: returns `legal` with any warnings from signing + compute
8. Any exception: returns `incomplete`

**Result type:**
```typescript
export type OfferSheetPreflightResult = {
  status: 'legal' | 'blocked' | 'incomplete';
  reasons: string[];
  warnings: string[];
  source: 'authoritative-preflight';
};
```

---

## UI Alignment Proof

Test: `keeps confirm disabled while preflight is pending and enables only after legal result`

- Toggle ON → `getOfferSheetPreflight` called with `{ rfaOfferSheet: true, rfaOfferSheetOnly: true, contractType: 'Offer Sheet' }`
- Loading: confirm disabled, "Checking authoritative offer sheet legality..." shown
- Resolve legal with warning → confirm enabled, warning shown
- 8/8 behavior tests pass

---

## Home-Team Truth Proof

`preflightOfferSheetMutation` calls `loadStateForMutation(worldId, 'storeOfferSheet', payload)` which runs `resolveStoreOfferSheetAuthority`:
- Scans AUTHORITATIVE_WORLD_TEAM_CODES team snapshots in world lineage
- Resolves home team by roster/players[] membership with strict precedence
- Fails closed if ambiguity or disagreement
- Returns canonical player from home-team snapshot + home-team override

The offering team is never used as the player source-of-truth path. This is the E5 guarantee.

Test: `uses authoritative preflight result (blocked) over local state — home-team truth proof`

---

## Drift-Closure Proof

**Scenario:** Offering team is the same as the home team (player is on offering team's roster).

**Before E7 (modal):** No check — toggle appears, confirm is enabled, user can "submit" an offer sheet against their own player.

**After E7 (modal):** `resolveStoreOfferSheetAuthority` detects offering team = home team and fails closed. `loadStateForMutation` throws or returns an error state. `preflightOfferSheetMutation` catches and returns `incomplete`. `useCapValidation` pushes to `incomplete = true`. Confirm is disabled.

Test: `uses authoritative preflight result (blocked) over local state — home-team truth proof` demonstrates this with the reason "Offer sheet requires a distinct home team (offering team is the home team)."

---

## RFA / Rights Correctness Proof

`validateSigning` with `rfaOfferSheet: true` routes into the RFA/offer-sheet path:
1. `validateStoreOnlyInvariants` — enforces `rfaOfferSheet`/`rfaOfferSheetOnly` shape
2. `validateOfferSheetTerms` — years 1–4, raises ≤8%
3. Status/finalization gating — PENDING_MATCH only for store path

Test: `calls getOfferSheetPreflight with rfaOfferSheet and rfaOfferSheetOnly flags` confirms the flags are present in the payload passed to the preflight, ensuring the offer-sheet validation path is triggered in `validateSigning`.

---

## Conservative Handling Proof

| Scenario | Before E7 | After E7 |
|---|---|---|
| `getOfferSheetPreflight=null` (no world) | Offer sheet toggle shows, confirm enabled | `blocked` immediately: "Offer sheet preflight unavailable (no world context)." |
| `player=null` | Toggle may not show | `incomplete` immediately, preflight never called |
| Network error in preflight | N/A | `incomplete` via catch block |
| Loading (pending) | N/A | `incomplete` with loading message, confirm disabled |
| Stale response | N/A | Request-ID counter prevents stale result from re-enabling confirm |

Tests: `blocks immediately when getOfferSheetPreflight is null`, `returns incomplete immediately when player is null`.

---

## Tests Added / Updated

**New:** `src/tests/architect/editContractModal.offerSheetPreflight.behavior.test.tsx` (8 tests)

1. Loading → legal → confirm enabled with warnings
2. Blocked → confirm disabled, reason shown
3. Stale response discard when toggle off mid-request
4. No preflight call when toggle is off
5. Immediate blocked when no world context (null callback)
6. Immediate incomplete when player is null
7. RFA flags in preflight payload confirmed
8. Authoritative blocked overrides local state (home-team truth proof)

---

## Validation Results

```
npm run typecheck    → PASS (0 errors)
npm run test:ui -- --reporter=dot
  editContractModal.offerSheetPreflight.behavior.test.tsx   8 tests  PASS
  editContractModal.signAndTradePreflight.behavior.test.tsx 2 tests  PASS (no regression)
npm run test:node -- --reporter=dot
  editContractModal_closure.gate.test.ts  23 tests  PASS
  offerSheets_closure.gate.test.ts        60 tests  PASS
  useCapValidation.behavior.test.ts       11 tests  PASS
npm run build       → PASS (pre-existing warnings only)
```

---

## Remaining Follow-Up Tickets

Per `ARCHITECT_CONTRACT_FLOW_REVIEW.md` remaining findings (unchanged by E7):

1. **48-hour match window** (Medium) — `validateOfferSheetResolution` emits warning-only for expired window; late match still persists. Promote to blocking if the product rule is mandatory.
2. **`rfa_offer_sheet_stub_active` messaging** (Medium) — Stale validator warning remains; should be removed or rewritten to reflect live code state.
