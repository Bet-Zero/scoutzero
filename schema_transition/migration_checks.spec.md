# Migration Verification Checklist

## CRITICAL: Pre-flight Dependency Fixes
**⚠️ BLOCKING ISSUES MUST BE RESOLVED FIRST:**

### 1. Generate Missing Schema Map
```bash
# These commands MUST complete successfully before any migration attempts
cd schema_transition
node core/export_current.js
node core/build_schema.cjs  
node core/emit_schema_map.cjs
```
**Expected Output:** `outputs/schema_map_2025-26.json` file created
**Validation:** Verify file exists and contains mappings like `{"bio.AGE": "players/{id}/bio.age"}`

### 2. Fix Legacy Adapter Dependency
```bash
# Verify the generated schema map can be imported
node -e "console.log(Object.keys(require('./outputs/schema_map_2025-26.json')).length + ' mappings found')"
```
**Expected Output:** `> 50 mappings found` (indicates successful schema map generation)

## 1. Pre-flight
1. **Credentials:** Confirm `serviceAccountKey.json` exists or set `SA_PATH`.
2. **Exports:** Run `MODE=dry-run node schema_transition_orchestrator.cjs` to generate fresh `outputs/current_export.json`.
3. **Backups:** Ensure latest Firestore backup or export snapshot is stored in `/outputs/backups/`.

## 2. Selector Integration Validation
1. **Verify Selector Loading:** `node -e "import('file://' + process.cwd() + '/src/utils/selectors/newSchemeSelectors.js').then(m => console.log('Selectors loaded:', Object.keys(m).length + ' functions'))"`
2. **Test Selector Parity:** Run validation against sample data:
   ```bash
   MODE=dry-run SEASON=2025-26 SAMPLE_PLAYERS="sample_player" node schema_transition/core/migrate_full_players.cjs
   ```
3. **Check Selector Issues:** Inspect dry-run output for `selectorIssues` field - should be empty
4. **Validate Required Functions:** Confirm selectors include `getDisplayName`, `getTeamCode`, `getSalary`, `assertSeasonDocShape`

## 3. Player Migration (Dry Run)
1. `MODE=dry-run SEASON=2025-26 SAMPLE_PLAYERS="lebron_james,jayson_tatum" node schema_transition/core/migrate_full_players.cjs`
2. Inspect `outputs/migrate_full_players_dry-run.json` & `.csv` for warnings.
3. Verify selectors parity – each entry should have `selectorIssues` empty.

## 4. Player Migration (Shadow)
1. `MODE=shadow SEASON=2025-26 node schema_transition/core/migrate_full_players.cjs`
2. Confirm `players_shadow/*` and `playersByNbaId_shadow/*` documents exist in Firestore.
3. Re-run dry-run command; diff counts should be zero when comparing against legacy extracts.
4. Archive `outputs/migrate_full_players_shadow.json` and `*_shadow_failures.json` (if generated).

## 5. Player Migration (Live)
1. Validate shadow parity: no entries in `*_shadow_failures.json`.
2. `MODE=live CONFIRM_SHADOW=1 SEASON=2025-26 node schema_transition/core/migrate_full_players.cjs`
3. Review log stream for `batch-commit-success` events and absence of `shadow-verify-failed`.
4. Spot check migrated docs via Firebase console; confirm `bio`, `team.code`, `stats`, `contractView`, `evaluations`.

## 6. Firestore Index Validation ⚠️ NEW REQUIREMENT
1. **Query Performance Test:** Execute these queries post-migration to ensure indexes exist:
   ```javascript
   // Test these in Firebase console
   db.collection('players').doc('sample_player').collection('seasons').where('team.code', '==', 'LAL')
   db.collection('players').doc('sample_player').collection('seasons').where('contractView.salary', '>', 30000000)
   ```
2. **Expected:** Queries should complete in <100ms. If >1s, composite indexes needed.
3. **Index Creation:** If needed, create composite indexes before full migration:
   - `players/{playerId}/seasons/{season}` collection group
   - Fields: `team.code ASC`, `bio.displayName ASC`
   - Fields: `bio.position ASC`, `contractView.salary DESC`

## 7. Contracts & Team Seasons (Blocked)
- Current scripts (`migrate_contracts_and_views.cjs`, `build_team_seasons_full.cjs`) require refactor before live runs. Restrict to documentation review until they adopt selectors + shadow support.

## 8. Post-run Validation
1. Export validation bundle: `node schema_transition/utils/generate_forecast_bundle.cjs` followed by `node schema_transition/utils/validate_forecast_compat.cjs outputs/ForecastBundle_TARGET_sample_guard.json`.
2. **UI Integration Test:** Start dev server and manually test:
   ```bash
   npm run dev
   # Navigate to http://localhost:5173 and verify:
   # - Player profiles load correctly
   # - Team rosters display proper data  
   # - Contract information shows correctly
   # - Evaluation data appears intact
   ```
3. Update `docs/schema_diff_preview.json` if new edge cases found.
4. **Performance Monitoring:** Check Firebase console for query performance after migration.

## 9. Rollback Plan ⚠️ ENHANCED
- **Preparation:** Create point-in-time backup before migration: `gcloud firestore export gs://your-backup-bucket`
- **Test Rollback:** Use `mapNewSeasonToLegacy` from `schemaAdapters.cjs` on sample data to verify reverse compatibility
- **Emergency Procedure:** If critical issues found:
  1. Stop all write operations to new schema
  2. Restore from point-in-time backup
  3. Run rollback validation script (pending implementation)
  4. Gradually re-enable legacy schema operations

## 10. Security & Performance Validation ⚠️ NEW
1. **Security Rules Test:**
   ```javascript
   // Test in Firebase console that these rules work:
   // Read access to season data
   db.collection('players').doc('sample_player').collection('seasons').doc('2025-26').get()
   
   // Write access to evaluations (if authenticated)  
   db.collection('players').doc('sample_player').collection('seasons').doc('2025-26').update({
     'evaluations.grades.Shooting': 85
   })
   ```
2. **Performance Baseline:** Record query times before migration for comparison
3. **Monitoring Setup:** Configure alerts for slow queries (>500ms) and failed writes
