# SCOUTING PLAYER TABLE — Phase 2F EXECUTION RETURN PACKAGE

## Fix Broken Sort Keys + Dynamic YearsRemaining + Badge Guard

**Date:** 2026-01-30
**Mode:** EXECUTION (Code Changes Applied)
**Master Doc:** `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md`
**Preflight:** `docs/return_packages/scouting/SCOUTING_PLAYER_TABLE_PHASE_2F_PREFLIGHT_FILTER_SORT_CORRECTNESS_AUDIT.md`

---

## 1. EXECUTIVE SUMMARY

This execution phase fixed 4 HIGH-severity bugs and 1 MEDIUM-severity issue identified in the Phase 2F preflight audit:

| Bug ID  | Severity | Issue                                      | Status   |
| ------- | -------- | ------------------------------------------ | -------- |
| BUG-001 | HIGH     | Sort by TRB used wrong field name          | ✅ FIXED |
| BUG-002 | HIGH     | Sort by MP (Minutes) used wrong field name | ✅ FIXED |
| BUG-003 | HIGH     | Sort by 3P% used wrong field name          | ✅ FIXED |
| BUG-004 | HIGH     | Years Remaining hardcoded to 2024          | ✅ FIXED |
| BUG-005 | MEDIUM   | Badge filter assumed `p.badges` is array   | ✅ FIXED |

---

## 2. FILES CHANGED

| File                                                                      | Change Type | Description                                                                  |
| ------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx` | Modified    | Fixed 3 sort option values (TRB→REB, MP→MIN, 3P%→3PT%)                       |
| `src/shared/utils/filtering/playerFilterUtils.js`                         | Modified    | Added CURRENT_YEAR constant, updated yearsRemaining calc, added badges guard |

---

## 3. KEY DIFFS

### ViewControls.jsx — Sort Option Value Fixes

**Before:**

```jsx
<option value="TRB">TRB</option>
<option value="3P%">3P%</option>
<option value="MP">Minutes</option>
```

**After:**

```jsx
<option value="REB">TRB</option>
<option value="3PT%">3P%</option>
<option value="MIN">Minutes</option>
```

**Note:** Labels remain the same (TRB, 3P%, Minutes) for user familiarity; only the `value=` attribute changed to match actual data field names.

---

### playerFilterUtils.js — CURRENT_YEAR Constant Added

**Added at module scope (after line 22):**

```javascript
// Dynamic current year for yearsRemaining calculation (computed once at module load)
const CURRENT_YEAR = new Date().getFullYear();
```

---

### playerFilterUtils.js — yearsRemaining Calculation Fix

**Before (line 323):**

```javascript
return !isNaN(parsed) ? parsed - 2024 : -1;
```

**After:**

```javascript
return !isNaN(parsed) ? parsed - CURRENT_YEAR : -1;
```

---

### playerFilterUtils.js — Badge Filter Guard

**Before (line 190):**

```javascript
!filters.badges.every((b) => p.badges.includes(b));
```

**After:**

```javascript
!filters.badges.every((b) => (p.badges || []).includes(b));
```

---

## 4. VALIDATION RESULTS

### Build Verification

```
$ npm run build

vite v4.5.14 building for production...
✓ 2953 modules transformed.
✓ built in 33.70s
```

**Result:** ✅ PASS

---

### Manual Verification Checklist

| #   | Test                                   | Expected                                         | Result                                                     |
| --- | -------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| 1   | Sort by REB (formerly TRB) descending  | Top players have high rebound numbers            | ✅ PASS — Order changes visibly, top players show high REB |
| 2   | Sort by REB 3x consecutively           | Same order each time                             | ✅ PASS — Stable, deterministic                            |
| 3   | Sort by MIN (formerly MP) descending   | Top players have high minutes                    | ✅ PASS — Order changes visibly, top players show high MIN |
| 4   | Sort by MIN 3x consecutively           | Same order each time                             | ✅ PASS — Stable, deterministic                            |
| 5   | Sort by 3PT% (formerly 3P%) descending | Top players have high 3PT%                       | ✅ PASS — Order changes visibly                            |
| 6   | Sort by 3PT% 3x consecutively          | Same order each time                             | ✅ PASS — Stable, deterministic                            |
| 7   | Sort by Years Remaining                | FA 2027 = 1 year, FA 2026 = 0 years (as of 2026) | ✅ PASS — Calculation now uses current year                |
| 8   | Apply badge filter                     | No console errors, results filter down           | ✅ PASS — No errors, filter works                          |

---

### Years Remaining Sanity Check

| Player FA Year | Expected Years Remaining (2026) | Observed |
| -------------- | ------------------------------- | -------- |
| 2027           | 1                               | ✅ 1     |
| 2028           | 2                               | ✅ 2     |
| 2026           | 0                               | ✅ 0     |
| 2029           | 3                               | ✅ 3     |

---

## 5. REMAINING OPEN RISKS FROM PREFLIGHT

| Bug ID   | Severity | Issue                                                | Status                                        |
| -------- | -------- | ---------------------------------------------------- | --------------------------------------------- |
| BUG-006  | MEDIUM   | Percentage stat double-scaling risk                  | NOT FIXED — Requires data format verification |
| BUG-007  | MEDIUM   | Salary filter excludes players without data          | NOT FIXED — Design decision required          |
| EDGE-001 | LOW      | Free Agent Type case-sensitive                       | NOT FIXED — Low impact                        |
| EDGE-002 | LOW      | Shooting Profile case-sensitive                      | NOT FIXED — Low impact                        |
| EDGE-003 | LOW      | SubRoles assumes array on player                     | NOT FIXED — `enrichPlayerData` normalizes     |
| EDGE-004 | LOW      | Traits default to 0 (indistinguishable from missing) | NOT FIXED — May be intentional                |
| EDGE-005 | LOW      | Position filter with unknown group returns empty     | NOT FIXED — UI prevents this                  |

**Recommendation:** BUG-006 and BUG-007 should be investigated in a future phase if filter behavior is reported as incorrect.

---

## 6. ACCEPTANCE CRITERIA STATUS

| Criteria                           | Status          |
| ---------------------------------- | --------------- |
| Sort by REB (TRB) works correctly  | ✅              |
| Sort by MIN (MP) works correctly   | ✅              |
| Sort by 3PT% (3P%) works correctly | ✅              |
| Years Remaining uses dynamic year  | ✅              |
| Badge filter has defensive guard   | ✅              |
| Build passes                       | ✅              |
| Manual verification complete       | ✅              |
| Return package created             | ✅              |
| Master doc updated                 | ⏳ (to be done) |

---

## 7. RELATED DOCUMENTS

- **Preflight Audit:** [SCOUTING_PLAYER_TABLE_PHASE_2F_PREFLIGHT_FILTER_SORT_CORRECTNESS_AUDIT.md](./SCOUTING_PLAYER_TABLE_PHASE_2F_PREFLIGHT_FILTER_SORT_CORRECTNESS_AUDIT.md)
- **Master Audit:** [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

**END OF PHASE 2F EXECUTION RETURN PACKAGE**
