# TRADE_MACHINE_MASTER

Last updated: 2026-03-12

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

### Validator TS Validate Aggregation E22 (2026-03-08)

- Status: The canonical `validateAggregation` rule surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative aggregation logic now lives in `rules/validateAggregation.ts`
  - `rules/validateAggregation.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent aggregation semantics remained unchanged, including current second-apron detection sources/fallbacks, `outgoingPlayers` / `sends` salary-source behavior, higher-paid-player aggregation blocking, multi-club incoming blocking, exact violation ordering, current result/message shapes, and the existing omission of salary-mismatch enforcement from this rule
  - targeted parity now includes direct `validateAggregation` helper coverage plus an authoritative `validateTrade()` assertion proving unchanged team-level `rules.aggregation` blocker behavior and top-level legality blocking in a second-apron aggregation case
  - based on the actual post-E22 holdouts, `utils/capUtils.js` is a likely next TS slice because it remains live shared apron-helper logic consumed by several TS-backed validator surfaces, but it is not mandatory if another remaining live JS holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_AGGREGATION_E22_RETURN_PACKAGE.md`

### Validator TS Cap Utils E23 (2026-03-09)

- Status: The canonical `capUtils` helper surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative cap/apron helper logic now lives in `utils/capUtils.ts`
  - `utils/capUtils.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent `capUtils` semantics remained unchanged, including first-apron `>=` classification, second-apron strict `>` classification, apron-status return values, cap-settings normalization fallbacks, wrapper-team extraction order, payroll resolution order, and the `toSeasonKey` re-export surface
  - targeted parity now includes expanded direct `capUtils` helper coverage plus an authoritative `validateTrade()` boundary assertion proving unchanged `capUtils`-driven second-apron status behavior in team-level salary-matching blocking
  - based on the actual post-E23 holdouts, `utils/salaryMargin.js` is a likely next TS slice because it remains live shared JS salary-ceiling logic built directly on the newly TS-backed `capUtils` helper surface, but it is not mandatory if another remaining live JS holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_UTILS_E23_RETURN_PACKAGE.md`

### Validator TS Salary Margin E24 (2026-03-09)

- Status: The canonical `salaryMargin` helper surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative salary-margin helper logic now lives in `utils/salaryMargin.ts`
  - `utils/salaryMargin.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent `salaryMargin` semantics remained unchanged, including post-trade apron clamp order, under-cap cap-room handling, over-cap allowable-margin delegation, used-TPE and FA-exception add-on behavior, numeric fallbacks, incoming-ceiling branch order, and existing debug log payloads
  - targeted parity now includes expanded direct `salaryMargin` helper coverage plus smoke assertions proving unchanged `.js` import compatibility through the direct helper path, the Trade Machine public index, and the validator compatibility index
  - based on the actual post-E24 holdouts, `rules/validateFaExceptionUsage.js` is a likely next TS slice because it remains a narrow live JS rule imported directly by the TS-backed engine and publicly re-exported, but it is not mandatory if another remaining live JS holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SALARY_MARGIN_E24_RETURN_PACKAGE.md`

### Validator TS FA Exception Usage E25 (2026-03-09)

- Status: The canonical `validateFaExceptionUsage` rule surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative FA-exception rule logic now lives in `rules/validateFaExceptionUsage.ts`
  - `rules/validateFaExceptionUsage.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent FA-exception semantics remained unchanged, including first-/second-apron blockers, projected first-apron blocker behavior, outgoing-salary aggregation blocking, auto-bucket selection, exact violation ordering, raw string-array return shape, bucket depletion, note insertion, and `team.team.hardCapFirstApron` mutation side effects
  - targeted parity now includes the existing authoritative `validateTrade()` assertions for `rules.faExceptionUsage` blocker/pass behavior and FA-exception salary-matching interaction, plus smoke assertions proving unchanged `.js` import compatibility through the Trade Machine public index and validator compatibility index
  - based on the actual post-E25 holdouts, `rules/validatePlayerRouting.js` is a likely next TS slice because it remains live JS rule logic imported directly by `tradeValidator.ts` and has no TS-backed counterpart yet, but it is not mandatory if another remaining live JS holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_FA_EXCEPTION_USAGE_E25_RETURN_PACKAGE.md`

### Validator TS Validate Player Routing E26 (2026-03-09)

- Status: The canonical `validatePlayerRouting` rule surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative player-routing logic now lives in `rules/validatePlayerRouting.ts`
  - `rules/validatePlayerRouting.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent player-routing semantics remained unchanged, including duplicate detection order, 3+ destination requirements, destination-resolution precedence, invalid-destination blocking, self-route blocking, exact message text/order, and the raw `{ valid, errors, warnings }` / `{ pass, errors, warnings }` contracts
  - targeted parity now includes direct `.js` shim assertions for named/default/enforcement exports plus an authoritative `validateTrade()` fail-fast assertion proving `PLAYER_ROUTING_ERROR`, first-error `reason`, normalized `playerRouting` top-level violations, and no downstream team-rule result set before the early return
  - based on the actual post-E26 holdouts, the next TS slice should be selected from the remaining live JS validator surfaces; `rules/validateEntitlementRouting.js` is a likely candidate because it remains live cross-trade routing logic imported directly by `tradeValidator.ts`, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_PLAYER_ROUTING_E26_RETURN_PACKAGE.md`

### Validator TS Validate Entitlement Routing E27 (2026-03-09)

- Status: The canonical `validateEntitlementRouting` rule surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative entitlement-routing logic now lives in `rules/validateEntitlementRouting.ts`
  - `rules/validateEntitlementRouting.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent entitlement-routing semantics remained unchanged, including duplicate entitlement detection, 3+ `toTeamId` requirements, destination validation, self-route blocking, ownership validation, linked-package completeness, residual-reference blocking, exact message text/order, warning emission, and the raw `{ valid, errors, warnings }` / `{ pass, errors, warnings }` contracts
  - targeted parity now includes direct `.js` shim assertions for named/default/enforcement exports plus authoritative `validateTrade()` fail-fast assertions proving unchanged `ENTITLEMENT_ROUTING_ERROR` and `ENTITLEMENT_LINKAGE_ERROR`, first-error `reason`, normalized top-level `entitlementRouting` / `entitlementLinkage` violations, warning preservation, and no downstream team-rule result set before the early return
  - based on the actual post-E27 holdouts, the next TS slice should be selected from the remaining live JS validator surfaces; `utils/stepienEntitlementUtils.js` is a likely candidate because it remains live entitlement logic imported directly by `tradeValidator.ts`, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_ENTITLEMENT_ROUTING_E27_RETURN_PACKAGE.md`

### Validator TS Stepien Entitlement Utils E28 (2026-03-09)

- Status: The canonical `stepienEntitlementUtils` helper surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative Stepien entitlement helper logic now lives in `utils/stepienEntitlementUtils.ts`
  - `utils/stepienEntitlementUtils.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent Stepien and post-trade entitlement semantics remained unchanged, including first-round filtering, relevant-kind filtering, pooled-entitlement exclusion, `seasonYear || year` resolution, swap defaulting, output ordering, strict routing error text, 2-team `toTeamId` fallback, duplicate incoming routing detection, and `holderTeam` reassignment on incoming entitlements
  - targeted parity now includes direct `.js` shim import-stability assertions plus authoritative `validateTrade()` wiring assertions proving unchanged post-trade entitlement computation routing context through the shim-backed helper surface
  - based on the actual post-E28 holdouts, the next TS slice should be selected from the remaining live JS validator surfaces; `rules/validateStepien.js` is a likely candidate because it remains live Stepien rule logic imported directly by `tradeValidator.ts`, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_STEPIEN_ENTITLEMENT_UTILS_E28_RETURN_PACKAGE.md`

### Validator TS Validate Stepien E29 (2026-03-09)

- Status: The canonical `validateStepien` rule surface is now TS-backed in the live validator path.
- TS migration note:
  - active authoritative Stepien rule logic now lives in `rules/validateStepien.ts`
  - `rules/validateStepien.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent Stepien semantics remained unchanged, including string-array `violations`/`warnings`, exact message text/order, entitlements-SSOT baseline behavior, outgoing entitlement warning de-dupe, swap year reservation behavior, 7-year limit behavior, second-apron frozen-pick behavior, and `_debug` output structure
  - targeted parity now includes authoritative `validateTrade()` assertions proving unchanged Stepien blocker propagation through both team-level `rules.stepienRule` semantics and the trade-level legality effect, alongside the direct Stepien rule suites that continue importing the `.js` compatibility path
  - based on the actual post-E29 holdouts, the next TS slice should be selected from the remaining live JS validator surfaces; `rules/rosterValidation.js` is a likely candidate because it remains live roster-enforcement logic imported directly by `tradeValidator.ts`, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_STEPIEN_E29_RETURN_PACKAGE.md`

### Validator TS Roster Validation E30 (2026-03-09)

- Status: The canonical `rosterValidation` surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative roster-enforcement logic now lives in `rules/rosterValidation.ts`
  - `rules/rosterValidation.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent roster-validation semantics remained unchanged, including `validateRosterWindow`, `enforceRosterWindow`, `enforceRosterRules`, `enforceRosterWindowAdvanced`, legacy alias behavior, exact message text/order, current post-trade roster window behavior, current two-way counting behavior, and current return-shape/details behavior
  - the current responsibility split was preserved exactly: `rosterValidation.ts` remains a separate live roster-enforcement surface, while authoritative `validateTrade()` `team.rules.rosterCount` behavior remains owned by `validateRoster.ts` / inline `computeRosterValidation()` logic
  - targeted parity now includes direct `.js` shim assertions for the exported `rosterValidation` surface plus authoritative `validateTrade()` assertions proving unchanged top-level legality effect and unchanged `team.rules.rosterCount` roster-violation propagation
  - based on the actual post-E30 holdouts, the next TS slice should be selected from the remaining live JS validator-adjacent surfaces; `utils/tradeUtilityMisc.js` is a likely candidate because it still contains live business logic re-exported by `tradeUtilities.js` and consumed by TS-backed validator surfaces, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_ROSTER_VALIDATION_E30_RETURN_PACKAGE.md`

### Validator TS Trade Utility Misc E31 (2026-03-09)

- Status: The canonical `tradeUtilityMisc` helper surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative non-TPE trade utility helper logic now lives in `utils/tradeUtilityMisc.ts`
  - `utils/tradeUtilityMisc.js` is now a pure compatibility re-export shim with no remaining business logic
  - `utils/tradeUtilities.js` remains the JS compatibility barrel for the mixed TPE and non-TPE helper surface
  - validator-adjacent helper semantics remained unchanged, including current date/formatting helpers, current protection detection and `protectionMeta` precedence, current pick-option ordering, and current protection normalization, coercion, fallback, and awkward edge behavior
  - targeted parity now includes assertions proving the same helper identity and the same representative helper behavior through both `tradeUtilityMisc.js` and `tradeUtilities.js`, alongside the existing conveyance, Stepien, `hasStepienViolation`, and authoritative `validateTrade()` suites that continue consuming the barrel-backed helper path
  - based on the actual post-E31 holdouts, the next TS slice should be selected from the remaining live JS validator-adjacent surfaces; `rules/draftRules.js` is a likely candidate because it still contains live business logic and consumes the now-TS-backed protection helper path, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_UTILITY_MISC_E31_RETURN_PACKAGE.md`

### Validator TS Draft Rules E32 (2026-03-09)

- Status: The canonical `draftRules` surface is now TS-backed in the live validator-adjacent path.
- TS migration note:
  - active authoritative draft-rules logic now lives in `rules/draftRules.ts`
  - `rules/draftRules.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent draft-rule semantics remained unchanged, including the `hasStepienViolation()` delegation to canonical Stepien validation, the raw `validateDraftPicks()` string-array contract, exact message text/order, current `new Date().getFullYear()` behavior, current protection gating, current 7-year-limit behavior, and the strict `round === 1` filter without new round normalization or coercion
  - targeted parity now includes direct surface assertions for the `.js` shim-backed draft-rules exports plus a legacy preflight-composition assertion proving unchanged `validateDraftPicks()` output through the existing `validateAllNewRules()` path under a test-only harness that preserves the pre-existing mixed-spread contract
  - based on the actual post-E32 holdouts, the next TS slice should be selected from the remaining live JS validator-adjacent surfaces; `rules/tradeExceptions.js` is a likely candidate because it still contains live business logic rather than shim-only compatibility, but it is not mandatory if another remaining holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_DRAFT_RULES_E32_RETURN_PACKAGE.md`

### Validator TS Trade Exceptions E33 (2026-03-09)

- Status: The legacy `tradeExceptions` surface is now TS-backed in the validator-adjacent path.
- TS migration note:
  - active authoritative legacy trade-exception helper logic now lives in `rules/tradeExceptions.ts`
  - `rules/tradeExceptions.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent trade-exception semantics remained unchanged, including the legacy string-violation contract, wall-clock expiry checks via `new Date()`, `team.receives`-based TPE detection, current `getTeamTpeList(team.team)` lookup behavior, and in-place mutation of the resolved TPE object during successful usage
  - targeted parity now includes direct `.js` shim-backed surface assertions plus an official consumer-path assertion proving legacy `tradeExceptions` string violations still render unchanged after adaptation into the validator-result issue shape
  - based on the actual post-E33 holdouts, the next TS slice should be selected from the remaining live JS validator-adjacent surfaces; `rules/validateRoster.js` is a likely candidate because it still contains live rule logic and public rule semantics, but it is not mandatory if another remaining live JS holdout becomes the better next step
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_EXCEPTIONS_E33_RETURN_PACKAGE.md`

### Validator TS Validate Roster E34 (2026-03-09)

- Status: The legacy `validateRoster` surface is now TS-backed in the validator-adjacent path.
- TS migration note:
  - active authoritative legacy roster helper logic now lives in `rules/validateRoster.ts`
  - `rules/validateRoster.js` is now a pure compatibility re-export shim with no remaining business logic
  - validator-adjacent roster semantics remained unchanged, including legacy `string[]` violations, exact message/details text, the current `rosterCounts` payload, the current `warningsOnly` null/true quirk, and the current `enforceRosterWindow()` callback and grace-mode behavior
  - targeted parity now includes direct `.js` helper assertions plus validator compatibility-barrel identity/behavior assertions for both `validateRoster` and `enforceRosterWindow`
  - based on the actual post-E34 validator-adjacent graph, the next best TS slice is the paired input-helper surface `utils/validateInput.js` + `utils/normalizeTradeInput.js`
  - actual post-E34 remaining live JS business-logic count in this validator-adjacent slice: 2
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_ROSTER_E34_RETURN_PACKAGE.md`

### Validator TS Input Helpers E35 (2026-03-09)

- Status: The legacy `validateInput` and `normalizeTradeInput` helper surfaces are now TS-backed in the validator-adjacent path.
- TS migration note:
  - active authoritative input-helper logic now lives in `utils/validateInput.ts` and `utils/normalizeTradeInput.ts`
  - `utils/validateInput.js` and `utils/normalizeTradeInput.js` are now pure compatibility re-export shims with no remaining business logic
  - validator-adjacent input-helper semantics remained unchanged, including exact validation strings/order, the current cap-projection lookup order, legacy `getMatchingValue()` salary fallback behavior, canonical `getTeamTpeList(raw)` TPE reads, current normalization defaults, and current `tradeDate` defaulting
  - targeted parity now includes direct shim-backed `.js` behavior assertions for both helper files plus shim-aware normalization guardrails
  - based on the actual post-E35 inventory in the same validator-adjacent scope used in E34/E35, no live JS business-logic files remain in this slice
  - with business-logic migration complete for this scope, the next best slice is optional non-business-logic cleanup of the remaining public entrypoint barrels `utils/index.js` + `validators/index.js` if reducing JS export surfaces is still desired
  - actual post-E35 remaining live JS business-logic count in this validator-adjacent slice: 0
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_INPUT_HELPERS_E35_RETURN_PACKAGE.md`

### Validator TS Closeout Audit E36 (2026-03-10)

- Status: The validator-adjacent migration scope carried through E34/E35 is functionally complete for live JS business logic.
- Closeout note:
  - E35's "0 remaining live JS business-logic holdouts" claim is confirmed from the actual post-E35 repo state
  - the same 12-file remaining-JS inventory still describes this slice: 6 shim-only compatibility files, 4 barrel/public entrypoints, and 2 constants/message surfaces
  - nearby imported `tradeHelpers.js` and `persistenceContracts/normalizeTeamTpe.js` remain outside this migration scope and were not recounted as in-scope holdouts
  - no previously migrated JS file in this scope was found to still contain live business logic
  - the only notable cleanup caveats are stale export paths in `rules/index.js` (`./reacquisition.js`) and `utils/index.js` (`./pickUtils.js`); no current in-repo consumer path was found for either barrel
  - recommended next step: optional low-risk shim/barrel normalization pass rather than another real TS business-logic migration slice
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CLOSEOUT_AUDIT_E36_RETURN_PACKAGE.md`

### Validator TS Shim/Barrel Normalization E37 (2026-03-10)

- Status: The validator-adjacent migration scope is now practically closed out for this audited slice.
- Cleanup note:
  - removed the stale `rules/index.js` re-export of `./reacquisition.js` after re-verifying that file does not exist and no exact export-surface replacement was available
  - removed the stale `utils/index.js` re-export of `./pickUtils.js` after re-verifying that file does not exist and no exact export-surface replacement was available
  - preserved live reacquisition access through `rules/eligibilityRules.js`; no validator or helper semantics changed
  - added targeted smoke coverage proving `rules/index.js` and `utils/index.js` now import successfully as barrels
  - the same validator-adjacent scope remains complete for live JS business logic; remaining JS in this slice is intentional shim/barrel/constants surface only
  - optional follow-up: none required for practical closeout beyond any future repo-wide desire to retire compatibility JS entrypoints
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SHIM_BARREL_NORMALIZATION_E37_RETURN_PACKAGE.md`

### Validator TS Shim Retirement Audit E38 (2026-03-10)

- Status: Meaningful shim retirement is practical in the same validator-adjacent scope carried through E36/E37, but the cleanup should stay focused on internal compatibility shims rather than public JS entrypoints.
- Audit note:
  - importer inspection confirmed that the same 12-file scope still splits into 6 internal shim-only compatibility files, 4 public entrypoints/barrels, and 2 constants/message surfaces
  - the 6 internal shims now have verified direct replacement targets: `validateRoster.ts`, `validateInput.ts`, `normalizeTradeInput.ts`, `matchingValues.js`, `validateCash.js` / `validateReacquisition.js` / `validateEligibility.js`, and `tpeValidation.js` / `tradeUtilityMisc.js`
  - `index.js`, `validators/index.js`, `rules/index.js`, and `utils/index.js` still behave like public/compatibility entrypoints and should remain in JS while their internal re-exports are cleaned up
  - `constants/cbaConstants.js` and `constants/secondApronMessages.js` remain active shared surfaces and are not worth retiring in this pass
  - recommended next step: leave the public entrypoints in JS and retire the 6 internal shims in one grouped import-path cleanup pass
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SHIM_RETIREMENT_AUDIT_E38_RETURN_PACKAGE.md`

### Validator TS Internal Shim Retirement E39 (2026-03-10)

- Status: The grouped internal shim layer is now retired across the audited E38 validator-adjacent scope, while the four public JS entrypoints remain intentionally in place.
- Execution note:
  - retired `rules/validateRoster.js`, `rules/eligibilityRules.js`, `utils/validateInput.js`, `utils/normalizeTradeInput.js`, `utils/tradeUtilities.js`, and `utils/computeMatchingValues.js` after rewiring internal imports, kept barrel re-exports, and shim-only parity tests to their direct authoritative targets
  - preserved public behavior through `index.js`, `validators/index.js`, `rules/index.js`, and `utils/index.js` by keeping those JS entrypoints stable and retargeting only their internal re-export lines
  - verified that the Phase 65/66 guardrails did not require `normalizeTradeInput.js` to remain once they were updated to inspect `normalizeTradeInput.ts` directly
  - the internal shim retirement goal is effectively complete for this audited scope; no immediate follow-up remains beyond any future repo-wide desire to retire the kept public JS entrypoints
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_INTERNAL_SHIM_RETIREMENT_E39_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E40 (2026-03-10)

- Status: The E39 validator-adjacent scope remains closed. The strongest next migration candidate from the current repo state is the draft-pick resolution utility cluster after comparing it against the trade-context boundary module, the engine/cache instrumentation cluster, and broader Architect trade orchestration.
- Audit note:
  - kept the E39 JS public entrypoints/barrels/constants out of the next-scope live-business-logic count so the closed validator-adjacent slice stays closed
  - recommended next scope: `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`, `src/features/architect/utils/tradeMachine/utils/swapResolution.js`, and `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js`
  - estimated live JS business-logic count for the recommended scope: 3
  - current execution-shape read: still likely one grouped arc, with `conveyanceResolution.js` as the main dependency-risk file because it sits between `seasonManager.js` usage and DARE parity
  - the next-best nearby candidate (`tradeContext/`) was rejected as more tightly coupled to `mutationPipeline.js`, while the engine/cache JS residue read as instrumentation/stale cleanup rather than the next business-logic arc
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E40_RETURN_PACKAGE.md`

### Validator TS Draft-Pick Resolution Arc E41 (2026-03-10)

- Status: The grouped draft-pick resolution utility cluster completed cleanly as one arc. `pickIdUtils`, `swapResolution`, and `conveyanceResolution` are now TS-backed with behavior preserved.
- Execution note:
  - added authoritative TypeScript implementations for `utils/pickIdUtils`, `utils/swapResolution`, and `utils/conveyanceResolution`
  - kept `pickIdUtils.js`, `swapResolution.js`, and `conveyanceResolution.js` only as pure compatibility re-export shims because live consumers still rely on the stable `.js` paths, and `pickIdUtils` also still has extensionless importer usage
  - validated the arc with `npm run typecheck`, a narrow `npm run test:node -- --reporter=dot ...` proof set covering direct utility behavior plus season-manager-adjacent and DARE-adjacent coverage, and `npm run validate:project`
  - no immediate follow-up remains for the 3-file E41 scope beyond any future importer-state-driven desire to retire the kept `.js` compatibility shims
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_DRAFT_PICK_RESOLUTION_ARC_E41_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E42 (2026-03-10)

- Status: The E39 validator-adjacent scope remains closed and the E41 draft-pick resolution scope remains complete. The strongest next migration candidate from the current repo state is now the `tradeContext` boundary module.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints/barrels/constants so the closed validator-adjacent slice stays closed
  - re-checked and excluded `pickIdUtils.js`, `swapResolution.js`, and `conveyanceResolution.js` because the E41 arc already left them as shim-only compatibility surfaces over TS authoritative peers
  - recommended next scope: `src/features/architect/utils/tradeContext/tradeContext.js`, `src/features/architect/utils/tradeContext/assertions.js`, and `src/features/architect/utils/tradeContext/legacy/index.js`
  - confirmed live JS business-logic count for the recommended scope: 3
  - current execution-shape read: split the next arc into a core `tradeContext.js` plus `assertions.js` pass and a separate `legacy/index.js` follow-up decision
  - the nearby validator instrumentation/cache cluster remains live but awkwardly split between active support code and stale residue, while the season-manager-adjacent helper family reads as broader cross-domain follow-up work
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E42_RETURN_PACKAGE.md`

### Validator TS Trade Context Core E43 (2026-03-10)

- Status: The core `tradeContext` sub-arc completed cleanly. `tradeContext` and `assertions` are now TS-backed with behavior preserved, while `legacy/index.js` remains the intentional follow-up scope.
- Execution note:
  - added authoritative TypeScript implementations for `src/features/architect/utils/tradeContext/tradeContext.ts`, `src/features/architect/utils/tradeContext/assertions.ts`, and local support types in `src/features/architect/utils/tradeContext/types.ts`
  - reduced `tradeContext.js` and `assertions.js` to pure compatibility re-export shims so stable `.js` consumer paths remain intact without leaving business logic in JS
  - kept the public barrel behavior stable and did not reopen `legacy/index.js`, `mutationPipeline.js`, E39, or E41 scope
  - updated the tradeContext source-scan guardrails to inspect the authoritative `.ts` files while retaining shim coverage and stable runtime `.js` import proof
  - validated the pass with `npm run typecheck`, a narrow pair of `npm run test:node -- --reporter=dot ...` proof sets covering snapshot construction, apply-time fail-closed behavior, sign-and-trade preflight/apply behavior, assertion contracts, stable `.js` imports, and `npm run validate:project`
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_CONTEXT_CORE_E43_RETURN_PACKAGE.md`

### Validator TS Trade Context Legacy Follow-Up E44 (2026-03-10)

- Status: The `tradeContext` mini-arc is now fully closed out. `tradeContext/legacy/index.ts` is the authoritative deprecated wrapper, and `legacy/index.js` remains only as a pure compatibility shim.
- Execution note:
  - added authoritative TypeScript wrapper logic in `src/features/architect/utils/tradeContext/legacy/index.ts` without changing the legacy wrapper behavior
  - preserved the exact legacy wrapper sequence `Date.now()` -> `buildPostTradeTeamsSnapshot(...)` -> `validatePostTradeSnapshotForContext(...)`
  - reduced `src/features/architect/utils/tradeContext/legacy/index.js` to a pure compatibility re-export shim so stable `.js` and namespace imports remain intact
  - updated the Phase 57/59 guardrails to inspect the authoritative `.ts` file, enforce the exact wrapper call order, and prove direct `legacy/` plus `legacy/index.js` compatibility imports
  - validated the pass with `npm run typecheck`, `npm run test:node -- --reporter=dot ...` on the focused legacy-wrapper proof set, and `npm run validate:project`
- Follow-up status: no immediate follow-up remains for the `tradeContext` mini-arc beyond any future importer-state-driven choice to retire kept JS compatibility shims.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_CONTEXT_LEGACY_FOLLOWUP_E44_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E45 (2026-03-11)

- Status: E39 remains closed, E41 remains complete, and the `tradeContext` mini-arc remains complete. After re-checking those boundaries against the current repo state, the strongest next migration candidate is the trade-facing helper foundation.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints/barrels/constants so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as shim-only compatibility surfaces over TS authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete
  - recommended next scope: `src/features/architect/utils/tradeHelpers.js`, `src/features/architect/utils/hardCapUtils.js`, `src/features/architect/utils/faExceptionUtils.js`, and `src/features/architect/utils/capUtils.js`
  - estimated live JS business-logic count for the recommended scope: `4`
  - current execution-shape read: still likely one grouped arc; if importer-state friction appears later, the clean fallback split is the three supporting helper files first and `tradeHelpers.js` second
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E45_RETURN_PACKAGE.md`

### Validator TS Trade Helper Foundation E46 (2026-03-11)

- Status: The trade-facing helper foundation is now TS-backed in the root Architect helper surface, and the grouped four-file arc completed cleanly without changing live behavior.
- TS migration note:
  - authoritative helper logic now lives in `src/features/architect/utils/tradeHelpers.ts`, `src/features/architect/utils/hardCapUtils.ts`, `src/features/architect/utils/faExceptionUtils.ts`, and `src/features/architect/utils/capUtils.ts`
  - `src/features/architect/utils/tradeHelpers.js`, `src/features/architect/utils/hardCapUtils.js`, `src/features/architect/utils/faExceptionUtils.js`, and `src/features/architect/utils/capUtils.js` now remain only as pure compatibility re-export shims so extensionless and `.js` imports stay stable
  - helper behavior remained unchanged, including salary fallback order, TPE and FA-exception helper behavior, hard-cap trigger/status behavior, legacy cap/apron facade behavior, and exact current helper output text/formatting for currency, pick display, apron labels, tooltip text, and summary strings
  - targeted parity now includes expanded direct root-helper coverage, new hard-cap and FA-exception helper tests, updated Phase 42/43 guardrails, and import smoke coverage proving both extensionless and `.js` helper paths still resolve
- Follow-up status: no immediate follow-up is required for this grouped arc beyond any future importer-state-driven decision to retire kept JS shims.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_HELPER_FOUNDATION_E46_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E47 (2026-03-11)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, and the E46 trade-facing helper foundation remains complete. After re-checking those boundaries against the current repo state and applying the “smallest coherent live-business-logic boundary” rule, the strongest next migration candidate is the `capTotals` SSOT surface.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints/barrels/constants so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as shim-only compatibility surfaces over TS authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete
  - re-checked and excluded `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` because the E46 trade-facing helper foundation remains complete
  - expected heavier candidates (`persistenceContracts`, `playerRulesProfile`, and the broader cap/offseason helper family) were all inspected, but the actual current repo state surfaced `src/features/architect/utils/capTotals/computeTeamCapTotals.js` as a smaller adjacent live-business-logic boundary with stronger direct runtime pressure and a cleaner cutoff
  - recommended next scope: `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
  - estimated live JS business-logic count for the recommended scope: `1`
  - current execution-shape read: one grouped mini-arc; `src/features/architect/utils/capTotals/index.js` remains a nearby barrel/support surface, not additional live business logic
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E47_RETURN_PACKAGE.md`

### Validator TS CapTotals SSOT Boundary E48 (2026-03-11)

- Status: The `capTotals` SSOT boundary is now TS-backed, and the grouped mini-arc completed cleanly without changing live behavior.
- TS migration note:
  - authoritative totals logic now lives in `src/features/architect/utils/capTotals/computeTeamCapTotals.ts`
  - `src/features/architect/utils/capTotals/computeTeamCapTotals.js` now remains only as a pure compatibility shim so barrel, extensionless, and explicit `.js` imports stay stable
  - `src/features/architect/utils/capTotals/index.js` remained unchanged as the nearby barrel/support surface
  - totals behavior remained unchanged, including `totalCapAllocations`, `deltas`, `_meta`, dead-money precedence, cap-hold handling, incomplete-roster-charge behavior, `canUseRoomException()`, and dev-warning text/keys
  - targeted parity now includes updated capTotals source-scan guardrails and import smoke coverage proving barrel, extensionless direct, and explicit `.js` direct paths still resolve
- Follow-up status: no immediate follow-up is required for this grouped mini-arc beyond any future importer-state-driven decision to retire compatibility shims if they ever become unnecessary.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CAPTOTALS_SSOT_BOUNDARY_E48_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E49 (2026-03-11)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, and the E48 `capTotals` mini-arc remains complete. The expected leading candidate from current repo inspection was `src/features/architect/utils/persistenceContracts/`, and the full E49 comparison pass confirmed that it remains the strongest next migration scope.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints, barrels, and constants so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as shim-only compatibility surfaces over TS-authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete
  - re-checked and excluded `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` because the E46 helper-foundation arc remains complete
  - re-checked and excluded `src/features/architect/utils/capTotals/computeTeamCapTotals.js` because the E48 `capTotals` mini-arc remains complete and the kept JS file is still a pure compatibility shim
  - recommended next scope: `src/features/architect/utils/persistenceContracts/`
  - recommended core live JS business-logic files: `normalizeTeamTpe.js`, `validatePersistableShape.js`, and `enforcement.js`
  - `contracts.js` classification from file-content inspection: `rule-definition surface`
  - estimated live JS business-logic count for the recommended scope: `3`
- current execution-shape read: likely one grouped folder arc; split only if typing or importer friction appears later around the rule-definition support surface
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E49_RETURN_PACKAGE.md`

### Validator TS Persistence Contracts E50 (2026-03-11)

- Status: The `persistenceContracts` boundary is now TS-backed, and the grouped folder arc completed cleanly without changing runtime behavior.
- TS migration note:
  - authoritative implementations now live in `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.ts`, `validatePersistableShape.ts`, `enforcement.ts`, and `contracts.ts`
  - `normalizeTeamTpe.js`, `validatePersistableShape.js`, `enforcement.js`, and `contracts.js` now remain only as pure compatibility shims so barrel, extensionless, and explicit `.js` imports stay stable
  - `index.js` remained unchanged as the nearby barrel/support surface
  - behavior remained unchanged across canonical-vs-legacy merge order, alias backfilling, deterministic deduplication, quiet-by-default telemetry, deep-rule traversal, violation paths/messages, env gating, allowlists, deep-rule structures, and `PERSISTENCE_CONTRACTS` ordering
  - targeted parity now includes updated persistence-contract source-scan guardrails and import smoke coverage proving barrel, extensionless direct, and explicit `.js` direct paths still resolve
- Follow-up status: no immediate follow-up is recommended; the remaining JS in this boundary is narrow, intentional compatibility support only.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_PERSISTENCE_CONTRACTS_E50_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E51 (2026-03-11)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, and the E50 `persistenceContracts` arc remains complete. After re-checking those boundaries against the current repo state and comparing the strongest nearby candidates again, the expected leading season-transition helper cluster still reads as the best next migration scope.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints, barrels, and constants so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as shim-only compatibility surfaces over TS-authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete
  - re-checked and excluded `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` because the E46 helper-foundation arc remains complete
  - re-checked and excluded `src/features/architect/utils/capTotals/computeTeamCapTotals.js` because the E48 `capTotals` mini-arc remains complete and the kept JS file is still a pure compatibility shim
  - re-checked and excluded the E50 `persistenceContracts` JS files because they still read as shim-only compatibility surfaces over TS-authoritative peers
  - recommended next scope: the season-transition helper cluster centered on `src/features/architect/utils/tpeLifecycle.js`, `src/features/architect/utils/exceptions/exceptionLifecycle.js`, and `src/features/architect/utils/entitlements/seasonManagerProjection.js`
  - estimated core live JS business-logic count for the recommended scope: `3`
  - `src/features/architect/utils/exceptionHistory/historyHelpers.js` was inspected explicitly and remains adjacent cross-flow support, not part of the core count; if future execution proves it inseparable, treat it as included support or a split follow-up instead of silently broadening the core arc
  - current execution-shape read: likely one grouped helper arc; clean fallback split is the lifecycle pair first and `seasonManagerProjection.js` second if cross-folder typing/import friction appears
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E51_RETURN_PACKAGE.md`

### Validator TS Season-Transition Helpers E52 (2026-03-11)

- Status: `src/features/architect/utils/tpeLifecycle`, `src/features/architect/utils/exceptions/exceptionLifecycle`, and `src/features/architect/utils/entitlements/seasonManagerProjection` now have authoritative TS implementations. The kept `.js` files remain only as pure compatibility shims, while `exceptions/index.js` stayed unchanged as the stable public barrel surface.
- Execution note:
  - preserved exact July 1 season-boundary behavior, invalid-date fail-safe behavior, legacy expiry backfill behavior, legacy exception-key remapping, enabled-flag preservation, amount reset/recompute behavior, DPE rollover clearing behavior, and the exact Season Manager projection object shape
  - preserved the exact projected placeholder fields, `resolutionMeta`, debug metadata, and `_projectedAt` behavior in the Season Manager projection output
  - added focused compatibility proof for extensionless direct imports, explicit `.js` direct imports, and the `exceptions` barrel surface
  - kept `src/features/architect/utils/exceptionHistory/historyHelpers.js` out of scope; execution did not prove it inseparable from the grouped helper arc
- Follow-up status: no immediate follow-up is recommended; the remaining JS in this boundary is intentional compatibility or nearby support only.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SEASON_TRANSITION_HELPERS_E52_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E53 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, and the E52 season-transition helper arc remains complete. After re-checking those boundaries against the actual current repo state, the expected leading candidate from current repo inspection, `src/features/architect/utils/exceptionHistory/historyHelpers.js`, was confirmed as the best next migration scope.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints, barrels, and constants so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as shim-only compatibility surfaces over TS-authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete
  - re-checked and excluded `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` because the E46 helper-foundation arc remains complete
  - re-checked and excluded `src/features/architect/utils/capTotals/computeTeamCapTotals.js` because the E48 `capTotals` mini-arc remains complete and the kept JS file is still a pure compatibility shim
  - re-checked and excluded the E50 `persistenceContracts` JS files because they still read as shim-only compatibility surfaces over TS-authoritative peers
  - re-checked and excluded the E52 helper-cluster JS files because they still read as compatibility shims over their authoritative `.ts` peers
  - re-checked and excluded `src/features/architect/utils/runOffseason.js` because it still reads as a thin DEV-only wrapper over the TS offseason engine rather than the next core live-business-logic boundary
  - compared the strongest remaining candidates: `exceptionHistory/historyHelpers.js`, the `playerRulesProfile/` rule engine, the entitlement UI projection pair, and the broader orchestration family centered on `capLegalityValidation.js`, `mutationPipeline.js`, `seasonManager.js`, and `worldManager.js`
  - inspected and rejected the remaining Trade Machine cache/debug residue as an awkward mixed bag, including explicit zero-import checks of `validatorFactory.js`, `resolveValidationEntitlements.js`, and `validationCacheManager.js`
  - recommended next scope: `src/features/architect/utils/exceptionHistory/historyHelpers.js`
  - estimated live JS business-logic count for the recommended scope: `1`
  - current execution-shape read: one grouped mini-arc
  - hard rule: do not broaden the arc by pulling in adjacent exception-history consumers or wrappers unless execution evidence proves a direct dependency blocker
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E53_RETURN_PACKAGE.md`

### Validator TS Exception History E54 (2026-03-12)

- Status: `src/features/architect/utils/exceptionHistory/historyHelpers` is now TS-backed through an authoritative `historyHelpers.ts` implementation. The kept `historyHelpers.js` file is now a pure compatibility shim, and trade / season-advance / offseason callers continued importing the same stable path.
- Execution note:
  - preserved deterministic `historyKey` generation for creation, consumption, and expiry entries, with unchanged signature parts, defaults, and global-world handling
  - preserved the exact exception-history entry shapes and field inclusion rules, including field order, optional `worldId` / `mutationId` / `createdFrom` behavior, `null` fallbacks, and timestamp behavior
  - preserved `appendExceptionHistory()` as the same in-place mutation helper, including empty-input initialization, existing-entry fallback key handling, and `historyKey`-based dedupe behavior
  - added focused guardrails for exact creation/consumption entry shape, null-return paths, in-place mutation semantics, legacy-entry tolerance, and direct-path / explicit `.js` import compatibility
- Follow-up status: no immediate follow-up is recommended; the grouped mini-arc completed cleanly and the remaining JS in this boundary is intentional shim-only compatibility support.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_EXCEPTION_HISTORY_E54_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E55 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, and the E54 exception-history mini-arc remains complete. The expected leading candidate from current repo inspection was `src/features/architect/utils/playerRulesProfile/`, and final verification against the actual current repo state confirmed that it is now the strongest next migration scope.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints, barrels, constants, and support residue so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as shim-only compatibility surfaces over TS-authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete, while `tradeContext/index.js` remains only an intentional public barrel
  - re-checked and excluded `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` because the E46 helper-foundation arc remains complete
  - re-checked and excluded `src/features/architect/utils/capTotals/computeTeamCapTotals.js` because the E48 `capTotals` mini-arc remains complete and the kept JS file is still a pure compatibility shim
  - re-checked and excluded the E50 `persistenceContracts` JS files because they still read as shim-only compatibility surfaces over TS-authoritative peers, while `persistenceContracts/index.js` remains a barrel surface
  - re-checked and excluded the E52 helper-cluster JS files because they still read as compatibility shims over their authoritative `.ts` peers, while `exceptions/index.js` remains a barrel surface
  - re-checked and excluded `src/features/architect/utils/exceptionHistory/historyHelpers.js` because the E54 exception-history mini-arc remains complete and the kept JS file is now shim-only compatibility support
  - compared the strongest remaining candidates: `playerRulesProfile/`, the entitlement projection pair, the broader orchestration family centered on `capLegalityValidation.js`, `mutationPipeline.js`, `seasonManager.js`, and `worldManager.js`, and the remaining Trade Machine support residue
  - explicitly inspected the required zero-import residue files `validatorFactory.js`, `resolveValidationEntitlements.js`, and `validationCacheManager.js` before excluding that area as the next business-logic arc
  - recommended next scope: `src/features/architect/utils/playerRulesProfile/`
  - estimated live JS business-logic count for the recommended scope: `6`
- current execution-shape read: keep the arc unified at the audit level, but use phased execution rather than a blind one-shot conversion because `computeProfile.js` is the higher-coupling aggregation hub over the leaf rule modules
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E55_RETURN_PACKAGE.md`

### Validator TS Player Rules Profile Leaf Rules E56 (2026-03-12)

- Status: the five `playerRulesProfile` leaf-rule modules are now TS-backed through authoritative `.ts` implementations:
  - `minimumSalaryRules.ts`
  - `maxSalaryRules.ts`
  - `birdRightsRules.ts`
  - `rfaRules.ts`
  - `extensionRules.ts`
- Execution note:
  - preserved legacy and RuleContext entry points across the migrated leaf modules with unchanged runtime outputs, warning behavior, fallback/default behavior, exported constants, aliases, and reason strings
  - converted each kept leaf `.js` file into a pure compatibility shim so explicit `.js` deep imports and extensionless TS imports continue resolving without consumer changes
  - added focused direct-surface RuleContext coverage for the five leaf modules plus smoke coverage for extensionless import compatibility, explicit `.js` compatibility, export identity parity, and shim-only JS contents
  - kept `computeProfile.js` out of scope as the next intended follow-up phase and did not widen this pass into the aggregation hub, orchestration, or UI consumers
- Follow-up status: the grouped leaf-rule phase completed cleanly. No further E56 pass is required. `computeProfile.js` remains the intended next follow-up phase unless future execution evidence proves otherwise.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_PLAYER_RULES_PROFILE_LEAF_RULES_E56_RETURN_PACKAGE.md`

### Validator TS Player Rules Profile Compute Profile E57 (2026-03-12)

- Status: `src/features/architect/utils/playerRulesProfile/computeProfile` is now TS-backed through an authoritative `computeProfile.ts` implementation. The kept `computeProfile.js` file is now a pure compatibility shim, while the `index.js` barrel and `types.js` JSDoc support file remain intentionally out of scope.
- Execution note:
  - preserved the current aggregation-hub behavior exactly, including league-context normalization, simulation-date-driven season defaults, contract-summary assembly, profile field ordering, nested helper-field presence, fallback/default behavior, and reason propagation
  - preserved the current interaction with the five E56 leaf-rule modules by keeping the hub imports on the existing `.js` compatibility paths rather than rewiring consumers or widening into `salaryEngine` / `capLegalityValidation`
  - added focused coverage for simulation-date normalization, empty-profile timing behavior, contract-summary fallback derivation, current-salary `capHit` fallback, nested helper-field defaults, root/nested field ordering, and deep-path import compatibility for extensionless plus explicit `.js` hub imports
  - typing exposed one existing empty-profile mismatch: the hub's error-path `birdRights.signingAbilities` omits several fields present in the normal Bird-rights result. This was handled as local hub typing only, with no runtime shape changes and no E56 leaf reopening
- Follow-up status: the `computeProfile` phase completed cleanly. No immediate follow-up is recommended, and the broader `playerRulesProfile` arc is now effectively complete because the remaining JS in this folder is intentional compatibility/barrel/documentation surface only.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_PLAYER_RULES_PROFILE_COMPUTE_PROFILE_E57_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E58 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, and the E56/E57 `playerRulesProfile` arc remains complete. The expected leading candidate from current repo inspection was the contract/season helper family centered on `src/features/architect/utils/seasonFormat.js`, `src/features/architect/utils/contractUtils.js`, and `src/features/architect/utils/contractSalaryUtils.js`, and final verification against the actual current repo state confirmed it as the strongest next migration scope.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints, barrels, constants, and support residue so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as shim-only compatibility surfaces over TS-authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete, while `tradeContext/index.js` remains only an intentional public barrel
  - re-checked and excluded `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` because the E46 helper-foundation arc remains complete
  - re-checked and excluded `src/features/architect/utils/capTotals/computeTeamCapTotals.js` because the E48 `capTotals` mini-arc remains complete and the kept JS file is still a pure compatibility shim
  - re-checked and excluded the E50 `persistenceContracts` JS files because they still read as shim-only compatibility surfaces over TS-authoritative peers, while `persistenceContracts/index.js` remains a barrel surface
  - re-checked and excluded the E52 helper-cluster JS files because they still read as compatibility shims over their authoritative `.ts` peers, while `exceptions/index.js` remains a barrel surface
  - re-checked and excluded `src/features/architect/utils/exceptionHistory/historyHelpers.js` because the E54 exception-history mini-arc remains complete and the kept JS file is now shim-only compatibility support
  - re-checked and excluded the E56/E57 `playerRulesProfile` JS files because they still read as compatibility shims over authoritative `.ts` peers, while `playerRulesProfile/index.js` and `types.js` remain intentional barrel/JSDoc support
  - compared the strongest remaining candidates: the contract/season helper family, the entitlement projection pair, the broader orchestration family centered on `capLegalityValidation.js`, `mutationPipeline.js`, `seasonManager.js`, and `worldManager.js`, and the remaining Trade Machine support residue
  - explicitly inspected the required zero-import residue files `validatorFactory.js`, `resolveValidationEntitlements.js`, and `validationCacheManager.js` before excluding that area as the next business-logic arc
  - recommended next scope: the contract/season helper family centered on `src/features/architect/utils/seasonFormat.js`, `src/features/architect/utils/contractUtils.js`, and `src/features/architect/utils/contractSalaryUtils.js`
  - estimated live JS business-logic count for the recommended scope: `3`
- current execution-shape read: handle the next arc as one grouped scope. No blocker was found that requires silently widening beyond `seasonFormat.js`, `contractUtils.js`, and `contractSalaryUtils.js`; `contractUtils.js` can stay bounded because its only notable external edge is a backwards-compatible re-export from the already-TS `capHolds.ts`.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E58_RETURN_PACKAGE.md`

### Validator TS Contract Season Helpers E59 (2026-03-12)

- Status: the contract/season helper boundary is now TS-backed through authoritative `.ts` implementations:
  - `src/features/architect/utils/seasonFormat.ts`
  - `src/features/architect/utils/contractUtils.ts`
  - `src/features/architect/utils/contractSalaryUtils.ts`
- Execution note:
  - preserved the current season conversion semantics, mixed numeric-year and `YYYY-YY` handling, season-end-year behavior, contract generation/shaping behavior, contract-row merge/dedupe/sort behavior, extension-row precedence, salary lookup/fallback behavior, warning behavior, fallback/default behavior, and the `calculateCapHold` re-export
  - converted `seasonFormat.js`, `contractUtils.js`, and `contractSalaryUtils.js` into pure compatibility shims so explicit `.js` imports and extensionless imports continue resolving without consumer rewrites
  - added focused direct-surface coverage for season parsing/defaults, contract shaping, merge/dedupe behavior, years-remaining fallback behavior, stretch behavior, last-salary lookup, salary warning behavior, and import-compatibility smoke coverage for extensionless plus explicit `.js` helper imports
  - kept `seasonUtils.js` and `capProjections.js` intentionally out of scope; neither blocked the grouped migration arc
- Follow-up status: the grouped arc completed cleanly. No immediate E59 follow-up is required inside the migrated boundary; remaining adjacent JS holdouts are intentional out-of-scope wrapper or data surfaces.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CONTRACT_SEASON_HELPERS_E59_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E60 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, and the E59 contract/season helper arc remains complete. The expected leading candidate from current repo inspection was the non-trade cap-legality family centered on `src/features/architect/utils/capLegalityValidation.js`, `src/features/architect/utils/contractNormalization.js`, and `src/features/architect/utils/capHoldTransitionHelpers.js`, and final verification against the actual current repo state confirmed it as the strongest next migration scope.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints, barrels, constants, and support residue so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as shim-only compatibility surfaces over TS-authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete, while `tradeContext/index.js` remains only an intentional public barrel
  - re-checked and excluded `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` because the E46 helper-foundation arc remains complete
  - re-checked and excluded `src/features/architect/utils/capTotals/computeTeamCapTotals.js` because the E48 `capTotals` mini-arc remains complete and the kept JS file is still a pure compatibility shim
  - re-checked and excluded the E50 `persistenceContracts` JS files because they still read as shim-only compatibility surfaces over TS-authoritative peers, while `persistenceContracts/index.js` remains a barrel surface
  - re-checked and excluded the E52 helper-cluster JS files because they still read as compatibility shims over their authoritative `.ts` peers, while `exceptions/index.js` remains a barrel surface
  - re-checked and excluded `src/features/architect/utils/exceptionHistory/historyHelpers.js` because the E54 exception-history mini-arc remains complete and the kept JS file is now shim-only compatibility support
  - re-checked and excluded the E56/E57 `playerRulesProfile` JS files because they still read as compatibility shims over authoritative `.ts` peers, while `playerRulesProfile/index.js` and `types.js` remain intentional barrel/JSDoc support
  - re-checked and excluded the E59 helper JS files because they remain pure compatibility shims over authoritative TS peers, while `seasonUtils.js` remains a deprecated wrapper and `capProjections.js` remains a data/constants surface
  - compared the strongest remaining candidates: the non-trade cap-legality family, the entitlement projection pair, the broader orchestration family centered on `mutationPipeline.js`, `seasonManager.js`, and `worldManager.js`, and the remaining Trade Machine support residue
  - explicitly inspected and excluded `validatorFactory.js`, `resolveValidationEntitlements.js`, and `validationCacheManager.js` as support residue rather than the next live business-logic arc
  - recommended next scope: the non-trade cap-legality family centered on `contractNormalization.js`, `capHoldTransitionHelpers.js`, and `capLegalityValidation.js`
  - estimated live JS business-logic count for the recommended scope: `3`
- current execution-shape read: keep the arc unified at the audit level, but do not run it as a blind one-shot grouped conversion if `capLegalityValidation.js` remains the high-coupling hub. Current repo evidence says the next pass should execute helper modules first, then the validator hub.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E60_RETURN_PACKAGE.md`

### Validator TS Cap Legality Helpers E61 (2026-03-12)

- Status: the helper-first portion of the non-trade cap-legality boundary is now TS-backed through authoritative `.ts` implementations:
  - `src/features/architect/utils/contractNormalization.ts`
  - `src/features/architect/utils/capHoldTransitionHelpers.ts`
- Execution note:
  - preserved the current named-export surfaces, contract/free-agency normalization semantics, cap-hold transition reasoning, result shapes, warning/reason behavior, fallback/default behavior, and current dependency behavior
  - converted `contractNormalization.js` and `capHoldTransitionHelpers.js` into pure compatibility shims so explicit `.js` imports and extensionless imports continue resolving without consumer rewrites
  - added focused direct-surface coverage for team-ref normalization, free-agency year plausibility, cap-hold lookup/validation/decline reasoning, and smoke coverage for extensionless plus explicit `.js` helper imports
  - kept `capLegalityValidation.js` intentionally out of scope as the next planned follow-up phase; no validator-hub edits were required to complete the helper-first migration
- Follow-up status: the helper-first phase completed cleanly. The intended next follow-up phase remains `src/features/architect/utils/capLegalityValidation.js`; no helper-side blocker remains.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_LEGALITY_HELPERS_E61_RETURN_PACKAGE.md`

### Validator TS Cap Legality Validator Hub E62 (2026-03-12)

- Status: the validator-hub portion of the non-trade cap-legality boundary is now TS-backed through authoritative `src/features/architect/utils/capLegalityValidation.ts`.
- Execution note:
  - preserved the current named-export surface, rule arrays/constants, default-export object member order, validator outputs, issue/reason/warning text, fallback/default behavior, and helper interactions with `contractNormalization` plus `capHoldTransitionHelpers`
  - converted `capLegalityValidation.js` into a pure compatibility shim so extensionless and explicit `.js` imports continue resolving without runtime consumer rewrites
  - retargeted source-scan guardrails to inspect the TS authority and added focused smoke coverage for extensionless imports, explicit `.js` imports, default export parity, and shim-only content
  - required only local permissive typing/casting inside the new TS authority; no helper-phase reopen and no validator semantic cleanup were needed
- Follow-up status: the validator-hub phase completed cleanly. No immediate follow-up remains inside the non-trade cap-legality boundary, and the broader non-trade cap-legality arc is now effectively complete.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_LEGALITY_VALIDATOR_HUB_E62_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E63 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, and the E61/E62 non-trade cap-legality arc remains complete. The expected leading candidate from current repo inspection was the world-aware loader boundary centered on `src/features/architect/utils/teamLoader.js`, and final verification against the actual current repo state confirmed it as the strongest next migration scope.
- Audit note:
  - re-checked and excluded the E39-kept JS entrypoints, barrels, constants, and support residue so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as compatibility re-export surfaces over TS-authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete, while `tradeContext/index.js` remains only an intentional public barrel
  - re-checked and excluded `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` because the E46 helper-foundation arc remains complete
  - re-checked and excluded `src/features/architect/utils/capTotals/computeTeamCapTotals.js` because the E48 `capTotals` mini-arc remains complete and the kept JS file is still a pure compatibility shim
  - re-checked and excluded the E50 `persistenceContracts` JS files because they still read as shim-only compatibility surfaces over TS-authoritative peers, while `persistenceContracts/index.js` remains a barrel surface
  - re-checked and excluded the E52 helper-cluster JS files because they still read as compatibility shims over authoritative `.ts` peers, while `exceptions/index.js` remains a barrel surface
  - re-checked and excluded `src/features/architect/utils/exceptionHistory/historyHelpers.js` because the E54 exception-history mini-arc remains complete and the kept JS file is now shim-only compatibility support
  - re-checked and excluded the E56/E57 `playerRulesProfile` JS files because they still read as compatibility shims over authoritative `.ts` peers, while `playerRulesProfile/index.js` and `types.js` remain intentional barrel/JSDoc support
  - re-checked and excluded the E59 helper JS files because they remain pure compatibility shims over authoritative TS peers, while `seasonUtils.js` remains a deprecated wrapper and `capProjections.js` remains a data/constants surface
  - re-checked and excluded `contractNormalization.js`, `capHoldTransitionHelpers.js`, and `capLegalityValidation.js` because the E61/E62 non-trade cap-legality arc remains complete and all three now read as pure compatibility shims over authoritative TS peers
  - compared the strongest remaining candidates: `teamLoader.js`, the entitlement projection/display pair, and the broader orchestration/world-mutation family centered on `mutationPipeline.js`, `seasonManager.js`, `worldManager.js`, `tradeManager.js`, `firebaseTeamPlanHelpers.js`, and `schemaAdapter.js`
  - explicitly inspected loader-adjacent and support-residue surfaces including `consentUtils.js`, `validatorFactory.js`, `resolveValidationEntitlements.js`, `validationCacheManager.js`, `cashUtils.js`, and `draftPickUtils.js` before excluding them from the next-scope live-business-logic count
  - no blocker was found that requires widening the recommended scope to `firebaseTeamPlanHelpers.js`, `worldManager.js`, or other loader-adjacent helpers
  - recommended next scope: `src/features/architect/utils/teamLoader.js`
  - estimated live JS business-logic count for the recommended scope: `1`
- current execution-shape read: the next arc currently reads as one grouped mini-arc centered on `teamLoader.js`; do not widen it unless future execution uncovers a concrete blocker that must be documented explicitly.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E63_RETURN_PACKAGE.md`

### Validator TS World-Aware Team Loader E64 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, and the E61/E62 non-trade cap-legality arc remains complete. The world-aware loader boundary is now TS-backed through authoritative `src/features/architect/utils/teamLoader.ts`.
- Execution note:
  - preserved the exact world -> parent -> base fallback chain, `getLeague()` batch-loading behavior, `getTeam()`, `getPlayer()`, `mergePlayerOverride()`, and internal `mergeSalariesByYear()` behavior without redesigning loader semantics
  - preserved the exact hardcoded 30-team list and its current ordering inside the TS authority, with no shared-constant refactor
  - converted `src/features/architect/utils/teamLoader.js` into a pure compatibility shim so direct-path, explicit `.js`, and extensionless imports remain intact without consumer rewrites
  - added focused regression coverage for snapshot hydration fallback, salary override replace/append/sort behavior, and shim/API compatibility
  - no blocker required widening into `firebaseTeamPlanHelpers.js`, `worldManager.js`, or other adjacent loader/orchestration helpers
- current execution-shape read: the single-file world-aware loader mini-arc completed cleanly, and no immediate follow-up is recommended beyond optional future shim removal if importer state ever makes that safe.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_WORLD_AWARE_TEAM_LOADER_E64_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E65 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, and the E64 world-aware loader mini-arc remains complete.
- Audit note:
  - the expected leading candidate from current repo inspection was the loader-adjacent world data access boundary around `worldManager.js` and `firebaseTeamPlanHelpers.js`, but final comparison against the entitlement/display pair and the trade UI utility pocket did not keep it as the winner
  - `worldManager.js` plus `firebaseTeamPlanHelpers.js` stayed a serious candidate because they are runtime-live and directly adjacent to E64, but the pair reads as broader and more coupled than the next best alternative
  - the trade UI utility pocket (`getOfficialSalaryMatchingSnapshot.js` + `computeTradeDraftKey.js`) is smaller, but reads more like two separate micro-arcs than one clean grouped next slice
  - recommended next scope: `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`, `src/features/architect/utils/entitlements/formatEntitlement.js`, and `src/features/architect/tradeMachine/utils/entitlementWarnings.js`
  - estimated live JS business-logic count for the recommended scope: `3`
- current execution-shape read: the next arc is worth doing, but it is larger than E64 and should likely be split into a core `entitlementPickRowProjection.js` pass followed by a smaller `formatEntitlement.js` + `entitlementWarnings.js` follow-up.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E65_RETURN_PACKAGE.md`

### Validator TS Entitlement Projection Core E66 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, and the E64 world-aware loader mini-arc remains complete. The entitlement projection core is now TS-backed through authoritative `src/features/architect/utils/entitlements/entitlementPickRowProjection.ts`.
- Execution note:
  - preserved the exact `projectEntitlementToPickRow()`, `getPickRowDisplayLabel()`, and `getPickRowSecondaryText()` named export surface with no default export added
  - preserved current projection semantics, including fallback/default handling, ladder-summary assembly, `termsShort` override/fallback behavior, null placeholders, and current behavior-bearing strings
  - converted `src/features/architect/utils/entitlements/entitlementPickRowProjection.js` into a pure compatibility shim so direct-path, explicit `.js`, and extensionless imports remain intact without consumer rewrites
  - added focused regression coverage for the shim/API contract plus projection branches around ladder summary and `termsShort`
  - no blocker required widening into `formatEntitlement.js`, `entitlementWarnings.js`, UI consumers, or broader entitlement orchestration files
- current execution-shape read: the projection-core phase completed cleanly as a single-file TS-backed pass. The intended next follow-up phase remains `formatEntitlement.js` plus `entitlementWarnings.js`.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_ENTITLEMENT_PROJECTION_CORE_E66_RETURN_PACKAGE.md`

### Validator TS Entitlement Presentation Helpers E67 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, and the E66 entitlement projection core remains complete. The entitlement presentation helper boundary is now TS-backed through authoritative `src/features/architect/utils/entitlements/formatEntitlement.ts` and `src/features/architect/tradeMachine/utils/entitlementWarnings.ts`.
- Execution note:
  - preserved the exact named export surfaces for `formatEntitlement` and `entitlementWarnings` with no default exports added
  - preserved current helper behavior exactly, including returned object keys, badge/tag color classes, label strings, formatting fallback/default behavior, warning text, warning evaluation/insertion order, and sort-priority behavior
  - converted `src/features/architect/utils/entitlements/formatEntitlement.js` and `src/features/architect/tradeMachine/utils/entitlementWarnings.js` into pure compatibility shims so direct-path, explicit `.js`, and extensionless imports remain intact without consumer rewrites
  - added focused regression coverage for helper outputs plus shim/API compatibility
  - no blocker required widening into UI consumers, orchestration files, or reopening the E66 projection-core boundary
- current execution-shape read: the follow-up helper phase completed cleanly with no required small follow-up beyond optional future shim removal if importer state ever makes that safe. The broader entitlement presentation arc is now effectively complete.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_ENTITLEMENT_PRESENTATION_HELPERS_E67_RETURN_PACKAGE.md`

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
| **Second apron aggregation block** | Cannot aggregate 2+ outgoing into higher incoming | `rules/basicRules.ts`, `rules/validateAggregation.ts` | `tests/trade/validateAggregation.test.ts`, `tests/tradeValidatorEdgeCases.test.js` |
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
| **Consecutive first-round pick restriction** | Cannot trade consecutive unprotected future firsts | `rules/draftRules.ts` → `validateStepien.ts` (SSOT) | `tests/validators/stepien.test.js`, `src/tests/tradeMachine/stepienObligations.test.js` |
| **7-year future limit** | Cannot trade picks > 7 years out | `rules/draftRules.ts` | Same |
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
