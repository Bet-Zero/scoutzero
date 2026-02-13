# E4 Preflight Findings — Ownership & Auth Scoping

**Date**: 2026-02-05  
**Scope**: Discovery only — no code changes  
**Collections**: `lists`, `tierLists`

---

## 1) AUTH STATUS

| Question                          | Answer                                                                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Firebase Auth present?**        | **Yes.** Firebase Auth is initialized in `src/firebaseConfig.js` via `getAuth(app)`. Exported as `auth`.                                                                                                                                                          |
| **How to access current uid**     | `useAuth()` hook from `src/shared/hooks/useAuth.js`. Returns `{ user, userId, loading }`. `userId` is `user?.uid \|\| null`.                                                                                                                                      |
| **Auth provider type**            | Anonymous sign-in (`signInAnonymously`) — auto-triggered in DEV mode only. No email/password, social, or other provider is configured.                                                                                                                            |
| **Production behavior (no auth)** | In prod (`!import.meta.env.DEV`), if no user is signed in, `onAuthStateChanged` fires with `null`. Hook returns `{ user: null, userId: null, loading: false }`. **No sign-in is triggered, no redirect occurs.** The app renders normally but `userId` is `null`. |
| **Current consumers**             | Only `GMDashboard.jsx` imports `useAuth`. Lists and Tier Lists features do **not** use `useAuth` anywhere.                                                                                                                                                        |

### Key Implication for E4

In production today, `userId` will be `null` for all users unless a sign-in flow is added. Anonymous auth works only in DEV (emulator). E4 must either:

- Enable anonymous auth in production (simplest path, gives every session a stable uid), or
- Accept that ownership scoping is dev-only until a real auth strategy ships.

---

## 2) RULES STATUS

| Question                           | Answer                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rules file path**                | `firestore.rules` (project root)                                                                                                                                                                |
| **Backup**                         | `firestore.rules.backup` (project root)                                                                                                                                                         |
| **Current rule stance**            | **Wide open**: `allow read, write: if true;` on all documents (`/{document=**}`). Comment says "TEMPORARY: All operations allowed for emulator testing."                                        |
| **Lists/tierLists specific rules** | None. Covered by the global wildcard.                                                                                                                                                           |
| **Deployment config**              | `firebase.json` → `"firestore": { "rules": "firestore.rules" }`. Deploy via `firebase deploy --only firestore:rules` (standard Firebase CLI). No CI/CD pipeline for rules deployment was found. |
| **Emulators**                      | Auth (9099), Firestore (8082), Functions (5001) — all configured in `firebase.json` and connected in dev mode via `firebaseConfig.js`.                                                          |

### E4 Rules Strategy: Dev-Open vs Launch-Secure

| Phase                  | Rules Stance                                                                                                                | Notes                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **E4 Execution (dev)** | Keep `if true` globally. Add **commented-out** secure rules for `lists` and `tierLists` that can be uncommented for launch. | Avoids breaking dev workflow.                                      |
| **Launch**             | Uncomment scoped rules: `allow read, write: if request.auth != null && resource.data.ownerUid == request.auth.uid;`         | Enforces ownership. Requires anonymous auth enabled in production. |

---

## 3) EXISTING SCOPING PATTERN(S)

The Architect feature (`worldManager.js`) is the only feature in the repo with user-scoped documents.

| Aspect                   | Architect Pattern                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Collection**           | `architect_worlds` (via `worldsCol()` / `worldMetadataRef()`)                                                                                           |
| **Ownership field**      | `createdBy` (set to `userId` on creation)                                                                                                               |
| **Write guard**          | `if (metadata.createdBy !== userId) throw` (app-level check in `updateWorld` and `archiveWorld`)                                                        |
| **Read scoping**         | `where('createdBy', '==', userId)` in `listUserWorlds()`                                                                                                |
| **Rules enforcement**    | None — same global `if true` wildcard. App-level only.                                                                                                  |
| **Hook integration**     | `GMDashboard` calls `useAuth()` → passes `userId` to `useArchitectState` → `worldManager.listUserWorlds(userId)`                                        |
| **Null userId handling** | `createWorld` throws `'userId is required'`. `listUserWorlds` throws `'userId is required'`. Dashboard shows loading state while `authLoading` is true. |

### Convention to Adopt for E4

| Decision        | Recommendation                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field name      | Use `ownerUid` (clearer than `createdBy`, which implies a different semantic). Note: `createdBy` is already used by Architect — using a different name avoids confusion between "who created this world" vs "who owns this list." If consistency is preferred, `createdBy` works too. |
| App-level guard | Check `ownerUid === userId` before update/delete in helpers.                                                                                                                                                                                                                          |
| Read scoping    | Add `where('ownerUid', '==', userId)` to fetch queries when userId is available.                                                                                                                                                                                                      |
| Rules (launch)  | `allow write: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;`                                                                                                                                                                                         |

---

## 4) OWNERSHIP INJECTION POINTS

### D1) Player Lists (`lists`) — Write Paths

| Operation                   | File                                                    | Symbol                             | Create/Update        | Fields Written Today                                                                       | Ownership Field Present? | Notes                                                                                                                              |
| --------------------------- | ------------------------------------------------------- | ---------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Create list (modal)         | `src/firebase/listHelpers.js`                           | `createList(name)`                 | Create (`addDoc`)    | `name`, `playerIds`, `playerOrder`, `playerNotes`, `description`, `createdAt`, `updatedAt` | **No**                   | Centralized helper. Must add `ownerUid` param.                                                                                     |
| Create list + add player    | `src/features/lists/AddToListButton/AddToListModal.jsx` | `handleAdd` (new list branch)      | Create (`addDoc`)    | `name`, `playerIds`, `playerOrder`, `playerNotes`, `description`, `createdAt`, `updatedAt` | **No**                   | Bypasses `listHelpers.js` — writes directly to Firestore. Should be refactored to use `createList()` or at minimum add `ownerUid`. |
| Add player to existing list | `src/features/lists/AddToListButton/AddToListModal.jsx` | `handleAdd` (existing list branch) | Update (`updateDoc`) | `playerIds` (arrayUnion), `updatedAt`                                                      | **No**                   | Update only — `ownerUid` not needed on this path (already set on create). Optionally verify ownership before update.               |
| Save list (reorder/notes)   | `src/pages/ListManager.jsx`                             | `handleSave`                       | Update (`updateDoc`) | `playerOrder`, `playerIds`, `playerNotes`, `updatedAt`                                     | **No**                   | Direct Firestore write (bypasses helpers). Optionally verify ownership.                                                            |
| Rename list                 | `src/pages/ListsHome.jsx`                               | `handleRename`                     | Update (`updateDoc`) | `name`, `updatedAt`                                                                        | **No**                   | Direct Firestore write (bypasses helpers). Optionally verify ownership.                                                            |
| Delete list                 | `src/pages/ListsHome.jsx`                               | `handleDelete`                     | Delete (`deleteDoc`) | —                                                                                          | **No**                   | Direct Firestore write. Must verify ownership before delete.                                                                       |
| Rename list (helper)        | `src/firebase/listHelpers.js`                           | `renameList(id, newName)`          | Update (`updateDoc`) | `name`, `updatedAt`                                                                        | **No**                   | Helper exists but **not used by UI** (ListsHome does inline).                                                                      |
| Delete list (helper)        | `src/firebase/listHelpers.js`                           | `deleteList(id)`                   | Delete (`deleteDoc`) | —                                                                                          | **No**                   | Helper exists but **not used by UI**.                                                                                              |

### D2) Tier Lists (`tierLists`) — Write Paths

| Operation             | File                                        | Symbol                                 | Create/Update          | Fields Written Today                                           | Ownership Field Present? | Notes                                          |
| --------------------- | ------------------------------------------- | -------------------------------------- | ---------------------- | -------------------------------------------------------------- | ------------------------ | ---------------------------------------------- |
| Create tier list      | `src/firebase/listHelpers.js`               | `createTierList(name, mode)`           | Create (`addDoc`)      | `name`, `tiers`, `tierOrder`, `mode`, `createdAt`, `updatedAt` | **No**                   | Centralized helper. Must add `ownerUid` param. |
| Save tier list        | `src/firebase/listHelpers.js`               | `saveTierList(id, {tiers, tierOrder})` | Update (`updateDoc`)   | `tiers`, `tierOrder`, `updatedAt`                              | **No**                   | Optionally verify ownership.                   |
| Rename tier list      | `src/firebase/listHelpers.js`               | `renameTierList(id, newName)`          | Update (`updateDoc`)   | `name`, `updatedAt`                                            | **No**                   | Optionally verify ownership.                   |
| Delete tier list      | `src/firebase/listHelpers.js`               | `deleteTierList(id)`                   | Delete (`deleteDoc`)   | —                                                              | **No**                   | Must verify ownership before delete.           |
| Save (TierMakerBoard) | `src/features/tierMaker/TierMakerBoard.jsx` | `handleSaveTierList`                   | Calls `saveTierList()` | Via helper                                                     | **No**                   | Uses centralized helper.                       |
| Save (TieramidBoard)  | `src/features/tierMaker/TieramidBoard.jsx`  | `handleSaveTierList`                   | Calls `saveTierList()` | Via helper                                                     | **No**                   | Uses centralized helper.                       |

### D3) Read/Query Points (Both Collections)

| Feature/Page              | File                                                    | Symbol                          | Query Type                             | Current Query      | Candidate Scoped Query                                                              | Notes                                             |
| ------------------------- | ------------------------------------------------------- | ------------------------------- | -------------------------------------- | ------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| Lists home                | `src/pages/ListsHome.jsx`                               | `fetchLists`                    | `getDocs(collection(db, 'lists'))`     | All docs, unscoped | `query(collection(db, 'lists'), where('ownerUid', '==', userId))`                   | Primary lists index page.                         |
| List manager              | `src/pages/ListManager.jsx`                             | `fetchList`                     | `getDoc(doc(db, 'lists', listId))`     | Single doc by ID   | Keep as-is (doc-level check: verify `ownerUid === userId` after read)               | Direct link; scoping via ownership check on read. |
| List manager (sidebar)    | `src/pages/ListManager.jsx`                             | `fetchAllLists` → `allLists`    | Via `listHelpers.fetchAllLists()`      | All docs, unscoped | Scope via `fetchAllLists(userId)`                                                   | Sidebar list picker.                              |
| Add to list modal         | `src/features/lists/AddToListButton/AddToListModal.jsx` | `fetchLists` (useEffect)        | `getDocs(collection(db, 'lists'))`     | All docs, unscoped | `query(collection(db, 'lists'), where('ownerUid', '==', userId))`                   | Shows available lists to add player to.           |
| Tier lists home           | `src/pages/TierListsHome.jsx`                           | `fetchLists`                    | Via `fetchAllTierLists()`              | All docs, unscoped | Scope via `fetchAllTierLists(userId)`                                               | Primary tier lists index page.                    |
| Tier maker (board)        | `src/features/tierMaker/TierMakerBoard.jsx`             | `useFirebaseQuery('lists')`     | `getDocs(collection(db, 'lists'))`     | All docs, unscoped | Requires `useFirebaseQuery` to support `where` clause, or replace with scoped fetch | Lists dropdown for adding players to tier maker.  |
| Tier maker (board)        | `src/features/tierMaker/TierMakerBoard.jsx`             | `useFirebaseQuery('tierLists')` | `getDocs(collection(db, 'tierLists'))` | All docs, unscoped | Same — needs scoping support                                                        | Tier list dropdown for load/save.                 |
| Tieramid (board)          | `src/features/tierMaker/TieramidBoard.jsx`              | `useFirebaseQuery('lists')`     | `getDocs(collection(db, 'lists'))`     | All docs, unscoped | Same                                                                                | Lists dropdown.                                   |
| Tieramid (board)          | `src/features/tierMaker/TieramidBoard.jsx`              | `useFirebaseQuery('tierLists')` | `getDocs(collection(db, 'tierLists'))` | All docs, unscoped | Same                                                                                | Tier list dropdown.                               |
| Player ranker             | `src/features/ranker/RankingBuilder.jsx`                | `useFirebaseQuery('lists')`     | `getDocs(collection(db, 'lists'))`     | All docs, unscoped | Same                                                                                | Player pool source.                               |
| All lists (helper)        | `src/firebase/listHelpers.js`                           | `fetchAllLists()`               | `getDocs(listsRef)`                    | All docs, unscoped | Add optional `userId` param → `where('ownerUid', '==', userId)`                     | Central helper used by ListManager sidebar.       |
| All tier lists (helper)   | `src/firebase/listHelpers.js`                           | `fetchAllTierLists()`           | `getDocs(tierListsRef)`                | All docs, unscoped | Add optional `userId` param → `where('ownerUid', '==', userId)`                     | Central helper used by TierListsHome.             |
| Single tier list (helper) | `src/firebase/listHelpers.js`                           | `fetchTierList(id)`             | `getDoc(doc(db, 'tierLists', id))`     | Single doc by ID   | Keep as-is (doc-level ownership check after read)                                   | Direct link.                                      |

---

## 5) NO-AUTH BEHAVIOR OPTIONS

### Current Behavior (Fact)

- Lists routes (`/lists`, `/lists/:id`, `/tier-lists`, `/tier-maker/:id?`) are **not gated by auth**.
- No route in `App.jsx` has any auth guard or redirect.
- In production, `useAuth()` returns `userId: null` because anonymous sign-in is DEV-only.
- All list/tier list operations work without a userId — writes succeed (no ownership field), reads return all documents.
- The Architect feature (`GMDashboard`) uses `useAuth()` and shows a loading state while `authLoading` is true, but does **not** redirect on null userId — it simply has no worlds to show.

### Options

| Option                               | Description                                                                                          | Pros                                                                                | Cons                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **1: Read-only / empty state**       | If `userId` is null, show lists as empty ("Sign in to create lists"). Writes are blocked.            | Clean UX. No data leaks.                                                            | Requires anonymous auth in prod or a real sign-in.                                                                              |
| **2: Allow "global" lists**          | Skip ownership scoping when `userId` is null. All lists remain shared.                               | Backwards compatible. Zero auth dependency.                                         | Defeats purpose of E4. No scoping until auth exists.                                                                            |
| **3: Block routes behind auth**      | Redirect `/lists/*` and `/tier-lists/*` to a sign-in page if not authenticated.                      | Strongest security posture.                                                         | No sign-in page exists. Requires auth UI work outside E4 scope.                                                                 |
| **4: Enable anonymous auth in prod** | Remove the `if (import.meta.env.DEV)` guard from `useAuth.js` so anonymous sign-in works everywhere. | Every session gets a stable uid. Ownership works immediately. No sign-in UI needed. | Anonymous uids are ephemeral per device/session unless persistence is configured. Users lose access if they clear browser data. |

### Recommendation

**Option 4 (Enable anonymous auth in prod)** is the pragmatic default for E4:

- It gives every session a uid without building sign-in UI.
- Lists become per-session/per-device scoped — sufficient for a single-user scouting tool.
- It's a one-line change in `useAuth.js` (remove the `import.meta.env.DEV` guard).
- When real auth is added later, anonymous accounts can be linked/upgraded via Firebase Auth's account linking.
- **Fallback**: If `userId` is still null after anonymous sign-in attempt, show empty state + "Unable to initialize session" message.

---

## 6) E4 EXECUTION REQUIREMENTS (FACTS ONLY)

These are the factual prerequisites for an E4 execution prompt. This is NOT a plan — just the inventory.

### Auth Changes Required

1. `src/shared/hooks/useAuth.js` — Anonymous sign-in guard is behind `import.meta.env.DEV`. Must be evaluated for prod enablement.
2. No sign-in UI exists. No `AuthProvider` context wraps the app.

### Ownership Field Injection (Writes)

Total unique write sites for `lists`: **6** (3 in `listHelpers.js`, 2 inline in `AddToListModal.jsx`, 1 inline in `ListManager.jsx` updates, plus 2 inline in `ListsHome.jsx`)  
Total unique write sites for `tierLists`: **4** (all in `listHelpers.js`)

Create paths that need `ownerUid` added:

- `listHelpers.createList()` — needs `ownerUid` parameter
- `AddToListModal.handleAdd()` new-list branch — needs `ownerUid` in `addDoc` payload
- `listHelpers.createTierList()` — needs `ownerUid` parameter

Update/delete paths that should verify ownership:

- `listHelpers.renameList()`, `deleteList()`, `saveTierList()`, `renameTierList()`, `deleteTierList()`
- `AddToListModal.handleAdd()` — update to existing list
- `ListManager.handleSave()` — direct updateDoc
- `ListsHome.handleRename()`, `handleDelete()` — direct updateDoc/deleteDoc

### Read Scoping (Queries)

Total unique read sites for `lists`: **5** (ListsHome, ListManager single + sidebar, AddToListModal, useFirebaseQuery in TierMakerBoard/TieramidBoard/RankingBuilder)  
Total unique read sites for `tierLists`: **4** (TierListsHome via helper, useFirebaseQuery in TierMakerBoard/TieramidBoard, fetchTierList single-doc)

Read paths that should add `where('ownerUid', '==', userId)`:

- `listHelpers.fetchAllLists()` — add optional userId param
- `listHelpers.fetchAllTierLists()` — add optional userId param
- `ListsHome.fetchLists()` — inline getDocs, scope or delegate to helper
- `AddToListModal` useEffect — inline getDocs, scope or delegate to helper
- `useFirebaseQuery` — generic hook, needs scoping support (or callers switch to dedicated helpers)

Single-doc reads (doc-level ownership check after read):

- `ListManager.fetchList()` — `getDoc(doc(db, 'lists', listId))`
- `listHelpers.fetchTierList(id)` — `getDoc(doc(db, 'tierLists', id))`

### Firestore Rules (Prepared, Not Deployed)

- Write commented-out scoped rules for `lists` and `tierLists` in `firestore.rules`.
- Keep global `if true` active for dev.
- Document the uncomment + deploy process for launch.

### `useFirebaseQuery` Hook Impact

The generic `useFirebaseQuery(collectionName)` hook is used by 3 consumers for lists data. It does not support `where` clauses. Options:

- Add optional `queryConstraints` parameter to `useFirebaseQuery`.
- Or replace those 3 call sites with dedicated scoped fetches that accept `userId`.

### Firestore Index Requirements

- `where('ownerUid', '==', userId)` on `lists` → may need composite index if combined with `orderBy`. Simple equality filter on a single field does not require a composite index.
- Same for `tierLists`.

### Legacy Doc Handling

- Existing docs in `lists` and `tierLists` will not have `ownerUid`. Options:
  - Backfill with a one-time script (set `ownerUid` to a known dev uid).
  - Treat docs without `ownerUid` as "unowned" — visible to all or to a specific fallback uid.
  - Accept that pre-E4 docs will not appear in scoped queries until manually claimed.

---

## 7) Open Questions

1. **Field name**: Should E4 use `ownerUid` (recommended, distinct from Architect's `createdBy`) or `createdBy` (consistent with Architect)? — **Non-blocking; recommend `ownerUid` for clarity.**

2. **Anonymous auth in production**: Is it acceptable to enable anonymous sign-in in production? This is the simplest path to get a uid, but anonymous accounts are ephemeral. — **Non-blocking for preflight; must be decided before execution.**

3. **Legacy doc handling**: ~How many existing docs are in `lists` and `tierLists`? Are they all dev/test data? If so, backfill or deletion is trivial. — **Can be answered during execution.**

4. **`useFirebaseQuery` modification vs replacement**: Should the generic hook gain query constraint support, or should Lists/TierMaker consumers switch to dedicated hooks? — **Architecture decision for execution prompt.**
