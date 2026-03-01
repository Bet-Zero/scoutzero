# TRADE_MACHINE_R2_LOCAL — REVIEW RETURN PACKAGE
**Date:** 2026-03-01  
**Status:** FAIL (10 PASS / 1 FAIL / 1 BLOCKED)

## Executive Summary
- Pass count / Fail count / Blocked count: **10 / 1 / 1**
- Top 5 critical failures (if any):
  - **Critical:** Hard-cap-aware allowable incoming display/use is not reliably apron-limited in the reviewed runtime path (NYK near-second-apron case).

## A) Scope Inventory
- UI surfaces list
  - Route entry:
    - Architect league view (`/gm`) -> open team -> GM Dashboard route (example: `/gm/LAL?season=2026`) -> **Trade Machine** tab.
  - Top-level TM controls:
    - `Validate Trade`
    - `Reset Trade`
    - `Add Team`
    - `Apply Trade`
    - `Clear session pick changes` (vacuum/session-overlay only, conditional render)
  - Team card surfaces:
    - Tabs: `Players`, `Picks`, `Exceptions`
    - Outgoing/incoming expandable salary sections
    - Allowable incoming + rule label + hard-cap-limited tag (when applicable)
    - Incoming absorption controls: `Matching`, `TPE`, `FA Exception`
    - TPE picker (`Select TPE...`) and FA exception bucket picker
    - Team remove button (`✕`)
  - Menus/modals/panels:
    - Player row menu (`Trade to ...`, `Undo Trade`, `Modify Contract`, `View Profile`, conditional `Sign-and-Trade`)
    - Entitlement row menu (`Trade to ...`, `Undo Trade`, `Modify`, `View Details`; vacuum-only revert/delete actions)
    - Validation panels: `Validation Results` + `Development Tools`
    - `TradePreviewModal` with `Download` export action
    - `PickRightWizardModal` (entitlement create/edit)
    - `EditContractModal` (includes TM sign-and-trade flow when eligible)
  - Explicitly absent in current TM runtime/code:
    - No `Save plan` UI
    - No `Load plan` UI
    - No separate “Export plan JSON” action (export is image download via preview modal)
- Data surfaces list
  - Firestore reads:
    - Base collections: `architect_baseTeams`, `architect_basePlayers`, `architect_baseEntitlements`, `architect_basePickRules`
    - World collections (when `worldId` is active): `architect_worlds/{worldId}`, plus subcollections:
      - `teams/{teamCode}`
      - `teams/{teamCode}/players/{playerId}`
      - `entitlements/{entitlementId}`
      - `events/{eventId}`
  - Firestore writes:
    - Trade apply (world mode): mutation pipeline persists under `architect_worlds/...` only
    - Entitlement editor (world mode): writes under `architect_worlds/{worldId}/entitlements/...` with optional team-attach mutation
  - localStorage/session overlays:
    - `vacuum_entitlement_overlay`
    - `pickrightdraft:{worldId}:{entitlementId|new}`
    - `hz.currentSeasonEndYear`
    - local cap audit keys (`architect_base_capAuditEvents_v1`, `architect_world_preview_capAuditEvents_v1`)
  - Hooks/utilities used:
    - `useTradeMachine`, `validateTrade`, `getTeamSnapshot`, `getOfficialSalaryMatchingSnapshot`
    - `useArchitectActions.applyTradeToCapSheet`
    - `applyWorldMutation`, `computeWorldMutation`, `persistWorldMutation`
    - `resolveEntitlementsForTeam`, `saveEntitlementFromFormState`, `entitlementWriter`
  - Base vs world boundaries:
    - Base mode: compute + local state/audit only; no Firestore world mutation commit
    - World mode: persisted mutation pipeline writes to `architect_worlds/...`

## B) PASS/FAIL Checklist (1–12)
### 1) UI Wiring (No dead UI)
- Status: **PASS**
- Evidence:
  - Every audited top-level TM control executed visible behavior:
    - `Validate Trade` opens preview and updates validation state.
    - `Reset Trade` clears selected outgoing/incoming assets.
    - `Add Team` adds new trade slot (up to configured cap).
    - `Apply Trade` is disabled unless current validation is legal.
    - `Clear session pick changes` clears vacuum overlay edits when present.
  - Team-card controls and menus were reachable and active in runtime walkthrough.
  - Code pointers:
    - `src/features/architect/tradeMachine/TradeEditor.jsx:374-397, 512-563`
    - `src/features/architect/tradeMachine/TradeTeamCard.jsx:694-922`
    - `src/features/architect/tradeMachine/TradePlayerRow.jsx:334-403`

### 2) Trade Construction Logic Works
- Status: **PASS**
- Evidence:
  - Mandatory 3-team runtime case executed:
    1. Added teams to 3 slots.
    2. Assigned teams: `LAL`, `BOS`, `MIA`.
    3. Traded player from LAL to BOS via row menu.
  - Observed live updates after change:
    - LAL outgoing salary changed to `$52.6M` (LeBron case).
    - BOS incoming salary changed to `$52.6M`.
    - Player moved to BOS incoming list.
  - Entitlement add/remove path exercised:
    - Created session-only entitlement in Picks tab.
    - Cleared via `Clear session pick changes`; row removed.
  - Undo/reset path exercised:
    - `Undo Trade` available for included/incoming assets.
    - `Reset Trade` cleared trade draft selections.
  - Code pointers:
    - `src/features/architect/hooks/useTradeMachine.js:268-310, 462-702, 843-894, 1044-1062`
    - `src/features/architect/tradeMachine/TradeEditor.jsx:447-495`

### 3) Validation Engine Is Actually Enforced
- Status: **PASS**
- Evidence:
  - Validation trigger is explicit click (not silent auto-run).
  - Illegal trade runtime produced visible blocking reason:
    - `TRADE FAILED`
    - `Trade blocked: Trade exception ... is expired`
  - Apply gating confirmed:
    - `Apply Trade` disabled unless current draft has legal current validation.
  - Code pointers:
    - `src/features/architect/hooks/useTradeMachine.js:896-1018`
    - `src/features/architect/tradeMachine/TradeEditor.jsx:514-524, 555-563, 565-568`
    - Validator entrypoint:
      - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:576-900`

### 4) Salary + Cap Math Is Correctly Connected
- Status: **FAIL**
- Evidence:
  - Runtime hard-cap explicit check scenario (NYK near second apron):
    - Pre-trade NYK card showed `2ND APRON: -$1.1M`.
    - After trading out `$53.1M`, card showed `Allowable Incoming: $53.1M (Second Apron: 100% matching)`.
    - This display does not reflect remaining apron room reduction expected in a hard-cap-limited path.
  - Code risk path indicates hard-cap type flattening hazard:
    - Base hydration maps hard cap to boolean:
      - `src/features/architect/utils/firebaseTeamPlanHelpers.js:181-183`
    - Boolean hard-cap resolves to `FirstApron` by default:
      - `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js:59-65`
    - Salary-matching ceiling branch depends on hard-cap type:
      - `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js:415-437`
    - UI displays snapshot-derived `displayAllowableIncoming`:
      - `src/features/architect/tradeMachine/TradeTeamCard.jsx:252-254, 595-662`
  - Fail reason:
    - In audited runtime, allowable incoming display/use did not prove reliable hard-cap ceiling enforcement for near-apron state.

### 5) Sign-and-Trade (Explicit)
- Status: **BLOCKED**
- Evidence:
  - Runtime walkthrough did not surface an eligible player showing `Sign-and-Trade` action in current emulator data for tested teams.
  - UI and validator wiring exists:
    - Player row action gate:
      - `src/features/architect/tradeMachine/TradePlayerRow.jsx:353-365`
    - TM flow opens contract modal:
      - `src/features/architect/tradeMachine/TradeEditor.jsx:480-487, 623-638`
    - Eligibility + contract payload validation:
      - `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts`
      - `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js:41-223`
  - Block reason:
    - Dataset did not provide a verifiable eligible S&T runtime case during this session.

### 6) Contract Term/Years Remaining Display Consistency
- Status: **PASS**
- Evidence:
  - Display uses extension-aware years logic:
    - `getContractYearsForDisplay` merges `contract` + `futureContract.salariesByYear`.
    - `getYearsRemainingDisplay` counts rows from merged set.
  - Dedicated test exists and passes:
    - `src/tests/architect/tradePlayerRow.yearsRemainingDisplay.test.tsx`
  - Code pointers:
    - `src/features/architect/tradeMachine/TradePlayerRow.jsx:74`
    - `src/features/architect/utils/contractUtils.js:94-158`

### 7) Picks / Entitlements / Wizard (if present)
- Status: **PASS**
- Evidence:
  - Entitlement list, row actions, and wizard are reachable and operational.
  - Runtime: created session entitlement, observed `Session-only` row, then cleared session overlay successfully.
  - Routing/exclusivity validations are present in validator path.
  - Code pointers:
    - `src/features/architect/tradeMachine/EntitlementPicksList.jsx`
    - `src/features/architect/tradeMachine/EntitlementPickRow.jsx`
    - `src/features/architect/tradeMachine/TradeEditor.jsx:597-621`
    - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:730-767, 891-900`

### 8) Write Paths & Safety Gates (MUST MAP ALL)
- Status: **PASS**
- Evidence:
  - Mapped write-capable TM paths:
    - Apply trade (world mode):
      - `TradeEditor Apply` -> `onApplyTrade` -> `applyTradeToCapSheet` -> `runAuthoritativeFAMutation('executeTrade')` -> `applyWorldMutation` -> `persistWorldMutation`.
    - Apply trade (base mode):
      - `computeWorldMutation` + local team state update + local cap-audit log; no world Firestore commit.
    - Entitlement create/edit (world mode):
      - `PickRightWizardModal` -> `saveEntitlementFromFormState` -> `writeWorldEntitlement` / `writeWorldEntitlementAndAttachToTeamAtomic`.
    - Entitlement create/edit (vacuum mode):
      - overlay/localStorage-only mutations.
    - Export:
      - preview `Download` image only (no Firestore writes).
  - Persist destinations verified:
    - `architect_worlds/{worldId}/teams/{teamCode}`
    - `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`
    - `architect_worlds/{worldId}/entitlements/{entitlementId}`
    - `architect_worlds/{worldId}/events/{eventId}`
    - `architect_worlds/{worldId}` metadata patch
  - Gates verified:
    - world mode requires `worldId` + `userId`
    - validation/legal gating before apply
    - mutation pipeline fail-closed validation + invariants
  - Code pointers:
    - `src/features/architect/tradeMachine/TradeEditor.jsx:512-553`
    - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:798-859, 1083-1356`
    - `src/features/architect/utils/mutationPipeline.js:632-753, 2823-3000`
    - `src/features/architect/admin/saveEntitlementFromFormState.ts:263-320`
    - `src/features/architect/utils/entitlements/entitlementWriter.ts:13-17`

### 9) Forbidden Writes Rule (CRITICAL)
- Status: **PASS**
- Evidence:
  - Search found no active TM write path to root `/teams/`.
  - Search showed legacy `teamPlans` references only in comments/history notes; active persistence is worlds-scoped.
  - Architect mutation persistence writes only under `architect_worlds/...`.
  - Code/search evidence:
    - `src/features/architect/utils/mutationPipeline.js:2813-2997`
    - grep checks run:
      - `rg "doc\\(db,\\s*['\\\"]teams['\\\"]|collection\\(db,\\s*['\\\"]teams['\\\"]|/teams/|teamPlans" src/features/architect`

### 10) Error Handling / Edge Cases
- Status: **PASS**
- Evidence:
  - Edge case 1: Invalid one-way trade validation
    - outcome: visible failure reason, no silent failure.
  - Edge case 2: Apply without legal current validation
    - outcome: disabled button + guard message path (`Re-validate trade before applying` / blocked alert).
  - Edge case 3: Session entitlement overlay cleanup
    - outcome: `Clear session pick changes` removed session edits cleanly.
  - Additional guards present:
    - init failure banner for TM init errors.
    - not-validated callout in details panel.
  - Code pointers:
    - `src/features/architect/tradeMachine/TradeEditor.jsx:410-420, 514-524, 547-551`
    - `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx:37-50`

### 11) Performance Footguns
- Status: **PASS** (residual risk noted)
- Evidence:
  - No runtime infinite render loop or repeated-listener symptom observed in walkthrough.
  - Heavy calculations are memoized (`incomingAssets`, salary derivations, grouped lists).
  - Residual risk note:
    - `refreshEntitlements()` re-fetches per active team and could become expensive with max team slots + repeated edits.
  - Code pointers:
    - `src/features/architect/hooks/useTradeMachine.js:268-310, 1157-1185`
    - `src/features/architect/tradeMachine/TradeTeamCard.jsx` (extensive `useMemo` usage)

### 12) Tests
- Status: **PASS**
- Evidence:
  - TM-relevant suites executed:
    - `npm run test:trade -- --reporter=dot` -> PASS
    - `npm run test:architect -- --reporter=dot` -> PASS
  - Existing TM-related test coverage includes salary matching, hard-cap, routing, entitlements, apply-gates, and S&T guardrails across:
    - `tests/trade/*`
    - `src/tests/tradeMachine/*`
    - `src/tests/architect/*` (trade-related files)
  - No global-suite dependency required for this scoped review.

## C) Evidence Appendix
- Files changed
  - `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
  - `return_packages/architect_reviews/TRADE_MACHINE_R2_LOCAL_REVIEW_RETURN_PACKAGE.md`
- Command outputs (validate/build/tests)
  - `npm run validate:project`
    - Exit: 0 (PASS)
  - `npm run build`
    - Exit: 0 (PASS, warnings only; no build stop)
  - `npm run dev`
    - First attempt (sandbox): bind failed on `::1:5173` (`EPERM`)
    - Escalated run: server up on `http://localhost:5174`
  - `npm run test:trade -- --reporter=dot`
    - Exit: 0
    - Summary: 58 files, 529 tests; 525 passed, 1 skipped, 3 todo
  - `npm run test:architect -- --reporter=dot`
    - Exit: 0
    - Summary: 156 files, 2408 tests; 2404 passed, 1 skipped, 3 todo
- Commands intentionally skipped (and why)
  - `npm run test:full` / raw `vitest` commands
    - Skipped because full suite was not explicitly requested with `RUN FULL SUITE`, and repo policy blocks full-suite-by-default.
  - `npm run architect:review:up`
    - Skipped per prompt non-negotiable rule (do not run review-mode startup/seeding flow).
  - `npm run architect:review:seed` and other seeding scripts
    - Skipped per prompt requirement to use existing emulator dataset only.
- Key logs/snippets (short, relevant)
  - Browser/runtime:
    - `🔥 Firebase Emulators Connected`
    - `Project: scoutzero-bf1ae`
  - Validation failure surface:
    - `TRADE FAILED`
    - `Trade blocked: Trade exception ... is expired`
  - Hard-cap explicit runtime notes:
    - NYK pre-trade: `2ND APRON: -$1.1M`
    - NYK after outgoing $53.1M: `Allowable Incoming: $53.1M`

## D) Fix Punchlist (NO FIXES IMPLEMENTED)
- Severity: **Critical**
  - Issue: Hard-cap-limited allowable incoming display/use not reliably apron-limited in reviewed path.
  - File paths + functions/components:
    - `src/features/architect/utils/firebaseTeamPlanHelpers.js` (`hydrateBaseTeam` hard-cap flattening)
    - `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js` (`getHardCapStatus`)
    - `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js` (hard-cap ceiling branch)
    - `src/features/architect/tradeMachine/TradeTeamCard.jsx` (display of allowable incoming)
  - Exact acceptance criteria:
    - For a hard-capped team, UI-displayed allowable incoming must equal `min(salary-matching ceiling, hard-cap ceiling)` and never permit a post-trade apron breach.
    - Hard-cap type (`FirstApron` vs `SecondApron`) must survive data hydration without boolean flattening ambiguity.
    - Add/adjust guardrail tests proving this in both base and world modes.

- Severity: **High**
  - Issue: S&T runtime eligibility flow could not be fully verified with current dataset (BLOCKED coverage gap).
  - File paths + functions/components:
    - `src/features/architect/tradeMachine/TradePlayerRow.jsx` (menu visibility gate)
    - `src/features/architect/tradeMachine/TradeEditor.jsx` (TM S&T modal flow)
    - `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts`
    - `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
  - Exact acceptance criteria:
    - Emulator dataset includes at least one clearly S&T-eligible and one ineligible player for direct runtime verification.
    - Eligible player path must show `Sign-and-Trade`, open contract modal, require valid contract payload, and validate/apply correctly.
    - Ineligible player path must not expose S&T action or must hard-block with visible reason.

## E) Closure Criteria
- What must be true to mark TM `REVIEW_COMPLETE`:
  - All checklist items (1–12) have explicit PASS/FAIL/BLOCKED statuses with evidence and code pointers.
  - UI and data surface inventories are complete and documented.
  - All TM write destinations and safety gates are mapped and evidenced.
  - Forbidden-write rule is re-verified (no root `/teams/` writes).
  - Critical hard-cap limiter issue is fixed and re-tested with numeric proof.
  - S&T blocked runtime case is unblocked via dataset coverage and re-verified in live TM walkthrough.
