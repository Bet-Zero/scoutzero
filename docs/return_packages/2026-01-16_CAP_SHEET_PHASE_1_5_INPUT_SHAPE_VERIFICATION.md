# CAP SHEET — PHASE 1.5 VERIFICATION (INPUT SHAPE + CALLSITE TRACE)

## 1. Required Input Shape for `computeTeamCapTotals`

Based on source code analysis of `src/features/architect/utils/capTotals/computeTeamCapTotals.js`:

| Field Name | Type | Requirement | Usage Note |
| :--- | :--- | :--- | :--- |
| `players` | `Array` | **Required** | Iterated to sum salary/cap hits. |
| `capHolds` | `Array` | **Required** | Iterated to sum active unsigned cap holds. |
| `waivedContracts` | `Array` | Required* | Scanned for dead money. Treated as empty if missing. |
| `stretchHistory` | `Array` | Required* | Scanned for dead money. Treated as empty if missing. |
| `deadMoney` | `Object` | Required* | Flat object (year -> amount) for dead money overrides. Treated as 0 if missing. |

*> *While technically optional (code handles missing values gracefully), they are **semantically required** for correct Total Cap Allocations. If missing, Dead Money will calculate as 0.*

---

## 2. Cap Sheet Input Trace

| Step | Component / File | Logic / Variable |
| :--- | :--- | :--- |
| **Consumer** | `CapSheet.jsx` | Receives `teamCapSheet` prop. calls `computeTeamCapTotals(teamCapSheet, ...)` |
| **Parent** | `CapSheetSection.jsx` | Passes `teamCapSheet` prop. |
| **Parent** | `GMDashboard.jsx` | Gets `teamCapSheet` from `useArchitectState`. |
| **Hook** | `useArchitectState.ts` | Calls `loadWorldTeamData(worldId, teamId)`. Sets `teamCapSheet`. |
| **Loader** | `worldTeamData.ts` | Calls `getTeam` or `loadTeamCapSheet`. Both flow to `hydrateBaseTeam`. |
| **Hydrator** | `firebaseTeamPlanHelpers.js` | `hydrateBaseTeam`. **RETURNS:** `players`, `capHolds`, `deadCap`, `baseline`, `totals`. |

**Trace Result:** **MISMATCH**.
The `hydrateBaseTeam` function returns `deadCap` but **DOES NOT** return `waivedContracts`, `stretchHistory`, or `deadMoney` as top-level properties.

* `teamCapSheet.waivedContracts` is `undefined`.
* `teamCapSheet.stretchHistory` is `undefined`.
* `teamCapSheet.deadMoney` is `undefined`.

---

## 3. TradeTeamCard Input Trace

| Step | Component / File | Logic / Variable |
| :--- | :--- | :--- |
| **Consumer** | `TradeTeamCard.jsx` | Receives `team` prop. Calls `computeTeamCapTotals(team, ...)` |
| **Parent** | `TradeEditor.jsx` | Maps `teams` state to `TradeTeamCard`. |
| **Hook** | `useTradeMachine.js` | Initializes `teams`. Calls `loadWorldTeamData`. |
| **Construction**| `useTradeMachine.js` | `teamObj = { ...baseTeam, ...data }`. `data` comes from `loadWorldTeamData`. |
| **Loader** | `worldTeamData.ts` | Calls `hydrateBaseTeam`. |
| **Hydrator** | `firebaseTeamPlanHelpers.js` | `hydrateBaseTeam`. **RETURNS:** `players`, `capHolds`, `deadCap`, `baseline`, `totals`. |

**Trace Result:** **MISMATCH**.
The `team` object passed to `TradeTeamCard` has the same shape as Cap Sheet (derived from `hydrateBaseTeam`). It lacks the top-level dead money fields required by `computeTeamCapTotals`.

---

## 4. Alignment Conclusion

**STATUS: ALIGNED (BUT DEFICIENT)**

Both the Cap Sheet and Trade Machine (TradeTeamCard) use the **exact same data pipeline** (`loadWorldTeamData` → `hydrateBaseTeam`). Therefore, they are **aligned** in terms of input shape.

**HOWEVER,** both are **deficient** because the input shape provided by `hydrateBaseTeam` does NOT match the shape expected by `computeTeamCapTotals` for Dead Money calculations.

* **Expected:** `waivedContracts`, `stretchHistory`, `deadMoney`
* **Provided:** `deadCap` (and `baseline` containing raw data)

This means `computeTeamCapTotals` is likely returning `deadMoneyTotal: 0` for both features, unless the raw fields happen to be attached to `baseTeam` (unlikely) or valid dead money is zero.

### Recommended Fix (Doc-Only)

1. **Refactor `hydrateBaseTeam`** (in `firebaseTeamPlanHelpers.js`):
    * Ensure `waivedContracts`, `stretchHistory`, and `deadMoney` are extracted from `baseDoc` (or `baseDoc.deadCap` if that's the new schema) and returned at the top level of the team object.
    * *Example:*

        ```javascript
        return {
           ...
           waivedContracts: baseDoc.waivedContracts || [],
           stretchHistory: baseDoc.stretchHistory || [],
           deadMoney: baseDoc.deadMoney || {},
           ...
        }
        ```

2. **Verify `computeTeamCapTotals`**:
    * Confirm if the `deadCap` array returned by current hydrator is intended to replace the old fields. If so, update `computeTeamCapTotals` to read from `deadCap`.
