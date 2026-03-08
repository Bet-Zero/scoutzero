# TM_VALIDATOR_TIMING_FIXES_E7 — EXECUTION RETURN PACKAGE

## 1. Summary
- Fixed the authoritative generic timing warn/error boundary so warning-mode timing now surfaces as canonical warnings without making `validateTrade()` or apply-time validation illegal.
- Retired the misleading generic 60-day aggregation rule from active authoritative enforcement because the live payload still does not provide a reliable acquisition-date field.
- Reviewed the generic December 15 rule during implementation and left it unchanged because this pass did not confirm an authoritative false-block case that required a boundary change.
- Overall outcome: the blocker-level P3 generic timing defects are substantively fixed enough for generic timing TS migration to resume for the remaining active rules.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/timingValidation.js`
  - Converted `enforceTiming()` to a canonical rule-envelope-style result with `violations` and `warnings`, retired active 60-day enforcement, and removed the dormant 2-month enforcement branch.
- `src/features/architect/utils/timingUtils.js`
  - Removed the misleading 60-day helper that was still keyed to signing date rather than acquisition date.
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Added the active timing policy to the authoritative `enforceTiming()` call context so validator caching cannot reuse warn-mode output in error mode.
- `tests/trade/timingEnforcement_authoritative.test.js`
  - Added direct authoritative `validateTrade()` coverage for warning propagation, blocking error mode, and 60-day retirement.
- `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`
  - Added direct authoritative apply-path coverage for `_validatedTradeContext` warning survival and `applyWorldMutation()` warning propagation.
- `tests/trade/timingGates_softEnforcement.test.js`
  - Updated helper-level timing enforcement coverage to assert canonical warning/violation routing and to confirm the retired 60-day rule no longer surfaces.
- `tests/trade/jan15_offseason_timing.test.js`
  - Locked the recent-extension timing ownership assertion to `timingEnforcement = 'error'` and preserved the Jan. 15 S&T ownership split.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E7 indexed entry and updated the rule matrix so 60-day aggregation is no longer documented as active authoritative timing enforcement.
- `return_packages/trade_machine/TM_VALIDATOR_TIMING_FIXES_E7_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Implemented Timing Fixes
- `TIMING-P3-F001 / TIMING-P3-SEQ-003`
  - Changed `enforceTiming()` to return canonical `ValidationIssue` output with `passed`, `violations`, `warnings`, `message`, `details`, and `sourceType: 'enforcement'`.
  - Exact authoritative path now used:
    `validateTrade()` -> `validators.enforceTiming()` -> `teamResults[n].rules.timingEnforcement` -> `teamResults[n].warnings` -> top-level `result.warnings`.
    The same warning objects also survive apply-time through `validatePostTradeSnapshotForContext().warnings`, `_validatedTradeContext.warnings`, and `applyWorldMutation().warnings`.
  - Why this is correct:
    warning-mode timing now remains visible to consumers and debugging surfaces without being normalized into blocking violations, while error-mode timing still blocks normally.
  - Supporting fix:
    the active timing policy is now included in the authoritative `enforceTiming()` call context so validator cache keys stay distinct across warn/error modes.
  - Follow-up:
    none required for the warn/error boundary in the current authoritative path.
- `TIMING-P3-F002 / TIMING-P3-SEQ-004`
  - Retired the active generic 60-day aggregation rule instead of re-keying it to another incorrect field.
  - Exact authoritative path now used:
    `validateTiming()` no longer emits a 60-day acquisition restriction, `enforceTimingGates()` no longer surfaces the legacy 2-month branch, and the old helper was removed from `timingUtils.js`.
  - Why this is correct:
    the live authoritative payload does not currently carry a reliable acquisition-date field, so continuing to enforce or summarize “acquired within the last 60 days” off `signedDate` would remain substantively wrong.
  - Follow-up:
    this rule should stay disabled until the live trade validator contract carries a real acquisition-date source.
- `TIMING-P3-F004`
  - Reviewed during implementation and left unchanged.
  - Exact authoritative path now used:
    the existing generic December 15 logic in `validateTiming()` remains in place.
  - Why no code change was made:
    this pass did not confirm an authoritative false-block path that required narrowing or retirement, and the S&T timing ownership split remained intact without any boundary changes.
  - Follow-up:
    revisit only if a future authoritative payload review shows the current-season signing source is too weak to support the rule safely.

## 4. Regression Coverage Added or Updated
- `tests/trade/timingEnforcement_authoritative.test.js`
  - Proves directly through `validateTrade()` that warning-mode timing keeps `legal === true`, that the same moratorium warning appears in top-level warnings, team warnings, and `rules.timingEnforcement.warnings`, that error-mode timing still blocks, and that the retired 60-day rule no longer appears in authoritative timing output.
  - Hits the authoritative validator directly.
- `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`
  - Proves that `computeWorldMutation('executeTrade')` keeps `_validatedTradeContext.legal === true` in warning mode and retains timing warnings, and that `applyWorldMutation('executeTrade')` succeeds while returning the timing warning in the wrapper `warnings` array.
  - Hits the authoritative apply wrapper directly.
- `tests/trade/timingGates_softEnforcement.test.js`
  - Proves helper-level warn/error routing now returns canonical warnings or violations and confirms the retired 60-day rule is no longer surfaced as active timing enforcement.
  - Supporting evidence only; not the primary authoritative path.
- `tests/trade/jan15_offseason_timing.test.js`
  - Preserves the Jan. 15 S&T vs generic timing ownership split and locks the recent-extension timing assertion to blocking mode so the rule-owner expectation remains explicit.
  - Hits the authoritative validator path for the ownership split assertion.
- `tests/trade/validatorTrustFixes.test.js`
  - Re-run unchanged to preserve authoritative apply-time Jan. 15/S&T timing ownership behavior.
  - Hits authoritative apply validation.
- `tests/trade/validatorContractCleanup.test.js`
  - Re-run unchanged to preserve canonical rule-envelope compatibility and warning-array behavior.
  - Hits the authoritative validator and post-trade validation surface.

## 5. Remaining Gaps
- The generic 60-day aggregation rule is intentionally retired, so authoritative timing still lacks that family of enforcement until a real acquisition-date field exists in the live validator contract.
- The generic December 15 rule was reviewed but not narrowed because this pass did not confirm an authoritative false-block case; future evidence could still justify a tighter season anchor.

## 6. Validation Run
- Commands run:
  - `npm run test:node -- --reporter=dot tests/trade/timingEnforcement_authoritative.test.js tests/trade/timingGates_softEnforcement.test.js tests/trade/jan15_offseason_timing.test.js tests/trade/validatorTrustFixes.test.js tests/trade/validatorContractCleanup.test.js src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`
  - `npm run validate:project`
- Result:
  - PASS. The targeted authoritative timing suite passed, including direct validator coverage, apply-path warning propagation, Jan. 15 ownership stability, and 60-day retirement assertions.
- Intentionally not run:
  - `npm run test:trade -- --reporter=dot`
  - `npm run build`
  - full-suite commands
  - Reason: the approved scope for this pass was targeted timing validation plus structural validation, and the targeted suite already exercised the authoritative validator and apply wrapper paths touched by E7.

## 7. Master Doc Update
- Added `Validator Timing Fixes E7 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the P3 blocker-level timing defects are fixed in the authoritative path.
- Recorded that warning-mode generic timing now propagates through canonical top-level warnings and the authoritative apply wrapper without making trades illegal.
- Updated the aggregation rules matrix so 60-day aggregation is documented as retired from authoritative enforcement pending a real acquisition-date field.
- Recorded that generic timing TS migration may proceed for the remaining active timing rules, while the retired 60-day rule must remain paused.
