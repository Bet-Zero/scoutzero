## Summary
- Added an owner-only Ranker → Lists bridge so completed rankings can be explicitly saved as a `lists` document via **Save as List**.
- Reused existing list helper flow (`createList` + `saveList`) and owner gating (`isOwnerUid` through `useRankerSession` owner state).
- Final order source of truth now follows required precedence:
  - use `adjustments` when present
  - otherwise use current results display order.
- Added post-save linkage to local draft (`ranker_draft_v1`) and optional linked `rankerSessions` doc (`savedListId`).

## Files changed
- `/home/runner/work/scoutzero/scoutzero/src/features/ranker/utils/saveAsListBridge.js`
- `/home/runner/work/scoutzero/scoutzero/src/features/ranker/hooks/useRankerSession.js`
- `/home/runner/work/scoutzero/scoutzero/src/features/ranker/RankingBuilder.jsx`
- `/home/runner/work/scoutzero/scoutzero/src/features/ranker/RankingSession.jsx`
- `/home/runner/work/scoutzero/scoutzero/src/features/ranker/RankingResults.jsx`
- `/home/runner/work/scoutzero/scoutzero/src/features/ranker/utils/rankerLocalDraft.js`
- `/home/runner/work/scoutzero/scoutzero/src/firebase/listHelpers.js`
- `/home/runner/work/scoutzero/scoutzero/tests/rankerSaveAsList.test.js`
- `/home/runner/work/scoutzero/scoutzero/docs/features/ranker_SESSION_SCHEMA.md`
- `/home/runner/work/scoutzero/scoutzero/return_packages/ranker/RANKER_LISTS_P4_EXECUTION_RETURN_PACKAGE.md`

## What “Save as List” writes (exact field names)
### `lists/{listId}`
Write path uses existing helpers:
1) `createList(name, userId)` seeds canonical list schema.
2) `saveList(listId, payload, userId)` writes:
- `playerOrder`: final ranking IDs (`adjustments` first, else displayed `currentRanking` IDs)
- `playerIds`: full ranker pool IDs
- `playerNotes`: `{}`
- `description`: `"Created from Ranker"`
- `updatedAt`: server timestamp (via helper)

`createList` continues to own canonical creation fields:
- `name`
- `ownerUid`
- `createdAt`
- `updatedAt`
- base list fields (`playerIds`, `playerOrder`, `playerNotes`, `description`)

### Local draft linkage (`ranker_draft_v1`)
On successful save:
- `savedListId`
- `savedListName`

### Firestore ranker session linkage (optional)
If ranker session is associated with Firestore (`firestoreSessionId` exists), patch:
- `savedListId`

## Tests run + results
- `npm run test:node -- --run tests/rankerSaveAsList.test.js --reporter=dot` ✅ (1 file, 4 tests passed)
- `npm run build` ✅

Baseline checks performed before edits:
- `npm run test:diff -- --reporter=dot` (fell back to full suite in this environment because no main merge base; passed)
- `npm run build` ✅

## Manual verification checklist results
- [x] Owner-only save action wired to Ranker results action row.
- [x] Non-owner path guarded in UI (button hidden) and in handler (`saveAsList` returns early when not owner).
- [x] Payload saves IDs only for `playerOrder` and `playerIds`.
- [x] Final-order precedence implemented (`adjustments` > `currentRanking`).
- [x] Local draft receives `savedListId` + `savedListName` after successful save.
- [x] Optional Firestore ranker session patch for `savedListId` when linked.
- [ ] Full interactive browser verification of Ranker UI in this sandbox (blocked by Firebase auth/env: `auth/invalid-api-key`).

### Screenshot notes
- Local screenshot attempt produced blank/blocked page due missing Firebase env in sandbox.
- Provided screenshot URL: `https://github.com/user-attachments/assets/76105f40-6088-4015-9164-932d646713b4`
- Suitability: **not suitable for demonstrating this UI change** (blank image, no Ranker UI visible).
