# TRADE_MACHINE_R1 — REVIEW RETURN PACKAGE
**Date:** 2026-03-01  
**Status:** **FAIL/BLOCKED** (6 PASS / 2 FAIL / 4 BLOCKED)

## Executive Summary
- **Pass count:** 6
- **Fail count:** 2
- **Blocked count:** 4
- **Top 5 critical failures / blockers:**
  1. **BLOCKED:** Manual Architect → Trade Machine walkthrough could not run due to Firebase auth initialization failure (`auth/invalid-api-key`) at app load.
  2. **BLOCKED:** UI wiring and end-to-end trade construction behaviors cannot be fully verified in runtime without valid Firebase/emulator config.
  3. **BLOCKED:** Entitlement Wizard usability and edge-case behavior could not be exercised manually because app never rendered usable UI.
  4. **FAIL:** Trade Machine row-level click-outside implementation registers one global `mousedown` listener per `TradePlayerRow` instance (potential scale/perf footgun).
  5. **FAIL:** Missing explicit integration test coverage for full TM UI action wiring sequence (tab switch → add team → route players/picks → validate → apply) in one user-path spec.

---

## A) Scope Inventory

### TM UI surfaces (route/tab/subpanel/modal/action inventory)

### Reach path
1. Route `/gm` (league view), then `/gm/:teamId` dashboard route (`/home/runner/work/scoutzero/scoutzero/src/App.jsx:34-35`).
2. In GM Dashboard tab bar, click **Trade Machine** (`/home/runner/work/scoutzero/scoutzero/src/features/architect/GMDashboard/GMDashboard.jsx:231-240, 304-316`).
3. Trade section renders `TradeEditor` (`/home/runner/work/scoutzero/scoutzero/src/features/architect/GMDashboard/sections/TradeSection.jsx:14-24`).

### Trade Machine panels/tabs/subpanels
- `TradeEditor` main surface (`src/features/architect/tradeMachine/TradeEditor.jsx`)
- Team cards (`TradeTeamCard`) with per-team tabs:
  - `Players`
  - `Picks`
  - `Exceptions`
  (`TradeTeamCard.jsx:694-801`)
- Validation header (`ValidationStateHeader.jsx`)
- Validation details collapsibles (`ValidationDetailsPanel.jsx`):
  - Validation Results
  - Development Tools
- `TradeSummaryPanel`, `TradeLegalChecker`, `TradeExceptionDashboard`, `FaExceptionTracker`, `TradeReceiptPanel`

### Modals/menus found
- `TradePreviewModal` (opened by Validate Trade flow) (`TradeEditor.jsx:375-378, 589-595`)
- `EditContractModal` for TM Sign-and-Trade contract input (`TradeEditor.jsx:623-637`)
- `EditContractModal` also reachable via player row action “Modify Contract” (`TradePlayerRow.jsx:207-215, 381-389`)
- `PickRightWizardModal` (entitlement create/edit) (`TradeEditor.jsx:597-621`)
- Per-player overflow menu (`TradePlayerRow.jsx:152-225, 319-401`)
- Per-entitlement 3-dot action menu (`EntitlementPickRow.jsx:301-387`)

### Action buttons/controls found
- Global TM header:
  - `Clear session pick changes` (vacuum-only)
  - `Validate Trade`
  - `Reset Trade`
  - `Add Team`
- Team card controls:
  - Remove team (✕)
  - Expand/collapse outgoing/incoming sections
  - Team selector dropdown
  - Team tab buttons (Players/Picks/Exceptions)
- Player actions:
  - Trade to team / Cancel Trade
  - Sign-and-Trade (eligible only)
  - Undo Trade
  - Modify Contract
  - View Profile
- Incoming absorption controls:
  - Absorption mode selector (MATCH / TPE / FA_EXCEPTION)
  - TPE selector
  - FA bucket selector
- Entitlement actions:
  - Create entitlement
  - Trade to [team]
  - Undo Trade
  - Modify
  - View details
  - Revert this edit (vacuum edit)
  - Delete this session pick right (vacuum create)
- Validation details:
  - Expand/collapse Validation Results and Development Tools
  - Calculator team selector
- Trade preview modal:
  - Download
  - Close
- Apply gate:
  - `Apply Trade` button (disabled until current legal validation exists)

### TM data surface inventory (reads/writes/hooks/utils)

#### Firestore reads used by TM pipeline
- `architect_worlds/{worldId}` metadata (`entitlementResolver.ts:249-258`, `mutationPipeline.js:679-683`)
- `architect_worlds/{worldId}/teams/{teamCode}` (`teamLoader.js:45-53`, `entitlementResolver.ts:309-317`)
- `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` (`teamLoader.js:229-236`)
- `architect_worlds/{worldId}/entitlements/{entitlementId}` (`entitlementResolver.ts:373-386`)
- `architect_baseTeams/{teamCode}` (`teamLoader.js:80-87`, `entitlementResolver.ts:337-344`)
- `architect_basePlayers/{playerId}` (`teamLoader.js:217-221`)
- `architect_baseEntitlements/{entitlementId}` (`entitlementResolver.ts:358-365`)

#### Local storage/session surfaces used by TM flows
- `vacuum_entitlement_overlay` (`vacuumEntitlementOverlayStore.ts:57`)
- `pickrightdraft:{worldId}:{entitlementId|new}` (`pickRightWizardDraft.ts:11, 20, 35`)
- `architect_base_capAuditEvents_v1` (`localCapAuditLog.ts:37`)
- `architect_world_preview_capAuditEvents_v1` (`localCapAuditLog.ts:38`)

#### Key TM hooks/utilities wired
- `useTradeMachine` (`TradeEditor.jsx:68`) for state, routing, validation triggering
- `validateTrade` entrypoint (`useTradeMachine.js:942`) via `engine/tradeValidator.js`
- `loadWorldTeamData` (`useTradeMachine.js:343, 726`) world/base fallback loading
- `resolveEntitlementsForTeam` (`useTradeMachine.js:367, 752, 1166`)
- Canonical salary snapshot selector:
  - `getOfficialSalaryMatchingSnapshot` (`TradeSummaryPanel.jsx:15-18`, `ValidationDetailsPanel.jsx:17, 117`)
- Sign-and-trade eligibility/contract validation:
  - `isSignAndTradeEligible` (`TradePlayerRow.jsx:9, 86-103`)
  - `validateSignAndTradeContractPayload` (`TradeEditor.jsx:326-343`, `useTradeMachine.js:497-504`)

#### Base vs world boundaries (TM supports worlds)
- Team reads: world snapshot fallback chain to base (`worldTeamData.ts:97-101`, `teamLoader.js:25-29, 55-70`)
- Entitlement reads: world override chain fallback to base (`entitlementResolver.ts:371-404`)
- Writes in world mode: under `architect_worlds/*` only (no direct base writes)
- Vacuum mode: localStorage overlay only (no Firestore write)

---

## B) PASS/FAIL Checklist (1–12)

### 1) UI Wiring (No dead UI)
**Status:** **BLOCKED**  
**Evidence:**
- Required manual UI run failed at boot: Playwright console captured `FirebaseError: Firebase: Error (auth/invalid-api-key)` immediately after loading `http://localhost:5173/`.
- Screenshot evidence (blank/blocked page): provided attachment `https://github.com/user-attachments/assets/1af3f564-0e92-48ea-aeba-b0584936908d`.
- Because runtime UI never became interactive, dead-control verification cannot be completed empirically.

### 2) Trade Construction Logic Works
**Status:** **BLOCKED**  
**Evidence:**
- Construction handlers are present in code (`addTeam`, `removeTeam`, `setPlayerTrade`, `toggleEntitlement`, `setEntitlementDestination`, `resetTrade`) in `useTradeMachine.js:463-1051`.
- Runtime step-by-step (add teams 1/2/3+, player/pick add-remove, visual summary updates) could not be executed due app init failure above.

### 3) Validation Engine Is Actually Enforced
**Status:** **PASS**  
**Evidence:**
- Validation only runs via explicit click path (`handleValidate`), not auto-run (`useTradeMachine.js:1005-1018`).
- `Apply Trade` hard-gated by current legal validation (`TradeEditor.jsx:245, 513-524, 555-563`).
- Rule orchestration confirmed at validator engine (`tradeValidator.js:863-878`) including salary, hard cap, S&T, entitlement/player routing.
- User-visible reasons wired in `TradeSummaryPanel` “Why it fails” list (`TradeSummaryPanel.jsx:72-82`) and blocked status text (`TradeEditor.jsx:565-568`).
- Targeted tests passed:
  - `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`
  - `src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts`
  - `src/tests/tradeMachine/tradeAllowableIncomingParity.guardrail.test.ts`

### 4) Salary + Cap Math Correctly Connected (including hard cap)
**Status:** **PASS**  
**Evidence:**
- Hard-cap limiter math in validator: `effectiveAllowableIncoming = min(allowableIncoming, hardCapIncomingCeiling)` (`validateSalaryMatching.js:404-441, 453-456`).
- Team card shows `Allowable Incoming` + hard cap badge when limiter is hard cap (`TradeTeamCard.jsx:595-661`).
- Summary panel consumes canonical snapshot and displays match ceiling vs hard-cap ceiling breakdown (`TradeSummaryPanel.jsx:155-179, 220-247`).
- Explicit hard-cap parity test passed with numeric output in logs:
  - Team A: pre `177,000,000`, out `10,000,000`, in `13,000,000`, post `180,000,000` (`hardCap_reasonParity.guardrail.test.ts` run output).

### 5) Sign-and-Trade (UI + eligibility + contract payload)
**Status:** **PASS**  
**Evidence:**
- S&T opens contract modal path, not immediate route-only action:
  - menu action triggers `onRequestSignAndTrade` (`TradePlayerRow.jsx:185-195, 353-365`)
  - opens `EditContractModal` with `initialAction="signAndTrade"` (`TradeEditor.jsx:623-637`)
- Eligibility gate enforced in row action visibility (`TradePlayerRow.jsx:86-103`).
- Contract payload required and validated before setting S&T trade action (`TradeEditor.jsx:326-353`, `useTradeMachine.js:495-526`).
- Validator blocks ineligible S&T states (`validateSignAndTrade.js:154-180`).
- Tests passed:
  - `signAndTrade.failClosed.guardrail.test.ts`
  - `executeTrade_signAndTrade_apply.guardrail.test.ts`

### 6) Contract Term / Years Remaining Display Consistency
**Status:** **PASS**  
**Evidence:**
- TM player row uses `getYearsRemainingDisplay` (`TradePlayerRow.jsx:74-78, 313`).
- Helper merges `contract` + `primaryContract` + `futureContract` extension years (`contractUtils.js:94-125, 127-141`).
- UI test passed proving extension years counted:
  - `src/tests/architect/tradePlayerRow.yearsRemainingDisplay.test.tsx` (`3 YRS` when futureContract extension row exists).

### 7) Picks / Entitlements / Wizard usability + exclusivity
**Status:** **BLOCKED**  
**Evidence:**
- Runtime wizard usability could not be manually exercised due app init failure.
- Static + test evidence of wiring and validation exists:
  - Wizard modal wiring in TM (`TradeEditor.jsx:597-621`)
  - Routing/exclusivity validation in engine (`tradeValidator.js:730-767, 891-905`)
  - Routing validator checks uniqueness, destination validity, ownership (`validateEntitlementRouting.js:84-173`)
  - Guardrail test passed: `src/tests/architect/phase17_entitlement_routing_guardrail.test.js`.

### 8) Write Paths & Safety Gates (all mapped)
**Status:** **PASS**  
**Evidence:**
- **Apply Trade (world mode):**
  - Trigger: `TradeEditor` → `onApplyTrade` (`TradeEditor.jsx:525-545`)
  - Gate: requires current legal validation (`TradeEditor.jsx:513-524, 555-563`)
  - World guard: `runAuthoritativeFAMutation` requires `worldId` + `userId` (`useArchitectActions.ts:806-818`)
  - Persist path: `applyWorldMutation` → `persistWorldMutation` writes
    - `architect_worlds/{worldId}/teams/{teamCode}`
    - `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`
    - `architect_worlds/{worldId}/entitlements/{entitlementId}` (holder patch)
    - `architect_worlds/{worldId}/events/{eventId}`
    (`mutationPipeline.js:2823-2859, 2861-2903, 2909-2915`)
- **Apply Trade (base/vacuum mode):**
  - No Firestore write from TM trade apply; local compute + local state update + local cap audit log append (`useArchitectActions.ts:1232-1338`; local key constants in `localCapAuditLog.ts:37-39`).
  - Vacuum transfer persistence uses localStorage overlay (`TradeEditor.jsx:527-541`, `vacuumEntitlementOverlayStore.ts:57`).
- **Entitlement create/edit from TM Wizard:**
  - Router chooses vacuum vs world mode (`saveEntitlementFromFormState.ts:449-466`)
  - World mode writes gated by validation/exclusivity/linkage checks (`saveEntitlementFromFormState.ts:271-446`)
  - World write destinations:
    - `architect_worlds/{worldId}/entitlements/{id}` via `writeWorldEntitlement` (`entitlementWriter.ts:440-499`)
    - atomic create+attach also updates world team entitlement inventory (`saveEntitlementFromFormState.ts:611-617`)
  - Vacuum mode writes localStorage only (`saveEntitlementFromFormState.ts:469-557`)

### 9) Forbidden Writes Rule (no writes to `/teams/`)
**Status:** **PASS**  
**Evidence:**
- Search run for Architect code:
  - `rg "doc\(\s*db\s*,\s*['\"]teams['\"]|collection\(\s*db\s*,\s*['\"]teams['\"]|doc\(\s*db\s*,\s*TEAMS_COLLECTION|collection\(\s*db\s*,\s*TEAMS_COLLECTION" src/features/architect ...`
  - Result: **No matches found**.
- TM persistence code writes only world-scoped paths under `architect_worlds/.../teams/...` and related subcollections (`mutationPipeline.js:2840, 2869`).

### 10) Error Handling / Edge Cases
**Status:** **BLOCKED**  
**Evidence:**
- Manual attempts for edge cases (empty states, missing data, invalid picks, remove last team) were blocked by app boot failure.
- Static code does include visible error paths:
  - Init error banner (`TradeEditor.jsx:411-420`)
  - Apply trade blocked messaging (`TradeEditor.jsx:515-523, 565-568`)
  - Validation details “No Validation Results” callout (`ValidationDetailsPanel.jsx:37-49`)
- Runtime user-facing behavior for at least 3 edge case interactions could not be reproduced due blocking auth error.

### 11) Performance Footguns
**Status:** **FAIL**  
**Evidence:**
- `TradePlayerRow` installs a document-level `mousedown` listener per row instance (`TradePlayerRow.jsx:48-60`). In large rosters this scales listener count with rendered rows and can increase event-handling overhead.
- No centralized delegation mechanism observed for row-menu outside-click behavior.

### 12) Tests
**Status:** **FAIL**  
**Evidence:**
- Existing relevant tests are substantial and passing (trade, architect, hard cap, S&T, entitlement routing, cap totals, years remaining).
- **Gap:** No single integration test currently proves end-to-end TM UI wiring sequence across controls from user perspective (add/remove teams + route players + route entitlements + validate + apply with UI state transitions). Existing tests are guardrail/unit-heavy and fragmented.

---

## C) Evidence Appendix

### Required command outputs
1. `npm run validate:project`  
   - **Result:** PASS  
   - Notes: validator ran successfully; required dirs auto-created if missing.

2. `npm run build`  
   - **Result:** PASS  
   - Notes: build completed; expected chunk-size warnings present.

3. `npm run dev` + manual walkthrough attempt  
   - **Result:** BLOCKED  
   - Console: `FirebaseError: Firebase: Error (auth/invalid-api-key)` at initial page load.  
   - URL tested: `http://localhost:5173/`  
   - Screenshot evidence: `https://github.com/user-attachments/assets/1af3f564-0e92-48ea-aeba-b0584936908d`

4. Targeted tests (TM/cap/validation/entitlements)
   - `npm run test:trade -- --reporter=dot` → PASS (58 files)
   - `npm run test:architect -- --reporter=dot` → PASS (156 files)
   - `npm run test:node -- --reporter=dot src/tests/tradeMachine/tradeAllowableIncomingParity.guardrail.test.ts src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts src/tests/architect/phase17_entitlement_routing_guardrail.test.js src/tests/architect/capTotals/leagueViewSsot.test.js` → PASS (6 files, 26 tests)
   - `npm run test:ui -- --reporter=dot src/tests/architect/tradePlayerRow.yearsRemainingDisplay.test.tsx` → PASS

### CI/build failure investigation evidence (GitHub MCP)
- `list_workflow_runs` for `Bet-Zero/scoutzero`: latest run `22541209825` found, conclusion `action_required`.
- `list_workflow_jobs` for run `22541209825`: `total_count: 0`.
- `get_workflow_run_logs_url` for run `22541209825`: returned `404 Not Found`.

---

## D) Fix Punchlist (NO FIXES IMPLEMENTED)

1. **[Critical | BLOCKED] Restore runnable Architect runtime for TM audit**  
   - **Files/areas:** env/runtime bootstrap (`src/firebaseConfig.js`, local `.env`)  
   - **Acceptance criteria:**
     - `npm run dev` loads UI without `auth/invalid-api-key`
     - Reviewer can navigate `/gm/:teamId` and use TM interactively

2. **[High | BLOCKED] Complete runtime UI wiring verification checklist (items 1,2,7,10)**  
   - **Files/areas:** TM interactive surfaces (`TradeEditor.jsx`, `TradeTeamCard.jsx`, `TradePlayerRow.jsx`, `EntitlementPickRow.jsx`, `PickRightWizardModal.tsx`)  
   - **Acceptance criteria:**
     - Every listed button/menu is manually exercised and observed to mutate state/open modal/show error where expected
     - Edge cases logged with concrete before/after UI evidence

3. **[Medium | FAIL] Consolidate per-row click-outside listeners**  
   - **File/function:** `src/features/architect/tradeMachine/TradePlayerRow.jsx` (`useEffect` mousedown listener at lines ~48-60)  
   - **Acceptance criteria:**
     - Replace per-row global listener attachment with centralized/delegated outside-click handling
     - Maintain current menu-close behavior
     - No increase in leaked listeners during rapid rerender

4. **[Medium | FAIL] Add end-to-end TM UI interaction integration test**  
   - **Target suggestions:** new test under `src/tests/trade/` or `src/tests/architect/` using UI test config  
   - **Acceptance criteria:**
     - One test covers add team, route player, route entitlement, validate trade, apply-trade gate behavior
     - Assertions include disabled/enabled `Apply Trade` transitions and visible error/reason messaging

5. **[Low | Observability] Stabilize CI workflow diagnostics for current branch run**  
   - **Area:** `.github/workflows/ci.yml` / GH Actions configuration  
   - **Acceptance criteria:**
     - Workflow runs expose at least one job record when `conclusion=action_required`
     - Logs URL endpoint resolves for failure triage

---

## E) Closure Criteria
TM can be marked **REVIEW_COMPLETE (PASS)** only when all are true:
1. Architect dev UI is runnable in review environment (no blocking Firebase init/auth errors).
2. Manual walkthrough confirms all TM controls and modals are live and state-mutating where intended.
3. Explicit hard-cap scenario is manually reproduced in UI with documented numbers and correct limiter behavior.
4. Entitlement wizard flow (create/edit/routing/exclusivity) is manually validated in runtime.
5. Edge-case matrix (≥3 scenarios) is executed with user-visible error confirmations.
6. Performance footgun on per-row global listener is remediated or formally waived with benchmark evidence.
7. Integration test coverage includes one end-to-end TM user path across core controls.
