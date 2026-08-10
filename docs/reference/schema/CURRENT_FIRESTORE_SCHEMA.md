# Current Firestore Schema Reference

## Migration Status Overview

- 🟢 **`players_v2`**: Migration COMPLETE (current = target)
- 🟢 **`architect_basePlayers`**: Migration COMPLETE (active)
- 🟢 **`architect_baseTeams`**: Migration COMPLETE (active)
- 🟢 **`architect_baseEntitlements`**: Migration COMPLETE (active)
- 🔴 **`teams`**: Migration COMPLETE - Legacy collection deprecated, use `/architect/` collections

---

## Active Collections (Production)

> Canonical schema sources:
>
> - players_v2: see `docs/reference/schema/players_v2.md` (generated from `src/schemas/players_v2.ts`)
> - architect: see `docs/reference/schema/architect.md` (generated from `src/schemas/architect.ts`)

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

**Structure**: See `docs/reference/schema/architect.md` for complete schema

**Phase 10 Fields:**

- `entitlementIds[]` - Entitlement ownership for the team (resolved via base + world overrides)

### `/architect_baseEntitlements/{entitlementId}` - Entitlement Definitions ✅ FINAL

**Status**: ✅ Active (Phase 10)
**Usage**: Base entitlement definitions for trade machine asset resolution

**Structure**: See `docs/reference/schema/architect.md` for entitlement schema

### `/architect_worlds/{worldId}/entitlements/{entitlementId}` - World Entitlement Overrides ✅ FINAL

**Status**: ✅ Active (Phase 10)
**Usage**: World overrides or world-created entitlements

### `/architect_worlds/{worldId}/contractBaselines/{shardId}` - Governed Baseline Contracts ✅ ACTIVE

**Status**: ✅ Active for newly created governed worlds (BZE-274)
**Usage**: Immutable, terms-capable version-two contract ledgers established
from one exact pinned source release. Existing rendered contract consumers are
not migrated to this subcollection yet.

World metadata pins `contractBaselineVersion`, `contractSourceRelease`,
`contractBaselineEffectiveAt`, `contractBaselineSalaryCapYear`, and exact
complete/needs-input counts. Each deterministic team shard retains its team and
shard identity, source-release pin, evidence catalog, immutable ledgers, and
document digest. Missing evidence remains explicit in each ledger's resulting
state; pre-baseline worlds require recreation and are never upgraded from
mutable snapshots.

### `/architect_worlds/{worldId}/teams/{teamCode}/freeAgentPools/{seasonKey}` - Managed Free-Agent Pools ✅ ACTIVE

**Status**: ✅ Active
**Usage**: Active Team Plan / world-season scoped generated free-agent pool.

**Structure**:

- `schemaVersion` - Snapshot schema version
- `source` - `architect-free-agent-pool-management`
- `worldId` - Owning Architect world
- `teamCode` - Owning team code
- `seasonKey` - Season key, e.g. `2025-26`
- `selectionKeys[]` - Stable free-agent selection keys included in the managed pool
- `updatedAt` - ISO timestamp for the pool snapshot

### `/architect_basePlayers/{playerId}` - Player Contracts ✅ FINAL

**Status**: ✅ Migration complete - this is the target schema  
**Usage**: All architect/GM mode player contract queries should use this collection

**Structure**: See `docs/reference/schema/architect.md` for complete schema

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
const entitlementIds = team.data().entitlementIds || [];
```

### For `/architect_baseEntitlements` (Use for Entitlement Definitions)

```javascript
import { baseEntitlementRef } from '@/data/firestorePaths';
const entitlement = await getDoc(baseEntitlementRef(entitlementId));
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

## User-Created Collections

### `/playerProfileEvaluations/{ownerUid}/players/{playerId}` - Profile Scouting Overlays ✅ ACTIVE

**Status**: ✅ Active
**Usage**: User-owned editable player profile/scouting evaluation data. This collection stores profile edits outside read-only `players_v2` source player records.

**Structure**:

| Field           | Type       | Default      | Notes                                                                       |
| --------------- | ---------- | ------------ | --------------------------------------------------------------------------- |
| `ownerUid`      | `string`   | _(required)_ | Firebase Auth UID that owns the profile overlay namespace.                  |
| `playerId`      | `string`   | _(required)_ | Source `players_v2` player document ID this overlay applies to.             |
| `traits`        | `object`   | `{}`         | Editable scouting trait scores.                                             |
| `roles`         | `object`   | `{}`         | Editable offensive/defensive role labels.                                   |
| `subRoles`      | `object`   | `{}`         | Editable offensive/defensive sub-role arrays.                               |
| `badges`        | `string[]` | `[]`         | Editable badge labels.                                                      |
| `shootingProfile` | `string` | `''`         | Editable shooting profile label.                                            |
| `overallGrade`  | `number`   | _(omitted)_  | Editable profile overall grade when set.                                    |
| `blurbs`        | `object`   | `{}`         | Editable profile breakdown copy.                                            |
| `videoExamples` | `object`   | `{}`         | Editable profile video examples.                                            |
| `twoWay`        | `number`   | `50`         | Editable two-way meter value.                                               |
| `meta`          | `object`   | `{}`         | Save metadata such as update timestamp and version.                         |

**Load/Save Contract**: `players_v2` remains the immutable source of player bio, stats, contracts, and source evaluation data. Profile autosave writes only to this overlay path, and profile detail loading merges the current owner's overlay into `evaluations.current` so saved profile edits hydrate through the existing profile state model.

**Compatibility Note**: Historical profile edits that were previously written under `players_v2` remain readable as source evaluation data when present. There is no broad migration in the active profile save path.

### `/lists/{listId}` - Player Lists ✅ CANONICAL (E1+)

**Status**: ✅ Schema normalized (E1), ownership scoped (E4)
**Usage**: User-curated player lists, created/managed via `/lists` and `/lists/:listId`

**Structure**:

| Field         | Type        | Default              | Notes                                                                                             |
| ------------- | ----------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `name`        | `string`    | _(required)_         | List display name                                                                                 |
| `playerIds`   | `string[]`  | `[]`                 | Ordered player IDs in the list                                                                    |
| `playerOrder` | `string[]`  | `[]`                 | Display order; may include `divider::Label` entries for tier dividers                             |
| `playerNotes` | `object`    | `{}`                 | Map of `playerId → note string` (stored but UI editing is commented out)                          |
| `description` | `string`    | `''`                 | List description (display-only, no editor)                                                        |
| `ownerUid`    | `string`    | _(required post-E4)_ | Firebase Auth UID of the list owner. May be absent on legacy docs (auto-claimed on first access). |
| `createdAt`   | `Timestamp` | `serverTimestamp()`  | Set on creation                                                                                   |
| `updatedAt`   | `Timestamp` | `serverTimestamp()`  | Updated on every mutation                                                                         |

**ID Strategy**: Auto-generated (`addDoc`). No human-readable IDs.

**Legacy Notes**:

- Older documents may contain a `players` array field (from pre-E1 `createList`). This is ignored by the app. Migration is deferred.
- `playerOrder` entries prefixed with `divider::` represent visual tier separators, not player IDs.

**Service Layer**: `src/firebase/listHelpers.js` — `fetchAllLists`, `createList`, `createListWithPlayer`, `addPlayerToList`, `saveList`, `fetchList`, `renameList`, `deleteList`

```javascript
// Read all lists (scoped to ownerUid)
const lists = await fetchAllLists(userId); // returns array with { id, ...data }

// Create a new list with ownership
const id = await createList('My List', userId);
```

### `/tierLists/{tierListId}` - Tier Lists ✅ CANONICAL (E2+)

**Status**: ✅ Schema normalized (E2), ownership scoped (E4)
**Usage**: Tier-based player rankings, created/managed via `/tier-lists` and `/tier-maker/:tierListId?`

**Structure**:

| Field       | Type                      | Default              | Notes                                                                                                  |
| ----------- | ------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| `name`      | `string`                  | _(required)_         | Tier list display name                                                                                 |
| `tiers`     | `object`                  | `{}`                 | Map of `tierName → string[]` (player IDs per tier/row)                                                 |
| `tierOrder` | `string[]`                | `[]`                 | Ordered tier/row keys controlling display order                                                        |
| `mode`      | `'standard' \| 'pyramid'` | `'standard'`         | Persisted on create and every save. Legacy row-shaped docs are resolved via `resolveTierListMode()` and repaired on owner read. |
| `ownerUid`  | `string`                  | _(required post-E4)_ | Firebase Auth UID of the tier list owner. May be absent on legacy docs (auto-claimed on first access). |
| `createdAt` | `Timestamp`               | `serverTimestamp()`  | Set on creation                                                                                        |
| `updatedAt` | `Timestamp`               | `serverTimestamp()`  | Updated on rename, save, and other mutations                                                           |

**ID Strategy**: Auto-generated (`addDoc`). No human-readable IDs.

**Mode Resolution / Repair**:

- If `mode === 'pyramid'` → stays `'pyramid'`
- If every non-Pool key is row-shaped (`Row1`, `Row2`, etc.) → resolves to `'pyramid'`
- Otherwise → resolves to `'standard'`
- Resolution is handled by `resolveTierListMode()` in `listHelpers.js`
- `fetchAllTierLists()` returns the resolved mode for `/tier-lists` navigation
- `fetchTierList()` repairs mismatched stored `mode` values when the current owner reads the doc

**Tieramid (Pyramid Mode) Notes**:

- Row capacity limits (1/2/3/4/5 per row) are UI-only; not persisted to Firestore.
- Pyramids use row names (`Row1`–`Row5`) as tier keys instead of letter grades (`S`, `A`, `B`).

**Service Layer**: `src/firebase/listHelpers.js` — `resolveTierListMode`, `fetchAllTierLists`, `fetchTierList`, `createTierList`, `saveTierList`, `renameTierList`, `deleteTierList`

```javascript
// Create a tier list with explicit mode + ownership
const id = await createTierList('My Tiers', 'pyramid', userId);

// Fetch with owner enforcement + mode repair when needed
const tierList = await fetchTierList(tierListId, userId);
console.log(tierList.mode); // 'standard' or 'pyramid'
await saveTierList(tierList.id, { tiers, tierOrder, mode: 'pyramid' }, userId);
```

**Ownership/Auth**: ✅ IMPLEMENTED (E4) — `ownerUid` stored on all new documents. Collection reads in the app use `ownerUid == userId` scoped queries. Direct tier-list reads use `fetchTierList(id, userId)`, which owner-enforces access and throws coded `no-session`, `not-found`, or `permission-denied` errors. Legacy docs without `ownerUid` are auto-claimed on first access by a signed-in user. Firestore security rules are scaffolded but remain dev-open until launch.

**Reopen Links**: Saved tier-list links are owner-only reopen links, not public share links. The canonical form is `/tier-maker/:tierListId?mode=standard|tieramid`.

#### Legacy Ownership Claiming (E4)

Documents created before E4 may lack an `ownerUid` field. When such a document is accessed by a signed-in user:

1. The app detects `ownerUid` is missing.
2. It automatically writes `ownerUid: <current userId>` to the document.
3. From that point forward, the document is owned by that user.

This is a "first-come, first-claimed" strategy. It requires no migration script and is safe for single-user contexts.

### `/rosterProjects/{projectId}` - Saved Rosters

**Status**: App-level ownership enforced (2026-04-18), rules flip still pending
**Usage**: Saved roster builder states, created/managed via `/rosters` and `/roster/:rosterId`

**Structure**:

| Field       | Type        | Default                            | Notes                                                                                                 |
| ----------- | ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `name`      | `string`    | _(required)_                       | Roster display name                                                                                   |
| `team`      | `string`    | `''`                               | Team slug or code used by roster views                                                                |
| `starters`  | `(string\|null)[]` | `[]`                        | Starter slot player IDs; `null` preserves empty slots                                                 |
| `rotation`  | `(string\|null)[]` | `[]`                        | Rotation slot player IDs; `null` preserves empty slots                                                |
| `bench`     | `(string\|null)[]` | `[]`                        | Bench slot player IDs; `null` preserves empty slots                                                   |
| `ownerUid`  | `string`    | _(required on new docs)_           | Firebase Auth UID of the roster owner. Legacy docs may be ownerless and are auto-claimed on access. |
| `createdAt` | `Timestamp` | `serverTimestamp()`                | Set on creation                                                                                       |
| `updatedAt` | `Timestamp` | `serverTimestamp()`                | Updated on every mutation and during legacy ownership claim                                           |

**ID Strategy**: Auto-generated (`addDoc`). No human-readable IDs.

**Service Layer**: `src/firebase/rosterHelpers.ts` — `fetchAllRosterProjects`, `createRosterProject`, `loadRosterProject`, `updateRosterProject`, `renameRosterProject`, `deleteRosterProject`

```javascript
// Fetch the current user's saved rosters
const rosters = await fetchAllRosterProjects(userId);

// Create a new owned roster project
const created = await createRosterProject('My Roster', userId);

// Reopen an existing roster with ownership guard
const roster = await loadRosterProject(rosterId, userId);
```

**Ownership/Auth**: App-level ownership is now enforced by `rosterHelpers.ts`. New roster docs always write `ownerUid`, collection reads in the app are scoped to the current `userId`, and direct load/update/delete paths owner-enforce access. Legacy ownerless docs are auto-claimed on first signed-in access. Firestore rules for `/rosterProjects/{projectId}` are still broader than the app contract and should be tightened in a later pass.

---

## Migration Context

- **Completed**: `players` → `players_v2` (see `docs/migrations/players-v1-to-v2/`)
- **Completed**: `teams` → `/architect_baseTeams` (see `docs/reference/schema/architect.md`)
- **Completed**: Player contracts → `/architect_basePlayers` (see `docs/reference/schema/architect.md`)

---

## Artifact to Firestore Pipeline

Player contract data is scraped and validated before being uploaded to Firestore:

**Pipeline Flow:**

1. Scrape from SalarySwish → `player-scrape/contracts/output/{TEAM}/{playerId}.json`
2. Validate against Zod schema (`player-scrape/shared/schema/player_scrape_schema.ts`)
3. Transform and upload to `/players_v2/{playerId}/contracts/{contractId}` (manual/script-driven)

See [PROJECT_SCHEMA.md](../reference/PROJECT_SCHEMA.md) for complete artifact flow documentation and validation rules.

---

_Current as of: ${new Date().toISOString()}_
_🚧 = In Migration | ✅ = Migration Complete_
