# TM_VALIDATOR_TIMING_REVALIDATION_P3 — PREFLIGHT RETURN PACKAGE

## 1. Executive Verdict
- The generic timing cluster is not yet substantively trustworthy in the authoritative validator path.
- It is not ready for TS migration. Timing fixes must happen first.
- STOP conditions were triggered.
- The two blocker-level issues are:
  - live `warn` timing output is still normalized into blocking violations in the authoritative validator path
  - the authoritative 60-day aggregation timing rule is keyed off `signedDate`, not an acquisition timestamp, while surfacing an "acquired within the last 60 days" message

## 2. Scope Reviewed
- Authoritative validator core:
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - `src/features/architect/utils/tradeMachine/rules/timingValidation.js`
  - `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
  - `src/features/architect/utils/tradeMachine/utils/tradeTimingWindows.js`
  - `src/features/architect/utils/timingUtils.js`
  - `src/config/validationFlags.js`
- Preview/apply date-threading surfaces:
  - `src/features/architect/hooks/useTradeMachine.js`
  - `src/features/architect/utils/tradeContext/tradeContext.js`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
  - `src/features/architect/utils/mutationPipeline.js`
- Explanation / consumer surfaces reviewed as diagnostic evidence only:
  - `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
  - `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
  - `src/features/architect/hooks/useTradeMachineSnapshot.js`
- Tests searched and reviewed:
  - `tests/trade/timingGates_softEnforcement.test.js`
  - `tests/trade/jan15_offseason_timing.test.js`
  - `tests/trade/validatorTrustFixes.test.js`
  - `src/tests/trade/validatorContractConsumers.test.jsx`
- Docs reviewed for prior timing ownership context:
  - `return_packages/trade_machine/TM_VALIDATOR_HARDENING_E3_RETURN_PACKAGE.md`
  - `return_packages/trade_machine/TM_VALIDATOR_RULE_FIXES_E4_RETURN_PACKAGE.md`
  - `return_packages/trade_machine/TM_VALIDATOR_TS_CONSENT_ELIGIBILITY_E6_RETURN_PACKAGE.md`
  - `docs/architect/TRADE_MACHINE_MASTER.md`

### Files Changed
- `return_packages/trade_machine/TM_VALIDATOR_TIMING_REVALIDATION_P3_RETURN_PACKAGE.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`

## Known Unknowns / Unproven Areas
- No direct authoritative `validateTrade()` or apply-path runtime tests were found for:
  - moratorium timing
  - explicit `eligibleTradeDate`
  - 30-day trade restriction
  - December 15 newly signed free-agent restriction
  - 3-month midseason signing restriction
  - 60-day aggregation timing
- Repo-wide search found no canonical schema definitions for `signedDate`, `eligibleTradeDate`, `isRecentlyExtended`, `isNewlySignedFA`, or `lastReceivedDate` in `src/schemas/`. That leaves the real live data feed for most generic timing families unproven.
- `src/tests/trade/validatorContractConsumers.test.jsx` uses a mocked validator result. It proves rendering only, not substantive timing correctness.
- A machine-time fallback still exists in `resolveTradeTimingDate()` and in legacy `enforceTimingGates()`, but the `validateTrade()` path already injects canonical `tradeDate` / `asOfDate`. Those helper fallbacks are drift-risk context, not by themselves a proven live timing defect.

## 3. Timing Authority Map
| Timing Family | Implementation Files | Helper Dependencies | Date Source | Overlap With S&T Timing | Entry Into Final Legality |
| --- | --- | --- | --- | --- | --- |
| Moratorium | `rules/timingValidation.js:26-40` | `timingUtils.js:1-7`, `tradeTimingWindows.js:1-4` | `validateTrade()` canonical `tradeDate` / `asOfDate` at `engine/tradeValidator.js:791-827` | None | `validateTrade()` -> `validators.enforceTiming()` at `engine/tradeValidator.js:1225-1229` -> `createRuleEnvelope('timingEnforcement', ...)` at `engine/tradeValidator.js:1387-1390` -> team/top-level violations |
| Explicit `eligibleTradeDate` | `rules/timingValidation.js:47-55` | `tradeTimingWindows.js:1-4` | Same canonical date path | None | Same `timingEnforcement` envelope path |
| 30-day signing restriction | `rules/timingValidation.js:57-64` | `timingUtils.js:8-13`, `tradeTimingWindows.js:1-4` | Same canonical date path | None | Same `timingEnforcement` envelope path |
| December 15 newly signed FA restriction | `rules/timingValidation.js:66-74` | local `isSignedInOffseason()` at `rules/timingValidation.js:212-216`, `tradeTimingWindows.js:1-4` | Same canonical date path | None | Same `timingEnforcement` envelope path |
| January 15 recent-extension restriction | `rules/timingValidation.js:76-85` | `tradeTimingWindows.js:7-13` | Same canonical date path | S&T Jan. 15 is intentionally split out to `rules/validateSignAndTrade.js:159-165` | Same `timingEnforcement` envelope path |
| 3-month midseason signing restriction | `rules/timingValidation.js:87-96` | `timingUtils.js:8-13`, local `isSignedInOffseason()` | Same canonical date path | None | Same `timingEnforcement` envelope path |
| 60-day aggregation timing | `rules/timingValidation.js:99-107` | `timingUtils.js:14-15` | Same canonical date path | Adjacent to second-apron aggregation in `rules/validateAggregation.js:60-83`, but not owned there | Same `timingEnforcement` envelope path |
| Timing enforcement wrapper | `rules/timingValidation.js:125-148` | `config/validationFlags.js:20-23` | Same canonical date path | None | Array output is normalized as blocking `violations` by `engine/tradeValidator.js:217-231`, then flattened into legality at `engine/tradeValidator.js:1409-1414` |

## 4. Timing Correctness Matrix
| Timing Family | Status | Authoritative Location | Date Source | Interaction Risks | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Moratorium | `Partial` | `rules/timingValidation.js:26-40` | `engine/tradeValidator.js:791-827` -> `tradeTimingWindows.js:1-4` | `warn` severity currently still blocks once normalized into live rule envelopes | Helper test only: `tests/trade/timingGates_softEnforcement.test.js:20-30` | No direct `validateTrade()` or apply-path runtime proof was found |
| Explicit `eligibleTradeDate` | `Partial` | `rules/timingValidation.js:47-55` | Same canonical date path | Real field feed is unproven; helper-only proof | Helper test only: `tests/trade/timingGates_softEnforcement.test.js:33-45` | Repo search found no schema definition for `eligibleTradeDate`; no live-path proof exists |
| 30-day signing restriction | `Partial` | `rules/timingValidation.js:57-64` | Same canonical date path | Depends on unschematized `signedDate`; `warn` currently blocks live legality | Helper test only: `tests/trade/timingGates_softEnforcement.test.js:47-59` | No direct `validateTrade()` / apply-path proof exists |
| December 15 newly signed FA restriction | `Unproven` | `rules/timingValidation.js:66-74` | Same canonical date path | Depends on unschematized `signedDate` / `isNewlySignedFA`; stale-signing counterexample not disproven | Code only: `rules/timingValidation.js:66-74,212-216` | Counterexample remains open: `isSignedInOffseason()` checks month only, not whether the signing belongs to the current season |
| January 15 recent-extension restriction | `Partial` | `rules/timingValidation.js:76-85` | Same canonical date path via `tradeTimingWindows.js:7-13` | Data-source field `isRecentlyExtended` is unproven outside fixtures | Direct live-path proof: `tests/trade/jan15_offseason_timing.test.js:118-147` | Ownership split from S&T is correct, but real data-feed coverage is still unproven |
| 3-month midseason signing restriction | `Unproven` | `rules/timingValidation.js:87-96` | Same canonical date path | Depends on unschematized `signedDate`; no direct runtime proof | Code only: `rules/timingValidation.js:87-96` | The helper aggregation test may co-fire a 3-month issue, but it does not assert the 3-month rule directly |
| 60-day aggregation timing | `Incorrect` | `rules/timingValidation.js:99-107` | Same canonical date path, but wrong player field | Overlaps with second-apron aggregation and can both under-block illegal reacquired/received-player cases and over-block legal recently signed cases | Code: `rules/timingValidation.js:99-107`; helper function: `timingUtils.js:14-15`; legacy drift context: `rules/timingValidation.js:194-207`; helper-only test: `tests/trade/timingGates_softEnforcement.test.js:61-77` | The live rule says "acquired within the last 60 days" while checking `signedDate`, not acquisition timing |
| Timing enforcement wrapper | `Incorrect` | `rules/timingValidation.js:125-148`; `engine/tradeValidator.js:217-231,1225-1229,1409-1414`; `config/validationFlags.js:20-23` | Same canonical date path | Converts intended warnings into hard blockers in the authoritative validator path | Helper test proves `warn` callback behavior: `tests/trade/timingGates_softEnforcement.test.js:20-77`; live-path blocking is inferred from `createRuleEnvelope()` and team legality flattening | This is the clearest live timing process defect and a STOP trigger |

## 5. Timing Interaction Findings
### Interaction 1
- Involved rule families: generic timing + S&T timing ownership
- Actual order/path: `validateTrade()` canonicalizes dates first (`engine/tradeValidator.js:791-827`), runs `validateSignAndTrade()` at `engine/tradeValidator.js:1201-1205`, then runs `enforceTiming()` at `engine/tradeValidator.js:1225-1229`
- Verdict: substantively correct
- Evidence:
  - S&T Jan. 15 lives in `rules/validateSignAndTrade.js:159-165`
  - generic recent-extension Jan. 15 lives in `rules/timingValidation.js:76-85`
  - direct live-path proof: `tests/trade/jan15_offseason_timing.test.js:74-147`
  - apply-path proof: `tests/trade/validatorTrustFixes.test.js:267-314`
- Risk if wrong: duplicate or missing Jan. 15 blockers and broken TS migration boundary

### Interaction 2
- Involved rule families: generic timing + second-apron aggregation + generic 60-day aggregation
- Actual order/path: `validateAggregation()` runs at `engine/tradeValidator.js:1211-1214`; generic timing runs later at `engine/tradeValidator.js:1225-1229`
- Verdict: not substantively correct
- Evidence:
  - second-apron aggregation logic: `rules/validateAggregation.js:60-83`
  - generic 60-day timing logic: `rules/timingValidation.js:99-107`
  - wrong source field: `timingUtils.js:14-15`
- Risk if wrong:
  - illegal recently acquired-player aggregation can pass
  - legal recently signed-player trades can be blocked for the wrong reason
  - top-level explanation can point to aggregation before timing, hiding the actual root cause

### Interaction 3
- Involved rule families: generic timing + canonical date context
- Actual order/path:
  - preview path passes `worldAsOfDate` into `validateTrade()` at `hooks/useTradeMachine.js:961-985`
  - apply wrapper passes `asOfDate` into `computeWorldMutation()` at `GMDashboard/hooks/useArchitectActions.ts:1345-1399`
  - post-trade validation passes payload `asOfDate` into `validateTrade()` at `utils/tradeContext/tradeContext.js:632-644`
  - validator canonicalizes `tradeDate` / `asOfDate` at `engine/tradeValidator.js:791-827`
- Verdict: substantively correct in the reviewed authoritative validator path, with drift-risk helper fallbacks left outside that path
- Evidence:
  - preview/apply threading locations above
  - direct apply-path date-threading proof for S&T timing ownership: `tests/trade/validatorTrustFixes.test.js:267-314`
  - helper fallback still exists in `tradeTimingWindows.js:1-4`
- Risk if wrong: timing decisions could drift by real clock instead of world/validator date

### Interaction 4
- Involved rule families: generic timing + explanation ordering
- Actual order/path:
  - `timingEnforcement` is inserted after `aggregation` in `allRules` at `engine/tradeValidator.js:1372-1390`
  - team legality flattens rule violations in insertion order at `engine/tradeValidator.js:1409-1414`
  - top-level `reason` is the first flattened violation at `engine/tradeValidator.js:1513-1524`
- Verdict: risky / only partially correct
- Evidence:
  - UI rule summary shows only the first issue per rule in `tradeMachine/TradeLegalChecker.jsx:21-27`
  - summary panel lists top-level violations but `primaryViolation` still comes from `result.reason` in `hooks/useTradeMachineSnapshot.js:145-156`
- Risk if wrong: timing can be hidden behind salary-matching, aggregation, or trade-exception blockers even when timing is the user’s debugging target

## 6. Process / Sequencing Findings
### TIMING-P3-SEQ-001
- Severity: `LOW`
- Exact file/location: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:791-827`
- What sequence/order behavior was found: `validateTrade()` canonicalizes `asOfDate`, `tradeDate`, and `offseason` before any team-level timing or S&T rule runs.
- Why it is correct or risky: This is the right validator-side sequencing. It keeps generic timing and S&T timing on one canonical date context inside the authoritative engine.
- Evidence:
  - `tradeValidator.js:791-827`
  - `useTradeMachine.js:961-985`
  - `tradeContext.js:632-644`
  - `useArchitectActions.ts:1345-1399`
- Recommended fix direction: No change needed inside `validateTrade()` for canonical date setup.

### TIMING-P3-SEQ-002
- Severity: `LOW`
- Exact file/location: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1201-1229`
- What sequence/order behavior was found: `validateSignAndTrade()` runs before generic `enforceTiming()`.
- Why it is correct or risky: This is the correct ownership order after E3. S&T-specific offseason and S&T Jan. 15 stay in the S&T rule, while generic timing handles only non-S&T timing.
- Evidence:
  - `tradeValidator.js:1201-1229`
  - `validateSignAndTrade.js:159-165`
  - `timingValidation.js:76-85`
  - `tests/trade/jan15_offseason_timing.test.js:74-147`
- Recommended fix direction: Preserve this rule order in any later TS migration.

### TIMING-P3-SEQ-003
- Severity: `BLOCKER`
- Exact file/location: `src/features/architect/utils/tradeMachine/rules/timingValidation.js:125-148`; `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:217-231,1225-1229,1409-1414`
- What sequence/order behavior was found: `enforceTiming()` always returns a plain array of messages, and `createRuleEnvelope()` always normalizes array outputs as blocking `violations` with `severity: 'error'`.
- Why it is correct or risky: This is risky and currently wrong for live behavior. `validationFlags.timingEnforcement` defaults to `warn`, but the authoritative validator still blocks because team legality is derived from flattened `violations`, not from callback intent.
- Evidence:
  - `validationFlags.js:20-23`
  - `timingValidation.js:125-148`
  - `tradeValidator.js:217-231,1225-1229,1409-1414`
  - helper flag behavior: `tests/trade/timingGates_softEnforcement.test.js:20-77`
- Recommended fix direction: Make live timing warnings stay in `warnings` instead of `violations`, or stop feeding warning-mode timing through the array-only enforcement contract.

### TIMING-P3-SEQ-004
- Severity: `BLOCKER`
- Exact file/location: `src/features/architect/utils/tradeMachine/rules/timingValidation.js:99-107`; `src/features/architect/utils/timingUtils.js:14-15`
- What sequence/order behavior was found: the generic 60-day timing check runs in the authoritative timing pass, but it computes the condition from `signedDate`.
- Why it is correct or risky: This is substantively wrong for a rule surfaced as "acquired within the last 60 days." It can both miss illegal recently acquired-player aggregation and reject legal trades involving recently signed players.
- Evidence:
  - `timingValidation.js:99-107`
  - `timingUtils.js:14-15`
  - legacy drift context using `lastReceivedDate`: `timingValidation.js:194-207`
- Recommended fix direction: Re-key the rule to a canonical acquisition timestamp or retire it until the data contract exists.

### TIMING-P3-SEQ-005
- Severity: `MEDIUM`
- Exact file/location: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1372-1390,1513-1524`; `src/features/architect/tradeMachine/TradeLegalChecker.jsx:21-27`
- What sequence/order behavior was found: generic timing is flattened after aggregation and many other rule families, and consumer summaries show only the first per-rule issue.
- Why it is correct or risky: The legality result may still be right, but timing diagnostics can be masked or reduced to a non-primary message.
- Evidence:
  - `tradeValidator.js:1372-1390,1513-1524`
  - `TradeLegalChecker.jsx:21-27`
  - `TradeSummaryPanel.jsx:84-94`
- Recommended fix direction: Add explicit primary-blocker prioritization for timing vs adjacent rule families when multiple blockers coexist.

## 7. Findings List
### TIMING-P3-F001
- Severity: `BLOCKER`
- Type: `Process / enforcement-boundary defect`
- Exact file/location: `src/config/validationFlags.js:20-23`; `src/features/architect/utils/tradeMachine/rules/timingValidation.js:125-148`; `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:217-231,1225-1229,1409-1414`
- What was found: generic timing is configured as `warn` by default, but the authoritative validator still normalizes timing output into blocking `violations`.
- Why it matters: the live validator can reject trades that timing policy currently intends to warn on, which is a direct trust failure and a TS-migration blocker.
- Evidence:
  - flag default: `validationFlags.js:21`
  - helper warning behavior: `tests/trade/timingGates_softEnforcement.test.js:20-77`
  - live array-to-error normalization and legality flattening: `tradeValidator.js:217-231,1409-1414`
- Recommended fix direction: split warning-mode timing into authoritative `warnings`, or change the timing wrapper contract before any migration freezes it into TS.

### TIMING-P3-F002
- Severity: `BLOCKER`
- Type: `Rule correctness defect`
- Exact file/location: `src/features/architect/utils/tradeMachine/rules/timingValidation.js:99-107`; `src/features/architect/utils/timingUtils.js:14-15`
- What was found: the authoritative 60-day aggregation rule checks `signedDate`, not acquisition timing, while surfacing "Cannot aggregate players acquired within the last 60 days".
- Why it matters: the live validator can approve clearly illegal recently acquired-player aggregation and reject clearly legal trades for the wrong reason.
- Evidence:
  - message and live check: `timingValidation.js:99-107`
  - helper implementation: `timingUtils.js:14-15`
  - legacy drift contrast using `lastReceivedDate`: `timingValidation.js:194-207`
  - helper-only test follows the same signedDate-based behavior: `tests/trade/timingGates_softEnforcement.test.js:61-77`
- Recommended fix direction: move the rule onto a canonical acquisition field and align the surfaced message with the actual source field.

### TIMING-P3-F003
- Severity: `HIGH`
- Type: `Data-source / proof gap`
- Exact file/location: `src/features/architect/utils/tradeMachine/rules/timingValidation.js:47-96`; repo-wide schema search over `src/schemas/`
- What was found: the core generic timing families depend on ad hoc fields (`eligibleTradeDate`, `signedDate`, `isNewlySignedFA`, `isRecentlyExtended`) that were not found in the canonical schema layer during this audit.
- Why it matters: even where helper tests pass, real live-path correctness remains only partially proven because the authoritative validator may not actually receive these fields from source data.
- Evidence:
  - generic timing field reads: `timingValidation.js:47-96`
  - repo search found no matching schema definitions in `src/schemas/`
  - only audit-discovered non-test population hit for these flags was S&T payload injection at `tradeContext.js:328-334`
- Recommended fix direction: either formalize these fields in the canonical schema/data contract or explicitly downgrade/retire unsupported timing families until the data feed exists.

### TIMING-P3-F004
- Severity: `MEDIUM`
- Type: `Rule interpretation risk`
- Exact file/location: `src/features/architect/utils/tradeMachine/rules/timingValidation.js:66-74,212-216`
- What was found: the December 15 rule treats any July-September `signedDate` as an offseason signing for the current trade year, without proving the signing belongs to the current season.
- Why it matters: if `signedDate` persists from an earlier multi-year contract signing, the rule can over-block legal pre-Dec. 15 trades.
- Evidence:
  - live logic: `timingValidation.js:66-74`
  - helper month check: `timingValidation.js:212-216`
  - no direct runtime test was found for this family
- Recommended fix direction: anchor the Dec. 15 rule to the current season’s signing window, not only the month of an arbitrary `signedDate`.

### TIMING-P3-F005
- Severity: `MEDIUM`
- Type: `Diagnostics / explanation accuracy`
- Exact file/location: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1372-1390,1513-1524`; `src/features/architect/tradeMachine/TradeLegalChecker.jsx:21-27`; `src/features/architect/tradeMachine/TradeSummaryPanel.jsx:84-94`
- What was found: timing blockers are flattened after other rule families and are summarized by first-message selection in both top-level reasoning and rule-overview UI.
- Why it matters: multi-timing or timing-plus-aggregation failures can be materially harder to debug, even when the underlying rule fires.
- Evidence:
  - rule insertion order and top-level reason: `tradeValidator.js:1372-1390,1513-1524`
  - per-rule first-message summary: `TradeLegalChecker.jsx:21-27`
  - top-level rendered list uses raw flattened violations: `TradeSummaryPanel.jsx:84-94`
- Recommended fix direction: separate "primary blocker" selection from raw collection order, especially when timing and aggregation coexist.

## 8. Explanation / Reason Accuracy Assessment
- S&T timing vs generic timing is currently distinguishable and correct:
  - S&T Jan. 15 surfaces as `...January 15 (sign-and-trade)` in `rules.signAndTrade`
  - recent-extension Jan. 15 surfaces as `...January 15 (recent extension)` in `rules.timingEnforcement`
  - Evidence: `validateSignAndTrade.js:159-165`, `timingValidation.js:76-85`, `tests/trade/jan15_offseason_timing.test.js:74-147`
- The 60-day timing reason is materially misleading:
  - surfaced text says "acquired within the last 60 days"
  - live implementation checks `signedDate`
  - Evidence: `timingValidation.js:99-107`; `timingUtils.js:14-15`
- Warning-vs-error diagnostics are materially misleading in the live path:
  - helper behavior proves warning intent
  - authoritative envelope normalization still turns those messages into blocking violations
  - Evidence: `timingGates_softEnforcement.test.js:20-77`; `tradeValidator.js:217-231,1409-1414`
- Multi-blocker timing cases are likely to be diagnostically weak:
  - `aggregation` is inserted before `timingEnforcement`
  - top-level `reason` is just the first flattened violation
  - rule overview UI shows only the first timing item per rule
- `src/tests/trade/validatorContractConsumers.test.jsx` confirms the official UI can render timing text, but it does not prove the text came from a correct live timing decision.

## 9. Test Sufficiency Assessment
- Directly convincing timing tests:
  - `tests/trade/jan15_offseason_timing.test.js:74-147`
    - proves the S&T vs generic Jan. 15 ownership split through `validateTrade()`
  - `tests/trade/validatorTrustFixes.test.js:267-314`
    - proves authoritative apply-path date threading changes timing ownership for S&T timing
- Helper-only timing tests:
  - `tests/trade/timingGates_softEnforcement.test.js:20-77`
    - proves helper-level moratorium, `eligibleTradeDate`, 30-day, and signedDate-based 2-month behavior
    - also proves helper intent for `warn` vs `error`
- Missing timing edge-case tests:
  - no direct `validateTrade()` / apply-path moratorium test
  - no direct `validateTrade()` / apply-path `eligibleTradeDate` test
  - no direct `validateTrade()` / apply-path 30-day test
  - no direct `validateTrade()` / apply-path Dec. 15 test
  - no direct `validateTrade()` / apply-path 3-month test
  - no direct `validateTrade()` / apply-path 60-day aggregation timing test
  - no direct test proving canonical schema/data population of timing fields
- Likely escaped timing bug classes:
  - warning-mode timing becoming blocking in live validation
  - wrong source field for 60-day aggregation timing
  - stale `signedDate` causing false-positive Dec. 15 blocks
  - real-data absence of timing metadata leaving rules effectively dormant

### Validation Commands Actually Run
- `npm run test:node -- --reporter=dot tests/trade/timingGates_softEnforcement.test.js tests/trade/jan15_offseason_timing.test.js tests/trade/validatorTrustFixes.test.js`
  - Passed: `3` files, `14` tests
- `npm run test:ui -- --reporter=dot src/tests/trade/validatorContractConsumers.test.jsx`
  - Passed: `1` file, `1` test

### Commands Intentionally Skipped
- `npm run test:trade -- --reporter=dot`
  - Skipped because the audit standard requires timing-specific proof, not a broad suite stand-in
- `npm run build`
  - Skipped because this was a doc-only audit with no runtime code changes
- `npm run typecheck`
  - Skipped because no TS/TSX/runtime code changed in this pass
- `npm run validate:project`
  - Skipped because no structural repo changes were made
- Full-suite commands
  - Skipped because the prompt did not contain `RUN FULL SUITE`, and repo policy blocks them without that exact phrase
- Additional timing test commands
  - No other targeted timing-focused tests were found by repo search for moratorium, `eligibleTradeDate`, 30-day, Dec. 15, 3-month, or 60-day authoritative-path coverage beyond the commands listed above

## 10. Recommended Next Passes
1. Required timing fixes
   - Fix the authoritative timing warning/error boundary so `validationFlags.timingEnforcement = 'warn'` does not still block trades.
   - Rework or retire the 60-day aggregation timing rule until it uses a canonical acquisition date instead of `signedDate`.
   - Re-lock the Dec. 15 rule to a current-season signing source if the rule is meant to stay active.
2. Required missing timing tests
   - Add direct `validateTrade()` and apply-path tests for moratorium, `eligibleTradeDate`, 30-day, Dec. 15, 3-month, and 60-day behavior.
   - Add at least one timing-plus-aggregation explanation-order test.
   - Add at least one real-data-shape timing fixture proving where timing metadata comes from in the authoritative path.
3. TS migration decision
   - Pause generic timing TS migration.
   - No files in the generic timing cluster are safe to migrate next until the blocker fixes land.
   - Re-evaluate `src/features/architect/utils/tradeMachine/rules/timingValidation.js` only after the fix pass; `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` will likely need part of that re-lock because the live blocking behavior is created at the envelope/flattening boundary.

## 11. STOP Conditions
- STOP condition triggered: `generic timing can still reject clearly legal trades`
  - Evidence: `validationFlags.js:21` sets timing to `warn`, `timingValidation.js:125-148` still returns a plain array, and `tradeValidator.js:217-231,1409-1414` normalizes that array as blocking `violations`
- STOP condition triggered: `generic timing can still approve clearly illegal trades`
  - Evidence: `timingValidation.js:99-107` says "acquired within the last 60 days", but `timingUtils.js:14-15` checks `signedDate`, not acquisition timing
- STOP condition triggered: `surfaced timing reason is materially misleading in a way that blocks trust/debugging`
  - Evidence: 60-day message/source mismatch at `timingValidation.js:99-107` + `timingUtils.js:14-15`; first-message explanation order at `tradeValidator.js:1513-1524` and `TradeLegalChecker.jsx:21-27`
- STOP condition not triggered: `generic timing and S&T timing ownership are substantively overlapping or contradictory`
  - Evidence: `tests/trade/jan15_offseason_timing.test.js:74-147` and `tests/trade/validatorTrustFixes.test.js:267-314` prove the ownership split is currently correct
