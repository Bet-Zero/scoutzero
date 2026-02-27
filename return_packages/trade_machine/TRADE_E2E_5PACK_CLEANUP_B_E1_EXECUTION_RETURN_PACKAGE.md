# TRADE_E2E_5PACK_CLEANUP_B_E1 — Execution Return Package

Date: 2026-02-26

## Summary

Closed the two remaining non-blocking "B" minors from the 5-pack closeout:

- **Task A**: Made `usedTradeExceptions` truthful by replacing the dead `acquiredViaTPE` filter with the canonical `absorptionMode === 'TPE'` + `tpeId` encoding.
- **Task B**: `buildPostTradeTeamsSnapshot` now maintains `twoWayPlayers` consistently in post-trade snapshots (maintain-if-present pattern).

No CBA logic, salary matching, apron/hard-cap, routing, sign-and-trade, entitlement, or TPE enforcement rules were modified.

---

## Before / After

### Task A — `usedTradeExceptions`

| Aspect | Before | After |
|--------|--------|-------|
| Filter condition | `p.acquiredViaTPE` (never set) | `p.absorptionMode === 'TPE' && p.tpeId` |
| Output | Always `[]` | Correct unique TPE IDs used for absorption |
| Null safety | N/A (always empty) | Skips null/undefined/empty `tpeId` |
| Deduplication | None needed (always empty) | `Set`-based dedup |
| Payload shape | `string[]` | `string[]` (unchanged) |

### Task B — `twoWayPlayers` snapshot maintenance

| Aspect | Before | After |
|--------|--------|-------|
| `twoWayPlayers` in post-trade snapshot | Not maintained (stale) | Maintained if present pre-trade |
| Outgoing two-way players | Not removed from `twoWayPlayers` | Removed via `outgoingPlayerIds` |
| Incoming two-way players | Not added to `twoWayPlayers` | Added when `isTwoWay === true` |
| Duplicates | N/A | Prevented via player ID dedup |
| Field absent pre-trade | N/A | Not invented — only maintained if present |
| Legality enforcement | Unaffected | Unaffected (`computeRosterValidation` handles both shapes) |

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/architect/utils/tradeMachine/utils/tradeExportUtils.js` | **NEW** — `extractUsedTpeIds()` pure helper |
| `src/features/architect/hooks/useTradeMachine.js` | Import `extractUsedTpeIds`; replaced dead `acquiredViaTPE` filter in `exportCurrentTrade()` (lines 25, 1038) |
| `src/features/architect/utils/tradeContext/tradeContext.js` | Added `twoWayPlayers` maintenance block in `buildPostTradeTeamsSnapshot()` (after `players` array update) |
| `docs/architect/TRADE_MACHINE_MASTER.md` | Marked Minors 1 + 2 as FIXED in B |

### Diff-style summary

- `tradeExportUtils.js` → new file: `extractUsedTpeIds(sends)`
- `useTradeMachine.js` → `exportCurrentTrade()`: `usedTradeExceptions: extractUsedTpeIds(t.sends)`
- `tradeContext.js` → `buildPostTradeTeamsSnapshot()`: new block after `updatedTeam.players` assignment maintaining `updatedTeam.twoWayPlayers`
- `TRADE_MACHINE_MASTER.md` → Non-Blocking Minors items 1+2 updated

---

## Tests Added

| File | Cases |
|------|-------|
| `tests/trade/usedTradeExceptions.test.js` | 5 cases: TPE with valid tpeId included; missing/null tpeId excluded; dedup on shared tpeId; non-TPE modes excluded; null/undefined/empty input returns `[]` |
| `tests/trade/twoWayPlayers_snapshot.test.js` | 4 cases: outgoing two-way removed; incoming two-way added; no duplicates; field not invented when absent |

---

## Validation Outputs

- `npm run test:trade -- --reporter=dot`: **PASS** (58 files, 525 passed, 1 skipped, 3 todo)
- `npm run test:architect -- --reporter=dot`: **PASS** (136 files, 2206 passed, 1 skipped, 3 todo)
- `npm run build`: **PASS** (3053 modules, built successfully)
- `npm run validate:project`: **PASS** (all validations passed)

---

## Deferred Items

None discovered during this execution. All changes stayed within scope.

---

## Confirmation

- No other 5-pack behavior changed.
- No CBA logic, salary matching, apron/hard-cap, routing, sign-and-trade, entitlement, or TPE enforcement rules were modified.
- Only the files listed above were touched.
