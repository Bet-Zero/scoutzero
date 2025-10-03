# Firestore Migration - Visual Flow Diagram

## Migration Process Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 1: PREPARATION                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────┐
                   │  Review Migration │
                   │   Documentation   │
                   └──────────────────┘
                              │
                              ▼
                   ┌──────────────────┐
                   │  Setup Firebase  │
                   │   Credentials    │
                   └──────────────────┘
                              │
                              ▼
                   ┌──────────────────┐
                   │  Create Backup   │
                   │  of Firestore    │
                   └──────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      PHASE 2: TESTING                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────┐
                   │   Step 1: DRY    │
                   │   RUN TEST (5)   │
                   │  --dry-run       │
                   └──────────────────┘
                              │
                        Success? ────No───┐
                              │           │
                             Yes          │
                              ▼           │
                   ┌──────────────────┐   │
                   │   Step 2: Shadow │   │
                   │   Test (10)      │   │
                   │   --shadow       │   │
                   └──────────────────┘   │
                              │           │
                        Success? ────No───┤
                              │           │
                             Yes          │
                              ▼           │
                   ┌──────────────────┐   │
                   │   Step 3: Full   │   │
                   │   Shadow (All)   │   │
                   │   --shadow       │   │
                   └──────────────────┘   │
                              │           │
                              ▼           │
                   ┌──────────────────┐   │
                   │  Step 4: Manual  │   │
                   │   Validation     │   │
                   └──────────────────┘   │
                              │           │
                        Valid? ─────No────┤
                              │           │
                             Yes          │
┌─────────────────────────────────────────│───────────────────────┐
│                 PHASE 3: EXECUTION      │                       │
└─────────────────────────────────────────│───────────────────────┘
                              │           │
                              ▼           │
                   ┌──────────────────┐   │
                   │   Step 5: LIVE   │   │
                   │   Migration      │   │
                   │   (DANGER!)      │   │
                   └──────────────────┘   │
                              │           │
                        Success? ────No───┤
                              │           │
                             Yes          │
                              ▼           │
┌─────────────────────────────────────────│───────────────────────┐
│              PHASE 4: DEPLOYMENT        │                       │
└─────────────────────────────────────────│───────────────────────┘
                              │           │
                              ▼           │
                   ┌──────────────────┐   │
                   │  Step 6: Update  │   │
                   │  Frontend Code   │   │
                   └──────────────────┘   │
                              │           │
                              ▼           │
                   ┌──────────────────┐   │
                   │  Step 7: Deploy  │   │
                   │  and Monitor     │   │
                   └──────────────────┘   │
                              │           │
                             \/           │
                   ┌──────────────────┐   │
                   │    SUCCESS! 🎉   │   │
                   └──────────────────┘   │
                                          │
                              ┌───────────┘
                              │
                              ▼
                   ┌──────────────────┐
                   │  FIX ISSUES &    │
                   │  TRY AGAIN       │
                   └──────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    OLD STRUCTURE (FLAT)                         │
│  Collection: players                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Read from Firestore
                              ▼
                   ┌──────────────────┐
                   │  migrate_phase1  │
                   │      .cjs        │
                   └──────────────────┘
                              │
                              │ Apply mappings
                              ▼
                   ┌──────────────────┐
                   │  mapping_phase1  │
                   │   _FINAL.json    │
                   │  (174 mappings)  │
                   └──────────────────┘
                              │
                              │ Transform data
                              ▼
                   ┌──────────────────┐
                   │   transforms.js  │
                   │ (14 functions)   │
                   └──────────────────┘
                              │
                              │ Validate result
                              ▼
                   ┌──────────────────┐
                   │ validate_target  │
                   │      .js         │
                   └──────────────────┘
                              │
                              │ Write to Firestore
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              NEW STRUCTURE (HIERARCHICAL)                       │
│  Collection: players_v2 or players_v2_shadow                    │
└─────────────────────────────────────────────────────────────────┘
```

## Data Transformation Visual

```
INPUT (Legacy Flat Structure)                  OUTPUT (New Hierarchical)
┌──────────────────────────┐                  ┌──────────────────────────┐
│ player_id                │                  │ bio/                     │
│ display_name       ──────┼──────────────────┼──> displayName           │
│ Position           ──────┼──────────────────┼──> position              │
│ AGE                ──────┼──────────────────┼──> age                   │
│ HT "6-10"          ──────┼──Transform───────┼──> height: 82 (inches)   │
│ WT                 ──────┼──────────────────┼──> weight                │
│                          │                  │                          │
│ traits/            ──────┼──────────────────┼──> evaluations/          │
│   Shooting         ──────┼──────────────────┼───> traits/              │
│   Passing          ──────┼──────────────────┼───> Shooting             │
│   ...              ──────┼──────────────────┼───> Passing              │
│                          │                  │                          │
│ roles/             ──────┼──────────────────┼──> evaluations/          │
│   offense1         ──────┼──────────────────┼───> roles/               │
│   defense1         ──────┼──────────────────┼───> offense1             │
│   ...              ──────┼──────────────────┼───> defense1             │
│                          │                  │                          │
│ contract/          ──────┼──────────────────┼──> contracts/            │
│   total_value      ──────┼──────────────────┼───> std_202425/          │
│   annual_salaries  ──────┼──────────────────┼───> contractValue        │
│   ...              ──────┼──────────────────┼───> salariesByYear       │
│                          │                  │                          │
│ system/stats/      ──────┼──────────────────┼──> seasons/              │
│   PTS              ──────┼──────────────────┼───> 2025-26/             │
│   FG% "46%"        ──────┼──Transform───────┼───> stats/               │
│   ...              ──────┼──────────────────┼───> PTS                  │
│                          │                  │───> FG%: 0.46 (decimal)  │
└──────────────────────────┘                  └──────────────────────────┘
```

## Collection Structure Before & After

```
BEFORE MIGRATION:
Firebase Firestore
└── players/
    ├── wendell_carter_jr/
    │   ├── display_name: "Wendell Carter Jr"
    │   ├── AGE: 26
    │   ├── Position: "Center-Forward"
    │   ├── traits: {...}
    │   ├── contract: {...}
    │   └── system: {stats: {...}}
    ├── luka_doncic/
    └── ... (450+ players)

DURING SHADOW TESTING:
Firebase Firestore
├── players/ (original - unchanged)
│   └── ... (all original data)
└── players_v2_shadow/ (test collection)
    ├── wendell_carter_jr/
    │   ├── bio: {...}
    │   ├── evaluations: {...}
    │   ├── contracts: {...}
    │   └── seasons: {...}
    └── ... (transformed data)

AFTER LIVE MIGRATION:
Firebase Firestore
├── players/ (original - kept as backup)
│   └── ... (all original data)
├── players_v2_shadow/ (test - can delete)
│   └── ... (test data)
└── players_v2/ (NEW PRODUCTION)
    ├── wendell_carter_jr/
    │   ├── bio: {...}
    │   ├── evaluations: {...}
    │   ├── contracts: {...}
    │   └── seasons: {...}
    └── ... (all transformed data)
```

## Command Safety Levels

```
┌─────────────────────────────────────────────────────────────┐
│                    SAFETY LEVEL: HIGH ✅                    │
│  node scripts/migrate_phase1.cjs --dry-run                  │
│  → No database changes                                      │
│  → Test transformation logic only                           │
│  → Safe to run anytime                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SAFETY LEVEL: MEDIUM 🟡                  │
│  node scripts/migrate_phase1.cjs --shadow                   │
│  → Writes to test collection (players_v2_shadow)            │
│  → Original data unchanged                                  │
│  → Can be deleted if wrong                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SAFETY LEVEL: LOW ⚠️                     │
│  node scripts/migrate_phase1.cjs                            │
│  → Writes to production (players_v2)                        │
│  → Cannot be easily undone                                  │
│  → Only run after shadow validation                         │
└─────────────────────────────────────────────────────────────┘
```

## Validation Checkpoints

```
Step 1: DRY RUN
    ├── ✅ Script runs without errors?
    ├── ✅ All players processed?
    ├── ✅ Transformation logic correct?
    └── ✅ No validation errors?
              │
              ▼
Step 2: SHADOW TEST (10 players)
    ├── ✅ Data written to shadow collection?
    ├── ✅ Structure matches expected format?
    ├── ✅ Sample checks pass?
    └── ✅ Calculations correct?
              │
              ▼
Step 3: FULL SHADOW
    ├── ✅ All players migrated?
    ├── ✅ Player count matches original?
    ├── ✅ No critical errors?
    └── ✅ Performance acceptable?
              │
              ▼
Step 4: VALIDATION
    ├── ✅ Bio section complete?
    ├── ✅ Evaluations present?
    ├── ✅ Contracts correct?
    ├── ✅ Seasons data accurate?
    ├── ✅ Edge cases handled?
    │   ├── Rookies OK?
    │   ├── Free agents OK?
    │   ├── Complex contracts OK?
    │   └── International players OK?
    └── ✅ ALL CHECKS PASS?
              │
              ▼
        READY FOR LIVE! 🚀
```

## Timeline Visual

```
Week 1: PREPARATION & TESTING
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│Read │Test │Test │Valid│Plan │     │     │
│Docs │Dry  │Shdw │Data │Code │     │     │
│     │Run  │     │     │Chng │     │     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘

Week 2: EXECUTION & DEPLOYMENT
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│Code │Code │Test │LIVE │Deplf│Mntr │Mntr │
│Updt │Updt │Local│MIGR!│oy   │     │     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
          ↑                    ↑
     Critical        Point of No Return
     Testing

Week 3: MONITORING
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│Mntr │Mntr │Mntr │Mntr │Mntr │     │     │
│Fix  │Fix  │     │     │✅   │     │     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
                              ↑
                          Stable!
```

## Error Recovery Flow

```
                    Migration Running
                           │
                           ▼
                    Error Detected?
                     /          \
                   No            Yes
                   │              │
                   ▼              ▼
              Continue        What Type?
                   │              │
                   ▼         ┌────┴────┐
              Complete    Transform  Write  Validate
                   │      Error     Error   Error
                   ▼         │        │       │
               Success!      │        │       │
                             ▼        ▼       ▼
                         Check     Check   Check
                         mapping   Firebase data
                         file      creds   quality
                             │        │       │
                             ▼        ▼       ▼
                         Fix &    Restore  Clean &
                         retry    access   retry
                             │        │       │
                             └────────┴───────┘
                                     │
                                     ▼
                                Resume or
                              Rollback to
                               Previous
                                 State
```

## Key Files Reference Map

```
┌─────────────────────────────────────────────────────────┐
│              MIGRATION FILE ECOSYSTEM                   │
└─────────────────────────────────────────────────────────┘

📁 Root Directory
├── 📄 mapping_phase1_FINAL.json ← Field mappings (174)
├── 📄 wendell_carter_jr_before.json ← Sample input
├── 📄 firestore-complete.json ← Sample output
│
├── 📁 scripts/
│   ├── 📄 migrate_phase1.cjs ← Main runner
│   ├── 📄 transforms.js ← Transform functions
│   ├── 📄 validate_target.js ← Validation
│   └── 📄 firebaseConfig.node.js ← Firebase setup
│
├── 📁 docs/ (Migration Documentation)
│   ├── 📄 MIGRATION_README.md ← START HERE
│   ├── 📄 FIRESTORE_MIGRATION_REVIEW.md ← Full review
│   ├── 📄 MIGRATION_STEP_BY_STEP.md ← How to execute
│   ├── 📄 MIGRATION_QUICK_REFERENCE.md ← Quick lookup
│   └── 📄 MIGRATION_VISUAL_GUIDE.md ← This file
│
└── 📁 Firebase Collections
    ├── players/ ← Original (backup)
    ├── players_v2_shadow/ ← Test collection
    └── players_v2/ ← New production
```

## Success Criteria Checklist

```
✅ MIGRATION SUCCESSFUL WHEN:
┌─────────────────────────────────────────────┐
│ [ ] All players processed (OK = total)     │
│ [ ] Zero critical failures (FAIL = 0)      │
│ [ ] Shadow data validated                  │
│ [ ] Edge cases tested                      │
│ [ ] Performance acceptable                 │
│ [ ] Original data intact (backup exists)   │
└─────────────────────────────────────────────┘

✅ APPLICATION SUCCESSFUL WHEN:
┌─────────────────────────────────────────────┐
│ [ ] Site loads without errors              │
│ [ ] Player list displays                   │
│ [ ] Filters work correctly                 │
│ [ ] Profiles load properly                 │
│ [ ] Roster builder functional              │
│ [ ] No performance degradation             │
│ [ ] No user-reported issues                │
└─────────────────────────────────────────────┘
```

---

**💡 Pro Tips:**

1. **Always test shadow first** - Catch issues before production
2. **Validate thoroughly** - Check 10+ players manually
3. **Keep backup** - Don't delete original collection for 30 days
4. **Monitor closely** - Watch for 48 hours post-migration
5. **Have rollback ready** - Know how to undo if needed

**⚠️ Remember:** The migration is NOT reversible once live. Test everything!

---

*Visual Guide v1.0*
*Use alongside other migration documentation*
