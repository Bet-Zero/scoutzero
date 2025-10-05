# Teams Migration Quick Reference

## 🚀 Quick Start

```bash
# 1. Preview migration (no Firebase required)
node scripts/validate_teams_migration.js

# 2. Dry-run on actual data (requires Firebase credentials)
node scripts/migrate_teams_base.js --dry-run

# 3. Execute migration to shadow collection
node scripts/migrate_teams_base.js --write

# 4. Review output
ls -la migration_output/
cat migration_output/preview_*.ndjson | jq .
```

## 📋 CLI Commands

| Command | Description |
|---------|-------------|
| `--dry-run` | Preview only (default) |
| `--write` | Write to `/teams_base_vNext` |
| `--team=LAL` | Single team |
| `--limit=5` | First N teams |
| `--seasons=2024-25,2025-26` | Filter seasons |

## 🧪 Testing

```bash
# Run test suite
npm run test tests/teams_migration.spec.js -- --run

# Run validator (no Firebase)
node scripts/validate_teams_migration.js
```

## 📦 What Was Delivered

✅ **Migration Script** - `scripts/migrate_teams_base.js`
- Full transformation logic
- CLI with safety features
- Hash-based idempotency
- Batch writes (≤450 ops)
- Output artifacts

✅ **Team Mapping** - `mapping/teamCodeMap.json`
- All 30 NBA teams
- Canonical codes, names, divisions

✅ **Test Suite** - `tests/teams_migration.spec.js`
- 18 tests, all passing
- Data validation
- Structure verification

✅ **Golden Fixtures** - `tests/fixtures/teams_legacy/`
- LAL, BOS, OKC, MIA, SAS
- Representative edge cases

✅ **Documentation**
- `README_teams_migration.md` - Full guide
- `MIGRATION_SUMMARY.md` - Implementation details
- This quick reference

✅ **Validator** - `scripts/validate_teams_migration.js`
- Test without Firebase
- Verify transformation logic

## 📊 Output Structure

```
/teams_base_vNext/{teamCode}/
  meta: { teamCode, market, name, conference, division, colors, ... }
  seasons: {
    "2024-25": {
      roster: { players[], twoWays[], inactiveList[] }
      cap: { salaryRows[], totalsByYear{}, exceptions[], ... }
      picks: { incoming[], outgoing[] }
      transactions: []
      notes: ""
    }
  }
```

## ✅ Validation Checklist

- [x] Script syntax valid
- [x] All imports working
- [x] 18 tests passing
- [x] 5 fixtures validated
- [x] No Firebase errors in validator
- [x] Output structure matches spec
- [x] Currency normalized (no "$11.9M")
- [x] Season keys formatted correctly
- [x] Idempotency working (hash checks)
- [x] Team mapping complete (30 teams)

## 🔐 Safety Features

- ✅ Never modifies `/teams`
- ✅ Writes to shadow collection only
- ✅ Hash prevents duplicate writes
- ✅ Batch size limits
- ✅ Comprehensive error handling
- ✅ Warning system (non-fatal)

## 📁 Key Files

```
scripts/
  migrate_teams_base.js         # Main migration (467 lines)
  validate_teams_migration.js   # Validator (304 lines)

mapping/
  teamCodeMap.json              # 30 teams canonical data

tests/
  teams_migration.spec.js       # 18 tests
  fixtures/teams_legacy/
    LAL.json, BOS.json, OKC.json, MIA.json, SAS.json

README_teams_migration.md       # Full documentation
MIGRATION_SUMMARY.md            # Implementation summary
```

## 🎯 Next Steps

1. Set up Firebase credentials
2. Run `--dry-run` on full data
3. Review warnings
4. Execute `--write`
5. Update Architect to use `/teams_base_vNext`
