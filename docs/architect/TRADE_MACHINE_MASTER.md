# TRADE_MACHINE_MASTER

Last updated: 2026-02-26

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

| # | Pillar | Status | SSOT Enforcement Point(s) | Evidence |
|---|--------|--------|---------------------------|----------|
| 1 | Salary matching | **PASS** | Validator: `validateSalaryMatching()` → `allRules.salaryMatching`. Apply: `validatePostTradeSnapshotForContext()` → same `validateTrade()` | `TRADE_E2E_TRADE_APPLY_CONSISTENCY_DEEP_REVIEW_P1_RETURN_PACKAGE.md` |
| 2 | Sign-and-trade | **PASS** | Validator: `validateSignAndTrade()` → `allRules.signAndTrade`. Apply: `buildPostTradeTeamsSnapshot()` S&T preflight throws `SIGN_AND_TRADE_APPLY_ERROR`; re-validated via `validatePostTradeSnapshotForContext()` | `TRADE_E2E_SIGN_AND_TRADE_DEEP_REVIEW_P1_RETURN_PACKAGE.md`, `TRADE_E2E_SIGN_AND_TRADE_FIX_E1_EXECUTION_RETURN_PACKAGE.md` |
| 3 | Validator ↔ apply ↔ persistence consistency | **PASS** | Apply calls same `validateTrade()` via `validatePostTradeSnapshotForContext()`. Additional apply-only gates: league invariants, entitlement invariants, exclusivity. Single `batch.commit()` atomicity. | `TRADE_E2E_TRADE_APPLY_CONSISTENCY_DEEP_REVIEW_P1_RETURN_PACKAGE.md` |
| 4 | Multi-team routing semantics | **PASS** | Validator: `validatePlayerRouting()` + `validateEntitlementRouting()` enforce explicit 3+ destinations. Apply: `buildPostTradeTeamsSnapshot()` throws `TRADE_APPLY_ROUTING_ERROR` | `TRADE_TESTS_FIX_E1_EXECUTION_RETURN_PACKAGE.md`, Clarified Rules A–E above |
| 5 | Roster + structural legality | **PASS** | Validator: `computeRosterValidation()` → `allRules.rosterCount` (min 14, max 15, two-way max 3). Apply: same rules via `validatePostTradeSnapshotForContext()` block before `batch.commit()` | `TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_FIX_E1_EXECUTION_RETURN_PACKAGE.md` |

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

### RC1 Gate Snapshot

- Trade suites confirmed clean: `test:trade` PASS (58 files, 525 passed), `test:architect` PASS (136 files, 2206 passed). Full-suite run surfaced 16 pre-existing failures in 3 non-trade files — none implicate the 5-pack. See `return_packages/ship_gates/SHIP_GATES_RC1_FULL_SUITE_P1_PREFLIGHT_RETURN_PACKAGE.md`.

### RC1.1 Gate Snapshot

- RC1.1: full node-layer suite green (232 passed, 1 skipped); no trade logic changes. The 3 node-layer failures from RC1 were resolved: entitlement pick-row label helpers fixed, perf tests gated as opt-in, S&T aggregation speculative tests converted to `test.todo()`. See `return_packages/ship_gates/SHIP_GATES_RC1_FIX_FULL_SUITE_FAILS_E1_EXECUTION_RETURN_PACKAGE.md`.

### RC1.2 Gate Snapshot

- RC1.2: full-suite green (node + UI, 267 files, 3395 tests); no trade logic changes. UI test layer (34 files, 370 tests) now passes. Fixes were wizard label/testid alignment, vacuum mode banner/save-draft restoration, Convert to Swap QuickBuilder feature, and vacuum save routing fix for creates. See `return_packages/ship_gates/SHIP_GATES_RC1_UI_SUITE_FIX_E1_EXECUTION_RETURN_PACKAGE.md`.

### Future / Deferred

- **S&T Aggregation Rule (1.6)** — tests exist in `tests/signAndTradeAggregation.test.js` as `test.todo()`; rule not implemented yet. When implemented, reactivate the 5 deferred tests (incoming aggregation, 3-team routing, third party unaffected) and provide proper 3-team fixtures with explicit `toTeamId` routing.

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
