# TM_FIX_A5_E1 — RETURN PACKAGE

**Execution ID:** TM_FIX_A5_E1
**Date:** 2026-02-14
**Master Checklist Path:** `docs/architect/TRADE_MACHINE_MASTER_CHECKLIST_V1.md`
**Workbook Path:** `docs/architect/audits/TM_AUDIT_WORKBOOK.md`

---

## Summary

Successfully eliminated silent incorrect behavior in 3+ team trades by:

1. Enforcing explicit player destinations (`tradeTo`) for multi-team trades
2. Adding validator coverage for player routing + duplicates
3. Preventing orphaned routes when a team is removed

---

## Fix Targets Completed

| ID    | Severity | Description                             | Status   | Test Coverage                 |
| ----- | -------- | --------------------------------------- | -------- | ----------------------------- |
| A5-F3 | HIGH     | Player broadcast fallback in 3+ trades  | ✅ FIXED | playerRouting.test.js (14/14) |
| A5-F1 | MEDIUM   | No cross-team duplicate player check    | ✅ FIXED | playerRouting.test.js (14/14) |
| A5-F2 | MEDIUM   | removeTeam does not clean orphan routes | ✅ FIXED | playerRouting.test.js (14/14) |

---

## Files Changed

### New Files

| File                                                                       | Purpose                                    |
| -------------------------------------------------------------------------- | ------------------------------------------ |
| `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js` | Player routing validation rule (171 lines) |
| `src/tests/trade/playerRouting.test.js`                                    | Targeted tests for all 3 fixes (267 lines) |

### Modified Files

| File                                                                 | Changes                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/features/architect/hooks/useTradeMachine.js`                    | Updated `incomingAssets` (L267-307) + `removeTeam` (L823-865) |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Import + call `validatePlayerRouting` (L31, L530-548)         |
| `docs/architect/audits/TM_AUDIT_WORKBOOK.md`                         | Updated Sections 2 & 9 evidence + status to PASS              |

---

## Implementation Details

### A) Player Targeting in 3+ Teams (A5-F3)

**Before:** Players without `tradeTo` were "broadcast" to all other teams in 3+ team trades.

**After:**

- `incomingAssets` derivation requires explicit `tradeTo` when `activeTeamCount > 2`
- `validatePlayerRouting` enforces `tradeTo` requirement at validation
- 2-team trades retain backward-compatible broadcast fallback

**Location:** `useTradeMachine.js:L267-307`

### B) Validator: validatePlayerRouting (A5-F1, A5-F3)

Created new rule file with checks:

- ✅ `tradeTo` required when activeTeamCount > 2
- ✅ `tradeTo` must match a participating team id
- ✅ Cannot route to self (`tradeTo !== fromTeamId`)
- ✅ Same player cannot appear in multiple teams' `sends` (duplicate prevention)
- ✅ Same player cannot appear twice within same team sends

**Wiring:** Imported into `tradeValidator.js` and called as cross-team validation before per-team rules.

**Location:** `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js`

### C) Team Removal Cleanup (A5-F2)

**Before:** `removeTeam` was `filter((_, i) => i !== index)` — no cleanup.

**After:**

- Capture removed team id
- Filter teams
- Map remaining teams to clear `tradeTo` for players pointing to removed team
- Map remaining teams to clear `toTeamId` for entitlements pointing to removed team

**Location:** `useTradeMachine.js:L823-865`

---

## Test Results

```
npm run test src/tests/trade/playerRouting.test.js -- --run

 ✓ src/tests/trade/playerRouting.test.js (14)
   ✓ validatePlayerRouting (11)
     ✓ 3-team trades: tradeTo required (3)
       ✓ should pass when all players have tradeTo in 3-team trade
       ✓ should fail when player has no tradeTo in 3-team trade
       ✓ should allow missing tradeTo in 2-team trade (backward compat)
     ✓ tradeTo destination validation (2)
       ✓ should fail when tradeTo points to non-participant team
       ✓ should fail when tradeTo points to self
     ✓ duplicate player detection (2)
       ✓ should fail when same player appears in multiple teams sends
       ✓ should fail when same player appears twice in same team sends
     ✓ edge cases (4)
       ✓ should pass with empty teams array
       ✓ should pass with single team (not enough for trade)
       ✓ should pass with empty sends arrays
       ✓ should handle teams with null team object
   ✓ removeTeam cleanup behavior (3)
     ✓ should clear tradeTo when it points to removed team
     ✓ should clear toTeamId for entitlements when it points to removed team
     ✓ should not modify anything when removed team has no id

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

---

## Workbook Updates

### Section 2 — Session State

| Row                         | Before           | After | Evidence                                      |
| --------------------------- | ---------------- | ----- | --------------------------------------------- |
| Same asset cannot be twice  | PARTIAL (MEDIUM) | PASS  | `validatePlayerRouting.js` catches cross-team |
| Removing team cleans assets | FAIL (MEDIUM)    | PASS  | `removeTeam` now clears orphan routes         |

### Section 9 — Multi-team Trade Support

| Row                                    | Before         | After | Evidence                                       |
| -------------------------------------- | -------------- | ----- | ---------------------------------------------- |
| No asset in/out same team (multi-team) | PARTIAL (HIGH) | PASS  | `incomingAssets` + validator enforce `tradeTo` |

### Completed Section Audits

- Section 2: `⚠️ PARTIAL (2 MEDIUM)` → `✅ PASS (TM_FIX_A5_E1)`
- Section 9: `⚠️ PARTIAL (1 HIGH)` → `✅ PASS (TM_FIX_A5_E1)`

---

## STOP CONDITIONS MET

- ✅ Multi-team player routing is explicit (no broadcast)
- ✅ Validator blocks missing/invalid tradeTo + duplicates
- ✅ removeTeam cleans orphan routes
- ✅ Workbook rows updated to PASS with evidence

---

## Next Steps Recommended

None required from this fix scope. All A5 gaps closed.

Optional future enhancements:

- UI guard to prevent selecting player already in another team's sends (nice-to-have, already blocked at validation)
- Visual indicator when `tradeTo` needs to be set in 3+ team trade

---

**End of Return Package**
