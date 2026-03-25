# ARCHITECT_OFFER_SHEET_INIT_PREFLIGHT_ALIGNMENT_E9

**Date:** 2026-03-24
**Scope:** Offer-sheet initiation preflight unification — remove generic `signNew` drift and align modal/preflight/mutation payloads
**Status:** COMPLETE

---

## Summary

E9 closes the final Stage 1 offer-sheet trust gap identified in `ARCHITECT_CONTRACT_FLOW_REVIEW.md`.

When the user initiates an offer sheet from the modal:

1. **There is now one authoritative legality path.** `signNew + isOfferSheet` uses only the offer-sheet preflight result for legality, warnings, incomplete state, and confirm gating.

2. **The modal preflight payload is now canonical.** The preflight request is built from the same canonical signing payload shape used by confirm, with offer-sheet-specific flags/status forced up front.

3. **Generic `signNew` validation no longer competes with offer-sheet preflight.** `useCapValidation` explicitly bypasses local signing heuristics in offer-sheet mode instead of merging two independent validation outputs.

Normal non-offer-sheet signings remain on the generic `signNew` path. SAT behavior remains unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `src/shared/components/EditContractModal.tsx` | Canonicalized offer-sheet preflight payload, tightened confirm routing to `signNew` only, and reset stale offer-sheet toggle state on modal reset/close |
| `src/features/architect/hooks/useCapValidation.ts` | Routed `signNew + isOfferSheet` to authoritative offer-sheet preflight only; stopped mixing in generic `signNew` messages |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Canonicalized `getOfferSheetPreflight` contract payload before delegating |
| `src/features/architect/utils/mutationPipeline.ts` | Defensively normalized `rfaOfferSheetStatus: 'PENDING_MATCH'` in `preflightOfferSheetMutation` |
| `src/tests/architect/useCapValidation.behavior.test.ts` | Added hook-level drift-closure test proving offer-sheet mode ignores generic `signNew` output |
| `src/tests/architect/editContractModal.offerSheetPreflight.behavior.test.tsx` | Added canonical payload assertions, authoritative-only UI consistency test, and stale-toggle reset coverage |
| `src/tests/architect/useArchitectActions.freeAgency.test.tsx` | Added authoritative preflight canonicalization/delegation test |
| `docs/architect/ARCHITECT_CONTRACT_FLOW_REVIEW.md` | Closed the Stage 1 offer-sheet initiation drift finding and updated validation log/status |

---

## Root Cause

E7 introduced authoritative offer-sheet preflight support, but the old local `signNew` validation path remained active in parallel.

This left two validator sources alive for the same user action:

- `useCapValidation` still ran the generic signing heuristics for `signNew`
- the modal also fetched offer-sheet preflight and layered its output on top

Those paths were not using the same input shape:

- the local `signNew` path used `contractDataForValidation`, which does not carry canonical offer-sheet-only context
- the authoritative offer-sheet path expected `rfaOfferSheet`, `rfaOfferSheetOnly`, and an offer-sheet contract shape

As a result, the modal could show blended or conflicting legality signals for the same offer-sheet initiation.

---

## Before vs After Validation Paths

### Before E9

When `selectedAction === 'signNew'` and `isOfferSheet === true`:

1. `EditContractModal` built a lightweight `contractDataForValidation`
2. `useCapValidation` ran generic `signNew` legality checks against that payload
3. Offer-sheet preflight also ran asynchronously
4. The hook merged generic `signNew` output and authoritative offer-sheet output into one modal state

Result:

- generic warnings/errors could appear even though they were not authoritative for offer-sheet initiation
- modal legality could be influenced by a non-canonical validation path

### After E9

When `selectedAction === 'signNew'` and `isOfferSheet === true`:

1. `EditContractModal` builds `offerSheetPreflightPayload` from `buildCanonicalSigningPayload(...)`
2. The payload explicitly forces:
   - `contractType: 'Offer Sheet'`
   - `rfaOfferSheet: true`
   - `rfaOfferSheetOnly: true`
   - `rfaOfferSheetStatus: 'PENDING_MATCH'`
3. `getOfferSheetPreflight` canonicalizes the request again before delegating
4. `preflightOfferSheetMutation` defensively normalizes the status flag
5. `useCapValidation` treats offer-sheet mode as preflight-only and does not run generic `signNew` validation in parallel

Result:

- one legality source
- one warning/error set
- one confirm-gating signal

---

## Unified Preflight Design

The E9 routing is explicit:

- `action === 'signNew' && isOfferSheet === true` → authoritative offer-sheet preflight only
- `action === 'signNew' && isOfferSheet === false` → generic `signNew` validation
- `action === 'resign'` → existing generic `resign` validation
- SAT flow → unchanged, still independent

Design properties:

1. **Single source of truth for offer-sheet initiation**
   - The hook no longer merges local `signNew` output into offer-sheet mode.

2. **Shared payload semantics between preview and commit**
   - The preflight payload now mirrors the authoritative commit payload shape instead of using an under-specified local object.

3. **Defensive normalization in the authoritative helper**
   - `getOfferSheetPreflight` and `preflightOfferSheetMutation` both enforce offer-sheet flags/status so the path stays canonical even if a caller under-specifies the contract.

4. **No stale hidden mode leakage**
   - `isOfferSheet` is reset when the modal closes/resets, and confirm routing only treats offer-sheet mode as valid on `signNew`.

---

## Drift-Closure Proof

### Hook-level proof

New test in `src/tests/architect/useCapValidation.behavior.test.ts` constructs a `signNew` scenario that would ordinarily produce local generic signing output, then passes:

- `action: 'signNew'`
- `isOfferSheet: true`
- a blocked `offerSheetPreflight`

Assertions prove:

- blocked reason from authoritative offer-sheet preflight appears
- generic `signNew` messages do **not** appear
- the hook returns the authoritative legality signal only

### Modal-level proof

New test in `src/tests/architect/editContractModal.offerSheetPreflight.behavior.test.tsx` uses a high-salary RFA setup where normal local signing heuristics would surface a second-apron warning.

After E9:

- the modal renders only the authoritative offer-sheet preflight result
- the local generic signing warning is absent

This is the concrete drift closure: the modal no longer reflects a misclassified local `signNew` result when the user is actually initiating an offer sheet.

---

## UI Consistency Proof

The modal now consumes one unified legality result for offer-sheet initiation.

Evidence:

1. **No conflicting message sources**
   - `useCapValidation` does not merge generic `signNew` warnings/errors into offer-sheet mode.

2. **Canonical request payload**
   - `getOfferSheetPreflight` receives `contractType: 'Offer Sheet'`, `rfaOfferSheet: true`, `rfaOfferSheetOnly: true`, and `rfaOfferSheetStatus: 'PENDING_MATCH'`.

3. **Safe mode reset**
   - New modal behavior test confirms closing/reopening the modal clears the hidden offer-sheet toggle state, preventing accidental routing through `onStoreOfferSheet`.

The result is a single consistent legality signal in the UI with no parallel validation drift.

---

## Tests Added/Updated

### Updated: `src/tests/architect/useCapValidation.behavior.test.ts`

Added:

- `uses only authoritative offer-sheet preflight output in offer-sheet mode`

This proves that blocked/incomplete/legal offer-sheet preflight output is authoritative and local `signNew` output is ignored in offer-sheet mode.

### Updated: `src/tests/architect/editContractModal.offerSheetPreflight.behavior.test.tsx`

Added/updated coverage for:

- canonical offer-sheet preflight payload includes `rfaOfferSheetStatus: 'PENDING_MATCH'`
- modal renders only authoritative offer-sheet output when local `signNew` warnings would otherwise fire
- offer-sheet toggle state resets on close/reopen

### Updated: `src/tests/architect/useArchitectActions.freeAgency.test.tsx`

Added:

- canonical offer-sheet preflight delegation test

This proves `getOfferSheetPreflight` forwards:

- `worldId`
- `seasonId`
- `offeringTeamCode`
- `playerId`
- a canonical offer-sheet contract payload

to `preflightOfferSheetMutation`.

---

## Validation Results

### Commands Run

Focused validation:

- `npm run test:node -- --reporter=dot src/tests/architect/useCapValidation.behavior.test.ts` → PASSED
- `npm run test:ui -- --reporter=dot src/tests/architect/editContractModal.offerSheetPreflight.behavior.test.tsx` → PASSED
- `npm run test:ui -- --reporter=dot src/tests/architect/useArchitectActions.freeAgency.test.tsx` → PASSED
- `npm run test:diff -- --reporter=dot` → PASSED (`run-tests-by-diff` detected no pending diff and correctly fell back to `npm run test:fast`, which passed 12/12 files and 57/57 tests)

Required validation:

- `npm run typecheck` → PASSED
- `npm run build` → PASSED

Build completed with existing non-E9 warnings only (Browserslist staleness, mixed dynamic/static import warnings, large chunk warnings).

### Broad Suite Attempts

Per the execution prompt, broader validation was attempted:

- `npm run test:node -- --reporter=dot`
- `npm run test:ui -- --reporter=dot`

Both exceeded the repo time budget and surfaced pre-existing unrelated failures outside E9 scope before completion. Observed standing failures included:

- `tests/contractParser.test.js`
- `src/tests/security/firestoreRules.integration.test.ts`
- `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
- `src/tests/architect/phase83_live_pipeline_mutations_and_season_advance_emulator_e2e.test.js`
- `src/tests/architect/mutationPipeline.boundary.e107.test.ts`
- `tests/validators/roster.test.js`
- `src/tests/architect/architectTsTopologyCleanup.behavior.test.ts`
- `src/tests/architect/tradeEditorTeamCard.boundary.e105.test.tsx`
- `src/tests/architect/GMDashboard.smoke.test.tsx`
- `src/tests/architect/capSheet.uiFlows.integration.test.tsx`
- `src/tests/architect/teamHistory.displayFromEnrichedEvents.integration.test.tsx`
- `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx`

These failures are documented in the master review doc validation log and were not introduced by E9.

### Commands Intentionally Skipped

- `npm run test:full` — not allowed; prompt did not include `RUN FULL SUITE`
- `npm run validate:project` — skipped because E9 made no structural folder/export changes
- `npm run lint` — skipped; not required by ticket and repo lint baseline is noisy
- `npm run lint:md` — skipped; not required by ticket

---

## Remaining Follow-Up Tickets

No remaining confirmed offer-sheet initiation trust blocker remains after E9.

The offer-sheet lifecycle findings reviewed in `ARCHITECT_CONTRACT_FLOW_REVIEW.md` are now closed through E9.

Non-E9 follow-up work remains only as general repo maintenance:

- repair standing broad-suite failures unrelated to offer-sheet initiation
- continue any future lifecycle review from newly discovered issues, not from the previously identified Stage 1 drift
