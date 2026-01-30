# PST Emulator BaseTeams ProjectId Fix Return Package

**Date**: 2026-01-30
**Type**: Bug Fix
**Status**: ✅ Complete

---

## Summary

Fixed the projectId mismatch that caused `npm run emu:repair:teams` to write to a different Firestore namespace than the running emulator, resulting in `architect_baseTeams` documents appearing with only `entitlementIds` in the Emulator UI.

---

## Root Cause

Multiple emulator scripts were using `'demo-scoutzero'` as their fallback projectId while:

1. `runEmu.ts` uses `'scoutzero-bf1ae'`
2. PST phase 10 scripts (`pst_phase_10_patch_base_teams_entitlements.ts` and `pst_phase_10_push_base_entitlements.ts`) were using serviceAccountKey.json credentials instead of emulator mode

This caused writes to go to `demo-scoutzero` namespace while the Emulator UI displayed the `scoutzero-bf1ae` namespace.

---

## Files Changed

### Created

| File                         | Purpose                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `scripts/emu/adminEmu.ts`    | Shared Admin SDK initialization with consistent projectId for all emulator scripts |
| `scripts/emu/repairTeams.ts` | New repair script with verification that replaces shell command chain              |

### Modified

| File                                                                                | Change                                                                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `scripts/emu/reseedBaseTeams.ts`                                                    | Use `adminEmu.ts` helper instead of local init with wrong fallback                                        |
| `scripts/emu/reseedEntitlements.ts`                                                 | Use `adminEmu.ts` helper instead of local init with wrong fallback                                        |
| `scripts/emu/seedIfMissing.ts`                                                      | Use `adminEmu.ts` helper instead of local init with wrong fallback                                        |
| `scripts/emu/seedPlayersIfMissing.ts`                                               | Use `adminEmu.ts` helper instead of local init with wrong fallback                                        |
| `scripts/emu/runEmu.ts`                                                             | Export all projectId env variants (`GCLOUD_PROJECT`, `FIREBASE_PROJECT`, `PROJECT_ID`) to child processes |
| `team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts` | Added emulator mode detection - uses projectId when `FIRESTORE_EMULATOR_HOST` is set                      |
| `team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts`        | Added emulator mode detection - uses projectId when `FIRESTORE_EMULATOR_HOST` is set                      |
| `package.json`                                                                      | Updated `emu:repair:teams` to use new `repairTeams.ts` script                                             |

---

## Key Changes

### 1. Shared Admin SDK Helper (`adminEmu.ts`)

Created a single source of truth for Admin SDK initialization in emulator mode:

```typescript
// Priority order for projectId:
// 1) GCLOUD_PROJECT
// 2) FIREBASE_PROJECT
// 3) PROJECT_ID
// 4) fallback: 'scoutzero-bf1ae'

export const initAdminEmu = () => {
  // Throws if FIRESTORE_EMULATOR_HOST not set
  // Returns { db, projectId }
};
```

### 2. runEmu.ts Environment Export

Now exports all projectId variants to ensure any child script picks up the correct value:

```typescript
const EMULATOR_ENV = {
  ...process.env,
  GCLOUD_PROJECT: PROJECT_ID,
  FIREBASE_PROJECT: PROJECT_ID,
  FIREBASE_PROJECT_ID: PROJECT_ID,
  PROJECT_ID: PROJECT_ID,
  // ... emulator hosts
};
```

### 3. PST Phase 10 Scripts Emulator Support

Both push and patch scripts now detect emulator mode:

```typescript
function isEmulatorMode(): boolean {
  return !!process.env.FIRESTORE_EMULATOR_HOST;
}

// If emulator mode: use projectId from env
// If production mode: use serviceAccountKey.json
```

### 4. New Repair Script with Verification

`repairTeams.ts` runs the repair sequence and verifies the result:

1. Reseed baseTeams from staged JSON
2. Patch entitlementIds
3. Verify LAL document contains `teamCode`, `teamName`, and `roster` fields
4. Exit nonzero if verification fails

---

## Verification Commands

```bash
# Terminal 1: Start emulator
npm run emu

# Terminal 2: Run repair and verify
npm run emu:repair:teams
```

### Expected Output

```
[emu-admin] Using projectId=scoutzero-bf1ae FIRESTORE_EMULATOR_HOST=127.0.0.1:8082
[repair] === REPAIR ARCHITECT_BASETEAMS ===
[repair] projectId: scoutzero-bf1ae
[repair] Step 1: Reseeding baseTeams from staged JSON...
[reseed:baseTeams] === RESEED ARCHITECT_BASETEAMS ===
[reseed:baseTeams] projectId: scoutzero-bf1ae
...
[repair] Step 2: Patching entitlementIds onto baseTeams...
[patch] Emulator mode: projectId=scoutzero-bf1ae
...
[repair] Step 3: Verifying final state...
[repair] ✅ Verified LAL has teamName + roster fields

=== REPAIR COMPLETE ===
[repair] ✅ architect_baseTeams restored with full data
```

### Emulator UI Verification

Navigate to `http://127.0.0.1:4000/firestore` and check:

- `architect_baseTeams/LAL` contains full data (teamCode, teamName, roster, entitlementIds)
- Not just `entitlementIds` field

---

## Acceptance Criteria

| Criterion                                                       | Status |
| --------------------------------------------------------------- | ------ |
| `emu:repair:teams` writes to same namespace as `npm run emu`    | ✅     |
| All seed scripts log projectId at start                         | ✅     |
| Emulator UI shows full baseTeams data after repair              | ✅     |
| Repair script includes verification step                        | ✅     |
| No scripts write to `demo-scoutzero` unless explicitly intended | ✅     |

---

## Notes

- The canonical projectId for local development is `scoutzero-bf1ae`
- All emulator scripts now use `scripts/emu/adminEmu.ts` for consistent initialization
- PST phase 10 scripts remain backward compatible with production (service account) mode
