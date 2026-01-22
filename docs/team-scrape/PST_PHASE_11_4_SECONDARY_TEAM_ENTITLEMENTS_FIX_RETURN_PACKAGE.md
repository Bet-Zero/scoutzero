# PST_PHASE_11_4_SECONDARY_TEAM_ENTITLEMENTS_FIX_RETURN_PACKAGE.md

**Phase**: 11.4 — Secondary Team Entitlements Load Fix  
**Status**: COMPLETE  
**Date**: 2026-01-22

---

## 1. Root Cause (Summary)

The `selectTeam()` callback in `useTradeMachine.js` (used when selecting teams from the dropdown for slots 1+) built the team object but **never called `resolveEntitlementsForTeam()`** to load entitlements. The entitlement resolution logic existed only in the `useEffect` that initializes slot 0 (the primary team passed as a prop).

This meant:

- Slot 0: Entitlements loaded ✓ → "Draft Assets (Entitlements)" UI mode
- Slots 1+: Entitlements never loaded ✗ → "Outgoing Picks" UI mode (legacy fallback)

The UI correctly gated on `team.entitlements?.length > 0`, but since `selectTeam()` never populated `teamObj.entitlements`, secondary teams always fell through to legacy picks.

---

## 2. Files Changed

| File Path                                         | Summary                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/features/architect/hooks/useTradeMachine.js` | Added `resolveTeamCodeLike()` helper, `DEBUG_ENT` flag, and entitlement resolution to `selectTeam()` for secondary teams |

---

## 3. Before/After Behavior

### Before

| Scenario                   | Slot 0 (Primary)                    | Slots 1+ (Secondary)              |
| -------------------------- | ----------------------------------- | --------------------------------- |
| Enter Trade Machine as LAL | Shows "Draft Assets (Entitlements)" | -                                 |
| Add PHI as Team 2          | -                                   | Shows "Outgoing Picks" (legacy) ✗ |
| Add HOU as Team 3          | -                                   | Shows "Outgoing Picks" (legacy) ✗ |
| Switch PHI → BOS           | -                                   | Shows "Outgoing Picks" (legacy) ✗ |

### After

| Scenario                   | Slot 0 (Primary)                      | Slots 1+ (Secondary)                  |
| -------------------------- | ------------------------------------- | ------------------------------------- |
| Enter Trade Machine as LAL | Shows "Draft Assets (Entitlements)" ✓ | -                                     |
| Add PHI as Team 2          | -                                     | Shows "Draft Assets (Entitlements)" ✓ |
| Add HOU as Team 3          | -                                     | Shows "Draft Assets (Entitlements)" ✓ |
| Switch PHI → BOS           | -                                     | Shows "Draft Assets (Entitlements)" ✓ |

---

## 4. Implementation Details

### A. `resolveTeamCodeLike()` Helper (NEW)

Reliably extracts a 3-letter team code from various object shapes:

```javascript
function resolveTeamCodeLike(teamObjOrId, teamDataMaybe = null) {
  // Priority order:
  // 1. teamData.teamCode
  // 2. teamData.id (if 3 chars)
  // 3. teamObjOrId (if string, 3 chars)
  // 4. teamObjOrId.code (if 3 chars)
  // 5. teamObjOrId.abbreviation (if 3 chars)
  // 6. teamObjOrId.id (if 3 chars)
  // 7. teamData.team?.id (if 3 chars)
  // 8. null (with warning if DEBUG_ENT enabled)
}
```

### B. Debug Logging (OPTIONAL)

Set `VITE_DEBUG_ENTITLEMENTS=true` in environment to enable:

```
[DEBUG_ENT] init slot 0: { slotIndex: 0, teamCode: "LAL", worldId: "...", hasEntitlementIds: true }
[DEBUG_ENT] init slot 0 resolved: { teamCode: "LAL", entitlementsCount: 12, usingLegacyFallback: false }
[DEBUG_ENT] selectTeam slot: { slotIndex: 1, teamId: "PHI", teamCode: "PHI", ... }
[DEBUG_ENT] selectTeam resolved: { slotIndex: 1, teamCode: "PHI", entitlementsCount: 10, ... }
```

### C. Entitlement Resolution in `selectTeam()` (NEW)

Added the same entitlement resolution logic that existed for slot 0:

```javascript
// Phase 11.4: Load entitlements for secondary teams (slots 1+)
if (worldId || (data.entitlementIds && data.entitlementIds.length)) {
  const resolvedTeamCode = resolveTeamCodeLike(baseTeam, data);
  if (resolvedTeamCode) {
    const entitlements = await resolveEntitlementsForTeam(
      worldId,
      resolvedTeamCode
    );
    teamObj.entitlements = entitlements;
  }
}
```

---

## 5. Validation Steps & Results

| Step | Command/Action                              | Result                                                            |
| ---- | ------------------------------------------- | ----------------------------------------------------------------- |
| 1    | `npm run build`                             | ✅ Pass (59.60s, warnings only for chunk size and dynamic import) |
| 2    | Enter Trade Machine as LAL                  | ✅ Shows "Draft Assets (Entitlements)"                            |
| 3    | Add PHI as Team 2                           | ✅ Shows "Draft Assets (Entitlements)" (not "Outgoing Picks")     |
| 4    | Add HOU as Team 3                           | ✅ Shows "Draft Assets (Entitlements)"                            |
| 5    | Switch PHI → BOS                            | ✅ BOS entitlements load immediately                              |
| 6    | Legacy fallback (team with no entitlements) | ✅ Falls back to "Outgoing Picks" correctly                       |

---

## 6. Acceptance Criteria

| Criteria                                                         | Status                             |
| ---------------------------------------------------------------- | ---------------------------------- |
| AC-1: Slot 0 and slots 1+ all load entitlements when team exists | ✅                                 |
| AC-2: Secondary teams show "Draft Assets (Entitlements)" header  | ✅                                 |
| AC-3: Team switching reloads entitlements correctly              | ✅                                 |
| AC-4: World switching reloads entitlements correctly             | ✅ (covered by worldId dependency) |
| AC-5: `npm run build` passes                                     | ✅                                 |
| AC-6: No regression to legacy picks trading behavior             | ✅                                 |

---

## 7. Follow-ups (None Critical)

- **OPTIONAL**: Consider extracting the entitlement resolution logic into a shared helper to reduce duplication between `init()` and `selectTeam()`
- **OPTIONAL**: Add integration test for secondary team entitlement loading
