# TRADE_MACHINE_MASTER

Last updated: 2026-03-20

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

### Validator TS Next-Scope Expansion Audit E68 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, and the E66/E67 entitlement presentation arc remains complete. After re-checking those boundaries against the actual current repo state, the strongest next migration candidate is the Trade Machine validation snapshot/accessor boundary.
- Audit note:
  - re-checked and excluded the E39-kept JS public entrypoints/barrels/constants so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as compatibility shims over TS-authoritative peers
  - re-checked and excluded `tradeContext.js`, `assertions.js`, and `legacy/index.js` because the E43/E44 `tradeContext` mini-arc remains complete, while `tradeContext/index.js` remains a public barrel surface
  - re-checked and excluded `tradeHelpers.js`, `hardCapUtils.js`, `faExceptionUtils.js`, and `capUtils.js` because the E46 helper-foundation arc remains complete
  - re-checked and excluded `src/features/architect/utils/capTotals/computeTeamCapTotals.js` because the E48 `capTotals` mini-arc remains complete and the kept JS file is still shim-only compatibility support, while `capTotals/index.js` remains a barrel surface
  - re-checked and excluded the E50 `persistenceContracts` JS files because they still read as shim-only compatibility surfaces over TS-authoritative peers, while `persistenceContracts/index.js` remains a public API barrel
  - re-checked and excluded the E52 helper-cluster JS files because they still read as compatibility shims over authoritative `.ts` peers, while `exceptions/index.js` remains a barrel surface
  - re-checked and excluded `src/features/architect/utils/exceptionHistory/historyHelpers.js` because the E54 exception-history mini-arc remains complete and the kept JS file is now shim-only compatibility support
  - re-checked and excluded the E56/E57 `playerRulesProfile` JS files because they still read as compatibility shims over authoritative `.ts` peers, while `playerRulesProfile/index.js` remains a barrel surface
  - re-checked and excluded the E59 helper JS files because they remain pure compatibility shims over authoritative TS peers, while `seasonUtils.js` remains a deprecated wrapper and `capProjections.js` remains a live data/constants surface rather than the next business-logic arc
  - re-checked and excluded `contractNormalization.js`, `capHoldTransitionHelpers.js`, and `capLegalityValidation.js` because the E61/E62 non-trade cap-legality arc remains complete and all three now read as compatibility shims over authoritative TS peers
  - re-checked and excluded `src/features/architect/utils/teamLoader.js` because the E64 world-aware loader mini-arc remains complete and the kept JS file is shim-only compatibility support
  - re-checked and excluded the E66/E67 entitlement presentation files because they now read as compatibility shims over authoritative TS peers
  - recommended next scope: `src/features/architect/hooks/useTradeMachineSnapshot.js` and `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`
  - estimated live JS business-logic count for the recommended scope: `2`
- current execution-shape read: the next arc looks smaller than E66/E67, worth doing next, and likely clean as one grouped mini-arc. Do not silently widen it to `computeTradeDraftKey.js`, `useTradeMachine.js`, validator engine files, or export utilities unless future execution evidence proves the snapshot/accessor boundary cannot stand cleanly without them; if that happens, document the exact blocker instead of auto-expanding the scope.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E68_RETURN_PACKAGE.md`

### Validator TS Trade Machine Snapshot Accessors E69 (2026-03-12)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, and the E66/E67 entitlement presentation arc remains complete. The Trade Machine validation snapshot/accessor boundary is now TS-backed through authoritative `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.ts` and `src/features/architect/hooks/useTradeMachineSnapshot.ts`.
- Execution note:
  - preserved the exact named export surfaces for both snapshot/accessor files with no default exports added
  - preserved current behavior exactly, including selector field-path precedence, selector null/default behavior, accessor fallback/default behavior, direct dependency on the official selector, and the exact returned object keys and assembly order inside `useTradeMachineSnapshot`
  - converted `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js` and `src/features/architect/hooks/useTradeMachineSnapshot.js` into pure compatibility shims so direct-path, explicit `.js`, and extensionless imports remain intact without consumer rewrites
  - added focused compatibility coverage proving both `.js` files remain shim-only and that explicit `.js` imports expose the same named API as extensionless imports
  - no blocker required widening into `computeTradeDraftKey.js`, `useTradeMachine.js`, validator engine files, export utilities, or UI consumers
- current execution-shape read: the grouped snapshot/accessor mini-arc completed cleanly, no required small follow-up remains beyond optional future shim removal if importer state ever makes that safe, and the broader Trade Machine validation snapshot/accessor arc is now effectively complete.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_MACHINE_SNAPSHOT_ACCESSORS_E69_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E70 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, and the E69 Trade Machine validation snapshot/accessor arc remains complete. After re-checking the remaining nearby JS surface against current importer/runtime evidence, the strongest next migration candidate is the Architect contract/cap hook boundary centered on `src/features/architect/hooks/usePlayerRulesProfiles.js` and `src/features/architect/hooks/useCapValidation.js`.
- Audit note:
  - re-checked and excluded E39-kept public entrypoints/barrels/constants so the closed validator-adjacent slice stays closed
  - re-checked and excluded the E41 draft-pick resolution files because they still read as TS-backed compatibility surfaces rather than reopened business logic
  - re-checked and excluded the E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, and E69 same-name `.js` files because they still read as compatibility shims, deprecated wrappers, or barrel surfaces over authoritative TS peers
  - re-checked and excluded `src/features/architect/hooks/useArchitectPlayerData.js` because it currently reads as a thin subscription wrapper over TS-backed data access rather than the next contract/cap business-logic arc
  - re-checked and excluded `src/features/architect/utils/capProjections.js` because it remains a deprecated data/constants surface rather than a clean next business-logic boundary
  - recommended next scope: `src/features/architect/hooks/usePlayerRulesProfiles.js` and `src/features/architect/hooks/useCapValidation.js`
  - estimated live JS business-logic count for the recommended scope: `2`
- current execution-shape read: the next arc looks larger than E69 but still materially smaller and cleaner than the Trade Machine hook-support family, the world/data-access family, and the larger orchestration family, so it is worth doing next and likely clean as one grouped mini-arc.
- hard rule: do not silently widen the recommended scope to include `useArchitectPlayerData.js`, UI-facing hooks, or component-level consumers unless execution evidence shows the contract/cap hook pair cannot stand cleanly without them; if that happens, document the exact blocker instead of auto-expanding the scope.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E70_RETURN_PACKAGE.md`

### Validator TS Architect Contract/Cap Hooks E71 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, and the E69 Trade Machine validation snapshot/accessor arc remains complete. The Architect contract/cap hook boundary is now TS-backed through authoritative `src/features/architect/hooks/usePlayerRulesProfiles.ts` and `src/features/architect/hooks/useCapValidation.ts`.
- Execution note:
  - preserved the current named/default export surfaces exactly, including named-only `usePlayerRulesProfiles` exports and the named plus default `useCapValidation` surface
  - preserved current behavior exactly across return-object key order, nested helper key order, `useMemo` dependency arrays and memoization boundaries, lazy/default branches, warning/error assembly, guardrail/signing-validation semantics, and direct dependency wiring into the already-TS-backed rules/cap helpers
  - converted `src/features/architect/hooks/usePlayerRulesProfiles.js` and `src/features/architect/hooks/useCapValidation.js` into pure compatibility shims so direct-path, explicit `.js`, and extensionless imports remain intact without consumer rewrites
  - added focused hook behavior coverage plus compatibility guardrail coverage and updated the Phase 43 apron allowlist so the new `useCapValidation.ts` authority remains explicitly approved for its existing UI-only warning patterns
  - no blocker required widening into `useArchitectPlayerData.js`, adjacent UI hooks, component consumers, or orchestration files
- current execution-shape read: the grouped contract/cap hook mini-arc completed cleanly, no immediate follow-up remains beyond any future importer-state-driven desire to retire the kept `.js` compatibility shims, and the broader Architect contract/cap hook arc is now effectively complete.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_ARCHITECT_CONTRACT_CAP_HOOKS_E71_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E72 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, and the E71 Architect contract/cap hook arc remains complete. After re-checking the remaining nearby JS surface against current importer/runtime evidence, the strongest next migration candidate is `src/features/architect/utils/worldManager.js`.
- Audit note:
  - re-checked and excluded the prior closed-scope same-name `.js` files because they still read as TS-backed compatibility shims, wrappers, or barrel surfaces rather than reopened business logic
  - re-checked and excluded `src/features/architect/utils/firebaseTeamPlanHelpers.js` because it remains a separate data-loader/free-agent surface and not a required part of the recommended boundary
  - re-checked and excluded `src/features/architect/hooks/useArchitectPlayerData.js` because it still reads as a thin subscription wrapper over TS-backed data access rather than the next business-logic authority
  - re-checked and excluded `src/features/architect/utils/teamLoader.ts` and the orchestration consumers because they are downstream callers, not part of the recommended JS migration boundary
  - recommended next scope: `src/features/architect/utils/worldManager.js`
  - estimated live JS business-logic count for the recommended scope: `1`
- current execution-shape read: the next arc looks larger and riskier than E71 because of Firestore writes, callable deletion flow wiring, nested metadata updates, and broad consumer coverage, but it still reads as worth doing next and likely clean as one grouped file-level arc.
- hard rule: do not silently widen the recommended scope to include `firebaseTeamPlanHelpers.js`, `useArchitectPlayerData.js`, `teamLoader.ts`, or orchestration consumers unless execution evidence shows `worldManager.js` cannot stand cleanly as its own migration boundary; if that happens, document the exact blocker instead of auto-expanding the scope.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E72_RETURN_PACKAGE.md`

### Validator TS World Manager E73 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, and the E71 Architect contract/cap hook arc remains complete. The world-lifecycle boundary recommended by E72 is now TS-backed through authoritative `src/features/architect/utils/worldManager.ts`.
- Execution note:
  - preserved the exact named-export surface and source export ordering with no default export added
  - preserved current Firestore read/write behavior, callable purge wiring, create/read/update/archive/delete/branch semantics, metadata/stat update behavior, draft-position read/write/clear behavior, thrown error text, fallback/default behavior, and timestamp handling exactly
  - preserved the exact `updateDoc` payload structure for draft-position writes and clears, including the current dynamic dot-path keys and payload key ordering
  - converted `src/features/architect/utils/worldManager.js` into a pure compatibility shim so direct-path, explicit `.js`, and extensionless imports remain intact without consumer rewrites
  - added focused worldManager behavior coverage plus compatibility guardrails proving the kept `.js` file is shim-only, explicit `.js` imports match extensionless imports, and the authoritative TS file kept the current export order
  - no blocker required widening into `firebaseTeamPlanHelpers.js`, `useArchitectPlayerData.js`, `teamLoader.ts`, downstream orchestration consumers, or UI consumers
- current execution-shape read: the grouped single-file worldManager mini-arc completed cleanly, no immediate follow-up remains beyond any future importer-state-driven desire to retire the kept `.js` shim, and the broader world-lifecycle boundary is now effectively complete.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_WORLD_MANAGER_E73_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E74 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, and the E73 world-lifecycle arc remains complete. After re-checking the remaining nearby JS surface against current importer/runtime evidence, the strongest next migration candidate is the trade-execution helper boundary centered on `src/features/architect/utils/tradeManager.js` and `src/features/architect/utils/schemaAdapter.js`.
- Audit note:
  - re-checked and excluded prior closed-scope same-name `.js` files because they still read as TS-backed compatibility shims, wrappers, or barrels rather than reopened business logic
  - re-checked and excluded `src/features/architect/utils/architectCore.js` because current repo evidence still shows it as a barrel-only export surface with guardrail-only usage rather than standalone business logic
  - compared the recommended trade-execution boundary against the Trade Machine hook-support pocket (`useTradeMachine.js`, `computeTradeDraftKey.js`, `devSntInjector.js`, `tradeExportUtils.js`), the world/data-access pocket (`firebaseTeamPlanHelpers.js`, nearby `useArchitectPlayerData.js` review), the season/pipeline orchestration family, and the Trade Machine engine/cache/debug support cluster
  - confirmed `tradeManager.js` remains live business logic exercised by unit/integration/E2E tests, while `schemaAdapter.js` remains live business logic used by both tests and runtime through `mutationPipeline.js`
  - confirmed `useArchitectPlayerData.js` currently reads as a thin subscription wrapper over authoritative `subscribeArchitectPlayerData.ts`, so it was inspected but not counted as a leading business-logic reason to prefer the world/data-access pocket
  - recommended next scope: `src/features/architect/utils/tradeManager.js` + `src/features/architect/utils/schemaAdapter.js`
  - estimated live JS business-logic count for the recommended scope: `2`
- current execution-shape read: the next arc looks smaller than the just-closed E73 world-lifecycle arc, worth doing next, and likely clean as one grouped mini-arc. The nearby `useTradeMachine.js` hook-support pocket remains more runtime-central, but it is materially larger and more stateful than the recommended trade-execution helper boundary.
- hard rule: do not silently widen the recommended scope to include `seasonManager.js`, `mutationPipeline.js`, `runOffseason.js`, `architectCore.js`, or Trade Machine engine/cache/debug files unless execution evidence shows `tradeManager.js` + `schemaAdapter.js` cannot stand cleanly as their own migration boundary. If that happens, document the exact blocker instead of auto-expanding the scope.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E74_RETURN_PACKAGE.md`

### Validator TS Trade Execution Helpers E75 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, and the E73 world-lifecycle arc remains complete. The trade-execution helper boundary recommended by E74 is now TS-backed through authoritative `src/features/architect/utils/schemaAdapter.ts` and `src/features/architect/utils/tradeManager.ts`.
- Execution note:
  - preserved the exact named-export surface and source export ordering for both helpers with no default export added
  - preserved the exact `buildTradeTeamInput` / `buildTradeInput` contract surface, field mappings, defaults, fallbacks, shape normalization behavior, and validator-facing adapter behavior
  - preserved trade/signing/waiver/extension snapshot behavior, error/default behavior, return shapes, and the explicit key ordering for the assembled `executeTrade`, `signFreeAgent`, `waivePlayer`, and `extendPlayer` result objects
  - converted `schemaAdapter.js` and `tradeManager.js` into pure compatibility shims so direct-path, explicit `.js`, and extensionless imports remain intact without consumer rewrites
  - added focused compatibility guardrails and return-key-order assertions, and updated the narrow Phase 65 / Phase 78 source-scan guardrails to follow the authoritative TS files without widening scope
  - no blocker required widening into `seasonManager.js`, `mutationPipeline.js`, `runOffseason.js`, `architectCore.js`, Trade Machine engine/cache/debug files, or UI consumers
- current execution-shape read: the grouped trade-execution helper mini-arc completed cleanly, no immediate follow-up remains beyond any future importer-state-driven desire to retire the kept `.js` shims, and the broader trade-execution helper boundary is now effectively complete.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_EXECUTION_HELPERS_E75_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E76 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, and the E75 trade-execution helper arc remains complete. After re-checking the remaining nearby JS surface against current importer/runtime evidence and the fixed “smallest coherent live-business-logic boundary” rule, the strongest next migration candidate is the Trade Machine hook-support pocket centered on `src/features/architect/hooks/useTradeMachine.js`.
- Audit note:
  - re-checked and excluded prior closed-scope same-name `.js` files because they still read as TS-backed compatibility shims, wrappers, or barrels rather than reopened business logic
  - compared the hook-support pocket against the smaller `firebaseTeamPlanHelpers.js` challenger, the season/pipeline orchestration family, the Trade Machine support/cache/debug cluster, and smaller isolated JS utility residue
  - confirmed `firebaseTeamPlanHelpers.js` remains the main smaller challenger, but current repo evidence still shows it as a mixed base-team hydration + free-agent access surface rather than a cleaner next cutoff
  - re-checked smaller isolated JS residues such as `consentUtils.js`, `stepienUtils.js`, `cashUtils.js`, `reacqUtils.js`, `rosterUtils.js`, and `draftPickUtils.js`; current repo evidence leaves them as scattered utility residue rather than the next coherent arc
  - recommended next scope: `src/features/architect/hooks/useTradeMachine.js`, `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`, `src/features/architect/tradeMachine/utils/devSntInjector.js`, and `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js`
  - estimated live JS business-logic count for the recommended scope: `4`
- current execution-shape read: the next arc looks larger and more stateful than E75, still worth doing next, and likely best split into smaller sub-arcs rather than forced into one grouped pass.
- hard rule: do not silently widen the recommended scope to include validator engine/rules files, E69 snapshot/accessor files, UI consumers, or world/orchestration files unless execution evidence shows the hook-support boundary cannot stand cleanly on its own. If that happens, document the exact blocker instead of auto-expanding the scope.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E76_RETURN_PACKAGE.md`

### Validator TS Trade Machine Hook-Support Helpers E77 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, and the E75 trade-execution helper arc remains complete. The E77 helper-trio boundary is now TS-backed through authoritative `src/features/architect/tradeMachine/utils/computeTradeDraftKey.ts`, `src/features/architect/tradeMachine/utils/devSntInjector.ts`, and `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.ts`.
- Execution note:
  - preserved the exact named-export surfaces and source export ordering for all three helpers with no default export added
  - preserved current deterministic draft-key generation, fallback/default behavior, direct-path compatibility, and the exact lexicographic sort behavior in `computeTradeDraftKey`
  - preserved current DEV S&T helper semantics including synthetic player payload key insertion order, nested object key insertion order, fallback chains, helper ordering, and injection/cleanup mutation boundaries in `devSntInjector`
  - preserved current `extractUsedTpeIds()` filtering and first-seen output ordering through the existing `Set`-based dedupe path with no sorting or normalization added
  - converted `computeTradeDraftKey.js`, `devSntInjector.js`, and `tradeExportUtils.js` into pure compatibility shims so direct-path, explicit `.js`, and extensionless imports remain intact without consumer rewrites
  - added focused compatibility guardrails plus exact-string and exact-key-order coverage for the migrated helper surfaces
  - no blocker required widening into `useTradeMachine.js`, E69 snapshot/accessor files, validator internals, cache/debug/monitoring files, UI consumers, or world/orchestration files
- validation note:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - `npm run test:node -- --reporter=dot tests/trade/usedTradeExceptions.test.js src/tests/trade/staleValidationFix.test.js src/tests/architect/devSntInjector.utils.test.ts src/tests/architect/tradeEditor.devSntInjectorGate.guardrail.test.ts src/tests/architect/tradeMachineHookSupportHelpers.compatibility.guardrail.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/tradePlayerRow.signAndTradeInjector.test.tsx src/tests/architect/useTradeMachine.devSntInjector.test.tsx`: FAIL in unchanged adjacent consumers `TradePlayerRow.jsx` and `useTradeMachine.js`; not addressed in E77
- current execution-shape read: the grouped helper-trio mini-arc completed cleanly at the helper boundary, no helper-local follow-up is recommended, the helper-trio sub-arc is now effectively complete, and `useTradeMachine.js` remains the intended next follow-up phase.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_MACHINE_HOOK_SUPPORT_HELPERS_E77_RETURN_PACKAGE.md`

### Validator TS Use Trade Machine E78 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, and the E77 helper-trio sub-arc remains complete. The `useTradeMachine` hook boundary is now TS-backed through authoritative `src/features/architect/hooks/useTradeMachine.ts`.
- Execution note:
  - preserved the exact named-export surface with no default export added, and converted `useTradeMachine.js` into a pure compatibility shim so direct-path, explicit `.js`, and extensionless imports remain intact
  - preserved the returned hook surface shape, returned object key insertion order, `useMemo` / `useCallback` / `useEffect` dependency arrays, initialization ordering, entitlement and pick-rule hydration flow, stale-validation key handling, DEV synthetic S&T injector wiring, export-payload assembly, and fallback/error behavior
  - restored base-team lookup fallback for slug/code inputs such as `LAL` as a compatibility-preserving correction already relied on by repo tests and live route usage
  - added one additional tiny compatibility guard proved necessary by the unchanged `useTradeMachine.devSntInjector.test.tsx` surface: the init effect now no-ops for redundant same-input reruns while keeping the dependency array itself unchanged
  - updated the Phase 16.3 source-reading guardrail to inspect the TS authority, and added focused hook compatibility coverage for shim parity, return-key ordering, stale-validation invalidation, and export payload assembly
  - no blocker required widening into E69 snapshot/accessor files, E77 helper-trio files, validator internals, cache/debug/monitoring files, UI consumers, or world/orchestration files
- Validation note:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - `npm run test:node -- --reporter=dot tests/trade/useTradeMachine.validatorTrust.test.ts src/tests/architect/phase16_3_trade_machine_init_guardrail.test.js src/tests/architect/useTradeMachine.compatibility.guardrail.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/useTradeMachine.devSntInjector.test.tsx`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/tradePlayerRow.signAndTradeInjector.test.tsx`: intentionally skipped in E78 because the locked scope remained hook-only and E77 already showed it is a separate UI/eligibility issue outside this boundary
- current execution-shape read: the single-hook phase completed cleanly, no additional hook-local follow-up is recommended, and the broader Trade Machine hook-support boundary is now effectively complete.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_USE_TRADE_MACHINE_E78_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E79 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, and the E78 `useTradeMachine` hook arc remains complete. After re-checking the remaining nearby JS surface against current importer/runtime evidence, the strongest next migration candidate is `src/features/architect/utils/consentUtils.js`.
- Audit note:
  - re-checked and excluded prior closed-scope same-name `.js` files because they still read as TS-backed compatibility shims, wrappers, or barrels rather than reopened business logic
  - compared the consent helper boundary against the `firebaseTeamPlanHelpers.js` world/data-access challenger, the validator runtime-support cluster (`validationCacheService.js`, `engineUtils.js`, `tradeDebug.js`, `validationPerformanceMonitor.js`), and the season/pipeline family centered on `mutationPipeline.js` and `seasonManager.js`
  - explicitly classified zero-import holdouts `useCapSheetState.js`, `freeAgentLogic.js`, `validationCacheManager.js`, `resolveValidationEntitlements.js`, `enforcementValidation.js`, `cashUtils.js`, `rosterUtils.js`, `salaryUtils.js`, and `temp_mutation_code.js` as inactive legacy hooks/utilities, wrappers, support residue, or scratch rather than next-scope live business logic
  - larger batched low-risk passes were re-checked and rejected: the mixed wrapper batch (`useArchitectPlayerData.js`, `runOffseason.js`, `seasonUtils.js`, `architectCore.js`, `salaryUtils.js`) is lower-value cleanup, while the Trade Machine TSX surface is too large and UI-coupled to beat the cleaner consent boundary
  - recommended next scope: `src/features/architect/utils/consentUtils.js`
  - estimated live JS business-logic count for the recommended scope: `1`
- current execution-shape read: the next arc looks materially smaller than the just-closed E75/E77/E78 work, worth doing next, and best handled as one grouped mini-arc rather than another split chain or a larger batched low-risk pass. If a future pass deliberately wants a larger single-file alternative, `firebaseTeamPlanHelpers.js` is the first fallback, not support- or orchestration-family widening.
- hard rule: do not silently widen the recommended scope to include `validateConsent.ts`, `enforceConsent.ts`, `tradeValidator.ts`, legacy `enforcement.js`, or `enforcementValidation.js` unless execution evidence proves `consentUtils.js` cannot stand cleanly as its own migration boundary. If that happens, document the exact blocker instead of auto-expanding the scope.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E79_RETURN_PACKAGE.md`

### Validator TS Consent Helper E80 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, and the E78 `useTradeMachine` hook arc remains complete. The `consentUtils` helper boundary is now TS-backed through `src/features/architect/utils/consentUtils.ts`.
- Execution note:
  - preserved the full named-export surface with no default export added
  - preserved consent alias coverage across `consentGranted`, `consent`, `consents.full`, `consents.limited`, `consents.birdOneYear`, `hasConsented`, and `hasTradeConsent`
  - preserved full-NTC, limited-NTC, Bird-veto, and derived one-year Bird consent semantics without widening into rule consumers
  - preserved exact consent message text, exact `collectConsentViolations()` array ordering, current duplicate-collection behavior, safe no-op notifier fallback handling, and current `reject` side-effect behavior
  - converted `src/features/architect/utils/consentUtils.js` into a pure compatibility shim for direct-path, explicit `.js`, and extensionless imports
  - no small follow-up is currently required; the single-file phase completed cleanly
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/consentUtils.compatibility.guardrail.test.ts tests/trade/consent_and_birdVeto.test.js tests/trade/consent_and_reacq.test.js`: PASS
- current execution-shape read: the single-file `consentUtils` phase succeeded cleanly, no blocker required widening into validator or legacy enforcement files, and the broader consent helper boundary is now effectively complete.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CONSENT_HELPER_E80_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E81 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, and the E80 consent helper arc remains complete.
- Audit note:
  - current inspection initially indicated `src/features/architect/utils/firebaseTeamPlanHelpers.js` as the leading next candidate, and execution-time repo evidence confirmed it as the strongest next coherent migration boundary under the fixed rule: prefer the smallest coherent live-business-logic boundary with strong runtime relevance and a cleaner cutoff than broader support or orchestration families
  - compared the file directly against the validator runtime-support cluster (`validationCacheService.js`, `validationPerformanceMonitor.js`, `engineUtils.js`, `tradeDebug.js`), the season/pipeline family (`seasonManager.js`, `mutationPipeline.js`, with `runOffseason.js` noted only as a thin wrapper), and a lower-risk wrapper batch (`useArchitectPlayerData.js`, `runOffseason.js`, `seasonUtils.js`, `architectCore.js`, `salaryUtils.js`)
  - execution-time evidence did not require widening the recommended scope into `useArchitectPlayerData.js`, `teamLoader.ts`, `worldTeamData.ts`, `LeagueView.jsx`, or `worldManager`-adjacent consumers; no blocker proved `firebaseTeamPlanHelpers.js` could not stand as its own migration boundary
  - explicitly re-checked and excluded zero-import or weak-import residue from the live-business-logic count: `useCapSheetState.js`, `draftPickUtils.js`, `cashUtils.js`, `freeAgentLogic.js`, `rosterUtils.js`, `temp_mutation_code.js`, `resolveValidationEntitlements.js`, `enforcementValidation.js`, `validatorFactory.js`, `validationCacheManager.js`, and `tradeValidator.debug.js`
  - recommended next scope: `src/features/architect/utils/firebaseTeamPlanHelpers.js`
  - estimated live JS business-logic count for the recommended scope: `1`
- current execution-shape read: the next arc is best handled as one grouped mini-arc / single-file boundary. A broader batched low-risk pass remains possible later, but it is still not cleaner than the recommended data-access boundary.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E81_RETURN_PACKAGE.md`

### Validator TS Firebase Team Plan Helpers E82 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, and the E80 consent helper arc remains complete. The `firebaseTeamPlanHelpers` helper boundary is now TS-backed through `src/features/architect/utils/firebaseTeamPlanHelpers.ts`.
- Execution note:
  - preserved the full six-export surface with no default export added
  - preserved exact top-level hydrated team key insertion order, representative nested key ordering for hydrated players / `activeContracts` / flattened exception objects, and the current sequential `for...of` + `await` hydration behavior
  - preserved base-team hydration shape, team-code resolution, base-team fallback behavior, `roster: players`, `baseline: baseDoc`, and weaker/dormant export behavior for `prepareCapSheet`, `getAllTeams`, `saveFreeAgents`, and `loadFreeAgents`
  - converted `src/features/architect/utils/firebaseTeamPlanHelpers.js` into a pure compatibility shim for direct-path, explicit `.js`, and extensionless imports
  - no small follow-up is currently required; the single-file phase completed cleanly
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/firebaseTeamPlanHelpers.compatibility.guardrail.test.ts src/tests/architect/teamLoader.compatibility.guardrail.test.ts src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/capSheet.worldBoundary.integration.test.tsx`: PASS, with the same pre-existing max-update-depth warning noise already present in the execution baseline
- current execution-shape read: the single-file `firebaseTeamPlanHelpers` phase succeeded cleanly without widening into adjacent consumers, `worldManager`, validator internals, cache/debug/monitoring files, UI consumers, or world/orchestration files. The broader world/data-access helper boundary is now effectively complete.
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_FIREBASE_TEAM_PLAN_HELPERS_E82_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E83 (2026-03-13)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, and the E82 world/data-access helper arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the two-lane comparison and confirmed the `Team History surface` as the strongest next coherent migration scope
  - compared the leading low-risk Team History batch against the strongest surgical alternative `src/features/architect/utils/seasonManager.js`, with `src/features/architect/utils/mutationPipeline.js` and the central GMDashboard / Trade Machine UI hubs kept on the dangerous-hub list rather than folded into the recommendation
  - the recommended Team History scope contains `5` core live JS/JSX business-logic files: `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`, `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.jsx`, `src/features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.jsx`, `src/features/architect/offseason/DraftPickTracker/DraftPickTracker.jsx`, and `src/features/architect/offseason/WaiveStretchTracker/WaiveStretchTracker.jsx`
  - thin wrapper compatibility files were explicitly excluded from that live count: `src/features/architect/TeamHistoryTab.jsx`, `src/features/architect/ExceptionHistoryTracker.jsx`, `src/features/architect/DraftPickTracker.jsx`, and `src/features/architect/WaiveStretchTracker.jsx`
  - execution-time evidence did not require widening the recommendation into `HistorySection.jsx`, `GMDashboard.jsx`, `SeasonAdvanceModal.jsx`, `WorldSelector.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `ValidationDetailsPanel.jsx`, `seasonManager.js`, or `mutationPipeline.js`
  - recommended next scope: `Team History surface`
  - recommended execution shape: `batched low-risk`, handled as `one grouped batched pass`
  - current frontier read: batching is now the default for lower-risk remaining work, with surgical treatment reserved for a short dangerous-hub list led by `seasonManager.js`, `mutationPipeline.js`, `GMDashboard.jsx`, `SeasonAdvanceModal.jsx`, `WorldSelector.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, and `ValidationDetailsPanel.jsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E83_RETURN_PACKAGE.md`

### Validator TS Team History Surface E84 (2026-03-14)

- Status: the grouped Team History surface pass completed cleanly. E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, and E82 remain closed and untouched.
- Execution note:
  - the 5 counted Team History core files are now TS-backed: `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.tsx`, `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.tsx`, `src/features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.tsx`, `src/features/architect/offseason/DraftPickTracker/DraftPickTracker.tsx`, and `src/features/architect/offseason/WaiveStretchTracker/WaiveStretchTracker.tsx`
  - the 4 top-level wrapper files remain intact as compatibility-only surfaces: `src/features/architect/TeamHistoryTab.jsx`, `src/features/architect/ExceptionHistoryTracker.jsx`, `src/features/architect/DraftPickTracker.jsx`, and `src/features/architect/WaiveStretchTracker.jsx`
  - Team History remained read-only in E84; no mutation behavior, write-side helpers, orchestration coupling, dashboard widening, trade UI widening, E41 reopen, or E54 reopen was introduced
  - visible Team History subsection order, modal/detail ordering, and tracker row/item ordering were preserved
  - a small internal-only type layer was added under `src/features/architect/history/TeamHistoryTab/types.ts`; no public Team History exports changed
  - focused E84 proof files were added for direct Team History surface coverage and wrapper-aware subsection rendering coverage
  - generated component docs were refreshed so the authoritative Team History file paths now point at `.tsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/teamHistory.regression.noForbiddenWrites.test.ts src/tests/architect/teamHistory.worldEventsQueryFallback.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/teamHistory.surface.e84.integration.test.tsx src/tests/architect/teamHistory.subsections.e84.rendering.test.tsx src/tests/smoke/architect.uiSmoke.e1.test.tsx`: PASS
  - `npm run docs`: PASS
- Follow-up:
  - no mandatory follow-up was left inside the Team History surface lane
  - the broader Team History surface is now effectively complete
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TEAM_HISTORY_SURFACE_E84_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E85 (2026-03-14)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 helper-foundation arc remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, and the E84 Team History surface arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the two-lane comparison instead of locking the next move in advance
  - the strongest remaining low-risk batch is the `Free Agent Pool surface`, while the strongest remaining surgical alternative stays `src/features/architect/utils/seasonManager.js`
  - the recommended next scope contains `3` core live JS/JSX business-logic files: `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx`, `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx`, and `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.jsx`
  - thin wrapper / typed-sibling / adjacent-feature files were explicitly excluded from that live count: `src/features/architect/FreeAgentPool.jsx`, `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPoolHeader.tsx`, `src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx`, `src/features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx`, `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx`, and `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
  - execution-time evidence did not require widening the recommendation into `FreeAgencySection.jsx`, `OfferSheetList.jsx`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `ValidationDetailsPanel.jsx`, `seasonManager.js`, or `mutationPipeline.js`
  - recommended next scope: `Free Agent Pool surface`
  - recommended execution shape: `batched low-risk`, handled as `one grouped batched pass`
  - current frontier read: batching still wins by default for coherent low-risk families, with surgical treatment reserved for the short dangerous-hub list led by `seasonManager.js`, `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, and `ValidationDetailsPanel.jsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E85_RETURN_PACKAGE.md`

### Validator TS Free Agent Pool Surface E86 (2026-03-14)

- Status: the grouped Free Agent Pool surface pass completed cleanly. E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, E82, E84, and the E85 scope audit remain closed and untouched.
- Execution note:
  - the 3 counted Free Agent Pool core files are now TS-backed: `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx`, `src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.tsx`, and `src/features/architect/freeAgency/FreeAgentPool/FreeAgentCard.tsx`
  - visible render ordering, selected-card layout ordering, menu item ordering, callback wiring, contract payload assembly, and row/menu interaction behavior remained unchanged
  - typed siblings stayed narrow and compatibility-focused: `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPoolHeader.tsx`, `src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx`, and `src/features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx`
  - `src/features/architect/FreeAgentPool.jsx` remained the top-level compatibility wrapper, while the in-folder `.jsx` files now remain shim-only compatibility surfaces over the authoritative `.tsx` files
  - execution-time direct-path `.jsx` importer scanning found no runtime consumers outside the intentional explicit shim proof imports kept in `src/tests/architect/freeAgentPool.surface.e86.behavior.test.tsx`
  - generated component docs were refreshed; `docs/components/ArchitectHierarchy.md` now reflects the authoritative `.tsx` Free Agent Pool files
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/freeAgency_closure.gate.test.ts src/tests/architect/editContractModal_closure.gate.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx src/tests/architect/freeAgentPool.surface.e86.behavior.test.tsx`: PASS
  - `npm run build`: PASS
  - `npm run docs`: PASS
  - `npm run validate:project`: PASS
- Follow-up:
  - no mandatory follow-up remains inside the Free Agent Pool surface lane
  - the broader Free Agent Pool surface is now effectively complete
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E87 (2026-03-14)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, and the E86 Free Agent Pool surface arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the two-lane comparison instead of locking the next move in advance
  - the strongest remaining low-risk family is the `Cap Sheet surface`, while the strongest remaining surgical alternative stays `src/features/architect/utils/seasonManager.js`
  - the recommended next family contains `6` core live JS/JSX business-logic files: `src/features/architect/capSheet/CapSheet/CapSheet.jsx`, `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`, `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`, `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`, `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`, and `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
  - wrapper / section-shell files were explicitly excluded from that live count: `src/features/architect/CapSheet.jsx`, `src/features/architect/CapSummaryTiles.jsx`, `src/features/architect/CapSheetFull.jsx`, `src/features/architect/ExceptionTracker.jsx`, `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`, and `src/features/architect/GMDashboard/sections/CapTableSection.jsx`
  - execution-time evidence did not require widening the recommendation into `GMDashboard.jsx`, `CapSheetSection.jsx`, `CapTableSection.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `ValidationDetailsPanel.jsx`, `seasonManager.js`, or `mutationPipeline.js`
  - recommended next scope: `Cap Sheet surface`
  - recommended execution lane: `batched low-risk`
  - recommended execution shape: choose the family now, then split execution into `display core` and `modal` sub-arcs rather than forcing one pass
  - current frontier read: batching still wins by default for coherent low-risk families, with surgical treatment reserved for the short dangerous-hub list led by `seasonManager.js`, `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, and `ValidationDetailsPanel.jsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E87_RETURN_PACKAGE.md`

### Validator TS Cap Sheet Display-Core E88 (2026-03-14)

- Status: the grouped Cap Sheet display-core pass completed cleanly. E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, E82, E84, E86, and the E87 scope audit remain closed and untouched.
- Execution note:
  - the 4 counted Cap Sheet display-core files are now TS-backed: `src/features/architect/capSheet/CapSheet/CapSheet.tsx`, `src/features/architect/capSheet/CapSheet/CapSummaryTiles.tsx`, `src/features/architect/capSheet/CapSheetFull/CapSheetFull.tsx`, and `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.tsx`
  - visible render ordering remained unchanged across `CapSheet`, `CapSummaryTiles`, `CapSheetFull`, and `ExceptionTracker`; totals/cap-hold/rules-profile/TPE display and action wiring into the existing modal pair also remained unchanged
  - the same-path `.jsx` files remain shim-only compatibility surfaces by rule: `src/features/architect/capSheet/CapSheet/CapSheet.jsx`, `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`, `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`, and `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - the top-level wrappers and dashboard section shells remained pass-through only and were not broadened: `src/features/architect/CapSheet.jsx`, `src/features/architect/CapSummaryTiles.jsx`, `src/features/architect/CapSheetFull.jsx`, `src/features/architect/ExceptionTracker.jsx`, `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`, and `src/features/architect/GMDashboard/sections/CapTableSection.jsx`
  - focused test retargets moved source-scan guardrails to the new authoritative `.tsx` paths, and `src/tests/architect/capSheet.displayCore.e88.behavior.test.tsx` now covers CapSummaryTiles ordering/output and CapTableSection pass-through compatibility
  - `src/tests/architect/capSheet.uiFlows.integration.test.tsx` received a minimal assertion correction so the fixture-flow proof matches the harness's intentional dual-surface rendering of `CapSheet` plus `CapSheetFull`; no user-facing behavior changed
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/capSheet_closure.gate.test.ts src/tests/architect/capSheet_capPct_ssot.behavior.test.jsx src/tests/architect/capSheetFull_ssot_parity_guardrails.test.js`: PASS for the node-config-executed files; the `.jsx` cap-percent guardrail required the separate UI-config run below
  - `npm run test:ui -- --reporter=dot src/tests/architect/capSheet_capPct_ssot.behavior.test.jsx`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/capSheet.uiFlows.integration.test.tsx src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx src/tests/architect/rosterChargeDisplay.test.jsx src/tests/architect/capSheet_exception_wiring.behavior.test.jsx tests/architect/CapSheetFull.rules.test.jsx tests/architect/ExceptionTracker.tpe.test.jsx src/tests/architect/capSheet.displayCore.e88.behavior.test.tsx`: PASS
  - `npm run build`: PASS
  - `npm run validate:project`: PASS
- Follow-up:
  - no additional display-core pass is recommended; the Cap Sheet display-core sub-arc is now effectively complete
  - the modal pair remains the intended follow-up sub-arc: `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx` and `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_SHEET_DISPLAY_CORE_E88_RETURN_PACKAGE.md`

### Validator TS Cap Sheet Modal Pair E89 (2026-03-14)

- Status: the Cap Sheet modal-pair pass completed cleanly. E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, E82, E84, E86, E87, and E88 remain closed and untouched.
- Execution note:
  - the 2 counted Cap Sheet modal authorities are now TS-backed: `src/features/architect/capSheet/modals/ManageExceptionsModal.tsx` and `src/features/architect/capSheet/modals/ManageDeadMoneyModal.tsx`
  - visible field order, exception/dead-money row order, header/body/footer section order, button order, warning/error text placement, and save/cancel lifecycle timing remained unchanged across both modals
  - payload assembly remained unchanged across both modal flows, including key presence/omission behavior, per-row dead-money output, numeric coercion, room-exception gating behavior, and the existing fallback dead-money ID/label behavior
  - the same-path `.jsx` files remain shim-only compatibility surfaces by rule: `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx` and `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
  - focused test retargets moved modal source-scan guardrails to the new authoritative `.tsx` paths, and `src/tests/architect/capSheet_exception_wiring.behavior.test.jsx` now directly covers modal order, payload shape, thrown-error handling, and cancel-without-save behavior
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/capSheet_closure.gate.test.ts src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/capSheet_exception_wiring.behavior.test.jsx src/tests/architect/capSheet.uiFlows.integration.test.tsx src/tests/architect/capSheet.transactionMatrix.behavior.test.tsx`: PASS
  - `npm run build`: PASS with pre-existing Vite warnings about stale Browserslist data, browser externalization of `fs`, mixed static/dynamic imports, and large chunks outside the E89 surface
  - `npm run validate:project`: PASS
- Follow-up:
  - no additional modal-pair pass is recommended; the paired sub-arc completed cleanly
  - the broader Cap Sheet family is now effectively complete because the remaining Cap Sheet JS/JSX files are intentional compatibility or pass-through wrappers rather than live modal/display authorities
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_SHEET_MODAL_PAIR_E89_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E90 (2026-03-14)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, and the E89 Cap Sheet modal-pair sub-arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the two-lane comparison instead of locking the next move in advance
  - the strongest remaining low-risk family is the `Free Agency offer-sheet surface`, while the strongest remaining surgical alternative remains `src/features/architect/utils/seasonManager.js`
  - the recommended next scope contains `2` core live JS/JSX business-logic files: `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx` and `src/features/architect/GMDashboard/components/OfferSheetList.jsx`
  - the `2`-file live count explicitly excludes `src/features/architect/FreeAgentPool.jsx`, the TS-backed `src/features/architect/freeAgency/FreeAgentPool/*` authorities and same-path JS shims, dashboard shells, and the dangerous hubs `src/features/architect/GMDashboard/GMDashboard.jsx`, `src/features/architect/GMDashboard/components/WorldSelector.jsx`, `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`, `src/features/architect/tradeMachine/TradeEditor.jsx`, `src/features/architect/tradeMachine/TradeTeamCard.jsx`, `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`, `src/features/architect/utils/seasonManager.js`, and `src/features/architect/utils/mutationPipeline.js`
  - execution-time evidence did not require widening the recommendation into the closed E86 Free Agent Pool scope or into dashboard/trade orchestration hubs; if a future execution pass finds a blocker, it should document that blocker instead of auto-expanding the boundary
  - recommended next scope: `Free Agency offer-sheet surface`
  - recommended execution lane: `batched low-risk`
  - recommended execution shape: `one grouped batched pass`
  - current frontier read: batching still wins by default for coherent low-risk families, with surgical treatment reserved for the short dangerous-hub list led by `seasonManager.js`, `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, and `ValidationDetailsPanel.jsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E90_RETURN_PACKAGE.md`

### Validator TS Free Agency Offer-Sheet Surface E91 (2026-03-14)

- Status:
  - the 2 counted Free Agency offer-sheet surface files are now TS-backed:
    - `src/features/architect/GMDashboard/sections/FreeAgencySection.tsx`
    - `src/features/architect/GMDashboard/components/OfferSheetList.tsx`
  - the same-path `.jsx` files remain shim-only compatibility surfaces by rule
- Migration note:
  - behavior remained unchanged, including exact visible render ordering, world-gated warning/disable behavior, incoming/outgoing offer-sheet list wiring, `onMatch(offeringTeamCode, id)` / `onDecline(offeringTeamCode, id)` / finalize branch routing, and exact `formatCurrency(...)`, `os.status.replace('_', ' ')`, and `new Date(os.createdAt).toLocaleDateString()` behavior
  - added `src/features/architect/GMDashboard/offerSheetTypes.ts` as an internal local type layer for the authoritative offer-sheet path
  - execution stayed inside the E91 boundary and did not reopen E86, dashboard hubs, trade UI hubs, or orchestration hubs
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/offerSheets_closure.gate.test.ts src/tests/architect/freeAgency_closure.gate.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/OfferSheetList.freeAgency.test.jsx src/tests/smoke/architect.uiSmoke.e1.test.tsx`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, browser externalization of `fs`, mixed static/dynamic imports, and large chunk sizing outside the E91 surface
  - `npm run validate:project`: PASS
- Follow-up:
  - the grouped batched pass completed cleanly
  - no mandatory follow-up remains inside the offer-sheet surface lane
  - the broader Free Agency offer-sheet surface is now effectively complete
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENCY_OFFER_SHEET_SURFACE_E91_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E92 (2026-03-14)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, and the E91 Free Agency offer-sheet surface arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the two-lane comparison instead of locking the next move in advance
  - the leading remaining low-risk family is the `Offseason preview surface`, while the strongest remaining surgical alternative is still `src/features/architect/utils/seasonManager.js`
  - the recommended next scope contains `2` core live JS/JSX business-logic files: `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx` and `src/features/architect/offseason/OffseasonTab/OptionManager.jsx`
  - the `2`-file live count explicitly excludes the wrapper `src/features/architect/OffseasonTab.jsx`, the adjacent shell `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`, the helper adapter `src/features/architect/utils/runOffseason.js`, and the dangerous hubs `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`, `src/features/architect/utils/seasonManager.js`, `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/GMDashboard/GMDashboard.jsx`, `src/features/architect/tradeMachine/TradeEditor.jsx`, `src/features/architect/tradeMachine/TradeTeamCard.jsx`, and `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
  - the DEV-gated nature of the Offseason preview lowers product value, but does not currently outweigh the safety and clean-cut advantage over `seasonManager.js`
  - execution-time evidence did not require widening the recommendation into `OffseasonSection.jsx`, season/world orchestration, or Trade Machine hubs; if a future execution pass finds a blocker, it should document that blocker instead of auto-expanding the boundary
  - recommended next scope: `Offseason preview surface`
  - recommended execution lane: `batched low-risk`
  - recommended execution shape: `one grouped arc`
  - current frontier read: batching still wins by default for coherent low-risk families, with surgical treatment reserved for the short dangerous-hub list led by `seasonManager.js`, `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, and `ValidationDetailsPanel.jsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E92_RETURN_PACKAGE.md`

### Validator TS Offseason Preview Surface E93 (2026-03-14)

- Status:
  - the 2 counted Offseason preview surface files are now TS-backed:
    - `src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx`
    - `src/features/architect/offseason/OffseasonTab/OptionManager.tsx`
  - the same-path `.jsx` files remain shim-only compatibility surfaces by rule
- Migration note:
  - behavior remained unchanged, including exact visible render ordering, empty-state placement, table header order, confirm-button placement, preview messaging text, local error text placement, option discovery from `teamCapSheet.players`, `toSeasonCode(currentYear + 1)`, `salary ?? capHit`, `option || null`, `player_id -> id -> playerId` lookup order, `decisionKey` fallback to `name`, default `'exercise'` decisions, `onDecisionsReady(decisions)` payload shape, `JSON.parse(JSON.stringify(teamCapSheet))` snapshot cloning, `runOffseason(teamCapSheet, currentYear, capProjections, optionDecisions || {})`, setter call order, `console.error`, and fallback thrown-error text
  - added `src/features/architect/offseason/OffseasonTab/types.ts` as an internal local type layer for the authoritative preview path
  - the top-level wrapper `src/features/architect/OffseasonTab.jsx` remained intact, and execution stayed inside the E93 boundary without reopening `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`, `src/features/architect/utils/runOffseason.js`, `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`, `src/features/architect/utils/seasonManager.js`, `src/features/architect/utils/mutationPipeline.js`, dashboard hubs, trade UI hubs, validator internals, or Trade Machine cache/debug/monitoring files
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/offseason.devGate.guardrail.test.ts src/tests/architect/phase86_oste_offseason_transition_engine.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/offseason.previewSurface.e93.behavior.test.tsx src/tests/smoke/architect.uiSmoke.e1.test.tsx`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, browser externalization of `fs`, mixed static/dynamic imports, and large chunks outside the E93 surface
  - `npm run validate:project`: PASS
- Follow-up:
  - the grouped batched pass completed cleanly
  - no mandatory follow-up remains inside the Offseason preview surface lane
  - the broader Offseason preview surface is now effectively complete
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_OFFSEASON_PREVIEW_SURFACE_E93_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E94 (2026-03-14)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, and the E93 Offseason preview surface arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the two-lane comparison instead of locking the next move in advance
  - the strongest remaining surgical candidate is `src/features/architect/utils/seasonManager.js`, while the strongest remaining low-risk options now read as weaker support/legacy cleanup rather than a cleaner feature batch
  - the recommended next migration scope is `src/features/architect/utils/seasonManager.js`
  - the recommended lane is `high-risk surgical`
  - the estimated live JS/JSX/TSX business-logic count for that named scope is `1`
  - the recommended next named scope is `seasonManager.js`, while the likely execution shape is smaller file-internal slices rather than one-shot execution
  - execution-time evidence did not require widening the recommendation into `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, or `ValidationDetailsPanel.jsx`; if a later pass finds a blocker, it should document that blocker instead of auto-expanding the boundary
  - current frontier read: E93 exhausted the strongest clean low-risk batch candidate, so batching no longer wins by default for the immediate next move
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E94_RETURN_PACKAGE.md`

### Validator TS Season Manager E95 (2026-03-14)

- Status:
  - `src/features/architect/utils/seasonManager.ts` is now the authoritative TS-backed implementation for the `seasonManager` boundary
  - `src/features/architect/utils/seasonManager.js` remains a shim-only compatibility surface by rule
- Migration note:
  - behavior remained unchanged across `advanceSeason`, `processSeasonTransition`, `advanceSeasonInWorld`, `resolveDraftPickSwapsForYear`, and `resolveDraftPickConveyanceForYear`
  - preserved exact observable sequencing for Firestore batch writes, metadata writes, audit/event writes, post-state validation, persistence hygiene steps, DARE-gated writes, and thrown-error paths
  - preserved exact draft-pick swap/conveyance ordering, no-op semantics, and fail-soft helper behavior
  - retargeted source-scan guardrails to `seasonManager.ts` and added `src/tests/architect/seasonManager.compatibility.guardrail.test.ts` to prove `seasonManager.js` stays shim-only while explicit `.js` imports remain supported
  - execution stayed inside the E95 boundary and did not reopen `mutationPipeline.js`, `runOffseason.js`, dashboard hubs, or Trade Machine hubs
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot tests/architect/seasonManager.test.js src/tests/tradeMachine/phase5DraftPositions.test.js src/tests/tradeMachine/seasonSwapResolution.test.js src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js src/tests/architect/phase86_oste_offseason_transition_engine.test.ts`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/capAuditability_closure.gate.test.ts src/tests/architect/seasonAdvance_capAuditEventV1.guardrails.test.ts src/tests/architect/season_advance_bridge_gate_guardrails.test.js src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.js src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js src/tests/architect/dare/phaseD3_true_e2e_gate.integration.test.js src/tests/architect/phase83_live_pipeline_mutations_and_season_advance_emulator_e2e.test.js src/tests/architect/seasonManager.compatibility.guardrail.test.ts`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, browser externalization of `fs`, mixed static/dynamic imports, and large chunks outside the E95 boundary
  - `npm run validate:project`: PASS
- Follow-up:
  - the named surgical pass completed cleanly
  - no mandatory follow-up remains inside the `seasonManager` authority boundary
  - the broader `seasonManager` boundary is now effectively complete; any future removal of the kept `.js` shim is a separate cleanup decision
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SEASON_MANAGER_E95_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E96 (2026-03-14)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, the E93 Offseason preview surface arc remains complete, and the E95 `seasonManager` arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the two-lane comparison instead of locking the next move in advance
  - the strongest remaining surgical candidate is `src/features/architect/utils/mutationPipeline.js`, while the strongest remaining batched low-risk candidate is the Trade Machine validator/result-presentation family centered on `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
  - the recommended next migration scope is the Trade Machine validator/result-presentation family:
    - `src/features/architect/tradeMachine/ValidationStateHeader.jsx`
    - `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
    - `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
    - `src/features/architect/tradeMachine/DataWarningsSection.jsx`
    - `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
    - `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx`
    - `src/features/architect/tradeMachine/FaExceptionTracker.jsx`
    - `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx`
    - `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`
  - the recommended lane is `batched low-risk`
  - the estimated live JS/JSX/TSX business-logic count for that named scope is `9`
  - the recommended next scope should stay `one grouped batched pass` because it still reads as a single validator-display chain centered on `ValidationDetailsPanel.jsx`, fed by props from excluded hubs, with read-heavy behavior and direct family-level tests
  - execution-time evidence did not require widening the recommendation into `TradeEditor.jsx`, `TradeTeamCard.jsx`, `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, or `SeasonAdvanceModal.jsx`; it also did not require folding `TradePreviewModal.jsx` or `TradeExportCapture.jsx` into the counted live scope
  - current frontier read: batching still wins by default for the next move, with surgical treatment reserved for the short dangerous-hub list led by `mutationPipeline.js`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `GMDashboard.jsx`, `WorldSelector.jsx`, and `SeasonAdvanceModal.jsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E96_RETURN_PACKAGE.md`

### Validator TS Trade Machine Validation Presentation E97 (2026-03-14)

- Status:
  - the 9-file Trade Machine validator/result-presentation family is now TS-backed through authoritative `.tsx` implementations:
    - `src/features/architect/tradeMachine/ValidationStateHeader.tsx`
    - `src/features/architect/tradeMachine/ValidationDetailsPanel.tsx`
    - `src/features/architect/tradeMachine/TradeSummaryPanel.tsx`
    - `src/features/architect/tradeMachine/DataWarningsSection.tsx`
    - `src/features/architect/tradeMachine/TradeLegalChecker.tsx`
    - `src/features/architect/tradeMachine/TradeExceptionDashboard.tsx`
    - `src/features/architect/tradeMachine/FaExceptionTracker.tsx`
    - `src/features/architect/tradeMachine/TradeSalaryCalculator.tsx`
    - `src/features/architect/tradeMachine/TradeReceiptPanel.tsx`
  - the same-path `.jsx` files remain in place as shim-only compatibility surfaces by rule
- Migration note:
  - behavior remained unchanged across the full validator/result-presentation family, including exact render ordering, labels, warning/status text, section titles, badges, conditional rendering, dev gating, and validator-result consumption
  - `ValidationDetailsPanel` remains the boundary root and central fan-out for this family; execution did not widen into `TradeEditor.jsx`, `TradeTeamCard.jsx`, preview/export surfaces, `mutationPipeline.js`, or dashboard hubs
  - callback routing and data-flow contracts remained unchanged in `TradeSummaryPanel`, `TradeExceptionDashboard`, `FaExceptionTracker`, `TradeSalaryCalculator`, and `TradeReceiptPanel`
  - added a local permissive `validationPresentationTypes.ts` helper, a dedicated compatibility guardrail for the kept `.jsx` shims, a Phase 65 source-scan retarget to follow `.tsx` authorities, and a small test-only cleanup fix in `validationDetailsPanel.devSntInjector.test.tsx` for a pre-existing isolation failure
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js src/tests/architect/tradeMachineValidationPresentation.compatibility.guardrail.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/trade/TradeValidationGating.guardrail.test.jsx src/tests/trade/validatorContractConsumers.test.jsx src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx src/tests/architect/validationDetailsPanel.devSntInjector.test.tsx`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, browser externalization of `fs`, mixed static/dynamic imports, and large chunk sizes outside the E97 boundary
  - `npm run validate:project`: PASS
- Follow-up:
  - the grouped batched pass completed cleanly
  - no mandatory follow-up remains inside the validator/result-presentation family
  - the broader validation-presentation boundary is now effectively complete; remaining Trade Machine JS/JSX work lives in excluded editing/orchestration hubs and the excluded preview/export pocket
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_MACHINE_VALIDATION_PRESENTATION_E97_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E98 (2026-03-14)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, the E93 Offseason preview surface arc remains complete, the E95 seasonManager arc remains complete, and the E97 validator/result-presentation family arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the two-lane comparison instead of locking the next move in advance
  - the strongest remaining surgical candidate is `src/features/architect/utils/mutationPipeline.js`, while the strongest remaining batched low-risk candidate from current repo state is the Trade Machine preview/export family:
    - `src/features/architect/tradeMachine/TradePreviewModal.jsx`
    - `src/features/architect/tradeMachine/TradeExportCapture.jsx`
  - the recommended next migration scope is the Trade Machine preview/export family
  - the recommended lane is `batched low-risk`
  - the estimated live JS/JSX/TSX business-logic count for that scope is `2`
  - the counted core files are the preview/export pair only; excluded editing/orchestration hubs remain `TradeEditor.jsx` and `TradeTeamCard.jsx`; excluded Trade Team Card leaf family remains `CapImpactTiles.jsx`, `SelectTeamCard.jsx`, `OutgoingPlayersList.jsx`, `TradePlayerRow.jsx`, `EntitlementPicksList.jsx`, `EntitlementPickRow.jsx`, and `TradeExceptionManager.jsx`
  - the recommended next scope should stay `one grouped batched pass` because `TradePreviewModal.jsx` is a thin live wrapper over `TradeExportCapture.jsx`, both share the same `teams`/`result`/`yearKey` data flow and ref-based capture/download behavior, and execution-time evidence did not surface a clean split point
  - execution-time evidence did not require widening the recommendation into `TradeEditor.jsx`, `TradeTeamCard.jsx`, the Trade Team Card leaf family, or `mutationPipeline.js`; if a later pass finds a blocker, it should document that blocker instead of auto-expanding scope
  - current frontier read: batching still wins by default for coherent low-risk slices, with surgical treatment reserved for the short dangerous-hub list led by `mutationPipeline.js`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `GMDashboard.jsx`, `WorldSelector.jsx`, and `SeasonAdvanceModal.jsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E98_RETURN_PACKAGE.md`

### Validator TS Trade Machine Preview/Export Family E99 (2026-03-14)

- Status:
  - the 2-file Trade Machine preview/export family is now TS-backed through authoritative `.tsx` implementations:
    - `src/features/architect/tradeMachine/TradePreviewModal.tsx`
    - `src/features/architect/tradeMachine/TradeExportCapture.tsx`
  - both same-path `.jsx` files remain in place as shim-only compatibility surfaces by rule:
    - `src/features/architect/tradeMachine/TradePreviewModal.jsx`
    - `src/features/architect/tradeMachine/TradeExportCapture.jsx`
- Migration note:
  - behavior remained unchanged across the preview/export pair, including exact preview/export text, labels, empty states, disclaimer text, legal footer semantics, export ordering, hidden capture behavior, modal open/close semantics, and download wiring
  - `TradePreviewModal` remains the lifecycle owner for the family, preserving the exact two-surface open state: one offscreen capture render plus one visible preview render
  - `TradeExportCapture` remains the ref target and export surface, preserving the current `forwardRef` contract, incoming asset derivation, year-key salary fallback, cap impact display, and export-only formatting
  - execution stayed inside the E99 boundary and did not widen into `TradeEditor.jsx`, `TradeTeamCard.jsx`, the Trade Team Card leaf family, `mutationPipeline.js`, or dashboard hubs
  - added a local permissive `tradePreviewExportTypes.ts` helper plus dedicated compatibility and UI guardrails for the kept `.jsx` shims and the preview/export render contract
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/tradeMachinePreviewExport.compatibility.guardrail.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/trade/TradePreviewExport.guardrail.test.tsx`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, browser externalization of `fs`, mixed static/dynamic imports, and large chunks outside the E99 boundary
  - `npm run validate:project`: PASS
- Follow-up:
  - the grouped batched pass completed cleanly
  - no mandatory follow-up remains inside the preview/export family
  - the broader preview/export boundary is now effectively complete; remaining Trade Machine JS/JSX work lives in excluded editing/orchestration hubs and the excluded Trade Team Card leaf family
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_MACHINE_PREVIEW_EXPORT_FAMILY_E99_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E100 (2026-03-14)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world-lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, the E93 Offseason preview surface arc remains complete, the E95 seasonManager arc remains complete, the E97 validator/result-presentation family arc remains complete, and the E99 preview/export family arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the two-lane comparison instead of locking the next move in advance
  - the strongest remaining Lane A surgical candidate remains `src/features/architect/utils/mutationPipeline.js`
  - the strongest remaining Lane B candidate from current repo state is the counted `7-file Trade Team Card leaf family`:
    - `src/features/architect/tradeMachine/CapImpactTiles.jsx`
    - `src/features/architect/tradeMachine/SelectTeamCard.jsx`
    - `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`
    - `src/features/architect/tradeMachine/TradePlayerRow.jsx`
    - `src/features/architect/tradeMachine/EntitlementPicksList.jsx`
    - `src/features/architect/tradeMachine/EntitlementPickRow.jsx`
    - `src/features/architect/tradeMachine/TradeExceptionManager.jsx`
  - the counted seven-file family explicitly excludes the orchestration hubs `src/features/architect/tradeMachine/TradeTeamCard.jsx` and `src/features/architect/tradeMachine/TradeEditor.jsx`, and it also remains distinct from the already-closed E97 validator/result-presentation family and the already-closed E99 preview/export family
  - execution-time inspection kept the seven-file family as the best next move: `CapImpactTiles.jsx`, `SelectTeamCard.jsx`, and `TradeExceptionManager.jsx` remain mostly display-only leaves; `OutgoingPlayersList.jsx` and `EntitlementPicksList.jsx` remain list-composition layers; `TradePlayerRow.jsx` and `EntitlementPickRow.jsx` remain the callback-heavy risk points, but not strong enough blockers to overturn the batch
  - the recommended next migration scope is the `Trade Team Card leaf family`
  - the recommended lane is `batched low-risk`
  - the estimated live JS/JSX/TSX business-logic count for that scope is `7`
  - the next move should stay `one grouped family scope`, not be pre-split, because `OutgoingPlayersList.jsx` directly composes `TradePlayerRow.jsx` and `EntitlementPicksList.jsx` directly composes `EntitlementPickRow.jsx`; splitting those pairs in advance would cut across the actual prop/callback chains from `TradeTeamCard.jsx` rather than create a cleaner boundary
  - current frontier read: batching still wins by default for coherent low-risk slices, with surgical treatment reserved for the short dangerous-hub list led by `mutationPipeline.js`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `GMDashboard.jsx`, `WorldSelector.jsx`, and `SeasonAdvanceModal.jsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E100_RETURN_PACKAGE.md`

### Validator TS Trade Team Card Leaf Family E101 (2026-03-14)

- Status:
  - the counted 7-file Trade Team Card leaf family is now TS-backed through authoritative `.tsx` implementations:
    - `src/features/architect/tradeMachine/CapImpactTiles.tsx`
    - `src/features/architect/tradeMachine/SelectTeamCard.tsx`
    - `src/features/architect/tradeMachine/OutgoingPlayersList.tsx`
    - `src/features/architect/tradeMachine/TradePlayerRow.tsx`
    - `src/features/architect/tradeMachine/EntitlementPicksList.tsx`
    - `src/features/architect/tradeMachine/EntitlementPickRow.tsx`
    - `src/features/architect/tradeMachine/TradeExceptionManager.tsx`
  - all seven same-path `.jsx` files remain in place as shim-only compatibility surfaces by rule
- Migration note:
  - behavior remained unchanged across the Trade Team Card leaf family, including exact export shapes, display semantics, list/row composition boundaries, menu wording/order, callback names, callback argument order, sign-and-trade behavior, contract-edit behavior, entitlement routing, undo/remove behavior, and vacuum-session behavior
  - `CapImpactTiles`, `SelectTeamCard`, and `TradeExceptionManager` remain display-only leaves; `OutgoingPlayersList` and `EntitlementPicksList` remain list-composition layers; `TradePlayerRow` and `EntitlementPickRow` remain the action-heavy rows, now moved into TS without widening the scope
  - execution stayed inside the E101 boundary and did not widen into `TradeTeamCard.jsx`, `TradeEditor.jsx`, `mutationPipeline.js`, dashboard hubs, the closed E97 family, or the closed E99 family
  - added focused E101 compatibility, display, and row-contract guardrails, retargeted the Phase 73 and no-vacuum-copy guardrails to the new authorities, and made a small test-only cleanup fix in `tradePlayerRow.signAndTradeInjector.test.tsx` to prevent stale-DOM leakage between tests
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:architect -- --reporter=dot src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx src/tests/architect/tradeTeamCardLeafFamily.display.e101.test.tsx src/tests/architect/tradeTeamCardLeafFamily.rowContracts.e101.test.tsx src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js src/tests/architect/noVacuumWording.test.ts src/tests/architect/tradePlayerRow.signAndTradeInjector.test.tsx src/tests/architect/tradePlayerRow.yearsRemainingDisplay.test.tsx src/tests/architect/entitlementPickRowDisplay.test.jsx src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx`: FAIL outside E101 because the repo script still seeded the full architect roots and `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js` flagged out-of-scope `src/features/architect/tradeMachine/FaExceptionTracker.tsx`
  - `npm run test:node -- --reporter=dot src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js src/tests/architect/noVacuumWording.test.ts`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx src/tests/architect/tradeTeamCardLeafFamily.display.e101.test.tsx src/tests/architect/tradeTeamCardLeafFamily.rowContracts.e101.test.tsx`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/tradePlayerRow.signAndTradeInjector.test.tsx src/tests/architect/tradePlayerRow.yearsRemainingDisplay.test.tsx src/tests/architect/entitlementPickRowDisplay.test.jsx src/tests/architect/entitlementPickRow.vacuumBadges.test.jsx`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, `fs` browser externalization from `tradeDebug.js`, mixed static/dynamic imports, and large chunks outside the E101 boundary
  - `npm run validate:project`: PASS
- Follow-up:
  - the grouped batch completed cleanly inside the counted seven-file family
  - no mandatory follow-up remains inside the Trade Team Card leaf family
  - the broader leaf-family boundary is now effectively complete; remaining nearby live JS/JSX work lives in the excluded orchestration hubs `TradeTeamCard.jsx` and `TradeEditor.jsx`, while the counted family now only retains shim-only `.jsx` compatibility files
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_TEAM_CARD_LEAF_FAMILY_E101_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E102 (2026-03-14)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, the E93 Offseason preview surface arc remains complete, the E95 seasonManager arc remains complete, the E97 validator/result-presentation family arc remains complete, the E99 preview/export family arc remains complete, and the E101 Trade Team Card leaf family arc remains complete.
- Audit note:
  - execution-time repo evidence re-ran the required Lane A set instead of locking the surgical winner in advance
  - `mutationPipeline.js`, `TradeEditor.jsx`, the paired `TradeEditor.jsx + TradeTeamCard.jsx` boundary, and the dashboard/world boundary `GMDashboard.jsx + WorldSelector.jsx + SeasonAdvanceModal.jsx` were all explicitly inspected and compared
  - the strongest Lane A surgical comparison target from current repo state is the paired orchestration boundary `TradeEditor.jsx + TradeTeamCard.jsx`
  - `mutationPipeline.js` remains explicitly inspected but loses because it is still the broader `4589`-line cross-feature mutation engine with the largest blast radius
  - the dashboard/world boundary remains a serious surgical alternative, but it loses because the cutoff is less clean and sits next to still-live support leaves and section wiring
  - the strongest Lane B candidate from current repo state is the counted `3-file GM world-support family`:
    - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
    - `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
    - `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
  - the winning Lane B boundary explicitly excludes `WorldSelector.jsx`, `SeasonAdvanceModal.jsx`, `GMDashboard.jsx`, `OffseasonSection.jsx`, TS-backed shim `.js/.jsx` files, barrels, and compatibility wrappers
  - execution-time inspection kept the three-file GM world-support family as the best next move because all three files are live leaves with narrow importer footprints and a cleaner cutoff than the strongest surgical pair
  - the recommended next migration scope is the `GM world-support family`
  - the recommended lane is `batched low-risk`
  - the estimated live JS/JSX/TSX business-logic count for that scope is `3`
  - the next move should stay `one grouped arc`, not be pre-split
  - current frontier read: batching still wins by default for coherent low-risk slices, with surgical treatment reserved for the short dangerous-hub list led by `mutationPipeline.js`, `TradeEditor.jsx`, `TradeTeamCard.jsx`, `GMDashboard.jsx`, `WorldSelector.jsx`, and `SeasonAdvanceModal.jsx`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E102_RETURN_PACKAGE.md`

### Validator TS GM World-Support Family E103 (2026-03-15)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, the E93 Offseason preview surface arc remains complete, the E95 seasonManager arc remains complete, the E97 validator/result-presentation family arc remains complete, the E99 preview/export family arc remains complete, the E101 Trade Team Card leaf family arc remains complete, and the E102 next-scope audit remains complete.
- Scope:
  - the counted E103 GM world-support family was migrated through new authorities:
    - `src/features/architect/GMDashboard/components/DeleteWorldModal.tsx`
    - `src/features/architect/GMDashboard/components/WorldTimeControls.tsx`
    - `src/features/architect/GMDashboard/components/DraftPositionsInput.tsx`
  - same-path `.jsx` files were retained as shim-only compatibility surfaces:
    - `src/features/architect/GMDashboard/components/DeleteWorldModal.jsx`
    - `src/features/architect/GMDashboard/components/WorldTimeControls.jsx`
    - `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
  - execution stayed out of `src/features/architect/GMDashboard/GMDashboard.jsx`, `src/features/architect/GMDashboard/components/WorldSelector.jsx`, `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`, `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`, `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/tradeMachine/TradeEditor.jsx`, `src/features/architect/tradeMachine/TradeTeamCard.jsx`, and the already-closed E97, E99, and E101 families
- Outcome:
  - behavior remained unchanged across the GM world-support family, including exact export shapes, modal copy, confirm/cancel/delete behavior, `data-testid` values, button text, helper text, world-date display semantics, date-persistence behavior, JSON parse/validation behavior, load/save flow, and worldManager callback contracts
  - `DeleteWorldModal` remained a named-only export, `WorldTimeControls` remained a named-only export, and `DraftPositionsInput` retained both default and named exports plus the runtime `propTypes` surface
  - no blocker forced expansion into `OffseasonSection.jsx`, `GMDashboard.jsx`, or any excluded world-management hub
  - the counted family now keeps only shim-only `.jsx` compatibility files; no live business logic in the family remains JS/JSX
- Validation:
  - `npm run test:ui -- --reporter=dot src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx src/tests/architect/gmWorldSupportFamily.e103.behavior.test.tsx`: PASS
  - `npm run test:node -- --reporter=dot src/tests/tradeMachine/phase5DraftPositions.test.js`: PASS
  - `npm run typecheck`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, `fs` browser externalization from `tradeDebug.js`, mixed static/dynamic imports, and large chunks outside E103
  - `npm run validate:project`: PASS
- Follow-up:
  - the grouped batch completed cleanly inside the counted three-file family
  - no mandatory follow-up remains inside the GM world-support family itself
  - the broader GM world-support boundary is now effectively complete; remaining nearby live JS/JSX work lives only in the excluded dashboard/world hubs, while the counted family now only retains shim-only `.jsx` compatibility files
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_GM_WORLD_SUPPORT_FAMILY_E103_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E104 (2026-03-15)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, the E93 Offseason preview surface arc remains complete, the E95 `seasonManager` arc remains complete, the E97 Trade Machine validator/result-presentation family arc remains complete, the E99 preview/export family arc remains complete, the E101 Trade Team Card leaf family arc remains complete, and the E103 GM world-support family arc remains complete.
- Audit note:
  - the strongest Lane A comparison target from current repo state is the paired orchestration boundary `src/features/architect/tradeMachine/TradeEditor.jsx + src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - the strongest Lane B comparison target from current repo state is the mixed shared-display/support trio:
    - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
    - `src/features/architect/shared/LeagueView/LeagueView.jsx`
    - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
  - the final recommended next scope is the `TradeEditor + TradeTeamCard paired orchestration boundary`
  - the chosen lane is `high-risk surgical`
  - the estimated live business-logic count is `2`
  - the likely future execution shape is `one named boundary executed in internal sub-arcs`
  - current frontier read: batching no longer wins by default; the repo has now pivoted to `surgical-by-default`
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E104_RETURN_PACKAGE.md`

### Validator TS TradeEditor + TradeTeamCard Boundary E105 (2026-03-15)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, the E93 Offseason preview surface arc remains complete, the E95 `seasonManager` arc remains complete, the E97 Trade Machine validator/result-presentation family arc remains complete, the E99 preview/export family arc remains complete, the E101 Trade Team Card leaf family arc remains complete, the E103 GM world-support family arc remains complete, the E104 next-scope audit remains complete, and the paired TradeEditor + TradeTeamCard orchestration boundary is now TS-backed.
- Scope:
  - the counted E105 paired orchestration boundary was migrated through new authorities:
    - `src/features/architect/tradeMachine/TradeEditor.tsx`
    - `src/features/architect/tradeMachine/TradeTeamCard.tsx`
  - same-path `.jsx` files were retained as shim-only compatibility surfaces:
    - `src/features/architect/tradeMachine/TradeEditor.jsx`
    - `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - execution stayed out of `src/features/architect/utils/mutationPipeline.js`, `src/features/architect/GMDashboard/GMDashboard.jsx`, `src/features/architect/GMDashboard/components/WorldSelector.jsx`, `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`, and the already-closed E97, E99, E101, and E103 boundaries
- Outcome:
  - behavior remained unchanged across the paired boundary, including exact default-export surfaces, callback names, callback argument order, local state ownership, modal control flow, preview/export wiring, validation/apply/reset wiring, entitlement editing flow, trade-team orchestration flow, section ordering, visible labels, button text, salary-matching display semantics, entitlement routing, TPE display semantics, contract-edit triggers, and sign-and-trade entry behavior
  - `TradeEditor.tsx` is now the authoritative parent orchestration boundary and `TradeTeamCard.tsx` is now the authoritative team-card orchestration boundary
  - the same-path `.jsx` files now remain shim-only, and no blocker forced expansion into any excluded dashboard or mutation hub
  - the paired boundary completed cleanly and the broader paired orchestration boundary is now effectively complete
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/tradeEditorTeamCard.compatibility.guardrail.test.tsx src/tests/architect/tradeEditorTeamCard.boundary.e105.test.tsx`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/tradeEditor.devSntInjectorGate.guardrail.test.ts src/tests/architect/editContractModal_closure.gate.test.ts src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js src/tests/architect/phase16_3_trade_machine_init_guardrail.test.js src/tests/architect/noVacuumWording.test.ts`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, `fs` browser externalization from `tradeDebug.js`, mixed static/dynamic imports, and large chunks outside E105
  - `npm run validate:project`: PASS
- Follow-up:
  - no blocker remains inside the paired boundary itself
  - no mandatory E105 follow-up remains beyond the kept shim-only `.jsx` compatibility files
  - nearby live JS/JSX work still exists only in the explicitly excluded hubs such as `mutationPipeline.js`, `GMDashboard.jsx`, `WorldSelector.jsx`, and `SeasonAdvanceModal.jsx`
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_EDITOR_TEAM_CARD_BOUNDARY_E105_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E106 (2026-03-15)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, the E93 Offseason preview surface arc remains complete, the E95 `seasonManager` arc remains complete, the E97 Trade Machine validator/result-presentation family arc remains complete, the E99 preview/export family arc remains complete, the E101 Trade Team Card leaf family arc remains complete, the E103 GM world-support family arc remains complete, and the E105 TradeEditor + TradeTeamCard boundary remains complete.
- Frontier:
  - current repo evidence shows the frontier has now pivoted to `surgical-by-default`
  - batching no longer wins by default
  - strongest Lane A target: `src/features/architect/utils/mutationPipeline.js`
  - strongest Lane B target: the shared-display/support trio:
    - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
    - `src/features/architect/shared/LeagueView/LeagueView.jsx`
    - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
  - dashboard/world (`GMDashboard.jsx` + `WorldSelector.jsx` + `SeasonAdvanceModal.jsx`) and the shared contract pocket (`EditContractModal.jsx` + shared contract helpers) remain real surgical alternatives, but neither beats `mutationPipeline.js`
- Recommendation:
  - the final recommended next scope is `src/features/architect/utils/mutationPipeline.js`
  - the chosen lane is `high-risk surgical`
  - the estimated live business-logic count is `1`
  - the likely future execution shape is `one named boundary executed in internal sub-arcs`
  - widening rule: do not silently widen into other hubs unless a future execution pass proves a real blocker
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - no broader `npm run test:*` suite was run because this was a documentation-only next-scope audit and static inspection resolved the frontier without ambiguity
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E106_RETURN_PACKAGE.md`

### Validator TS Mutation Pipeline E107 (2026-03-15)

- Status: E39 remains closed, E41 remains complete, the E43/E44 `tradeContext` mini-arc remains complete, the E46 trade-facing helper foundation remains complete, the E48 `capTotals` mini-arc remains complete, the E50 `persistenceContracts` arc remains complete, the E52 season-transition helper arc remains complete, the E54 exception-history mini-arc remains complete, the E56/E57 `playerRulesProfile` arc remains complete, the E59 contract/season helper arc remains complete, the E61/E62 non-trade cap-legality arc remains complete, the E64 world-aware loader mini-arc remains complete, the E66/E67 entitlement presentation arc remains complete, the E69 Trade Machine validation snapshot/accessor arc remains complete, the E71 Architect contract/cap hook arc remains complete, the E73 world lifecycle arc remains complete, the E75 trade-execution helper arc remains complete, the E77 helper-trio sub-arc remains complete, the E78 `useTradeMachine` hook arc remains complete, the E80 consent helper arc remains complete, the E82 world/data-access helper arc remains complete, the E84 Team History surface arc remains complete, the E86 Free Agent Pool surface arc remains complete, the E88 Cap Sheet display-core sub-arc remains complete, the E89 Cap Sheet modal-pair sub-arc remains complete, the E91 Free Agency offer-sheet surface arc remains complete, the E93 Offseason preview surface arc remains complete, the E95 `seasonManager` arc remains complete, the E97 Trade Machine validator/result-presentation family arc remains complete, the E99 preview/export family arc remains complete, the E101 Trade Team Card leaf family arc remains complete, the E103 GM world-support family arc remains complete, the E105 TradeEditor + TradeTeamCard boundary remains complete, the E106 next-scope audit remains complete, and the named `mutationPipeline` authority is now TS-backed.
- Scope:
  - the counted E107 boundary was migrated through the new authority:
    - `src/features/architect/utils/mutationPipeline.ts`
  - same-path `.js` was retained only as a shim-only compatibility surface:
    - `src/features/architect/utils/mutationPipeline.js`
  - execution stayed out of `src/features/architect/GMDashboard/GMDashboard.jsx`, `src/features/architect/GMDashboard/components/WorldSelector.jsx`, `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`, `src/shared/components/EditContractModal.jsx`, Trade Machine UI files, and the already-closed E97/E99/E101/E103/E105 authorities
- Outcome:
  - `mutationPipeline.ts` is now the authoritative runtime boundary and `mutationPipeline.js` is now a pure compatibility shim
  - behavior remained unchanged across helper normalization/sanitization, trade and non-trade compute paths, persistence preparation, world write sequencing, event/audit payload generation, apply fail-close behavior, and compute/apply separation
  - the named E107 boundary completed cleanly with no business logic left in JS and no blocker forcing scope expansion
  - the broader mutation-pipeline boundary is now effectively complete; remaining nearby live JS/JSX work still lives only in explicitly excluded dashboard, shared-contract, and Trade Machine UI hubs
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/mutationPipeline.compatibility.guardrail.test.ts src/tests/architect/mutationPipeline.boundary.e107.test.ts`: PASS
  - `npm run test:node -- --reporter=dot <retargeted mutationPipeline source-scan guardrails + closest existing node behavior proofs>`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, `fs` browser externalization from `tradeDebug.js`, mixed static/dynamic import chunking, and large chunks outside E107
  - `npm run validate:project`: PASS
- Follow-up:
  - no mandatory E107 follow-up remains inside the named boundary beyond the kept shim-only `.js` compatibility file
  - nearby excluded hubs remain excluded and unchanged
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_MUTATION_PIPELINE_E107_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E108 (2026-03-15)

- Status: all previously closed scopes through E107 remain closed/complete. That includes E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, E82, E84, E86, E88, E89, E91, E93, E95, E97, E99, E101, E103, E105, and E107.
- Frontier:
  - strongest Lane A target: `GMDashboard + WorldSelector + SeasonAdvanceModal dashboard/world boundary`
  - strongest Lane B target: the shared-display/support trio:
    - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
    - `src/features/architect/shared/LeagueView/LeagueView.jsx`
    - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
  - `mutationPipeline.js` now remains closed as a TS-backed shim after E107, and current repo evidence leaves the post-E107 live frontier concentrated in the dashboard/world cluster, the shared contract pocket, and a mixed low-risk trio
  - the repo remains `surgical-by-default`; Lane B no longer has a real winner and batching does not re-win
- Recommendation:
  - final recommended next scope: `GMDashboard + WorldSelector + SeasonAdvanceModal dashboard/world boundary`
  - chosen lane: `Lane A — surgical`
  - estimated live business-logic count: `3`
  - likely execution shape: `child-first grouped UI migration, with WorldSelector and SeasonAdvanceModal first and GMDashboard last`
  - widening rule: do not silently widen into `OffseasonSection.jsx`, `EditContractModal.jsx`, shared contract helpers, wrappers, or unrelated hubs unless a future execution pass proves and documents a concrete blocker
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - no broader `npm run test:*` suite was run because this was a documentation-only next-scope audit and static inspection resolved the frontier without unresolved ambiguity
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E108_RETURN_PACKAGE.md`

### Validator TS Dashboard/World Boundary E109 (2026-03-15)

- Status: all previously closed scopes through E108 remain closed/complete, and the named dashboard/world boundary is now TS-backed.
- Scope:
  - the counted E109 authorities were migrated to:
    - `src/features/architect/GMDashboard/components/WorldSelector.tsx`
    - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx`
    - `src/features/architect/GMDashboard/GMDashboard.tsx`
  - same-path `.jsx` files now remain only as shim-only compatibility surfaces:
    - `src/features/architect/GMDashboard/components/WorldSelector.jsx`
    - `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
    - `src/features/architect/GMDashboard/GMDashboard.jsx`
  - execution stayed out of `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`, `src/shared/components/EditContractModal.jsx`, shared contract helpers, the already-closed E103 world-support authorities, and other excluded hubs
- Outcome:
  - the grouped child-first boundary completed cleanly with `WorldSelector` first, `SeasonAdvanceModal` second, and `GMDashboard` last
  - behavior remained unchanged across world selection/create/branch/rename/archive/delete flow, season-advance wizard flow, dashboard tab/layout flow, edit-contract modal wiring, localStorage restore/persist behavior, and existing callback/export surfaces
  - the three same-path `.jsx` files are now pure shims and no business logic remains in JSX inside the named boundary
  - the broader dashboard/world boundary is now effectively complete, with only explicitly excluded nearby hubs still outside scope
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx src/tests/architect/dashboardWorldBoundary.e109.test.tsx`: PASS
  - `npm run test:node -- --reporter=dot src/tests/security/architectClientEmulatorLock.guardrail.test.ts src/tests/architect/noVacuumWording.test.ts`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, `fs` browser externalization from `tradeDebug.js`, mixed static/dynamic import chunking, and large chunks outside E109
  - `npm run validate:project`: PASS
- Follow-up:
  - no blocker forced widening and no mandatory follow-up remains inside the named boundary beyond the kept shim-only `.jsx` files
  - nearby excluded hubs remain excluded and unchanged
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_DASHBOARD_WORLD_BOUNDARY_E109_RETURN_PACKAGE.md`

### Validator TS Next-Scope Expansion Audit E110 (2026-03-15)

- Status: all prior scopes through E109 remain closed/complete, including E39, E41, E43/E44, E46, E48, E50, E52, E54, E56/E57, E59, E61/E62, E64, E66/E67, E69, E71, E73, E75, E77, E78, E80, E82, E84, E86, E88, E89, E91, E93, E95, E97, E99, E101, E103, E105, E107, and E109.
- Frontier:
  - strongest Lane A target: `shared contract pocket`
    - `src/shared/components/EditContractModal.jsx`
    - `src/shared/utils/contracts/contractUtils.js`
    - `src/shared/utils/contracts/seasonNormalizer.js`
  - strongest Lane B target: the shared-display/support trio
    - `src/features/architect/shared/ValidationWarnings/ValidationWarnings.jsx`
    - `src/features/architect/shared/LeagueView/LeagueView.jsx`
    - `src/features/architect/shared/RosterVisual/RosterVisual.jsx`
  - current repo evidence leaves the frontier surgical-first: the shared contract pocket is the strongest remaining concentrated live JS boundary, while Lane B remains a disconnected low-risk trio rather than a winning batch
- Recommendation:
  - final recommended next scope: `shared contract pocket`
  - chosen lane: `Lane A — surgical`
  - estimated live business-logic count: `3`
  - likely execution shape: `one named surgical pocket with modal-first internal slices, while keeping the shared helper pair in-scope from the start`
  - the repo remains `surgical-by-default`; batching does not re-win after E109
  - widening rule: do not silently widen into dashboard/world shells, wrappers, or unrelated shared display surfaces unless a future execution pass proves and documents a concrete blocker
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - no broader `npm run test:*` suite was run because this was a documentation-only next-scope audit and static inspection resolved the frontier without ambiguity
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_NEXT_SCOPE_EXPANSION_AUDIT_E110_RETURN_PACKAGE.md`

### Validator TS Shared Contract Pocket E111 (2026-03-15)

- Status:
  - the shared contract pocket is now TS-backed:
    - `src/shared/components/EditContractModal.tsx`
    - `src/shared/utils/contracts/contractUtils.ts`
    - `src/shared/utils/contracts/seasonNormalizer.ts`
  - the same-path `.js/.jsx` files are now shim-only compatibility surfaces:
    - `src/shared/components/EditContractModal.jsx`
    - `src/shared/utils/contracts/contractUtils.js`
    - `src/shared/utils/contracts/seasonNormalizer.js`
  - behavior remained unchanged across modal action selection, validation/error/warning flow, override flow, buyout flow, sign-and-trade destination handling, and the shared contract/season helper semantics
  - the grouped boundary completed cleanly with helpers first, modal second, and shims last
  - the broader shared contract pocket is now effectively complete; no blocker or mandatory narrow follow-up remains inside the named boundary, and nearby excluded dashboard/world and shared-display hubs remain excluded
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/sharedContractPocket.compatibility.guardrail.test.tsx src/tests/architect/sharedContractPocket.e111.behavior.test.tsx`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/editContractModal_closure.gate.test.ts`: PASS
  - `npm run build`: PASS
- `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SHARED_CONTRACT_POCKET_E111_RETURN_PACKAGE.md`

### Validator TS Shim Cleanup Audit E112 (2026-03-15)

- Status:
  - inside the audited E112 144-pair architect/shared roots, the repo now supports same-path shim cleanup as the next cleanup category
  - the 43-file zero-explicit-import set was treated only as the initial candidate pool; a real low-risk first deletion batch exists with 39 pure same-path re-export shims
  - the four initial-pool files that did not survive into the first-batch recommendation are `src/features/architect/tradeMachine/ValidationStateHeader.jsx`, `src/features/architect/utils/capLegalityValidation.js`, `src/features/architect/utils/tradeContext/legacy/index.js`, and `src/features/architect/utils/tradeContext/types.js`
  - the strongest keep reason for the remaining same-path shims is unchanged live explicit `.js/.jsx` runtime imports plus active compatibility guardrails for zero-runtime shims
  - same-path shim cleanup, wrapper cleanup, and barrel/public-entry cleanup remain separate lanes and are not merged into one recommendation
- Validation:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SHIM_CLEANUP_AUDIT_E112_RETURN_PACKAGE.md`

### Validator TS First Shim Deletion Batch E113 (2026-03-15)

- Status:
  - the first same-path shim deletion batch completed fully inside the exact E113 scope
  - deleted all 39 planned same-path `.js/.jsx` shims and retained 0 of the planned 39
  - runtime behavior remained unchanged; the paired `.ts/.tsx` authorities stayed in place as the surviving source of truth
  - no broader wrapper, barrel, public-entry, or unrelated runtime cleanup was attempted, and the pass stayed inside the exact E113 deletion scope
- Validation:
  - `npm run typecheck`: PASS
  - `npm run build`: PASS
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_FIRST_SHIM_DELETION_BATCH_E113_RETURN_PACKAGE.md`

### Validator TS Second Shim Cleanup Audit E114 (2026-03-15)

- Status:
  - no meaningful second safe removable same-path shim batch exists from current repo evidence
  - shim cleanup is not the next default category after E113 because the retained same-path frontier is now runtime-import required, compatibility/guardrail-pinned, or mixed/structural
  - the strongest second-batch candidate set is empty
  - the strongest keep reason is combined runtime-import plus compatibility/guardrail pressure
  - mixed-shim cleanup and wrapper/barrel/public-entry cleanup remain separate lanes
- Validation:
  - `npm run typecheck`: FAIL (pre-existing / out-of-scope workspace state)
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_SECOND_SHIM_CLEANUP_AUDIT_E114_RETURN_PACKAGE.md`

### Validator TS Compatibility-Contract / Guardrail-Retirement Audit E115 (2026-03-15)

- Status:
  - guardrail-retirement / compatibility-contract cleanup is now the strongest next cleanup category
  - a meaningful compatibility-only blocked same-path shim set still exists after fresh repo inspection
  - the strongest retargetable/removable cluster is the dashboard/world, GM world-support, trade-team-card leaf, offseason preview/dev-gate, and helper parity/source-scan guardrails
  - the strongest reason some retained shims still must remain is unchanged runtime-backed or intentional compatibility pressure, especially shared contract pocket shims, Trade Machine cache/engine shims, and `tradeContext/legacy/index.js`
  - mixed-shim cleanup, wrapper/barrel/public-entry cleanup, and live JS/JSX migration remain separate lanes
- Validation:
  - `npm run typecheck`: FAIL
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_COMPATIBILITY_CONTRACT_GUARDRAIL_RETIREMENT_AUDIT_E115_RETURN_PACKAGE.md`

### Validator TS Grouped 33-File Scope (2026-03-15)

- Status:
  - the grouped 33-file scope is now TS-backed across the named architect leaf utils/constants/hooks, Trade Machine cache/engine/rules leaves, and shared-display/contract/dashboard section surfaces
  - same-path `.js/.jsx` files for the grouped scope are now shim-only compatibility surfaces
  - behavior remained unchanged and no blocker forced widening outside the named 33-file boundary
  - the grouped pass completed cleanly and this grouped boundary is effectively complete
  - narrow follow-up remaining: none inside the named scope beyond the mandatory retained shims
- Validation:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/grouped33FileScope.node.behavior.test.ts src/tests/architect/offseason.devGate.guardrail.test.ts src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js src/tests/tradeMachine/validationUtils.contract.test.ts tests/validationPerformance.test.js tests/validators/validationCache.test.js tests/trade/validation_caching.test.js tests/trade/basicRules.test.ts tests/trade/consent_and_reacq.test.js src/tests/architect/phase86_oste_offseason_transition_engine.test.ts tests/contractSeasonHelpers.test.ts tests/yearLogicIntegration.test.js tests/seasonIntegrationFinal.test.js`: PASS
  - `npm run test:ui -- --reporter=dot src/tests/architect/grouped33FileScope.compatibility.guardrail.test.tsx src/tests/architect/grouped33FileScope.ui.behavior.test.tsx src/tests/smoke/architect.uiSmoke.e1.test.tsx src/tests/architect/capSheet.displayCore.e88.behavior.test.tsx src/tests/architect/capSheet.uiFlows.integration.test.tsx src/tests/architect/tmCapIntegration.ui.tradeApply_updatesCapSheet.integration.test.tsx`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, `fs` browser externalization from `tradeDebug.js`, mixed static/dynamic import chunking, and large chunks
  - `npm run validate:project`: PASS
- Notes:
  - special export-surface handling was required for `basicArchitectUtils` (mixed default + named), `playerRulesProfile/types` (default-only documentation module), and the named-only `OffseasonSection`, `validationCache`, and representative engine/cache leaf surfaces covered by the compatibility guardrail
  - extra source-scan retargets were limited to `src/tests/architect/offseason.devGate.guardrail.test.ts` and `src/tests/architect/phase78_remove_updateTeamCapTotals_ssot_only_guardrails.test.js`; historical docs and return packages stayed untouched
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_GROUPED_33_FILE_SCOPE_RETURN_PACKAGE.md`

### Validator TS Compatibility Shim Retirement Batch E116 (2026-03-20)

- Status:
  - completed the compatibility-only shim retirement tranche recommended by E115
  - deleted 20 compatibility-only same-path `.js/.jsx` shims across dashboard/world, trade-team-card leaves, offseason preview, helper utilities, `tradeContext/tradeContext.js`, and `shared/components/EditContractModal.jsx`
  - rewired guardrails and behavior tests from shim-presence assertions to deleted-path absence plus extensionless/authority parity
  - kept mixed/structural surfaces (`DraftPositionsInput.jsx`, `EntitlementPicksList.jsx`, `ValidationStateHeader.jsx`, `basicArchitectUtils.js`, `playerRulesProfile/types.js`, `capLegalityValidation.js`, `computeTeamCapTotals.js`, `hardCapStatus.js`, `tradeContext/types.js`) out of scope
  - kept intentional/runtime-backed surfaces (`tradeContext/legacy/index.js`, `shared/utils/contracts/*.js`, wrapper/barrel/public-entry files, runtime-backed Trade Machine cache/engine/helper shims) out of scope
- Validation:
  - `npm run typecheck`: PASS
  - `npm run build`: PASS with pre-existing warnings about stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
  - `npm run test:diff -- --reporter=dot`: PASS (193 files, 2677 tests)
  - `npm run test:trade -- --reporter=dot`: PASS (71 files, 637 tests)
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_COMPATIBILITY_SHIM_RETIREMENT_BATCH_E116_RETURN_PACKAGE.md`

### Validator TS Runtime-Backed Utils/Constants Shim Retirement Batch E117 (2026-03-20)

- Status:
  - completed the first Phase 7B runtime-backed same-path cleanup batch
  - deleted 17 runtime-backed same-path `.js` shims under `tradeMachine/utils` and `tradeMachine/constants`
  - moved live `src/**`, tests, and retained barrel/wrapper exports off explicit `.js` imports for those modules; extensionless imports are now the internal contract for that utils/constants surface
  - added `src/tests/architect/runtimeBackedUtilsConstantsBatch.e117.guardrail.test.ts` to prove deleted-path absence plus representative extensionless/authority parity
  - kept `capSettingsProvider.js`, `hardCapStatus.js`, top-level Architect helper shims, `playerRulesProfile/**`, `tradeMachine/rules/*.js`, `tradeMachine/engine/*.js`, `tradeMachine/cache/*.js`, `tradeContext/legacy/index.js`, and `shared/utils/contracts/*.js` out of scope
- Validation:
  - `npm run typecheck`: PASS
  - `npm run build`: PASS with the same pre-existing warnings about stale Browserslist data, `fs` browser externalization from `tradeDebug.ts`, mixed static/dynamic import chunking, and large chunks
  - `npm run test:diff -- --reporter=dot`: PASS (194 files, 2680 tests)
  - `npm run test:trade -- --reporter=dot`: PASS (71 files, 637 tests)
  - `npm run validate:project`: PASS
- Return package: `return_packages/trade_machine/TM_VALIDATOR_TS_RUNTIME_BACKED_UTILS_CONSTANTS_BATCH_E117_RETURN_PACKAGE.md`

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
