# Ranker Session Schema v1

The `rankerSessions` collection stores in-progress and completed player ranking sessions. Each document represents one ranking session owned by a single user.

## Collection Path

```
rankerSessions/{sessionId}
```

## Document Schema (v1)

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

When loading a session:

1. **Query**: Check for `isFinished == false` and `ownerUid == userId`
2. **Hydrate Pool**: Map `playerPoolIds` back to player objects via `players_v2`
3. **Rebuild Closure**: Call `closureCache.rebuild(results)` to reconstruct transitive reachability
4. **Convert SkippedPairs**: Deserialize `skippedPairs` array to `Set<string>`
5. **Derive First Pair**: Call `suggestNextPair()` with rebuilt closure and skippedPairs
6. **Display Adjustments**: If `adjustments` exists, use as canonical final ranking

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

## Related Files

- `src/firebase/rankerHelpers.js` — CRUD operations
- `src/features/ranker/hooks/useRankerSession.js` — React hook for persistence
- `src/constants/collections.ts` — `RANKER_SESSIONS_COLLECTION` constant
- `src/features/ranker/utils/rankingEngine.js` — Closure cache and pairing logic
