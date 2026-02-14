# TM_SEC_A5 — Session State Coherence + Multi-Team Return Package

**Task ID:** TM_SEC_A5  
**Mode:** PREFLIGHT (Discovery Only)  
**Date:** 2026-02-14  
**Master Checklist:** `docs/architect/TRADE_MACHINE_MASTER_CHECKLIST_V1.md`

---

## Deliverables

| Deliverable     | Path                                                            | Status       |
| --------------- | --------------------------------------------------------------- | ------------ |
| Section Doc     | `docs/architect/audits/TM_SEC_A5_STATE_COHERENCE_MULTI_TEAM.md` | ✅ CREATED   |
| Workbook Update | `docs/architect/audits/TM_AUDIT_WORKBOOK.md` (Sections 2 & 9)   | ✅ UPDATED   |
| Return Package  | `return_packages/trade_machine/TM_SEC_A5_RETURN_PACKAGE.md`     | ✅ THIS FILE |

---

## Files Referenced (6 of 12 max)

1. `src/features/architect/hooks/useTradeMachine.js` — State owner
2. `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` — Entitlement validation
3. `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` — Trade validator
4. `src/features/architect/tradeMachine/TradeTeamCard.jsx` — Team card UI
5. `src/features/architect/tradeMachine/TradeEditor.jsx` — Trade editor UI
6. `src/features/architect/utils/leagueInvariants.ts` — League-wide validation

---

## Evidence Summary (5 entries, FAIL/HIGH only)

### E1: Player Duplicate Check NOT PRESENT (MEDIUM)

**Location:** `useTradeMachine.js:L454`  
**Finding:** `setPlayerTrade` uses `team.sends.findIndex()` to check ONLY within same team's sends  
**Gap:** No cross-team duplicate check. Validator has no `validatePlayerRouting` equivalent.  
**Context:** TradeTeamCard.jsx:L119-123 filters availablePlayers against same team's sends only.  
**Mitigation:** Data integrity (player exists on one roster) prevents practical occurrence.

### E2: Team Removal No Cleanup (MEDIUM)

**Location:** `useTradeMachine.js:L812-814`  
**Code:**

```javascript
const removeTeam = useCallback((index) => {
  setTeams((prev) => prev.filter((_, i) => i !== index));
}, []);
```

**Finding:** Simply filters by index. Does NOT clean up:

- Entitlements with `toTeamId` pointing to removed team
- Players with `tradeTo` pointing to removed team

**Mitigation:** `validateEntitlementRouting.js:L117-121` catches invalid destinations at validation time.

### E3: Player 3+ Team Broadcast (HIGH)

**Location:** `useTradeMachine.js:L271-273`  
**Code:**

```javascript
t.sends.forEach((p) => {
  if (!p.tradeTo || p.tradeTo === tm.team?.id) {
    players.push({ ...p, fromTeamId: t.team.id });
  }
});
```

**Contrast with Entitlements:** Lines 278-288 enforce `toTeamId` requirement for 3+ teams:

```javascript
const isMultiTeamTrade = activeTeamCount > 2;
if (isMultiTeamTrade) {
  if (e.toTeamId === tm.team?.id) {...}
} else {
  if (!e.toTeamId || e.toTeamId === tm.team?.id) {...}
}
```

**Finding:** Players bypass 3+ team check — broadcast fallback still active.  
**Gap:** No validator catches this. Player could be "received" by unintended teams.  
**Impact:** Silent incorrect behavior in 3+ team trades.

### E4: Entitlement Uniqueness Validated (PASS)

**Location:** `validateEntitlementRouting.js:L99-105`  
**Finding:** Uses `seenEntitlementIds` Map to detect duplicates across teams.  
**Status:** PASS — Validator catches before trade can be applied.

### E5: Derived Values Use useMemo (PASS)

**Location:** `useTradeMachine.js:L263-298`  
**Finding:** All derived values (`incomingAssets`, `salaryOut`, `activeTeamCount`) use useMemo.  
**Status:** PASS — No stored computed values that could drift.

---

## Section 2 Audit Results (Session State)

| Item                                | Status      | Risk   | Notes                            |
| ----------------------------------- | ----------- | ------ | -------------------------------- |
| Add/remove team updates views       | PASS        | LOW    | React state propagation          |
| Add/remove player updates views     | PASS        | LOW    | Single state source              |
| Add/remove pick updates views       | PASS        | LOW    | Entitlements-only                |
| Same asset cannot be selected twice | **PARTIAL** | MEDIUM | Player gap; Entitlements covered |
| Removing team cleans up assets      | **FAIL**    | MEDIUM | No cleanup; validator catches    |
| Derived values drift-free           | PASS        | LOW    | useMemo pattern                  |
| Reset/Clear works                   | PASS        | LOW    | Full reset verified              |
| Undo/redo works                     | PASS        | LOW    | Undo only; cross-team safe       |

---

## Section 9 Audit Results (Multi-Team)

| Item                                | Status      | Risk   | Notes               |
| ----------------------------------- | ----------- | ------ | ------------------- |
| Per-team incoming/outgoing tracking | PASS        | LOW    | Clean isolation     |
| Per-team salary matching            | PASS        | LOW    | Per-team validation |
| Pick routing per team               | PASS        | LOW    | Phase 17 closure    |
| Summary per team                    | PASS        | LOW    | Per-team display    |
| No asset both in/out same team      | **PARTIAL** | MEDIUM | Player 3+ team gap  |

---

## Findings Summary

| ID    | Severity | Category          | Description                               |
| ----- | -------- | ----------------- | ----------------------------------------- |
| A5-F1 | MEDIUM   | Player Uniqueness | No cross-team player duplicate check      |
| A5-F2 | MEDIUM   | Team Removal      | removeTeam does not clean orphaned routes |
| A5-F3 | HIGH     | Player Routing    | Player broadcasts in 3+ team trades       |

---

## Recommended Fixes

### R1: Add validatePlayerRouting (HIGH)

Create `validatePlayerRouting.js` to enforce:

- `tradeTo` required in 3+ team trades
- `tradeTo` must reference valid team in trade
- No self-routing (tradeTo !== fromTeamId)
- No duplicate player across teams' sends

### R2: Team Removal Cleanup (MEDIUM)

Update `removeTeam` callback to:

- Clear `toTeamId` on entitlements pointing to removed team
- Clear `tradeTo` on players pointing to removed team
- OR surface warning to user about orphaned routes

### R3: incomingAssets 3+ Team Player Check (HIGH)

Update incomingAssets derivation (L271-273) to:

```javascript
// Apply same 3+ team logic as entitlements
const isMultiTeamTrade = activeTeamCount > 2;
if (isMultiTeamTrade) {
  if (p.tradeTo === tm.team?.id) {
    players.push({ ...p, fromTeamId: t.team.id });
  }
} else {
  if (!p.tradeTo || p.tradeTo === tm.team?.id) {
    players.push({ ...p, fromTeamId: t.team.id });
  }
}
```

---

## Verification Checklist

- [x] Section 2: All 8 rows filled with Implemented/Validated/Single Source/Risk
- [x] Section 9: All 5 rows filled with Implemented/Validated/Single Source/Risk
- [x] Evidence entries ≤ 25 (5 used)
- [x] Files referenced ≤ 12 (6 used)
- [x] Section doc created
- [x] Workbook updated
- [x] Return package created

---

## Next Steps

1. **Prioritize A5-F3 (HIGH):** Player 3+ team broadcast is silent incorrect behavior
2. Schedule TM_FIX_A5_E1 execution task to implement R1 + R3
3. Consider R2 for UX improvement (lower priority)
