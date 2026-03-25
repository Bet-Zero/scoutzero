# Architect TM Validator Truth Review

Reviewed against live code on 2026-03-25.

All claims below are based on current source code only. Any item not directly confirmed in live code is marked `Unconfirmed`.

## Executive verdict

**MOSTLY CORRECT, BUT HIGH-RISK GAPS REMAIN**

The current Trade Machine preview path and the primary world-apply path both reuse the same core validator: `validateTrade(...)` in `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`. That core validator appears to own the major Trade Machine rule families and is not obviously bypassed by the current TM UI path.

The main trust blocker is that the system's actual apply-time authority is not just `validateTrade(...)`. World apply adds later blocking stages after the prevalidated trade context passes: league duplicate-player checks, entitlement duplicate/exclusivity checks, and a separate post-state cap validator. The UI apply affordance currently trusts validated-draft freshness plus `result.legal`; it does not trust or surface those later apply-only blockers.

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
| TM preview legality controller | `local preview` | `src/features/architect/hooks/useTradeMachine.ts` -> `validateCurrentTrade()` | Builds `validationTeams`, calls `validateTrade(...)`, stores `result` used by TM UI | `useTradeMachine.ts:1049-1116` | This is the current preview path that controls TM legality UI. |
| TM UI apply affordance | `UI-only` | `src/features/architect/hooks/useTradeMachine.ts` -> `hasCurrentValidation`; `src/features/architect/tradeMachine/TradeEditor.tsx` -> `canApplyTrade` | Enables Apply button only when draft freshness and preview legality both pass | `useTradeMachine.ts:422-435`, `TradeEditor.tsx:333`, `TradeEditor.tsx:640-649` | This is what the UI actually trusts, not the full world-apply authority. |
| Public TM validator export | `authoritative validator` | `src/features/architect/utils/tradeMachine/index.ts` -> `export { validateTrade } from './engine/tradeValidator'` | Public barrel for the core validator | `tradeMachine/index.ts:10` | Current public validator surface. |
| Core legality engine | `authoritative validator` | `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts` -> `validateTrade()` | Resolves canonical context, runs matching values, cross-team routing checks, per-team rules, and produces `legal` / `teamResults` / `tradeReceipt` | `tradeValidator.ts:1121-1941` | Current authoritative validator core reused by preview and by apply prevalidation. |
| Apply snapshot builder | `authoritative apply gate` | `src/features/architect/utils/tradeContext/tradeContext.ts` -> `buildPostTradeTeamsSnapshot()` | Builds post-trade team state before apply validation; also throws on invalid 3+ team routing and outgoing sign-and-trade payload issues | `tradeContext.ts:114-276` | Apply does not validate the same raw input shape as preview; it validates a built post-trade snapshot. |
| Apply validator reuse | `authoritative apply gate` | `src/features/architect/utils/tradeContext/tradeContext.ts` -> `validatePostTradeSnapshotForContext()` | Calls `validateTrade(...)` once on `snapshot.validationTeams`, wraps result as `_validatedTradeContext` | `tradeContext.ts:596-708` | This is the apply path's reuse of the core validator. |
| Execute-trade compute gate | `authoritative apply gate` | `src/features/architect/utils/mutationPipeline.ts` -> `computeWorldMutation('executeTrade')` | Canonical execute-trade chain is `buildPostTradeTeamsSnapshot -> validatePostTradeSnapshotForContext -> computeTradeResult` | `mutationPipeline.ts:3691-3731` | Canonical apply prevalidation path. |
| Execute-trade validation gate | `authoritative apply gate` | `src/features/architect/utils/mutationPipeline.ts` -> `validateMutation()` | For `executeTrade`, returns `_validatedTradeContext.legal` directly and throws if context missing | `mutationPipeline.ts:5321-5366` | There is no fallback validator in apply. |
| Apply-only world gates | `authoritative apply gate` | `src/features/architect/utils/mutationPipeline.ts` -> `validateMutationLeagueInvariants()`, `validateMutationEntitlementInvariants()`, `validateTradeApplyExclusivity()`, `validatePostStateCapLegality()` | Additional blockers after trade validator passes | `mutationPipeline.ts:2420-2585` | These are part of real apply truth and are not surfaced by the TM preview button state. |
| Post-state cap gate | `persisted/post-state` | `src/features/architect/utils/capLegality/postStateCapValidator.ts` -> `validatePostStateCapLegality()` | Re-checks after-state totals sanity, hard cap, roster max/two-way max, and schema integrity | `postStateCapValidator.ts:227-468` | Separate later truth tier; not the same thing as preview legality. |

### Authoritative path conclusion

- **Authoritative preview legality path:** `TradeEditor` -> `useTradeMachine.validateCurrentTrade()` -> `validateTrade(...)`.
- **Authoritative apply-time legality path:** `applyWorldMutation()` -> `computeWorldMutation('executeTrade')` -> `buildPostTradeTeamsSnapshot()` -> `validatePostTradeSnapshotForContext()` -> `validateTrade(...)` -> `validateMutation()` -> later world invariant gates -> `validatePostStateCapLegality()`.
- **Post-state legality path:** `validatePostStateCapLegality(...)` before persistence.
- **Same truth or partially aligned?** Partially aligned. Preview and apply share the same core validator, but apply validates a post-trade snapshot and then adds later blocking stages that preview does not include.
- **Is there one single authoritative apply-time function?** No. Live code shows a layered apply-time authority, not a single-function apply gate.

## What the UI actually trusts

### Primary preview-entry function

The preview-entry function that actually controls TM legal/apply affordances is:

- `src/features/architect/hooks/useTradeMachine.ts` -> `validateCurrentTrade()`

Other preview-like or alternate legality entrypoints exist, but they are secondary:

- `src/features/architect/utils/tradeContext/legacy/index.ts` -> `legacy_validateTradeForContext()` / `validateTradeForContext`
- `src/features/architect/utils/tradeManager.ts` -> `executeTrade()`

Neither secondary path controls the current TM Apply button in the live repo.

### Exact UI trust chain

1. `currentDraftKey` is recomputed from `yearKey` and `teams` with `computeTradeDraftKey(...)`.
   - Evidence: `useTradeMachine.ts:422-425`
2. `hasCurrentValidation` is true only when:
   - `result.teamResults` exists and is non-empty, and
   - `isValidationCurrent(currentDraftKey, lastValidatedDraftKeyRef.current)` returns true.
   - Evidence: `useTradeMachine.ts:428-435`
3. `validateCurrentTrade()` calls `validateTrade(...)` and stores the returned `result`.
   - Evidence: `useTradeMachine.ts:1091-1116`, `useTradeMachine.ts:1132-1145`
4. `TradeEditor` sets `canApplyTrade = hasCurrentValidation && result?.legal === true`.
   - Evidence: `TradeEditor.tsx:333`
5. The Apply click handler rechecks both conditions before calling `onApplyTrade(...)`.
   - Evidence: `TradeEditor.tsx:640-649`, `TradeEditor.tsx:651-675`

### UI trust assessment

The UI currently trusts **both**:

- validated-draft freshness (`hasCurrentValidation`), and
- preview legality (`result.legal`)

The UI does **not** trust, display, or precompute:

- `validateMutationLeagueInvariants(...)`
- `validateMutationEntitlementInvariants(...)`
- `validateTradeApplyExclusivity(...)`
- `validatePostStateCapLegality(...)`

That is the main reason a green TM preview is not the same thing as final world-apply authority.

## Rule-family matrix

| Rule family | Authoritative live path | Preview coverage | Apply coverage | Drift status | Confidence |
| --- | --- | --- | --- | --- | --- |
| Salary matching | `tradeValidator.validateTrade()` -> `validateSalaryMatching()` after `computeMatchingValues()` | Yes: `useTradeMachine.validateCurrentTrade()` calls `validateTrade(...)` | Yes: `validatePostTradeSnapshotForContext()` calls the same `validateTrade(...)` on `snapshot.validationTeams` | Same core validator; different input builder between preview and apply | High |
| BYC | `computeMatchingValues()` writes `player.matchOutgoing` for BYC before salary rules run | Yes | Yes | Same core validator path; no independent apply-only recheck confirmed | High |
| Trade kickers | `computeMatchingValues()` adjusts `player.matchIncoming` for kicker math before salary rules run | Yes | Yes | Same core validator path; no independent apply-only recheck confirmed | High |
| Roster min / max | Inline `computeRosterValidation()` inside `tradeValidator.ts`; later `validatePostStateCapLegality()` rechecks max-15 and two-way max only | Yes | Yes, plus later post-state recheck of max-15 / two-way max | Split across validator core and post-state validator; later gate is not identical to preview rule set | High |
| Hard cap / apron restrictions | `validateHardCap()`, `validateSalaryMatching()` hard-cap ceiling logic, `enforceSecondApronHandcuffs()`, `validateAggregation()`, `validateTradeExceptions()` | Yes | Yes, plus later `validatePostStateCapLegality()` hard-cap ceiling check | Apply is stricter because of later post-state hard-cap validation | High |
| Aggregation / salary-combine restrictions | `validateAggregation()` | Yes | Yes | Same core validator path | High |
| Stepien / pick restrictions | `validateStepien()` with entitlement-derived baseline builders | Yes | Yes | Same core validator path | High |
| Entitlement / pick ownership legality | `validateEntitlementRouting()`, `validateEntitlementLinkageLegality()`, inline entitlement exclusivity block in `tradeValidator.ts` | Yes | Yes, plus `validateMutationEntitlementInvariants()` and `validateTradeApplyExclusivity()` later in apply | Apply is stricter because later world-state entitlement gates are separate from preview | High |
| TPE usage / creation rules | `validateTradeExceptions()`, `validateSalaryMatching()` TPE absorption accounting, `createTPE()` in validator result construction | Yes | Yes | Same core validator path; compatibility TPE inputs remain supported | High |
| Sign-and-trade restrictions | `validateSignAndTrade()`; apply snapshot builder also runs outgoing SAT destination/eligibility/contract preflight | Yes: strict TM source path sets `tradeCtx.source = 'tradeMachine'` | Yes, plus `buildPostTradeTeamsSnapshot()` SAT preflight and later post-state hard-cap gate | Apply is stricter because SAT preflight and post-state gates exist beyond preview UI trust | High |

## Duplicate / legacy / convenience path audit

| Target | Live status | Current non-test repo call site | Effect on current legality outcomes | Classification |
| --- | --- | --- | --- | --- |
| `src/features/architect/utils/tradeContext/legacy/index.ts` | Secondary legacy wrapper | None found outside its own public barrel | Delegates to canonical snapshot + context path; not the current TM UI/apply controller | Potential drift risk |
| `src/features/architect/utils/tradeMachine/validators/index.ts` | Compatibility-only barrel | None found in current repo core | Re-exports rule helpers but is not the live UI/apply authority | Potential drift risk |
| `src/features/architect/utils/tradeManager.ts` | Secondary alternate trade execution surface | No direct non-test import found; still exported through `architectCore` | Calls `validateTrade(...)` directly and then mutates snapshots outside mutation-pipeline world gates | Confirmed risk |
| `src/features/architect/utils/architectCore.ts` | Compatibility export surface | No direct non-test import found | Keeps `tradeManager.executeTrade` exported as a reachable alternate trade surface | Confirmed risk |
| `src/features/architect/utils/tradeMachine/rules/hardCapValidation.ts` | Current hard-cap validator used by live core | `tradeValidator.ts` imports `validateHardCap` from here | Current authoritative hard-cap validator | No issue confirmed |
| `src/features/architect/utils/tradeMachine/rules/validateHardCap.ts` | Alternate standalone hard-cap implementation | No non-test import found | No confirmed effect on current legality outcomes | Potential drift risk |
| `src/features/architect/utils/tradeMachine/rules/validateRoster.ts` | Secondary exported roster helper | No live core call site confirmed | Not the current authoritative TM team-legality roster path | Potential drift risk |
| `src/features/architect/utils/tradeMachine/rules/rosterValidation.ts` | Secondary legacy/consolidated roster helper | Imported in `tradeValidator.ts`, but current team legality uses inline `computeRosterValidation()` instead | No confirmed current legality effect from its imported `enforceRosterWindow()` in the live core | Potential drift risk |
| `src/features/architect/utils/tradeMachine/rules/enforcement.ts` | Dead local helper module | No non-test import found | No confirmed current effect on legality outcomes | No issue confirmed |

## Findings table

| Severity | Classification | Area | Exact file(s) | Exact function(s) | What is wrong / risky | Why it matters | Fix direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| High | Confirmed risk | Preview vs apply authority | `src/features/architect/tradeMachine/TradeEditor.tsx`; `src/features/architect/hooks/useTradeMachine.ts`; `src/features/architect/utils/mutationPipeline.ts`; `src/features/architect/utils/leagueInvariants.ts`; `src/features/architect/utils/capLegality/postStateCapValidator.ts` | `canApplyTrade`; `validateCurrentTrade`; `applyWorldMutation`; `validateMutationLeagueInvariants`; `validateMutationEntitlementInvariants`; `validateTradeApplyExclusivity`; `validatePostStateCapLegality` | TM preview green is not the full system apply truth. Apply adds later blocking gates after `_validatedTradeContext.legal` passes. | The UI can still create false confidence: preview says legal, apply still fails for world-integrity or post-state legality reasons. | Either surface those apply-only gates during preview or change UI language/gating so green means “validator passed,” not “world apply guaranteed.” |
| High | Confirmed risk | Apply-time SSOT clarity | `src/features/architect/utils/mutationPipeline.ts`; `src/features/architect/utils/tradeContext/tradeContext.ts` | `computeWorldMutation`; `validatePostTradeSnapshotForContext`; `validateMutation`; `applyWorldMutation` | There is no single authoritative apply-time function. The real apply truth is composite. | Engineers can misidentify `validateTrade(...)` as the full decision engine when live apply authority is layered beyond it. | Document and enforce the layered contract explicitly; ideally centralize a single surfaced “final apply authority” result. |
| Medium | Confirmed risk | Alternate trade execution surface | `src/features/architect/utils/tradeManager.ts`; `src/features/architect/utils/architectCore.ts` | `executeTrade` | `tradeManager.executeTrade()` validates directly with `validateTrade(...)` and updates snapshots without the mutation pipeline's later invariant/post-state gates. | Future callers can bypass the current authoritative world-apply path even though the TM UI does not. | Deprecate/remove the export or route it through mutation-pipeline authority. |
| Medium | Potential drift risk | Hard-cap helper overlap | `src/features/architect/utils/tradeMachine/rules/hardCapValidation.ts`; `src/features/architect/utils/tradeMachine/rules/validateHardCap.ts` | `validateHardCap`; `validateHardCapLegacy`; alternate `validateHardCap` | Two different hard-cap implementations exist, but only one is live in the current core. | Not a current bug, but future imports can silently split hard-cap semantics. | Retire or redirect the alternate implementation to the live authoritative one. |
| Medium | Potential drift risk | Roster helper overlap | `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`; `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`; `src/features/architect/utils/tradeMachine/rules/rosterValidation.ts`; `src/features/architect/utils/tradeMachine/rules/enforcement.ts`; `src/features/architect/utils/capLegality/postStateCapValidator.ts` | `computeRosterValidation`; `validateRoster`; `validateRosterWindow`; `enforceRosterWindow`; `validatePostStateCapLegality` | Roster legality is spread across multiple helpers plus a post-state recheck with different scope. | Not a current confirmed bug, but it is an obvious future drift hotspot and already splits preview/apply-stage semantics. | Consolidate roster legality into a single clearly tiered source and reuse it across preview and post-state. |
| Low | Potential drift risk | Legacy / compatibility barrels | `src/features/architect/utils/tradeContext/index.ts`; `src/features/architect/utils/tradeContext/legacy/index.ts`; `src/features/architect/utils/tradeMachine/validators/index.ts` | `validateTradeForContext`; `legacy_validateTradeForContext` | Public barrels still expose legacy or compatibility entrypoints next to canonical ones. | This does not currently change TM UI/apply behavior, but it preserves ambiguous alternate surfaces. | Narrow public exports or mark legacy surfaces internal-only. |

## Preview vs apply alignment assessment

### Are preview and apply the same truth path?

**Partially aligned, not fully aligned.**

- They share the same core validator: `validateTrade(...)`.
- They do **not** share the same input builder.
  - Preview validates `validationTeams` built directly in `useTradeMachine.validateCurrentTrade()`.
  - Apply validates `snapshot.validationTeams` built by `buildPostTradeTeamsSnapshot()`.
- Apply then adds later world-only gates after the trade validator passes.

### Can preview say legal while apply rejects?

**Yes. Confirmed.**

Confirmed live causes:

- `applyWorldMutation()` calls `validateMutationLeagueInvariants(...)` after `validateMutation(...)` passes.
  - Evidence: `mutationPipeline.ts:2443-2470`
- `applyWorldMutation()` calls `validateMutationEntitlementInvariants(...)` after `validateMutation(...)` passes.
  - Evidence: `mutationPipeline.ts:2472-2499`
- `applyWorldMutation()` calls `validateTradeApplyExclusivity(...)` after `validateMutation(...)` passes.
  - Evidence: `mutationPipeline.ts:2501-2531`
- `applyWorldMutation()` calls `validatePostStateCapLegality(...)` after `validateMutation(...)` passes.
  - Evidence: `mutationPipeline.ts:2533-2585`

The UI Apply button does not incorporate any of those later gates.

### Can preview say blocked while apply would allow?

**Unconfirmed.**

What live code does confirm:

- `validateMutation()` for `executeTrade` returns `preValidated.legal` directly from `_validatedTradeContext`.
  - Evidence: `mutationPipeline.ts:5343-5358`
- There is no confirmed apply-time bypass that turns `_validatedTradeContext.legal === false` into an allowed world trade.

What live code does **not** directly prove:

- Whether a preview-side `validateTrade(...)` failure on the UI-built team shape could ever become legal on the apply snapshot-built shape.

So the inverse mismatch is not confirmed in live code and remains `Unconfirmed`.

### Are there rule families enforced in apply but not preview?

**Yes. Confirmed.**

Apply-only later gates confirmed in live code:

- duplicate-player world invariant
- duplicate-entitlement world invariant
- world apply entitlement exclusivity gate
- post-state cap validator checks:
  - after-state hard cap
  - totals sanity
  - roster max / two-way max
  - contract row validity
  - dead cap schema validity
  - exception schema validity
  - cap hold amount validity

### Are there rule families enforced in preview but not apply?

**No issue confirmed** for the authoritative execute-trade path.

Apply reuses the same `validateTrade(...)` result through `validatePostTradeSnapshotForContext()` and `validateMutation()`. I did not confirm a preview-only rule family that disappears from the authoritative world-apply path.

## Trust blockers

- The TM UI currently trusts `hasCurrentValidation && result.legal === true`, but world apply authority also depends on later invariant and post-state gates.
- The actual execute-trade decision engine is layered. There is no single surfaced function that the rest of the system can safely treat as “final apply truth.”
- `tradeManager.executeTrade()` remains an exported alternate trade surface that bypasses the mutation pipeline's later world-only gates if a future caller uses it.
- Hard-cap and roster helper overlap remains in the codebase, which is a future drift risk even though it is not a confirmed current bug.

## Recommended next ticket list

1. **TM validator truth alignment E2**: ✅ COMPLETE (2026-03-25). UI semantic downgrade implemented. Green preview now explicitly discloses that world-state checks (duplicate players, entitlement conflicts, exclusivity, post-state schema) run at apply time. Three UI surfaces updated: `TradeEditor.tsx` Apply button area, `TradeLegalChecker.tsx` legend, `ValidationDetailsPanel.tsx` section header. Preferred path (surfacing apply-only gates in preview) blocked by stop condition — 3 of 4 gates require Firestore, 4th requires full post-trade compute. See `return_packages/architect/ARCHITECT_TM_PREVIEW_APPLY_TRUTH_ALIGNMENT_E2.md`.
   **E2A hardening**: ✅ COMPLETE (2026-03-25). Added 23 focused tests (18 guardrail + 5 RTL component), tightened disclosure language to cover post-state cap/roster integrity on all three surfaces. See `return_packages/architect/ARCHITECT_TM_PREVIEW_APPLY_TRUTH_ALIGNMENT_E2A.md`.
2. **TM authority consolidation E3**: introduce a single surfaced execute-trade authority result that composes prevalidated trade context plus later invariant/post-state gates. This is the prerequisite for E2's preferred path (surfacing `validatePostStateCapLegality` in preview).
3. **TM alternate apply surface retirement E4**: deprecate or remove `tradeManager.executeTrade()` and the `architectCore` re-export.
4. **TM hard-cap SSOT consolidation E5**: retire `rules/validateHardCap.ts` and keep `hardCapValidation.ts` as the only hard-cap implementation.
5. **TM roster SSOT consolidation E6**: collapse inline / exported / legacy roster helpers into one clearly tiered authoritative roster path reused by preview and post-state validation.

## E2 execution status (2026-03-25)

| Finding | Status |
|---------|--------|
| Preview/apply trust gap: silent | **CLOSED** — disclosed at 3 UI surfaces |
| `validateMutationLeagueInvariants` apply-only | Apply-only, now disclosed |
| `validateMutationEntitlementInvariants` apply-only | Apply-only, now disclosed |
| `validateTradeApplyExclusivity` apply-only | Apply-only, now disclosed |
| `validatePostStateCapLegality` apply-only | Apply-only, now disclosed |
| UI green implies “guaranteed apply” | **FIXED** — now “CBA validator passed, world-state checks at apply time” |
| Preferred path (surface all 4 in preview) | Deferred to E3 prerequisite — stop condition invoked |
