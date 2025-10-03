# Migration Fixes Summary

This document summarizes the fixes applied to the migration process to align with the firestore-complete.json blueprint.

## Issues Fixed

### 1. ✅ Duplicate overall_grade Mappings
**Problem**: The mapping had two entries for `overall_grade`:
- Line 522-528: `overall_grade → evaluations.overallGrade` ✅ (KEPT)
- Line 852-857: `overall_grade → evaluations.overall_grade` ❌ (REMOVED)

**Solution**: Removed the duplicate mapping. Now `overall_grade` from legacy data maps only to `evaluations.overallGrade` (camelCase), and is also used for `seasons.{seasonId}.evaluationView.overallGrade`.

**Note**: The field `overall_grade` in legacy data is the SOURCE for `overallGrade` in the new structure.

### 2. ✅ AAV vs averageAnnualValue Naming
**Problem**: Inconsistent field naming - used both `AAV` and `averageAnnualValue`:
- Line 122: `contract.average_annual_value → bio.display.averageAnnualValue` ✅
- Line 639: `contract.average_annual_value → contracts.{contractId}.averageAnnualValue` ✅
- Line 800: `contract_summary.aav → seasons.{seasonId}.contractView.aav` ❌
- Line 845: `contract.average_annual_value → bio.display.AAV` ❌

**Solution**: Removed all `AAV` references. Now consistently uses `averageAnnualValue` everywhere:
- `bio.display.averageAnnualValue`
- `contracts.{contractId}.averageAnnualValue`
- `seasons.{seasonId}.contractView.averageAnnualValue`

### 3. ✅ freeAgent vs freeAgency Naming
**Problem**: Inconsistent naming between `freeAgentYear/Type` and `freeAgencyYear/Type`:
- `bio.display` used `freeAgentYear` and `freeAgentType` ✅
- `contracts.{contractId}.freeAgency` used `freeAgencyYear` and `freeAgencyType` ❌
- `seasons.{seasonId}.contractView` used `freeAgentYear` and `freeAgentType` ✅

**Solution**: Changed all to use `freeAgentYear` and `freeAgentType` (no 'cy'):
- `bio.display.freeAgentYear` and `bio.display.freeAgentType`
- `contracts.{contractId}.freeAgency.freeAgentYear` and `.freeAgentType`
- `seasons.{seasonId}.contractView.freeAgentYear` and `.freeAgentType`

### 4. ✅ Missing evaluationView in Seasons
**Problem**: The mapping was missing `evaluationView` in the seasons subcollection, which should provide a denormalized view of evaluation data for quick access.

**Solution**: Added 8 new mappings for `seasons.{seasonId}.evaluationView`:
1. `overallGrade` - from `overall_grade`
2. `roles.offense1` - from `roles.offense1`
3. `roles.offense2` - from `roles.offense2`
4. `roles.defense1` - from `roles.defense1`
5. `roles.defense2` - from `roles.defense2`
6. `shootingProfile` - from `shootingProfile`
7. `twoWay` - from `roles.twoWay`
8. `badges` - from `badges`

This matches the structure in firestore-complete.json.

## Files Updated

### 1. mapping_phase1_FINAL.json
- Removed duplicate overall_grade mapping
- Removed AAV field mapping
- Changed freeAgency field names to freeAgent
- Added evaluationView mappings for seasons
- Changed contractView.aav to contractView.averageAnnualValue

### 2. firestore-complete.json
- Changed `freeAgencyYear` to `freeAgentYear`
- Changed `freeAgencyType` to `freeAgentType`

### 3. firestore-complete_ANNOTATED_with_from_siblings_FINAL.json
- Fixed bio.display.AAV to bio.display.averageAnnualValue
- Fixed contractView.aav to contractView.averageAnnualValue
- Changed freeAgencyYear to freeAgentYear
- Changed freeAgencyType to freeAgentType

### 4. firestore-complete_ANNOTATED_visual_FINAL.json
- Fixed bio.display.AAV to bio.display.averageAnnualValue
- Fixed contractView.aav to contractView.averageAnnualValue
- Changed freeAgencyYear to freeAgentYear
- Changed freeAgencyType to freeAgentType

## Data Structure

The final structure organizes player data as follows:

```
players/{playerId}/
├── bio/                    # Biographical information
│   ├── displayName
│   ├── position
│   ├── height, weight
│   ├── agent/
│   ├── draft/
│   └── display/
│       ├── team
│       ├── yearsPro
│       ├── averageAnnualValue  ✅
│       ├── freeAgentYear       ✅
│       └── freeAgentType       ✅
├── evaluations/            # Scouting evaluations
│   ├── overallGrade        ✅
│   ├── traits/
│   ├── roles/
│   ├── subRoles/
│   └── badges
├── contracts/              # Contract information
│   ├── {contractId}/
│   │   ├── averageAnnualValue  ✅
│   │   ├── freeAgency/
│   │   │   ├── freeAgentYear   ✅
│   │   │   └── freeAgentType   ✅
│   │   └── salariesByYear
│   └── last_updated
└── seasons/                # Season-specific data
    └── {seasonId}/
        ├── stats/
        ├── contractView/
        │   ├── averageAnnualValue  ✅
        │   ├── freeAgentYear       ✅
        │   └── freeAgentType       ✅
        └── evaluationView/         ✅ NEW!
            ├── overallGrade
            ├── roles/
            ├── shootingProfile
            ├── twoWay
            └── badges
```

## Migration Script Compatibility

The existing migration script (`scripts/migrate_phase1_enhanced.cjs`) is compatible with these changes and requires no modifications. It uses the mapping file and transform functions which now correctly produce the expected structure.

## Testing

A test script (`/tmp/test_mapping.cjs`) was created and successfully validated:
- ✅ No duplicate overall_grade fields
- ✅ No AAV fields (all use averageAnnualValue)
- ✅ Consistent freeAgentYear/Type naming
- ✅ evaluationView correctly populated in seasons
- ✅ All JSON files are valid
- ✅ Output structure matches firestore-complete.json blueprint

## Next Steps

1. Run the migration script in dry-run mode to validate with full dataset
2. Review any edge cases or warnings
3. Execute the migration to populate players_v2 collection
4. Update frontend code to use the new structure if needed
