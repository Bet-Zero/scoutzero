# PST_EMULATOR_BASETEAMS_INTEGRITY_GUARDRAIL_EXECUTION_RETURN_PACKAGE.md

**MODE**: EXECUTION — CODE CHANGES + VALIDATION  
**DATE**: 2026-02-01  
**PHASE**: 16.2  
**STATUS**: ✅ COMPLETE

---

## Summary

Implemented a Phase 16.2 integrity guardrail that automatically detects and repairs `architect_baseTeams` documents that contain only `entitlementIds` (or are otherwise missing core fields like roster/teamName). This ensures `npm run emu` self-heals without requiring manual intervention.

---

## Problem Statement

User encountered `architect_baseTeams` documents with only `entitlementIds` field, breaking GM tools:

- Teams load with no players
- Salary totals identical across all teams
- Trade Machine shows empty rosters

Root cause: The emulator startup path was not validating baseTeams document structure, allowing a corrupted state to persist.

---

## Solution Architecture

### Integrity Check Flow

```
npm run emu
     │
     ▼
┌────────────────────────────────────────────────┐
│ seedIfMissing.ts                               │
│                                                │
│ 1. Phase 16.2 Integrity Check (FIRST)          │
│    - Sample LAL, BOS, HOU                      │
│    - Verify: teamCode, teamName, roster        │
│    - Detect entitlementIds-only corruption     │
│                                                │
│ 2. If UNHEALTHY → Auto-Repair:                 │
│    a) Reseed baseTeams from staged JSON        │
│    b) Patch entitlementIds (merge: true)       │
│    c) Re-verify integrity                      │
│                                                │
│ 3. Continue normal seed logic...               │
└────────────────────────────────────────────────┘
```

### Integrity Check Criteria

A baseTeams doc is considered **healthy** if it has:

- `teamCode`: string, length exactly 3
- `teamName`: non-empty string
- `roster`: array with length > 0

A doc is flagged as **entitlementIds-only** if:

- `entitlementIds` array exists AND
- One or more core fields (teamCode, teamName, roster) is missing

---

## Files Changed

| File                                              | Change                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `scripts/emu/seedIfMissing.ts`                    | Added `checkBaseTeamsIntegrity()` function, `repairBaseTeams()` function, integrity check at start of main() |
| `scripts/emu/runEmu.ts`                           | Added clear banner when no import metadata detected                                                          |
| `scripts/emu/doctor.ts`                           | NEW: Diagnostic command for debugging emulator state                                                         |
| `package.json`                                    | Added `emu:doctor` script                                                                                    |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | Added Phase 16.2 entry                                                                                       |

---

## New npm Scripts

| Script       | Command                         | Purpose                             |
| ------------ | ------------------------------- | ----------------------------------- |
| `emu:doctor` | `npx tsx scripts/emu/doctor.ts` | Diagnostic report of emulator state |

---

## Implementation Details

### seedIfMissing.ts Changes

1. **New constants**:

1``typescript

const SAMPLE_TEAMS_FOR_INTEGRITY = ['LAL', 'BOS', 'HOU'];

````

1. **New interface**:

```typescript
interface BaseTeamsIntegrityResult {
  healthy: boolean;
  reason: string;
  details: Array<{
    teamCode: string;
    hasTeamCode: boolean;
    hasTeamName: boolean;
    hasRoster: boolean;
    rosterLength: number;
    hasEntitlementIds: boolean;
1   isEntitlementIdOnly: boolean;

  }>;
}
````

1

1. **New functions**:

- `checkBaseTeamsIntegrity()`: Samples 3 teams, verifies required fields
- `repairBaseTeams()`: Runs reseed + patch + re-verify

1. **Updated main()**:

- Integrity check runs FIRST before any other seed logic
- Auto-repair triggers if unhealthy
- Final integrity verification after all seeding

### doctor.ts (New File)

Provides diagnostic output:

- projectId
- FIRESTORE_EMULATOR_HOST
- Collection counts for all base collections
- BaseTeams integrity check (same logic as seedIfMissing)
- Final OK/NEEDS REPAIR verdict

---

## Validation Results

### Test 1: Fresh Start with Corruption

**Setup**: baseTeams docs had only `entitlementIds`

**Log output**:

```
[seed] checking baseTeams integrity (Phase 16.2 guardrail)...
[seed] ⚠️  baseTeams integrity FAILED: doc missing: LAL, BOS, HOU
[seed:repair] baseTeams integrity failed — starting auto-repair...
[seed:repair] Step 1/3: Reseeding baseTeams from staged JSON...
[reseed:baseTeams] ✅ 30 team docs restored with full data
[seed:repair] Step 2/3: Patching entitlementIds onto baseTeams...
🎉 Base teams patch complete.

[seed:repair] Step 3/3: Verifying repair...
[seed:repair] ✅ baseTeams repair complete — integrity verified
```

### Test 2: Corruption Simulation

**Action**: Wrote LAL doc with only `{ entitlementIds: ['test-ent-1'] }`

**Doctor output (before repair)**:

```
🔍 BaseTeams Integrity Check (Phase 16.2):
   LAL: ⚠️  ENTITLEMENT-ONLY (roster=0, entitlementIds=yes)

   BOS: ✅ (roster=17, entitlementIds=yes)
   HOU: ✅ (roster=17, entitlementIds=yes)

   baseTeamsHealthy: ❌ false
   reason: doc missing: LAL

RESULT: ❌ NEEDS REPAIR
```

**After running seedIfMissing**:

```
🔍 BaseTeams Integrity Check (Phase 16.2):
   LAL: ✅ (roster=17, entitlementIds=yes)
   BOS: ✅ (roster=17, entitlementIds=yes)
   HOU: ✅ (roster=17, entitlementIds=yes)

   baseTeamsHealthy: ✅ true

RESULT: ✅ OK — Emulator data is healthy
```

### Test 3: Build Verification

```
npm run build
✓ built in 35.65s
```

---

## ProjectId Consistency Audit

All emulator scripts use consistent projectId:

- `scripts/emu/adminEmu.ts`: `FALLBACK_PROJECT_ID = 'scoutzero-bf1ae'`
- `scripts/emu/runEmu.ts`: `FALLBACK_PROJECT_ID = 'scoutzero-bf1ae'`
- PST scripts: `EMULATOR_FALLBACK_PROJECT_ID = 'scoutzero-bf1ae'`

All scripts use the same env variable priority chain:

```typescript
GCLOUD_PROJECT ?? FIREBASE_PROJECT ?? PROJECT_ID ?? FALLBACK_PROJECT_ID;
```

---

## Acceptance Criteria Checklist

- [x] `npm run emu` automatically detects and repairs entitlementIds-only baseTeams docs
- [x] BaseTeams integrity check is deterministic and logged once (not noisy)
- [x] Repair uses consistent emulator projectId namespace
- [x] After repair, GM tools load rosters properly (roster arrays present)
- [x] Return package written + master doc updated
- [x] Build passes (npm run build)

---

## Next Steps

None required. The guardrail is production-ready and will self-heal on every emulator start.

---

## Related Documentation

- Master Plan: `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` (Phase 16.2)
- Emulator README: `scripts/emu/README.md`
- Prior fix: `PST_EMULATOR_BASETEAMS_PROJECTID_FIX_RETURN_PACKAGE.md`
