# Current Firestore Schema Reference

## Migration Status Overview
- 🟢 **`players_v2`**: Migration COMPLETE (current = target)
- 🟡 **`teams`**: Migration IN PROGRESS (current → `/architect/` collections)

---

## Active Collections (Production)

### `/players_v2/{playerId}` - Player Data ✅ FINAL
**Status**: ✅ Migration complete - this is the target schema
**Usage**: All player queries should use this collection

**Structure**: Hierarchical with subcollections
- `bio.*` - Player biographical information
- `/contracts/{contractId}` - Contract subcollection  
- `/seasons/{seasonId}` - Season stats subcollection
- `/evaluations/{evaluationId}` - Player grades subcollection

### `/teams/{teamId}` - Team Rosters 🚧 MIGRATING → `/architect/`
**Status**: 🚧 Currently in migration to `/architect/` collections - see migration docs for target schema
**Current Structure**: 
- `capSheet.players[]` - Array with flattened player objects + `contract_clean`
- `capSheet.lastUpdated` - Timestamp

**⚠️ IMPORTANT**: This collection is being migrated to `/architect/` collections. For target schema, see:
`docs/architect-teams-plan/03-TARGET-SCHEMA.md`

---

## Developer Guidelines

### For `/players_v2` (Use Normally)
```javascript
// This is stable - use for all player queries
const playersRef = collection(db, 'players_v2');
const player = await getDoc(doc(db, 'players_v2', playerId));
```

### For `/teams` (Migration Context)
```javascript
// CURRENT (what exists now):
const team = await getDoc(doc(db, 'teams', teamId));
const players = team.data().capSheet.players; // Flattened structure

// TARGET (what we're migrating to - /architect/ collections):
// See docs/architect-teams-plan/ for complete target architecture
```

---

## Migration Context
- **Completed**: `players` → `players_v2` (use `docs/migrations/players-v1-to-v2/`)
- **In Progress**: `teams` → `/architect/` collections (use `docs/architect-teams-plan/`)

---
*Current as of: ${new Date().toISOString()}*
*🚧 = In Migration | ✅ = Migration Complete*