# TM_SEC_A5 — Session State Coherence + Multi-Team Audit

**Audit Date:** 2026-02-14  
**Pass Type:** PREFLIGHT (Discovery Only)  
**Master Checklist:** `docs/architect/TRADE_MACHINE_MASTER_CHECKLIST_V1.md`  
**Sections Audited:** 2 (Trade Session State + UI Plumbing) and 9 (Multi-team Trade Support)  
**Related Workbook:** `docs/architect/audits/TM_AUDIT_WORKBOOK.md`

---

## 1. Scope Summary

This audit examines:

- Trade session state ownership and management
- Asset uniqueness enforcement (duplicates)
- Team removal cleanup behavior
- Multi-team (3+) routing invariants
- Derived value storage and potential drift

---

## 2. State Owner Mapping

**Primary State Owner:** [useTradeMachine.js](../../../src/features/architect/hooks/useTradeMachine.js)

### Core State Variables

| Variable       | Type                                      | Purpose               |
| -------------- | ----------------------------------------- | --------------------- |
| `teams`        | `Array<{ team, sends, entitlementsOut }>` | Main trade slot array |
| `result`       | `ValidationResult \| null`                | Validation outcome    |
| `forceTrade`   | `boolean`                                 | Dev override flag     |
| `isValidating` | `boolean`                                 | In-flight state       |
| `initError`    | `string \| null`                          | Init failure message  |

### Derived State (useMemo)

| Derived                | Source                      | Purpose                                  |
| ---------------------- | --------------------------- | ---------------------------------------- |
| `incomingAssets`       | `teams`, `activeTeamCount`  | Per-team incoming players/entitlements   |
| `salaryOut`            | `teams`, `yearKey`          | Per-team outgoing salary                 |
| `activeTeamCount`      | `teams`                     | Count of teams with selected team object |
| `currentDraftKey`      | `yearKey`, `teams`          | Stale validation detection               |
| `hasCurrentValidation` | `result`, `currentDraftKey` | Validation freshness check               |

### Key Mutators

| Function                    | Purpose                           | Cross-Team Impact                     |
| --------------------------- | --------------------------------- | ------------------------------------- |
| `setPlayerTrade`            | Add/remove/modify player in sends | NO cross-team duplicate check         |
| `toggleEntitlement`         | Add/remove entitlement            | Auto-sets toTeamId for 2-team         |
| `setEntitlementDestination` | Set toTeamId for 3+ teams         | Per-entitlement routing               |
| `selectTeam`                | Set team for slot                 | Resets sends/entitlementsOut for slot |
| `addTeam`                   | Add empty slot                    | Max 5 teams enforced                  |
| `removeTeam`                | Remove slot by index              | **NO cleanup of routed assets**       |
| `resetTrade`                | Clear sends/entitlementsOut       | Keeps team selections                 |
| `undoPlayerTrade`           | Remove player from all sends      | Cross-team removal                    |

---

## 3. Asset Uniqueness Analysis

### 3.1 Player Uniqueness

**UI Prevention:** PARTIAL

- [TradeTeamCard.jsx](../../../src/features/architect/tradeMachine/TradeTeamCard.jsx):L119-123 filters `availablePlayers` to exclude players in current team's `sends`
- **Gap:** No cross-team check. A player could theoretically appear in multiple teams' sends if data inconsistency allowed it.

**Validator Prevention:** NOT PRESENT

- [tradeValidator.js](../../../src/features/architect/utils/tradeMachine/engine/tradeValidator.js) has **no** `validatePlayerRouting` equivalent
- No check for same player in multiple teams' sends

**Persistence Prevention:** YES

- [leagueInvariants.ts](../../../src/features/architect/utils/leagueInvariants.ts):L95-140 `validateNoDuplicatePlayers()` prevents duplicate players at mutation time
- This is a **post-validation** guardrail, not real-time prevention

**Risk Assessment:** MEDIUM

- Practical risk is low (players exist on one roster)
- Theoretical gap exists if data is inconsistent

### 3.2 Entitlement Uniqueness

**UI Prevention:** NO

- `toggleEntitlement` does not check if entitlement is already selected by another team

**Validator Prevention:** YES ✓

- [validateEntitlementRouting.js](../../../src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js):L99-105
- Uses `seenEntitlementIds` Map to track duplicates
- Returns error: "same asset cannot be traded by multiple teams"

**Risk Assessment:** LOW

- Validator catches duplicates before trade can be applied

---

## 4. Team Removal Cleanup Analysis

**Current Behavior:**

```javascript
// useTradeMachine.js:L812-814
const removeTeam = useCallback((index) => {
  setTeams((prev) => prev.filter((_, i) => i !== index));
}, []);
```

**Cleanup Performed:** NONE

**Issues Identified:**

1. **Orphaned Route Targets**
   - Entitlements with `toTeamId` pointing to removed team stay unchanged
   - Players with `tradeTo` pointing to removed team stay unchanged

2. **Validator Catches Orphans**
   - validateEntitlementRouting.js:L117-121 catches invalid destinations:
     - `"Entitlement from X has invalid destination Y — not a team in this trade"`
   - This is validation-time detection, not proactive cleanup

3. **UX Impact**
   - Stale selections visible until re-validation
   - User must manually update routing after team removal

**Risk Assessment:** MEDIUM

- Data integrity protected by validator
- UX could show stale/invalid state temporarily

---

## 5. Multi-Team Routing Invariants

### 5.1 Entitlement Routing (3+ Teams)

**Enforcement:** YES ✓

| Check             | Location                               | Behavior                              |
| ----------------- | -------------------------------------- | ------------------------------------- |
| toTeamId required | validateEntitlementRouting.js:L111-115 | Error if missing in 3+ team trade     |
| Destination valid | validateEntitlementRouting.js:L117-121 | Error if team not in trade            |
| No self-routing   | validateEntitlementRouting.js:L123-127 | Error if toTeamId === fromTeamId      |
| Ownership check   | validateEntitlementRouting.js:L129-133 | Error if team doesn't own entitlement |

**incomingAssets Derivation:**

- [useTradeMachine.js](../../../src/features/architect/hooks/useTradeMachine.js):L278-288
- For 3+ teams, only includes entitlements where `e.toTeamId === tm.team?.id`
- Broadcast fallback disabled for 3+ teams

### 5.2 Player Routing (3+ Teams)

**Enforcement:** NOT IMPLEMENTED

**Current Behavior:**

```javascript
// useTradeMachine.js:L271-273
t.sends.forEach((p) => {
  if (!p.tradeTo || p.tradeTo === tm.team?.id) {
    players.push({ ...p, fromTeamId: t.team.id });
  }
});
```

**Issues:**

1. **Broadcast fallback still active** for players in 3+ team trades
2. **No `tradeTo` requirement** enforced for players
3. **No validation** for player routing correctness

**Risk Assessment:** HIGH

- Player could be "received" by unintended teams in 3+ team trade
- No validator catches this gap
- Silent broadcast behavior may mislead users

---

## 6. Derived Value Drift Analysis

| Derived Value     | Storage               | Drift Risk                                                  |
| ----------------- | --------------------- | ----------------------------------------------------------- |
| `incomingAssets`  | useMemo               | LOW - Recomputes on teams/activeTeamCount change            |
| `salaryOut`       | useMemo               | LOW - Recomputes on teams/yearKey change                    |
| `activeTeamCount` | useMemo               | LOW - Recomputes on teams change                            |
| `projectedSalary` | In validator only     | LOW - Not stored in component state                         |
| `teamTotalSalary` | Stored on team object | MEDIUM - Set at init/select, could drift if team data stale |

**Key Finding:** Derived values use React useMemo pattern correctly. No separate stored values that could drift from source.

---

## 7. Scenario Analysis

### Scenario 1: 3-Team Trade (LAL ↔ BOS ↔ PHI)

1. LAL sends Player A → BOS
2. BOS sends Entitlement X → PHI
3. PHI sends Player B → LAL

**Player Routing:**

- `tradeTo` must be set explicitly
- Without explicit tradeTo, Player A "broadcasts" to both BOS and PHI (bug!)

**Entitlement Routing:**

- `toTeamId` required and validated ✓
- Correctly routes X to PHI only

### Scenario 2: Duplicate Selection Attempt

1. LAL adds Entitlement X to trade
2. BOS also attempts to add Entitlement X

**Behavior:**

- UI allows both selections (no prevention)
- Validation returns error at validation time ✓

### Scenario 3: Remove Middle Team

1. Setup: LAL → BOS → PHI (3-team)
2. LAL routes pick to BOS
3. Remove BOS from trade

**Behavior:**

- Pick stays in LAL's entitlementsOut with toTeamId="BOS"
- UI shows stale selection
- Validation returns "invalid destination" error ✓

---

## 8. Files Referenced

1. `src/features/architect/hooks/useTradeMachine.js` - State owner
2. `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` - Entitlement validation
3. `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` - Trade validator
4. `src/features/architect/tradeMachine/TradeTeamCard.jsx` - Team card UI
5. `src/features/architect/tradeMachine/TradeEditor.jsx` - Trade editor UI
6. `src/features/architect/utils/leagueInvariants.ts` - League-wide validation

---

## 9. Summary of Findings

| Finding ID | Severity | Category               | Description                                                          |
| ---------- | -------- | ---------------------- | -------------------------------------------------------------------- |
| A5-F1      | MEDIUM   | Player Uniqueness      | No cross-team player duplicate check in UI or validator              |
| A5-F2      | MEDIUM   | Team Removal           | removeTeam does not clean up orphaned route targets                  |
| A5-F3      | HIGH     | Player Routing         | Player routing broadcasts in 3+ team trades (no tradeTo requirement) |
| A5-F4      | LOW      | Entitlement Uniqueness | UI allows duplicate selection; validator catches                     |
| A5-F5      | LOW      | Derived Values         | useMemo pattern prevents drift; no stored derived values             |

---

## 10. Recommendations

### A5-R1: Add Player Routing Validation (HIGH)

Create `validatePlayerRouting.js` to enforce:

- `tradeTo` required in 3+ team trades
- `tradeTo` must be valid team in trade
- No self-routing
- No duplicate player across teams' sends

### A5-R2: Team Removal Cleanup (MEDIUM)

Update `removeTeam` to:

- Clear `toTeamId`/`tradeTo` referencing removed team
- OR warn user about orphaned routes

### A5-R3: Cross-Team Player UI Check (LOW)

Update TradeTeamCard to disable players already in other teams' sends (low priority - data integrity prevents this in practice)
