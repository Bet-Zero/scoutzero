# Firestore Rules Flip Checklist — Lists Launch-Secure Mode

**Date**: 2026-02-09  
**Feature**: Lists (Player Lists + Tier Lists)  
**Status**: Pre-launch checklist — do not execute until ready for production hardening

---

## What This Changes

### Enforcement Summary

When you uncomment the launch-secure rules block and deploy, Firestore will enforce:

- **`/lists/{listId}`** — read/write restricted to documents where `ownerUid == request.auth.uid`
- **`/tierLists/{tierListId}`** — read/write restricted to documents where `ownerUid == request.auth.uid`

### What Becomes Enforced

1. **Ownership scoping**: Users can only see, edit, or delete their own lists.
2. **Auth requirement**: All operations require a valid `request.auth.uid` (anonymous or real).
3. **Auto-claim migration**: Update rule allows legacy docs without `ownerUid` to be claimed on first access by setting `ownerUid` to the current user's uid.

### What Remains Dev-Open (If You Keep the Wildcard)

If you leave the dev-open wildcard enabled:

```javascript
match /{document=**} {
  allow read, write: if true;
}
```

**All collections remain globally accessible**, including:

- `/players_v2` (read-only in app code, but rules allow write)
- `/architect_worlds`, `/teams`, and any other collections
- Lists and tier lists will still be accessible despite the commented rules above them (wildcard takes precedence)

**⚠️ CRITICAL**: You **must remove or comment out** the dev-open wildcard to enforce the launch-secure rules. Otherwise, the wildcard overrides everything.

---

## Preconditions (✅ Check Before Flip)

Before deploying rules, verify these conditions in your environment:

### 1. Firebase Auth — Anonymous Sign-In Enabled

**Check in Firebase Console**:

1. Navigate to **Authentication** → **Sign-in method**
2. Confirm **Anonymous** is **Enabled**
3. Verify the toggle is green and says "Enabled"

**Why this matters**: If anonymous auth is disabled, all `request.auth` will be `null`, and all requests will be denied.

### 2. `ownerUid` Exists on New Docs

**Verify in app**:

1. Create a new list in your production build (or staging)
2. Open Firebase Console → **Firestore Database** → `lists` collection
3. Click the newly created doc
4. Confirm the document has an `ownerUid` field with a non-null value

**Why this matters**: E4 added `ownerUid` to all creation paths, but if you deployed before E4 or reverted, new docs won't have ownership and will be inaccessible after rules flip.

### 3. App Not Relying on Global/Shared Lists

**Verify in code + behavior**:

- No features pass lists between users or sessions
- No shared "public list" features exist (they don't in current codebase)
- Test: Clear browser data → new session → confirm you **don't** see old lists (this is expected E4+ behavior)

**Why this matters**: Once rules are enforced, cross-user list access becomes impossible. If your app assumes lists are global, it will break.

### 4. Production Build Anonymous Auth Working

**Test locally**:

```bash
npm run build
npm run preview  # Vite preview server
```

1. Open browser → navigate to `http://localhost:4173`
2. Open DevTools → Console
3. Look for anonymous auth success (no "Failed to sign in anonymously" errors)
4. Create a list → refresh page → confirm list persists

**Why this matters**: If anonymous auth fails silently in production, users will get stuck with `userId = null` and all operations will fail.

---

## The Exact Rules Edit

### Step-by-Step Instructions

1. **Open `firestore.rules` in your editor**

2. **Locate the commented LAUNCH-SECURE block** (starts around line 11):

   ```javascript
   // ═══════════════════════════════════════════════════════════════════
   // LAUNCH-SECURE RULES — E4 Ownership Scoping
   // Uncomment these blocks AND remove the dev-open wildcard below
   // ...
   ```

3. **Uncomment lines 15-69** (the two `match` blocks for `/lists` and `/tierLists`):

   ```javascript
   match /lists/{listId} {
     // Read: only your own lists
     allow read: if request.auth != null
       && resource.data.ownerUid == request.auth.uid;

     // Create: must be authenticated and ownerUid must match your uid
     allow create: if request.auth != null
       && request.resource.data.ownerUid == request.auth.uid;

     // Update: owner can update, OR auto-claim if ownerUid is missing
     allow update: if request.auth != null
       && (
         resource.data.ownerUid == request.auth.uid
         || (
           !('ownerUid' in resource.data)
           && request.resource.data.ownerUid == request.auth.uid
         )
       );

     // Delete: only owner
     allow delete: if request.auth != null
       && resource.data.ownerUid == request.auth.uid;
   }

   match /tierLists/{tierListId} {
     // Read: only your own tier lists
     allow read: if request.auth != null
       && resource.data.ownerUid == request.auth.uid;

     // Create: must be authenticated and ownerUid must match your uid
     allow create: if request.auth != null
       && request.resource.data.ownerUid == request.auth.uid;

     // Update: owner can update, OR auto-claim if ownerUid is missing
     allow update: if request.auth != null
       && (
         resource.data.ownerUid == request.auth.uid
         || (
           !('ownerUid' in resource.data)
           && request.resource.data.ownerUid == request.auth.uid
         )
       );

     // Delete: only owner
     allow delete: if request.auth != null
       && resource.data.ownerUid == request.auth.uid;
   }
   ```

4. **Comment out or delete the dev-open wildcard** (lines ~72-74):

   **BEFORE**:

   ```javascript
   // DEV-OPEN: All operations allowed (remove when enabling launch-secure rules above)
   match /{document=**} {
     allow read, write: if true;
   }
   ```

   **AFTER** (option 1 — comment out):

   ```javascript
   // DEV-OPEN: All operations allowed (remove when enabling launch-secure rules above)
   // match /{document=**} {
   //   allow read, write: if true;
   // }
   ```

   **AFTER** (option 2 — delete entirely):

   _(Remove the entire block)_

5. **Save the file**

---

## Deploy Steps

### Production Deploy

1. **Ensure you're on the correct Firebase project**:

   ```bash
   firebase use production  # or your production alias
   firebase projects:list   # confirm active project
   ```

2. **Deploy rules only** (does not deploy hosting, functions, etc.):

   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Expected output**:

   ```
   === Deploying to 'your-project-id'...

   i  firestore: checking firestore.rules for compilation errors...
   ✔  firestore: rules file firestore.rules compiled successfully
   i  firestore: uploading rules firestore.rules...
   ✔  firestore: released rules firestore.rules to cloud.firestore

   ✔  Deploy complete!
   ```

4. **Deployment takes ~10-30 seconds** — rules are live immediately after success message.

### Staging/Dev Deploy (Optional)

If you have a staging project, deploy there first:

```bash
firebase use staging
firebase deploy --only firestore:rules
```

Run smoke tests in staging before deploying to production.

---

## Smoke Tests (✅ Must Pass)

Run these tests **immediately after deploying rules** to confirm enforcement is working correctly.

### Test 1: Create List → Persists → Visible After Refresh

1. Navigate to `/lists`
2. Click "+ New List"
3. Enter a name, click "Create"
4. **Expected**: List appears in the grid
5. Refresh the page
6. **Expected**: List still appears (not a permission error)

**If this fails**: Check Console for "Missing or insufficient permissions" → see Failure Modes below.

### Test 2: Add Player to List → Persists

1. Navigate to `/players`
2. Click "Add to List" on any player
3. Select a list from the dropdown
4. **Expected**: "Player added" toast
5. Refresh `/lists/:listId`
6. **Expected**: Player appears in the list

**If this fails**: Check if `ownerUid` is set on the list doc in Firestore Console.

### Test 3: Rename/Delete List → Works

1. Open `/lists`
2. Click the edit icon on a list → rename it
3. **Expected**: Name updates, toast confirms
4. Click the delete icon
5. **Expected**: List removed from grid

**If this fails**: Check Console for `ownerUid` mismatch errors.

### Test 4: Create Tier List → Save/Load → Works

1. Navigate to `/tier-lists`
2. Create a new tier list
3. Open it in `/tier-maker/:tierListId`
4. Add players to tiers, click "Save"
5. Refresh the page
6. **Expected**: Tiers persist, no permission errors

### Test 5: Cross-User Test (Isolation Verification)

**Simulate a new user**:

1. Open DevTools → **Application** (Chrome) or **Storage** (Firefox)
2. Clear **Cookies**, **Local Storage**, **Session Storage**, **IndexedDB**
3. Reload the page (this triggers a new anonymous auth session)
4. Navigate to `/lists`
5. **Expected**: No lists visible (old session's lists are now scoped out)
6. Create a new list
7. **Expected**: New list visible and functional

**Alternative**: Open an Incognito/Private window → same behavior.

**Why this matters**: Confirms per-session ownership is working. If old lists are still visible, rules are not enforced (wildcard still enabled or rules not deployed).

---

## Rollback Plan

If something goes wrong and you need to revert immediately:

### Option 1: Re-Enable Dev-Open Wildcard

1. **Edit `firestore.rules`**:

   Uncomment (or re-add) the wildcard:

   ```javascript
   match /{document=**} {
     allow read, write: if true;
   }
   ```

2. **Deploy**:

   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Effect**: All collections become globally accessible again. Lists will work for all users regardless of `ownerUid`.

### Option 2: Restore from Backup

1. **Copy `firestore.rules.backup`** (if it exists):

   ```bash
   cp firestore.rules.backup firestore.rules
   ```

2. **Deploy**:

   ```bash
   firebase deploy --only firestore:rules
   ```

### Option 3: Git Revert

If rules are in git:

```bash
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules
```

**Rollback takes ~10-30 seconds** after deploy completes.

---

## Failure Modes + Diagnosis

### 1. "Missing or null auth" → Requests Denied

**Symptom**: All list operations fail with `FirebaseError: Missing or insufficient permissions`.

**Causes**:

- Anonymous auth is disabled in Firebase Console
- Anonymous sign-in failed silently (check Console for errors)
- `request.auth.uid` is `null` for some reason

**Diagnosis**:

1. Open DevTools → Console
2. Look for: `"Failed to sign in anonymously"` or `"Anonymous auth is disabled"`
3. Check Firebase Console → **Authentication** → **Sign-in method** → confirm Anonymous is **Enabled**

**Fix**:

- Enable Anonymous auth in Console
- Redeploy app if `useAuth.js` has the old DEV guard (it should not post-E4)
- If still failing, rollback rules and investigate auth setup

### 2. "Lists Disappear" → No `ownerUid` on Docs

**Symptom**: After rules flip, all existing lists disappear. New lists work fine.

**Cause**: Lists were created **before E4** without `ownerUid` field.

**Diagnosis**:

1. Open Firebase Console → **Firestore Database** → `lists` collection
2. Click on a doc that disappeared
3. Check if `ownerUid` field exists
4. If missing → this doc is inaccessible until claimed

**Fix (auto-claim)**:

E4 rules include an auto-claim migration case in the update rule:

```javascript
allow update: if request.auth != null
  && (
    resource.data.ownerUid == request.auth.uid
    || (
      !('ownerUid' in resource.data)
      && request.resource.data.ownerUid == request.auth.uid
    )
  );
```

**To trigger auto-claim**:

1. Temporarily rollback rules (re-enable wildcard)
2. User opens the list → app adds `ownerUid` via `claimOwnershipIfMissing` helper
3. Re-deploy launch-secure rules
4. List should now be visible

**Bulk migration** (if many legacy docs exist):

- Write a one-off script to add `ownerUid` to all docs without it (set to a default admin uid or mark as "unclaimed")
- Not required if you don't have pre-E4 docs in production

### 3. "Permission Denied on Rename/Save" → Ownership Mismatch

**Symptom**: Can see a list, but rename/delete/save fails with permission error.

**Cause**: The list's `ownerUid` does not match the current user's `request.auth.uid`.

**Diagnosis**:

1. Open Console → look for: `"User X attempted to modify list owned by Y"`
2. Confirm in Firestore Console: list doc `ownerUid` ≠ your current session uid

**Fix**:

- If this is a shared environment (multiple team members), each user must create their own lists
- If you're testing cross-device, you'll get a new anonymous uid per device (expected behavior)
- If you need to transfer ownership, manually update `ownerUid` in Firestore Console (not recommended for production)

### 4. "Anonymous Auth Blocked in Firebase Console"

**Symptom**: Auth initialization works locally but fails in production.

**Cause**: Firebase project settings differ between environments.

**Diagnosis**:

```bash
firebase use production  # switch to prod project
firebase projects:list   # confirm active project
```

1. Open Console for **that specific project**
2. **Authentication** → **Sign-in method**
3. Check Anonymous status

**Fix**: Enable Anonymous for the production project.

### 5. Console Logs to Look For

**Success indicators**:

```
Anonymous sign-in successful
User signed in: <uid>
List created successfully
```

**Failure indicators**:

```
FirebaseError: Missing or insufficient permissions
Failed to sign in anonymously
PERMISSION_DENIED: Missing or insufficient permissions
User <uid> attempted to modify list owned by <other-uid>
```

**Debugging tip**: Add `console.log(userId)` in `ListsHome.jsx` or `TierListsHome.jsx` to confirm auth is working before lists load.

---

## Post-Flip Validation Checklist

After deploying, confirm:

- [ ] All 5 smoke tests pass
- [ ] No permission errors in Console
- [ ] Anonymous auth is visible in Firebase Console → **Authentication** → **Users** tab (new anonymous users should appear)
- [ ] Lists from old sessions are **not** visible in new sessions (expected behavior)
- [ ] Dev team can still create/edit/delete their own lists
- [ ] Firestore Console shows new list docs have `ownerUid` field populated

---

## Additional Notes

### When to Flip Rules

**Recommended**: Flip rules **after** verifying E4 app changes are deployed and stable in production for at least 24-48 hours.

**Why wait**: If you flip rules before E4 app changes are deployed, users will get stuck with permission errors because the app doesn't write `ownerUid` yet.

### What Happens to Existing Users

- **Post-E4, pre-rules-flip**: All users see all lists (no scoping, but `ownerUid` is written on new docs)
- **Post-rules-flip**: Users only see their own lists. Old lists without `ownerUid` are invisible until auto-claimed or migrated.

### Long-Term Considerations

- **Anonymous auth is ephemeral**: If a user clears browser data or switches devices, they lose access to their lists (new uid assigned)
- **Transition to real auth**: When you add email/Google sign-in, implement **account linking** to preserve anonymous user data
- **Shared lists feature**: Would require a separate permissions model (e.g., `sharedWith: [uid1, uid2]` array field + rules update)

---

## References

- **E4 Ownership Implementation**: `return_packages/lists/EXECUTION_E4_ownership_auth_scoping.md`
- **Lists Master Doc**: `docs/features/lists_MASTER.md`
- **Firestore Rules File**: `firestore.rules`
- **Auth Hook**: `src/shared/hooks/useAuth.js`
- **List Helpers (ownership logic)**: `src/firebase/listHelpers.js`
- **Firebase Deploy Docs**: <https://firebase.google.com/docs/cli#deployment>

---

**END OF CHECKLIST**
