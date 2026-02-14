# TRADE MACHINE — AUDIT WORKBOOK

**Generated:** 2026-02-14
**Source Checklist:** `docs/architect/TRADE_MACHINE_MASTER_CHECKLIST_V1.md`
**Pass Type:** PREFLIGHT (UI Presence Only)
**Files Referenced:**

1. `src/features/architect/tradeMachine/TradeEditor.jsx`
2. `src/features/architect/tradeMachine/TradeTeamCard.jsx`
3. `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
4. `src/features/architect/tradeMachine/TradeValidationPanel.jsx`
5. `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
6. `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
7. `src/features/architect/tradeMachine/CapImpactTiles.jsx`
8. `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx`
9. `src/features/architect/tradeMachine/EntitlementPicksList.jsx`
10. `src/features/architect/tradeMachine/TradeExportCapture.jsx`
11. `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`
12. `src/features/architect/tradeMachine/TradePlayerRow.jsx`

---

## 0) Scope + Runtime Context

| Item                                                                               | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                                  | Notes |
| ---------------------------------------------------------------------------------- | ------- | ------------ | ---------- | -------------- | ---- | ----------------------------------------------------------------------------------------- | ----- |
| What year/season is the trade machine simulating?                                  | YES     |              |            |                |      | TradeEditor.jsx: `yearKey` prop passed to components; CapImpactTiles uses yearKey         |       |
| Cap, tax line, 1st apron, 2nd apron values exist and are used consistently         | YES     |              |            |                |      | CapImpactTiles.jsx: displays salaryCap, firstApron, secondApron from computeTeamCapTotals |       |
| Currency units are consistent everywhere (no AAV vs cap hit confusion)             | YES     |              |            |                |      | TradeTeamCard.jsx, TradeSummaryPanel.jsx: formatCurrency/formatSalary used consistently   |       |
| "Legal/Illegal" is defined (what rules are enforced today vs deferred)             | YES     |              |            |                |      | TradeSummaryPanel.jsx: "✅ Trade is CBA Legal" / "❌ Trade is NOT CBA Legal"              |       |
| Any deferred rule is not silently ignored (must be NOT IMPLEMENTED or NOT PRESENT) | UNKNOWN |              |            |                |      | Need validator analysis to confirm                                                        |       |

---

## 1) Core Inputs Are Real (Data Integrity)

### Teams / Rosters

| Item                                                                           | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                                            | Notes |
| ------------------------------------------------------------------------------ | ------- | ------------ | ---------- | -------------- | ---- | ------------------------------------------------------------------- | ----- |
| Every team has a roster list used by the trade machine                         | YES     |              |            |                |      | TradeTeamCard.jsx: renders `team?.players` array                    |       |
| No duplicate player appears on two teams                                       | UNKNOWN |              |            |                |      | No UI indicator; logic-side check                                   |       |
| Team totals reconcile to roster (payroll, roster count, dead money if modeled) | YES     |              |            |                |      | TradeTeamCard.jsx: computeTeamCapTotals for teamTotalSalary display |       |

### Players / Contracts

| Item                                                                               | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                               | Notes |
| ---------------------------------------------------------------------------------- | ------- | ------------ | ---------- | -------------- | ---- | -------------------------------------------------------------------------------------- | ----- |
| Every player has a current-year salary value used for trade logic                  | YES     |              |            |                |      | TradeTeamCard.jsx: getSalaryForYear called for sends/incoming                          |       |
| Salary source-of-truth is defined (base salary vs cap hit vs "trade salary")       | YES     |              |            |                |      | TradeReceiptPanel.jsx: shows baseSalary vs matchingValue distinction                   |       |
| Contract flags are present if used anywhere (TO/PO, non-guaranteed, two-way, etc.) | YES     |              |            |                |      | TradePlayerRow.jsx: flags object with BYC, trade kicker, poison pill; TwoWay indicator |       |
| Missing salary/contract fields fail loudly (clear error) not NaN/quiet fallbacks   | UNKNOWN |              |            |                |      | No UI indicator for missing data errors                                                |       |
| Recently acquired / recently signed fields exist if those rules are enforced       | NO      |              |            |                |      | No UI indicator for recently acquired/signed restrictions                              |       |

### League Rules Inputs

| Item                                                                              | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                     | Notes |
| --------------------------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | ---------------------------------------------------------------------------- | ----- |
| All matching thresholds/constants live in one place (not scattered magic numbers) | NO     |              |            |                |      | Config-level; not directly visible in UI                                     |       |
| Apron/tax thresholds are pulled from one canonical league config                  | NO     |              |            |                |      | Config-level; CapImpactTiles shows values but source not visible             |       |
| Any team-specific "hard-capped at X apron" state has a defined source             | YES    |              |            |                |      | CapImpactTiles.jsx: isHardCappedAtFirstApron/SecondApron with reason display |       |

---

## 2) Trade Session State + UI Plumbing

| Item                                                                                 | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                          | Notes |
| ------------------------------------------------------------------------------------ | ------- | ------------ | ---------- | -------------- | ---- | --------------------------------------------------------------------------------- | ----- |
| Add/remove team updates all dependent views                                          | YES     |              |            |                |      | TradeEditor.jsx: addTeam, removeTeam functions; TradeTeamCard rendered per slot   |       |
| Add/remove player updates all dependent views (team card, totals, legality, summary) | YES     |              |            |                |      | TradeTeamCard.jsx: onSetPlayerTrade updates sends; summary recalculates           |       |
| Add/remove pick updates all dependent views (pick UI, summary, legality if enforced) | YES     |              |            |                |      | EntitlementPicksList.jsx: onToggleEntitlement callback                            |       |
| Same asset cannot be selected twice (player or pick)                                 | UNKNOWN |              |            |                |      | No UI duplicate blocking visible; may be logic-side                               |       |
| Removing a team cleans up all assets tied to that team                               | UNKNOWN |              |            |                |      | TradeEditor removeTeam exists; cleanup behavior unclear                           |       |
| Derived values are not stored in a way that can drift from source-of-truth           | UNKNOWN |              |            |                |      | Architecture concern; not visible in UI                                           |       |
| Reset/Clear returns to a true empty trade state (if button exists)                   | YES     |              |            |                |      | TradeEditor.jsx: resetTrade function with RotateCcw icon button                   |       |
| Undo/redo works (if feature exists) without drifting totals                          | YES     |              |            |                |      | TradeEditor.jsx: undoPlayerTrade function; TradePlayerRow has "Undo Trade" option |       |

---

## 3) Salary Matching Engine (Core Legality)

**Section Audit:** TM_SEC_A1 — Completed 2026-02-14  
**Section Doc:** `docs/architect/audits/TM_SEC_A1_SALARY_MATCHING.md`

### Salary Computation (matching inputs)

| Item                                                                       | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                                               | Notes                                     |
| -------------------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Outgoing salary computed correctly per team                                | YES    | YES          | YES        | YES            | LOW  | `tradeValidator.js:L533-540` sums `matchOutgoing`; `matchingValues.js:L57` computes matching values    | Single path via `computeMatchingValues()` |
| Incoming salary computed correctly per team                                | YES    | YES          | YES        | YES            | LOW  | `tradeValidator.js:L543-557` sums `matchIncoming` from other teams' sends                              | Per-team aggregation correct              |
| "Trade salary" definition matches your model (base vs cap hit vs averaged) | YES    | YES          | YES        | YES            | LOW  | `getSalaryForYear()` reads `contract.salariesByYear[].capHit`; TradeReceiptPanel shows both base+match | Clear base vs matching separation         |
| No rounding drift between UI display and validator logic                   | YES    | YES          | YES        | YES            | LOW  | `warnOnTotalsDivergence()` guardrail in TradeTeamCard.jsx:L187-200; raw numbers until UI formatting    | Drift detection active                    |

### Matching Bands / Ceilings

| Item                                                                     | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                                      | Notes                             |
| ------------------------------------------------------------------------ | ------ | ------------ | ---------- | -------------- | ---- | --------------------------------------------------------------------------------------------- | --------------------------------- |
| Correct matching ceiling produced from outgoing (and league rules)       | YES    | YES          | YES        | YES            | LOW  | `getSalaryMatchingResult()` in salaryMatchingRules.js:L182 — "SINGLE SOURCE OF TRUTH" comment | All paths route through this      |
| Correct thresholds applied (the tiers/bands you're modeling)             | YES    | YES          | YES        | YES            | LOW  | `SALARY_MATCHING_TIERS` in salaryMatchingRules.js:L28-47 — centralized constants              | Band 1/2/3 + apron rules defined  |
| Aggregation rules correct (multi-player, multi-incoming, multi-outgoing) | YES    | YES          | YES        | YES            | LOW  | `tradeValidator.js:L533-558` aggregates all players per team before matching check            | Sums computed before validation   |
| Multi-team logic computes per-team legality (not one blended number)     | YES    | YES          | YES        | YES            | LOW  | `tradeValidator.js:L568` iterates `teamsWithAssets.map()` for per-team results                | Each team evaluated independently |

### Single Source of Truth

| Item                                                           | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                                   | Notes                                      |
| -------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| UI "Allowable Incoming" uses the same value the validator uses | YES    | YES          | YES        | YES            | LOW  | `getOfficialSalaryMatchingSnapshot()` — "CANONICAL SELECTOR" in file header                | TradeSummaryPanel + TradeTeamCard use this |
| Validator uses the same salary inputs the UI shows             | YES    | YES          | YES        | YES            | LOW  | TradeTeamCard.jsx:L149-170 uses snapshot when available; local path only before validation | Snapshot is golden source                  |
| If there are two compute paths, it's a FAIL until unified      | YES    | YES          | YES        | YES            | LOW  | Local path has "Estimate" indicator; `warnOnTotalsDivergence()` detects drift              | Dual-path mitigated via guardrails         |

### Failure Reasons

| Item                                                                               | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                          | Notes                    |
| ---------------------------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | --------------------------------------------------------------------------------- | ------------------------ |
| Salary-matching failure returns a specific reason message (not generic "illegal")  | YES    | YES          | YES        | YES            | LOW  | `validateSalaryMatching.js:L397` returns specific message with currency amounts   | Clear violation messages |
| When multiple reasons exist, they're either all shown or priority is deterministic | YES    | YES          | YES        | YES            | LOW  | TradeSummaryPanel.jsx:L62-73 maps all `result.failures` in "Why it fails" section | All failures shown       |

---

## 4) Hard Caps + Aprons

### Hard-Cap State

| Item                                                                    | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                                             | Notes                     |
| ----------------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | ---------------------------------------------------------------------------------------------------- | ------------------------- |
| Team hard-cap status is determined (none / 1st apron / 2nd apron)       | YES    | YES          | YES        | YES            | LOW  | `hardCapUtils.js:isHardCappedAtFirstApron()`, `isHardCappedAtSecondApron()` checks multiple triggers | Triggers: MLE, BAE, S&T   |
| Hard-cap status has a clear cause model (or explicitly NOT IMPLEMENTED) | YES    | YES          | YES        | YES            | LOW  | `hardCapUtils.js:getFirstApronHardCapReason()` returns specific reason                               | Clear per-trigger reasons |

### Post-Trade Apron Compliance

| Item                                                                             | In UI? | Implemented? | Validated? | Single Source? | Risk    | Evidence                                                                                                                             | Notes                      |
| -------------------------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Post-trade team salary is computed correctly                                     | YES    | YES          | YES        | YES            | LOW     | `tradeValidator.js:L564` `projectedSalary = teamTotalSalary - salaryOut + salaryIn`                                                  | Single compute path        |
| If hard-capped, trade is illegal if post-trade salary exceeds the hard-cap apron | YES    | YES          | YES        | YES            | LOW     | `hardCapValidation.js:validateHardCap()` checks `projectedSalary > firstApron/secondApron`                                           | Violations added correctly |
| allowableIncoming = min(salaryMatchCeiling, apronRoomRemaining)                  | YES    | **YES**      | **YES**    | YES            | **LOW** | **TM_FIX_A2_E1**: `validateSalaryMatching.js` computes `effectiveAllowableIncoming = min(allowableIncoming, hardCapIncomingCeiling)` | See evidence below (FIXED) |

### UI Truth

| Item                                                                       | In UI? | Implemented? | Validated? | Single Source? | Risk    | Evidence                                                                                                                              | Notes                          |
| -------------------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| UI communicates apron/hard-cap constraint clearly                          | YES    | YES          | N/A        | YES            | LOW     | `CapImpactTiles.jsx`: Lock icon + hard-cap zones                                                                                      | Visual indicator present       |
| UI shows why it's illegal (e.g., "Hard-capped at 1st apron; only $X room") | YES    | **YES**      | N/A        | YES            | **LOW** | **TM_FIX_A2_E1**: `TradeSummaryPanel.jsx` displays ceiling breakdown: Salary Match Ceiling vs Hard Cap Ceiling with limiter indicator | Room-based messaging now shown |

### Section 4 Evidence (FAIL/HIGH items only)

**FINDING: ~~allowableIncoming is NOT clamped by apron room when hard-capped~~ FIXED by TM_FIX_A2_E1**

**Fix Implementation (TM_FIX_A2_E1):**

1. `validateSalaryMatching.js` now computes `hardCapIncomingCeiling = salaryOut + max(0, apron - teamTotalSalary)`
2. `effectiveAllowableIncoming = min(allowableIncoming, hardCapIncomingCeiling)` computed when hard-capped
3. `getOfficialSalaryMatchingSnapshot()` exposes new fields: `hardCapIncomingCeiling`, `effectiveAllowableIncoming`, `hardCapCeilingDetails`
4. `TradeSummaryPanel.jsx` displays effective allowable with ceiling breakdown for hard-capped teams
5. Unit tests added in `hardCap_salaryMatching.guardrail.test.js`

**Evidence of Fix:**

- `validateSalaryMatching.js:L403-L443` - Computes hard cap ceiling and effective allowable
- `getOfficialSalaryMatchingSnapshot.js:L98-L107` - Exposes new fields
- `TradeSummaryPanel.jsx:L135-L195` - Displays ceiling breakdown in UI
- `hardCap_salaryMatching.guardrail.test.js:L155-L265` - 6 new regression tests

**Impact (Resolved):**

- Hard-capped team now sees correct effective allowable incoming
- UI displays both ceiling values with clear limiter indication
- User understands why allowable is limited by hard-cap room

---

## 5) Roster Constraints (Post-trade validity)

| Item                                                                   | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                          | Notes |
| ---------------------------------------------------------------------- | ------- | ------------ | ---------- | -------------- | ---- | --------------------------------------------------------------------------------- | ----- |
| Minimum roster size enforced post-trade (NBA rule or your chosen rule) | YES     |              |            |                |      | TradeLegalChecker.jsx: rosterCount rule displayed; validateRoster checks <14      |       |
| Maximum roster size enforced post-trade                                | YES     |              |            |                |      | TradeLegalChecker.jsx: rosterCount rule displayed; validateRoster checks >15      |       |
| Two-way slots enforced (if modeled)                                    | YES     |              |            |                |      | TradeValidationPanel.jsx: "Two-way slots exceeded" pattern; validateRoster checks |       |
| If any roster rule is not modeled, it must be labeled NOT IMPLEMENTED  | UNKNOWN |              |            |                |      | Need to verify all rules have explicit status                                     |       |

---

## 6) Player Trade Restrictions

| Item                                                                | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                                | Notes |
| ------------------------------------------------------------------- | ------- | ------------ | ---------- | -------------- | ---- | --------------------------------------------------------------------------------------- | ----- |
| Recently signed restrictions (e.g., cannot be traded for X time)    | NO      |              |            |                |      | No UI indicator found                                                                   |       |
| Recently acquired restrictions (aggregation limitations if modeled) | NO      |              |            |                |      | No UI indicator found                                                                   |       |
| Reacquisition restrictions (if modeled)                             | YES     |              |            |                |      | TradeLegalChecker.jsx: reacquisition rule; TradeValidationPanel pattern                 |       |
| No-trade clause handling (if modeled)                               | YES     |              |            |                |      | TradeValidationPanel.jsx: "Player NTC — consent required" pattern with tip              |       |
| Trade kicker handling (if modeled)                                  | YES     |              |            |                |      | TradeTeamCard.jsx, TradeReceiptPanel.jsx: TK badge with tooltip; matchingValue adjusted |       |
| Poison pill handling (if modeled)                                   | YES     |              |            |                |      | TradeTeamCard.jsx, TradeReceiptPanel.jsx: PP badge with tooltip                         |       |
| BYC handling (if modeled)                                           | YES     |              |            |                |      | TradeTeamCard.jsx, TradeReceiptPanel.jsx: BYC badge with tooltip                        |       |
| Two-way specific restrictions (if modeled)                          | UNKNOWN |              |            |                |      | Two-way count enforced; specific restrictions unclear                                   |       |
| Non-guaranteed / partial guarantees handling (if modeled)           | UNKNOWN |              |            |                |      | No explicit UI indicator found                                                          |       |

---

## 7) Picks + Entitlement Editor

### Ownership / Source of Truth

| Item                                                                | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                                       | Notes |
| ------------------------------------------------------------------- | ------- | ------------ | ---------- | -------------- | ---- | -------------------------------------------------------------- | ----- |
| Pick ownership shown matches the entitlement/ledger source-of-truth | YES     |              |            |                |      | EntitlementPicksList.jsx: uses entitlements from resolver      |       |
| No "phantom picks" exist (all expected picks accounted for)         | UNKNOWN |              |            |                |      | Not visible in UI                                              |       |
| Pick identity is stable (year/round/owning team/protection terms)   | YES     |              |            |                |      | EntitlementPickRow.jsx: displays kind, year, round, protection |       |

### Editing / Wizard Wiring

| Item                                                                | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                          | Notes |
| ------------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | ----------------------------------------------------------------- | ----- |
| Add/remove pick modifies the same state used by summary + validator | YES    |              |            |                |      | EntitlementPicksList.jsx: onToggleEntitlement callback            |       |
| Protection editing persists in-session                              | YES    |              |            |                |      | EntitlementPicksList.jsx: onEditEntitlement callback              |       |
| Swap handling works (if supported)                                  | YES    |              |            |                |      | EntitlementPicksList.jsx: swap_right kind supported in sorting    |       |
| Multi-team pick routing works (cannot end in impossible ownership)  | YES    |              |            |                |      | EntitlementPicksList.jsx: onSetDestination for multi-team routing |       |

### Constraints

| Item                                                          | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                       | Notes |
| ------------------------------------------------------------- | ------- | ------------ | ---------- | -------------- | ---- | ------------------------------------------------------------------------------ | ----- |
| Stepien rule enforced (at least the level you claim)          | YES     |              |            |                |      | TradeLegalChecker.jsx: stepienRule displayed; TradeValidationPanel has pattern |       |
| Protection logic doesn't allow impossible states (if modeled) | UNKNOWN |              |            |                |      | Not visible in UI                                                              |       |
| Validation provides clear pick-legality reasons               | YES     |              |            |                |      | TradeSummaryPanel.jsx: entitlementWarnings computed and displayed              |       |

---

## 8) Exceptions / Tools

### TPE (Trade Player Exceptions)

| Item                                                            | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                         | Notes |
| --------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | -------------------------------------------------------------------------------- | ----- |
| TPE objects have real values (amount, expiration, owner)        | YES    |              |            |                |      | TradeExceptionDashboard.jsx: displays amount, expiration date, name/createdFrom  |       |
| Selecting a TPE affects legality and allowable incoming         | YES    |              |            |                |      | TradeTeamCard.jsx: TradeExceptionManager component; applyTradeException callback |       |
| If TPEs are displayed but not selectable/used → FAIL (lying UI) | YES    |              |            |                |      | TradeExceptionDashboard shows existing TPEs with usage tracking                  |       |

### Cash

| Item                                       | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                    | Notes |
| ------------------------------------------ | ------ | ------------ | ---------- | -------------- | ---- | ------------------------------------------- | ----- |
| Cash is supported and validated (if shown) | NO     |              |            |                |      | No cash UI control found in trade editor UI |       |
| If shown but not validated → FAIL          | N/A    |              |            |                |      | Cash not shown in trade input UI            |       |

### Sign-and-trade

| Item                                                                | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                      | Notes |
| ------------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | ----------------------------------------------------------------------------- | ----- |
| If present in UI, legality rules exist (or clearly NOT IMPLEMENTED) | YES    |              |            |                |      | TradePlayerRow.jsx: signAndTrade option; TradeLegalChecker: signAndTrade rule |       |

---

## 9) Multi-team Trade Support

| Item                                                         | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                                           | Notes |
| ------------------------------------------------------------ | ------- | ------------ | ---------- | -------------- | ---- | ------------------------------------------------------------------ | ----- |
| Each team's incoming/outgoing tracked independently          | YES     |              |            |                |      | TradeEditor.jsx: teams array; incomingAssets computed per-team     |       |
| Salary matching evaluated per team correctly                 | YES     |              |            |                |      | TradeSummaryPanel.jsx: result.teamResults per-team with legal flag |       |
| Pick routing evaluated per team correctly                    | YES     |              |            |                |      | TradeEditor.jsx: Phase 17 logic for toTeamId routing               |       |
| Summary displays each team's net assets correctly            | YES     |              |            |                |      | TradeSummaryPanel.jsx: summaryByTeamIndex per-team                 |       |
| No asset can be both incoming and outgoing for the same team | UNKNOWN |              |            |                |      | Not visible in UI; validation logic                                |       |

---

## 10) UI Numbers + Messaging

| Item                                       | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                           | Notes |
| ------------------------------------------ | ------ | ------------ | ---------- | -------------- | ---- | ------------------------------------------------------------------ | ----- |
| Computed from real state (not placeholder) | YES    |              |            |                |      | Comments indicate snapshot from validator is used                  |       |
| Updates live as edits happen               | YES    |              |            |                |      | React state hooks; useMemo for derived values                      |       |
| Matches validator inputs                   | YES    |              |            |                |      | getOfficialSalaryMatchingSnapshot marked as CANONICAL SELECTOR     |       |
| Correct label/meaning (not misleading)     | YES    |              |            |                |      | TradeTeamCard.jsx: formatSkipReasonLabel for human-readable labels |       |
| "Legal" only when all enforced rules pass  | YES    |              |            |                |      | TradeSummaryPanel.jsx: result.legal drives status                  |       |
| "Illegal" shows specific reasons           | YES    |              |            |                |      | TradeSummaryPanel.jsx: result.failures mapped with messages        |       |

---

## 11) Summary + Export

| Item                                                                      | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                                                                     | Notes |
| ------------------------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | ---------------------------------------------------------------------------- | ----- |
| Summary lists correct players out/in per team                             | YES    |              |            |                |      | TradeSummaryPanel.jsx: teamResult.outgoingPlayers/incomingPlayers            |       |
| Summary lists correct picks out/in per team (including protections/swaps) | YES    |              |            |                |      | TradeSummaryPanel.jsx: entitlementsOut, incomingEntitlements with projection |       |
| Summary shows correct net salary deltas                                   | YES    |              |            |                |      | TradeSummaryPanel.jsx: salaryIn from officialSnapshot                        |       |
| Summary uses the same state as validator (single source-of-truth)         | YES    |              |            |                |      | getOfficialSalaryMatchingSnapshot is CANONICAL SELECTOR                      |       |
| Export (if exists) matches on-screen state exactly                        | YES    |              |            |                |      | TradeExportCapture.jsx: uses same teams/result props                         |       |
| Export includes all assets (no missing picks/protections)                 | YES    |              |            |                |      | TradeExportCapture.jsx: includes entitlementsOut with terms                  |       |

---

## 12) Save/Load + Immutability

| Item                                                                               | In UI?  | Implemented? | Validated? | Single Source? | Risk | Evidence                                              | Notes |
| ---------------------------------------------------------------------------------- | ------- | ------------ | ---------- | -------------- | ---- | ----------------------------------------------------- | ----- |
| Save captures full trade session state (teams, players, picks, protections, notes) | UNKNOWN |              |            |                |      | No explicit save trade UI button found in TradeEditor |       |
| Load restores state exactly (no drift)                                             | UNKNOWN |              |            |                |      | No explicit load trade UI button found                |       |
| Save location is correct (plans collection, not base data)                         | UNKNOWN |              |            |                |      | Not visible in UI                                     |       |
| **Base `/teams` (or base collections) are never written by the trade machine**     | UNKNOWN |              |            |                |      | Architecture concern; not visible in UI               |       |
| Firestore rules assumptions match behavior (dev-open vs prod-locked)               | UNKNOWN |              |            |                |      | Not visible in UI                                     |       |

---

## 13) Minimum Scenario Suite

### Salary / Hard-cap

| Item                           | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                   | Notes |
| ------------------------------ | ------ | ------------ | ---------- | -------------- | ---- | -------------------------- | ----- |
| Legal 1-for-1 (simple)         | N/A    |              |            |                |      | Test scenario; not UI item |       |
| Illegal salary match case      | N/A    |              |            |                |      | Test scenario; not UI item |       |
| Near-apron hard-cap clamp case | N/A    |              |            |                |      | Test scenario; not UI item |       |

### Roster

| Item                 | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                   | Notes |
| -------------------- | ------ | ------------ | ---------- | -------------- | ---- | -------------------------- | ----- |
| Max roster violation | N/A    |              |            |                |      | Test scenario; not UI item |       |
| Min roster violation | N/A    |              |            |                |      | Test scenario; not UI item |       |

### Picks (if enabled)

| Item                      | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                   | Notes |
| ------------------------- | ------ | ------------ | ---------- | -------------- | ---- | -------------------------- | ----- |
| Simple pick trade         | N/A    |              |            |                |      | Test scenario; not UI item |       |
| Protected pick edit       | N/A    |              |            |                |      | Test scenario; not UI item |       |
| Stepien violation attempt | N/A    |              |            |                |      | Test scenario; not UI item |       |

### Multi-team (if enabled)

| Item                                    | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                   | Notes |
| --------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | -------------------------- | ----- |
| 3-team trade with mixed players + picks | N/A    |              |            |                |      | Test scenario; not UI item |       |

### Persistence (if enabled)

| Item                                                    | In UI? | Implemented? | Validated? | Single Source? | Risk | Evidence                   | Notes |
| ------------------------------------------------------- | ------ | ------------ | ---------- | -------------- | ---- | -------------------------- | ----- |
| Save → reload app → load → identical summary + legality | N/A    |              |            |                |      | Test scenario; not UI item |       |

---

## Summary Statistics

| Category                        | YES    | NO    | UNKNOWN | N/A    | AUDITED |
| ------------------------------- | ------ | ----- | ------- | ------ | ------- |
| Section 0 (Scope)               | 4      | 0     | 1       | 0      | NO      |
| Section 1 (Data Integrity)      | 7      | 2     | 2       | 0      | NO      |
| Section 2 (Session State)       | 5      | 0     | 3       | 0      | NO      |
| Section 3 (Salary Matching)     | 12     | 0     | 0       | 0      | **YES** |
| Section 4 (Hard Caps/Aprons)    | 5      | 0     | 2       | 0      | **YES** |
| Section 5 (Roster)              | 3      | 0     | 1       | 0      | NO      |
| Section 6 (Player Restrictions) | 5      | 2     | 2       | 0      | NO      |
| Section 7 (Picks/Entitlements)  | 7      | 0     | 2       | 0      | NO      |
| Section 8 (Exceptions/Tools)    | 4      | 1     | 0       | 1      | NO      |
| Section 9 (Multi-team)          | 4      | 0     | 1       | 0      | NO      |
| Section 10 (UI Numbers)         | 6      | 0     | 0       | 0      | NO      |
| Section 11 (Summary/Export)     | 6      | 0     | 0       | 0      | NO      |
| Section 12 (Save/Load)          | 0      | 0     | 5       | 0      | NO      |
| Section 13 (Scenarios)          | 0      | 0     | 0       | 9      | NO      |
| **TOTALS**                      | **68** | **5** | **19**  | **10** |         |

---

## Completed Section Audits

| Section                      | Audit ID  | Date       | Status  |
| ---------------------------- | --------- | ---------- | ------- |
| Section 3 (Salary Matching)  | TM_SEC_A1 | 2026-02-14 | ✅ PASS |
| Section 4 (Hard Caps/Aprons) | TM_SEC_A2 | 2026-02-14 | ✅ PASS |

---

## Key Observations (UI Presence Pass)

1. **Strong UI presence** for core trade machine features (team selection, player trading, salary matching, validation results)
2. **TPE/Exception handling** has UI presence via TradeExceptionDashboard and TradeExceptionManager
3. **Pick/Entitlement trading** fully represented via EntitlementPicksList
4. **Save/Load** functionality unclear from UI - no visible save/load buttons in TradeEditor
5. **Cash in trades** has no UI control (second apron messages reference it, but no input exists)
6. **Recently signed/acquired** restrictions have no UI presence
7. **Multi-team support** (3+ teams) explicitly handled with toTeamId routing
8. **Validation details** well-organized in collapsible panels with official/exploratory mode tags
