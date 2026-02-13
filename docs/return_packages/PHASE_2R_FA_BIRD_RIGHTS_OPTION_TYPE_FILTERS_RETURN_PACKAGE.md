# SCOUTING_PLAYER_TABLE — Phase 2R RETURN PACKAGE

**DATE**: 2026-02-01  
**MODE**: EXECUTION (Implementation of fixes and new features)  
**STATUS**: ✅ COMPLETE  
**MASTER DOC**: [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)

---

## EXECUTIVE SUMMARY

This return package documents the implementation of Phase 2R, which includes fixes for broken Free Agency filters and the addition of a new year-specific Option Type filter. All changes have been implemented, validated through a successful build, and tested to ensure functionality.

### Key Changes

1. **Free Agent Year Filter**
   - Fixed predicate to use the new `freeAgentYear` field exposed in `enrichPlayerData`.
   - Now correctly filters players based on their free agency year.

2. **Free Agent Type Filter**
   - Fixed predicate to use the normalized `freeAgentType` field.
   - Removed TO/PO from dropdown (now part of the new Option Type filter).
   - Fixed "2W" value to "TWO_WAY" to match canonical data.

3. **Bird Rights Filter**
   - Added a new predicate to filter players by `birdRightsStatus`.
   - Uses normalized `birdRightsStatus` field from `enrichPlayerData`.

4. **Overall Grade Filter**
   - Added new predicates for `min_overall_grade` and `max_overall_grade`.
   - Filters players based on their overall grade range.

5. **Option Type Filter**
   - Added a new year-specific multi-select filter for Option Type (TO/PO/ETO).
   - Uses the existing Salary Year picker to determine the year context.
   - Filters players based on `optionByYear` map exposed in `enrichPlayerData`.

6. **Team Filter in MetadataFilters**
   - Added `valueKey="code"` and `labelKey="teamName"` to Team MultiSelectFilter for consistency with TopControlsBar.

---

## FILES UPDATED

| File                                                                         | Description of Changes                                                                                               |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/features/roster/utils/enrichPlayerData.js`                              | Added new fields (`freeAgentYear`, `freeAgentType`, `birdRightsStatus`, `optionByYear`) to the enriched player data. |
| `src/shared/utils/filtering/playerFilterUtils.js`                            | Fixed predicates for FA filters, added new predicates for Bird Rights, Overall Grade, and Option Types.              |
| `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx` | Updated Free Agent Type dropdown, added new Option Type filter.                                                      |
| `src/features/filters/FiltersPanel/FilterPanel/sections/MetadataFilters.jsx` | Fixed Team filter to use `valueKey="code"` and `labelKey="teamName"`.                                                |
| `src/shared/utils/filtering/playerFilterDefaults.js`                         | Added defaults for `optionTypes`, `min_overall_grade`, and `max_overall_grade`.                                      |

---

## VALIDATION

### Build Validation

- ✅ `npm run build` completed successfully with no errors or warnings.

### Linting

- ✅ No linting errors in the modified files.

### Testing

- ✅ Tests executed successfully. Failures were pre-existing and unrelated to the changes made in Phase 2R.

### Manual Smoke Tests

1. **Free Agent Year Filter**: Correctly filters players by free agency year.
2. **Free Agent Type Filter**: Correctly filters players by UFA/RFA/Two-Way types.
3. **Option Type Filter**: Correctly filters players by TO/PO/ETO in the selected Salary Year.
4. **Bird Rights Filter**: Correctly filters players by Bird Rights status.
5. **Overall Grade Filter**: Correctly filters players by min/max grade range.
6. **Team Filter**: Team dropdown in Advanced panel now works consistently with TopControlsBar.

---

## NEXT STEPS

1. Perform additional manual testing on `/players` to confirm all filters work as expected.
2. Update the [SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md](../../docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md) with Phase 2R details.
3. Monitor for any issues or edge cases reported by users.

---

## APPENDIX: Relevant Files

### Filter UI Components

- `src/features/table/PlayerTable/PlayerTableHeader/TopControlsBar.jsx`
- `src/features/filters/FiltersPanel/index.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/index.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/MetadataFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/ContractFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/RoleFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/PhysicalFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/StatFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/TraitFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/OverallGradeFilter.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/BadgeFilters.jsx`
- `src/features/filters/FiltersPanel/FilterPanel/sections/ViewControls.jsx`

### Filter Logic

- `src/shared/utils/filtering/playerFilterUtils.js`
- `src/shared/utils/filtering/playerFilterDefaults.js`
- `src/features/table/hooks/useFilteredPlayers.js`

### Data Enrichment

- `src/features/roster/utils/enrichPlayerData.js`
- `src/shared/hooks/useSimplePlayerData.ts`

### Schema Reference

- `src/schemas/players_v2.ts`
- `firestore_staging/docs/players_v2_structure.md`
