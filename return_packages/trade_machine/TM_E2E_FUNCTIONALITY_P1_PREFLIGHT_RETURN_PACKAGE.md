# TM_E2E_FUNCTIONALITY_P1_PREFLIGHT_RETURN_PACKAGE

Date: 2026-02-28  
Mode: PREFLIGHT (Discovery-only, docs-only)  
Scope: Trade Machine base state (`worldId = null`) plus tightly-coupled validation/apply surfaces

## Executive Summary
This preflight found two functional STOP triggers in base-state Trade Machine: years-remaining display does not read extension/future-contract paths, and base-state apply uses a direct local mutation path that bypasses the authoritative apply-time trade gate. Sign-and-trade capture flow, eligibility gating, hard-cap-aware allowable incoming display, and pick entitlement authoring/routing paths are wired and traceable in current code.

- STOP Triggered: `#4 Years remaining display wrong`
- STOP Triggered: `#5 Trade execution gate mismatch/direct-write bypass`
- STOP Not Triggered: `#1, #2, #3, #6` based on current code-path evidence

## STOP Report (Table)
| STOP Condition | Status | Evidence (repo-relative paths) | Repro Steps | Risk |
|---|---|---|---|---|
| 1) Sign-and-Trade eligibility option appears for non-eligible players | Not Triggered | `src/features/architect/tradeMachine/TradePlayerRow.jsx:94-110,361-373`; `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts:358-443` | 1. Open Trade tab (`/gm/:teamId` with `activeTab='trade'`). 2. Open a player row action menu for an under-contract non-FA. 3. Verify S&T menu item is gated by `isSignAndTradeEligible(...).eligible` and not rendered otherwise. | Low if current gate remains intact; regression risk if menu bypasses `canOfferSignAndTrade`. |
| 2) Clicking S&T does not open contract entry flow | Not Triggered | `src/features/architect/tradeMachine/TradePlayerRow.jsx:365-367`; `src/features/architect/tradeMachine/TradeEditor.jsx:612-627`; `src/shared/components/EditContractModal.jsx:342-343,710-719,1129-1140`; `src/features/architect/hooks/useTradeMachine.js:495-527` | 1. Click `Sign-and-Trade` in player row menu. 2. Confirm `EditContractModal` opens in `signAndTrade` mode with destination + contract inputs. 3. Confirm state write requires valid contract + destination before `setPlayerTrade('signAndTrade', ...)`. | Medium product risk if modal wiring regresses; currently fail-closed. |
| 3) Hard cap not enforced in “Allowable Incoming” UI | Not Triggered | `src/features/architect/tradeMachine/TradeTeamCard.jsx:250-254,271-276,592-604`; `src/features/architect/hooks/useTradeMachineSnapshot.js:41-75`; `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js:85-117,139-152`; `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js:403-441,452-456`; `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js:99-145` | 1. Validate a trade where receiving team is hard-capped. 2. Inspect team card Allowable Incoming value. 3. Verify display uses `snapshot.displayAllowableIncoming` (effective hard-cap-limited value), not raw `allowableIncoming`. | Medium if future UI surfaces read local estimates instead of official snapshot. |
| 4) Years remaining display wrong (extensions/options miscounted) | **Triggered** | `src/features/architect/tradeMachine/TradePlayerRow.jsx:74-86`; `src/shared/utils/contracts/contractUtils.js:19-22`; `src/shared/components/EditContractModal.jsx:192-216`; `src/features/architect/utils/mutationPipeline.js:1818-1877` | 1. Use a player with extension years represented in `futureContract.salariesByYear`. 2. Observe Trade row years display source: `contract.yearsRemaining` -> fallback to FA-year delta. 3. Compare with extension-aware contract year assembly in edit modal (`base + futureContract`). | High UX/data-trust risk: trade authoring may show shorter/incorrect term horizon vs stored extension data. |
| 5) Trade execution gate mismatch / direct-write bypass | **Triggered** | `src/features/architect/tradeMachine/TradeEditor.jsx:245,502-543`; `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:614-727,730-780`; `src/features/architect/utils/mutationPipeline.js:450-446,523-540,622-651`; `src/features/architect/utils/tradeContext/tradeContext.js:614-649` | 1. In base state (`worldId=null`), validate trade and click Apply. 2. Trace callback to `applyTradeToCapSheet`. 3. Confirm world mode path runs authoritative `applyWorldMutation('executeTrade')`, but base-state branch mutates local cap sheet directly and does not rerun `validatePostTradeSnapshotForContext`/pipeline gate. | High drift risk: one “gate to trust” is not universal; base-state apply semantics can diverge from authoritative world apply path. |
| 6) Pick/Entitlement wizard blocks practical trade authoring or entitlement logic inconsistent | Not Triggered (with residual UX risk) | `src/features/architect/tradeMachine/TradeTeamCard.jsx:761-789`; `src/features/architect/tradeMachine/EntitlementPicksList.jsx:43-67,134-144,195-220`; `src/features/architect/tradeMachine/EntitlementPickRow.jsx:124-142,317-353`; `src/features/architect/admin/PickRightWizardModal.tsx:51-71,118-123,328-341`; `src/features/architect/hooks/useTradeMachine.js:651-675,682-700` | 1. Open Picks tab for a team card. 2. Trade entitlements via row menu and set explicit destination in 3+ team scenarios. 3. Open Modify to launch wizard and apply/save. 4. Confirm `entitlementsOut` carries `toTeamId` and routing logic maps incoming entitlements by destination. | Medium complexity risk: flow is functional but dense; usability may degrade with multi-step authoring. |

## Trade Machine UI Map
- Route
- `src/App.jsx:35` -> `/gm/:teamId` (`GmDashboardView`)
- Entry composition
- `src/features/architect/GMDashboard/GMDashboard.jsx:303-314` renders `TradeSection` when `activeTab === 'trade'`
- `src/features/architect/GMDashboard/sections/TradeSection.jsx:14-24` renders `TradeEditor`
- Key child components
- `src/features/architect/tradeMachine/TradeEditor.jsx` (root trade UI, validate/apply controls)
- `src/features/architect/tradeMachine/TradeTeamCard.jsx` (per-team card, players/picks/exceptions tabs)
- `src/features/architect/tradeMachine/TradePlayerRow.jsx` (player row menu including S&T action)
- `src/shared/components/EditContractModal.jsx` (S&T contract capture modal)
- `src/features/architect/tradeMachine/EntitlementPicksList.jsx` + `EntitlementPickRow.jsx` (pick-right authoring actions)
- `src/features/architect/admin/PickRightWizardModal.tsx` (entitlement editor modal)
- Key hooks/state sources
- `src/features/architect/hooks/useTradeMachine.js` (teams, sends, entitlementsOut, validation result, export payload)
- `src/features/architect/hooks/useTradeMachineSnapshot.js` + `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js` (canonical salary-matching snapshot projection for UI)
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (`applyTradeToCapSheet`, world vs base-state apply branches)

## Functional Completeness Checklist (Pass/Fail)
### A) Trade assembly (players in/out, multi-team, validations)
- ✅ Player routing in 3+ teams is explicit/fail-closed in validator path (`src/features/architect/utils/tradeMachine/engine/tradeValidator.js`, routing via trade context checks in `src/features/architect/utils/tradeContext/tradeContext.js:166-173,248-253`).
- ✅ Team assembly/export includes outgoing players + outgoing entitlements for downstream apply mapping (`src/features/architect/hooks/useTradeMachine.js:1020-1039`).
- ✅ UI apply action is hard-gated on current validated legal result (`src/features/architect/tradeMachine/TradeEditor.jsx:245,502-513`).

### B) Salary matching + allowable incoming (incl. hard cap behavior)
- ✅ Team card allowable incoming display uses hard-cap-aware snapshot value (`src/features/architect/tradeMachine/TradeTeamCard.jsx:252-254,602-604`).
- ✅ Canonical selector resolves `allowableIncoming`, `effectiveAllowableIncoming`, and display fallback consistently (`src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js:85-117,139-152`).
- ✅ Validator computes hard-cap ceiling override as `min(allowableIncoming, hardCapIncomingCeiling)` when hard-capped (`src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js:426-441`).

### C) Sign-and-Trade (eligibility, contract entry, outcomes)
- ✅ S&T menu option is eligibility-gated by canonical eligibility helper (`src/features/architect/tradeMachine/TradePlayerRow.jsx:94-110,361-373`; `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts:358-443`).
- ✅ Clicking S&T opens contract modal (not immediate send) and requires destination + valid payload to commit row state (`src/features/architect/tradeMachine/TradeEditor.jsx:612-627`; `src/shared/components/EditContractModal.jsx:342-343,710-719`; `src/features/architect/hooks/useTradeMachine.js:497-505`).
- ✅ Apply-time S&T preflight is fail-closed for destination/eligibility/contract payload before persistence (`src/features/architect/utils/tradeContext/tradeContext.js:145-212`).

### D) Picks / entitlement wizard (create/edit/preview/trade)
- ✅ Picks tab is entitlement-only and wired to select/route/edit actions (`src/features/architect/tradeMachine/TradeTeamCard.jsx:761-789`).
- ✅ 2-team auto-route and 3+ explicit destination behavior exists in state layer (`src/features/architect/hooks/useTradeMachine.js:655-675,682-700`).
- ✅ Wizard modal supports apply/save from both simple and advanced views (`src/features/architect/admin/PickRightWizardModal.tsx:118-123,328-341`).

### E) Trade execution (apply -> validate -> persist) in base state
- ❌ Base-state apply does not pass through authoritative mutation pipeline gate; local branch mutates cap sheet directly (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:730-780`).
- ✅ World-mode apply has a single authoritative read->compute->validate->persist path via `applyWorldMutation('executeTrade')` (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:718-727`; `src/features/architect/utils/mutationPipeline.js:445-446,523-540,622-651`).
- ❌ “One gate to trust” is not unified across base-state vs world-mode execution, creating parity drift risk (`src/features/architect/tradeMachine/TradeEditor.jsx:502-543`; `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:718-780`).

## Validator / Gate Parity Notes
- Authoritative gate (world mode): `applyWorldMutation('executeTrade')` in `src/features/architect/utils/mutationPipeline.js` with explicit `READ -> COMPUTE -> VALIDATE -> PERSIST` stages (`450-651`), where trade legality comes from pre-validated post-trade context (`validatePostTradeSnapshotForContext`) and `validateMutation` (`2232-2250`).
- Base-state gate (no-world): UI requires a current legal `validateTrade` result before enabling Apply (`TradeEditor.jsx:245,502-513`), but apply execution then uses local state mutation branch in `applyTradeToCapSheet` (`useArchitectActions.ts:730+`) rather than authoritative pipeline.
- Drift risk: there is no single universal apply gate across both operating modes. Any rule added at pipeline/apply-time can be absent from base-state local apply behavior until separately mirrored.

## Key Evidence Index
- `src/App.jsx:35`
- `src/features/architect/GMDashboard/GMDashboard.jsx:303-314`
- `src/features/architect/GMDashboard/sections/TradeSection.jsx:14-24`
- `src/features/architect/tradeMachine/TradeEditor.jsx:245,502-543,612-627`
- `src/features/architect/hooks/useTradeMachine.js:495-527,651-700,942-963,1020-1039`
- `src/features/architect/tradeMachine/TradePlayerRow.jsx:74-86,94-110,361-373`
- `src/shared/components/EditContractModal.jsx:192-216,342-343,710-719,1129-1140`
- `src/features/architect/tradeMachine/TradeTeamCard.jsx:250-254,271-276,592-604,761-789`
- `src/features/architect/hooks/useTradeMachineSnapshot.js:41-75`
- `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js:85-117,139-152`
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js:403-441,452-456`
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js:99-145`
- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts:358-443`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js:68-77,122-152,154-191`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:614-727,730-780`
- `src/features/architect/utils/mutationPipeline.js:445-446,450-457,523-540,622-651,2232-2250,2494-2501`
- `src/features/architect/utils/tradeContext/tradeContext.js:145-212,614-649`
- `src/features/architect/tradeMachine/EntitlementPicksList.jsx:43-67,134-144,195-220`
- `src/features/architect/tradeMachine/EntitlementPickRow.jsx:124-142,317-353`
- `src/features/architect/admin/PickRightWizardModal.tsx:51-71,118-123,328-341`
- `src/shared/utils/contracts/contractUtils.js:19-22`

## Commands Run + Results (Summarized)
- `rg -n "TRADE_MACHINE|Trade Machine" docs` -> Confirmed master doc candidates; using `docs/architect/TRADE_MACHINE_MASTER.md`.
- Route/entry tracing via `rg` + `nl -ba` on `src/App.jsx`, `GMDashboard.jsx`, `TradeSection.jsx` -> confirmed Trade entry chain to `TradeEditor`.
- STOP-area tracing via `rg` + `nl -ba` across Trade UI, hooks, validators, mutation pipeline, trade context, and entitlement wizard files -> produced line-cited evidence above.
- `git status --short` (pre) -> clean working tree before doc updates.
- No test commands run in this preflight (evidence resolved via static code-path tracing).

## Master Doc Deltas (What you added/updated)
- Added section to `docs/architect/TRADE_MACHINE_MASTER.md`:
- `## P1 Preflight Findings (2026-02-28)`
- Summary of additions:
- Recorded STOP outcome matrix for TM_E2E_FUNCTIONALITY_P1 in base state.
- Marked STOP #4 (years remaining display path mismatch risk) as Triggered.
- Marked STOP #5 (base-state direct apply bypasses authoritative pipeline gate) as Triggered.
- Documented that STOP #1/#2/#3/#6 are not triggered based on current trace evidence.
- Captured gate-parity conclusion: world mode has one authoritative apply gate, base state does not.
