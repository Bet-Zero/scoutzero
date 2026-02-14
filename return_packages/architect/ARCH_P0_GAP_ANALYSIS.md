# ARCH P0 Gap Analysis

## Executive Summary
- Ship-readiness against the vacuum-mode target is **NOT READY** due to three `SEV-1` gaps: stale trade-validation apply gating, optimistic/non-awaited trade persistence divergence, and base-only player sourcing that can desync world overlays from free-agency/trade displays.
- Core runtime validations are substantial (trade engine + mutation pipeline + contract-action validators), but a few wiring defects allow “looks legal” UX to diverge from authoritative state (`src/features/architect/tradeMachine/TradeEditor.jsx` `TradeEditor`, lines 373-410; `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` `applyTradeToCapSheet`, lines 742-775).
- Persistence is world-scoped (`architect_worlds/*`) with no audited writes to base team/player collections in Architect mutation paths; base-write `SEV-0` was not found (`src/features/architect/utils/mutationPipeline.js` `persistWorldMutation`, lines 2447-2606; base read paths in `src/features/architect/utils/teamLoader.js`, lines 79-88 and 216-236).
- Export capability exists for trade preview image download only; no cap-sheet/free-agency export wiring was found in Architect paths (`src/features/architect/tradeMachine/TradePreviewModal.jsx`, lines 31-35 and 70-81; `src/shared/hooks/useImageDownload.js`, lines 34-47).

## Vacuum-Mode Target Checklist (Pass/Fail)
| Capability | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Open Architect UI and select team/default team | `PASS` | Routes in `src/App.jsx` `App` lines 34-35; team select handoff in `src/features/architect/shared/LeagueView/LeagueView.jsx` `goToTeam` lines 55-57 and button lines 91-96 | Team selection path is explicit via `/gm` -> `/gm/:teamId`. |
| View roster + cap sheet data with internal consistency | `PARTIAL` | World/base team fallback chain: `src/features/architect/utils/teamLoader.js` `getTeam` lines 34-71; state load: `src/features/architect/GMDashboard/hooks/useArchitectState.ts` effect lines 414-430 | Team snapshot consistency is strong, but player source remains base-only in key views (`src/features/architect/hooks/useArchitectPlayerData.js` lines 1-30). |
| Propose trade + see legality/cap impact | `PARTIAL` | Trade validation pipeline in `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` `validateTrade` lines 565-632; UI validate/apply in `src/features/architect/tradeMachine/TradeEditor.jsx` lines 265-273 and 373-410 | Legality engine exists, but apply gate does not require fresh validation (`hasCurrentValidation`). |
| Sign/release/renounce actions + cap impacts | `PARTIAL` | Authoritative FA mutation path in `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` `handleSign` lines 821-842; pipeline validation in `src/features/architect/utils/mutationPipeline.js` `validateMutation` lines 2200-2364 | World-mode sign/waive/renounce validations exist. Dashboard modal has dead `onSign` prop and signNew/resign calls `onSave` local path. |
| View/manage draft assets and trade them | `PASS` | Entitlement list + selection/destination in `src/features/architect/tradeMachine/EntitlementPicksList.jsx` lines 42-191; transfer persist in `src/features/architect/utils/mutationPipeline.js` lines 1359-1440 and 2510-2525 | Draft assets are entitlement-first and tradeable. |
| Save/load plan without corrupting base data | `PASS` | World selection + restore in `src/features/architect/GMDashboard/components/WorldSelector.jsx` lines 30-31 and 105-144; world writes in `src/features/architect/utils/mutationPipeline.js` lines 2458-2589 | “Team plan equivalent” is `architect_worlds/*` (world snapshots). No base write path found in audited mutations. |
| Export/share if exists | `PARTIAL` | Trade export modal/wiring in `src/features/architect/tradeMachine/TradePreviewModal.jsx` lines 31-35 and 75-81 | Trade PNG export exists; no evidence of cap-sheet/FA export wiring. Runtime browser verification is `UNKNOWN` in this discovery pass. |

## Validation Matrix
| Rule | Implemented? (Y/N/Partial) | Where enforced (file + function) | UI behavior if violated | Known gaps / edge cases noted in code comments/tests |
| --- | --- | --- | --- | --- |
| Salary matching (under cap, first apron, second apron, TPE-adjusted) | `Y` | `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js` `validateSalaryMatching` lines 47-437; invoked by `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` lines 592-595 | Trade `Apply Trade` disabled when `result.legal` false (`src/features/architect/tradeMachine/TradeEditor.jsx`, lines 405-410) | Freshness gate missing at apply time (uses `result.legal` but not `hasCurrentValidation`). |
| Hard cap (first/second apron) | `Y` | `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js` `validateHardCap` lines 15-144; invoked in `tradeValidator.js` line 596 | Violations surfaced in validation result; apply blocked on illegal result (`TradeEditor.jsx` lines 374-379, 405-410) | Cap settings fallback warnings indicate potential inaccuracy if settings missing (hardCapValidation lines 63-75). |
| Stepien + frozen 7-year-out first restriction | `Y` | `src/features/architect/utils/tradeMachine/rules/validateStepien.js` lines 241-304 | Violations returned in trade result, reflected in validator panel and apply block | Uses default second-apron fallback when cap settings absent (`validateStepien.js` line 277). |
| Sign-and-trade trade rules + receiving-team hard cap | `Y` | `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js` lines 33-121; invoked by `tradeValidator.js` line 603 | Trade legality fails -> apply blocked | Requires `currentYear` + `firstApron`; explicit violations if context missing (lines 106-117). |
| Trade exception usage (TPE limits, second apron prior-year TPE block) | `Y` | `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js` lines 14-138; invoked by `tradeValidator.js` lines 599-602 | Included in trade violations and apply block | Aggregation with outgoing salary flagged in same validator; overlap risk with other rules mitigated by comments. |
| Aggregation restrictions (second apron) | `Y` | `src/features/architect/utils/tradeMachine/rules/validateAggregation.js` lines 16-99; invoked by `tradeValidator.js` line 606 | Trade violations shown; apply blocked | Rule intentionally excludes salary-mismatch duplication (line 86). |
| Consent / NTC / Bird veto | `Y` | `src/features/architect/utils/tradeMachine/rules/validateConsent.js` lines 10-84; invoked by `tradeValidator.js` line 604 | Violations contribute to illegal trade | Multi-team destination inference can be indirect (`validateConsent.js` lines 22-43). |
| Reacquisition / cash restrictions | `Y` | `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js` `validateReacquisition` + `validateCash` (imported in `tradeValidator.js` lines 13 and 17) | Trade violations block apply | Detailed edge-case coverage not fully audited here (`UNKNOWN` depth). |
| Non-trade signing legality (exception eligibility, hard blocks, cap hold transitions, RFA flow) | `Y` | `src/features/architect/utils/capLegalityValidation.js` `validateSigning` lines 2199-2335 and `validateExceptionEligibility` lines 2029-2182; enforced in `mutationPipeline.js` `validateMutation` lines 2200-2214 | Modal confirm disabled on illegal UI validation (`src/shared/components/EditContractModal.jsx` lines 337-344); authoritative world persistence blocked when invalid (`mutationPipeline.js` lines 522-540) | UI validation (`useCapValidation`) is not identical to pipeline validation -> divergence risk. |
| Waive / stretch legality | `Y` | `capLegalityValidation.js` `validateWaive` lines 3167-3261; wired in `mutationPipeline.js` lines 2217-2231 | Modal warnings/errors + world persistence block on violations | Stretch timing warning depends on season boundary map availability (lines 3235-3253). |
| Extension legality | `Y` | `capLegalityValidation.js` `validateExtension` lines 3273-3373; wired in `mutationPipeline.js` lines 2234-2247 | Modal and pipeline enforcement | If Salary Engine terms unavailable, baseline rules used (lines 3326-3338). |
| Option decision timing/state invariants | `Y` | `capLegalityValidation.js` `validateOptionDecision` lines 3425-3475+; wired in `mutationPipeline.js` lines 2249-2273 | Modal blocks invalid timing; pipeline blocks persist | None critical identified in this pass. |
| Renounce rights | `Y` | `capLegalityValidation.js` `validateRenounceRights` lines 3758-3805; wired in `mutationPipeline.js` lines 2353-2364 | Pipeline blocks only on structural violations (typically permissive action with warnings) | Intended permissive behavior. |
| Offer sheet resolution (match/decline/finalize actor/status checks) | `Y` | `capLegalityValidation.js` `validateOfferSheetResolution` lines 3819-3903; wired in `mutationPipeline.js` lines 2293-2329 | Offer-sheet actions disabled without world (`FreeAgencySection.jsx` lines 37-63); invalid world actions blocked in pipeline | Duplicate switch branches/no-op fallback in pipeline validation switch increase maintenance risk (`mutationPipeline.js` lines 2275-2351). |
| Can invalid states still be persisted? | `Partial` | `applyWorldMutation` blocks invalid validations before persist (`mutationPipeline.js` lines 522-540) | N/A | Stale-trade-validation apply path can still submit with non-current validation state (`TradeEditor.jsx` lines 374-405 vs freshness state lines 55-57). |

## Prioritized Gaps

### SEV-0 / SEV-1
1. **G-01 (`SEV-1`) Stale trade validation can still be applied**
- User-visible symptom: user validates a trade, changes assets, and can still click `Apply Trade` using stale legality.
- Root cause (`file + symbol`): `src/features/architect/tradeMachine/TradeEditor.jsx` `TradeEditor` apply handler gates only on `result.legal` (`lines 373-379, 405-410`) while freshness state `hasCurrentValidation` exists but is not enforced (`lines 55-57, 295-299`); freshness computation is in `src/features/architect/hooks/useTradeMachine.js` `hasCurrentValidation` (`lines 302-313`).
- Minimum fix scope: require `hasCurrentValidation` for apply button enabled state and click handler path.
- Dependencies/touchpoints: `TradeEditor`, `useTradeMachine`, validation header/details panel props.
- Acceptance test: validate trade, mutate entitlement destination/player routing, verify apply is blocked until re-validate.
- Ship class: `must ship`.

2. **G-02 (`SEV-1`) Trade apply updates local state before authoritative persistence, with no rollback**
- User-visible symptom: UI can show trade-applied roster/cap even when mutation persistence fails; reload reverts state.
- Root cause (`file + symbol`): `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` `applyTradeToCapSheet` calls `setTeamCapSheet(updated)` before persistence (`line 742`) and calls `persistMutation('executeTrade', { teams })` without awaiting/rollback (`line 775`).
- Minimum fix scope: move world-mode trade apply to authoritative mutation result path (or await and rollback on failure).
- Dependencies/touchpoints: `applyTradeToCapSheet`, `persistMutation`, world mutation result sync.
- Acceptance test: force `applyWorldMutation` failure (mock rejection) and verify UI remains unchanged + explicit failure toast.
- Ship class: `must ship`.

3. **G-03 (`SEV-1`) Player source is base-centric, causing world-overlay drift in free-agency/trade displays**
- User-visible symptom: in world mode, roster/cap snapshot may reflect overrides while free-agent/trade player data reflects base records.
- Root cause (`file + symbol`): `src/features/architect/hooks/useArchitectPlayerData.js` `useArchitectPlayerData` subscribes to base collection only (`lines 1-30`), backed by `src/features/architect/utils/subscribeArchitectPlayerData.ts` (`lines 73-121`) and `loadArchitectBasePlayer.ts` (`lines 48-80`), while team/player overlay model is world-aware in `src/features/architect/utils/teamLoader.js` `getTeam/getPlayer` (`lines 34-71, 211-257`).
- Minimum fix scope: introduce world-aware player selector for FA/trade contexts; use world overrides where present.
- Dependencies/touchpoints: `useArchitectState` free-agent derivation, `useTradeMachine`, player lookup helpers.
- Acceptance test: create world player override for contract/team status and verify FA list + trade card reflect override consistently.
- Ship class: `must ship`.

### SEV-2
1. **G-04 (`SEV-2`) Dashboard contract modal has dead `onSign` wiring and sign actions flow through local-only `onSave` path**
- User-visible symptom: sign/re-sign actions from dashboard modal can appear committed but do not follow authoritative FA mutation pipeline.
- Root cause (`file + symbol`): `src/features/architect/GMDashboard/GMDashboard.jsx` passes `onSign={actions.handleSign}` to modal (`line 430`), but `src/shared/components/EditContractModal.jsx` props do not include `onSign` (`lines 119-140`) and sign actions call `onSave` (`lines 664-693`); dashboard `onSave` is `handleSaveContract`, explicitly local-preview-oriented (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts`, lines 1428-1433).
- Minimum fix scope: align modal contract-action callbacks so sign/re-sign paths route to authoritative handlers where intended.
- Dependencies/touchpoints: `GMDashboard`, `EditContractModal`, `useArchitectActions`.
- Acceptance test: execute `resign` via dashboard modal in world mode and verify `applyWorldMutation('signFreeAgent', ...)` is called and survives reload.
- Ship class: `must ship`.

2. **G-05 (`SEV-2`) Validation switch has duplicate `storeOfferSheet` branches and redundant no-op fallback cases**
- User-visible symptom: none immediate, but validation logic is ambiguous and brittle.
- Root cause (`file + symbol`): `src/features/architect/utils/mutationPipeline.js` `validateMutation` duplicate `case 'storeOfferSheet'` branches (`lines 2275-2291` and `2331-2345`) plus redundant fallthrough returning `{ valid: true }` for already-handled cases (`lines 2347-2351`).
- Minimum fix scope: collapse duplicate switch cases to single authoritative branches.
- Dependencies/touchpoints: pipeline validator switch.
- Acceptance test: run offer-sheet mutation tests and assert only one switch branch per mutation type.
- Ship class: `must ship`.

3. **G-06 (`SEV-2`) Typecheck gate fails with Architect source error in entitlement resolver**
- User-visible symptom: CI/typecheck workflows fail; release confidence reduced.
- Root cause (`file + symbol`): `src/features/architect/utils/entitlements/entitlementResolver.ts` uses spread tuple call pattern flagged by TS (`line 97`, `collection(db, ...pathSegments)`) and additional typed test failures from current repo run.
- Minimum fix scope: fix tuple typing in resolver and align failing test typings called out in typecheck logs.
- Dependencies/touchpoints: entitlement resolver + typed tests.
- Acceptance test: `npm run typecheck` exits `0`.
- Ship class: `must ship` if typecheck is a release gate; otherwise `post-ship`.

### SEV-3
1. **G-07 (`SEV-3`) Active-tab type union is stale relative to runtime tab ids**
- User-visible symptom: potential TS drift/confusion in maintenance.
- Root cause (`file + symbol`): `useArchitectState` type includes `'capTable'/'freeAgency'` (`src/features/architect/GMDashboard/hooks/useArchitectState.ts`, lines 143-149) while runtime uses `'cap'/'capfull'/'fa'` (`src/features/architect/GMDashboard/GMDashboard.jsx`, lines 211-243).
- Minimum fix scope: synchronize union type with runtime IDs.
- Dependencies/touchpoints: `useArchitectState`, `GMDashboard`.
- Acceptance test: tab IDs are fully represented in TS types; no mismatched literals.
- Ship class: `post-ship`.

2. **G-08 (`SEV-3`) TradeEditor duplicates incoming-asset derivation and ignores hook-provided value**
- User-visible symptom: none immediate; maintenance drift risk.
- Root cause (`file + symbol`): `hookIncomingAssets` is destructured (`src/features/architect/tradeMachine/TradeEditor.jsx`, line 50) but local `incomingAssets` is recomputed (`lines 96-125`) and consumed (`lines 347-350, 431`).
- Minimum fix scope: use one source of truth (hook output).
- Dependencies/touchpoints: `TradeEditor`, `useTradeMachine`.
- Acceptance test: remove local recompute and verify parity in team-card incoming assets.
- Ship class: `post-ship`.

3. **G-09 (`SEV-3`) Hook-level preview state is dead relative to component-local state**
- User-visible symptom: none immediate; dead state surface.
- Root cause (`file + symbol`): `useTradeMachine` returns `previewOpen` (`src/features/architect/hooks/useTradeMachine.js`, lines 242 and 1124-1126) while `TradeEditor` uses separate local `previewOpen` (`src/features/architect/tradeMachine/TradeEditor.jsx`, line 74).
- Minimum fix scope: remove unused hook state or wire it consistently.
- Dependencies/touchpoints: `useTradeMachine`, `TradeEditor`.
- Acceptance test: single preview-open state source and unchanged modal behavior.
- Ship class: `post-ship`.

4. **G-10 (`SEV-3`) Legacy helper policy drift: file claims read-only but contains write helper**
- User-visible symptom: latent accidental-write risk.
- Root cause (`file + symbol`): `src/features/architect/utils/firebaseTeamPlanHelpers.js` header claims read-only (`lines 10-12`) but includes `saveFreeAgents` write (`lines 239-247`).
- Minimum fix scope: deprecate/remove writer or document explicit non-Architect usage.
- Dependencies/touchpoints: helper module and any out-of-tree scripts.
- Acceptance test: grep-based guard confirms no Architect runtime path can call legacy writer.
- Ship class: `post-ship`.

5. **G-11 (`SEV-3`) Export coverage limited to trade preview; other exports not wired**
- User-visible symptom: no cap-sheet/free-agency export option.
- Root cause (`file + symbol`): export hook usage appears only in trade modal (`src/features/architect/tradeMachine/TradePreviewModal.jsx`, lines 31-35 and 75-81; `src/shared/hooks/useImageDownload.js`, lines 34-47).
- Minimum fix scope: either document “trade-only export” as intentional or add explicit additional export surfaces.
- Dependencies/touchpoints: UI product scope decision, export components.
- Acceptance test: user can discover supported export(s) and complete download path per documented scope.
- Ship class: `post-ship`.

## Dependency Map
| Gap ID | Primary modules | Secondary modules | Cross-cutting risks |
| --- | --- | --- | --- |
| G-01 | `TradeEditor.jsx`, `useTradeMachine.js` | `ValidationStateHeader`, `ValidationDetailsPanel` | Legal/apply correctness |
| G-02 | `useArchitectActions.ts` | `mutationPipeline.js` | UI-state vs persisted-state divergence |
| G-03 | `useArchitectPlayerData.js`, `subscribeArchitectPlayerData.ts` | `useArchitectState.ts`, `teamLoader.js` | Data truth doctrine consistency |
| G-04 | `GMDashboard.jsx`, `EditContractModal.jsx` | `useArchitectActions.ts` | Free-agency commit path correctness |
| G-05 | `mutationPipeline.js` | offer-sheet action callers | Validator maintainability/regression risk |
| G-06 | `entitlementResolver.ts` | typed tests | CI/type gate stability |
| G-07 | `useArchitectState.ts` | `GMDashboard.jsx` | Type drift |
| G-08 | `TradeEditor.jsx` | `useTradeMachine.js` | Silent drift over time |
| G-09 | `useTradeMachine.js` | `TradeEditor.jsx` | Dead state and future confusion |
| G-10 | `firebaseTeamPlanHelpers.js` | docs/policy | Accidental write path |
| G-11 | `TradePreviewModal.jsx`, `useImageDownload.js` | product docs | Scope ambiguity |

## Must-Ship vs Post-Ship Split
- `must ship`: `G-01`, `G-02`, `G-03`, `G-04`, `G-05`, `G-06*`
- `post-ship`: `G-07`, `G-08`, `G-09`, `G-10`, `G-11`
- `G-06*` note: if typecheck is part of release gate, treat as must-ship; if not, defer with explicit waiver.

## Acceptance Tests per Gap
1. `G-01`: validate trade, edit outgoing entitlements, confirm `Apply Trade` is disabled until re-validation.
2. `G-02`: mock `applyWorldMutation` failure during apply, confirm no local roster/cap mutation persists and user sees deterministic failure.
3. `G-03`: set world player override (contract/team) and verify FA pool + trade cards match world data (not base fallback).
4. `G-04`: run dashboard modal `resign` path in world mode; verify mutation event in `architect_worlds/{worldId}/events/*` and state survives reload.
5. `G-05`: run offer-sheet mutation tests with branch coverage to prove single authoritative validation branch per action.
6. `G-06`: run `npm run typecheck` and ensure zero errors, including `entitlementResolver.ts` spread call.
7. `G-07`: compile TS with strict literals for all tab IDs used at runtime.
8. `G-08`: remove duplicate incoming-assets compute; compare rendered incoming players/entitlements before and after.
9. `G-09`: unify preview-open state source; verify modal open/close unchanged.
10. `G-10`: enforce CI grep guard for legacy helper write-call absence in Architect runtime.
11. `G-11`: verify documented export matrix and run one successful trade PNG capture.

## Unknowns and Risk Notes
- `UNKNOWN`: browser-level visual correctness of trade export image (font loading/canvas capture) in live UI; this pass did not run an interactive browser session.
- `UNKNOWN`: product contract on naming (`/teamPlans` vs worlds-only equivalent). Code indicates worlds-only for Architect (`src/features/architect/utils/mutationPipeline.js` header line 8), but legacy docs still reference `teamPlans` in multiple places.
- `UNKNOWN`: whether external scripts (outside in-repo call-sites) still depend on `saveFreeAgents` writer.
