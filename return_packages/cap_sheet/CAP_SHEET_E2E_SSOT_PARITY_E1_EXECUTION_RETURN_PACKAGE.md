# CAP_SHEET_E2E_SSOT_PARITY_E1 — Execution Return Package

**Date:** 2026-02-28
**Status:** COMPLETE
**Scope:** Cap Sheet SSOT parity, dead money schema fix, season advance bridge gate

---

## Summary

Closed 4 preflight STOP triggers around cap sheet total consistency:

1. **CapSheetFull SSOT parity** — Replaced local yearTotals math (which missed dead money and incomplete roster charges) with per-year `computeTeamCapTotals()` calls.
2. **Dead money schema fix** — ManageDeadMoneyModal now writes canonical `amountByYear` array shape per `DeadCapItemZ`, not object-map. Read path handles both shapes for backward compat.
3. **Season advance bridge gate** — Season advance write path now runs `sanitizeTransientFieldsForPersistence()` + `assertPersistableOrThrow()` before batch.set(), matching `persistWorldMutation()` hygiene.
4. **Roster shape** — Confirmed safe: `computeTeamCapTotals` uses `team.players` (hydrated objects), not `team.roster`. No code change needed. Documented canonical pattern.

---

## STOP Closure Checklist

| # | STOP Trigger | Before | After | Why Closed |
|---|-------------|--------|-------|------------|
| 1 | CapSheetFull "Total Cap" from local math | Local reduce summed players + cap holds only; missed dead money + incomplete roster charges | `computeTeamCapTotals()` called per year via `useMemo`; includes all 4 components | SSOT function is canonical, battle-tested across all other surfaces |
| 2 | deadCap.amountByYear shape mismatch | Modal wrote object-map `{ "2025-26": { amount } }` + 4 non-allowlisted fields | Modal writes canonical array `[{ season, amount, isStretched? }]` + only allowlisted fields | Matches `DeadCapItemZ` schema and `DEAD_CAP_ITEM_ALLOWLIST` |
| 3 | Roster shape (ids vs objects) | `players` = hydrated objects, `roster` = mixed | No change needed — `computeTeamCapTotals` uses `players`, never `roster` | Source-scan test verifies this invariant |
| 4 | Season advance bypass | No `sanitizeTransientFieldsForPersistence()` or `assertPersistableOrThrow()` | Bridge gate added: sanitize → normalize TPE → validate contract → removeUndefined → write | Exact same hygiene chain as `persistWorldMutation()` |

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx` | Replaced local yearTotals (lines 93-119) with `computeTeamCapTotals` per year via `useMemo` |
| `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx` | Fixed write path: canonical array shape. Fixed read path: handles both array + object-map |
| `src/features/architect/utils/seasonManager.js` | Added bridge gate: `sanitizeTransientFieldsForPersistence` + `assertPersistableOrThrow` imports + calls. Added `stripHydrationOnlyFields()` to strip hydration-only display fields before persistence |
| `src/features/architect/utils/persistenceContracts/contracts.js` | Added `active` and `reason` to `CAP_HOLD_ITEM_ALLOWLIST` (produced by `resolveOffseasonTransition`, consumed by `getActiveUnsignedCapHolds`) |
| `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js` | Updated mocks: added `assertPersistableOrThrow`, `PERSISTENCE_CONTRACTS`, `sanitizeTransientFieldsForPersistence` |
| `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.js` | Updated mocks: added `assertPersistableOrThrow`, `PERSISTENCE_CONTRACTS`, `sanitizeTransientFieldsForPersistence` |
| `src/tests/architect/capSheetFull_ssot_parity_guardrails.test.js` | NEW — 7 tests (2 source-scan, 5 behavioral) |
| `src/tests/architect/capTotals/deadMoney_modal_schema_parity.test.js` | NEW — 7 tests (schema parity, round-trip, backward compat) |
| `src/tests/architect/season_advance_bridge_gate_guardrails.test.js` | NEW — 6 tests (source-scan for bridge gate ordering + imports) |
| `docs/architect/CAP_SHEET_MASTER_DOC.md` | Added CapSheetFull to consumers, wiring map, SSOT parity guarantees section |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added CAP_SHEET_E2E_SSOT_PARITY_E1 phase entry |
| `docs/SHIP_GATES_MASTER.md` | Added Scenario 8A: Cap Sheet SSOT Parity manual smoke |

---

## Canonical Shapes (for reference)

### deadCap.amountByYear — Canonical (per DeadCapItemZ)

```javascript
// Array shape (CORRECT — what computeTeamCapTotals expects)
deadCap: [
  {
    playerId: 'waived-1',
    playerName: 'Player Name',
    amountByYear: [
      { season: '2025-26', amount: 5000000, isStretched: false },
      { season: '2026-27', amount: 2000000, isStretched: false },
    ],
  },
]
```

### Roster Pattern — Canonical

- `team.players` = hydrated player objects (used by `computeTeamCapTotals` for salary computation)
- `team.roster` = tracking field (may contain ID strings or objects depending on load path)
- All cap totals computation reads `team.players`, never `team.roster`

---

## Validation Commands + Results

npx vitest run
  Test Files  270 passed | 1 skipped (271)
       Tests  3431 passed | 11 skipped | 3 todo (3445)

npm run build
  ✓ built in 32.39s (no errors)

npm run validate:project
  ✅ All validations passed!

---

## Residual Risks / Follow-ups

1. **Legacy dead money in Firestore:** Existing worlds may have `deadCap[].amountByYear` in object-map shape from pre-fix ManageDeadMoneyModal saves. The SSOT compute function's fallback path handles this (legacy waivedContracts/stretchHistory), but if the data is in `deadCap[]` with object-map shape, the `Array.isArray` check will fail and the dead money may be invisible for that year. **Mitigation:** The modal's read path now handles both shapes, so editing and re-saving will fix the shape. A migration script could be added if needed.

2. **Roster shape documentation only:** The `roster` field inconsistency (objects vs IDs) was documented but not fixed. This is intentionally deferred because it has zero impact on cap computation (verified by source-scan test). A future cleanup pass could normalize `roster` to always be ID strings.

3. **Season advance event log:** The bridge gate adds persistence hygiene (sanitize + contract validation) but does NOT add event log entries for season advance. Season advance still has no audit trail in `events` subcollection. This was not in scope for this execution but is noted as a future improvement.
