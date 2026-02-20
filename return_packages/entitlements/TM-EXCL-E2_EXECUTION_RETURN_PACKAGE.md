# TM-EXCL-E2 Execution Return Package

**Ticket:** TM-EXCL-E2 — No Silent Skips: 3+ Team Routing + Compute Hard-Fail  
**Status:** COMPLETE  
**Date:** 2026-02-20  
**Prereq:** TM-EXCL-E1 + TM-EXCL-E1.1 (validator + save gate + trade gate with integrity-first semantics)

---

## Summary

Eliminated the "silent skip" failure mode in trade-time exclusivity validation by making entitlement routing **explicit and mandatory**.

Before: 3+ team trades could result in outgoing entitlements with no `toTeamId`, causing `computePostTradeEntitlements()` to silently drop items from the post-trade set. This undermined exclusivity validation.

After: Every entitlement included in a trade must have a resolvable destination team. Missing routing = illegal trade with clear error message.

---

## Files Changed

| File                                                                            | Change                                                                                        |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/tradeMachine/utils/buildEntitlementRoutingMap.ts` | **NEW** — Pure routing map builder                                                            |
| `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js`    | **MODIFIED** — `computePostTradeEntitlements()` now strict: throws on missing/invalid routing |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`            | **MODIFIED** — Wires routing map → strict compute → exclusivity in Pick Exclusivity IIFE      |
| `src/tests/architect/tradeEntitlementRouting.test.ts`                           | **NEW** — 11 tests for routing map builder                                                    |
| `src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts`           | **MODIFIED** — 2 new tests for routing-based failures                                         |
| `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`                  | **MODIFIED** — Added §10.7                                                                    |
| `return_packages/entitlements/TM-EXCL-E2_EXECUTION_RETURN_PACKAGE.md`           | **NEW** — This file                                                                           |

---

## Routing Approach

### `buildEntitlementRoutingMap(teams)`

Pure function. Takes the trade's team slots array and returns:

- `{ ok: true, map, entries }` — routing resolved for all entitlements
- `{ ok: false, reason, errors }` — routing incomplete/ambiguous

The `map` is a `Map<string, string>` keyed by `${fromTeamId}::${entitlementId}` → `toTeamId`.

### Example: 3-Team Routing Map

**Trade:** LAL sends `ent-1` to BOS, BOS sends `ent-2` to CHI, CHI sends `ent-3` to LAL.

```
Routing Map:
  LAL::ent-1 → BOS
  BOS::ent-2 → CHI
  CHI::ent-3 → LAL

Entries:
  [
    { fromTeamId: 'LAL', toTeamId: 'BOS', entitlementId: 'ent-1' },
    { fromTeamId: 'BOS', toTeamId: 'CHI', entitlementId: 'ent-2' },
    { fromTeamId: 'CHI', toTeamId: 'LAL', entitlementId: 'ent-3' },
  ]
```

### Validation Chain in `tradeValidator.js`

```
1. buildEntitlementRoutingMap(teams)
   ↓ if !ok → { passed: false, details: routing.reason }
2. computePostTradeEntitlements({ ..., tradeParticipantIds })
   ↓ if throws → caught → { passed: false, details: err.message }
3. validateEntitlementExclusivity({ entitlements: postTradeSet })
   ↓ if !valid → { passed: false, details: violations }
4. { passed: true } — all clear
```

---

## Acceptance Criteria Status

| #   | Criteria                                                                             | Status |
| --- | ------------------------------------------------------------------------------------ | ------ |
| 1   | No silent skipping — 3+ team trade with missing destination → illegal + clear reason | ✅     |
| 2   | Correct routing — 3-team cycle routes correctly, post-trade sets accurate            | ✅     |
| 3   | Backward compatibility — 2-team trades auto-resolve, no regressions                  | ✅     |

---

## Build + Test Outputs

### Build

```
npm run build
```

### Routing Tests

```
npm run test -- src/tests/architect/tradeEntitlementRouting.test.ts --run
```

### Exclusivity Tests

```
npm run test -- src/tests/architect/tradeEntitlementExclusivity.test.ts --run
npm run test -- src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts --run
```

_(Outputs pasted below after execution)_

### Actual Results

**Build:** `npm run build` — ✅ Success (3047 modules, built in 41.46s)

**All 3 targeted test files (25 tests):**

```
 ✓ src/tests/architect/tradeEntitlementRouting.test.ts (13)
 ✓ src/tests/architect/tradeEntitlementExclusivity.test.ts (6)
 ✓ src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts (6) 733ms

 Test Files  3 passed (3)
      Tests  25 passed (25)
```

---

## Known Limitations

1. **2-team broadcast fallback preserved**: For backward compatibility, `computePostTradeEntitlements()` still allows `!toTeamId` when `allTeamsEntitlementsOut.length === 1` (2-team trade). This is intentional — 2-team trades are unambiguous by definition.

2. **Pre-validation routing check**: `validateEntitlementRouting()` (Phase 17) already runs as a pre-validator in `tradeValidator.js` and returns early with `ENTITLEMENT_ROUTING_ERROR` for cross-team routing issues. The new `buildEntitlementRoutingMap()` provides a **second layer** specifically for the exclusivity IIFE, ensuring the post-trade set is always complete.

3. **UI routing UX**: The UI for setting `toTeamId` in 3+ team trades (via `EntitlementPickRow` destination dropdown) is pre-existing. No UX changes were made. If users forget to set destinations, they now get a clear "Pick Exclusivity: Entitlement routing incomplete" error instead of silent data loss.

---

## Master Doc Section Added

§10.7 "Trade Routing Requirement — No Silent Skips" added to `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`. States the invariant: "Every entitlement in a trade must have a resolvable destination team, else trade is illegal."

---

## Validation Commands Run

- `npm run build`
- `npm run test -- src/tests/architect/tradeEntitlementRouting.test.ts --run`
- `npm run test -- src/tests/architect/tradeEntitlementExclusivity.test.ts --run`
- `npm run test -- src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts --run`

## Commands Intentionally Skipped

- `npm run test:full` — Not permitted without explicit `RUN FULL SUITE` per AGENTS.md.
- `npm run lint` — Only on request per AGENTS.md; existing ~1888 errors are tech debt.
