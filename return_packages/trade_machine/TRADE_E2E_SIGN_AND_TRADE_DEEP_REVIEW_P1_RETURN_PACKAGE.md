# TRADE_E2E_SIGN_AND_TRADE_DEEP_REVIEW_P1_RETURN_PACKAGE

## STOP REPORT

### Triggered Stop Conditions

1. `STOP CONDITION #2` triggered: S&T can execute from Trade Machine without required new-contract details and there is no explicit blocking validator for missing S&T contract payload.
2. `STOP CONDITION #3` triggered: Validator-side S&T modeling and apply-time persistence paths diverge in required contract shape and semantics.
3. `STOP CONDITION #4` triggered: Trade-machine S&T apply path can commit team movement through `executeTrade` without a dedicated S&T contract write path.

### Why Stop Was Triggered (with code evidence)

- Trade-machine S&T action is toggled immediately in menu click path, with no contract capture step:
  - `src/features/architect/tradeMachine/TradePlayerRow.jsx:191-207`
  - `src/features/architect/hooks/useTradeMachine.js:487-500`
- Trade-machine apply goes through `executeTrade` flow:
  - `src/features/architect/tradeMachine/TradeEditor.jsx:440-483`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:567-631`
- `executeTrade` apply snapshots move players as routed assets, not via S&T signing contract mutation:
  - `src/features/architect/utils/tradeContext/tradeContext.js:184-249`
  - `src/features/architect/utils/mutationPipeline.js:925-963`
- Dedicated S&T mutation path is separate and requires prevalidated signing + post-trade validation context:
  - `src/features/architect/utils/mutationPipeline.js:3219-3360`
  - `src/features/architect/utils/mutationPipeline.js:2376-2411`

### Discovery Mode Confirmation

- This package is discovery-only.
- No functional code changes were made.
- No docs were edited.

---

## A) Ship-Readiness Verdict (S&T Subsystem)

**⚠️ Not ship-ready for S&T eligibility + contract handling + persistence.**

### Blockers

1. Trade-machine S&T eligibility gate is not tied to canonical FA state.
2. Trade-machine S&T action can proceed without required new-contract payload capture.
3. Validator does not enforce complete S&T contract payload presence.
4. Trade-machine apply path uses `executeTrade`, not dedicated `signAndTrade` signing/persistence semantics.
5. Free-agency modal S&T payload shape risk (`salaries[]` producer vs `salariesByYear[]` requirement in action handler).

---

## B) System Map (Authoritative SSOT Surfaces)

| Surface | File + Function | Key Inputs | Key Outputs | World-Awareness |
|---|---|---|---|---|
| UI entrypoint: Trade menu S&T | `src/features/architect/tradeMachine/TradePlayerRow.jsx` menu gate + click handlers (`:191-207`, `:395-407`) | `incoming`, `included`, `salaryForYear`, `signAndTradeActive` | Calls `onSetPlayerTrade(player, 'signAndTrade', otherTeams[0]?.id)` | Indirect (depends on loaded team/player state) |
| UI entrypoint: Trade state action | `src/features/architect/hooks/useTradeMachine.js` `setPlayerTrade` (`:461-500`) | `player`, `action`, `destTeamId` | Adds/updates `team.sends[]` with `signAndTrade: true`, `tradeTo` | Yes, team data loaded via `loadWorldTeamData` (`:3`, `:697-700`) |
| UI entrypoint: FA S&T modal | `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx` + `EditContractModal` wiring (`:172-186`) | FA row/player selection | Opens contract modal with actions override (`resign`, `signAndTrade`) | Yes (`worldId` passed through) |
| Eligibility derivation: FA pool | `src/features/architect/GMDashboard/hooks/useArchitectState.ts` free-agent effect (`:506-626`) | `worldAwarePlayers`, `worldRosterIndex`, `currentYear` | `freeAgents[]` with inferred `freeAgentType` | Yes (`getLeague(worldId)` path and roster index) |
| Eligibility derivation: modal action set | `src/shared/components/EditContractModal.jsx` (`:227-274`) | `freeAgentYear`, `contract.salariesByYear`, `futureContract.salariesByYear` | `actionSet` (`option`, `freeAgent`, `underContract`) | Uses current modal/player state |
| Eligibility derivation: trade-row gate | `src/features/architect/tradeMachine/TradePlayerRow.jsx` (`:83-89`, `:191-194`) | `primaryContract.salariesByYear`, `yearKey` | `salaryForYear` proxy used to show/hide S&T menu | Depends on loaded player shape; not canonical FA definition |
| Contract form state producer | `src/shared/components/EditContractModal.jsx` (`:146-150`, `:697-715`) | `extension.salaries[]`, `years`, `destinationTeamId` | `onSignAndTrade(player, contractPayloadWithSalariesArray, destinationTeamId)` | N/A |
| Contract shape gate in actions | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` `ensureContractStructure` (`:335-351`) and `handleSignAndTrade` (`:945-1021`) | `contract` payload from modal | Requires `contract.salariesByYear` or returns invalid payload error | Yes (`runAuthoritativeFAMutation`) |
| Validator entry | `src/features/architect/hooks/useTradeMachine.js` `validateCurrentTrade` (`:915-935`) | `teams[].sends`, `capProjections`, `tradeCtx` | `validateTrade` result stored for apply gate | Yes (`worldId` in `tradeCtx`) |
| S&T rule module | `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js` (`:5-133`) | `team.incomingPlayers`, `team.sends`, `tradeCtx` | Pass/fail + violations + hardCap flag | Context-dependent |
| Salary semantics used by validator | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` (`:590-599`, `:663-704`) + `matchingValues.js` (`:83-287`) | `matchIncoming/matchOutgoing`, contract salary rows | `salaryIn`, `salaryOut`, `projectedSalary`, legal status | Uses loaded team/player inputs |
| Apply-time trade route | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` `applyTradeToCapSheet` (`:567-631`) | `tradeData[]` with `outgoingPlayers`/routing fields | Runs authoritative `executeTrade` mutation | Yes |
| Apply pipeline (executeTrade) | `src/features/architect/utils/mutationPipeline.js` `computeWorldMutation` executeTrade branch (`:934-963`) | `payload.teams[].sends` | Snapshot -> validate context -> compute/persist | Yes (`loadStateForMutation` uses teamLoader fallback) |
| Apply snapshot mechanics | `src/features/architect/utils/tradeContext/tradeContext.js` (`:128-169`, `:184-249`) | Routed outgoing players (`tradeTo`, receiving fields) | Roster/player moves; 3+ team fail-closed routing invariant | Yes (state loaded per world) |
| Dedicated S&T mutation path | `src/features/architect/utils/mutationPipeline.js` `computeSignAndTradeResult` (`:3219-3360`) | `payload.contract.salariesByYear[]`, source/dest/player | Signing validation + trade snapshot validation + compute | Yes (`loadStateForMutation` via `getTeam/getPlayer`) |
| World/parent fallback chain | `src/features/architect/utils/teamLoader.js` `getTeam`/`getPlayer` (`:34-71`, `:211-257`) | `worldId`, `teamCode`, `playerId` | world -> parent world -> base | Yes (explicit recursive fallback) |

---

## C) End-to-End Flow Traces (4 Required)

### 1) Eligible FA S&T (happy path): open menu/modal -> input contract -> validate -> apply -> writes

#### Observed Pipeline-Correct Path (authoritative S&T mutation path)

1. Caller sends `mutationType: 'signAndTrade'` with `payload.contract.salariesByYear[]`.
2. `loadStateForMutation` loads source team, destination team, player:
   - `src/features/architect/utils/mutationPipeline.js:814-827`
3. `computeSignAndTradeResult`:
   - signing step (`computeSigningResult`) then `validateSigning`:
     - `src/features/architect/utils/mutationPipeline.js:3230-3273`
   - builds post-trade snapshot then validates once:
     - `src/features/architect/utils/mutationPipeline.js:3307-3336`
4. `validateMutation` requires prevalidated signing + trade contexts:
   - `src/features/architect/utils/mutationPipeline.js:2376-2411`
5. Persistence is atomic in one batch:
   - `src/features/architect/utils/mutationPipeline.js:2457-2603`
6. Cap hold removal occurs in signing compute step before trade:
   - `src/features/architect/utils/mutationPipeline.js:1590-1595`

#### Observed UI Gap Against This Path

- Free-agency modal emits `salaries[]` payload for S&T:
  - `src/shared/components/EditContractModal.jsx:697-715`
- Action handler requires `salariesByYear[]` (`ensureContractStructure`), otherwise blocks:
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:335-351`, `:982-1001`

---

### 2) Ineligible player (under contract) should NOT have S&T: UI gate + validator fallback

1. Trade-row S&T visibility gate uses salary-row proxy:
   - `!salaryForYear?.salary` in:
   - `src/features/architect/tradeMachine/TradePlayerRow.jsx:191-194`, `:395-398`
2. This is not the same definition as modal/free-agent state (`freeAgentYear` + contract-year derivation):
   - `src/shared/components/EditContractModal.jsx:227-274`
3. Validator S&T rule has no explicit “must be free agent” check:
   - `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js:5-133`

**Result:** this invariant is not guaranteed. UI and validator do not share canonical FA/ineligible definition.

---

### 3) Missing contract details: click S&T without contract -> block location

#### Trade-machine path (observed)

1. User clicks S&T in menu.
2. State toggles immediately with `signAndTrade: true` and `tradeTo`; no contract capture required:
   - `src/features/architect/tradeMachine/TradePlayerRow.jsx:196-201`
   - `src/features/architect/hooks/useTradeMachine.js:487-500`
3. Validation does not require full contract payload presence; only checks certain fields when explicitly set:
   - rejects only `contractYears === 2` and `firstYearGuaranteed === false`:
   - `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js:66-87`
4. Apply gate checks only “current validation exists and legal”:
   - `src/features/architect/tradeMachine/TradeEditor.jsx:442-483`

**Observed:** no guaranteed pre-apply block for missing S&T contract details in trade-machine path.

---

### 4) 3+ team S&T routing: route completeness + salary modeling + apply destination behavior

1. Builder tracks routed incoming players with explicit `tradeTo` for 3+ teams:
   - `src/features/architect/hooks/useTradeMachine.js:265-307`
2. Validator salary-in/out uses routed players only for 3+:
   - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:126-138`, `:680-704`
3. Apply snapshot is fail-closed for missing destination in 3+:
   - `src/features/architect/utils/tradeContext/tradeContext.js:128-169`, `:219-223`
4. Guardrail test confirms no write batch opens on 3+ routing failure:
   - `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts:106-129`

**Result:** 3+ routing fail-closed behavior is strong for destination routing itself.  
This does not solve missing/incorrect S&T contract semantics.

---

## D) Core Invariants (Pass/Fail)

| Invariant | Status | Evidence |
|---|---|---|
| 1) S&T cannot be executed for non-free-agents. | **Fail** | No explicit FA-only check in `validateSignAndTrade` (`validateSignAndTrade.js:5-133`); UI trade-row gate is salary proxy (`TradePlayerRow.jsx:191-194`). |
| 2) S&T requires contract details; missing contract blocks before apply. | **Fail** | Trade-menu S&T path sets flag + route without contract capture (`useTradeMachine.js:487-500`), and validator does not require full contract payload presence (`validateSignAndTrade.js:66-87`). |
| 3) Contract data used in validator matches apply-time persisted contract. | **Fail** | Trade-machine validator uses routed player matching values and sparse S&T fields; apply uses `executeTrade` snapshot move path (`tradeContext.js:184-249`) rather than dedicated S&T signing contract persistence path. |
| 4) Apply-time is fail-closed: invalid S&T payload cannot partially commit. | **Fail (partial protections exist)** | 3+ routing is fail-closed (`tradeContext.js:128-169`) and tested (`tradeApply_failClosed_noWrite.guardrail.test.ts:106-129`), but missing S&T contract payload is not a guaranteed blocking invalid state in trade-machine path. |
| 5) UI, validator, apply share same player status definition (FA/option/cap hold). | **Fail** | Modal uses `freeAgentYear` + contract-year derivation (`EditContractModal.jsx:227-274`), free-agent pool uses roster exclusion + expiry/option logic (`useArchitectState.ts:506-626`), trade-row gate uses salary-row proxy (`TradePlayerRow.jsx:191-194`). |

---

## E) Issues List (Blockers / Majors / Minors)

## Blockers

### B1) Trade-row S&T eligibility gate is not canonical FA gating

- **Severity:** Blocker
- **Why incorrect:** Uses `!salaryForYear?.salary` proxy, not canonical FA/under-contract state.
- **Repro (UI):**
  1. Open Trade Machine.
  2. Find player whose `salaryForYear` lookup resolves falsy for selected year.
  3. Observe S&T action appears even when canonical state is not clearly FA.
- **Impacted surfaces:**
  - `src/features/architect/tradeMachine/TradePlayerRow.jsx:83-89`, `:191-194`, `:395-398`
  - `src/shared/components/EditContractModal.jsx:227-274`
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:506-626`
- **Fix strategy:** Introduce one canonical eligibility helper used by trade row, modal, validator, and apply preconditions.

### B2) Trade-machine S&T action does not require new-contract capture

- **Severity:** Blocker
- **Why incorrect:** S&T can be set immediately from menu with no mandatory contract step.
- **Repro (UI):**
  1. Trade Machine row menu -> click `Sign-and-Trade`.
  2. Validate trade.
  3. If legal, apply without entering S&T contract.
- **Impacted surfaces:**
  - `src/features/architect/tradeMachine/TradePlayerRow.jsx:196-201`
  - `src/features/architect/hooks/useTradeMachine.js:487-500`
  - `src/features/architect/tradeMachine/TradeEditor.jsx:442-483`
- **Fix strategy:** Require contract capture before S&T can be represented in trade payload; hard-block validation otherwise.

### B3) S&T validator is partial/default-permissive on contract requirements

- **Severity:** Blocker
- **Why incorrect:** Rule only rejects explicit bad values for two fields; missing contract payload can pass.
- **Repro (fixture):**
  1. Build trade payload with `signAndTrade: true` and no `contractYears` / `firstYearGuaranteed`.
  2. Validate trade.
  3. Observe no dedicated “missing S&T contract data” violation.
- **Impacted surfaces:**
  - `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js:66-87`
- **Fix strategy:** Enforce required S&T contract object presence and completeness (years, first-year guarantee, amount rows) with hard errors.

### B4) Trade-machine apply path bypasses dedicated S&T signing mutation semantics

- **Severity:** Blocker
- **Why incorrect:** Trade-machine S&T persists through `executeTrade` player routing path, not `signAndTrade` signing+trade mutation contract semantics.
- **Repro (flow):**
  1. Trigger S&T in trade machine.
  2. Apply trade.
  3. Observe pipeline path is `executeTrade`.
- **Impacted surfaces:**
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:567-631`
  - `src/features/architect/utils/mutationPipeline.js:934-963`
  - `src/features/architect/utils/tradeContext/tradeContext.js:184-249`
- **Fix strategy:** Unify trade-machine S&T apply onto dedicated S&T mutation contract or enforce equivalent pre-signing and contract persistence semantics in executeTrade path.

### B5) Free-agency modal S&T payload shape mismatch risk

- **Severity:** Blocker
- **Why incorrect:** Modal emits `salaries[]`, action handler requires `salariesByYear[]` through `ensureContractStructure`.
- **Repro (UI):**
  1. Free Agency -> open `EditContractModal`.
  2. Choose `Sign & Trade`, enter destination, confirm.
  3. Handler can fail with invalid contract payload if no `salariesByYear`.
- **Impacted surfaces:**
  - `src/shared/components/EditContractModal.jsx:697-715`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:335-351`, `:982-1001`
- **Fix strategy:** Normalize modal S&T contract payload into canonical `salariesByYear[]` before action dispatch.

## Majors

### M1) Split eligibility definitions across UI/validator/apply

- **Severity:** Major
- **Why incorrect:** Different parts use different state definitions (`freeAgentYear`, roster index exclusion, salary proxy).
- **Impacted surfaces:**
  - `useArchitectState.ts:506-626`
  - `EditContractModal.jsx:227-274`
  - `TradePlayerRow.jsx:191-194`
- **Fix strategy:** Centralize FA/under-contract/option-state resolver and use everywhere.

### M2) Validator rule docs and implementation semantics are not fully aligned

- **Severity:** Major
- **Why incorrect:** Docs imply strict S&T constraints; current implementation does not fully enforce contract presence and FA-only checks.
- **Impacted surfaces:**
  - `docs/guides/ORDER_OF_OPERATIONS.md:36-44`
  - `validateSignAndTrade.js:5-133`
- **Fix strategy:** Update docs to current behavior now, then update implementation and docs together to target behavior.

## Minor

### m1) Trade-row salary-year matching uses mixed comparisons prone to false-negative current-year row detection

- **Severity:** Minor
- **Why incorrect:** Salary-row detection can miss canonical season row depending on selected year formatting.
- **Impacted surfaces:**
  - `TradePlayerRow.jsx:83-89`
- **Fix strategy:** Use canonical season normalization helper for row lookup.

---

## F) Verification Checklist

### Manual Smoke Scenarios (12)

1. Under-contract player with valid current-season salary row does not show S&T menu action.
2. True FA player shows S&T action only when canonical FA state is satisfied.
3. Trade-machine S&T click without contract entry is blocked with explicit message.
4. Trade-machine S&T with contract entry proceeds to validation and shows S&T rule outcome.
5. Apply button remains disabled until current validation is legal.
6. 3-team trade with explicit S&T routing validates and applies to correct destination.
7. 3-team trade missing S&T destination fails with routing error and no partial commit.
8. Free-agency modal S&T requires destination selection (confirm disabled without destination).
9. Free-agency modal S&T payload reaches action handler in canonical `salariesByYear[]` shape.
10. Receiver hard-cap consequence appears when receiving S&T player.
11. Parent-world inherited team/player state produces same S&T eligibility result as direct world snapshot.
12. Re-open and reload world after apply; team/player movement and contract state remain consistent.

### Automated Test Expectations (10)

1. Trade validator rejects S&T for non-FA status (new dedicated test expected).
2. Trade validator rejects S&T when required contract payload fields are missing.
3. Trade validator enforces offseason S&T timing.
4. Trade validator enforces origin-team restriction.
5. Trade validator enforces S&T receiving-team hard-cap consequence.
6. Pipeline S&T path validates signing before post-trade snapshot validation.
7. Pipeline S&T path fails closed when signing contract payload is invalid.
8. Trade apply fails closed with no batch write on 3+ routing failure (existing guardrail).
9. Trade-machine S&T UI gate uses canonical shared eligibility helper (new UI/unit test expected).
10. Modal S&T output contract shape includes canonical `salariesByYear[]` expected by action handler.

### Gate Commands

Executed:

1. `npm run test:trade -- --reporter=dot`
2. `npm run test:architect -- --reporter=dot`
3. `npm run build`
4. `npm run validate:project`

Intentionally skipped:

1. `npm run test:full` (not permitted unless prompt contains `RUN FULL SUITE`)

---

## G) Evidence Register

### Existing Tests Encoding Behavior

- `tests/trade/signAndTrade_completeness.test.js`
- `tests/trade/input_validation.test.js`
- `src/tests/architect/signAndTrade.test.js`
- `tests/architect/EditContractModal.rules.test.jsx`
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
- `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts`
- `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts`
- `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js`
- `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js`

### Decisive Logic Locations

- Trade menu S&T gate/action:
  - `src/features/architect/tradeMachine/TradePlayerRow.jsx:191-207`
  - `src/features/architect/hooks/useTradeMachine.js:487-500`
- Trade validation path:
  - `src/features/architect/hooks/useTradeMachine.js:915-935`
  - `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:126-138`, `:663-704`, `:748`
  - `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js:5-133`
- Apply and persistence:
  - `src/features/architect/tradeMachine/TradeEditor.jsx:442-483`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:567-631`
  - `src/features/architect/utils/mutationPipeline.js:934-963`, `:2457-2603`
  - `src/features/architect/utils/tradeContext/tradeContext.js:128-169`, `:184-249`
- Dedicated S&T mutation path:
  - `src/features/architect/utils/mutationPipeline.js:3219-3360`
- World/parent fallback:
  - `src/features/architect/utils/teamLoader.js:34-71`, `:211-257`

### TODOs / Assumptions / Inference Boundaries

- Inference: Trade-machine path can commit S&T-like movement without dedicated contract write semantics because it uses `executeTrade` routing path.
- Inference: Missing required S&T contract fields are not fully fail-closed in validator because presence checks are not explicit.
- Assumption: Current behavior is representative across Architect world contexts due shared hooks/pipeline usage.

---

## Specific Questions (Required) — Evidence-Based Answers

### 1) Exactly what data field(s) define “Free Agent” vs “Under Contract” vs “Option year”?

- **No single SSOT field today.**
- Modal:
  - Free Agent: `player.freeAgentYear && player.freeAgentYear <= CURRENT_YEAR`
  - Under Contract: derived from `contractYears.some(y.year >= CURRENT_YEAR)` where `contractYears` comes from `contract.salariesByYear` + `futureContract.salariesByYear`
  - Option year: first future contract row with `option`
  - Evidence: `src/shared/components/EditContractModal.jsx:191-274`
- Free-agent pool:
  - World mode: player not in `worldRosterIndex`
  - Base mode: contract missing/empty or expired/expiring/option-next-year logic
  - Evidence: `src/features/architect/GMDashboard/hooks/useArchitectState.ts:506-626`
- Trade-row S&T gate:
  - Proxy: `!salaryForYear?.salary`
  - Evidence: `src/features/architect/tradeMachine/TradePlayerRow.jsx:83-89`, `:191-194`

### 2) Where is S&T UI action gated, and is gate based on correct definition?

- Gate locations:
  - `src/features/architect/tradeMachine/TradePlayerRow.jsx:191-194`, `:395-398`
- Gate condition:
  - `!incoming && !included && !salaryForYear?.salary && (!signAndTradeActive || player.signAndTrade)`
- **Assessment:** not based on canonical FA-state definition. It is salary-row proxy based.

### 3) Exact contract object shape used for S&T in trade payload?

- Trade-machine payload:
  - `teams[].sends[]` player objects with `signAndTrade`, routing fields (`tradeTo`, mapped to `receivingTeamId/Index` on apply transform), plus whatever contract fields already exist on player.
  - Evidence: `useTradeMachine.js:487-500`, `:992-1013`; `useArchitectActions.ts:582-609`
- Dedicated S&T mutation payload:
  - `mutationType: 'signAndTrade'` with `payload.contract.salariesByYear[]`.
  - Evidence: `mutationPipeline.js:814-827`, `:3219-3236`

### 4) Does salary matching use S&T contract AAV, first-year salary, or something else?

- It uses canonical matching values (`matchIncoming` / `matchOutgoing`) from contract year row for selected season, preferring `capHit` then `salary`, with fallback fields when missing.
- Evidence:
  - `tradeValidator.js:590-599`, `:663-704`
  - `matchingValues.js:99-126`, `:170-177`, `:250-251`
  - `seasonUtils.js:68-79`

### 5) Where are cap holds removed/updated during apply, if at all?

- Dedicated signing path removes cap hold in `computeSigningResult`:
  - `mutationPipeline.js:1590-1595`
- Dedicated S&T path uses signing first, then trade:
  - `mutationPipeline.js:3230-3277`
- Trade-machine `executeTrade` path does not include dedicated S&T cap-hold removal semantics; it applies roster/player routing snapshot:
  - `tradeContext.js:184-249`

### 6) If world inheritance is involved, does child world correctly inherit player status for eligibility?

- Loader chain correctly resolves child world -> parent world -> base for teams/players:
  - `teamLoader.js:34-71`, `:211-257`
- Mutation pipeline state loading relies on teamLoader for world-aware reads:
  - `mutationPipeline.js:696-827`
- Guardrail test confirms parent fallback state influences cap-legality evaluation:
  - `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts:109-148`
- **Caveat:** despite correct fallback loading, eligibility interpretation still diverges across UI/validator/apply due split status definitions.

---

## H) Proposed Master-Doc Deltas (Do Not Edit Docs In This Preflight)

## Proposed delta: `docs/architect/TRADE_MACHINE_MASTER.md`

Add explicit section:

1. Trade-machine S&T currently represented as routed trade asset flag (`signAndTrade`) in `teams[].sends[]`.
2. Dedicated mutation pipeline S&T is separate (`mutationType: signAndTrade`) and requires canonical contract payload.
3. Clarify required contract payload fields for any S&T execution path.
4. Clarify that eligibility must be based on shared FA status resolver, not salary-row proxy.
5. Add parity requirement: validator contract assumptions must match apply-time persisted contract shape.

## Proposed delta: `docs/guides/ORDER_OF_OPERATIONS.md`

Update S&T rules subsection to reflect enforced vs intended behavior:

1. Add explicit “required contract payload presence” requirement.
2. Add explicit “non-FA status is ineligible for S&T” requirement.
3. Add note that route-aware validation and apply-time route fail-closed are enforced for 3+ team trades.
4. Add note that S&T eligibility and contract checks must be shared across UI, validator, and apply pipeline.

---

## Validation Commands Run (Evidence)

1. `npm run test:trade -- --reporter=dot`  
   Result: passed (`53` files, `504` passed, `1` skipped, `3` todo).
2. `npm run test:architect -- --reporter=dot`  
   Result: passed (`134` files, `2200` passed, `1` skipped, `3` todo).
3. `npm run build`  
   Result: passed. Non-blocking warnings observed (chunk-size/dynamic import/Browserslist age).
4. `npm run validate:project`  
   Result: passed. All validations passed.

---

### RETURN PACKAGE (PASTE BACK)

1) Ship-Readiness Verdict  
`⚠️ Not ship-ready` for S&T eligibility + contract handling + persistence parity.

2) Blockers list (if any)

- B1: Trade-row S&T eligibility is salary-proxy based, not canonical FA-state based.
- B2: Trade-machine S&T action does not require new-contract capture.
- B3: Validator S&T contract checks are partial/default-permissive.
- B4: Trade-machine apply uses `executeTrade` path rather than dedicated S&T signing semantics.
- B5: Free-agency modal S&T payload shape risk (`salaries[]` vs expected `salariesByYear[]`).

3) Ordered fix plan (1–10)

1. Define one canonical eligibility resolver for FA/under-contract/option state.
2. Replace trade-row S&T salary-proxy gate with canonical eligibility resolver.
3. Add mandatory S&T contract capture step in Trade Machine before `signAndTrade` flag can be set.
4. Normalize all S&T contract payloads to canonical `salariesByYear[]` shape at UI boundary.
5. Add explicit validator hard-fail checks for missing S&T contract payload fields.
6. Add explicit validator hard-fail check for non-FA S&T attempts.
7. Enforce validator/apply parity by validating the same contract shape that apply persists.
8. Decide and implement single authoritative apply path for S&T (dedicated mutation or parity-equivalent executeTrade path).
9. Add tests for UI gating, missing contract blocking, non-FA rejection, and payload parity.
10. Update `TRADE_MACHINE_MASTER` and `ORDER_OF_OPERATIONS` to match enforced behavior and invariants.

4) Verification checklist (manual + automated)

- Manual (12): see Section F.
- Automated (10): see Section F.
- Gate commands: `test:trade`, `test:architect`, `build`, `validate:project` passed.
- Full suite intentionally not run (no `RUN FULL SUITE` directive).

5) Exact files/functions referenced

- `src/features/architect/tradeMachine/TradePlayerRow.jsx`
- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/shared/components/EditContractModal.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js`
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
- `src/features/architect/utils/tradeMachine/utils/seasonUtils.js`
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/teamLoader.js`
- `src/features/architect/utils/worldTeamData.ts`
- `tests/trade/signAndTrade_completeness.test.js`
- `tests/trade/input_validation.test.js`
- `tests/architect/EditContractModal.rules.test.jsx`
- `src/tests/architect/signAndTrade.test.js`
- `src/tests/architect/useArchitectActions.freeAgency.test.tsx`
- `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts`
- `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts`
- `src/tests/architect/phase63_signAndTrade_restoration_guardrails.test.js`
- `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.js`

6) STOP REPORT (if any stop condition triggered)

Triggered and included at top of this document:

- `#2` S&T can execute without required contract details in trade-machine path.
- `#3` Validator and apply-time S&T modeling diverge.
- `#4` Apply-time can commit S&T-like movement without dedicated S&T contract write path in trade-machine flow.
