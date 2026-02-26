# TRADE_E2E_TPE_EXCEPTIONS_FIX_E1 — Execution Return Package

Date: 2026-02-26

## 1. Summary

TPE / trade exception semantics had three stop-driver bugs:

1. **Validator allowed `absorptionMode='TPE'` without a valid `tpeId`** — apply-time then silently skipped consumption, creating a parity break where the UI suggested TPE usage but nothing was enforced or persisted.
2. **The "Use Trade Exception" button in TradePlayerRow emitted a `'tradeException'` action** with no handler in the `setPlayerTrade` switch — user clicks were silently dropped.
3. **`validateTradeExceptions` used raw `tradeExceptions[]` for legacy data** instead of routing through the canonical `getTeamTpeList()` accessor, risking field name mismatches.

All three are now fixed with fail-closed semantics enforced end-to-end.

## 2. Ship-Readiness Verdict

**TPE/exceptions: SHIP-READY.**

- Validator and apply-time enforce identical fail-closed rules.
- No UI surface suggests TPE usage exists without it being enforced.
- Single authoritative TPE usage path through TradeTeamCard.
- All dead code paths removed.
- All validation commands pass.

## 3. Exact Behavior Changes

### UI → Validator → Apply

**Before:**

- UI had two TPE paths: TradeTeamCard selector (working) and TradePlayerRow menu button (broken/silent no-op)
- Validator accepted `absorptionMode='TPE'` without `tpeId` — no violation produced
- Apply-time silently skipped TPE consumption when `tpeId` was missing (`if (!player.tpeId) return;`)
- Legacy `tradeExceptions[]` not normalized through canonical accessor

**After:**

- UI has one TPE path: TradeTeamCard absorption dropdown → TPE selector → `setTpeId` action
- Validator rejects `absorptionMode='TPE'` without `tpeId` with specific violation message
- Validator rejects `tpeId` that doesn't resolve to an existing TPE on the team
- Apply-time blocks entire mutation if any TPE player is missing `tpeId` or `matchIncoming`
- Legacy `tradeExceptions[]` routed through `getTeamTpeList()` for field normalization

## 4. Issues Closed

| Preflight Blocker                                     | Status       | Resolution                                                                        |
| ----------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| TPE absorption parity (Stop-Driver 1)                 | CLOSED       | Fail-closed guards in validator + apply-time                                      |
| Broken `'tradeException'` UI action (Stop-Driver 2)   | CLOSED       | Option A: removed dead path, kept working TradeTeamCard path                      |
| `validateTradeExceptions` input shape (Stop-Driver 3) | CLOSED       | Legacy path routed through `getTeamTpeList()`                                     |
| TPE teamId ownership key (Secondary 4)                | CLOSED       | Automatically fixed by routing through `getTeamTpeList()` which normalizes fields |
| OffseasonSection expiredTPEs (Secondary 5)            | DEFERRED     | Low priority display issue; documented for future work                            |
| DPE parity (Secondary 6)                              | OUT OF SCOPE | Separate exception type; documented in TRADE_MACHINE_MASTER.md                    |
| ExceptionHistoryTracker (Secondary 7)                 | OUT OF SCOPE | Documented for future work                                                        |

## 5. Files Changed

### Modified

- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js` — Added fail-closed absorptionMode+tpeId checks; imported and used `getTeamTpeList()` for legacy normalization
- `src/features/architect/utils/mutationPipeline.js` — Added fail-closed pre-check blocking mutation when TPE players lack `tpeId` or `matchIncoming`; added `_blocked` flag propagation to block entire trade result
- `src/features/architect/tradeMachine/TradePlayerRow.jsx` — Removed `canUseTPE`, TPE badges, "Use Trade Exception" menu buttons, `tradeExceptions` prop
- `src/features/architect/tradeMachine/OutgoingPlayersList.jsx` — Removed `TradeExceptionModal` import/usage, `tpePlayer` state, `tradeExceptions` prop
- `src/features/architect/tradeMachine/TradeEditor.jsx` — Removed `handleApplyTradeException`, `applyTradeException` from hook destructure, `onApplyTradeException` prop pass
- `src/features/architect/hooks/useTradeMachine.js` — Removed `applyTradeException` callback and its return export
- `src/features/architect/tradeMachine/TradeTeamCard.jsx` — Removed `onApplyTradeException` prop, removed `onApplyException` callback from TradeExceptionManager usage, removed `tradeExceptions` pass-through to OutgoingPlayersList
- `src/features/architect/tradeMachine/TradeExceptionManager.jsx` — Removed `onApplyException` prop and click handler; now display-only
- `docs/architect/TRADE_MACHINE_MASTER.md` — Added "TPE (Trade Player Exception) Semantics" section

### Deleted

- `src/shared/components/TradeExceptionModal.jsx` — Dead shared modal (only consumer was OutgoingPlayersList)
- `src/features/architect/tradeMachine/TradeExceptionModal.jsx` — Dead feature-level modal (no imports)

### Created

- `tests/trade/tpe_absorption_fail_closed.test.js` — 5 fail-closed TPE tests
- `return_packages/trade_machine/TRADE_E2E_TPE_EXCEPTIONS_FIX_E1_EXECUTION_RETURN_PACKAGE.md` — This file

## 6. Tests Added/Updated

### New: `tests/trade/tpe_absorption_fail_closed.test.js`

| Test                                                                      | What It Validates                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| rejects absorptionMode=TPE when tpeId is missing                          | Validator produces "no tpeId specified" violation          |
| rejects tpeId that does not resolve to an existing TPE                    | Validator produces "does not exist on this team" violation |
| validates successfully when absorptionMode=TPE with valid tpeId           | No fail-closed violations on happy path                    |
| validateTradeExceptions directly rejects absorptionMode=TPE without tpeId | Unit-level direct function test                            |
| validateTradeExceptions directly rejects unresolvable tpeId               | Unit-level direct function test                            |

### Existing tests: all pass unchanged

- `tests/trade/tpe_creation_expiry_usage.test.js` — 4 tests pass
- `tests/trade/secondApron_tpeBan.test.js` — passes

## 7. Validation Outputs

| Command                                    | Result | Details                                   |
| ------------------------------------------ | ------ | ----------------------------------------- |
| `npm run test:trade -- --reporter=dot`     | PASS   | 55 files, 513 passed, 1 skipped, 3 todo   |
| `npm run test:architect -- --reporter=dot` | PASS   | 136 files, 2206 passed, 1 skipped, 3 todo |
| `npm run build`                            | PASS   | Built in 28.46s                           |
| `npm run validate:project`                 | PASS   | All validations passed                    |

## 8. Doc Updates

### `docs/architect/TRADE_MACHINE_MASTER.md`

Added "TPE (Trade Player Exception) Semantics" section documenting:

- Canonical storage path (`team.exceptions.tpe[]`) and SSOT accessor (`getTeamTpeList()`)
- TPE creation mechanics (trade apply-time, idempotent)
- TPE absorption requirements (`absorptionMode` + `tpeId`)
- Fail-closed rules (validator + apply-time)
- Removed UI paths and rationale
- DPE out-of-scope note

## 9. STOP Report

No STOP conditions were encountered. All three stop-drivers were resolvable within the existing architecture without breaking schema changes.
