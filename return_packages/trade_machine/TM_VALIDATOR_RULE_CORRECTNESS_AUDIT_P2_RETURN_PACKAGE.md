# TM_VALIDATOR_RULE_CORRECTNESS_AUDIT_P2 — PREFLIGHT RETURN PACKAGE

## 1. Executive Verdict
The authoritative validator is not yet substantively trustworthy enough to treat as fully correct. The strongest parts of the live path are salary valuation, salary matching, hard-cap ceilings, sign-and-trade core legality, roster counting, two-way trade blocking, Stepien routing, and entitlement exclusivity. The audit still found blocker-level rule-processing defects in live TPE and cash handling.

TS migration should not continue into validator rule modules yet. At most, continue only on already-clean shared contract/helper surfaces that do not change validator rule behavior. Rule fixes should happen first for TPE date handling, TPE restriction processing in the live preview/apply path, and cash-rule field alignment.

STOP conditions were triggered.

## 2. Scope Reviewed
Authoritative path and minimum preview/apply/output surfaces reviewed:

- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
- `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
- `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`
- `src/features/architect/hooks/useTradeMachineSnapshot.js`

Authoritative rule/helpers reached by live import chain:

- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
- `src/features/architect/utils/tradeMachine/rules/timingValidation.js`
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.js`
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
- `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js`
- `src/features/architect/utils/tradeMachine/rules/validateEligibility.js`
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
- `src/features/architect/utils/tradeMachine/rules/basicRules.js`
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js`
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js`
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
- `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js`
- `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js`
- `src/features/architect/utils/tradeMachine/utils/buildEntitlementRoutingMap.ts`
- `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js`
- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts`
- `src/features/architect/utils/entitlements/entitlementExclusivityValidator.ts`
- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`

Tests reviewed and run as primary runtime evidence:

- `tests/trade/salaryMatching.test.js`
- `tests/trade/byc_outgoing_max.test.js`
- `tests/trade/poisonPill_average.test.js`
- `tests/trade/tradeKicker_proration.test.js`
- `tests/trade/tradeKicker_zeroGuarantee.test.js`
- `tests/trade/orderOfOps_conversionsBeforeMatching.test.js`
- `tests/trade/signAndTrade_completeness.test.js`
- `tests/trade/jan15_offseason_timing.test.js`
- `tests/trade/secondApronBoundary.test.js`
- `tests/trade/tpe_absorption_fail_closed.test.js`
- `tests/trade/tpe_creation_expiry_usage.test.js`
- `tests/trade/secondApron_tpeBan.test.js`
- `tests/trade/hardCap_trigger_faException.test.js`
- `tests/trade/cashLedger_season_tracking.test.js`
- `tests/trade/rosterLegality_validateTrade.test.js`
- `tests/trade/roster_twoWay_enforcement.test.js`
- `tests/trade/twoWayPlayers_snapshot.test.js`
- `tests/validators/stepien.test.js`
- `tests/validators/stepienEntitlements.test.js`
- `tests/validators/stepienEntitlementBaseline.test.js`
- `tests/validators/hardCap.test.js`
- `tests/trade/frozenPick_consequences.test.js`
- `tests/trade/validatorTrustFixes.test.js`
- `tests/trade/validatorContractCleanup.test.js`
- `tests/trade/useTradeMachine.validatorTrust.test.ts`
- `src/tests/trade/goldenTrades.test.js`
- `src/tests/trade/playerRouting.test.js`
- `src/tests/trade/tpe_perPlayer.guardrail.test.js`
- `src/tests/trade/secondApron_SSOT_guardrail.test.js`
- `src/tests/architect/phase17_entitlement_routing_guardrail.test.js`
- `src/tests/architect/entitlementExclusivityValidator.test.ts`
- `src/tests/architect/worldTradeApplyExclusivityGate.test.ts`
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
- `src/tests/trade/validatorContractConsumers.test.jsx`
- `tests/tradeValidatorEdgeCases.test.js`

Docs reviewed as starting context, not proof:

- `return_packages/trade_machine/TM_VALIDATOR_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_TRUST_FIXES_E1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_CONTRACT_CLEANUP_E2_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_HARDENING_E3_RETURN_PACKAGE.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`

### Files Changed
- `return_packages/trade_machine/TM_VALIDATOR_RULE_CORRECTNESS_AUDIT_P2_RETURN_PACKAGE.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`

## Known Unknowns / Unproven Areas
- No direct runtime proof was found for the real UI authoring path for `appliedTPEs`; the active preview/apply wrappers were traced instead. More proof would require a focused preview/apply runtime test that exercises a real TPE selection flow.
- The timing family is only partially proven end-to-end. Jan. 15 ownership is directly proven, but moratorium, Dec. 15, 30-day, 3-month, and 60-day aggregation cases were not all run through `validateTrade()` in this pass.
- FA-exception legality is only partially proven in the live validator path. The ordering and mutation behavior are clear in code, but multi-bucket and multi-player end-to-end cases were not directly run here.
- `tests/validators/hardCap.test.js` targets the non-authoritative TS twin `src/features/architect/utils/tradeMachine/rules/validateHardCap.ts`, not the live JS rule used by `tradeValidator.js`. That failure is evidence of drift-risk and weak migration readiness, not authoritative proof against the live engine.

## 3. Substantive Rule Map
| Rule Family | Implementation Files | Key Dependencies | Overlapping Rules | Entry Into Final Legality |
| --- | --- | --- | --- | --- |
| Salary matching legality | `tradeValidator.js:978-1124,1172-1194,1338-1407`; `validateSalaryMatching.js:50-568` | `matchingValues.js:115-310`; `salaryMatchingRules.js:183-260`; `hardCapStatus.js:262-320+` | Hard cap, FA exception, TPE, second apron | `team.rules.salaryMatching` -> `teamResults[*].violations` -> top-level `violations`/`reason` |
| Hard-cap / apron ceilings | `hardCapValidation.js:18-179` | `hardCapStatus.js:133-246,262+`; `tradeValidator.js:1194` | Salary matching, S&T receiver hard cap, FA exception | `team.rules.hardCap` and `teamResults[*].hardCapped` |
| Base-year compensation | `matchingValues.js:147-158` | `tradeValidator.js:978-1124` | Poison pill, trade kicker, salary matching | Indirect via `salaryOut` recompute before all salary-cap rules |
| Poison-pill valuation | `matchingValues.js:160-200` | `tradeValidator.js:978-1124` | BYC coexistence, trade kicker, salary matching | Indirect via `salaryIn` recompute before all salary-cap rules |
| Trade kicker handling | `matchingValues.js:202-274` | `tradeValidator.js:978-1124` | BYC, poison pill, salary matching | Indirect via `salaryIn` recompute before all salary-cap rules |
| Sign-and-trade legality | `validateSignAndTrade.js:45-249` | `signAndTradeEligibility.ts:202-443`; `tradeTimingWindows.js`; `tradeValidator.js:1201-1205` | Timing, taxpayer MLE, hard cap/apron | `team.rules.signAndTrade` and `teamResults[*].hardCapped` |
| Sign-and-trade receiver consequences | `validateSignAndTrade.js:206-235`; `tradeValidator.js:1455-1460` | `hardCapValidation.js`; `hardCapStatus.js` | Hard cap rule, explanation ordering | `team.rules.signAndTrade`, `team.rules.hardCap`, `teamResults[*].hardCapped` |
| Aggregation restrictions | `validateAggregation.js:16-99`; `basicRules.js:42-107` | `capUtils.js`; `tradeValidator.js:1211-1233` | Salary matching, timing, second apron handcuffs | `team.rules.aggregation`; `team.rules.secondApronEnforcement` |
| Recently signed / recently extended / trade-date timing | `timingValidation.js:26-149`; `validateSignAndTrade.js:159-165` | `timingUtils.js`; `tradeTimingWindows.js`; `tradeValidator.js:1225-1229` | S&T, aggregation | `team.rules.timingEnforcement`; S&T Jan. 15 also enters `team.rules.signAndTrade` |
| Roster count legality | `tradeValidator.js:343-466,1235-1236,1402-1405` | `validationFlags.js` | Two-way trade block, apply snapshot shape | `team.rules.rosterCount` |
| Two-way trade restrictions | `validateEligibility.js:15-25,43-52,164-186`; `tradeValidator.js:1221-1224` | `twoWayPlayers_snapshot.test.js`; roster validation | Roster count | `team.rules.eligibilityEnforcement` and `team.rules.rosterCount` |
| TPE legality and usage restrictions | `validateTradeExceptions.js:15-167`; `validateSalaryMatching.js:178-322` | `normalizeTeamTpe.js:280-302`; `tradeUtilities.js`; `tradeValidator.js:1197-1200` | Salary matching, second apron, cash/apron, apply/preview input shape | `team.rules.tradeExceptions`; salary-matching skip/bypass behavior |
| FA-exception trade absorption legality | `validateFaExceptionUsage.js:4-116`; `validateSalaryMatching.js:146-176,324-376` | `faExceptionUtils.js`; `tradeValidator.js:1172-1187` | Salary matching, hard cap, apron | `team.rules.faExceptionUsage`; downstream `team.rules.salaryMatching`/`hardCap` |
| Stepien / frozen-pick / pick-routing legality | `validateStepien.js:125-380`; `stepienEntitlementUtils.js:47-263` | `tradeValidator.js:1195`; `validateEntitlementRouting.js`; `validatePlayerRouting.js` | Entitlement routing, exclusivity, second apron frozen pick | `team.rules.stepienRule` |
| Entitlement exclusivity / routing legality | `validateEntitlementRouting.js:93-257`; `buildEntitlementRoutingMap.ts:78-176`; `entitlementExclusivityValidator.ts:170+`; `tradeValidator.js:992-1040,1238-1336` | `computePostTradeEntitlements` in `stepienEntitlementUtils.js:184-263` | Stepien, apply routing, linked packages | Fail-fast top-level exit for routing/linkage; per-team `team.rules.entitlementExclusivity` |
| Cash-in-trade legality | `eligibilityRules.js:91-125`; `basicRules.js:96-100`; `tradeValidator.js:965-966,1196,1230-1233` | `useTradeMachine.js:961-985`; `tradeContext.js:571-583` | Second apron, seasonal cash limit, explanation ordering | `team.rules.cash`; also `team.rules.secondApronEnforcement` for second-apron cash |

## 4. Rule Correctness Matrix
| Rule Family | Status | Authoritative Location | Key Dependencies | Interaction Risks | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Salary matching legality | Correct | `tradeValidator.js:978-1124,1172-1194`; `validateSalaryMatching.js:50-568` | `matchingValues.js`; `salaryMatchingRules.js`; `hardCapStatus.js` | Explanation can still prioritize salary matching over more specific blockers | Code: matching values computed before salary totals and rule evaluation. Runtime: `tests/trade/salaryMatching.test.js`, `tests/trade/orderOfOps_conversionsBeforeMatching.test.js`, `src/tests/trade/goldenTrades.test.js` all passed. | Counterexample checked: stale input `matchOutgoing`/`matchIncoming` values. `orderOfOps_conversionsBeforeMatching.test.js:22-80` proves recompute overrides them before matching. |
| Hard-cap / apron ceilings | Correct | `hardCapValidation.js:18-179`; `validateSalaryMatching.js:469-563` | `hardCapStatus.js` | Duplicate messaging with S&T receiver consequences | Code: hard-cap ceiling and effective allowable incoming are independently enforced. Runtime: `tests/trade/salaryMatching.test.js:61-214`, `tests/trade/secondApronBoundary.test.js:53-205`, `src/tests/trade/secondApron_SSOT_guardrail.test.js:14-125` passed. | Counterexample checked: exact second-apron boundary and apron-crossing trade. Both are handled correctly in the live path. |
| Base-year compensation | Correct | `matchingValues.js:147-158` | `tradeValidator.js:978-1124` | Poison pill / trade kicker coexistence | Runtime: `tests/trade/byc_outgoing_max.test.js:18-37`, `tests/trade/orderOfOps_conversionsBeforeMatching.test.js:22-48` passed. | Counterexample checked: prior salary larger than 50% of new, and vice versa. Both handled correctly. |
| Poison-pill / valuation edge cases | Correct | `matchingValues.js:160-200` | `tradeValidator.js:978-1124` | BYC coexistence | Runtime: `tests/trade/poisonPill_average.test.js:27-64`, `tests/trade/orderOfOps_conversionsBeforeMatching.test.js:50-80` passed. | Counterexample checked: rookie-extension average and BYC coexistence. Both handled correctly. |
| Trade kicker handling | Correct | `matchingValues.js:202-274` | `tradeValidator.js:978-1124` | BYC coexistence, guaranteed-money cap | Runtime: `tests/trade/tradeKicker_proration.test.js:15-77`, `tests/trade/tradeKicker_zeroGuarantee.test.js` passed. | Counterexample checked: zero remaining guaranteed money. Existing test proves no kicker is applied. |
| Sign-and-trade legality | Correct | `validateSignAndTrade.js:45-249` | `signAndTradeEligibility.ts:202-443`; `tradeTimingWindows.js` | Hard cap and timing split | Runtime: `tests/trade/signAndTrade_completeness.test.js:37-165`, `tests/trade/jan15_offseason_timing.test.js:61-149`, `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts:118-260` passed. | Counterexample checked: missing contract payload, offseason false, non-origin team, taxpayer MLE receiver, Jan. 15 timing. All handled in the active rule path. |
| Sign-and-trade receiver consequences | Partial | `validateSignAndTrade.js:206-235`; `tradeValidator.js:1455-1460` | `hardCapValidation.js`; `hardCapStatus.js` | Hard-cap rule envelope can still pass while S&T rule carries the actual hard-cap trigger | Code: receiving team is flagged hard-capped under S&T rule and team-level `hardCapped` output. Runtime: `tests/trade/signAndTrade_completeness.test.js:144-164`, `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts:178-260` passed. | Counterexample checked: receiving S&T pushes team above first apron. Legality is blocked correctly, but the substantive hard-cap consequence is surfaced under `signAndTrade` more than `hardCap`, so explanation accuracy is only partial. |
| Aggregation restrictions | Partial | `validateAggregation.js:16-99`; `basicRules.js:42-107` | `capUtils.js` | Duplicated second-apron semantics across `aggregation` and `secondApronEnforcement` | Code: one rule only blocks “aggregate up”/multi-team incoming, the other blocks any multi-outgoing second-apron aggregation. Runtime: `src/tests/trade/secondApron_SSOT_guardrail.test.js:60-89` passed for one subset only. | Counterexample checked: second-apron team sends multiple players for a similar-value or lower-paid return. No direct live-path test proved whether the stricter `basicRules.js:90-94` behavior is intended, so this family remains partial. |
| Recently signed / recently extended / trade-date timing restrictions | Partial | `timingValidation.js:26-149`; `validateSignAndTrade.js:159-165` | `timingUtils.js`; `tradeTimingWindows.js` | Explanation order vs aggregation/salary blockers | Runtime: `tests/trade/jan15_offseason_timing.test.js:61-149` passed and proved Jan. 15 ownership split. | Counterexample checked: S&T Jan. 15 vs recent-extension Jan. 15. That split is correct. Moratorium, Dec. 15, 30-day, 3-month, and 60-day aggregation remain only partially proven end-to-end. |
| Roster count legality | Correct | `tradeValidator.js:343-466,1235-1236` | `validationFlags.js` | Two-way snapshot shape | Runtime: `tests/trade/rosterLegality_validateTrade.test.js:26-143` passed. | Counterexample checked: apply-time overlap double counting. The ID-aware branch in `computeRosterValidation()` handles post-trade snapshots; tests cover max/min/two-way overflow. |
| Two-way trade restrictions | Correct | `validateEligibility.js:15-25,43-52,164-186`; `tradeValidator.js:1221-1224` | `tradeContext.js` snapshot maintenance; roster rule | Two-way slots vs outright trade block | Code: outgoing two-way players are blocked before roster count. Runtime: `tests/trade/twoWayPlayers_snapshot.test.js:38-159`, `tests/trade/roster_twoWay_enforcement.test.js:9-33` passed. | Counterexample checked: two-way player already present on receiving team during apply snapshot. Snapshot maintenance avoids duplicates and still preserves two-way arrays. |
| TPE legality and usage restrictions | Incorrect | `validateTradeExceptions.js:15-167`; `validateSalaryMatching.js:178-322`; `useTradeMachine.js:961-985`; `tradeContext.js:571-583` | `normalizeTeamTpe.js`; `basicRules.js:77-84` | Salary matching bypass, second-apron TPE ban, TPE+salary aggregation | Code: prior-year TPE and TPE+outgoing-salary bans only fire when `usingAppliedTPEs === true` (`validateTradeExceptions.js:79-98`), but the active preview/apply wrappers do not pass `appliedTPEs`. The fallback second-apron handcuff check reads `getTeamTpeList(team)` on the wrapper, not `team.team`, so it can miss held TPEs. Runtime: `tests/trade/tpe_creation_expiry_usage.test.js` and `tests/trade/secondApron_tpeBan.test.js` passed only because they inject `appliedTPEs` directly into `validateTrade()`, a shape the active wrappers do not send. | Counterexample checked: second-apron team uses a prior-year team-held TPE via `team.team.tradeExceptions` and `tpeId`, without `appliedTPEs`. The current authoritative preview/apply path appears able to miss that blocker. |
| FA-exception trade absorption legality | Partial | `validateFaExceptionUsage.js:4-116`; `validateSalaryMatching.js:146-176,324-376` | `faExceptionUtils.js`; `tradeValidator.js:1172-1187` | Hard-cap consequence, salary matching bypass, outgoing salary combination | Code: FA usage runs before salary matching and mutates bucket remaining plus hard-cap state. Runtime: `tests/trade/hardCap_trigger_faException.test.js:27-36` passed, and consumer/UI coverage expects FA blockers/warnings in canonical envelopes (`src/tests/trade/validatorContractConsumers.test.jsx:118-145`). | Counterexample checked: FA exception with outgoing salary. Code blocks it, but live end-to-end coverage is still thin for multi-player or multi-bucket cases, so this remains partial. |
| Stepien / frozen-pick / pick-routing legality | Correct | `validateStepien.js:125-380`; `validateEntitlementRouting.js:93-257`; `validatePlayerRouting.js:91-202` | `stepienEntitlementUtils.js`; `tradeValidator.js:992-1065,1195` | Routing must precede Stepien | Runtime: `tests/validators/stepien.test.js`, `tests/validators/stepienEntitlements.test.js:199-258+`, `tests/validators/stepienEntitlementBaseline.test.js`, `tests/trade/frozenPick_consequences.test.js`, `src/tests/trade/playerRouting.test.js`, `src/tests/architect/phase17_entitlement_routing_guardrail.test.js` all passed. | Counterexample checked: 3-team pick/player routing without explicit destination. The validator fails early before Stepien math, which is the correct sequencing. |
| Entitlement exclusivity / routing legality | Correct | `tradeValidator.js:992-1040,1238-1336`; `buildEntitlementRoutingMap.ts:78-176`; `entitlementExclusivityValidator.ts:170+` | `computePostTradeEntitlements` | Stepien and linked-package legality | Runtime: `src/tests/architect/phase17_entitlement_routing_guardrail.test.js`, `src/tests/architect/entitlementExclusivityValidator.test.ts`, `src/tests/architect/worldTradeApplyExclusivityGate.test.ts` passed. | Counterexample checked: duplicate entitlement ownership or incomplete linked package. Both fail closed in the authoritative path. |
| Cash-in-trade legality | Incorrect | `eligibilityRules.js:91-125`; `basicRules.js:96-100`; `tradeValidator.js:965-966,1196,1230-1233`; `useTradeMachine.js:961-985` | `tradeContext.js:571-583` | Second apron, seasonal cash limit, preview/apply field shapes | Code: second-apron cash is blocked by `secondApronEnforcement` using `cashSent`, but `validateCash()` reads `cashOut` and the preview wrapper does not pass any cash fields. Runtime: `tests/tradeValidatorEdgeCases.test.js:187-226` passed and proves live second-apron cash blocking through `cashSent`; `tests/trade/cashLedger_season_tracking.test.js:5-24` passed only as helper coverage using `cashOut`. | Counterexample checked: below-second-apron team exceeds seasonal cash ledger using `cashSent`. The authoritative engine/apply shapes do not feed that helper correctly, so this family is incorrect overall. |

## 5. Rule Interaction Findings
| Interaction | Actual Order / Path | Verdict | Evidence | Risk If Wrong |
| --- | --- | --- | --- | --- |
| Salary matching + hard cap / apron | `computeMatchingValues` -> salary recompute -> `validateSalaryMatching` -> `validateHardCap` | Substantively correct for legality; partially weak for explanation | `tradeValidator.js:978-1124,1190-1194`; `validateSalaryMatching.js:469-563`; `hardCapValidation.js:139-165`; runtime: `tests/trade/salaryMatching.test.js`, `tests/trade/secondApronBoundary.test.js` | Could mislabel the primary blocker, but current legality outcome is correct. |
| Sign-and-trade + hard cap / apron | `validateHardCap` runs before `validateSignAndTrade`; S&T rule separately enforces receiver first-apron consequence | Partial | `tradeValidator.js:1194,1201-1205,1455-1460`; `validateSignAndTrade.js:206-235`; runtime: `tests/trade/signAndTrade_completeness.test.js:144-164` | Hard-cap consequence can land under S&T rather than the hard-cap rule envelope, which is diagnostically weaker. |
| Sign-and-trade + timing | Generic timing later; S&T-specific Jan. 15 owned inside `validateSignAndTrade` | Correct | `tradeValidator.js:1201-1229`; `validateSignAndTrade.js:159-165`; `timingValidation.js:76-85`; runtime: `tests/trade/jan15_offseason_timing.test.js:61-149` | Wrong ownership would create duplicate or missing Jan. 15 blockers. Current split is correct. |
| FA-exception + apron / hard cap | `validateFaExceptionUsage` mutates team before salary matching and hard cap | Partial but sequencing is correct | `tradeValidator.js:1172-1187`; `validateFaExceptionUsage.js:95-110`; runtime: `tests/trade/hardCap_trigger_faException.test.js:27-36` | If ordered later, the hard-cap trigger would be missed. The order is right, but live edge-case proof is incomplete. |
| TPE + apron restrictions | `validateSalaryMatching` can honor team-held TPEs; `validateTradeExceptions` only blocks some apron cases when `appliedTPEs` survive; `secondApronEnforcement` fallback misses nested team TPEs | Incorrect | `validateSalaryMatching.js:198-205`; `validateTradeExceptions.js:41-47,79-98`; `basicRules.js:77-84`; `useTradeMachine.js:961-985`; `tradeContext.js:571-583` | Illegal TPE trades can be approved in the active preview/apply path. |
| Aggregation + timing restrictions | `validateAggregation` runs before `timingEnforcement`; both still execute | Partial | `tradeValidator.js:1211-1229`; `validateAggregation.js:60-83`; `timingValidation.js:99-149` | Multi-blocker trades can surface aggregation first even when timing is equally or more informative. |
| Pick routing + Stepien / frozen-pick logic | Routing/linkage fail fast before per-team Stepien | Correct | `tradeValidator.js:992-1065`; `validatePlayerRouting.js:155-175`; `validateEntitlementRouting.js:145-172`; runtime: `src/tests/trade/playerRouting.test.js`, `src/tests/architect/phase17_entitlement_routing_guardrail.test.js` | If routing ran later, salary/pick rules could compute against broadcast or invalid assets. |
| Entitlement exclusivity + routing + Stepien | Routing map built first, then post-trade entitlement set, then exclusivity, with separate Stepien evaluation in per-team rules | Correct | `tradeValidator.js:1238-1336`; `buildEntitlementRoutingMap.ts:66-176`; `stepienEntitlementUtils.js:184-263`; runtime: `src/tests/architect/entitlementExclusivityValidator.test.ts`, `src/tests/architect/worldTradeApplyExclusivityGate.test.ts` | If wrong, the validator could silently approve duplicate pick claims. Current path fails closed. |
| Roster count + two-way / non-standard contract handling | `enforceEligibility` blocks trading two-way contracts; inline roster count then enforces post-trade 14-15/3-slot rules | Correct | `tradeValidator.js:1221-1236`; `validateEligibility.js:43-52`; `tradeValidator.js:428-450`; runtime: `tests/trade/twoWayPlayers_snapshot.test.js`, `tests/trade/rosterLegality_validateTrade.test.js` | Wrong sequencing could allow trading a barred two-way player or double-counting apply snapshots. Current path handles both. |

## 6. Process / Sequencing Findings
### SEQ-001
Severity: LOW
Exact file/location: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:978-1124`
What sequence/order behavior was found: Matching-value conversions run before `salaryOut`/`salaryIn` are recomputed and before any salary-cap rule executes.
Why it is correct or risky: This is the substantively correct order. BYC, poison pill, trade kicker, and S&T contract cap hits all have to be resolved before salary matching, hard cap, FA exception, and TPE logic consume the numbers.
Evidence: `tests/trade/orderOfOps_conversionsBeforeMatching.test.js:22-80` passed; `matchingValues.js:147-274` shows the conversions; `tradeValidator.js:1082-1124` recomputes salary totals after conversion.
Recommended fix direction: No change.

### SEQ-002
Severity: LOW
Exact file/location: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:992-1065`
What sequence/order behavior was found: Entitlement routing, entitlement linkage, and player routing are fail-fast gates before per-team rule evaluation.
Why it is correct or risky: This is substantively correct. Salary, Stepien, exclusivity, and hard-cap calculations should not run against unresolved or broadcast assets.
Evidence: `validateEntitlementRouting.js:145-172`; `validatePlayerRouting.js:155-175`; runtime: `src/tests/trade/playerRouting.test.js`, `src/tests/architect/phase17_entitlement_routing_guardrail.test.js` passed.
Recommended fix direction: No change.

### SEQ-003
Severity: BLOCKER
Exact file/location: `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js:111-116`
What sequence/order behavior was found: `validateTrade()` normalizes `tradeDate`/`asOfDate` up front, but TPE expiry validation ignores that canonical date and instead uses `new Date()`.
Why it is correct or risky: This creates false negatives for historical worlds and false positives for future-dated worlds. The sequencing is substantively wrong because date-dependent TPE legality is not using the validator’s own canonical trade date.
Evidence: `tradeValidator.js:787-831` builds canonical dates; `validateTradeExceptions.js:113-116` uses system time instead.
Recommended fix direction: Route expiry checks through `context.tradeDate`/`context.asOfDate`, not the machine clock.

### SEQ-004
Severity: BLOCKER
Exact file/location: `src/features/architect/hooks/useTradeMachine.js:961-985`; `src/features/architect/utils/tradeContext/tradeContext.js:571-583`; `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js:41-47,79-98`
What sequence/order behavior was found: The active preview/apply entries call `validateTrade()` without `appliedTPEs`, but the rule-processing order later assumes `usingAppliedTPEs` to enforce second-apron prior-year TPE bans and TPE+outgoing aggregation bans.
Why it is correct or risky: This is substantively wrong. The rule branches that carry key TPE restrictions do not run in the live preview/apply path even though TPE absorption can still be recognized through team-held TPE data.
Evidence: Preview/apply wrappers omit `appliedTPEs`; `validateTradeExceptions.js:79-98` gates the restrictions on `usingAppliedTPEs`; `validateSalaryMatching.js:200-205` still allows fallback to team-held TPEs.
Recommended fix direction: Make TPE restriction checks depend on actual TPE usage, not on whether the caller happened to preserve `appliedTPEs`.

### SEQ-005
Severity: MEDIUM
Exact file/location: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1338-1525`; `src/features/architect/hooks/useTradeMachineSnapshot.js:139-162`
What sequence/order behavior was found: Top-level `reason` is the first flattened violation from rule insertion order, and official snapshot consumers expose that string as the primary violation.
Why it is correct or risky: Legality may be correct while the surfaced primary reason is not the most specific blocker. This materially reduces diagnostic trust in multi-failure trades.
Evidence: `buildValidationResult()` uses the first normalized violation (`tradeValidator.js:303-308`); `reason` is built from flattened team violations in rule order (`tradeValidator.js:1513-1525`); `useTradeMachineSnapshot.js:143-158` exposes `result.reason` directly.
Recommended fix direction: Add explicit blocker-priority ordering or a “primary blocker” selection layer separate from raw collection order.

## 7. Findings List
### P2-F001
Severity: BLOCKER
Type: Rule processing / date dependence
Exact file/location: `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js:111-116`
What was found: TPE expiry is checked against `new Date()` instead of the validator’s canonical `tradeDate` or `asOfDate`.
Why it matters: The validator can reject legal historical trades and approve illegal future-dated trades.
Evidence: `tradeValidator.js:791-831` computes canonical dates; `validateTradeExceptions.js:113-116` ignores them. Existing expiry test coverage (`tests/trade/tpe_creation_expiry_usage.test.js:54-86`) only proves the current machine-date path, not trade-date correctness.
Recommended fix direction: Thread the canonical validator date into `validateTradeExceptions()` and use it for expiry checks.

### P2-F002
Severity: BLOCKER
Type: Rule processing / active-path TPE restriction loss
Exact file/location: `src/features/architect/hooks/useTradeMachine.js:961-985`; `src/features/architect/utils/tradeContext/tradeContext.js:571-583`; `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js:79-98`; `src/features/architect/utils/tradeMachine/rules/basicRules.js:77-84`
What was found: The live preview/apply paths drop `appliedTPEs`, but the second-apron prior-year TPE ban and the TPE+outgoing-salary aggregation ban only fire when `usingAppliedTPEs` is true.
Why it matters: The validator can approve illegal TPE trades in the authoritative path even though direct engine tests pass with artificially injected `appliedTPEs`.
Evidence: `useTradeMachine.js` and `tradeContext.js` omit `appliedTPEs`; `validateTradeExceptions.js:79-98` gates those restrictions on `usingAppliedTPEs`; `validateSalaryMatching.js:200-205` still consumes team-held TPEs from `team.team`; `tests/trade/secondApron_tpeBan.test.js:45-78` only proves the injected-`appliedTPEs` case.
Recommended fix direction: Detect actual TPE usage from incoming-player assignments or normalized TPE resolution, and enforce the restrictions independently of wrapper-preserved `appliedTPEs`.

### P2-F003
Severity: HIGH
Type: Rule family incompleteness
Exact file/location: `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js:91-125`; `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:965-966`; `src/features/architect/hooks/useTradeMachine.js:961-985`
What was found: The official `cash` rule reads `cashOut`, while the authoritative engine/apply shapes use `cashSent`; preview does not pass cash fields at all.
Why it matters: The second-apron cash ban still works through `secondApronEnforcement`, but the seasonal cash-limit rule can miss illegal cash trades and the `cash` rule envelope can misstate the real blocker.
Evidence: `validateCash()` reads `team.cashOut`; `tradeValidator.js` stores `cashSent`; `useTradeMachine.js` omits cash fields; runtime: `tests/tradeValidatorEdgeCases.test.js:187-226` passed and proves live second-apron cash blocking via `cashSent`, while `tests/trade/cashLedger_season_tracking.test.js:5-24` only exercises helper-only `cashOut`.
Recommended fix direction: Normalize on one authoritative cash field set in preview/apply/engine and add live `validateTrade()` coverage for seasonal ledger limits.

### P2-F004
Severity: MEDIUM
Type: Explanation accuracy
Exact file/location: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1338-1525`; `src/features/architect/tradeMachine/TradeLegalChecker.jsx:21-40`
What was found: Primary explanations are collection-order driven, not root-cause prioritized. UI rule displays also show only the first violation or warning per rule.
Why it matters: Users and developers can be sent first to salary matching even when TPE, FA exception, timing, or routing is the more specific reason the trade is illegal.
Evidence: Rule insertion order is fixed in `allRules`; `reason` is the first flattened violation; `TradeLegalChecker` truncates each rule to its first issue.
Recommended fix direction: Add deterministic priority ranking for blockers and expose both “primary blocker” and “all blockers” distinctly.

### P2-F005
Severity: MEDIUM
Type: Rule interaction ambiguity
Exact file/location: `src/features/architect/utils/tradeMachine/rules/validateAggregation.js:60-83`; `src/features/architect/utils/tradeMachine/rules/basicRules.js:90-99`
What was found: Second-apron aggregation is implemented in two places with different substantive breadth: one only blocks “aggregate up” and multi-team incoming, the other blocks any multi-player outgoing aggregation and cash.
Why it matters: Even when legality lands on the right side for common cases, the active rule family is only partially proven and explanation order can vary depending on which duplicate branch fires first.
Evidence: Divergent code paths in the two files; runtime proof only covered one subset via `src/tests/trade/secondApron_SSOT_guardrail.test.js:60-89`.
Recommended fix direction: Collapse second-apron aggregation ownership into one authoritative rule with explicit test cases for equal/lower-paid returns and same-team vs multi-team incoming.

### P2-F006
Severity: MEDIUM
Type: Test drift / migration risk
Exact file/location: `tests/validators/hardCap.test.js:1-79`; `src/features/architect/utils/tradeMachine/rules/validateHardCap.ts:1-78`
What was found: The only targeted hard-cap test failure in this pass came from a non-authoritative TS twin, not the live JS rule used by `tradeValidator.js`.
Why it matters: This does not currently prove a live legality bug, but it is strong evidence that TS migration into validator rule modules would move drift into a riskier place unless rule ownership is re-locked first.
Evidence: `tradeValidator.js:14,471,1194` imports `hardCapValidation.js`; `tests/validators/hardCap.test.js` imports `rules/validateHardCap`; the batch run failed only on this file.
Recommended fix direction: Keep the TS twin out of the migration critical path until rule behavior is re-aligned or the twin is removed.

## 8. Explanation / Reason Accuracy Assessment
The validator is legally stronger than it is diagnostically accurate.

Top-level `reason` is not chosen by blocker specificity. `buildValidationResult()` uses the first flattened violation (`tradeValidator.js:303-308`), and the flattening order comes from `allRules` insertion order (`tradeValidator.js:1338-1416,1513-1525`). That means salary matching is usually favored over trade-exception, FA-exception, timing, or roster details when multiple blockers coexist.

Team-level rule summaries are consistent with their own envelopes, but they are still first-message summaries, not “true blocker” summaries. `TradeLegalChecker.jsx:21-40` shows only the first violation or warning per rule. `summaryByTeamIndex` copies violation arrays from `teamResults`, so it preserves completeness better than the top-level `reason`, but it still does not identify which blocker is the primary one.

`useTradeMachineSnapshot.js:143-158` exposes `result.reason` as `primaryViolation`, so any top-level prioritization weakness becomes an official UI/consumer weakness. `TradeReceiptPanel.jsx:122-141` is debug-only and not the authoritative surface, so receipt completeness does not rescue production explanation quality.

Verdict on explanation accuracy:

- Top-level `reason`: only partially accurate in multi-failure trades.
- Team rule envelopes: accurate within each rule, but not prioritized across rules.
- `summaryByTeamIndex`: complete enough for debugging, not prioritized.
- Receipt-level issues: useful for debugging, not authoritative.

## 9. Test Sufficiency Assessment
Directly convincing substantive tests from this pass:

- Salary valuation and sequencing: `tests/trade/salaryMatching.test.js`, `tests/trade/byc_outgoing_max.test.js`, `tests/trade/poisonPill_average.test.js`, `tests/trade/tradeKicker_proration.test.js`, `tests/trade/tradeKicker_zeroGuarantee.test.js`, `tests/trade/orderOfOps_conversionsBeforeMatching.test.js`
- Sign-and-trade legality and apply parity: `tests/trade/signAndTrade_completeness.test.js`, `tests/trade/jan15_offseason_timing.test.js`, `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
- Hard-cap/apron live behavior: `tests/trade/salaryMatching.test.js`, `tests/trade/secondApronBoundary.test.js`, `src/tests/trade/secondApron_SSOT_guardrail.test.js`, `src/tests/trade/goldenTrades.test.js`
- Roster/two-way live behavior: `tests/trade/rosterLegality_validateTrade.test.js`, `tests/trade/twoWayPlayers_snapshot.test.js`
- Routing/Stepien/exclusivity: `tests/validators/stepien.test.js`, `tests/validators/stepienEntitlements.test.js`, `tests/validators/stepienEntitlementBaseline.test.js`, `tests/trade/frozenPick_consequences.test.js`, `src/tests/trade/playerRouting.test.js`, `src/tests/architect/phase17_entitlement_routing_guardrail.test.js`, `src/tests/architect/entitlementExclusivityValidator.test.ts`, `src/tests/architect/worldTradeApplyExclusivityGate.test.ts`
- Explanation/consumer rendering: `src/tests/trade/validatorContractConsumers.test.jsx`
- Cash live-path second-apron behavior: `tests/tradeValidatorEdgeCases.test.js:187-226`

Weak or helper-only tests:

- `tests/validators/hardCap.test.js` targets the non-authoritative TS twin and failed.
- `tests/trade/cashLedger_season_tracking.test.js` only proves `validateCash()` with `cashOut`, not the live `validateTrade()` payload shape.
- `src/tests/trade/tpe_perPlayer.guardrail.test.js` proves helper behavior, not active preview/apply wrapper survival of TPE state.
- `tests/trade/hardCap_trigger_faException.test.js` proves helper mutation behavior, not a full live multi-team `validateTrade()` path.
- `tests/trade/matchingBands_2023.test.js` exercises `tradeHelpers.calculateAllowableIncoming()`, not the authoritative validator module.
- `tests/trade/tpe_creation_expiry_usage.test.js` and `tests/trade/secondApron_tpeBan.test.js` are direct-engine tests, but they depend on injected `appliedTPEs` that the active preview/apply wrappers do not provide.

Missing or shallow edge-case coverage:

- Historical/future trade-date TPE expiry against canonical validator date
- Second-apron prior-year TPE usage through team-held TPE data without `appliedTPEs`
- `validateTrade()` seasonal cash-limit enforcement using `cashSent` plus real `cashLedger`
- End-to-end FA-exception multi-player or multi-bucket absorption through the live validator path
- End-to-end generic timing cases for moratorium, Dec. 15, 30-day, 3-month, and 60-day aggregation
- Engine-generated multi-failure reason-priority assertions

Likely escaped bug classes despite the passing suites:

- Direct-engine tests passing with shapes that active preview/apply wrappers no longer preserve
- Rules that depend on the machine clock instead of the validator’s canonical date context
- Rules that are legally correct but surface a misleading primary explanation

### Validation Commands Actually Run
- `npm run test:node -- --reporter=dot tests/trade/salaryMatching.test.js tests/trade/matchingBands_2023.test.js tests/trade/byc_outgoing_max.test.js tests/trade/poisonPill_average.test.js tests/trade/tradeKicker_proration.test.js tests/trade/tradeKicker_zeroGuarantee.test.js tests/trade/orderOfOps_conversionsBeforeMatching.test.js tests/trade/signAndTrade_completeness.test.js tests/trade/jan15_offseason_timing.test.js tests/trade/secondApronBoundary.test.js tests/validators/hardCap.test.js src/tests/trade/goldenTrades.test.js`
  Result: one file failed, `tests/validators/hardCap.test.js`; all other files in the slice passed.
- `npm run test:node -- --reporter=dot tests/trade/tpe_absorption_fail_closed.test.js tests/trade/tpe_creation_expiry_usage.test.js tests/trade/secondApron_tpeBan.test.js tests/trade/hardCap_trigger_faException.test.js tests/trade/cashLedger_season_tracking.test.js tests/trade/rosterLegality_validateTrade.test.js tests/trade/roster_twoWay_enforcement.test.js tests/trade/twoWayPlayers_snapshot.test.js src/tests/trade/tpe_perPlayer.guardrail.test.js src/tests/trade/secondApron_SSOT_guardrail.test.js`
  Result: pass.
- `npm run test:node -- --reporter=dot tests/validators/stepien.test.js tests/validators/stepienEntitlements.test.js tests/validators/stepienEntitlementBaseline.test.js tests/trade/frozenPick_consequences.test.js src/tests/trade/playerRouting.test.js src/tests/architect/phase17_entitlement_routing_guardrail.test.js src/tests/architect/entitlementExclusivityValidator.test.ts src/tests/architect/worldTradeApplyExclusivityGate.test.ts tests/trade/validatorTrustFixes.test.js tests/trade/validatorContractCleanup.test.js tests/trade/useTradeMachine.validatorTrust.test.ts src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
  Result: pass.
- `npm run test:ui -- --reporter=dot src/tests/trade/validatorContractConsumers.test.jsx`
  Result: pass.
- `npm run test:node -- --reporter=dot tests/tradeValidatorEdgeCases.test.js`
  Result: pass.

### Commands Intentionally Skipped
- `npm run test:trade -- --reporter=dot`
  Reason: optional broader suite was not needed, and per audit rules a broad green suite cannot upgrade `Partial` or `Unproven` families to `Correct`.
- `npm run build`
  Reason: audit-only pass with no runtime code changes.
- `npm run typecheck`
  Reason: audit-only pass with no TS/TSX/runtime edits.
- `npm run validate:project`
  Reason: no structural changes were made.

## 10. Recommended Next Passes
1. Required rule fixes:
   Fix TPE expiry to use canonical validator date context.
   Make second-apron prior-year TPE and TPE+outgoing-salary restrictions depend on actual TPE usage in the live preview/apply path, not on wrapper-preserved `appliedTPEs`.
   Unify cash field names across preview/apply/engine and make the seasonal cash-limit rule authoritative on the same payload shape as second-apron cash handling.

2. Required missing tests:
   Add a live `validateTrade()` case for historical/future TPE expiry against `tradeCtx.tradeDate`.
   Add live preview/apply-shape tests for team-held TPEs without `appliedTPEs`.
   Add live `validateTrade()` seasonal cash-limit tests using `cashSent` plus `cashLedger`.
   Add direct engine tests for explanation priority in multi-failure trades.
   Add live timing tests for moratorium, Dec. 15, 30-day, 3-month, and 60-day aggregation.

3. TS migration guidance:
   Pause validator rule-module migration.
   Continue only already-clean shared contract/helper surfaces if there is an independent product need.
   Do not migrate TPE, cash, aggregation, or explanation-priority rule modules until the substantive fixes above are in.

## 11. STOP Conditions
STOP conditions were found.

- STOP: validator can still reject clearly legal trades due to substantive rule mistakes.
  Evidence: `validateTradeExceptions.js:113-116` uses the machine clock instead of canonical trade context.

- STOP: validator can still approve clearly illegal trades due to substantive rule mistakes.
  Evidence: second-apron prior-year TPE and TPE+outgoing-salary restrictions depend on `usingAppliedTPEs` (`validateTradeExceptions.js:79-98`), but active preview/apply entries omit `appliedTPEs` (`useTradeMachine.js:961-985`; `tradeContext.js:571-583`).

- STOP: validator can still approve clearly illegal trades due to substantive rule mistakes.
  Evidence: the seasonal cash-limit rule reads `cashOut` (`eligibilityRules.js:109-117`) while the authoritative engine/apply shapes use `cashSent` (`tradeValidator.js:965-966`; `tradeContext.js:581-582`).

Verdict: STOP triggered. Rule fixes must happen before the validator can be called substantively trustworthy.
