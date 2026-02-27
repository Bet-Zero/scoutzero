# TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_FIX_E1_EXECUTION_RETURN_PACKAGE

Date: 2026-02-26
Mode: EXECUTION

---

## 1) Summary of What Changed

Wired roster structural legality (min/max standard roster, two-way maximum) into `validateTrade` as an authoritative per-team rule. This closes the three STOP conditions from the preflight deep review:

- **STOP #1 (cosmetic UI):** `TradeLegalChecker` roster row is now driven by real validator output (`team.rules.rosterCount`).
- **STOP #2/#3 (validator/apply gap):** Roster rules are now enforced in `validateTrade`, which is called by both the UI validation path and the apply-time re-validation path (`validatePostTradeSnapshotForContext` -> `validateTrade`). Illegal roster states block trade legality before `batch.commit()`.
- **SSOT ambiguity (partial):** The roster count helper handles both pre-trade (separate `players`/`twoWayPlayers` arrays) and post-trade (combined `players` array) team shapes via ID-matching with arithmetic fallback.

---

## 2) STOP Status

**Triggered during execution: NO**

No abort conditions were hit:

- No widespread runtime errors from the SSOT normalization.
- Roster rule constants (14/15 min/max, 3 two-way max) are consistent across all existing modules.
- Only 2 existing test fixtures needed adjustment (correct behavior: they were creating roster-illegal trades that were previously unchecked).

---

## 3) Exact Behavior Changes (before/after)

### Validator (`validateTrade`)

| Behavior                                                | Before                                 | After                                                                           |
| ------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Roster count rule in `allRules`                         | Not present                            | `rosterCount` key with `{ passed, violations, message, details, rosterCounts }` |
| Trade with 16+ standard players on a team               | `legal: true` (if no other violations) | `legal: false` with violation "exceeds maximum 15"                              |
| Trade with <14 standard players on a team               | `legal: true` (if no other violations) | `legal: false` with violation "below minimum 14"                                |
| Trade with 4+ two-way players on a team                 | `legal: true` (if no other violations) | `legal: false` with violation "Two-way slots exceeded"                          |
| Enforcement flags (`rosterEnforcement`, `twoWayRoster`) | Not consulted by validator             | Respected: `'error'` blocks, `'warn'` allows                                    |

### Apply-time (`validatePostTradeSnapshotForContext` -> `validateTrade`)

| Behavior                   | Before                         | After                                                                          |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Roster-illegal trade apply | Could persist (no roster gate) | Blocked: `legal: false` prevents `executeTrade` from reaching `batch.commit()` |

### UI (`TradeLegalChecker`)

| Behavior            | Before                              | After                                                                 |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Roster Count row    | Always gray/hidden (undefined rule) | Shows green (pass) or red (fail) with projected counts                |
| Apply button gating | Not affected by roster              | Gated: `result.legal === false` disables Apply when roster rule fails |

---

## 4) Roster SSOT Decision

### Invariant

The `computeRosterValidation` helper inside `tradeValidator.js` computes projected roster counts from whatever team data shape it receives:

- **When player IDs are available** (>= 50% of roster has IDs): Uses ID-matching to detect whether outgoing players are still in the roster and whether incoming players are already present. This correctly handles the post-trade snapshot (apply-time flow) where players have already been moved.
- **When player IDs are unavailable** (test fixtures, minimal data): Falls back to simple arithmetic (`current - outgoing + incoming`), which is correct for the pre-trade shape.

### Two-way detection

- If `team.team.twoWayPlayers` exists as a separate array, it is used for the two-way count (UI/Architect flow).
- Otherwise, players in `team.team.players` with `isTwoWay === true` are counted as two-way (apply-time flow with combined array).

### Where enforced

- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` — `computeRosterValidation()` called per team, result added to `allRules.rosterCount`.

---

## 5) Files Changed

### Modified

- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Added import: `validationFlags` from `@/config/validationFlags.js`
  - Added constants: `MIN_ROSTER`, `MAX_ROSTER`, `MAX_TWO_WAY`
  - Added helper: `extractPlayerId(p)` — extracts player ID from various field names
  - Added helper: `computeRosterValidation(team)` — computes projected roster counts and returns rule result
  - Wired: `rosterCountResult = computeRosterValidation(team)` in per-team loop
  - Added to `allRules`: `rosterCount: rosterCountResult`
- `tests/tradeValidator.test.js`
  - Fixed `handles 3-team trades correctly` fixture: Team C roster size 14 → 15 (so sending 1 player doesn't drop below min)
- `tests/tradeValidatorEdgeCases.test.js`
  - Fixed `allows 3-team trade mixing players, picks and cash when below aprons` fixture: Team A roster size 14 → 13 (so receiving net +1 doesn't exceed max after push)
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added "Roster Structural Legality" section: enforced rules, enforcement flags, rule output key, SSOT decision, apply-time enforcement, test coverage
- `docs/SHIP_GATES_MASTER.md`
  - Added Scenario 7 — Roster Window / Two-Way Overflow (manual smoke checklist)
  - Renumbered Scenario 7 (navigation) → Scenario 8
  - Added roster smoke line to Release Sign-Off Template

### Created

- `tests/trade/rosterLegality_validateTrade.test.js` — 3 tests through `validateTrade`
- `return_packages/trade_machine/TRADE_E2E_ROSTER_AND_STRUCTURAL_LEGALITY_FIX_E1_EXECUTION_RETURN_PACKAGE.md` — this file

### Deleted

None.

---

## 6) Tests Added/Updated

### New: `tests/trade/rosterLegality_validateTrade.test.js`

| Test                                                            | Description                                                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `blocks trade that pushes a team over max standard roster (15)` | Team with 15 players receives 3, sends 1 → projected 17 → `legal: false`, `rosterCount.passed: false`           |
| `blocks trade that drops a team below min standard roster (14)` | Team with 14 players sends 3, receives 1 → projected 12 → `legal: false`, `rosterCount.passed: false`           |
| `blocks trade that exceeds two-way max (3)`                     | Team with 3 two-way players receives 1 more two-way → projected 4 → `legal: false`, `rosterCount.passed: false` |

### Updated fixtures (behavior-preserving)

| File                                    | Test                              | Change                                                                                |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| `tests/tradeValidator.test.js`          | `handles 3-team trades correctly` | Team C `rosterSize: 14` → `15` (prevents min-roster violation when C sends 1 player)  |
| `tests/tradeValidatorEdgeCases.test.js` | `allows 3-team trade mixing...`   | Team A `rosterSize: 14` → `13` (prevents max-roster violation when A receives net +1) |

---

## 7) Validation Outputs

### `npm run test:trade -- --reporter=dot`

**Status: PASS**

56 files passed. 516 passed, 1 skipped, 3 todo.

### `npm run test:architect -- --reporter=dot`

**Status: PASS**

136 files passed. 2206 passed, 1 skipped, 3 todo.

### `npm run build`

**Status: PASS**

Built successfully. Non-blocking warnings: module externalization, chunk size.

### `npm run validate:project`

**Status: PASS**

All project schema validations passed.

---

## 8) Doc Updates

### `docs/architect/TRADE_MACHINE_MASTER.md`

Added new section **"Roster Structural Legality"** between "Current Test Gate Status" and "E1 — Sign-And-Trade" containing:

- Enforced rules (min 14, max 15, two-way max 3)
- Enforcement flags reference (`validationFlags.rosterEnforcement`, `twoWayRoster`)
- Rule output key documentation (`team.rules.rosterCount` shape)
- SSOT decision (dual-shape handling with ID-matching / arithmetic fallback)
- Apply-time enforcement confirmation
- Test coverage references

### `docs/SHIP_GATES_MASTER.md`

- Added **Scenario 7 — Roster Window / Two-Way Overflow** in Manual Smoke Checklist (Minimum Smoke section)
- Renumbered previous Scenario 7 (navigation smoke) → Scenario 8
- Added roster smoke line to Release Sign-Off Template manual checklist

---

## 9) Remaining Known Issues

### Minors (not blockers)

1. **Apply-time double-counting potential:** When `validatePostTradeSnapshotForContext` passes post-trade teams to `validateTrade`, the salary-related fields (`projectedSalary`) are recomputed on already-adjusted data. The roster count helper handles this via ID-matching, but other validators (salary matching, hard cap) operate on the same recomputed values. This is a pre-existing pattern, not introduced by this change.

2. **Test fixtures without player IDs:** Many existing test fixtures create players without `player_id`/`id` fields. The roster helper falls back to simple arithmetic in this case, which is correct for pre-trade fixtures but would not correctly handle post-trade fixtures without IDs. All current apply-time flows provide players with IDs, so this is not a runtime concern.

3. **`twoWayPlayers` not maintained in `buildPostTradeTeamsSnapshot`:** The apply-time snapshot builder updates `players` and `roster` but not `twoWayPlayers`. The roster helper handles this by falling back to `isTwoWay` flag detection on the combined `players` array. A future cleanup could maintain `twoWayPlayers` explicitly in the snapshot builder.

4. **Pre-existing roster validation modules not consolidated:** Three modules exist (`rosterValidation.js`, `validateRoster.ts`, `validateRoster.js`) with overlapping functionality. They remain unchanged and are used by other code paths (enforcement callbacks, etc.). Consolidation is deferred to avoid blast radius.

---

## 10) Exact Files/Functions Referenced

- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - `computeRosterValidation(team)` — new roster count validation helper
  - `extractPlayerId(p)` — new player ID extraction helper
  - `validateTrade({ teams, capProjections, currentYear, tradeCtx })` — main validator entry point (wired roster rule)
  - `allRules.rosterCount` — new rule output key
- `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
  - `RuleDisplay` component reads `team.rules?.rosterCount` (L62) — no change needed
- `src/config/validationFlags.js`
  - `validationFlags.rosterEnforcement` = `'error'`
  - `validationFlags.twoWayRoster` = `'error'`
- `src/features/architect/utils/tradeMachine/rules/rosterValidation.js`
  - `validateRosterWindow()`, `enforceRosterWindow()` — existing modules, unchanged
  - Constants: `MIN_ROSTER=14`, `MAX_ROSTER=15`, `MAX_TWO_WAY=3`
- `src/features/architect/utils/tradeContext/tradeContext.js`
  - `buildPostTradeTeamsSnapshot()` — updates `roster` (IDs) and `players` (objects), not `twoWayPlayers`
  - `validatePostTradeSnapshotForContext()` — calls `validateTrade()` on post-trade snapshot
- `src/features/architect/utils/mutationPipeline.js`
  - `applyWorldMutation()` — requires pre-validated trade context; blocks on `legal: false`
- `tests/trade/rosterLegality_validateTrade.test.js` — new tests
- `tests/tradeValidator.test.js` — fixture fix (Team C roster size)
- `tests/tradeValidatorEdgeCases.test.js` — fixture fix (Team A roster size)
- `docs/architect/TRADE_MACHINE_MASTER.md` — new roster legality section
- `docs/SHIP_GATES_MASTER.md` — new smoke scenario + sign-off template update
