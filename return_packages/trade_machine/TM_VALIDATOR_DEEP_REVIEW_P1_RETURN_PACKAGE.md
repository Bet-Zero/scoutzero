# TM_VALIDATOR_DEEP_REVIEW_P1 — PREFLIGHT RETURN PACKAGE

Date: 2026-03-07  
Mode: PREFLIGHT (audit only; no implementation changes)

## 1. Executive Verdict

The validator is not currently trustworthy enough to lock in before TypeScript conversion.

Core salary-matching math, BYC/trade-kicker calculations, roster counts, and much of the entitlement/Stepien path are wired through one main engine. That is the good part. The blocking problems are in the live path around context, rule ownership, and consumers: world time/offseason state is not threaded into live validation, two-way trade blocking lives in a disconnected module, FA-exception legality is implemented and tested but not enforced by the authoritative validator, and the UI can present a trade as legal/apply-able while authoritative apply still rejects it.

Cleanup should happen before any TypeScript migration.

## 2. Scope Reviewed

### Authoritative validator path

Authority was assigned only when a live import chain from an active consumer reached the file. TS twins, barrels, deprecated exports, and similarly named modules were treated as non-authoritative unless a live consumer path proved otherwise.

- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- `src/features/architect/utils/tradeMachine/engine/validationUtils.js`
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
- `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js`
- `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js`
- `src/features/architect/utils/tradeMachine/utils/buildEntitlementRoutingMap.ts`
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.js`
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
- `src/features/architect/utils/tradeMachine/rules/validateConsent.js`
- `src/features/architect/utils/tradeMachine/rules/enforceConsent.js`
- `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js`
- `src/features/architect/utils/tradeMachine/rules/timingValidation.js`
- `src/features/architect/utils/tradeMachine/rules/basicRules.js`
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js`
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js`

### Non-authoritative / drift-risk validator-adjacent files

- `src/features/architect/utils/tradeMachine/index.js`
- `src/features/architect/utils/tradeMachine/rules/validateEligibility.js`
- `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js`
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
- `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`
- `src/features/architect/utils/tradeMachine/rules/rosterValidation.js`
- `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
- `src/features/architect/utils/tradeMachine/cache/validationCache.js`
- `src/features/architect/utils/tradeMachine/cache/validationCacheManager.js`
- `src/features/architect/utils/tradeManager.js`
- `src/features/architect/utils/architectCore.js`

### Apply / execution / wrapper path

- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/tradeContext/types.js`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

### UI consumers

- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/hooks/useTradeMachineSnapshot.js`
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
- `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
- `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
- `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx`
- `src/features/architect/tradeMachine/FaExceptionTracker.jsx`
- `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`

### Tests reviewed

- `tests/trade/salaryMatching.test.js`
- `tests/trade/byc_outgoing_max.test.js`
- `tests/trade/poisonPill_average.test.js`
- `tests/trade/tradeKicker_proration.test.js`
- `tests/trade/tradeKicker_zeroGuarantee.test.js`
- `tests/trade/signAndTrade_completeness.test.js`
- `tests/signAndTradeAggregation.test.js`
- `tests/trade/secondApronBoundary.test.js`
- `tests/trade/secondApron_tpeBan.test.js`
- `tests/trade/tpe_absorption_fail_closed.test.js`
- `tests/trade/tpe_creation_expiry_usage.test.js`
- `tests/trade/rosterLegality_validateTrade.test.js`
- `tests/validators/stepien.test.js`
- `tests/trade/cashLedger_season_tracking.test.js`
- `tests/trade/jan15_offseason_timing.test.js`
- `tests/trade/timingGates_softEnforcement.test.js`
- `tests/trade/faExceptions_as_trade_buckets.test.js`
- `tests/trade/validation_caching.test.js`
- `tests/tradeValidatorEdgeCases.test.js`
- `src/tests/architect/batchB_cbaRules.test.js`
- `src/tests/architect/tradeEntitlementRouting.test.ts`
- `src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts`
- `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts`
- `src/tests/architect/phase55_trade_validation_separation_guardrails.test.js`
- `src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js`
- `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js`
- `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts`
- `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts`
- `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts`
- `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx`
- `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`
- `src/tests/architect/signAndTrade.test.js`
- `src/tests/architect/worldTime.test.js`

### Docs reviewed

- `docs/architect/TRADE_MACHINE_MASTER.md`
- `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md`

## Known Unknowns / Unproven Areas

- `tradeManager.js` may still matter to old scripts/tests, but no live app import chain to it was found beyond `architectCore.js`, and no live app import to `architectCore.js` was found. Evidence needed: a real app consumer import chain to `architectCore.js` or `tradeManager.js`.
- Exhibit 10 / Exhibit 9 / other non-standard contract trade rules were not proven in the authoritative path. Evidence needed: a live rule module call from `validateTrade()` plus direct tests that hit that path through `validateTrade()`.
- DPE parity is not in the authoritative trade validator path. Evidence needed: validator callsites or apply-time enforcement code that reads DPE usage during trade validation.
- Whether the app exposes cash entry in the Trade Machine UI could not be proven from the reviewed consumer files; no active cash control was found in `tradeMachine/`. Evidence needed: a live UI control or action that writes `cashSent` into trade state.
- Whether any live user-facing screen still relies on `tradeReceipt` beyond the snapshot accessor fallbacks was not fully proven. Evidence needed: direct UI imports/reads of `result.tradeReceipt` outside `useTradeMachineSnapshot.js`.

## 3. Validator System Map

### Architecture summary

- The main authoritative preview entry is `validateTrade()` in `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:576-1149`.
- The main authoritative apply entry is `validatePostTradeSnapshotForContext()` in `src/features/architect/utils/tradeContext/tradeContext.js:614-663`, which calls `validateTrade()` exactly once on a post-trade snapshot.
- The authoritative apply pipeline is `computeWorldMutation()` -> `validatePostTradeSnapshotForContext()` -> `computeTradeResult()` -> `validateMutation()` in `src/features/architect/utils/mutationPipeline.js:1745-1782` and `src/features/architect/utils/mutationPipeline.js:3213-3233`.
- A separate legacy-style executor exists in `src/features/architect/utils/tradeManager.js:40-204`, but no live app import chain to it was found. Treat it as non-authoritative drift risk.

### Mini call graph

| Consumer | Entry function called | Downstream validator / rule path | Output consumed | Enforcement / display role |
| --- | --- | --- | --- | --- |
| `src/features/architect/hooks/useTradeMachine.js:960-983` | `validateTrade()` | `tradeValidator.js` -> `validateSalaryMatching` / `validateHardCap` / `validateStepien` / `validateTradeExceptions` / `validateSignAndTrade` / `validateConsent` / `validateReacquisition` / `validateAggregation` / array enforcers | whole `result`, then overridden `result.legal` at `useTradeMachine.js:995-1002` | Preview legality source for Trade Machine UI |
| `src/features/architect/tradeMachine/TradeEditor.jsx:539-582` | none directly; trusts hook result | `useTradeMachine` result | `result.legal`, `result.reason`, `hasCurrentValidation` | Apply button enable/block state |
| `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx:167-203` | none directly; trusts hook result | summary panel + legal checker + exception panels | `result`, `result.teamResults`, `result.capSettings` | Official validator display surface |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx:150-178,250-266` | `getTeamSnapshot()` | `useTradeMachineSnapshot.js` -> `getOfficialSalaryMatchingSnapshot.js` -> `teamResult.rules.salaryMatching` | salary in/out, allowable incoming, rule label | Official per-team salary legality display |
| `src/features/architect/utils/tradeContext/tradeContext.js:633` | `validateTrade()` | same engine as preview, but on post-trade snapshot built at `tradeContext.js:563-583` | `ValidatedTradeContext` wrapper | Apply-time authoritative gate input |
| `src/features/architect/utils/mutationPipeline.js:1745-1782` | `validatePostTradeSnapshotForContext()` | `tradeContext.js` wrapper -> `validateTrade()` | `_validatedTradeContext` attached to compute result | Authoritative apply precondition |
| `src/features/architect/utils/mutationPipeline.js:3213-3233` | none directly; trusts `_validatedTradeContext` | prevalidated context only | `valid`, `error`, `violations`, `warnings` | Final trade mutation validation gate |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1343-1423` | `runAuthoritativeFAMutation('executeTrade')` or `computeWorldMutation()` | authoritative mutation pipeline | `_validatedTradeContext`, `validatedContext.legal` | World/base-state execution gate before cap-sheet update |
| `src/features/architect/utils/tradeManager.js:72` | `validateTrade()` | direct engine call | `validation.legal` | Non-authoritative alternate executor; drift risk only |

### Exact result shapes

#### `validateTrade()` success shape

Source: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1132-1143`

```js
{
  legal,
  teamResults,
  summaryByTeamIndex,
  reason,
  performance: { validationTime },
  tradeReceipt,
  dataWarnings,
  hasDataIssues
}
```

#### `validateTrade()` early-return illegal shapes

Sources:

- invalid input: `tradeValidator.js:584-608`
- entitlement routing: `tradeValidator.js:732-747`
- entitlement linkage: `tradeValidator.js:751-766`
- player routing: `tradeValidator.js:771-786`

These include top-level `error`, `violations`, and sometimes `warnings`, but still return `teamResults: []`.

#### Per-team result shape

Source: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1052-1091`

```js
{
  teamId,
  teamName,
  legal,
  violations,
  warnings,
  rules,
  salaryOut,
  salaryIn,
  calculations,
  totalSalary,
  projectedSalary,
  capRoom,
  hardCapped,
  createdTPE,
  details,
  warningDetails
}
```

#### `rules` shape is mixed, not standardized

Object-returning rule entries:

- `salaryMatching`
- `hardCap`
- `stepienRule`
- `cash`
- `tradeExceptions`
- `signAndTrade`
- `consent`
- `reacquisition`
- `aggregation`
- `entitlementExclusivity`
- `rosterCount`

Array-returning rule entries:

- `consentEnforcement`
- `eligibilityEnforcement`
- `timingEnforcement`
- `secondApronEnforcement`

Evidence: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:998-1015` and aggregation logic at `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1022-1034`.

#### Apply-time wrapper shape

Source: `src/features/architect/utils/tradeContext/tradeContext.js:635-649`

```js
{
  legal,
  valid,
  reason,
  error,
  violations: validation.teamResults?.flatMap(...),
  warnings: validation.warnings || [],
  teamResults,
  validationTeams,
  _rawValidation,
  _isValidatedTradeContext: true
}
```

This wrapper is not shape-preserving:

- it drops top-level `validation.violations` from early-return validator failures
- it drops team warnings on successful validation because success results do not include top-level `validation.warnings`

### Rule/helper dependency map

- Matching values and legality math:
  - `matchingValues.js:115-259`
  - `validateSalaryMatching.js:47-502`
  - `hardCapStatus.js`
  - `capSettingsProvider.js`
- Pick / entitlement legality:
  - `validateStepien.js`
  - `validateEntitlementRouting.js`
  - `buildEntitlementRoutingMap.ts`
  - exclusivity block in `tradeValidator.js:891-996`
- Exception / absorption legality:
  - `validateTradeExceptions.js`
  - `validateFaExceptionUsage.js` (not wired)
  - `basicRules.js`
- Timing / consent / eligibility:
  - `validateConsent.js`
  - `enforceConsent.js`
  - `validateEligibility.js` (not wired)
  - `enforceEligibility.js` (wired)
  - `timingValidation.js`

## 4. Rule Coverage Matrix

| Rule Family | Status | Enforcement Location | Consumer Location | Evidence | Notes / Risk |
| --- | --- | --- | --- | --- | --- |
| Salary-matching legality | Partial | `validateSalaryMatching.js:47-502`; called at `tradeValidator.js:863-866,1000` | `TradeTeamCard.jsx:150-178,250-266`; `TradeSummaryPanel.jsx:152-218`; `useTradeMachineSnapshot.js:41-112` | `matchingValues.js:115-259`; `tests/trade/salaryMatching.test.js`; `tests/trade/byc_outgoing_max.test.js`; `tests/trade/poisonPill_average.test.js`; `tests/trade/tradeKicker_proration.test.js`; `tests/trade/tradeKicker_zeroGuarantee.test.js` | Core math is centralized and well-tested, but FA-exception/TPE live paths make end-to-end legality partial. |
| Hard-cap / apron legality | Partial | `hardCapValidation.js:18-179`; array handcuffs in `basicRules.js:42-127`; called at `tradeValidator.js:867,883-886,1001,1012` | `TradeLegalChecker.jsx:46-62` | `hardCapStatus.js:249-260+`; `tests/trade/salaryMatching.test.js:137-214`; `tests/trade/secondApronBoundary.test.js`; `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts:128-147` | Core hard-cap ceiling logic is strong. FA-exception hard-cap trigger is not in the authoritative path, and array-based second-apron output is hidden from the official rule UI. |
| Roster count rules | Correct | inline `computeRosterValidation()` at `tradeValidator.js:166-263`; called at `tradeValidator.js:888-889,1014` | `TradeLegalChecker.jsx:58-62`; apply via `tradeContext.js:633-649` | `tests/trade/rosterLegality_validateTrade.test.js`; `tests/trade/twoWayPlayers_snapshot.test.js` | This is one of the cleaner parts of the validator. |
| Aggregation restrictions | Partial | `validateAggregation.js:16-99`; `timingValidation.js:96-105`; `basicRules.js:90-99` | `TradeLegalChecker.jsx:70-84` | `tests/trade/secondApronBoundary.test.js`; `tests/signAndTradeAggregation.test.js`; `tests/trade/timingGates_softEnforcement.test.js` | Second-apron salary aggregation is wired. Timing-based 60-day aggregation is array-based, blocked even in warn mode, and omitted from official rule UI. |
| Recently signed / trade restriction logic | Incorrect | `timingValidation.js:18-146`; called via `tradeValidator.js:882,1011-1026` | `TradeLegalChecker.jsx:82-84` attempts to render but drops arrays | `validationFlags.js:20-31`; live consumers omit `asOfDate`; `tradeContext.js:625-630`; `useTradeMachine.js:978-982`; `useArchitectActions.ts:1346-1350,1376-1380` | Machine date is used when `asOfDate` is absent, and `warn` still blocks because arrays are treated as hard violations. |
| Sign-and-trade legality | Incorrect | `validateSignAndTrade.js:41-238`; called at `tradeValidator.js:874,1005`; optional apply preflight in `tradeContext.js:145-213` | `TradeLegalChecker.jsx:53-57`; apply path via mutation pipeline | `tradeValidator.js:637-649`; `useTradeMachine.js:978-982`; `useArchitectActions.ts:1346-1350,1376-1380`; `rg enforceSignAndTradePreflight` found no callers | Contract payload checks are present, but live preview/apply never pass `offseason`; validator defaults to `offseason: true`. The extra apply preflight exists but is dead because no caller sets `tradeCtx.enforceSignAndTradePreflight`. |
| Base-year compensation | Correct | `matchingValues.js:151-158` | salary snapshot consumers listed above | `tests/trade/byc_outgoing_max.test.js`; `src/tests/trade/goldenTrades.test.js:102-132` | Centralized and directly consumed by salary matching. |
| Trade kicker handling | Correct | `matchingValues.js:202-259` | salary snapshot / receipt | `tests/trade/tradeKicker_proration.test.js`; `tests/trade/tradeKicker_zeroGuarantee.test.js` | Centralized and directly covered. |
| Two-way / exhibit / non-standard contract edge cases | Incorrect / Unproven | two-way block only in `validateEligibility.js:43-52`; engine actually uses `enforceEligibility.js:13-54` | none proven in official UI | `tradeValidator.js:19,880-881`; `src/tests/architect/batchB_cbaRules.test.js:117-283` | Two-way block is tested in a disconnected module and not enforced by `validateTrade()`. Exhibit / other non-standard trade rules were not proven in the authoritative path. |
| Pick / entitlement / Stepien legality | Partial | `validateEntitlementRouting.js:93-257`; `buildEntitlementRoutingMap.ts:78-176`; `validateStepien.js:125-354`; exclusivity at `tradeValidator.js:891-996` | `TradeLegalChecker.jsx:86-134`; apply routing gate in `tradeContext.js:215+` | `src/tests/architect/tradeEntitlementRouting.test.ts`; `src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts`; `tests/validators/stepien.test.js` | This is the strongest non-salary area. One protected-picks edge test is synthetic (`tests/tradeValidatorEdgeCases.test.js:98-128`), so not every edge case is proven. |
| Exception / TPE interactions | Incorrect | `validateTradeExceptions.js:15-167`; `basicRules.js:77-99`; `validateFaExceptionUsage.js:4-108` is not wired | `TradeExceptionDashboard.jsx:10-25,95-110`; `FaExceptionTracker.jsx:8-31,85-103` | live UI sets `tpeId` / `FA_EXCEPTION` at `TradeTeamCard.jsx:836-910` and `useTradeMachine.js:553-640`; `tradeValidator.js:267-285` does not call `validateFaExceptionUsage` | TPE and FA-exception paths do not share one authoritative contract. Live UI uses `tpeId` and `bucketType`; some legality checks only run on `appliedTPEs`, and FA-exception legality is not enforced at all. |
| Outgoing / incoming salary calculation dependencies | Correct | `tradeValidator.js:716-831` after `computeMatchingValues()` | `useTradeMachineSnapshot.js`; `TradeTeamCard.jsx`; `TradeSummaryPanel.jsx` | `matchingValues.js:115-259`; `useTradeMachineSnapshot.js:41-112`; `getOfficialSalaryMatchingSnapshot.js` | This is a real SSOT path, although it mutates player objects during validation. |
| Team-level vs trade-level legality interactions | Partial | `tradeValidator.js:1017-1143`; wrapper `tradeContext.js:635-649` | `TradeEditor.jsx:541-551`; `TradeSummaryPanel.jsx`; `ValidationDetailsPanel.jsx` | rule-order aggregation at `tradeValidator.js:1022-1038` and `reason` at `tradeValidator.js:1113-1118` | Trade-level `reason` is just the first collected violation string. No standardized priority or severity ordering exists. |
| World / sandbox / plan-state effects | Incorrect | `useTradeMachine.js:995-1002`; `mutationPipeline.js:377-405,3213-3233`; `tradeValidator.js:634-649` | `TradeEditor.jsx:539-582`; `TradeSummaryPanel.jsx:45-61` | preview force override + authoritative apply gate mismatch; missing world date threading | Preview/apply are materially disconnected under `forceTrade`; world time is resolved in the pipeline but not passed into trade validation. |

## 5. Connected Flow Findings

| Flow | Entry path | Validation path | Enforcement point | UI display point | Consistent? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| User builds trade -> validator runs -> legality shown | `useTradeMachine.js:960-983` | direct `validateTrade()` | `TradeEditor.jsx:541-551,582` trusts `result.legal` | `TradeSummaryPanel.jsx`, `TradeLegalChecker.jsx`, `TradeTeamCard.jsx`, exception panels | No | `useTradeMachine.js:995-1002` can overwrite `legal`; `TradeLegalChecker.jsx:13-20` drops array rules; `TradeSummaryPanel.jsx:72-82` waits for missing `failures`; exception panels expect absent fields |
| User applies trade -> legality gate fires -> mutation pipeline validates | `useArchitectActions.ts:1343-1423` and `useArchitectActions.ts:1383-1423` | `computeWorldMutation()` -> `validatePostTradeSnapshotForContext()` -> `validateTrade()` | `validateMutation()` at `mutationPipeline.js:3213-3233`; `useArchitectActions.ts:1417-1423` | none; failure comes back as mutation error | Partially | Same validator is reused, but wrapper drops top-level violations/warnings and preview can still disagree under `forceTrade` |
| Sign-and-trade preview/apply | UI marks `signAndTrade` at `useTradeMachine.js:513-545`; apply payload normalized at `useArchitectActions.ts:1267-1323` | `validateSignAndTrade()` via `validateTrade()` | authoritative gate in pipeline; optional preflight block in `tradeContext.js:145-213` is dead | `TradeLegalChecker.jsx:53-57` | No | live preview/apply never pass `offseason`; `tradeValidator.js:637`; dead `enforceSignAndTradePreflight` flag has no caller |
| Pick / entitlement trade flow | `entitlementsOut` from UI state and export path | `validateEntitlementRouting()` / `validateEntitlementLinkageLegality()` / exclusivity block / `validateStepien()` | early-return legality at `tradeValidator.js:732-786`; apply routing guard in `tradeContext.js:215+` | `TradeLegalChecker.jsx:86-134` | Mostly | Best-connected flow found; preview and apply both enforce explicit routing and exclusivity |
| Allowable incoming / cap figures shown | `validateTrade()` computes rule results -> snapshot accessor reads `teamResults` | `getOfficialSalaryMatchingSnapshot()` via `useTradeMachineSnapshot.js` | preview-only; authoritative apply uses same salary rule | `TradeTeamCard.jsx:150-178,250-266`; `TradeSummaryPanel.jsx:152-218` | Mostly | This is the cleanest display pipeline for core salary-matching numbers |
| Alternate legality path outside main UI/apply flow | `tradeManager.js:40-204` | direct `validateTrade()` on separately built input | throws on `!validation.legal` | none | Non-authoritative | No live app import chain found beyond `architectCore.js:33-38`; keep as drift risk, not production authority |

## 6. Findings List

### TMV-001

- Severity: BLOCKER
- Type: World-time / sign-and-trade context disconnect
- Exact file/location:
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:634-649`
  - `src/features/architect/hooks/useTradeMachine.js:978-982`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1346-1350`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1376-1380`
  - `src/features/architect/utils/tradeContext/tradeContext.js:625-633`
  - `src/features/architect/utils/mutationPipeline.js:1186-1200`
  - `src/features/architect/utils/mutationPipeline.js:1745-1782`
  - `src/features/architect/utils/tradeMachine/rules/timingValidation.js:20-21`
- What was found: Live preview/apply flows do not pass `tradeCtx.offseason` or `tradeCtx.asOfDate` into `validateTrade()`. The validator defaults `offseason: true`, and timing rules fall back to `new Date()` when `asOfDate` is absent.
- Why it matters: The validator can approve out-of-season sign-and-trades and can approve or reject timing-based trades based on the machine clock instead of the world date.
- Evidence:
  - Preview path only passes `{ worldId, yearKey, source: 'tradeMachine' }`.
  - Apply path only passes `{ source: 'tradeMachine', worldId, yearKey }`.
  - The pipeline resolves `asOfDate`, but `computeWorldMutation()` does not thread it into trade validation.
- Recommended fix direction: Make one authoritative trade-validation context contract that always includes canonical `asOfDate` and season-state / `offseason`, and thread it through both preview and apply before any TS conversion.

### TMV-002

- Severity: BLOCKER
- Type: Disconnected rule ownership
- Exact file/location:
  - `src/features/architect/utils/tradeMachine/rules/validateEligibility.js:43-52`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:19`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:880-881`
  - `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js:13-54`
  - `src/tests/architect/batchB_cbaRules.test.js:117-283`
- What was found: The only code that blocks two-way players from being traded lives in `validateEligibility.js`, but the authoritative engine does not import that module. It imports `enforceEligibility.js`, which only checks re-acquisition rules.
- Why it matters: `validateTrade()` can approve clearly illegal two-way player trades.
- Evidence:
  - The active engine imports `enforceEligibility` from `../rules/enforceEligibility.js`.
  - The tested two-way logic is in a different file and is only directly unit-tested there.
- Recommended fix direction: Collapse eligibility ownership to one authoritative module and add a `validateTrade()`-level regression test that trades an outgoing two-way player.

### TMV-003

- Severity: BLOCKER
- Type: Missing enforced rule family
- Exact file/location:
  - `src/features/architect/tradeMachine/TradeTeamCard.jsx:836-910`
  - `src/features/architect/hooks/useTradeMachine.js:553-606`
  - `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js:143-173`
  - `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js:4-108`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:25`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:267-285`
  - `tests/trade/faExceptions_as_trade_buckets.test.js:26-169`
- What was found: The UI exposes FA-exception absorption and bucket selection, and a dedicated legality module exists and is directly tested, but `validateTrade()` never calls that module. The active salary-matching rule only checks bucket size and then short-circuits normal matching.
- Why it matters: The validator can miss illegal FA-exception trades, including above-apron usage, outgoing-salary aggregation, and FA-exception hard-cap triggering.
- Evidence:
  - `TradeTeamCard` exposes `FA_EXCEPTION`.
  - `useTradeMachine` writes `absorptionMode` and `bucketType`.
  - `validateFaExceptionUsage()` is imported and exported but omitted from `baseValidators`.
- Recommended fix direction: Either wire `validateFaExceptionUsage()` into the authoritative validator or fold its logic into the active salary/exception rule set and add end-to-end `validateTrade()` coverage for the UI FA-exception path.

### TMV-004

- Severity: BLOCKER
- Type: Preview / execution mismatch
- Exact file/location:
  - `src/features/architect/hooks/useTradeMachine.js:991-1002`
  - `src/features/architect/tradeMachine/TradeEditor.jsx:539-582`
  - `src/features/architect/utils/mutationPipeline.js:377-405`
  - `src/features/architect/utils/mutationPipeline.js:3213-3233`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1417-1423`
- What was found: Preview can overwrite `result.legal` with `forceTrade`, and the Apply button uses that preview value. Authoritative apply still relies on the real validated context and ignores preview-only legality.
- Why it matters: The UI can show/apply-enable a trade as legal while execution still fails.
- Evidence:
  - `useTradeMachine` sets `legal: (canOverride && forceTrade) || validation.legal`.
  - `TradeEditor` blocks or enables Apply purely from `result.legal`.
  - The mutation pipeline strips override metadata unless override is enabled and still validates against `_validatedTradeContext`.
- Recommended fix direction: Separate preview override state from authoritative legality state. The UI needs two explicit flags: `authoritativeLegal` and `overrideRequested`.

### TMV-005

- Severity: HIGH
- Type: Exception / TPE path split
- Exact file/location:
  - `src/features/architect/hooks/useTradeMachine.js:610-639`
  - `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js:40-99`
  - `src/features/architect/utils/tradeMachine/rules/basicRules.js:77-99`
  - `tests/trade/secondApron_tpeBan.test.js:25-75`
- What was found: The live UI path uses per-player `tpeId`, but some legality checks in `validateTradeExceptions()` only activate for `appliedTPEs`. Separately, `basicRules.validateSecondApronRules()` scans all team TPEs and can block based on prior-year TPE presence without confirming actual usage.
- Why it matters: TPE legality depends on which payload shape is used, so preview/apply correctness is partial and can drift between under-blocking and over-blocking.
- Evidence:
  - The live UI writes `tpeId`, not `appliedTPEs`.
  - `validateTradeExceptions()` only runs second-apron prior-year/TPE+outgoing checks when `usingAppliedTPEs`.
  - `basicRules.validateSecondApronRules()` checks all team TPEs, not only used TPEs.
- Recommended fix direction: Standardize one TPE usage contract for preview and apply, and make every TPE restriction depend on that same canonical representation.

### TMV-006

- Severity: HIGH
- Type: Consumer mismatch / omitted blockers
- Exact file/location:
  - `src/features/architect/tradeMachine/TradeLegalChecker.jsx:10-20`
  - `src/features/architect/tradeMachine/TradeLegalChecker.jsx:58-84`
  - `src/features/architect/tradeMachine/TradeSummaryPanel.jsx:72-82`
  - `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx:12-24,95-110`
  - `src/features/architect/tradeMachine/FaExceptionTracker.jsx:9-31,85-103`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:998-1015`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1052-1091`
- What was found: The official validation UI does not consume the validator result consistently.
- Why it matters: Users can miss real blockers or see “official” panels that are partly disconnected from authoritative output.
- Evidence:
  - `TradeLegalChecker` silently returns `null` for array-based rule outputs, so `timingEnforcement`, `secondApronEnforcement`, `consentEnforcement`, and `eligibilityEnforcement` never render.
  - `TradeSummaryPanel` waits for `result.failures`, but the authoritative validator does not return `failures`.
  - `TradeExceptionDashboard` and `FaExceptionTracker` read `team.incomingPlayers`, `team.outgoingPlayers`, `team.apronStatus`, and `result.capSettings`, none of which exist on the authoritative success result.
- Recommended fix direction: Freeze a single display contract for validator output and update every “official” panel to consume only fields that are actually returned.

### TMV-007

- Severity: HIGH
- Type: Cash rule field mismatch
- Exact file/location:
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:703-704`
  - `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js:91-124`
  - `src/features/architect/utils/schemaAdapter.js:58`
  - `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js:66`
  - `tests/trade/cashLedger_season_tracking.test.js:8-23`
- What was found: The authoritative validator feeds `cashSent`, but `validateCash()` checks `cashOut`.
- Why it matters: The seasonal cash-limit rule is not wired to the live payload shape. Second-apron cash is still blocked elsewhere by `basicRules`, but seasonal cash ledger enforcement on the authoritative path is likely skipped.
- Evidence:
  - `tradeValidator.js` builds teams with `cashSent`.
  - `validateCash()` only reads `team.cashOut`.
  - The direct test for seasonal cash limit explicitly documents that `validateCash()` expects `cashOut`.
- Recommended fix direction: Standardize cash naming to one canonical field and add a `validateTrade()` test that exceeds the seasonal cash ledger limit using the live payload shape.

### TMV-008

- Severity: MEDIUM
- Type: Result-shape mismatch at apply wrapper boundary
- Exact file/location:
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:732-786`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1132-1143`
  - `src/features/architect/utils/tradeContext/tradeContext.js:635-649`
  - `src/features/architect/utils/tradeContext/types.js:61-70`
- What was found: `validatePostTradeSnapshotForContext()` is not a faithful wrapper over `validateTrade()`.
- Why it matters: Apply-time callers lose top-level routing/linkage violations and successful team warnings.
- Evidence:
  - Early-return routing failures put violations/warnings at the top level with `teamResults: []`.
  - The wrapper rebuilds `violations` only from `teamResults` and reads `warnings` only from `validation.warnings`.
  - Successful `validateTrade()` results have no top-level `warnings`.
- Recommended fix direction: Make `ValidatedTradeContext` preserve the raw top-level fields or standardize `validateTrade()` to one single top-level contract first.

### TMV-009

- Severity: MEDIUM
- Type: Severity / ownership model mismatch
- Exact file/location:
  - `src/config/validationFlags.js:20-31`
  - `src/features/architect/utils/tradeMachine/rules/timingValidation.js:122-145`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:1022-1034`
  - `tests/trade/timingGates_softEnforcement.test.js:15-78`
- What was found: The validator has no consistent blocker-vs-warning contract. Array-returning enforcement helpers are always treated as blockers by `validateTrade()`, even when the rule’s validation flag is set to `warn`.
- Why it matters: Configured warning-only rules can still reject trades, and TS migration would harden a misleading contract if done now.
- Evidence:
  - `validationFlags.timingEnforcement` defaults to `warn`.
  - `enforceTiming()` still returns a populated array in warn mode.
  - `validateTrade()` treats any returned array as hard violations.
- Recommended fix direction: Standardize per-rule output to a typed envelope with `severity`, `blocking`, `violations`, and `warnings`; remove bare arrays from the authoritative contract.

### TMV-010

- Severity: LOW
- Type: Drift risk / duplicate implementations
- Exact file/location:
  - `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
  - `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`
  - `src/features/architect/utils/tradeMachine/rules/rosterValidation.js`
  - `src/features/architect/utils/tradeMachine/cache/validationCacheService.js:12-39`
  - `src/features/architect/utils/tradeMachine/cache/validationCache.js`
  - `src/features/architect/utils/tradeManager.js:40-204`
- What was found: The validator area still contains overlapping roster validators, duplicate cache implementations, and a non-authoritative alternate executor.
- Why it matters: This is the exact kind of conceptual duplication that will make TS conversion misleading if done before cleanup.
- Evidence:
  - The authoritative roster rule is inline in `tradeValidator.js`, but two JS modules and one TS module still exist.
  - The active wrapper cache uses `validationCacheService.js`; a second richer cache object also exists.
  - `tradeManager.js` still directly executes validation and roster mutations outside the authoritative pipeline.
- Recommended fix direction: Collapse to one authoritative validator graph and clearly mark legacy/non-authoritative files before TS migration.

## 7. False Positive / False Negative Risks

### Validator may allow illegal trades

- Two-way player trades can pass because the authoritative engine does not call the module that contains the two-way block. Evidence: `tradeValidator.js:19,880-881` vs `validateEligibility.js:43-52`.
- Out-of-season sign-and-trades can pass because live consumers do not provide `tradeCtx.offseason`, and `validateTrade()` defaults it to `true`. Evidence: `tradeValidator.js:637`; `useTradeMachine.js:978-982`; `useArchitectActions.ts:1346-1350`.
- FA-exception trades can pass without above-apron / aggregation / hard-cap enforcement because `validateFaExceptionUsage()` is not in `baseValidators`. Evidence: `tradeValidator.js:267-285`; `validateFaExceptionUsage.js:4-108`.
- Seasonal cash-limit violations can pass because the authoritative payload uses `cashSent`, but `validateCash()` reads `cashOut`. Evidence: `tradeValidator.js:703-704`; `eligibilityRules.js:103-116`.

### Validator may reject legal trades

- Timing rules use the machine clock when `asOfDate` is absent, so a trade can be rejected or allowed based on the real date instead of the world date. Evidence: `timingValidation.js:20-21`; `mutationPipeline.js:1186-1200`; `computeWorldMutation()` does not thread `asOfDate`.
- Timing rules configured as `warn` still become blocking violations because arrays are aggregated as hard errors. Evidence: `validationFlags.js:21`; `timingValidation.js:122-145`; `tradeValidator.js:1022-1029`.
- Second-apron TPE blocking is inconsistent: some checks only run for `appliedTPEs`, while `basicRules` can block any existing prior-year TPE independent of actual use. Evidence: `validateTradeExceptions.js:79-98`; `basicRules.js:77-85`.

### Displayed legality / allowable incoming can mislead users

- `forceTrade` can make preview appear legal and apply-enabled while authoritative apply still rejects the mutation. Evidence: `useTradeMachine.js:995-1002`; `TradeEditor.jsx:545-551`; `mutationPipeline.js:3213-3233`.
- Official rule UI omits array-based enforcement blockers entirely. Evidence: `TradeLegalChecker.jsx:13-20`.
- Official summary failure list never appears because it expects `result.failures`, which the authoritative validator does not return. Evidence: `TradeSummaryPanel.jsx:72-82`; `tradeValidator.js:1132-1143`.
- Official exception panels use absent fields (`team.incomingPlayers`, `result.capSettings`), so they can silently under-report actual validator state. Evidence: `TradeExceptionDashboard.jsx:19-20`; `FaExceptionTracker.jsx:20,90,96`; `ValidationDetailsPanel.jsx:185-188`.

## 8. Test Coverage Assessment

### Well-covered areas

- Salary-matching core and matching-value math:
  - `tests/trade/salaryMatching.test.js`
  - `tests/trade/byc_outgoing_max.test.js`
  - `tests/trade/poisonPill_average.test.js`
  - `tests/trade/tradeKicker_proration.test.js`
  - `tests/trade/tradeKicker_zeroGuarantee.test.js`
  - `src/tests/trade/goldenTrades.test.js`
- Sign-and-trade contract completeness and incoming aggregation:
  - `tests/trade/signAndTrade_completeness.test.js`
  - `tests/signAndTradeAggregation.test.js`
  - `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`
- Roster count / snapshot behavior:
  - `tests/trade/rosterLegality_validateTrade.test.js`
  - `tests/trade/twoWayPlayers_snapshot.test.js`
- Entitlement routing / exclusivity / Stepien:
  - `src/tests/architect/tradeEntitlementRouting.test.ts`
  - `src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts`
  - `tests/validators/stepien.test.js`
- Apply-pipeline wiring:
  - `src/tests/architect/phase55_trade_validation_separation_guardrails.test.js`
  - `src/tests/architect/phase56_pure_computeTradeResult_guardrails.test.js`
  - `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js`
  - `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts`
  - `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts`

### Weakly covered areas

- Live world-date threading into trade validation:
  - `src/tests/architect/worldTime.test.js` proves warning structure and a structural `asOfDate` parameter, but does not prove that executeTrade validation consumes world time.
- Live `tpeId` UI path:
  - TPE tests mainly cover the `appliedTPEs` path (`tests/trade/secondApron_tpeBan.test.js`, `tests/trade/tpe_absorption_fail_closed.test.js`), not the per-player `tpeId` path written by the UI.
- Cross-consumer result-shape use:
  - No direct tests prove `TradeLegalChecker`, `TradeSummaryPanel`, `TradeExceptionDashboard`, and `FaExceptionTracker` accurately render the authoritative result contract.

### Uncovered or effectively uncovered areas

- `validateTrade()`-level two-way trade blocking.
- `validateTrade()`-level FA-exception legality.
- `validateTrade()`-level seasonal cash ledger enforcement using the live payload shape.
- Preview/apply parity when `forceTrade` is enabled.
- Any authoritative proof that sign-and-trade offseason legality uses real world season state in preview/apply.

### Misleading / shallow tests

- `tests/trade/faExceptions_as_trade_buckets.test.js:26-169`
  - Directly tests `validateFaExceptionUsage()`, but that module is not enforced by `validateTrade()`.
- `src/tests/architect/batchB_cbaRules.test.js:117-283`
  - Directly tests `validateEligibility()` two-way blocking, but the authoritative engine imports a different file.
- `tests/trade/timingGates_softEnforcement.test.js:15-78`
  - Proves callback behavior of `enforceTiming()`, not `validateTrade()` integration. In the real engine, warn-mode arrays still become blockers.
- `src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx:78-80`
  - Mocks `validateTrade()`.
- `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts:75-77`
  - Mocks `validateTrade()`.
- `src/tests/architect/signAndTrade.test.js:67-70`
  - Mocks `validateTrade()`.
- `tests/tradeValidatorEdgeCases.test.js:98-128`
  - The protected-picks case fabricates a validator result instead of calling the validator.
- `src/tests/architect/worldTime.test.js:123-140`
  - Structural signature test only; it does not prove trade validation consumes `asOfDate`.
- `tests/trade/validation_caching.test.js:44-170`
  - Only proves cache metrics move, not that cache partitioning or validator correctness is safe.

### Bug classes likely to escape the current suite

- Out-of-season sign-and-trade approvals through live preview/apply.
- Two-way player trades passing through `validateTrade()`.
- FA-exception legality missing on the user-reachable absorption-mode path.
- Seasonal cash-limit false negatives on the authoritative payload shape.
- Official UI panels silently omitting active blockers because of result-shape mismatches.

### Recommended next tests

- A `validateTrade()` regression test that sends an outgoing two-way player and expects illegality.
- A `validateTrade()` regression test for the live FA-exception path (`absorptionMode: 'FA_EXCEPTION'`, `bucketType`, outgoing salary present, above-apron team).
- A live-path TPE test that uses `player.tpeId` without `appliedTPEs` and verifies second-apron behavior.
- A pipeline test that sets world `asOfDate` and proves executeTrade timing legality changes with world time, not machine time.
- Consumer tests for `TradeLegalChecker`, `TradeSummaryPanel`, `TradeExceptionDashboard`, and `FaExceptionTracker` against a real validator result object.

## 9. Docs / Reality Mismatches

- `docs/architect/TRADE_MACHINE_MASTER.md:295-301` marks validator/apply consistency, sign-and-trade, and salary matching as blanket `PASS`. That is too optimistic for the current live validator path; this audit found blocker-level gaps in world-time threading, sign-and-trade season state, FA-exception enforcement, and two-way enforcement.
- `docs/architect/TRADE_MACHINE_MASTER.md:430` claims first-apron hard-cap triggering is enforced in `validateFaExceptionUsage.js`. The authoritative engine does not call that file.
- `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md:193-195` lists `TradeValidationPanel.jsx` as a must-match UI surface. That file does not exist; the active panel is `ValidationDetailsPanel.jsx` plus `TradeLegalChecker.jsx`.
- `src/features/architect/hooks/useTradeMachineSnapshot.js:7-12` says snapshot access should be teamResults-only and receipt is debug-only, but `getTradeSnapshot()` still falls back to `result.tradeReceipt` for `yearKey`, `seasonKey`, and `capSettings` at `useTradeMachineSnapshot.js:147-156`.
- `src/features/architect/utils/tradeContext/types.js:61-70` documents `warnings` on `ValidatedTradeContext` as if they faithfully reflect `validateTrade()`, but the implementation drops successful team warnings and top-level early-return violations/warnings.

## 10. TypeScript Readiness Assessment

### Ready for TS after cleanup

- `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js`
- `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js`
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js`
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js`

Reason: these areas already have relatively clear input/output contracts and fewer consumer-shape problems, although they should still move behind standardized rule result types.

### Needs design cleanup first

- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
- `src/features/architect/utils/tradeMachine/rules/timingValidation.js`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
- `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js`
- `src/features/architect/utils/tradeMachine/rules/validateEligibility.js`
- `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js`
- `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
- `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
- `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx`
- `src/features/architect/tradeMachine/FaExceptionTracker.jsx`

Reason: these files currently disagree on rule ownership, result shape, or live context inputs. Typing them now would freeze the wrong contracts.

### Should remain JS until later

- `src/features/architect/utils/tradeManager.js`
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
- `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`
- `src/features/architect/utils/tradeMachine/rules/rosterValidation.js`
- `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
- `src/features/architect/utils/tradeMachine/cache/validationCache.js`
- `src/features/architect/utils/tradeMachine/index.js`

Reason: these are either non-authoritative, duplicated, or compatibility/barrel surfaces that should be reduced before migration.

### Natural type boundaries that should be standardized first

- `TradeValidationInput`
  - `teams`, `capProjections`, `currentYear`, `tradeCtx`
- `NormalizedTradeTeam`
  - resolved team identity, incoming/outgoing players, entitlements, salary totals, cash fields
- `RuleResult`
  - one standardized shape for every rule; remove bare arrays from the authoritative contract
- `TeamValidationResult`
  - exact per-team fields returned by `validateTrade()`
- `TradeValidationResult`
  - one top-level success/failure shape; no early-return special cases with different keys
- `ValidatedTradeContext`
  - should preserve all top-level violations/warnings without lossy reshaping
- `TradeDisplaySnapshot`
  - one consumer-facing snapshot shape for UI, derived from validator output

## 11. Recommended Next Passes

1. Validator correctness fixes
   - Thread canonical `asOfDate` and `offseason` into both preview and apply validation.
   - Make one eligibility module authoritative and wire two-way blocking into `validateTrade()`.
   - Wire FA-exception legality into the authoritative validator path.
   - Unify the TPE live path so `tpeId` and `appliedTPEs` are not competing contracts.
   - Align cash field naming so seasonal cash validation works on the live payload.

2. Result-shape cleanup
   - Replace array-returning enforcers in the authoritative contract with a single rule result envelope.
   - Standardize top-level `errors`, `warnings`, and `teamResults` across success and failure cases.
   - Remove UI expectations for nonexistent `failures`, `capSettings`, `incomingPlayers`, `apronStatus`, etc., or explicitly expose them.

3. Missing tests
   - Add `validateTrade()` tests for two-way, FA-exception, seasonal cash, live `tpeId`, and world-date timing.
   - Add UI consumer tests for the official validator display panels.
   - Add an apply-path test proving world `asOfDate` changes trade legality.

4. TS conversion order
   - First wave after cleanup: `hardCapStatus`, `capSettingsProvider`, `matchingValues`, routing/Stepien helpers.
   - Second wave: `validateSalaryMatching`, `hardCapValidation`, `validateStepien`, routing rules.
   - Final wave only after contract cleanup: `tradeValidator`, `tradeContext`, exception/timing/eligibility rules, UI consumer panels.

## 12. STOP Conditions

STOP conditions were found.

- `validator can approve clearly illegal trades`
  - Two-way player trades are not enforced by the authoritative engine.
  - Live sign-and-trade legality defaults to offseason and misses world-time context.
  - FA-exception legality is implemented/tested but not enforced in the authoritative validator.
- `UI legality and execution legality are materially disconnected`
  - `forceTrade` can make preview/apply UI appear legal while authoritative apply still rejects.
- `major rule family claimed by product/docs is missing or nonfunctional`
  - FA-exception trade legality/hard-cap triggering is documented and tested, but not wired into `validateTrade()`.

Primary evidence files:

- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- `src/features/architect/utils/tradeMachine/rules/validateEligibility.js`
- `src/features/architect/utils/tradeMachine/rules/enforceEligibility.js`
- `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js`
- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/mutationPipeline.js`

---

Files changed:

- `return_packages/trade_machine/TM_VALIDATOR_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `docs/architect/TRADE_MACHINE_MASTER.md`

Validation commands actually run:

- `npm run test:trade -- --reporter=dot`

Commands intentionally skipped and why:

- `npm run test:architect -- --reporter=dot` was intentionally skipped for this docs-only return package because prior repo behavior exceeded the 4-minute AGENTS budget and the architect/apply assertions used here were proven by direct source inspection plus targeted guardrail/integration test review.
- `npm run build` was intentionally skipped because no application code changed.
- `npm run validate:project` was intentionally skipped because no structural project changes were made.
