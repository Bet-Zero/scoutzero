# Migration Changes - Before & After

## Field Naming Changes

### 1. Overall Grade
**Before (Inconsistent):**
- ❌ `evaluations.overallGrade` (line 522)
- ❌ `evaluations.overall_grade` (line 852) - DUPLICATE!

**After (Consistent):**
- ✅ `evaluations.overallGrade` (from `overall_grade`)
- ✅ `seasons.{seasonId}.evaluationView.overallGrade` (from `overall_grade`)

### 2. Average Annual Value
**Before (Mixed):**
- ❌ `bio.display.AAV` 
- ❌ `seasons.{seasonId}.contractView.aav`
- ✅ `bio.display.averageAnnualValue`
- ✅ `contracts.{contractId}.averageAnnualValue`

**After (Consistent):**
- ✅ `bio.display.averageAnnualValue`
- ✅ `contracts.{contractId}.averageAnnualValue`
- ✅ `seasons.{seasonId}.contractView.averageAnnualValue`

### 3. Free Agent Fields
**Before (Mixed):**
- ✅ `bio.display.freeAgentYear` and `freeAgentType`
- ❌ `contracts.{contractId}.freeAgency.freeAgencyYear` and `freeAgencyType`
- ✅ `seasons.{seasonId}.contractView.freeAgentYear` and `freeAgentType`

**After (Consistent):**
- ✅ `bio.display.freeAgentYear` and `freeAgentType`
- ✅ `contracts.{contractId}.freeAgency.freeAgentYear` and `freeAgentType`
- ✅ `seasons.{seasonId}.contractView.freeAgentYear` and `freeAgentType`

### 4. Evaluation View in Seasons
**Before:**
- ❌ Missing entirely

**After:**
- ✅ `seasons.{seasonId}.evaluationView.overallGrade`
- ✅ `seasons.{seasonId}.evaluationView.roles.offense1`
- ✅ `seasons.{seasonId}.evaluationView.roles.offense2`
- ✅ `seasons.{seasonId}.evaluationView.roles.defense1`
- ✅ `seasons.{seasonId}.evaluationView.roles.defense2`
- ✅ `seasons.{seasonId}.evaluationView.shootingProfile`
- ✅ `seasons.{seasonId}.evaluationView.twoWay`
- ✅ `seasons.{seasonId}.evaluationView.badges`

## Structure Comparison

### Player Document Structure
```
players/{playerId}/
├── bio/                           # ✅ Unchanged
│   └── display/
│       ├── averageAnnualValue     # ✅ Changed from AAV
│       ├── freeAgentYear          # ✅ Unchanged
│       └── freeAgentType          # ✅ Unchanged
│
├── evaluations/                   # ✅ Fixed
│   └── overallGrade              # ✅ Changed from overall_grade duplicate
│
├── contracts/                     # ✅ Fixed
│   └── {contractId}/
│       ├── averageAnnualValue     # ✅ Unchanged
│       └── freeAgency/
│           ├── freeAgentYear      # ✅ Changed from freeAgencyYear
│           └── freeAgentType      # ✅ Changed from freeAgencyType
│
└── seasons/                       # ✅ Enhanced
    └── {seasonId}/
        ├── contractView/
        │   ├── averageAnnualValue # ✅ Changed from aav
        │   ├── freeAgentYear      # ✅ Unchanged
        │   └── freeAgentType      # ✅ Unchanged
        │
        └── evaluationView/        # ✅ NEW!
            ├── overallGrade
            ├── roles/
            ├── shootingProfile
            ├── twoWay
            └── badges
```

## Impact Summary

### Files Changed: 4
1. ✅ `mapping_phase1_FINAL.json` - Core mapping configuration
2. ✅ `firestore-complete.json` - Data blueprint
3. ✅ `firestore-complete_ANNOTATED_with_from_siblings_FINAL.json` - Annotated reference
4. ✅ `firestore-complete_ANNOTATED_visual_FINAL.json` - Visual reference

### Lines Changed: ~30
- Removed: 6 duplicate/incorrect mappings
- Added: 8 new evaluationView mappings
- Modified: ~16 field names for consistency

### Testing: ✅ All Pass
- Valid JSON structure
- No AAV fields (0 found)
- No freeAgencyYear/Type (0 found)  
- evaluationView present (8 fields)
- Correct data transformation

## Migration Ready ✅

The migration scripts and configuration are now ready to transform legacy player data into the correct structure defined in firestore-complete.json.
