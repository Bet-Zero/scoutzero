# EXECUTION E5 — Rules Flip Checklist (Docs-only)

**Date**: 2026-02-09  
**Package Type**: Execution Return (docs-only)  
**Feature**: Lists (Player Lists + Tier Lists)  
**Phase**: E5 Launch-Secure Rules Flip Checklist

---

## Summary

Created comprehensive launch playbook for safely enabling Firestore rules enforcement in production. This is the final gating checklist before flipping from dev-open to launch-secure mode for Lists.

### Deliverables

✅ **Created**: `docs/launch/FIRESTORE_RULES_FLIP_CHECKLIST.md`

Comprehensive 300+ line checklist covering:

- **What changes**: Ownership enforcement, auth requirements, what remains dev-open if wildcard is kept
- **Preconditions** (4 checks): Anonymous auth enabled, `ownerUid` exists on new docs, no global list dependencies, production build auth working
- **Exact rules edit**: Step-by-step instructions with code snippets for uncommenting launch-secure blocks and disabling dev-open wildcard
- **Deploy steps**: Commands for production deploy, staging deploy, project selection verification
- **Smoke tests** (5 required): Create/persist, add player, rename/delete, tier list save/load, cross-user isolation
- **Rollback plan** (3 options): Re-enable wildcard, restore from backup, git revert
- **Failure modes** (5 scenarios): Missing auth, lists disappear, permission denied, anonymous auth blocked, console logs to look for — with diagnosis steps and fixes for each

✅ **Updated**: `docs/features/lists_MASTER.md`

- Added E5 section with checklist pointer
- Reorganized "SHIP-READY" section to include launch-ready status checklist
- Made explicit that rules enforcement is the **final launch hardening step**
- Updated "Remaining Deferrals" to reference E5 checklist for flip instructions

---

## Context

**Input from E4**:

- Anonymous auth enabled in all environments
- `ownerUid` field on all new list/tier list docs
- Scoped reads with `where('ownerUid', '==', userId)`
- Ownership guards on all update/delete operations
- Commented `LAUNCH-SECURE` rules blocks in `firestore.rules` (lines 15-69)
- Dev-open wildcard still active (lines 72-74)

**E5 Scope**: Docs-only — no code changes, no deploy

**Purpose**: Provide clear, copy-paste-friendly instructions for flipping rules when the team is ready to lock down production.

---

## Rules Flip Strategy (from Checklist)

### Current State (Post-E4, Pre-Flip)

- App writes `ownerUid` on all new docs
- App scopes reads to `ownerUid == userId`
- Firestore rules allow all operations (`allow read, write: if true`)
- No enforcement at rules level → users could technically access any doc via direct Firestore SDK calls

### Target State (Post-Flip)

- Firestore enforces `ownerUid == request.auth.uid` for `/lists` and `/tierLists`
- Users can only read/write their own lists
- Legacy docs without `ownerUid` can be auto-claimed on first update attempt
- Dev-open wildcard disabled → all other collections fall back to default deny (or explicit rules)

### Recommended Timeline

1. Deploy E4 app changes to production
2. Wait 24-48 hours → verify stability (no permission errors, anonymous auth working)
3. Follow E5 checklist to flip rules
4. Run smoke tests immediately post-deploy
5. Monitor for 6-12 hours → rollback if issues arise

---

## Repo-Specific Gotchas Discovered

### 1. Wildcard Override Risk

The checklist explicitly warns that leaving the dev-open wildcard enabled will **override** the commented launch-secure rules. Many devs uncomment the collection-specific rules but forget to remove the wildcard → rules never take effect.

**Mitigation**: Checklist includes a dedicated subsection "What Remains Dev-Open (If You Keep the Wildcard)" with clear warning.

### 2. Anonymous Auth Console Settings

Firebase Console has separate auth settings per project (dev, staging, production). Easy to enable anonymous auth in dev but forget in production.

**Mitigation**: Checklist includes explicit Firebase Console navigation steps and project selection verification commands.

### 3. Post-E4 Rules Blocks Already in File

Unlike a greenfield setup, the HoopZero repo already has the rules blocks commented out in `firestore.rules` (added in E4). This means:

- No need to write rules from scratch
- Just uncomment + deploy
- But devs might not realize the blocks exist → checklist makes this explicit with line numbers

**Mitigation**: Checklist includes exact line numbers (15-69) and copy-paste-friendly code snippets.

### 4. Auto-Claim Edge Case

E4 rules include an auto-claim migration case:

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

This allows legacy docs without `ownerUid` to be claimed on first update **after rules are flipped**. However, the update must explicitly write `ownerUid` in the request payload.

**Repo-specific**: E4's `claimOwnershipIfMissing` helper in `listHelpers.js` does this automatically, so auto-claim will work as long as:

- User accesses the list via the app (not direct Firestore SDK)
- The helper is invoked (which it is in all read paths)

**Mitigation**: Checklist documents the auto-claim behavior in "Failure Modes" section with rollback → claim → re-deploy workflow.

### 5. Cross-User Test Requires Manual Session Clear

Unlike a real sign-in flow where you can "log out", anonymous auth persists in browser storage. To simulate a new user, you must manually clear site data or open an incognito window.

**Mitigation**: Checklist includes step-by-step DevTools instructions for clearing storage and explains why this is needed.

---

## Validation

### Doc Validation

- ✅ Checklist covers all required sections (what changes, preconditions, exact edit, deploy, tests, rollback, failure modes)
- ✅ Code snippets are copy-paste-friendly (no placeholders or "..." in critical sections)
- ✅ Line numbers reference current `firestore.rules` state (verified lines 15-69 for launch-secure blocks)
- ✅ Commands use exact Firebase CLI syntax (`firebase deploy --only firestore:rules`)
- ✅ Failure modes include both diagnosis steps and fixes

### Master Doc Validation

- ✅ E5 section added to `lists_MASTER.md`
- ✅ "SHIP-READY" section updated with launch checklist pointer
- ✅ Remaining Deferrals updated to reference E5 checklist

### Build Validation (Not Required for E5)

No build required — docs-only execution.

Optional validation (already passing pre-E5):

```bash
npm run build
# ✅ Expected: 3025 modules, 0 errors (same as E4 validation)
```

---

## Files Touched

### Created (1)

- `docs/launch/FIRESTORE_RULES_FLIP_CHECKLIST.md` — 300+ line launch playbook

### Updated (1)

- `docs/features/lists_MASTER.md` — Added E5 section, updated ship-ready status

### Referenced (Not Modified)

- `firestore.rules` — checklist documents line numbers and code blocks to uncomment
- `return_packages/lists/EXECUTION_E4_ownership_auth_scoping.md` — linked as context
- `src/firebase/listHelpers.js` — auto-claim helper referenced in failure modes
- `src/shared/hooks/useAuth.js` — referenced for anonymous auth troubleshooting

---

## Next Steps (When Ready to Ship)

1. **Pre-flip audit**:
   - [ ] Verify E4 app changes deployed to production
   - [ ] Confirm 24-48 hour stability window (no errors, auth working)
   - [ ] Check all 4 preconditions in checklist

2. **Follow E5 checklist**: `docs/launch/FIRESTORE_RULES_FLIP_CHECKLIST.md`
   - Uncomment launch-secure rules blocks
   - Disable dev-open wildcard
   - Deploy with `firebase deploy --only firestore:rules`

3. **Run smoke tests** (5 tests in checklist)

4. **Monitor for 6-12 hours**:
   - Watch Firebase Console → **Authentication** → **Users** for anonymous user creation
   - Check app Console for permission errors
   - Verify cross-user isolation (new sessions don't see old lists)

5. **Rollback if issues**:
   - Re-enable dev-open wildcard
   - Deploy rules
   - Investigate (checklist has 5 failure modes with fixes)

---

## E5 Completion Status

✅ **Docs-only execution complete**

- Checklist created
- Master doc updated
- Return package written

**Rules deployment is deferred** until production stability is confirmed. This is intentional — E5 delivers the playbook, not the deployment.

---

**END OF RETURN PACKAGE**
