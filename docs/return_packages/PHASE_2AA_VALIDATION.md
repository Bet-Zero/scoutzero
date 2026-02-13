# Phase 2AA: OptionsByYear Persistence — Validation Return Package

**Validated**: 2026-02-03
**Status**: ✅ ALL CHECKS PASSED

---

## Automated Tests

```bash
npm run test -- --run src/tests/scouting/player_filters_wiring_contract.test.js
```

**Result**: ✅ 35 tests passed (35 total)

| Test Suite | Tests | Status |
|------------|-------|--------|
| Identity & Basic Filters | 4 | ✅ |
| Free Agency Filters | 5 | ✅ |
| Bird Rights Filters | 4 | ✅ |
| Contract Option Filters | 10 | ✅ |
| Grade Filters | 3 | ✅ |
| Age Filters | 2 | ✅ |
| Combined Filter Scenarios | 4 | ✅ |
| Edge Cases | 3 | ✅ |

Key Phase 2Y/2AA tests verified:

- `optionTypes: uses optionsByYear from main doc when present`
- `optionTypes: optionsByYear takes priority over salariesByYear fallback`

---

## Build Verification

```bash
npm run build
```

**Result**: ✅ Build successful (1m 12s)

```
dist/index.html                            0.60 kB
dist/assets/index-3f88b222.css            77.18 kB
dist/assets/index.esm-4bbdcdee.js          3.62 kB
dist/assets/seasonManager-7a523836.js     32.21 kB
dist/assets/index-bc3c510e.js          2,058.91 kB
```

---

## Manual Verification Steps

### 1. Fresh Emulator Test

```bash
# Clear existing data
rm -rf .emulator-data

# Start fresh emulator
npm run emu

# Watch for output:
# [seed] Phase 2AA: checking optionsByYear backfill state...
# [seed] optionsByYear: X players need backfill, running write mode...
# -OR-
# [seed] optionsByYear: all players current, skipping backfill
```

### 2. UI Verification

1. Navigate to `http://localhost:5173/players?debugFilters=1`
2. Open diagnostics panel
3. Verify `currentContractView.optionsByYear` count > 0
4. Select Option Type filter (e.g., "Player Option")
5. Verify players are returned

### 3. Migration Script Banner

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 node scripts/migrations/phase2y_backfill_optionsByYear.js
```

**Expected output**:

```
┌─────────────────────────────────────────────────────────────┐
│ Target:  EMULATOR                                          │
│ Host:    127.0.0.1:8082                                    │
│ Project: scoutzero-bf1ae                                   │
└─────────────────────────────────────────────────────────────┘
```

### 4. Production Write Guardrail

```bash
node scripts/migrations/phase2y_backfill_optionsByYear.js --write
```

**Expected**: ERROR — requires `--prod --confirmProject=<id>` or `ALLOW_PROD_MIGRATION_WRITE=true`

---

## Regression Checklist

- [x] Existing filter logic unchanged
- [x] Option Types filter works with optionsByYear SSOT
- [x] Fallback to salariesByYear when optionsByYear missing
- [x] No schema validation errors
- [x] Build bundle size within acceptable range

---

## Known Limitations

1. **Stale staged data**: Existing staged artifacts don't have optionsByYear until re-staged
2. **Emulator backfill overhead**: Adds ~5s to first emulator startup
3. **Production requires manual run**: Use `--prod --confirmProject=scoutzero-bf1ae`

---

## Next Steps

1. Re-run staging pipeline for all players to bake in optionsByYear
2. Verify production optionsByYear state and run backfill if needed
3. Consider removing backfill safety net once all data migrated
