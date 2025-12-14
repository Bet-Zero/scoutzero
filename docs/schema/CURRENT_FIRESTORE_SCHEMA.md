# Current Firestore Schema Reference

## Migration Status Overview

- 🟢 **`players_v2`**: Migration COMPLETE (current = target)
- 🟢 **`architect_basePlayers`**: Migration COMPLETE (active)
- 🟢 **`architect_baseTeams`**: Migration COMPLETE (active)
- 🔴 **`teams`**: Migration COMPLETE - Legacy collection deprecated, use `/architect/` collections

---

## Active Collections (Production)

> Canonical schema sources:
>
> - players_v2: see `docs/schema/players_v2.md` (generated from `src/schemas/players_v2.ts`)
> - architect: see `docs/schema/architect.md` (generated from `src/schemas/architect.ts`)

### `/players_v2/{playerId}` - Player Data ✅ FINAL

**Status**: ✅ Migration complete - this is the target schema
**Usage**: All player queries should use this collection

**Structure**: Hierarchical with subcollections + denormalized views

- `bio.*` - Player biographical information
- `currentContractView` - Denormalized contract view for fast filtering (optional)
- `currentEvaluationView` - Denormalized evaluation view for fast filtering (optional)
- `currentSeasonStats` - Denormalized latest season stats for fast filtering (optional)
- `/contracts/{contractId}` - Contract subcollection
- `/seasons/{seasonId}` - Season stats subcollection
- `/evaluations/{evaluationId}` - Player grades subcollection

**Performance Optimization**: The main document includes denormalized views (`currentContractView`, `currentEvaluationView`, `currentSeasonStats`) to enable fast single-query loading for table views and filtering without needing to load subcollections. These views are kept in sync with their respective subcollections.

### `/architect_baseTeams/{teamCode}` - Team Rosters ✅ FINAL

**Status**: ✅ Migration complete - this is the target schema
**Usage**: All architect/GM mode team queries should use this collection

**Structure**: See `docs/schema/architect.md` for complete schema

### `/architect_basePlayers/{playerId}` - Player Contracts ✅ FINAL

**Status**: ✅ Migration complete - this is the target schema  
**Usage**: All architect/GM mode player contract queries should use this collection

**Structure**: See `docs/schema/architect.md` for complete schema

### `/teams/{teamId}` - Team Rosters 🔴 DEPRECATED

**Status**: 🔴 DEPRECATED - Do not use. Migrated to `/architect/` collections.
**Legacy Structure** (for reference only):

- `capSheet.players[]` - Array with flattened player objects + `contract_clean`
- `capSheet.lastUpdated` - Timestamp

**⚠️ IMPORTANT**: This collection is deprecated and will be deleted. Use `/architect_baseTeams` instead.

---

## Developer Guidelines

### For `/players_v2` (Use Normally)

```javascript
// This is stable - use for all player queries
const playersRef = collection(db, 'players_v2');
const player = await getDoc(doc(db, 'players_v2', playerId));
```

### For `/architect_baseTeams` (Use This)

```javascript
// Use architect collections for GM mode
import { baseTeamRef } from '@/data/firestorePaths';
const team = await getDoc(baseTeamRef(teamCode));
const roster = team.data().roster; // Array of player IDs
```

### For `/teams` (DEPRECATED - Do Not Use)

```javascript
// ❌ DEPRECATED - Do not use
// const team = await getDoc(doc(db, 'teams', teamId));

// ✅ Use architect collections instead
import { baseTeamRef } from '@/data/firestorePaths';
const team = await getDoc(baseTeamRef(teamCode));
```

---

## Migration Context

All migrations are complete:

- **Completed**: `players` → `players_v2` 
- **Completed**: `teams` → `/architect_baseTeams` (see `docs/schema/architect.md`)
- **Completed**: Player contracts → `/architect_basePlayers` (see `docs/schema/architect.md`)

---

## Artifact to Firestore Pipeline

Player contract data is scraped and validated before being uploaded to Firestore:

**Pipeline Flow:**

1. Scrape from SalarySwish → `player-scrape/contracts/output/{TEAM}/{playerId}.json`
2. Validate against Zod schema (`player-scrape/shared/schema/player_scrape_schema.ts`)
3. Transform and upload to `/players_v2/{playerId}/contracts/{contractId}` (manual/script-driven)

See [PROJECT_SCHEMA.md](../../PROJECT_SCHEMA.md) for complete artifact flow documentation and validation rules.

---

_Current as of: ${new Date().toISOString()}_
_🚧 = In Migration | ✅ = Migration Complete_
