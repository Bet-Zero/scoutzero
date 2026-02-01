# PST_PHASE_12_3B_PICK_RULES_RUNTIME_WIRING_RETURN_PACKAGE.md

**Phase**: 12.3B — Runtime Pick Rules Fetch + UI Wiring
**Status**: COMPLETE
**Date**: 2026-01-31
**Master Doc**: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md

---

## 1. Summary

Phase 12.3B wires the runtime infrastructure so entitlements display protection/conditions from the structured Firestore `architect_basePickRules` collection instead of parsing from `entitlement.description`.

### What Was Built

1. **Runtime Fetching**: Pick rules are fetched when entitlements load for each team slot
2. **Feature Flag**: `VITE_ENABLE_PICK_RULES` controls fetching (default: enabled)
3. **Component Wiring**: `pickRulesById` flows through the entire Trade Machine component tree
4. **Merged Rules**: ValidationDetailsPanel receives merged rules from all trade teams
5. **Tests**: 5 new unit tests verify pickRulesById integration

---

## 2. Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `src/features/architect/hooks/useTradeMachine.js` | **MODIFIED** | Added imports, helper functions, runtime fetching, feature flag |
| `src/features/architect/tradeMachine/EntitlementPicksList.jsx` | **MODIFIED** | Accept and pass `pickRulesById` prop |
| `src/features/architect/tradeMachine/EntitlementPickRow.jsx` | **MODIFIED** | Accept `pickRulesById`, pass to projection |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` | **MODIFIED** | Accept `pickRulesById`, use in projection call |
| `src/features/architect/tradeMachine/TradeReceiptPanel.jsx` | **MODIFIED** | Accept `pickRulesById`, use in both projection calls |
| `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx` | **MODIFIED** | Accept and pass `pickRulesById` to child panels |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | **MODIFIED** | Build merged `pickRulesById`, pass to ValidationDetailsPanel |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx` | **MODIFIED** | Pass `pickRulesById` to EntitlementPicksList |
| `tests/entitlements/entitlementPickRowProjection.test.js` | **MODIFIED** | Added 5 new tests for pickRulesById integration |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | **MODIFIED** | Added Phase 12.3B entry and section |

---

## 3. Implementation Details

### Helper Functions Added to useTradeMachine.js

```javascript
/**
 * Extract unique pickIds from entitlements for pick rules lookup.
 */
const extractPickIdsFromEntitlements = (entitlements) => {
  const pickIds = new Set();
  for (const ent of entitlements) {
    if (ent.underlyingPickId) pickIds.add(ent.underlyingPickId);
    if (Array.isArray(ent.poolUnderlyingPickIds)) {
      ent.poolUnderlyingPickIds.forEach((id) => id && pickIds.add(id));
    }
    if (ent.swapControllerPickId) pickIds.add(ent.swapControllerPickId);
  }
  return Array.from(pickIds);
};

/**
 * Resolve pick rules for a team's entitlements.
 */
const resolvePickRulesForEntitlements = async (entitlements) => {
  const pickIds = extractPickIdsFromEntitlements(entitlements);
  if (pickIds.length === 0) return {};
  const rulesMap = await resolvePickRulesByIds(pickIds);
  return pickRulesMapToObject(rulesMap);
};
```

### Feature Flag

```javascript
const ENABLE_PICK_RULES = import.meta?.env?.VITE_ENABLE_PICK_RULES !== 'false';
```

### Pick Rules Fetching Pattern

```javascript
// After entitlements are resolved for a team slot
let pickRulesById = {};
if (ENABLE_PICK_RULES) {
  pickRulesById = await resolvePickRulesForEntitlements(entitlements);
}
teamObj.pickRulesById = pickRulesById;
```

### Merged Rules in TradeEditor

```javascript
const mergedPickRulesById = useMemo(() => {
  const merged = {};
  for (const slot of teams) {
    if (slot?.team?.pickRulesById) {
      Object.assign(merged, slot.team.pickRulesById);
    }
  }
  return merged;
}, [teams]);
```

---

## 4. Component Flow

```
useTradeMachine.js
  └── Fetches pickRulesById for each team slot
      └── stores on teamObj.pickRulesById

TradeEditor.jsx
  ├── Builds mergedPickRulesById from all team slots
  └── Passes to ValidationDetailsPanel

TradeTeamCard.jsx
  └── Passes team.pickRulesById to EntitlementPicksList

EntitlementPicksList.jsx
  └── Passes pickRulesById to EntitlementPickRow

EntitlementPickRow.jsx
  └── Passes pickRulesById to projectEntitlementToPickRow()

ValidationDetailsPanel.jsx
  ├── Passes pickRulesById to TradeSummaryPanel
  └── Passes pickRulesById to TradeReceiptPanel

TradeSummaryPanel.jsx / TradeReceiptPanel.jsx
  └── Pass pickRulesById to projectEntitlementToPickRow()
```

---

## 5. Tests Added

| Test | Description |
|------|-------------|
| `uses structured protection from pick rule when available` | Verifies top_n protection from rules |
| `uses lottery protection from pick rule` | Verifies lottery protection from rules |
| `uses structured conditions from pick rule when available` | Verifies swap_right condition from rules |
| `falls back to description parsing when no pick rule exists` | Verifies fallback for missing rules |
| `falls back to description parsing when pickRulesById is undefined` | Verifies fallback when no rules passed |

---

## 6. Build Output

```
✓ 2967 modules transformed
✓ built in 39.92s

Test Files  1 passed (1)
     Tests  33 passed (33)
```

---

## 7. Verification Steps

### Emulator Verification

1. Start emulator: `npm run emu`
2. Push rules (if needed):

   ```bash
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run pst:push:base-pick-rules
   ```

3. Start app: `npm run dev`
4. Open Trade Machine
5. Select a team with known protected picks
6. Verify:
   - EntitlementPickRow shows structured protection text
   - Validation Summary shows same text
   - Trade Receipt (dev mode) shows same text

### Debug Verification

Enable debug logging:

```bash
VITE_DEBUG_ENTITLEMENTS=true npm run dev
```

Look for console output:

```
[DEBUG_ENT] init slot 0 resolved: { teamCode: 'XXX', entitlementsCount: N, pickRulesCount: M }
```

---

## 8. Acceptance Criteria

- [x] AC1: useTradeMachine loads pickRulesById for slot 0 team
- [x] AC2: useTradeMachine loads pickRulesById for secondary selected teams
- [x] AC3: EntitlementPickRow shows protection/conditions from pick rules (when available)
- [x] AC4: TradeSummaryPanel entitlement rows show rule-derived text (when available)
- [x] AC5: TradeReceiptPanel entitlement rows show rule-derived text (when available)
- [x] AC6: npm run build passes
- [x] AC7: projection tests pass (5 new tests added)

---

## 9. Known Limitations

1. **No caching**: Pick rules are fetched each time entitlements are loaded. Session-level caching could be added in a future phase if performance becomes an issue.

2. **No production push verification**: This phase only verifies emulator. Production push would be handled separately.

3. **Fallback still used**: When no pick rule exists for a given pick, the projection falls back to description parsing. This is intentional for backward compatibility.

---

## 10. Next Steps (Phase 12.3C+)

This phase completes the pick rules wiring. Potential future enhancements:

1. Add session-level caching for pick rules to reduce Firestore reads
2. Push pick rules to production Firestore
3. Add UI indicator showing when rule vs description parsing is used
4. Extend rules to include multi-year protection ladders
