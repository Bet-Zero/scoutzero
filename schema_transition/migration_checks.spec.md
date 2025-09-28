# Migration Verification Checklist

## 1. Pre-flight
1. **Credentials:** Confirm `serviceAccountKey.json` exists or set `SA_PATH`.
2. **Exports:** Run `MODE=dry-run node schema_transition_orchestrator.cjs` to generate fresh `outputs/current_export.json`.
3. **Backups:** Ensure latest Firestore backup or export snapshot is stored in `/outputs/backups/`.

## 2. Player Migration (Dry Run)
1. `MODE=dry-run SEASON=2025-26 SAMPLE_PLAYERS="lebron_james,jayson_tatum" node schema_transition/core/migrate_full_players.cjs`
2. Inspect `outputs/migrate_full_players_dry-run.json` & `.csv` for warnings.
3. Verify selectors parity – each entry should have `selectorIssues` empty.

## 3. Player Migration (Shadow)
1. `MODE=shadow SEASON=2025-26 node schema_transition/core/migrate_full_players.cjs`
2. Confirm `players_shadow/*` and `playersByNbaId_shadow/*` documents exist in Firestore.
3. Re-run dry-run command; diff counts should be zero when comparing against legacy extracts.
4. Archive `outputs/migrate_full_players_shadow.json` and `*_shadow_failures.json` (if generated).

## 4. Player Migration (Live)
1. Validate shadow parity: no entries in `*_shadow_failures.json`.
2. `MODE=live CONFIRM_SHADOW=1 SEASON=2025-26 node schema_transition/core/migrate_full_players.cjs`
3. Review log stream for `batch-commit-success` events and absence of `shadow-verify-failed`.
4. Spot check migrated docs via Firebase console; confirm `bio`, `team.code`, `stats`, `contractView`, `evaluations`.

## 5. Contracts & Team Seasons (Blocked)
- Current scripts (`migrate_contracts_and_views.cjs`, `build_team_seasons_full.cjs`) require refactor before live runs. Restrict to documentation review until they adopt selectors + shadow support.

## 6. Post-run Validation
1. Export validation bundle: `node schema_transition/utils/generate_forecast_bundle.cjs` followed by `node schema_transition/utils/validate_forecast_compat.cjs outputs/ForecastBundle_TARGET_sample_guard.json`.
2. Run integration smoke tests consuming the new selectors (pending UI migration).
3. Update `docs/schema_diff_preview.json` if new edge cases found.

## 7. Rollback Plan (Pending)
- Use `mapNewSeasonToLegacy` from `schemaAdapters.cjs` once rollback script is added. Until then, rely on Firestore point-in-time backups.
