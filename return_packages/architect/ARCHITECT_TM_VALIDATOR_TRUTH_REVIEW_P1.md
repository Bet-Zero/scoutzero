# ARCHITECT_TM_VALIDATOR_TRUTH_REVIEW_P1

Reviewed against live code on 2026-03-25.

This return package records the P1 documentation pass for the Trade Machine validator truth review. All claims below are based on live code only. Any item not directly confirmed in live code is marked `Unconfirmed`.

## Executive verdict

**MOSTLY CORRECT, BUT HIGH-RISK GAPS REMAIN**

The current TM preview path and the primary world-apply path both reuse `validateTrade(...)` as the core legality engine. Major rule families appear to live in that path.

The system's true execute-trade authority is still broader than the validator core alone. World apply can reject after a green TM preview because later world invariant and post-state gates run after `_validatedTradeContext.legal` passes. That prevents calling the current TM preview green state a full authoritative decision.

## Files changed

- `docs/architect/ARCHITECT_TM_VALIDATOR_TRUTH_REVIEW.md`
- `return_packages/architect/ARCHITECT_TM_VALIDATOR_TRUTH_REVIEW_P1.md`

## Files reviewed

- `src/features/architect/hooks/useTradeMachine.ts`
- `src/features/architect/tradeMachine/TradeEditor.tsx`
- `src/features/architect/tradeMachine/utils/computeTradeDraftKey.ts`
- `src/features/architect/utils/tradeMachine/index.ts`
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`
- `src/features/architect/utils/tradeContext/tradeContext.ts`
- `src/features/architect/utils/tradeContext/index.ts`
- `src/features/architect/utils/tradeContext/legacy/index.ts`
- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/capLegality/postStateCapValidator.ts`
- `src/features/architect/utils/leagueInvariants.ts`
- `src/features/architect/utils/tradeMachine/utils/matchingValues.ts`
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.ts`
- `src/features/architect/utils/tradeMachine/utils/tpeValidation.ts`
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.ts`
- `src/features/architect/utils/tradeMachine/rules/validateStepien.ts`
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.ts`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.ts`
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.ts`
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.ts`
- `src/features/architect/utils/tradeMachine/rules/basicRules.ts`
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.ts`
- `src/features/architect/utils/tradeMachine/rules/validateHardCap.ts`
- `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`
- `src/features/architect/utils/tradeMachine/rules/rosterValidation.ts`
- `src/features/architect/utils/tradeMachine/rules/enforcement.ts`
- `src/features/architect/utils/tradeMachine/validators/index.ts`
- `src/features/architect/utils/tradeManager.ts`
- `src/features/architect/utils/architectCore.ts`
- `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts`
- `src/features/architect/hooks/useTradeMachineSnapshot.ts`
- `src/features/architect/tradeMachine/TradeTeamCard.tsx`
- `src/features/architect/tradeMachine/TradeSalaryCalculator.tsx`

## Authoritative path map

| Path | SSOT tier | File / function | Role | Live evidence | Assessment |
| --- | --- | --- | --- | --- | --- |
| TM preview legality controller | `local preview` | `useTradeMachine.ts` -> `validateCurrentTrade()` | Builds preview input and calls `validateTrade(...)` | `useTradeMachine.ts:1049-1116` | Current TM UI preview controller |
| TM UI apply affordance | `UI-only` | `useTradeMachine.ts` -> `hasCurrentValidation`; `TradeEditor.tsx` -> `canApplyTrade` | Apply button trusts draft freshness plus `result.legal` | `useTradeMachine.ts:422-435`, `TradeEditor.tsx:333`, `TradeEditor.tsx:640-649` | Not full world-apply authority |
| Public TM validator export | `authoritative validator` | `tradeMachine/index.ts` -> `validateTrade` export | Public validator surface | `tradeMachine/index.ts:10` | Canonical public validator export |
| Core legality engine | `authoritative validator` | `tradeValidator.ts` -> `validateTrade()` | Matching values, routing, per-team rules, overall `legal` | `tradeValidator.ts:1121-1941` | Current validator core |
| Apply snapshot builder | `authoritative apply gate` | `tradeContext.ts` -> `buildPostTradeTeamsSnapshot()` | Builds post-trade input shape and throws on invalid apply preconditions | `tradeContext.ts:114-276` | Apply validates a different input shape than preview |
| Apply validator reuse | `authoritative apply gate` | `tradeContext.ts` -> `validatePostTradeSnapshotForContext()` | Reuses `validateTrade(...)` on snapshot | `tradeContext.ts:596-708` | Core preview/apply alignment point |
| Execute-trade compute gate | `authoritative apply gate` | `mutationPipeline.ts` -> `computeWorldMutation('executeTrade')` | Canonical chain: snapshot -> validate context -> compute | `mutationPipeline.ts:3691-3731` | Canonical pre-persist apply chain |
| Execute-trade validation gate | `authoritative apply gate` | `mutationPipeline.ts` -> `validateMutation()` | Returns `_validatedTradeContext.legal` directly | `mutationPipeline.ts:5321-5366` | No apply-time fallback validator |
| Apply-only world gates | `authoritative apply gate` | `mutationPipeline.ts` -> later invariant + post-state validators | Final blockers before persist | `mutationPipeline.ts:2420-2585` | Main preview/apply mismatch source |
| Post-state legality gate | `persisted/post-state` | `postStateCapValidator.ts` -> `validatePostStateCapLegality()` | Later after-state cap / schema / roster recheck | `postStateCapValidator.ts:227-468` | Separate post-state truth tier |

## What the UI actually trusts

### Primary preview-entry function

The preview-entry function that actually controls TM legal/apply affordances is:

- `src/features/architect/hooks/useTradeMachine.ts` -> `validateCurrentTrade()`

Secondary or alternate preview-like surfaces found in the repo:

- `src/features/architect/utils/tradeContext/legacy/index.ts` -> `legacy_validateTradeForContext()` / `validateTradeForContext`
- `src/features/architect/utils/tradeManager.ts` -> `executeTrade()`

These secondary paths do not control the current TM Apply button in the live repo.

### Exact boolean / state chain

1. `currentDraftKey = computeTradeDraftKey({ yearKey, teams })`
   - Evidence: `useTradeMachine.ts:422-425`
2. `hasCurrentValidation` requires:
   - non-empty `result.teamResults`, and
   - `isValidationCurrent(currentDraftKey, lastValidatedDraftKeyRef.current)`
   - Evidence: `useTradeMachine.ts:428-435`
3. `validateCurrentTrade()` calls `validateTrade(...)` and stores the returned `result`
   - Evidence: `useTradeMachine.ts:1091-1116`, `useTradeMachine.ts:1132-1145`
4. `canApplyTrade = hasCurrentValidation && result?.legal === true`
   - Evidence: `TradeEditor.tsx:333`
5. The Apply click handler rechecks both conditions before `onApplyTrade(...)`
   - Evidence: `TradeEditor.tsx:640-649`, `TradeEditor.tsx:651-675`

### UI trust conclusion

The UI trusts:

- validated-draft freshness, and
- preview `result.legal`

The UI does **not** trust:

- later world invariant gates
- later post-state cap validation

That is why a green TM preview is not equal to the full system apply truth.

## Rule-family matrix

| Rule family | Authoritative live path | Preview coverage | Apply coverage | Drift status | Confidence |
| --- | --- | --- | --- | --- | --- |
| Salary matching | `validateTrade()` -> `computeMatchingValues()` + `validateSalaryMatching()` | Yes | Yes | Same core validator; different input builder | High |
| BYC | `computeMatchingValues()` | Yes | Yes | Same core validator path | High |
| Trade kickers | `computeMatchingValues()` | Yes | Yes | Same core validator path | High |
| Roster min / max | Inline `computeRosterValidation()`; later `validatePostStateCapLegality()` rechecks max-15 and two-way max only | Yes | Yes, plus later partial post-state recheck | Partial alignment; stage split | High |
| Hard cap / apron restrictions | `validateHardCap()`, `validateSalaryMatching()`, `enforceSecondApronHandcuffs()`, `validateAggregation()`, `validateTradeExceptions()` | Yes | Yes, plus later post-state hard-cap recheck | Apply stricter | High |
| Aggregation / salary-combine restrictions | `validateAggregation()` | Yes | Yes | Same core validator path | High |
| Stepien / pick restrictions | `validateStepien()` | Yes | Yes | Same core validator path | High |
| Entitlement / pick ownership legality | `validateEntitlementRouting()`, `validateEntitlementLinkageLegality()`, validator exclusivity block | Yes | Yes, plus later entitlement invariant / exclusivity gates | Apply stricter | High |
| TPE usage / creation rules | `validateTradeExceptions()`, `validateSalaryMatching()`, `createTPE()` | Yes | Yes | Same core validator path | High |
| Sign-and-trade restrictions | `validateSignAndTrade()`; apply snapshot builder SAT preflight | Yes | Yes, plus extra SAT preflight and later post-state hard-cap gate | Apply stricter | High |

## Duplicate / legacy / convenience path audit

| Target | Live status | Current non-test repo call site | Effect on current legality outcomes | Classification |
| --- | --- | --- | --- | --- |
| `tradeContext/legacy/index.ts` | Secondary legacy wrapper | None found outside its barrel | Delegates to canonical chain; not current TM controller | Potential drift risk |
| `tradeMachine/validators/index.ts` | Compatibility-only barrel | None found in repo core | No confirmed live effect on current legality outcomes | Potential drift risk |
| `tradeManager.ts` | Secondary alternate trade surface | No direct non-test import found; exported through `architectCore` | Can bypass mutation-pipeline world gates if called | Confirmed risk |
| `architectCore.ts` | Compatibility export surface | No direct non-test import found | Keeps alternate trade surface exported | Confirmed risk |
| `hardCapValidation.ts` | Current hard-cap validator | Imported by live core | Current authoritative hard-cap path | No issue confirmed |
| `validateHardCap.ts` | Alternate hard-cap implementation | No non-test import found | No confirmed current effect | Potential drift risk |
| `validateRoster.ts` | Secondary exported roster helper | No live core call site confirmed | Not current authoritative roster path | Potential drift risk |
| `rosterValidation.ts` | Secondary legacy/consolidated roster helper | Imported but not confirmed to drive live core legality | Overlap only; no current effect confirmed | Potential drift risk |
| `enforcement.ts` | Dead local helper module | No non-test import found | No confirmed current effect | No issue confirmed |

## Findings table

| Severity | Classification | Area | Exact file(s) | Exact function(s) | What is wrong / risky | Why it matters | Fix direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| High | Confirmed risk | Preview vs apply authority | `TradeEditor.tsx`, `useTradeMachine.ts`, `mutationPipeline.ts`, `leagueInvariants.ts`, `postStateCapValidator.ts` | `canApplyTrade`, `validateCurrentTrade`, `applyWorldMutation`, `validateMutationLeagueInvariants`, `validateMutationEntitlementInvariants`, `validateTradeApplyExclusivity`, `validatePostStateCapLegality` | UI green does not include later apply-only blockers | Preview can create false confidence | Surface apply-only gates in preview or downgrade UI claim |
| High | Confirmed risk | Apply-time SSOT clarity | `mutationPipeline.ts`, `tradeContext.ts` | `computeWorldMutation`, `validatePostTradeSnapshotForContext`, `validateMutation`, `applyWorldMutation` | No single function is the final execute-trade authority | Easy to misidentify `validateTrade(...)` as the full decision engine | Surface a single composed authority result |
| Medium | Confirmed risk | Alternate trade execution surface | `tradeManager.ts`, `architectCore.ts` | `executeTrade` | Exported alternate path bypasses later mutation-pipeline gates if used | Future drift and accidental bypass risk | Deprecate/remove or wrap pipeline |
| Medium | Potential drift risk | Hard-cap overlap | `hardCapValidation.ts`, `validateHardCap.ts` | alternate `validateHardCap` implementations | Two hard-cap implementations remain | Future imports can split semantics | Retire or redirect alternate |
| Medium | Potential drift risk | Roster overlap | `tradeValidator.ts`, `validateRoster.ts`, `rosterValidation.ts`, `enforcement.ts`, `postStateCapValidator.ts` | `computeRosterValidation`, `validateRoster`, `validateRosterWindow`, `validatePostStateCapLegality` | Roster legality is spread across multiple helpers and stages | Future refactors can drift silently | Consolidate roster SSOT |
| Low | Potential drift risk | Legacy / compatibility barrels | `tradeContext/index.ts`, `tradeContext/legacy/index.ts`, `tradeMachine/validators/index.ts` | `validateTradeForContext`, `legacy_validateTradeForContext` | Canonical and legacy surfaces still coexist publicly | Ambiguous future call-site choices | Narrow exports or mark internal-only |

## Preview vs apply alignment assessment

- **Are preview and apply the same truth path?**
  - Partially aligned.
  - Both reuse `validateTrade(...)`.
  - Apply validates a post-trade snapshot and then adds later world-only gates.

- **Can preview say legal while apply rejects?**
  - **Yes. Confirmed.**
  - Live causes:
    - `validateMutationLeagueInvariants(...)`
    - `validateMutationEntitlementInvariants(...)`
    - `validateTradeApplyExclusivity(...)`
    - `validatePostStateCapLegality(...)`
  - Evidence: `mutationPipeline.ts:2443-2585`

- **Can preview say blocked while apply would allow?**
  - **Unconfirmed.**
  - Live code confirms no apply-time bypass once `_validatedTradeContext.legal` is false.
  - Live code does not directly prove whether the preview-built input shape could fail while the apply snapshot-built shape would pass.

- **Are there rule families enforced in apply but not preview?**
  - **Yes. Confirmed.**
  - World duplicate-player gate
  - World duplicate-entitlement gate
  - World trade apply exclusivity gate
  - Post-state cap / schema / roster recheck

- **Are there rule families enforced in preview but not apply?**
  - **No issue confirmed** for the authoritative execute-trade path.
  - Apply reuses `validateTrade(...)` through `validatePostTradeSnapshotForContext()`.

## Trust blockers

- The TM Apply button trusts preview freshness plus `result.legal`, not later world-only gates.
- The true world execute-trade authority is layered, not single-function.
- `tradeManager.executeTrade()` remains an exported alternate trade surface outside the mutation-pipeline world gates.
- Hard-cap and roster helper overlap remains a future drift risk.

## Recommended next ticket list

1. Surface later world-only gates in preview or change preview wording so green no longer implies guaranteed apply success.
2. Introduce a single surfaced execute-trade authority result that composes validator + world invariants + post-state legality.
3. Deprecate or remove `tradeManager.executeTrade()` and the `architectCore` re-export.
4. Retire `rules/validateHardCap.ts` and keep one hard-cap implementation.
5. Consolidate roster legality into one clearly tiered source reused across preview and post-state validation.

## Commands run

Evidence-gathering commands run during this review included:

- `git status --short`
- `find src/features/architect/utils/tradeMachine -maxdepth 3 \( -name '*.ts' -o -name '*.js' \) | sort`
- `find src/features/architect/utils/tradeContext -maxdepth 3 \( -name '*.ts' -o -name '*.js' \) | sort`
- `rg -n ...` across the reviewed files to trace imports, call sites, and alternate entrypoints
- `sed -n ...` and `nl -ba ...` across the reviewed files to capture exact function bodies and line-level evidence

## Validation commands actually run

- `npm run validate:project`
  - Result: passed
- `npm run test:diff -- --reporter=dot`
  - Result: failed
  - Runner summary: `6` failed files, `7` failed tests, `225` passed files, `2929` passed tests
  - Duration: `585.41s`
  - Observed failures:
    - `src/tests/architect/architectTsTopologyCleanup.behavior.test.ts`
      - `keeps TradeExportCapture importable after the topology cleanup`
      - timed out at `5000ms`
    - `src/tests/architect/architectTsTopologyCleanup.guardrail.test.ts`
      - `resolves FreeAgencyFilterBar through the TS authority in Vite`
      - timed out at `15000ms`
    - `src/tests/architect/architectTsTopologyCleanup.guardrail.test.ts`
      - `resolves TradeExportCapture through the TS authority in Vite`
      - timed out at `15000ms`
    - `src/tests/architect/mutationPipeline.boundary.e107.test.ts`
      - expected named export surface did not match because `preflightOfferSheetMutation` is now present
    - `src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts`
      - expected named export surface did not match because `preflightOfferSheetMutation` is now present
    - `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
      - flagged direct `.tradeExceptions` read in `utils/capLegalityValidation.ts:1838`
    - `src/tests/architect/phase83_live_pipeline_mutations_and_season_advance_emulator_e2e.test.js`
      - expected source text to contain `advanceSeasonInWorld(worldId`

## Commands intentionally skipped

- `npm run lint`
  - Skipped because repo guidance says lint has many pre-existing errors and this ticket is documentation-only.
- `npm run lint:md`
  - Skipped because markdown lint is optional and not required to validate the code-trace conclusions.
- `npm run test:full`
  - Skipped because full suite requires explicit `RUN FULL SUITE` permission and this ticket is documentation-only.
- A second cheaper follow-up test command
  - Skipped because `npm run test:diff -- --reporter=dot` is already the repo's preferred lowest-cost default validation command for this kind of documentation review.
