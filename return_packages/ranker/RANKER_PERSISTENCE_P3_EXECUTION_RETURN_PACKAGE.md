# RANKER_PERSISTENCE_P3 — Execution Return Package

## Summary

Implemented local-first draft persistence for the Ranker tool with owner-only explicit Firestore saves. The ranker now:

1. **Never writes to Firestore during ranking for any user**
2. **Autosaves locally (sessionStorage)** for all users — crash/refresh safe
3. **Owner-only explicit save** — Only allowlisted UIDs can save to Firestore via button click

## Files Changed

| File                                            | Action    | Purpose                                                            |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------ |
| `src/config/ownerConfig.js`                     | Created   | Owner allowlist config (`VITE_OWNER_UIDS`) + `isOwnerUid()` helper |
| `src/features/ranker/utils/rankerLocalDraft.js` | Created   | Local draft persistence (sessionStorage) with debounce             |
| `src/features/ranker/hooks/useRankerSession.js` | Rewritten | Local-first architecture, owner-gated Firestore save               |
| `src/features/ranker/RankingBuilder.jsx`        | Modified  | Local draft resume banner, removed Firestore autosave              |
| `src/features/ranker/RankingSession.jsx`        | Modified  | Added owner-only "Save to Firestore" button on results screen      |
| `tests/rankerLocalDraft.test.js`                | Created   | Unit tests for local draft persistence and owner gating            |
| `docs/features/ranker_SESSION_SCHEMA.md`        | Updated   | Documented local vs Firestore persistence distinction              |

## Architecture

### Local Draft (sessionStorage) — All Users

- **Storage key**: `ranker_draft_v1`
- **Stored as**: Single "most recent session" draft (overwrite pattern)
- **Updates**: Every action (select, skip, undo, setup) with 800ms debounce
- **Resume**: On page load, if local draft exists, show resume banner

Draft fields stored:

```typescript
{
  name: string | null;           // Optional session name
  playerPoolIds: string[];       // Player IDs in pool
  setupData: object | null;      // Setup configuration
  results: { winner, loser }[];  // Comparison results
  skippedPairs: string[];        // Temporarily skipped pairs
  anchorDone: boolean;           // Anchor phase complete
  isFinished: boolean;           // Ranking complete
  adjustments: string[] | null;  // Final adjusted ranking
  draftUpdatedAt: number;        // Unix timestamp
  firestoreSessionId: string | null; // If saved to Firestore
}
```

**NOT stored** (derived on load):

- `currentPair` — computed from `suggestNextPair()`
- `closureCache` — rebuilt from `results` via `closureCache.rebuild()`

### Firestore Save — Owner Only

- **Triggered by**: Explicit button click ("Save to Firestore")
- **Gated by**: `isOwnerUid(userId)` check
- **Button location**: Results screen (after ranking completes)
- **Creates/updates**: `rankerSessions/{sessionId}` with standard schema

## Environment Configuration

Add owner UIDs to `.env`:

```
VITE_OWNER_UIDS=uid1,uid2,uid3
```

## Tests Run

| Command                                                                                              | Result               |
| ---------------------------------------------------------------------------------------------------- | -------------------- |
| `npm run build`                                                                                      | ✅ Success (40.27s)  |
| `npm run test:node -- --run tests/rankerLocalDraft.test.js tests/rankerSessionSerialization.test.js` | ✅ 33 tests passed   |
| `npm run test:diff`                                                                                  | ✅ 2253 tests passed |

### Test Coverage

New tests in `tests/rankerLocalDraft.test.js`:

- Local draft serialize/deserialize round trip (preserves all fields)
- skippedPairs Set↔Array conversion
- Resume respects skippedPairs from loaded draft
- Closure rebuild from results works after load
- Owner gating (non-owner cannot trigger Firestore save)
- Draft state transitions (merge partial updates)
- draftUpdatedAt increments on save

## Manual Verification Checklist

### Non-Owner Flow

- [ ] Start ranking with 3+ players
- [ ] Complete several comparisons
- [ ] Refresh the page
- [ ] Resume banner appears with correct stats
- [ ] Click "Resume" — continues from where left off
- [ ] Complete ranking
- [ ] **No "Save to Firestore" button visible** (non-owner)
- [ ] Verify no Firestore writes (check browser DevTools Network tab)

### Owner Flow (requires `VITE_OWNER_UIDS` configured)

- [ ] Start ranking with 3+ players
- [ ] Complete ranking
- [ ] "Save to Firestore" button visible on results screen
- [ ] Click button — shows "Saving..." then "Saved to Firestore"
- [ ] Verify single Firestore write (browser Network tab)
- [ ] Refresh page — local draft still available
- [ ] Clicking button again updates existing Firestore doc (not create new)

### Edge Cases

- [ ] Clear draft from banner — draft cleared, banner disappears
- [ ] Start new from banner — overwrites existing draft
- [ ] Crash during ranking (close tab, reopen) — local draft preserved
- [ ] Multiple browser tabs — last-write-wins for local draft
