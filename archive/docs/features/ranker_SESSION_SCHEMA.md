# Ranker Session Schema v1

The ranker uses a **local-first persistence model**:

- **Local Draft** (sessionStorage): All users get crash/refresh safety
- **Firestore Saved Session**: Owner-only explicit save action

---

## Local Draft (sessionStorage) — All Users

### Storage Key

```
ranker_draft_v1
```

### Local Draft Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string\|null | ❌ | Session name (default: "Ranking YYYY-MM-DD") |
| `playerPoolIds` | string[] | ✅ | Array of player IDs in the ranking pool |
| `setupData` | object\|null | ❌ | Setup configuration (see below) |
| `results` | array | ✅ | Array of comparison results (see below) |
| `skippedPairs` | string[] | ✅ | Pairs temporarily skipped (array format) |
| `anchorDone` | boolean | ✅ | Whether anchor comparison phase is complete |
| `isFinished` | boolean | ✅ | Whether ranking is fully complete |
| `adjustments` | string[]\|null | ❌ | Final adjusted ranking (player IDs in order) |
| `draftUpdatedAt` | number | ✅ | Unix timestamp of last update |
| `firestoreSessionId` | string\|null | ❌ | Associated Firestore doc ID (if saved) |

### Local Draft Behavior

- **Create**: When "Start Ranking" clicked, creates/overwrites local draft
- **Update**: Every action (select, skip, undo, setup) triggers debounced save (800ms)
- **Resume**: On page load, if local draft exists, shows banner with Resume/Start New/Clear options
- **Derive**: `currentPair` and `closureCache` are NOT stored — rebuilt on load

---

## Firestore Saved Session — Owner Only

The `rankerSessions` collection stores explicitly saved ranking sessions. Only users in the owner allowlist can save to Firestore.

### Collection Path

```
rankerSessions/{sessionId}
```

### Document Schema (v1)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ownerUid` | string | ✅ | User ID who owns this session |
| `createdAt` | Timestamp | ✅ | Server timestamp when created |
| `updatedAt` | Timestamp | ✅ | Server timestamp, updated on every save |
| `schemaVersion` | number | ✅ | Always `1` for this version |
| `name` | string | ✅ | Session name (default: "Ranking YYYY-MM-DD") |
| `playerPoolIds` | string[] | ✅ | Array of player IDs in the ranking pool |
| `setupData` | object\|null | ❌ | Setup configuration (see below) |
| `results` | array | ✅ | Array of comparison results (see below) |
| `anchorDone` | boolean | ✅ | Whether anchor comparison phase is complete |
| `isFinished` | boolean | ✅ | Whether ranking is fully complete |
| `skippedPairs` | string[] | ✅ | Pairs temporarily skipped (canonical format: `"id1<>id2"`) |
| `adjustments` | string[]\|null | ❌ | Final adjusted ranking (player IDs in order) |
| `savedListId` | string\|null | ❌ | Last `lists` doc created from this session via "Save as List" |

### Owner Gating

Firestore writes are gated by `isOwnerUid(userId)`:

- **Non-owner**: No "Save to Firestore" button visible, no Firestore writes
- **Owner**: Sees "Save to Firestore" button on results screen

## Ranker → Lists (Owner-only)

- **Button location**: Ranker results action row (`src/features/ranker/RankingResults.jsx`) near Adjust/View/Download/Copy actions.
- **Visibility**: Only owners (`isOwnerUid(userId)`) receive the handler; non-owners do not see the button.
- **Final order selection**:
  1. If `adjustments` exists and is non-empty, that ID order is used.
  2. Otherwise, the currently displayed/exported `currentRanking` order is used.
- **`lists` write fields**:
  - `name` (`Ranker — ${sessionName || 'Ranking'} — YYYY-MM-DD`)
  - `playerOrder` (final ranked IDs)
  - `playerIds` (full ranker pool IDs)
  - `playerNotes` (`{}`)
  - `description` (`Created from Ranker`)
  - `ownerUid`, `createdAt`, `updatedAt` are preserved by existing list helper flow.
- **Local draft linkage**: `ranker_draft_v1` stores `savedListId` + `savedListName` after successful save.
- **Firestore session linkage**: if a `rankerSessions` doc is associated, `savedListId` is patched onto that session on the same explicit click.

Configure owner UIDs in `.env`:

```
VITE_OWNER_UIDS=uid1,uid2,uid3
```

### setupData Object

```typescript
{
  topTier: string[];        // Player IDs marked as definite top
  bottomTier: string[];     // Player IDs marked as definite bottom
  anchor: string | null;    // Anchor player ID (optional)
  firstPlace: string | null; // Lock-in first place player ID
  lastPlace: string | null;  // Lock-in last place player ID
}
```

### results Array Entry

```typescript
{
  winner: string;  // Player ID that won the comparison
  loser: string;   // Player ID that lost the comparison
}
```

## What Is Persisted vs Derived

| Data | Persisted | Derived |
|------|-----------|---------|
| Player pool IDs | ✅ | - |
| Setup configuration | ✅ | - |
| Comparison results | ✅ | - |
| Skipped pairs | ✅ | - |
| Adjusted ranking | ✅ | - |
| `currentPair` | ❌ | Computed from `suggestNextPair()` |
| `closureCache` | ❌ | Rebuilt from `results` on load |
| `groupedPlayers` | ❌ | Computed from `setupData` + `results` |
| Progress estimate | ❌ | Computed from `results` + remaining pairs |

## Resume Behavior

### Local Draft Resume (All Users)

When page loads with existing local draft:

1. **Check**: `hasLocalDraft()` returns true if valid draft in sessionStorage
2. **Show Banner**: Display Resume/Start New/Clear options
3. **On Resume**:
   - Load draft from sessionStorage via `loadLocalDraft()`
   - Convert `skippedPairs` array to `Set<string>`
   - Map `playerPoolIds` back to player objects via `players_v2`
   - Rebuild closure: `closureCache.rebuild(results)`
   - Derive first pair: `suggestNextPair()` with rebuilt closure and skippedPairs
4. **Display Adjustments**: If `adjustments` exists, use as canonical final ranking

### Firestore Resume (Owner Only)

Owner can load previously saved Firestore sessions:

1. **Query**: `queryAllRankerSessions(userId)` returns saved sessions
2. **Load**: `loadFromFirestore(sessionId)` fetches and hydrates
3. **Same hydration logic** as local draft resume

## Security Rules (Recommended)

```javascript
match /rankerSessions/{sessionId} {
  allow read, write: if request.auth != null 
                     && request.auth.uid == resource.data.ownerUid;
  allow create: if request.auth != null 
                && request.resource.data.ownerUid == request.auth.uid;
}
```

## Migration Notes

- **v1 → future**: If schema changes, `schemaVersion` field allows migration logic
- No auto-claim for legacy docs: Missing `ownerUid` = invalid session (refuse to load)
- **P3 Migration**: Local-first architecture added; Firestore autosave removed

## Related Files

- `src/config/ownerConfig.js` — Owner allowlist and `isOwnerUid()` helper
- `src/features/ranker/utils/rankerLocalDraft.js` — Local draft persistence (sessionStorage)
- `src/features/ranker/hooks/useRankerSession.js` — React hook for local-first persistence
- `src/firebase/rankerHelpers.js` — Firestore CRUD operations (owner-gated)
- `src/constants/collections.ts` — `RANKER_SESSIONS_COLLECTION` constant
- `src/features/ranker/utils/rankingEngine.js` — Closure cache and pairing logic
