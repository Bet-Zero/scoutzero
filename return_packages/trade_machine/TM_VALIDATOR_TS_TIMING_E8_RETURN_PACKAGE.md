# TM_VALIDATOR_TS_TIMING_E8 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the active generic timing implementation into TypeScript via `src/features/architect/utils/tradeMachine/rules/timingValidation.ts`, `src/features/architect/utils/tradeMachine/utils/tradeTimingWindows.ts`, and `src/features/architect/utils/timingUtils.ts`.
- Behavior was preserved in the authoritative path: warning-mode timing remains non-blocking, error-mode timing remains blocking, canonical timing warnings still propagate through validator and apply-time surfaces, the Jan. 15 S&T vs generic ownership split is unchanged, and the retired 60-day rule remains absent.
- `tradeValidator.js` and `validateSignAndTrade.js` remained JS by scope. `timingValidation.js` and `tradeTimingWindows.js` are now pure re-export shims, and `timingUtils.js` now only keeps the out-of-slice reacquisition export plus pure re-exports for active timing helpers.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/timingValidation.ts`
  - New TS implementation for the active generic timing cluster, including helper-facing validation and authoritative enforcement output.
- `src/features/architect/utils/tradeMachine/rules/timingValidation.js`
  - Reduced to a pure compatibility re-export shim to the TS implementation.
- `src/features/architect/utils/tradeMachine/utils/tradeTimingWindows.ts`
  - New TS implementation for the authoritative timing date resolver and January 15 restriction helper.
- `src/features/architect/utils/tradeMachine/utils/tradeTimingWindows.js`
  - Reduced to a pure compatibility re-export shim to the TS implementation.
- `src/features/architect/utils/timingUtils.ts`
  - New TS implementation for the active generic timing helpers `isWithinMoratorium`, `daysSince`, and `violates30Day`.
- `src/features/architect/utils/timingUtils.js`
  - Reduced to pure re-exports for active timing helpers plus the out-of-slice reacquisition export.
- `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`
  - Added authoritative apply-path coverage proving the retired 60-day timing message stays absent from `_validatedTradeContext` and final apply warnings.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E8 indexed entry and updated timing references to the TS-backed implementation.
- `return_packages/trade_machine/TM_VALIDATOR_TS_TIMING_E8_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `TimingPlayer`
  - Narrow local timing player contract for `eligibleTradeDate`, `signedDate`, `isNewlySignedFA`, and `isRecentlyExtended`.
  - Applies inside `timingValidation.ts` across helper-facing validation and authoritative enforcement.
- `TimingTeam`
  - Narrow local team contract for the active generic timing path using `sends` / `outgoingPlayers`.
  - Applies inside `timingValidation.ts` without broadening the shared validator engine contract.
- `TimingValidationResult`
  - Helper-facing timing result that preserves the existing `string[]` violations contract.
  - Applies only inside `validateTiming()` and never flows into authoritative validator or apply output.
- `TimingEnforcementResult`
  - Canonical authoritative timing enforcement result built on `ValidationResult` with `sourceType: 'enforcement'`.
  - Applies to `enforceTiming()`, which remains the sole timing surface consumed by `validateTrade()`.

## 4. Migration Work Completed
- `src/features/architect/utils/tradeMachine/rules/timingValidation.ts`
  - Moved the active generic timing logic into TS, including `validateTiming()`, `enforceTiming()`, `enforceTimingGates()`, and the local offseason/moratorium helpers.
  - Preserved authoritative behavior by keeping `enforceTiming()` as the only canonical timing output surface and preserving the existing warn/error routing, canonical `ValidationIssue` output, and message text.
  - No contract correction was required beyond local timing-specific typing.
- `src/features/architect/utils/tradeMachine/utils/tradeTimingWindows.ts`
  - Moved the authoritative timing date helpers into TS with the same fallback behavior and January 15 calculation.
  - Preserved the shared boundary with `validateSignAndTrade.js`; no timing ownership moved.
- `src/features/architect/utils/timingUtils.ts`
  - Moved the active generic timing helpers into TS and left the out-of-slice reacquisition helper out of the active migration surface.
  - Preserved authoritative behavior by keeping helper math identical and routing JS consumers through pure re-export shims.
- `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`
  - Added apply-path assertions that the retired 60-day message remains absent from `_validatedTradeContext` warning/violation collections and final `applyWorldMutation()` warnings.
  - Preserved the behavior being proven by asserting absence only; no timing logic expectations were weakened.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Remains JS because this pass was limited to typed consumption of timing modules, not engine migration.
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
  - Remains JS because the current S&T timing ownership split had to stay unchanged, and broader S&T migration is the next slice rather than part of E8.
- `src/features/architect/utils/timingUtils.js`
  - Remains JS only as a compatibility host for pure re-exports plus the out-of-slice reacquisition export. No active generic timing business logic remains implemented here.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/timingEnforcement_authoritative.test.js tests/trade/timingGates_softEnforcement.test.js tests/trade/jan15_offseason_timing.test.js tests/trade/validatorTrustFixes.test.js tests/trade/validatorContractCleanup.test.js src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`
  - `npm run validate:project`
- What they prove:
  - `typecheck` proves the TS-backed timing cluster integrates with the existing validator contract.
  - The targeted node suite proves authoritative warning-mode timing behavior, authoritative error-mode blocking, canonical rule-envelope compatibility, Jan. 15 S&T vs generic timing ownership, authoritative apply-path warning survival, and the retired 60-day rule remaining absent from both `validateTrade()` output and authoritative apply-path output.
  - `validate:project` proves the new TS files and shim structure remain valid for repo structure rules.
- Results:
  - PASS.
- Intentionally skipped:
  - `npm run build`
  - `npm run test:trade -- --reporter=dot`
  - full-suite commands
  - Reason: this pass only changed the validator-local timing cluster and its docs; the targeted node suite already covers the authoritative runtime paths touched by E8.

## 7. Remaining TS Migration Queue
- Next best slice: migrate the adjacent authoritative S&T timing surface in `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js` and only the immediate helper/contracts it requires.
- Reason: E8 already moved the shared timing window helper to TS, and `validateSignAndTrade.js` is now the closest remaining authoritative timing rule with a shared boundary to protect.

## 8. Master Doc Update
- Added `Validator TS Timing E8 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the active generic timing implementation is now TS-backed via `timingValidation.ts`, `tradeTimingWindows.ts`, and `timingUtils.ts`.
- Recorded that `timingValidation.js` and `tradeTimingWindows.js` are pure re-export shims, and `timingUtils.js` now only retains the out-of-slice reacquisition export plus pure re-exports for active timing helpers.
- Reaffirmed that the retired 60-day rule remains out of authoritative enforcement, including authoritative apply-path output.
- Recorded that the next migration slice should be `validateSignAndTrade.js` and its immediate helper dependencies.
