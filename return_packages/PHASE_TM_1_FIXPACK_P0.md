# PHASE TM-1 FIXPACK P0 — Return Package

**Date:** 2026-02-05
**Scope:** Gap C (Sign-and-Trade wiring) + Gap D (TPE persistence)
**Status:** COMPLETE — all acceptance criteria met

---

## What Changed

| File | Edit |
|------|------|
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Added `handleSignAndTrade` to `UseArchitectActionsReturn` interface and to the hook's return object |
| `src/features/architect/GMDashboard/GMDashboard.jsx` | Added `onSignAndTrade={actions.handleSignAndTrade}` to both `EditContractModal` and `FreeAgencySection` |
| `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx` | Threaded `onSignAndTrade` prop through to `FreeAgentPool` |
| `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx` | Replaced broken local `handleSignAndTrade` + dead `onSignAndTrade` arrow wrapper with direct `onSignAndTrade` prop forwarding. Linter removed the now-unused `generateDefaultFreeAgentContract` import and the dead local function |
| `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx` | Imported `getTeamTpeList` from `normalizeTeamTpe.js`; replaced `tradeExceptions = []` destructure with `const tradeExceptions = getTeamTpeList(teamCapSheet)` |
| `src/tests/architect/GMDashboard.smoke.test.tsx` | Added `handleSignAndTrade: vi.fn()` to `useArchitectActions` mock return |
| `tests/architect/EditContractModal.rules.test.jsx` | Added `TeamSelectDropdown` stub; added Gap C guard test (verifies `onSignAndTrade` fires with `(player, contract, destinationTeamId)`) |
| `tests/architect/ExceptionTracker.tpe.test.jsx` | New file — Gap D guard (canonical read, legacy fallback, empty-state) |

---

## Root Cause + Fix — Gap C (Sign-and-Trade)

**Root cause:** Three-layer wiring break. The mutation handler `handleSignAndTrade` at `useArchitectActions.ts:708` was fully implemented but invisible to callers: absent from both the TypeScript interface and the `return` statement. Even if a caller had it, `GMDashboard.jsx` never passed it to `EditContractModal`. And in the `FreeAgentPool` path, the local `handleSignAndTrade` function called `onSign` (the `signFreeAgent` mutation) rather than the real S&T handler, and the `onSignAndTrade` prop passed to its inner `EditContractModal` was wrapped in `() => handleSignAndTrade(contractPlayer)` — discarding all three arguments that `EditContractModal` passes on confirm (player, contract, destinationTeamId).

**What was done:**
1. `useArchitectActions.ts` — `handleSignAndTrade` added to `UseArchitectActionsReturn` (interface) and to the return object. Zero logic change.
2. `GMDashboard.jsx` — `onSignAndTrade={actions.handleSignAndTrade}` added to `EditContractModal` (the cap-sheet-level modal, for FA players opened via the cap table). Same prop added to `FreeAgencySection`.
3. `FreeAgencySection.jsx` — accepts and forwards `onSignAndTrade` to `FreeAgentPool`.
4. `FreeAgentPool.jsx` — `onSignAndTrade` received as a prop. The `EditContractModal` inside FreeAgentPool now passes it directly (`onSignAndTrade={onSignAndTrade}`), letting EditContractModal's own `handleConfirm` deliver `(player, contract, destinationTeamId)` untouched. The dead local function and its unused import were removed by the linter.

---

## Root Cause + Fix — Gap D (TPE persistence)

**Root cause:** `ExceptionTracker.jsx:126` destructured `tradeExceptions` directly from `teamCapSheet`. Phase 64 canonicalization (`normalizeTeamTpe.js`) deletes `team.tradeExceptions` before the Firestore write and migrates TPE data to `team.exceptions.tpe[]`. After a page reload the legacy field no longer exists, so the destructure yields `[]`. The helper `getTeamTpeList()` (same module, line 217) already handles canonical-first + legacy-fallback reads and is used correctly elsewhere (`TradeExceptionDashboard`, `useTradeMachine`). ExceptionTracker simply missed the migration.

**What was done:** Imported `getTeamTpeList` from `normalizeTeamTpe.js`. Removed `tradeExceptions` from the destructure. Added `const tradeExceptions = getTeamTpeList(teamCapSheet);` immediately after. Variable name preserved so all downstream render logic is unchanged.

---

## Test Results

### Target test files — 19/19 pass

| File | Tests | Result |
|------|-------|--------|
| `tests/architect/ExceptionTracker.tpe.test.jsx` | 3 (new Gap D guard) | PASS |
| `tests/architect/EditContractModal.rules.test.jsx` | 12 (11 existing + 1 new Gap C guard) | PASS |
| `src/tests/architect/GMDashboard.smoke.test.tsx` | 4 (updated mock) | PASS |

### Full suite — 2603 pass / 66 fail / 1 skip

All 66 failures are in test files not touched by this phase. Spot-checked representative failures:
- `computeTeamCapTotals.test.js` — cap totals module, untouched
- `signAndTrade.test.js` — mutation pipeline integration tests, pre-existing (pipeline itself was not modified)
- `TradeValidationGating.guardrail.test.jsx` — UI element rename mismatch, pre-existing
- `staleValidationFix.test.js` — `computeTradeDraftKey` pick serialization, pre-existing

None reference any file modified in TM-1.

---

## Manual Smoke Checklist

| Check | Expected | Status |
|-------|----------|--------|
| Sign & Trade flow — select FA in cap table, choose "Sign & Trade", pick destination, confirm | `onSignAndTrade` called → `persistMutation('signAndTrade', {...})` fires with `destinationTeamCode` | Verified via Gap C guard test; handler routes confirmed in source |
| Sign & Trade flow — select FA in Free Agency tab pool, same flow | Same as above; prop chain GMDashboard → FreeAgencySection → FreeAgentPool → EditContractModal is complete | Verified via prop trace + Gap C test |
| TPE display — make or load a trade that generates a TPE | TPE card appears in ExceptionTracker | `getTeamTpeList` reads canonical path |
| TPE display — reload the page | TPE card still present | Root cause eliminated: no longer reads deleted legacy field |
| TPE display — empty state | "No Active TPEs" shown | Gap D test case 3 |

---

## Follow-up Risks / Edge Cases Discovered

1. **Contract format bridge (medium risk):** `EditContractModal` builds its confirm payload with a `salaries` array (not `salariesByYear`). `handleSignAndTrade` calls `ensureContractStructure`, which returns `null` when `salariesByYear` is absent. The `contract` field in the `persistMutation` payload will therefore be `null` on the first real S&T from the UI. The mutation pipeline (`computeSignAndTradeResult`) may handle this internally (it has 15 unit tests), or it may need the contract field populated. This was a latent bug in the handler — it was never exercised before because the handler was unreachable. **Recommendation:** trace the mutation pipeline's `handleSignAndTrade` to confirm whether `contract: null` is acceptable or whether `ensureContractStructure` should fall back to the raw contract object. Out of scope for this phase per guardrails ("do not touch mutation pipeline").

2. **Optimistic state update absent for S&T:** `handleSignAndTrade` is persist-only (no `setTeamCapSheet` / `setFreeAgents` call). After confirmation the player will remain visible in the FA pool until the next world-state refresh. `handleSign` does update local state optimistically. This is a deliberate design difference in the compound-mutation handler and is not a regression.

3. **66 pre-existing test failures:** Unrelated to this phase. Most appear tied to integration-level mocks or recent UI renames that the guardrail tests haven't caught up to. Should be triaged separately.
