# TRADE_MACHINE_MASTER

Last updated: 2026-03-08

## Trade Machine Overview

`validateTrade` is the canonical legality gate for Trade Machine proposals. It guarantees:

- Deterministic validation for each participating team using the same routed asset view used by apply-time flows.
- Routing legality for outgoing assets (players, entitlements, and cash where modeled):
  - In multi-team trades (3+ teams), every outgoing asset must have an explicit destination team.
- Ownership and structural legality checks before trade commit (including entitlement routing and linkage checks).
- Salary/cap/apron rule evaluation using computed incoming/outgoing values per team.
- Fail-closed behavior: unresolved invariant/routing errors block legality.

## Test Gates

Primary gate:

- `npm run test:trade -- --reporter=dot`

Secondary confidence gates for this area:

- `npm run test:architect -- --reporter=dot`
- `npm run build`
- `npm run validate:project`

## Known Baseline Failures

None.

## E1 — Trade Test Gate Stabilization

### What Was Fixed

1. Repaired 3+ team route-aware incoming player and salary calculations in `tradeValidator` so validation does not treat incoming assets as broadcast from all other teams.
2. Standardized team identity and player destination resolution across:
   - route checks
   - salary matching
   - summary generation
   - entitlement-routing-adjacent team identity usage
3. Updated stale 3-team fixtures to include explicit player destinations so pre-validation routing checks do not mask downstream rule evaluation.
4. Added a targeted regression test ensuring second-apron incoming-salary restrictions in 3-team trades use routed incoming values rather than broadcast assumptions.

### Clarified Rules (LOCKED)

#### A) Multi-team routing requirement (3+ teams)

- In 3+ team trades, **outgoing players must have explicit destination routing**.
- **Definition:** every outgoing player must specify a destination team via the canonical destination field.
- Trades that violate this fail early with routing legality errors (by design), and downstream rules (salary/apron/etc.) must not be expected to run if routing is incomplete.

#### B) Canonical destination field (and supported aliases)

- **Canonical destination field:** `toTeamId`
- Supported aliases (backward compatibility only): `tradeTo`, `destTeamId`
- New call sites and new fixtures should use `toTeamId`. Aliases exist only to tolerate older shapes.

#### C) Two-team routing legacy fallback (2 teams only)

- In 2-team trades, missing player destination uses a **legacy backward-compatible fallback** behavior.
- This fallback is **not** valid for 3+ team trades and must not be expanded to multi-team behavior.
- New code and fixtures should still supply `toTeamId` for clarity even in 2-team cases.

#### C.1) Apply-time fail-closed routing invariant (3+ teams)

- Apply-time snapshot building now enforces the same 3+ destination requirement as validator routing.
- If any outgoing player in a 3+ team trade has missing/invalid destination routing, apply fails loudly with `TRADE_APPLY_ROUTING_ERROR`.
- No partial apply writes are committed when this invariant fails.

#### D) Second apron incoming salary restriction (route-aware)

- The “second apron team cannot receive more salary than it sends” restriction is evaluated using **routed incoming salary**.
- In 3+ team trades, only explicitly routed incoming players count toward incoming salary. There is no broadcast/implicit incoming behavior.

#### E) Entitlement legality remains fail-closed

- Entitlement invariants remain fail-closed and are not bypassed by trade validation:
  - league claim uniqueness protections
  - linked package completeness enforcement
  - resolver invariant violation protections

### Current Test Gate Status

- `npm run test:trade -- --reporter=dot`: PASS
- `npm run test:architect -- --reporter=dot`: PASS
- `npm run build`: PASS
- `npm run validate:project`: PASS

## Roster Structural Legality

### Enforced Rules

`validateTrade` enforces the following roster structural rules per team:

- **Standard roster minimum (14):** post-trade standard (non-two-way) player count must be >= 14.
- **Standard roster maximum (15):** post-trade standard player count must be <= 15.
- **Two-way maximum (3):** post-trade two-way player count must be <= 3.

Constants: `MIN_ROSTER=14`, `MAX_ROSTER=15`, `MAX_TWO_WAY=3`.

### Enforcement Flags

Enforcement respects `validationFlags` in `src/config/validationFlags.js`:

- `rosterEnforcement: 'error'` — standard roster violations block the trade.
- `twoWayRoster: 'error'` — two-way violations block the trade.

When set to `'warn'`, violations are reported but do not block trade legality.

### Rule Output Key

The validator produces `team.rules.rosterCount` with shape:

- `passed: boolean`
- `violations: string[]`
- `message: string`
- `details: string` (human-readable projected counts)
- `rosterCounts: { standard: number, twoWay: number }`

`TradeLegalChecker` reads `team.rules.rosterCount` directly.

### SSOT: Team Player Arrays

The roster count helper handles two team data shapes:

- **UI flow (pre-trade):** `team.team.players` = standard players, `team.team.twoWayPlayers` = two-way (separate arrays). The helper subtracts outgoing and adds incoming to compute projected counts.
- **Apply flow (post-trade):** `team.team.players` = all players (already adjusted by `buildPostTradeTeamsSnapshot`). The helper uses player-ID matching to avoid double-counting — outgoing players already removed from roster are not re-subtracted, and incoming players already in roster are not re-added.

### Apply-Time Enforcement

Apply-time re-validation calls `validatePostTradeSnapshotForContext()` → `validateTrade()`. Since roster rules are wired into `validateTrade`, they are automatically enforced at apply time. An illegal roster state causes `legal: false`, which blocks `executeTrade` before `batch.commit()`.

### Test Coverage

- `tests/trade/rosterLegality_validateTrade.test.js` — max overflow, min underflow, two-way overflow through `validateTrade`
- `tests/trade/roster_twoWay_enforcement.test.js` — `enforceRosterWindow` callback-based enforcement
- `tests/trade/rosterWindow_softEnforcement.test.js` — soft enforcement / grace mode

---

## E1 — Sign-And-Trade (S&T) Fail-Closed Alignment

### Canonical Eligibility Definition (SSOT)

S&T eligibility is resolved through:

- `src/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility.ts`

Authoritative status outcomes:

- `UNDER_CONTRACT`
- `FREE_AGENT`
- `CAP_HOLD`
- `UNKNOWN`

Eligibility rule:

- S&T is legal only for `FREE_AGENT` or `CAP_HOLD`.
- `UNDER_CONTRACT` and `UNKNOWN` fail closed.
- Source-team alignment must be valid (team reference and/or active cap-hold evidence).

### Required S&T Contract Payload Shape

Any outgoing S&T asset must include canonical payload on the send entry:

- `send.signAndTrade = true`
- `send.signAndTradeContract.salariesByYear[]`
- `send.signAndTradeContract.contractYears`
- `send.signAndTradeContract.firstYearGuaranteed`
- `send.tradeTo` (destination)

Canonical row shape:

- `{ season, salary, capHit, guaranteed }`

### Trade Machine Capture Flow

Trade Machine S&T is contract-capture first:

- Clicking `Sign-and-Trade` opens contract modal.
- User must provide destination + valid contract.
- State is only written after modal confirm:
  - `send.signAndTrade`
  - `send.signAndTradeContract`
  - `send.tradeTo`

Cancellation writes nothing.

### Validator / Apply Parity Guarantee

Validator and apply-time use the same S&T helpers:

- `isSignAndTradeEligible(...)`
- `resolveSignAndTradeContractPayload(...)`
- `validateSignAndTradeContractPayload(...)`

Salary matching parity:

- Matching values use S&T first-year salary from `signAndTradeContract.salariesByYear[]` when `signAndTrade` is active.

### Apply-Time Atomic Semantics

Execute-trade apply now enforces S&T preflight before writes:

- missing/invalid destination -> block
- ineligible player status -> block
- missing/invalid S&T contract payload -> block

On success, same atomic mutation path applies:

- player move
- S&T contract persistence on receiving player snapshot
- source cap-hold removal for that player
- receiver hard-cap trigger metadata

No partial commit is allowed when S&T preflight fails.

### Hard-Cap Consequence Representation

Receiving an S&T player sets hard-cap fields on receiver snapshot:

- `team.hardCapped = 1` (or preserves stronger pre-existing level)
- `team.hardCapTriggered = 'SignAndTrade'`
- `team.hardCapFirstApron.active = true`
- `team.totals.isHardCapped = true`
- `team.totals.hardCapLevel = 'firstApron'` (unless already second-apron constrained)

## TPE (Trade Player Exception) Semantics

### Canonical Storage

- **SSOT location:** `team.exceptions.tpe[]` (Phase 64)
- **Legacy fallback:** `team.tradeExceptions[]` (read-only backward compat; removed before Firestore write)
- **SSOT accessor:** `getTeamTpeList(team)` in `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
  - Prefers canonical `team.exceptions.tpe[]`; falls back to `team.tradeExceptions[]` with telemetry
  - Normalizes field names (`totalAmount` ↔ `amount`, `remainingAmount` ↔ `remaining`, `expiresOn` ↔ `expirationDate`)

### TPE Creation

TPEs are created at trade apply-time when a team sends out more salary than it receives while over the salary cap:

- Computed in `computeTradeResult` (`mutationPipeline.js`)
- Idempotent: signature-based duplicate detection prevents double-creation
- Fields: `id`, `amount`, `totalAmount`, `remainingAmount`, `usedAmount`, `createdSeason`, `expiresOn`, `createdFrom`, `isUsed`

### TPE Absorption (Usage)

To absorb a player via TPE, both `absorptionMode` and `tpeId` must be set on the incoming player:

- **UI path:** TradeTeamCard absorption mode dropdown → "TPE" → TPE selector → `setTpeId` action
- **State:** Sets `player.absorptionMode = 'TPE'` and `player.tpeId = <selected TPE id>` on the outgoing send entry

### Fail-Closed Rules (Enforced)

**Validator** (`validateTradeExceptions.js`):

1. If `absorptionMode === 'TPE'` then `tpeId` must be a non-empty string → violation: "no tpeId specified"
2. If `tpeId` is set, it must resolve to a TPE in the team's `appliedTPEs` or `tradeExceptions` → violation: "does not exist on this team"
3. TPE must not be expired, already consumed, or too small for the player's salary
4. Prior-year TPEs cannot be used by second-apron teams
5. TPE cannot be combined with outgoing salary

**Apply-time** (`mutationPipeline.js`):

1. If `absorptionMode === 'TPE'` then both `tpeId` and `matchIncoming` must be present → hard error, mutation blocked
2. On valid usage: `remainingAmount` decremented, `usedAmount` incremented, `isUsed` set when `remainingAmount === 0`
3. If fail-closed errors exist, the entire trade mutation returns `{ success: false }` — no partial writes

### Removed UI Paths

The following dead paths were removed (E2E TPE fix, 2026-02-26):

- `TradePlayerRow` "Use Trade Exception" menu button (emitted `'tradeException'` action with no handler)
- `OutgoingPlayersList` TradeExceptionModal (never opened)
- `TradeEditor` `handleApplyTradeException` (relied on `tpe.teamId` which didn't exist)
- `useTradeMachine` `applyTradeException` callback (never called)
- `shared/components/TradeExceptionModal.jsx` and `tradeMachine/TradeExceptionModal.jsx` (deleted)
- `TradeExceptionManager` click-to-apply callback (made display-only)

The authoritative TPE usage path is exclusively through TradeTeamCard's absorption mode dropdown + TPE selector.

### DPE / Other Exceptions (Out of Scope)

DPE (Disabled Player Exception) is editable via `ManageExceptionsModal` but has separate lifecycle from TPE. DPE parity with validator is deferred to a future change.

---

## 5-Pack Ship Closeout

Date: 2026-02-26

### Scorecard

| #   | Pillar                                        | Status   | SSOT Enforcement Point(s)                                                                                                                                                                                         | Evidence                                                                                                                   |
| --- | --------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Salary matching                               | **PASS** | Validator: `validateSalaryMatching()` → `allRules.salaryMatching`. Apply: `validatePostTradeSnapshotForContext()` → same `validateTrade()`                                                                        | `TRADE_E2E_TRADE_APPLY_CONSISTENCY_DEEP_REVIEW_P1_RETURN_PACKAGE.md`                                                       |
| 2   | Sign-and-trade                                | **PASS** | Validator: `validateSignAndTrade()` → `allRules.signAndTrade`. Apply: `buildPostTradeTeamsSnapshot()` S&T preflight throws `SIGN_AND_TRADE_APPLY_ERROR`; re-validated via `validatePostTradeSnapshotForContext()` | `TRADE_E2E_SIGN_AND_TRADE_DEEP_REVIEW_P1_RETURN_PACKAGE.md`, `TRADE_E2E_SIGN_AND_TRADE_FIX_E1_EXECUTION_RETURN_PACKAGE.md` |
| 3   | Validator ↔ apply ↔ persistence consistency | **PASS** | Apply calls same `validateTrade()` via `validatePostTradeSnapshotForContext()`. Additional apply-only gates: league invariants, entitlement invariants, exclusivity. Single `batch.commit()` atomicity.           | `TRADE_E2E_TRADE_APPLY_CONSISTENCY_DEEP_REVIEW_P1_RETURN_PACKAGE.md`                                                       |
| 4   | Multi-team routing semantics                  | **PASS** | Validator: `validatePlayerRouting()` + `validateEntitlementRouting()` enforce explicit 3+ destinations. Apply: `buildPostTradeTeamsSnapshot()` throws `TRADE_APPLY_ROUTING_ERROR`                                 | `TRADE_TESTS_FIX_E1_EXECUTION_RETURN_PACKAGE.md`, Clarified Rules A–E above                                                |
| 5   | Roster + structural legality                  | **PASS** | Validator: `computeRosterValidation()` → `allRules.rosterCount` (min 14, max 15, two-way max 3). Apply: same rules via `validatePostTradeSnapshotForContext()` block before `batch.commit()`                      | `TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_FIX_E1_EXECUTION_RETURN_PACKAGE.md`                                              |

### Key Return Packages

- `return_packages/trade_machine/TRADE_E2E_TRADE_APPLY_CONSISTENCY_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_FIX_E1_EXECUTION_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_SIGN_AND_TRADE_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_SIGN_AND_TRADE_FIX_E1_EXECUTION_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_TPE_EXCEPTIONS_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_TPE_EXCEPTIONS_FIX_E1_EXECUTION_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_CAP_APRON_HARDENING_E1_EXECUTION_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_CAP_APRON_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TRADE_E2E_TRADE_MACHINE_5PACK_CLOSEOUT_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_DEEP_REVIEW_P1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_TRUST_FIXES_E1_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_CONTRACT_CLEANUP_E2_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_HARDENING_E3_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_RULE_CORRECTNESS_AUDIT_P2_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_RULE_FIXES_E4_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_RULES_E5_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_TS_CONSENT_ELIGIBILITY_E6_RETURN_PACKAGE.md`
- `return_packages/trade_machine/TM_VALIDATOR_TIMING_REVALIDATION_P3_RETURN_PACKAGE.md`

### Validator Trust Audit (2026-03-07)

- Verdict: The Trade Machine validator is only partially trustworthy and should not be converted to TypeScript before correctness cleanup.
- STOP condition: Triggered.
- Top risks:
  - world/offseason context does not reliably reach the authoritative validator path
  - two-way and FA-exception trade rules are implemented in disconnected or non-authoritative modules
  - preview/UI legality can diverge from authoritative apply legality
- Return package: `return_packages/trade_machine/TM_VALIDATOR_DEEP_REVIEW_P1_RETURN_PACKAGE.md`

### Validator Trust Fixes E1 (2026-03-07)

- Status: The major validator blockers from the 2026-03-07 trust audit were fixed in the authoritative preview/apply path.
- Major risks closed:
  - canonical `asOfDate` / season-state context now reaches both preview and apply validation
  - two-way and FA-exception legality now run through authoritative `validateTrade()`
  - override state no longer rewrites authoritative legality in preview/apply UI
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TRUST_FIXES_E1_RETURN_PACKAGE.md`

### Validator Contract Cleanup E2 (2026-03-07)

- Status: The authoritative validator contract and official validator consumers were aligned; no blocker-level contract drift remains in the reviewed preview/apply path.
- Remaining TS blockers:
  - individual issue payloads are still mixed strings/objects even though per-rule envelopes and top-level result fields are now standardized
  - `validateSignAndTrade.js` and `timingValidation.js` still split related timing ownership
- Return package: `return_packages/trade_machine/TM_VALIDATOR_CONTRACT_CLEANUP_E2_RETURN_PACKAGE.md`

### Validator Hardening E3 (2026-03-07)

- Status: The last validator-core TS blockers from E2 were closed in the authoritative path. Issue payload items are now canonical structured objects, and S&T-specific timing ownership now lives under `validateSignAndTrade.js` with generic timing left in `timingValidation.js`.
- TS migration note:
  - targeted validator TS migration can now begin
  - migrate the shared validator contract layer first: `ValidationIssue` / result types, `validationIssueText.js`, `tradeValidator.js`, and `tradeContext` contract surfaces before moving deeper into individual rule modules
- Return package: `return_packages/trade_machine/TM_VALIDATOR_HARDENING_E3_RETURN_PACKAGE.md`

### Validator Rule Correctness Audit P2 (2026-03-08)

- Verdict: Not yet substantively trustworthy; blocker-level TPE and cash rule-processing gaps remain in the authoritative path.
- STOP condition: Triggered.
- TS migration note: Pause validator rule-module migration; continue only already-clean shared contract/helper surfaces if needed.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_RULE_CORRECTNESS_AUDIT_P2_RETURN_PACKAGE.md`

### Validator Rule Fixes E4 (2026-03-08)

- Status: The P2 substantive rule blockers were fixed in the authoritative preview/apply path. Canonical TPE expiry now reads validator `tradeDate`, live TPE restrictions now run from actual normalized TPE usage, and seasonal cash-limit enforcement now reads `cashSent`.
- TS migration note:
  - targeted validator rule-module migration may resume
  - keep migration scoped and behavior-first; do not reopen live-path rule semantics without equivalent validator/apply regression coverage
- Return package: `return_packages/trade_machine/TM_VALIDATOR_RULE_FIXES_E4_RETURN_PACKAGE.md`

### Validator TS Rules E5 (2026-03-08)

- Status: The authoritative post-E4 TPE helper/rule path is now in TS (`tpeValidation.ts` + `validateTradeExceptions.ts`), and the authoritative `validateCash` surface now runs from `validateCash.ts`.
- TS migration note:
  - compatibility JS hosts remain in place for `tradeUtilities.js`, `validateTradeExceptions.js`, and `eligibilityRules.js` so the live import chain and guardrail path assumptions stay stable
  - next migrate the small consent/eligibility cluster only after the remaining JS holdouts in that area are re-validated
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_RULES_E5_RETURN_PACKAGE.md`

### Validator TS Consent Eligibility E6 (2026-03-08)

- Status: The authoritative consent surface is now in TS (`validateConsent.ts` + `enforceConsent.ts`), the eligibility surface is now in TS (`validateEligibility.ts`), and reacquisition ownership for this cluster is now consolidated in `validateReacquisition.ts`.
- TS migration note:
  - all E6-touched JS files are now pure re-export compatibility shims only, including the narrowed `eligibilityRules.js` host
  - helper enforcers still return plain strings while validator surfaces now emit canonical `ValidationIssue` objects
  - next revisit the generic timing validation/enforcement cluster only after separate behavior re-validation
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CONSENT_ELIGIBILITY_E6_RETURN_PACKAGE.md`

### Validator Timing Revalidation P3 (2026-03-08)

- Verdict: Generic timing is not yet substantively trustworthy; STOP condition triggered.
- TS migration note:
  - pause generic timing TS migration until timing warning/error routing and 60-day aggregation semantics are fixed
  - return package: `return_packages/trade_machine/TM_VALIDATOR_TIMING_REVALIDATION_P3_RETURN_PACKAGE.md`

### Validator Timing Fixes E7 (2026-03-08)

- Status: The P3 blocker-level generic timing defects are fixed in the authoritative path.
- What changed:
  - warning-mode generic timing now remains canonical warning output in `validateTrade()` and no longer flips legality to false
  - the same timing warning now propagates through team rule warnings, team warnings, top-level validator warnings, `_validatedTradeContext.warnings`, and `applyWorldMutation().warnings`
  - the legacy 60-day aggregation timing rule is retired from authoritative enforcement because the live payload still does not carry a reliable acquisition-date field
  - the December 15 generic rule was reviewed and left unchanged because this pass did not confirm an authoritative false-block path that required a boundary change
- TS migration note:
  - generic timing TS migration may now proceed for the remaining active timing rules
  - the retired 60-day rule must stay disabled until a real acquisition-date contract exists
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TIMING_FIXES_E7_RETURN_PACKAGE.md`

### Validator TS Timing E8 (2026-03-08)

- Status: The active generic timing implementation is now TS-backed in the authoritative path.
- TS migration note:
  - active generic timing business logic now lives in `rules/timingValidation.ts`, `utils/tradeTimingWindows.ts`, and `utils/timingUtils.ts`
  - `rules/timingValidation.js` and `utils/tradeTimingWindows.js` are now pure compatibility re-export shims
  - `utils/timingUtils.js` now retains only the out-of-slice reacquisition export plus pure re-exports for the active generic timing helpers
  - `enforceTiming()` remains the sole authoritative timing output surface consumed by `validateTrade()`; helper-only `validateTiming()` strings still do not leak into canonical rule envelopes or apply-path output
  - the retired 60-day timing rule remains out of authoritative enforcement, including authoritative apply-path output
  - next migrate the adjacent authoritative S&T timing surface in `validateSignAndTrade.js` and its immediate helper dependencies
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TIMING_E8_RETURN_PACKAGE.md`

### Validator TS Sign-And-Trade E9 (2026-03-08)

- Status: The authoritative sign-and-trade rule surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative S&T rule logic now lives in `rules/validateSignAndTrade.ts`
  - `rules/validateSignAndTrade.js` is now a pure compatibility re-export shim with no remaining business logic
  - the S&T vs generic timing ownership split remains unchanged: S&T offseason and January 15 gates stay in `validateSignAndTrade.ts`, generic timing remains in `timingValidation.ts`
  - direct authoritative helper interop stayed narrow to the existing S&T helper exports in `signAndTrade/signAndTradeEligibility.ts`
  - next migrate the adjacent authoritative hard-cap/apron surface in `hardCapValidation.js`
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SIGN_AND_TRADE_E9_RETURN_PACKAGE.md`

### Validator TS Hard-Cap Apron E10 (2026-03-08)

- Status: The authoritative hard-cap/apron rule surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative hard-cap/apron rule logic now lives in `rules/hardCapValidation.ts`
  - active authoritative hard-cap status helper now lives in `utils/hardCapStatus.ts`
  - `rules/hardCapValidation.js` and `utils/hardCapStatus.js` are now pure compatibility re-export shims with no remaining business logic
  - the S&T-owned receiver hard-cap consequence remains unchanged in `rules/validateSignAndTrade.ts`
  - next migrate the remaining live JS consumer surface in `rules/validateSalaryMatching.js`
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_HARDCAP_APRON_E10_RETURN_PACKAGE.md`

### Validator TS Salary Matching E11 (2026-03-08)

- Status: The authoritative salary-matching rule and helper surfaces are now TS-backed in the live validator path.
- TS migration note:
  - active authoritative salary-matching rule logic now lives in `rules/validateSalaryMatching.ts`
  - active authoritative salary-matching helper logic now lives in `utils/salaryMatchingRules.ts`
  - `rules/validateSalaryMatching.js` and `utils/salaryMatchingRules.js` are now pure compatibility re-export shims with no remaining business logic
  - hard-cap/apron metadata consumption remains unchanged through `utils/hardCapStatus.ts`
  - next migrate the upstream matching-values computation boundary in `utils/matchingValues.js`
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SALARY_MATCHING_E11_RETURN_PACKAGE.md`

### Validator TS Matching Values E12 (2026-03-08)

- Status: The authoritative matching-values computation surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative matching-values logic now lives in `utils/matchingValues.ts`
  - `utils/matchingValues.js` is now a pure compatibility re-export shim with no remaining business logic
  - downstream salary-matching / hard-cap consumption remains unchanged: `engine/tradeValidator.js` still recomputes `matchIncoming` / `matchOutgoing` before team `salaryOut` / `salaryIn` and feeds the same upstream values into the typed salary-matching and hard-cap surfaces
  - legacy normalize-input fallback behavior remains unchanged through `utils/normalizeTradeInput.js` consuming deprecated `getMatchingValue()`
  - post-E12 next best slice: `engine/tradeValidator.js` is now the remaining authoritative live JS orchestration boundary adjacent to the typed matching-values / salary-matching / hard-cap surfaces
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_MATCHING_VALUES_E12_RETURN_PACKAGE.md`

### Validator TS Engine E13 (2026-03-08)

- Status: The authoritative validator engine is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative engine logic now lives in `engine/tradeValidator.ts`
  - `engine/tradeValidator.js` is now a pure compatibility re-export shim with no remaining business logic
  - the canonical validator contract/result shape remained unchanged, including fail-fast routing exits, matching-values recompute order, rule-envelope normalization, `summaryByTeamIndex`, `tradeReceipt`, and preview/apply `_validatedTradeContext` consumption
  - `validateFaExceptionUsage` remains an engine export only for public-surface parity; FA-exception rule ownership remains in `rules/validateFaExceptionUsage.js`
  - targeted engine output parity now includes an explicit regression lock for `summaryByTeamIndex` and `tradeReceipt`
  - post-E13 next best slice should be selected from the actual remaining holdouts; `utils/validationIssueText.js` is the most likely next target because it still owns canonical issue normalization/text shaping consumed directly by the TS engine, but it is not precommitted as mandatory
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_ENGINE_E13_RETURN_PACKAGE.md`

### Validator TS Validation Issue Text E14 (2026-03-08)

- Status: The canonical issue-text and issue-normalization helper surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative issue normalization and text helper logic now lives in `utils/validationIssueText.ts`
  - `utils/validationIssueText.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator issue/result semantics remained unchanged, including canonical normalization of legacy/raw issue inputs, top-level `reason` derivation, first-issue text behavior, rule-envelope text shaping, and summary text helpers
  - next best TS slice should be selected from the actual post-E14 holdouts; `engine/validationUtils.js` is a likely engine-adjacent candidate, but not mandatory if another remaining holdout is the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATION_ISSUE_TEXT_E14_RETURN_PACKAGE.md`

### Validator TS Validation Utils E15 (2026-03-08)

- Status: The engine-adjacent validation-utils helper surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative validation-utils helper logic now lives in `engine/validationUtils.ts`
  - `engine/validationUtils.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator result/issue semantics remained unchanged, including wrapped-validator caching/monitoring behavior, `validatorDebug` compatibility behavior, and authoritative `validateTrade()` top-level `dataWarnings` / `hasDataIssues` shaping across repeated validations
  - based on the actual post-E15 holdouts, `utils/capSettingsProvider.js` is the most likely next TS slice because it still directly shapes cap-settings resolution, warnings, and receipt metadata consumed by the TS engine; `utils/salaryUtils.js` remains a narrower compatibility wrapper candidate but is lower priority
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATION_UTILS_E15_RETURN_PACKAGE.md`

### Validator TS Cap Settings Provider E16 (2026-03-08)

- Status: The canonical cap-settings-provider surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative cap-settings-provider logic now lives in `utils/capSettingsProvider.ts`
  - `utils/capSettingsProvider.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator cap-settings and result-metadata semantics remained unchanged, including cap-settings resolution priority, warning text, source labels, top-level `capSettings` / `capSettingsSource` / `capSettingsWarnings`, and receipt `capSettingsUsed` metadata
  - targeted engine-facing parity now includes an explicit regression lock for top-level `validateTrade()` cap-settings metadata
  - the next best TS slice should be selected from the actual post-E16 holdouts rather than hardcoded in advance; `utils/salaryUtils.js` is a likely candidate because it remains a narrow JS compatibility wrapper adjacent to already-typed matching-values and salary-matching surfaces, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_SETTINGS_PROVIDER_E16_RETURN_PACKAGE.md`

### Validator TS Salary Utils E17 (2026-03-08)

- Status: The salary-utils compatibility surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative salary-utils wrapper logic now lives in `utils/salaryUtils.ts`
  - `utils/salaryUtils.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent salary helper semantics remained unchanged, including `computeMatchingValues` passthrough, `getCapHitForSeason` passthrough, legacy `getIncomingCeilingForTeam` compatibility behavior, and downstream `salaryOut` / `salaryIn` effects in `validateTrade()`
  - targeted parity now includes a dedicated helper-surface regression file plus a strengthened engine-facing BYC recompute assertion proving the authoritative validator path still receives unchanged salary-utils-mediated matching values
  - based on the actual post-E17 holdouts, `utils/seasonUtils.js` is a likely next slice because it is now the main remaining direct JS dependency under the typed salary-utils / matching-values path, but it is not mandatory if another holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SALARY_UTILS_E17_RETURN_PACKAGE.md`

### Validator TS Season Utils E18 (2026-03-08)

- Status: The canonical season-utils helper surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative season-utils logic now lives in `utils/seasonUtils.ts`
  - `utils/seasonUtils.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent season helper semantics remained unchanged, including current season/year normalization behavior, current cap-hit lookup behavior, `salaryUtils.getCapHitForSeason()` passthrough behavior, and downstream `salaryOut` / `salaryIn` effects in `validateTrade()`
  - targeted parity now includes a dedicated season-utils helper regression file plus an explicit validator-path cap-hit assertion proving the live engine still uses unchanged season-utils-mediated cap-hit lookups for authoritative salary totals
  - the next best TS slice should be selected from the actual post-E18 holdouts rather than hardcoded in advance; `rules/miscRules.js` is a likely candidate because it still owns live JS BYC logic adjacent to the season helper path, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SEASON_UTILS_E18_RETURN_PACKAGE.md`

### Validator TS Misc Rules E19 (2026-03-08)

- Status: The canonical `miscRules` rule/helper surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative misc-rule logic now lives in `rules/miscRules.ts`
  - `rules/miscRules.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent misc-rule semantics remained unchanged, including BYC detection/mutation behavior, consent message text, trade-kicker math, and the legacy `validateAllNewRules()` mixed composition
  - targeted parity now includes direct `miscRules` helper coverage plus an explicit validator-path BYC assertion proving `validateTrade()` still sees unchanged `validateBYC`-driven `previousSalary` / `matchOutgoing` effects in downstream salary calculations
  - the next best TS slice should be selected from the actual post-E19 holdouts rather than hardcoded in advance; `utils/dataValidation.js` is a likely candidate because it is still live JS business logic consumed by typed `matchingValues.ts`, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_MISC_RULES_E19_RETURN_PACKAGE.md`

### Validator TS Data Validation E20 (2026-03-08)

- Status: The canonical `dataValidation` helper surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative data-warning helper logic now lives in `utils/dataValidation.ts`
  - `utils/dataValidation.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent data-warning semantics remained unchanged, including BYC missing-`previousSalary` warnings, salary-field fallback/missing warning behavior, warning text/payload shape, `validateTradeData()` summary behavior, and `formatDataWarning()` output
  - targeted parity continues to include an authoritative `validateTrade()` assertion proving unchanged top-level `dataWarnings` and `hasDataIssues` behavior
  - based on the actual post-E20 holdouts, `rules/basicRules.js` is a likely next TS slice because it remains live JS second-apron rule logic consumed directly by the TS engine and by TS-backed `miscRules.ts`, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_DATA_VALIDATION_E20_RETURN_PACKAGE.md`

### Validator TS Basic Rules E21 (2026-03-08)

- Status: The canonical `basicRules` rule/helper surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative second-apron handcuff logic now lives in `rules/basicRules.ts`
  - `rules/basicRules.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent `basicRules` semantics remained unchanged, including current second-apron detection sources/fallbacks, prior-year TPE blocking, multi-player aggregation blocking, cash blocking, result shapes, alias exports, and the `cbaConstants` re-export surface
  - targeted parity now includes direct `basicRules` helper coverage plus an authoritative `validateTrade()` assertion proving unchanged team-level and top-level blocker behavior when `enforceSecondApronHandcuffs` participates in validator legality
  - the next best TS slice should be selected from the actual post-E21 holdouts rather than hardcoded in advance; `rules/validateAggregation.js` is a likely candidate because it remains live JS second-apron rule logic imported by the TS-backed engine, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_BASIC_RULES_E21_RETURN_PACKAGE.md`

### RC1 Gate Snapshot

- Trade suites confirmed clean: `test:trade` PASS (58 files, 525 passed), `test:architect` PASS (136 files, 2206 passed). Full-suite run surfaced 16 pre-existing failures in 3 non-trade files — none implicate the 5-pack. See `return_packages/ship_gates/SHIP_GATES_RC1_FULL_SUITE_P1_PREFLIGHT_RETURN_PACKAGE.md`.

### RC1.1 Gate Snapshot

- RC1.1: full node-layer suite green (232 passed, 1 skipped); no trade logic changes. The 3 node-layer failures from RC1 were resolved: entitlement pick-row label helpers fixed, perf tests gated as opt-in, S&T aggregation speculative tests converted to `test.todo()`. See `return_packages/ship_gates/SHIP_GATES_RC1_FIX_FULL_SUITE_FAILS_E1_EXECUTION_RETURN_PACKAGE.md`.

### RC1.2 Gate Snapshot

- RC1.2: full-suite green (node + UI, 267 files, 3395 tests); no trade logic changes. UI test layer (34 files, 370 tests) now passes. Fixes were wizard label/testid alignment, vacuum mode banner/save-draft restoration, Convert to Swap QuickBuilder feature, and vacuum save routing fix for creates. See `return_packages/ship_gates/SHIP_GATES_RC1_UI_SUITE_FIX_E1_EXECUTION_RETURN_PACKAGE.md`.

### Rule 1.6 — S&T Incoming Aggregation (Implemented)

- **Status:** Implemented and enforced under existing rule key `team.rules.signAndTrade` in `validateSignAndTrade()`.
- **Behavior:** if a team receives a sign-and-trade player, that team cannot receive any additional players in the same transaction (including multi-team trades).
- **Scope boundaries:** picks/cash are not counted as players for Rule 1.6; third-party teams not receiving the S&T player are unaffected by Rule 1.6.
- **Validator SSOT:** `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.ts` (incoming aggregation check is part of Rule 1.6; `validateSignAndTrade.js` is now a pure shim).
- **Apply parity:** enforced again through `validatePostTradeSnapshotForContext()` -> `validateTrade()`.
- **Test status:** `tests/signAndTradeAggregation.test.js` now runs as active coverage (no deferred `todo` cases).
- **Return packages:**
  - `return_packages/trade_machine/TM_SNT_RULE_1_6_INCOMING_AGGREGATION_P1_PREFLIGHT_RETURN_PACKAGE.md`
  - `return_packages/trade_machine/TM_SNT_RULE_1_6_INCOMING_AGGREGATION_E1_EXECUTION_RETURN_PACKAGE.md`

### Non-Blocking Minors (not required for ship)

1. **`usedTradeExceptions` dead field** — **FIXED in B.** `exportCurrentTrade()` now uses `extractUsedTpeIds()` which filters on `absorptionMode === 'TPE'` + truthy `tpeId`. De-duplicated, null-safe. Helper in `tradeMachine/utils/tradeExportUtils.js`.
2. **`twoWayPlayers` not maintained by `buildPostTradeTeamsSnapshot`** — **FIXED in B.** Snapshot builder now maintains `twoWayPlayers` if present pre-trade: removes outgoing two-way players, adds incoming (`isTwoWay === true`), deduplicates by player ID. Does not invent the field when absent.
3. **Three duplicate roster validation modules** — `rosterValidation.js`, `validateRoster.ts`, `validateRoster.js` overlap. Canonical enforcement is inline in `tradeValidator.js`. Consolidation deferred.
4. **`incomingPlayers`/`incomingEntitlements` redundant in export** — Included in `exportCurrentTrade()` but not used by world-mode apply (recomputed via routing). Only used by vacuum-mode local state.
5. **Persistence-contract shape enforcement environment-gated** — `assertPersistableOrThrow` only enforces in test environments. Pipeline has upstream shape guarantees.
6. **`FaExceptionTracker` mixes local and validator data** — Informational display, not an apply gate.

### Validation Gates (at closeout)

- `npm run test:trade -- --reporter=dot`: **PASS** (56 files, 516 passed, 1 skipped, 3 todo)
- `npm run test:architect -- --reporter=dot`: **PASS** (136 files, 2206 passed, 1 skipped, 3 todo)
- `npm run build`: **PASS** (3052 modules, built successfully)
- `npm run validate:project`: **PASS** (all validations passed)

## P1 Preflight Findings (2026-02-28)

- Scope: Trade Machine base state (`worldId = null`) functional completeness preflight with code-trace evidence.
- STOP #4 (Years Remaining Display): **Triggered**. Trade row years source uses `contract.yearsRemaining` or FA-year delta and is not future-contract-extension-aware in row rendering path.
- STOP #5 (Execution Gate Mismatch / Direct-Write Bypass): **Triggered**. Base-state apply path updates local cap-sheet state directly and does not execute the authoritative `applyWorldMutation('executeTrade')` validation/persistence gate.
- STOP #1, #2, #3, #6: **Not Triggered** on current traces (S&T menu gating and modal capture path present; allowable incoming display is hard-cap-aware via official snapshot; entitlement routing/wizard paths are wired).
- Gate parity conclusion: world mode has a single authoritative apply-time trade gate (`READ -> COMPUTE -> VALIDATE -> PERSIST`), while base state relies on UI-time validation plus local apply mutation, creating mode-parity drift risk.

## TM_E2E_FUNCTIONALITY_E1 (2026-02-28) — Execution Notes

- Closed STOP #5 (base-state authoritative gate): base-state `applyTradeToCapSheet` no longer applies local direct roster/contract mutations. It now loads base snapshots, runs `computeWorldMutation({ mutationType: 'executeTrade' })`, requires a valid `_validatedTradeContext`, and fail-closes before `setTeamCapSheet` when validation is illegal or context is missing.
- Closed STOP #4 (years remaining display): added canonical helpers in `src/features/architect/utils/contractUtils.js`:
  - `getContractYearsForDisplay(...)` (base + `futureContract` extension year assembly, dedupe by year with extension precedence)
  - `getYearsRemainingDisplay(...)` (remaining-year count from assembled contract horizon, safe fallbacks)
- Trade UI now uses `getYearsRemainingDisplay(...)` in `TradePlayerRow`, and `EditContractModal` now derives `contractYears` from `getContractYearsForDisplay(...)` so display logic shares one contract-year assembly source.
- Added tests:
  - source-scan guardrail for base-state authoritative gate wiring
  - behavioral hook test asserting base-state apply fail-closed/no state mutation when authoritative validation is illegal
  - Trade row years-remaining UI test covering extension + non-extension cases
- Remaining out of scope (unchanged): S&T modal wiring, hard-cap allowable incoming display, and pick wizard UX.
- P2 CONFIRMED (2026-02-28): STOP #4 and #5 closed; base-state trade apply is gated + extension-aware years display is wired.

### TM_E2E_FUNCTIONALITY_P2 (2026-02-28) — Prefight Confirmation

Confirmed STOP #4 (years remaining display) and STOP #5 (base-state apply bypass) remain closed: base-state Apply routes through `computeWorldMutation('executeTrade')` with `_validatedTradeContext` + `legal` fail-closed gating, and both Trade row + EditContract share canonical extension-aware helpers in `contractUtils.js`. No Firestore writes exist in base-state apply branch.

---

## P2 Preflight — Correctness Matrix

Date: 2026-03-01

### A) User-Facing Action/Flow Matrix

| # | Action | Entry Path | Required Inputs | Validation Gate | Mutation Type | Persistence Path | State Resync | Cap Refresh SSOT | Test Coverage |
|---|--------|------------|-----------------|-----------------|---------------|------------------|--------------|------------------|---------------|
| 1 | **Select Team** | `TradeTeamCard` → `onSelectTeam` → `useTradeMachine.selectTeam()` | `teamId` | None (load only) | None | `loadWorldTeamData(worldId, teamId)` | Sets `team`, `sends`, `entitlementsOut` on slot | `computeTeamCapTotals()` via `getCapTotalsForYear()` | `src/tests/architect/phase16_3_trade_machine_init_guardrail.test.js` |
| 2 | **Add Team Slot** | `TradeEditor` "Add Team" button → `useTradeMachine.addTeam()` | None | Max 5 teams enforced | None | None | Appends empty slot to `teams[]` | None | Implicit in multi-team test fixtures |
| 3 | **Remove Team Slot** | `TradeTeamCard` remove → `useTradeMachine.removeTeam()` | `teamIndex` | None | None | None | Removes slot; cleans orphaned `tradeTo`/`toTeamId` refs | None | Implicit in multi-team test fixtures |
| 4 | **Route Player (trade)** | `TradePlayerRow` action menu → `onSetPlayerTrade(player, 'trade', destTeamId)` → `useTradeMachine.setPlayerTrade()` | `player`, `action='trade'`, `destTeamId` | None (pre-validate) | None (state only) | None | Adds to `sends[]` with `toTeamId` | None | `src/tests/trade/playerRouting.test.js` |
| 5 | **Route Player (keep)** | `TradePlayerRow` → `onSetPlayerTrade(player, 'keep')` | `player`, `action='keep'` | None | None | None | Removes from `sends[]` | None | `src/tests/trade/playerRouting.test.js` |
| 6 | **Set Absorption Mode** | `TradeTeamCard` dropdown → `onSetPlayerTrade(player, 'setAbsorptionMode', null, {absorptionMode})` | `player`, `absorptionMode` ('standard'\|'TPE'\|'FA_EXCEPTION') | None | None | None | Sets `absorptionMode` on send entry | None | `tests/trade/tpe_absorption_fail_closed.test.js`, `tests/trade/faExceptions_as_trade_buckets.test.js` |
| 7 | **Set TPE ID** | TPE selector → `onSetPlayerTrade(player, 'setTpeId', null, {tpeId})` | `player`, `tpeId` | None (pre-validate) | None | None | Sets `tpeId` on send entry | None | `tests/trade/tpe_absorption_fail_closed.test.js`, `src/tests/trade/tpe_perPlayer.guardrail.test.js` |
| 8 | **Sign-and-Trade** | `TradeTeamCard` → `onRequestSignAndTrade(player, destTeamId)` → opens `EditContractModal` → `handleTradeMachineSignAndTrade()` → `setPlayerTrade(idx, player, 'signAndTrade', dest, {signAndTradeContract})` | `player`, `destTeamId`, `contractPayload` (salariesByYear, contractYears, firstYearGuaranteed) | `validateSignAndTradeContractPayload()` pre-modal-close | None (state only) | None | Sets `signAndTrade: true`, `signAndTradeContract` on send entry | None | `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`, `tests/trade/signAndTrade_completeness.test.js`, `src/tests/architect/signAndTrade.test.js` |
| 9 | **Toggle Entitlement** | `EntitlementPickRow` → `onToggleEntitlement(ent)` → `useTradeMachine.toggleEntitlement()` | `entitlement` object | None | None | None | Adds/removes from `entitlementsOut[]`; auto-sets `toTeamId` for 2-team | None | `src/tests/architect/tradeEntitlementExclusivity.test.ts`, `tests/entitlements/tradeReceiptEntitlements.test.js` |
| 10 | **Set Entitlement Destination** | `EntitlementPickRow` dest selector → `onSetEntitlementDestination(entId, toTeamId)` | `entitlementId`, `toTeamId` | None | None | None | Updates `toTeamId` on entitlement entry | None | `src/tests/architect/tradeEntitlementRouting.test.ts` |
| 11 | **Edit Entitlement** | `EntitlementPickRow` edit → `onEditEntitlement()` → opens `PickRightWizardModal` | Entitlement fields via wizard | Wizard validation | None | Session edit storage | Updates entitlement in session | None | `PickRightWizardModal` integration (UI tests) |
| 12 | **Create Entitlement** | `TradeTeamCard` create → `onCreateEntitlement(teamCode)` → opens `PickRightWizardModal` in create mode | Team code + wizard fields | Wizard validation | None | Session create storage | Adds entitlement to session | None | `PickRightWizardModal` integration (UI tests) |
| 13 | **Validate Trade** | `TradeEditor` "Validate Trade" button → `useTradeMachine.handleValidate()` | At least 2 teams with routes | Full `validateTrade()` engine (14+ rules) | None | None | Sets `result`, opens `TradePreviewModal` | Patches missing payroll via `computeTeamCapTotals()` safety net | `tests/tradeValidator.test.js`, `tests/trade/salaryMatching.test.js`, all `tests/trade/*.test.js` |
| 14 | **Apply Trade** | `TradeEditor` "Apply Trade" button → `exportCurrentTrade()` → `onApplyTrade(tradeData)` → `useArchitectActions.applyTradeToCapSheet()` | Valid + legal validation result | `hasCurrentValidation && result.legal === true` gating; apply-time re-validation via `computeWorldMutation()` → `validatePostTradeSnapshotForContext()` → `validateTrade()` | `executeTrade` | World: `applyWorldMutation()` → `persistWorldMutation()` (Firestore batch). Base: `computeWorldMutation()` → `setTeamCapSheet()` | `syncTeamFromMutationResult()` reads `changedTeams` (authoritative); fallback: Firestore reload | `computeTeamCapTotals()` at snapshot build (tradeContext.js:524) + persistence audit | `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts`, `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts`, `src/tests/architect/phase50_executeTrade_integration_persistence.test.js` |
| 15 | **Reset Trade** | `TradeEditor` Reset button → `useTradeMachine.resetTrade()` | None | None | None | None | Clears all `sends[]`, `entitlementsOut[]`, `result` | None | Implicit |
| 16 | **Undo Player Trade** | `TradePlayerRow` → `onUndoPlayerTrade(player)` → `useTradeMachine.undoPlayerTrade()` | `player` | None | None | None | Removes player from all teams' `sends[]` | None | Implicit |
| 17 | **Export Trade** | `TradeExportCapture` → `exportCurrentTrade()` | Valid trade state | None | None | None | Returns packaged trade data | None | `tests/trade/usedTradeExceptions.test.js` |

### B) Major CBA Rule Coverage

#### 1. Salary Matching Rules

| Aspect | Implementation | File(s) | UI Surface | Test Coverage |
|--------|---------------|---------|------------|---------------|
| **Band 1** (outgoing ≤ $6.5M) | 200% + $250K | `utils/salaryMatchingRules.js` (`TIER_1_THRESHOLD`, `TIER_1_MULTIPLIER`, `TIER_1_BONUS`) | `TradeLegalChecker`, `ValidationDetailsPanel`, `TradeSalaryCalculator` | `tests/salaryMatchingRules.test.js`, `tests/trade/matchingBands_2023.test.js` |
| **Band 2** ($6.5M–$19.6M) | 100% + $7.5M | `utils/salaryMatchingRules.js` (`TIER_2_THRESHOLD`, `TIER_2_BONUS`) | Same | Same |
| **Band 3** (outgoing > $19.6M) | 125% + $250K | `utils/salaryMatchingRules.js` (`TIER_3_MULTIPLIER`, `TIER_3_BONUS`) | Same | Same |
| **First Apron** (≥ apron) | 100% dollar-for-dollar | `utils/salaryMatchingRules.js` | Same | `tests/trade/firstApron_100pct.test.js` |
| **Second Apron** (> secondApron, strict) | 100% dollar-for-dollar | `utils/salaryMatchingRules.js` | Same | `tests/trade/secondApronBoundary.test.js` |
| **Under Cap** | outgoing + remaining cap space | `utils/salaryMatchingRules.js` | Same | `tests/trade/salaryMatching.test.js` |
| **Incoming vs allowable check** | `salaryIn ≤ effectiveAllowableIncoming` | `rules/validateSalaryMatching.js` (line ~445-490) | `TradeLegalChecker` shows violations | `tests/validators/salaryMatching.test.js` |

#### 2. Hard Cap Constraints

| Aspect | Implementation | File(s) | UI Surface | Test Coverage |
|--------|---------------|---------|------------|---------------|
| **Hard cap incoming ceiling** | `hardCapIncomingCeiling = salaryOut + max(0, apron - teamTotalSalary)` | `rules/validateSalaryMatching.js:429-430`, `rules/hardCapValidation.js:103-104,137-138` | `ValidationDetailsPanel` shows hard cap ceiling and limiter | `src/tests/trade/hardCap_salaryMatching.guardrail.test.js` |
| **Effective allowable = min(salaryMatchCeiling, hardCapCeiling)** | `effectiveAllowableIncoming = Math.min(allowableIncoming, hardCapIncomingCeiling)` | `rules/validateSalaryMatching.js:434-436` | Same | `src/tests/tradeMachine/tradeAllowableIncomingParity.guardrail.test.ts` |
| **First Apron hard cap** | Triggered by S&T, BAE, NTMLE usage | `rules/hardCapValidation.js:86-87,133-144`, `rules/validateFaExceptionUsage.js:91-92` | `TradeLegalChecker` shows hard cap type | `tests/validators/hardCap.test.js`, `tests/trade/hardCap_trigger_faException.test.js` |
| **Second Apron hard cap** | Auto-triggered when `teamTotalSalary > secondApron` | `rules/hardCapValidation.js:88-90,114-116` | Same | `tests/validators/hardCap.test.js`, `src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts` |
| **S&T receiver hard cap** | Receiver becomes first-apron hard-capped | `rules/validateSignAndTrade.ts`, `tradeContext.js:526-542` | Hard cap metadata on team snapshot | `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts` |

**Known burn #3 verification (apron hard cap):** ✅ PASS. `validateSalaryMatching.js:434` computes `effectiveAllowableIncoming = Math.min(allowableIncoming, hardCapIncomingCeiling)` where `hardCapIncomingCeiling = salaryOut + max(0, apron - teamTotalSalary)`. Allowable incoming cannot exceed hard-cap remaining room.

#### 3. Aggregation Rules & Incoming/Outgoing Construction

| Aspect | Implementation | File(s) | Test Coverage |
|--------|---------------|---------|---------------|
| **Second apron aggregation block** | Cannot aggregate 2+ outgoing into higher incoming | `rules/basicRules.ts`, `rules/validateAggregation.js:68-70` | `tests/trade/secondApron_handcuffs.test.js` |
| **S&T aggregation block (Rule 1.6)** | Receiver cannot receive additional players with S&T | `rules/validateSignAndTrade.ts` | `tests/signAndTradeAggregation.test.js` |
| **60-day aggregation timing** | Retired from authoritative enforcement pending a reliable acquisition-date field in the live payload | `rules/timingValidation.ts` | `tests/trade/timingEnforcement_authoritative.test.js`, `tests/trade/timingGates_softEnforcement.test.js`, `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts` |
| **TPE + outgoing aggregation** | Cannot combine TPE with outgoing salary | `rules/validateTradeExceptions.js:93-97` | `tests/trade/tpe_absorption_fail_closed.test.js` |
| **Incoming/outgoing construction** | Route-aware via `computeMatchingValues()` (SSOT) | `engine/tradeValidator.js:720` → `utils/matchingValues.js` | `src/tests/trade/tradeMultiSurfaceOfficialValues.test.js`, `src/tests/trade/goldenTrades.test.js` |

#### 4. Trade Exceptions (TPE)

| Aspect | Implementation | File(s) | Test Coverage |
|--------|---------------|---------|---------------|
| **TPE creation** | When `salaryOut > salaryIn` and over cap | `mutationPipeline.js` (`computeTradeResult`) | `tests/trade/tpe_creation_expiry_usage.test.js` |
| **TPE consumption** | `absorptionMode='TPE'` + `tpeId` required | `rules/validateTradeExceptions.js` (fail-closed) | `tests/trade/tpe_absorption_fail_closed.test.js` |
| **TPE capacity check** | `player salary ≤ TPE remainingAmount` | `rules/validateTradeExceptions.js` | Same |
| **TPE expiry tracking** | `expiresOn` field checked; expired TPEs rejected | `rules/validateTradeExceptions.js` | `tests/trade/tpe_creation_expiry_usage.test.js` |
| **Second apron prior-year TPE ban** | `isPriorYearTPE()` check blocks usage | `rules/validateTradeExceptions.js`, `rules/basicRules.ts` | `tests/trade/secondApron_tpeBan.test.js` |
| **TPE + salary aggregation prohibition** | Cannot combine TPE with outgoing salary | `rules/validateTradeExceptions.js:93-97` | `tests/trade/tpe_absorption_fail_closed.test.js` |

#### 5. BYC (Base Year Compensation)

| Aspect | Implementation | File(s) | Test Coverage |
|--------|---------------|---------|---------------|
| **BYC detection** | Current salary > 120% of previous season salary | `rules/miscRules.js` (`validateBYC`) | `tests/trade/byc_outgoing_max.test.js` |
| **BYC outgoing value** | `max(previousSalary, 50% of newSalary)` | `rules/miscRules.js` | Same |
| **BYC in matching values** | Integrated into `computeMatchingValues()` for outgoing | `engine/tradeValidator.js` → `utils/matchingValues.js` | `src/tests/trade/goldenTrades.test.js` |

#### 6. Trade Kicker

| Aspect | Implementation | File(s) | Test Coverage |
|--------|---------------|---------|---------------|
| **Trade kicker application** | Prorated kicker added to outgoing salary | `rules/miscRules.js` (`enforceTradeKicker`) | `tests/trade/tradeKicker_proration.test.js` |
| **Trade kicker cap** | Capped at remaining guaranteed money | `rules/miscRules.js` | `tests/trade/tradeKicker_zeroGuarantee.test.js` |
| **Poison pill averaging** | Average salary calculation for multi-year contracts | `utils/salaryUtils.js` | `tests/trade/poisonPill_average.test.js` |

#### 7. Stepien Rule / Pick Eligibility

| Aspect | Implementation | File(s) | Test Coverage |
|--------|---------------|---------|---------------|
| **Consecutive first-round pick restriction** | Cannot trade consecutive unprotected future firsts | `rules/draftRules.js` → `validateStepien.js` (SSOT) | `tests/validators/stepien.test.js`, `src/tests/tradeMachine/stepienObligations.test.js` |
| **7-year future limit** | Cannot trade picks > 7 years out | `rules/draftRules.js` | Same |
| **Entitlement-based Stepien** | Stepien computed from entitlement baseline | `tests/validators/stepienEntitlements.test.js`, `tests/validators/stepienEntitlementBaseline.test.js` | Same |

#### 8. Roster Size Constraints

| Aspect | Implementation | File(s) | Test Coverage |
|--------|---------------|---------|---------------|
| **Standard roster min (14)** | `MIN_ROSTER = 14` | `rules/validateRoster.ts` | `tests/trade/rosterLegality_validateTrade.test.js` |
| **Standard roster max (15)** | `MAX_ROSTER = 15` | `rules/validateRoster.ts` | Same |
| **Two-way max (3)** | `MAX_TWO_WAY = 3` | `rules/validateRoster.ts` | `tests/trade/roster_twoWay_enforcement.test.js` |
| **Soft enforcement mode** | `validationFlags` can set to `'warn'` | `src/config/validationFlags.js` | `tests/trade/rosterWindow_softEnforcement.test.js` |
| **Apply-time enforcement** | Re-validated via `validatePostTradeSnapshotForContext()` | `mutationPipeline.js` | `src/tests/architect/tradeApply_failClosed_noWrite.guardrail.test.ts` |

#### 9. Sign-and-Trade Eligibility & Restrictions

| Aspect | Implementation | File(s) | Test Coverage |
|--------|---------------|---------|---------------|
| **Eligibility: FREE_AGENT or CAP_HOLD only** | `isSignAndTradeEligible()` | `signAndTrade/signAndTradeEligibility.ts` | `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts` |
| **UNDER_CONTRACT → ineligible** | Fail-closed | Same | Same |
| **Contract capture required** | Modal collects `salariesByYear[]`, `contractYears`, `firstYearGuaranteed` | `TradeEditor.jsx` → `EditContractModal` | `tests/trade/signAndTrade_completeness.test.js` |
| **Contract length 3-4 years** | `validateSignAndTradeContractPayload()` | `signAndTrade/signAndTradeEligibility.ts` | Same |
| **First year guaranteed** | Required field in contract payload | Same | Same |
| **Receiver hard-cap consequence** | First-apron hard cap on receiving team | `rules/validateSignAndTrade.ts` | `src/tests/architect/executeTrade_signAndTrade_apply.guardrail.test.ts` |
| **Rule 1.6 incoming aggregation** | Receiver cannot receive other players | `rules/validateSignAndTrade.ts` | `tests/signAndTradeAggregation.test.js` |
| **Source team mismatch** | Source team must match player's team | `signAndTrade/signAndTradeEligibility.ts` | `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts` |
| **Above-second-apron S&T block** | S&T violation for teams above 2nd apron | `rules/hardCapValidation.js` | `tests/validators/hardCap.test.js` |

### C) Known Burn Regression Checks

#### Burn #1: S&T not available for non-FA / non-eligible players

**Status: ✅ VERIFIED**

**Evidence:**

- `signAndTradeEligibility.ts` → `isSignAndTradeEligible()` returns `eligible: false` for `UNDER_CONTRACT` status with `reasonCode: 'UNDER_CONTRACT'`.
- UI gating: `TradeTeamCard` → `onRequestSignAndTrade` calls `openTradeMachineSatModal()` which routes to `EditContractModal`. The modal handler `handleTradeMachineSignAndTrade()` calls `validateSignAndTradeContractPayload()` before writing state.
- Validator gate: `validateSignAndTrade.ts` independently re-checks eligibility at validation time via `isSignAndTradeEligible()`.
- Test: `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts` explicitly tests that UNDER_CONTRACT players are ineligible.

#### Burn #2: S&T flow collects contract details (not instant-send)

**Status: ✅ VERIFIED**

**Evidence:**

- `TradeEditor.jsx` → `onRequestSignAndTrade` opens `EditContractModal` with `initialAction="signAndTrade"`.
- Modal requires user to fill contract fields (`salariesByYear[]`, `contractYears`, `firstYearGuaranteed`).
- `handleTradeMachineSignAndTrade()` validates contract via `validateSignAndTradeContractPayload()` before calling `setPlayerTrade()`.
- State is only written after successful validation + modal confirm.
- Cancel writes nothing.
- Test: `tests/trade/signAndTrade_completeness.test.js` verifies contract payload is required.

#### Burn #3: Allowable incoming respects hard-cap reality

**Status: ✅ VERIFIED**

**Evidence:**

- `validateSalaryMatching.js:426-441` (TM_FIX_A2_E1):

  ```js
  const hardCapRoom = Math.max(0, hardCapCeilingApron - totalSalary);
  hardCapIncomingCeiling = salaryOut + hardCapRoom;
  effectiveAllowableIncoming = Math.min(allowableIncoming, hardCapIncomingCeiling);
  ```

- The `effectiveAllowableIncoming` is the **minimum** of salary-match ceiling and hard-cap ceiling.
- Hard cap ceiling uses remaining room (`apron - teamTotalSalary`), not the matching ceiling.
- Test: `src/tests/tradeMachine/tradeAllowableIncomingParity.guardrail.test.ts`, `src/tests/trade/hardCap_salaryMatching.guardrail.test.js`.

#### Burn #4: Post-save state is deterministic (no drift)

**Status: ✅ VERIFIED**

**Evidence:**

- World mode: `useArchitectActions.ts` → `syncTeamFromMutationResult()` reads `changedTeams` from `applyWorldMutation()` return. Uses authoritative computed state directly (not optimistic).
- Fallback: If `changedTeams` is missing for current team, reloads from Firestore via `loadWorldTeamData(worldId, teamCode)`.
- Base mode: `applyTradeToCapSheet()` loads base snapshots, runs `computeWorldMutation()`, and sets UI from computed result (not from pre-trade state).
- Cap totals: Recalculated at snapshot build time via `computeTeamCapTotals()` in `tradeContext.js:524`.
- Test: `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts` verifies base-state apply uses authoritative gate.

### STOP CONDITIONS EVALUATION

| # | Condition | Status | Evidence |
|---|-----------|--------|----------|
| 1 | User-facing flow missing required inputs | **NOT TRIGGERED** | S&T requires contract modal; TPE requires `tpeId` selector; all routes require team selection |
| 2 | Major rule missing enforcement OR UI contradicts reality | **NOT TRIGGERED** | All 9 major CBA rules have enforcement + UI surface (see matrix above) |
| 3 | Allowable incoming exceeds hard-cap room | **NOT TRIGGERED** | `effectiveAllowableIncoming = Math.min(allowableIncoming, hardCapIncomingCeiling)` in `validateSalaryMatching.js:434` |
| 4 | Mutation path bypasses validator gates | **NOT TRIGGERED** | Apply-time re-validates via `validatePostTradeSnapshotForContext()` → `validateTrade()`; base-state now uses `computeWorldMutation()` (STOP #5 from P1 closed) |
| 5 | World success without authoritative resync | **NOT TRIGGERED** | `syncTeamFromMutationResult()` reads `changedTeams` (authoritative) with Firestore reload fallback |

### Scenario Battery (10+ Scenarios)

| # | Scenario | Teams | Key Rules Exercised | Expected Outcome | Test File |
|---|----------|-------|---------------------|------------------|-----------|
| 1 | Standard 2-team trade, both over cap, Band 3 | 2 | Salary matching (Band 3: 125% + $250K) | Legal if incoming ≤ allowable | `tests/trade/salaryMatching.test.js` |
| 2 | Under-cap team acquires large contract | 2 | Under-cap matching (outgoing + cap space) | Legal if incoming ≤ outgoing + remaining room | `tests/trade/salaryMatching.test.js` |
| 3 | First-apron team trade | 2 | First apron 100% matching + hard cap ceiling | Legal if dollar-for-dollar + under apron post-trade | `tests/trade/firstApron_100pct.test.js` |
| 4 | Second-apron team trade with aggregation | 2 | Second apron 100% + aggregation block | Illegal: cannot aggregate | `tests/trade/secondApron_handcuffs.test.js` |
| 5 | Sign-and-trade with contract capture | 2 | S&T eligibility + contract validation + hard cap trigger | Legal for FA/cap-hold; receiver hard-capped | `tests/trade/signAndTrade_completeness.test.js` |
| 6 | TPE absorption | 2 | TPE consumption + capacity check + fail-closed | Legal if TPE exists, has capacity, and correct `tpeId` | `tests/trade/tpe_absorption_fail_closed.test.js` |
| 7 | Stepien rule violation | 2 | Consecutive first-round pick restriction | Illegal: Stepien violation | `tests/validators/stepien.test.js` |
| 8 | Roster overflow (>15 standard) | 2 | Roster max (15) | Illegal: roster exceeds maximum | `tests/trade/rosterLegality_validateTrade.test.js` |
| 9 | 3-team trade with explicit routing | 3 | Multi-team routing + routed incoming salary | Legal if all destinations explicit + salary matches per team | `tests/tradeValidator.test.js` (3-team fixtures) |
| 10 | BYC-adjusted outgoing value | 2 | BYC detection + adjusted outgoing | Outgoing uses BYC formula (max of prev salary, 50% new) | `tests/trade/byc_outgoing_max.test.js` |
| 11 | Hard-cap team with S&T incoming | 2 | Hard cap ceiling limits allowable | `effectiveAllowableIncoming = min(salaryMatch, hardCapCeiling)` | `src/tests/trade/hardCap_salaryMatching.guardrail.test.js` |
| 12 | Trade kicker proration | 2 | Trade kicker added to outgoing, capped at guaranteed | Kicker prorated + capped | `tests/trade/tradeKicker_proration.test.js` |
| 13 | Second apron prior-year TPE ban | 2 | Second apron blocks prior-year TPE | Illegal: prior-year TPE blocked | `tests/trade/secondApron_tpeBan.test.js` |
| 14 | S&T incoming aggregation (Rule 1.6) | 2+ | Receiver cannot aggregate players with S&T | Illegal: cannot receive additional players | `tests/signAndTradeAggregation.test.js` |

### Ranked Gaps

| Priority | Gap | Impact | Suggested Ticket |
|----------|-----|--------|------------------|
| 1 | **DPE (Disabled Player Exception) parity** | DPE editable via `ManageExceptionsModal` but not validated by trade validator | `TM_DPE_VALIDATOR_PARITY_E1` — Wire DPE validation into `validateTradeExceptions` |
| 2 | **Three duplicate roster validation modules** | `rosterValidation.js`, `validateRoster.ts`, `validateRoster.js` overlap; canonical is inline in `tradeValidator.js` | `TM_ROSTER_CONSOLIDATION_E1` — Consolidate to single SSOT roster validator |
| 3 | **Consent/NTC enforcement depth** | `validateConsent.js` and `miscRules.js` handle consent but no structured NTC roster data exists in Firestore | `TM_NTC_DATA_MODEL_E1` — Define NTC data model + enforcement |
| 4 | **Reacquisition enforcement timing** | Reacquisition rules reference `departedAt` timestamp but TM does not track player departure dates in world state | `TM_REACQUISITION_TIMING_E1` — Add departure date tracking to world mutations |
| 5 | **FA Exception hard-cap trigger UI feedback** | `validateFaExceptionUsage.js` sets `hardCapFirstApron` but UI may not surface the cause clearly | `TM_FA_EXCEPTION_HARDCAP_UI_E1` — Surface FA exception hard-cap trigger reason |
| 6 | **Moratorium / timing gates soft-only** | Timing validation (`timingValidation.ts`) defaults to soft enforcement per `validationFlags` | `TM_TIMING_ENFORCEMENT_E1` — Evaluate timing enforcement upgrade |
| 7 | **Vacuum mode entitlement parity** | Vacuum mode uses `localStorage` for entitlements; no validator parity with world mode | `TM_VACUUM_ENTITLEMENT_PARITY_E1` — Align vacuum entitlement handling with world mode |
