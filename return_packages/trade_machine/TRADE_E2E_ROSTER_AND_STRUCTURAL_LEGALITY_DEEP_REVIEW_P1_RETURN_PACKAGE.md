# TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_DEEP_REVIEW_P1_RETURN_PACKAGE

Date: 2026-02-26  
Mode: PREFLIGHT (discovery-only; no functional code changes)

## 1) STOP REPORT

**Triggered: YES**

### Triggered STOP conditions

1. **STOP Condition #1 (cosmetic-only legality UI surface): TRIGGERED**
   - `TradeLegalChecker` renders a `Roster Count` rule from `team.rules?.rosterCount`.
   - `validateTrade` does not populate `rosterCount` in `allRules`, so this legality surface is effectively unwired.
   - Evidence: `src/features/architect/tradeMachine/TradeLegalChecker.jsx`, `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`.

2. **STOP Condition #2 (validator legal but apply can commit structural-rule violation): TRIGGERED**
   - Implemented roster structural rules exist (`min/max roster`, `two-way max`) in roster rule modules, but are not wired into `validateTrade` and are not re-checked in apply-time pipeline.
   - Apply path can persist without roster-window validation.
   - Evidence: `src/features/architect/utils/tradeMachine/rules/rosterValidation.js`, `src/features/architect/utils/tradeMachine/rules/validateRoster.ts`, `src/features/architect/utils/tradeMachine/rules/validateRoster.js`, `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`, `src/features/architect/utils/mutationPipeline.js`.

3. **STOP Condition #3 (apply can succeed without validator enforcing implemented rule): TRIGGERED**
   - `executeTrade` apply enforces routing + duplicate/exclusivity invariants, but not roster-window/two-way constraints despite those rules being implemented elsewhere.
   - Evidence: `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/utils/tradeContext/tradeContext.js`.

4. **STOP Condition #5 (team structural SSOT ambiguity): TRIGGERED**
   - Schema/contracts frame `roster` as player IDs and `players` as full objects, but hydration and mutation paths can diverge/overlap with mixed assumptions.
   - `hydrateBaseTeam` sets `roster: players` (object array), while apply-time `buildPostTradeTeamsSnapshot` writes `roster` using ID semantics and `players` using object semantics.
   - Evidence: `src/schemas/architect.ts` (`BaseTeamDocZ`), `src/features/architect/utils/persistenceContracts/contracts.js`, `src/features/architect/utils/firebaseTeamPlanHelpers.js`, `src/features/architect/utils/tradeContext/tradeContext.js`.

### Not triggered

- **STOP Condition #4 (silent fix-up altering roster/structure outcomes without validator/UI reflection):** Not conclusively proven as a dedicated roster-structure normalizer in the trade path. (Observed normalizers are mainly persistence/transient/TPE schema focused.)

---

## 2) Ship-Readiness Verdict for Roster/Structural Legality

**Not ship-ready** for roster/structural legality parity.

Primary blockers:
- Implemented roster structural rules are not wired into validator/apply gating.
- UI exposes roster-rule surface that is not backed by active validator output.
- Team structural shape SSOT (`roster` vs `players`) is inconsistent enough to risk legality/outcome drift.

---

## 3) Structural Legality SSOT Map (table)

| Rule name / concept | Validator check | Apply-time check | Data fields read | Blocking behavior | UI surface | Parity verdict |
|---|---|---|---|---|---|---|
| 3+ team player routing required | `validateTrade` -> `validatePlayerRouting()` | `buildPostTradeTeamsSnapshot()` throws `TRADE_APPLY_ROUTING_ERROR` for missing/invalid destination | `sends[].tradeTo/toTeamId/destTeamId`, team IDs | Validator returns `legal:false`; apply throws before persistence | Summary reason + apply disabled via legality gate | **Wired & enforced** |
| Player send uniqueness (cross-team + same-team) | `validatePlayerRouting()` | League invariant gate: `validateMutationLeagueInvariants()` -> `validateNoDuplicatePlayers()` | `sends[]` IDs; post-state `team.players || team.roster` | Validator blocks; apply returns `success:false` | Validation reason surfaces in summary/details | **Wired & enforced** (shape caveat below) |
| Entitlement routing (3+ `toTeamId`, destination validity, ownership) | `validateEntitlementRouting()` | Pipeline requires pre-validated context; duplicate entitlement invariant runs at apply | `entitlementsOut[].entitlementId/toTeamId`, `team.entitlementIds` | Validator blocks early; apply fails closed if invariants fail | Validation details + summary reasons | **Wired & enforced** |
| Linked/residual entitlement package integrity | `validateEntitlementLinkageLegality()` | No dedicated linked-package re-check; apply depends on pre-validated context + exclusivity/invariant gates | `linkedEntitlementIds`, `residualOfEntitlementId`, known entitlement map | Validator `legal:false`; apply hard-errors if pre-validated context missing | Summary reasons | **Partially wired** (validator-anchored) |
| Entitlement exclusivity (claim conflicts) | `validateEntitlementExclusivity()` in `validateTrade` team loop | `validateTradeApplyExclusivity()` in Phase 3.7 | Resolved post-trade entitlement claim sets | Validator blocks; apply returns `success:false` | `TradeLegalChecker` "Pick Exclusivity" + detailed conflict lines | **Wired & enforced** |
| Duplicate entitlement IDs across teams | `validateEntitlementRouting()` (selection-time dupe) | `validateMutationEntitlementInvariants()` -> `validateNoDuplicateEntitlements()` | Team `entitlementIds` post-state | Validator/apply both block | Summary reason; apply fails | **Wired & enforced** |
| Roster size window (min/max standard roster) | Rule exists in `rosterValidation.js` / `validateRoster.ts` / `validateRoster.js` but not invoked by `validateTrade` team rule aggregation | No `executeTrade` roster-window gate in pipeline | `projectedRosterCount`, incoming/outgoing, roster windows | No active block in current trade validator/apply path | `TradeLegalChecker` expects `team.rules.rosterCount`, but validator does not provide it | **Missing (STOP)** |
| Two-way slot max | Rule exists in same roster modules; not wired in validator aggregation | No explicit apply-time two-way gate | `team.team.twoWayPlayers`, incoming/outgoing `isTwoWay` | No active block in executeTrade path | No authoritative surfaced rule result | **Missing (STOP)** |
| Structural payload: missing player ID | Not strict in `validateTrade` (player key fallback can use name+team) | `applyTradeToCapSheet()` throws on missing `playerId` before mutation call | `outgoingPlayers[].id/player_id/playerId` | Throws pre-apply | User gets apply error/toast | **Partially wired (apply/UI only)** |
| Structural payload: S&T contract shape | `validateSignAndTrade` + shared S&T payload validators | `applyTradeToCapSheet()` precheck and `buildPostTradeTeamsSnapshot()` S&T preflight throw | `signAndTradeContract.salariesByYear`, `contractYears`, `firstYearGuaranteed`, destination | Validator/apply both block | Validator reasons + UI modal errors | **Wired & enforced** |
| Team document structural validity (`roster` IDs vs `players` objects) | No schema parse in trade validator path | Apply writes both `roster` and `players`; contracts allow both but do not enforce ID-vs-object semantics at runtime in prod | `team.roster`, `team.players` | No hard runtime block for type-semantic drift | Not directly surfaced | **Ambiguous / missing (STOP)** |
| Persistence shape allowlists | N/A in validator | `assertPersistableOrThrow()` in persistence phase (test/env-gated) | TEAM/PLAYER/EVENT top-level + deep allowlists | Blocks when enforcement enabled; no-op otherwise | Not user-facing | **Partial (environment-gated)** |

---

## 4) E2E Flow Traces (4–6)

### Trace 1 — Trade exceeding max roster size (implemented rule exists; not wired)

1. User builds trade where Team A receives net players above max roster.
2. UI calls `handleValidate()` -> `validateTrade()`.
3. `validateTrade` runs routing/cap/eligibility/exclusivity checks, but does not run roster-window validators into `team.rules`.
4. Trade may still return `legal:true` (if no other rule fails).
5. `Apply Trade` gating uses `hasCurrentValidation && result.legal === true`; apply is reachable.
6. Apply pipeline executes (`buildPostTradeTeamsSnapshot` -> `validatePostTradeSnapshotForContext` -> invariants -> persist) with no roster-window gate.
7. Persist can commit.

**Parity outcome:** Implemented max-roster rule is not enforcing this flow end-to-end.

### Trace 2 — Trade falling below min roster size (implemented rule exists; not wired)

Same path as Trace 1, but net outgoing drops below min roster.  
Result is the same: no active validator/apply block from roster-window modules in executeTrade path.

**Parity outcome:** Missing end-to-end enforcement.

### Trace 3 — Special category: two-way slot overflow

1. Trade composition creates post-trade two-way count above configured maximum.
2. Two-way constraints exist in roster rule modules.
3. `validateTrade` does not surface or block on these roster rules in current aggregation path.
4. Apply pipeline does not add a two-way structural gate before persistence.

**Parity outcome:** Missing end-to-end enforcement for modeled special roster category.

### Trace 4 — Duplicate player across teams (fail-closed)

1. User selects same player in multiple team sends or routes duplicates.
2. `validatePlayerRouting` catches routing/uniqueness violations and returns blocking errors.
3. If bypassed, apply-time league invariant gate validates post-state duplicate players and returns `success:false`.

**Parity outcome:** Fail-closed at validator and apply-time.

### Trace 5 — Structurally invalid player payload (missing ID / contract shape mismatch)

**5A Missing ID (blocking):**
1. Outgoing player lacks `playerId` after payload normalization.
2. `applyTradeToCapSheet` throws `Trade missing playerId ...` before mutation pipeline call.

**5B Contract-shape mismatch:**
- **S&T payload mismatch**: blocked by shared S&T payload validators at validator and apply preflight.
- **Non-S&T salary/contract incompleteness**: primarily surfaced as data warnings/fallbacks (not uniformly blocking).

**Parity outcome:** Partial; strict for missing ID and S&T, softer for general non-S&T structure quality.

### Trace 6 — Other structural rule: entitlement exclusivity/claim conflict

1. Trade proposal creates overlapping entitlement claim set.
2. Validator builds post-trade entitlement set and runs exclusivity validator -> blocking failure.
3. Apply-time reruns exclusivity gate (`validateTradeApplyExclusivity`) before persistence.

**Parity outcome:** Fail-closed in both phases.

---

## 5) UI Parity Findings (wired vs cosmetic)

### Wired to validator/apply SSOT

- `TradeEditor` apply gating and click handler require current validation + `result.legal === true`.
- `TradeSummaryPanel` top legality banner derives from `result.legal`.
- `CapImpactTiles` uses validator snapshot `projectedSalary` when available.
- `useTradeMachineSnapshot` explicitly treats `teamResults` as legality SSOT and keeps receipt debug-only for team-critical values.
- `TradeSalaryCalculator` labels sandbox as exploratory and separately shows official validator result.

### Cosmetic/local/misaligned surfaces

- `TradeLegalChecker` includes a `Roster Count` rule slot, but validator never populates `team.rules.rosterCount`; this appears as an unwired legality surface.
- `FaExceptionTracker` mixes local team data (`teams[index].team.faExceptions`) with result data and is informational, not an apply gate.

### Can user reach Apply with structurally illegal state?

**Yes**, for roster-window/two-way structural illegality currently represented only in disconnected rule modules.  
Because apply gating depends on `result.legal`, and those rules are not in active validator aggregation, apply can remain reachable.

---

## 6) Apply-Time Findings (fail-closed, atomicity, world scoping)

### Fail-closed order

- `applyWorldMutation` flow is `READ -> COMPUTE -> VALIDATE -> LEAGUE INVARIANTS -> ENTITLEMENT INVARIANTS -> EXCLUSIVITY -> PERSIST`.
- `executeTrade` validation requires pre-validated trade context from `validatePostTradeSnapshotForContext`; missing context throws hard error (no fallback path).
- Routing/S&T preflight errors throw before persistence call.

### Atomicity

- Firestore writes are centralized in `persistWorldMutation`.
- Writes are staged in a single `writeBatch` and committed once via `batch.commit()`.
- On any pre-persist failure, persist is never called.
- On persist-phase exception, function returns `success:false`; batch atomic semantics prevent partial commit.

### World-scoped writes

- Team docs: `architect_worlds/{worldId}/teams/{teamCode}`
- Player overrides: `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}`
- Entitlement holder patches: `architect_worlds/{worldId}/entitlements/{entitlementId}`
- Event log + world metadata updates are also under world-scoped paths.

---

## 7) Issues List (Blockers / Majors / Minors)

### Blockers

1. **Roster-window and two-way structural rules are implemented but not enforced end-to-end**
   - **Category:** Validator + Apply + UI
   - **Repro concept:** Construct net +2 / -2 roster-count trade or two-way overflow; validate can remain legal and apply can commit.
   - **Evidence:** `tradeValidator.js` (imports roster enforcement but does not aggregate roster rule), `rosterValidation.js`, `validateRoster.ts`, `mutationPipeline.js`.

2. **Roster legality UI parity gap (`Roster Count` rule slot unwired)**
   - **Category:** UI-only parity (safety signaling)
   - **Repro concept:** Open Rule Compliance; roster row is expected but not driven by active validator output.
   - **Evidence:** `TradeLegalChecker.jsx` (`team.rules?.rosterCount`) vs `tradeValidator.js` `allRules` shape.

3. **Team structural SSOT ambiguity (`roster` IDs vs `players` objects)**
   - **Category:** Structural data model / apply integrity
   - **Repro concept:** Traverse load -> trade apply -> invariant checks with mixed roster shape assumptions; semantics can diverge by call-site.
   - **Evidence:** `architect.ts` (`BaseTeamDocZ.roster` IDs), `firebaseTeamPlanHelpers.js` (`roster: players`), `tradeContext.js` (ID-style roster updates + object players updates), `contracts.js` allowlists.

### Majors

1. **General non-S&T player data structural quality is warning-heavy, not hard-blocked**
   - **Category:** Validator-only data integrity posture
   - **Repro concept:** Missing canonical salary paths can degrade to fallback/warning behavior.
   - **Evidence:** `dataValidation.js`, `matchingValues.js`, `tradeValidator.js` data warnings plumbing.

2. **Persistence-contract shape enforcement is environment-gated**
   - **Category:** Apply-time safeguard scope
   - **Repro concept:** In production/default non-enforced mode, allowlist violations are not thrown by `assertPersistableOrThrow`.
   - **Evidence:** `persistenceContracts/enforcement.js` (`shouldEnforcePersistenceContracts`).

### Minors

1. **FA exception tracker mixes local and validator data**
   - **Category:** UI-only informational drift risk
   - **Repro concept:** Display can drift from canonical legality outputs without affecting apply gates.
   - **Evidence:** `FaExceptionTracker.jsx`.

2. **Trade export view uses local reconstructed incoming lists and routing fallback semantics**
   - **Category:** UI/export only
   - **Repro concept:** Export presentation may differ from validator-routed canonical view in edge routing cases.
   - **Evidence:** `TradeExportCapture.jsx`.

---

## 8) Proposed Master Doc Deltas (do not apply)

1. **`docs/architect/TRADE_MACHINE_MASTER.md`**
   - Add explicit roster/two-way legality section indicating whether `executeTrade` currently enforces min/max/two-way at validator and apply.
   - Add parity matrix row for `team.rules.rosterCount` (wired vs not wired).

2. **`docs/SHIP_GATES_MASTER.md`**
   - Add manual smoke scenario for roster min/max + two-way overflow with explicit expected block behavior.
   - Add blocker rule: “implemented structural rules must be wired in validator and apply-time, not module-only.”

3. **`docs/architect/contracts/PERSISTENCE_CONTRACTS.md` (or equivalent contract docs)**
   - Clarify authoritative semantics for `roster` and `players` (IDs vs objects) and required invariants between them.

4. **Architect trade context/pipeline docs**
   - Add explicit structural rule coverage table for apply-time (`what is checked`, `what is intentionally deferred`, `what is validator-only`).

---

## 9) Validation Outputs (required commands)

1. `npm run test:trade -- --reporter=dot`  
   - **Status:** PASS  
   - **Summary:** 55 files passed; 513 passed, 1 skipped, 3 todo.

2. `npm run test:architect -- --reporter=dot`  
   - **Status:** PASS  
   - **Summary:** 136 files passed; 2206 passed, 1 skipped, 3 todo.

3. `npm run build`  
   - **Status:** PASS  
   - **Notes:** Build completed successfully; emitted non-blocking warnings (module externalization/chunk-size warnings).

4. `npm run validate:project`  
   - **Status:** PASS  
   - **Summary:** All project schema validations passed.

Commands intentionally skipped:
- Full suite commands (`npm run test`, `npm test`, `vitest`, `npm run test:full`) were **not run** per policy/prompt.

---

## 10) Exact files/functions referenced

- `docs/architect/TRADE_MACHINE_MASTER.md`
- `docs/SHIP_GATES_MASTER.md`
- `src/features/architect/tradeMachine/TradeEditor.jsx` (`canApplyTrade`, apply click guard)
- `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
- `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
- `src/features/architect/tradeMachine/CapImpactTiles.jsx`
- `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
- `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx`
- `src/features/architect/tradeMachine/FaExceptionTracker.jsx`
- `src/features/architect/tradeMachine/TradeExportCapture.jsx`
- `src/features/architect/hooks/useTradeMachine.js` (`handleValidate`, `hasCurrentValidation`, validation result composition)
- `src/features/architect/hooks/useTradeMachineSnapshot.js` (`getTeamSnapshot`, `getTradeSnapshot`)
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (`applyTradeToCapSheet`)
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` (`validateTrade`, `allRules` aggregation)
- `src/features/architect/utils/tradeMachine/rules/rosterValidation.js` (`validateRosterWindow`, `enforceRosterWindow`)
- `src/features/architect/utils/tradeMachine/rules/validateRoster.ts` (`validateRoster`)
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js` (`validateRoster`, `enforceRosterWindow`)
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js` (`validatePlayerRouting`)
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` (`validateEntitlementRouting`, `validateEntitlementLinkageLegality`)
- `src/features/architect/utils/tradeContext/tradeContext.js` (`buildPostTradeTeamsSnapshot`, `validatePostTradeSnapshotForContext`)
- `src/features/architect/utils/tradeContext/assertions.js` (`assertPostTradeSnapshot`, `assertValidatedTradeContext`)
- `src/features/architect/utils/mutationPipeline.js` (`applyWorldMutation`, `computeWorldMutation`, `validateMutation`, `persistWorldMutation`)
- `src/features/architect/utils/leagueInvariants.ts` (`validateNoDuplicatePlayers`, `validateMutationLeagueInvariants`, `validateNoDuplicateEntitlements`, `validateMutationEntitlementInvariants`, `validateTradeApplyExclusivity`)
- `src/features/architect/utils/persistenceContracts/contracts.js` (`TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST`)
- `src/features/architect/utils/persistenceContracts/enforcement.js` (`assertPersistableOrThrow`, `shouldEnforcePersistenceContracts`)
- `src/features/architect/utils/persistenceContracts/validatePersistableShape.js`
- `src/features/architect/utils/teamLoader.js` (`getTeam`, `hydrateTeamFromSnapshot`)
- `src/features/architect/utils/firebaseTeamPlanHelpers.js` (`hydrateBaseTeam`)
- `src/features/architect/utils/tradeMachine/utils/dataValidation.js`
- `src/schemas/architect.ts` (`BaseTeamDocZ`, `WorldTeamSnapshotZ`, `BasePlayerDocZ`, `BasePlayerContractZ`)
