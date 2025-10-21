# Summary: 02-CURRENT-STATUS.md

## Purpose
Documents the existing Architect feature implementation and current data structure to inform the upgrade path.

## Key Points

### Existing Architect Feature
- **Main Entry**: `/src/pages/GMDashboard.jsx`
- **Utils**: `/src/utils/architect/`
- **Current Capabilities**: Cap Sheet, Trade Machine, Cap Sheet Full
- **Existing Save/Load**: Basic `saveUserTeamPlan()` and `loadUserTeamPlan()` functions, but no multi-season support, branching, or immutable baseline separation

### Current Data Collections
- **`/players_v2`**: Player scouting data (~530 documents) - immutable, unrelated to Architect, will NOT be modified
- **`/teams`**: Basic team information - read-only immutable, NOT part of Architect
- Legacy top-level `Teams` (Architect v1) is deprecated and will be deleted after cutover

### What's Being Added
```
/architect/                         # NEW: Architect-only data
  baseTeams/{teamId}               # immutable baseline teams
  basePlayers/{playerId}           # immutable baseline player contracts
  worlds/{worldId}/metadata
  worlds/{worldId}/snapshot/teams/{teamId}
  worlds/{worldId}/snapshot/teams/{teamId}/players/{playerId}  # optional
```

### Current Player Contract Schema Issues
1. **Year format**: Uses single year (2026) instead of season format ("2026-27")
2. **Missing CBA fields**:
   - `yearsOfService` (needed for extension rules)
   - `isRookieScale` (needed for poison pill logic)
   - `capHitByYear` (cap hit differs from salary with incentives)
   - `tradeBonus` per-year breakdown

### Existing Cap Calculation Logic
- Likely exists in `/src/utils/architect/tradeMachine/` or `/src/utils/architect/capUtils.js`
- Needs updates to:
  - Read from new `/architect/baseTeams` and `/architect/basePlayers` collections
  - Support world-based data loading
  - Add multi-season calculation support

### Known Gaps
**Not Currently Implemented:**
- Multi-season support
- Branching/forking scenarios
- Immutable baseline separation
- World metadata tracking
- Action history/audit trail
- Optimized read performance with snapshots

**Partial Implementation:**
- Basic team plan saving (exists but needs upgrade)
- Trade validation (exists but may need CBA accuracy improvements)
- Cap calculations (exists but needs multi-season support)

### Migration Strategy
- **Clean slate approach**: Start fresh rather than migrate existing data
- **Not migrating**: Old team plans, previous player contract data, historical scenarios
- **Preserving**: Player scouting data in `/players_v2`, existing UI components, cap calculation logic

## Action Items
- Confirm understanding of current system before implementation
- Extend existing cap calculation logic for new structure
- Upgrade existing Architect features to use new `/architect` collections
