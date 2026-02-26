# TRADE_CAP_APRON_HARDENING_E1 — EXECUTION RETURN PACKAGE

Date: 2026-02-26
Mode: EXECUTION
Status: Complete

## 1) Scope Delivered

Implemented both requested hardenings:

1. Test placement normalization for Trade Machine guardrails.
2. Apply-time fail-closed routing invariant for 3+ team trades.

Also added regression coverage and ran all required validation gates.

## 2) Behavioral Contract Change (Exact)

### New apply-time invariant (3+ teams)
If `activeTeamCount >= 3`, every outgoing player in the apply payload must resolve to a valid destination participant via one of:

- `receivingTeamIndex`
- `receivingTeamId`
- `tradeTo`
- `toTeamId`
- `destTeamId`

If any outgoing player is missing/invalid destination routing, apply now fails loudly with:

- `TRADE_APPLY_ROUTING_ERROR`

and trade apply does not commit writes.

### Backward compatibility
2-team apply behavior remains unchanged: unrouted outgoing players still use existing fallback behavior.

## 3) Files Changed

### Code
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/mutationPipeline.js`

### Tests
- `src/tests/architect/tradeApply_tradeToRouting.guardrail.test.ts` (updated)
- `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts` (new)
- `src/tests/tradeMachine/tradeAllowableIncomingParity.guardrail.test.ts` (moved)
- `src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts` (moved)
- `tests/trade/tradeAllowableIncomingParity.guardrail.test.ts` (removed from old location)
- `tests/trade/hardCap_reasonParity.guardrail.test.ts` (removed from old location)

### Docs
- `docs/architect/TRADE_MACHINE_MASTER.md` (brief contract delta added)

## 4) Task A — Test Folder Consolidation Results

- The two new guardrail tests were moved out of `tests/trade/` into `src/tests/tradeMachine/`.
- Existing `tests/trade/` folder remains because it already contains long-standing trade tests for a different suite.
- `npm run test:trade` discovers and runs the moved tests from `src/tests/tradeMachine/`.

## 5) Task B — Apply-Time Fail-Closed Routing Evidence

### Decisive logic
- `src/features/architect/utils/tradeContext/tradeContext.js:128-169`
  - Pre-validates all outgoing players for 3+ team payloads.
  - Throws explicit `[TRADE_APPLY_ROUTING_ERROR] ...` on missing/invalid routing.
- `src/features/architect/utils/tradeContext/tradeContext.js:219-223`
  - 3+ team broadcast fallback replaced by explicit throw (defensive/unreachable branch after pre-validation).
- `src/features/architect/utils/tradeContext/tradeContext.js:213-217`
  - 2-team fallback retained for backward compatibility.

### Pipeline messaging alignment
- `src/features/architect/utils/mutationPipeline.js:1155-1159`
  - Warning text now states 3+ apply will fail closed with `TRADE_APPLY_ROUTING_ERROR`.

## 6) Task C — Regression Tests Added/Updated

1. `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts`
   - Asserts 3+ team missing destination returns failure containing `TRADE_APPLY_ROUTING_ERROR`.
   - Asserts `writeBatch` not called.
   - Asserts `commit` not called.

2. `src/tests/architect/tradeApply_tradeToRouting.guardrail.test.ts`
   - Keeps routed 3-team success path.
   - Adds/updates fail-closed expectation for missing destination (`toThrow(/TRADE_APPLY_ROUTING_ERROR/)`).
   - Confirms 2-team fallback behavior remains functional.

## 7) Evidence: No Writes Occur on Fail-Closed Error

Best available proof is direct mocked batch assertions in:

- `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts:125-128`

Assertions:
- `expect(result.success).toBe(false)`
- `expect(result.error).toContain('TRADE_APPLY_ROUTING_ERROR')`
- `expect(firestoreMocks.writeBatch).not.toHaveBeenCalled()`
- `expect(firestoreMocks.commit).not.toHaveBeenCalled()`

## 8) Validation Commands Run

1. `npm run test:trade -- --reporter=dot` → PASS  
   - Test Files: 53 passed  
   - Tests: 504 passed, 1 skipped, 3 todo

2. `npm run test:architect -- --reporter=dot` → PASS  
   - Test Files: 134 passed  
   - Tests: 2200 passed, 1 skipped, 3 todo

3. `npm run build` → PASS (warnings only)

4. `npm run validate:project` → PASS

## 9) Commands Intentionally Skipped

- `npm run test:full` skipped because prompt did not include `RUN FULL SUITE`.

## 10) Master Doc Delta

Updated `docs/architect/TRADE_MACHINE_MASTER.md` with a brief new subsection:

- `C.1) Apply-time fail-closed routing invariant (3+ teams)`

This documents the new contract and no-partial-write guarantee on routing invariant failure.
