# Schema Transition Decision Matrix

| File | Syntax | Imports Resolve | Safety Pattern (MODE/Shadow/Batch/Retry/Logs) | Dry-run | Shadow | Parity/Verify | Notes |
|------|--------|-----------------|-----------------------------------------------|---------|--------|---------------|-------|
| **ORCHESTRATOR** | | | | | | | |
| `schema_transition_orchestrator.cjs` | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | Full pipeline orchestrator with 11 steps, proper error handling, supports DRY_RUN env var |
| **CORE SCRIPTS** | | | | | | | |  
| `core/migrate_full_players.cjs` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Complete MODE support, CONFIRM_SHADOW=1 for live, batch≤500, exp backoff, JSON logs to outputs/ |
| `core/migrate_contracts_and_views.cjs` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | CLI with --i-understand-the-risks guard, shadow collections, parity checks optional |
| `core/build_team_seasons_full.cjs` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Team season docs, proper shadow targeting, batch commits with retries |
| `core/build_schema.cjs` | ✅ | ✅ | ⚠️ | ✅ | N/A | N/A | Schema analysis tool, no Firestore writes, outputs to files only |
| `core/emit_schema_map.cjs` | ✅ | ✅ | ⚠️ | ✅ | N/A | N/A | Mapping generator, file-based output only, no safety needed |
| `core/export_current.js` | ✅ | ✅ | ⚠️ | ✅ | N/A | N/A | Firebase export tool, read-only operations, outputs to JSON |
| **UTILITIES** | | | | | | | |
| `utils/firestoreHelpers.cjs` | ✅ | ✅ | N/A | N/A | N/A | N/A | Firebase connection helper, service account resolution |
| `utils/schemaAdapters.cjs` | ✅ | ✅ | N/A | N/A | N/A | N/A | Pure mapping functions for legacy→new schema transformation |
| `utils/generate_forecast_bundle.cjs` | ✅ | ✅ | ⚠️ | ✅ | N/A | N/A | Sample data generator, file output only |
| `utils/generate_schema_map_fallback.cjs` | ✅ | ✅ | ⚠️ | ✅ | N/A | N/A | Fallback mapping creator, no Firestore operations |
| `utils/integration_test.cjs` | ✅ | ✅ | ⚠️ | ✅ | N/A | ✅ | Test runner for pipeline validation |
| `utils/validate_forecast_compat.cjs` | ✅ | ✅ | ⚠️ | ✅ | N/A | ✅ | Schema compatibility validator, strict field checking |
| `utils/scan_and_map_player.cjs` | ✅ | ✅ | ⚠️ | ✅ | N/A | N/A | Player field scanner, read-only Firebase operations |
| `utils/rollback_migration.cjs` | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | Rollback utility with DRY_RUN support, backup creation |
| `utils/legacyFieldAdapter.js` | ✅ | ✅ | N/A | N/A | N/A | N/A | Bridge adapter for UI compatibility during transition |
| `utils/selectorsNew.js` | ✅ | ✅ | N/A | N/A | N/A | N/A | New schema selector functions, pure getters |
| **EXTERNAL DEPENDENCIES** | | | | | | | |
| `src/utils/selectors/newSchemeSelectors.js` | ✅ | ✅ | N/A | N/A | N/A | N/A | Schema selectors used by core scripts, extensive getter functions |

## Legend
- ✅ = Fully implemented and compliant
- ⚠️ = Present but limited (not always applicable)
- ❌ = Missing or non-compliant  
- N/A = Not applicable to this file type

## Key Findings

### Safety Patterns - EXCELLENT
All core migration scripts implement the complete safety pattern:
- **MODE handling**: dry-run | shadow | live with validation
- **Shadow collections**: *_shadow targeting when not in live mode
- **Batching**: All enforce ≤500 operations per batch (Firestore limit)
- **Retry logic**: Exponential backoff with configurable MAX_RETRIES
- **Structured logging**: JSON lines to console + summary artifacts to outputs/
- **Live guards**: Explicit confirmation flags required

### Import Resolution - CLEAN
- All dependencies resolve correctly (firebase-admin, yargs available)
- Clean separation between utilities and core logic
- External selector dependency properly referenced

### Parity/Verification
- Core migration scripts include optional parity checking
- Rollback utility provides reverse mapping capability
- Integration tests validate end-to-end compatibility