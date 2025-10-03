# Enhanced Migration Tools - User Guide

## Overview

The migration has been upgraded with production-ready features to address all critical issues identified in the review.

## 🆕 What's New

### Enhanced Migration Script (`migrate_phase1_enhanced.cjs`)

**New Features:**
1. ✅ **Batch Safety** - Automatically handles Firestore's 500-operation limit
2. ✅ **Automatic Backups** - Creates backup before migration with `--backup` flag
3. ✅ **Retry Logic** - Exponential backoff for failed operations (3 retries)
4. ✅ **Edge Case Detection** - Identifies rookies, free agents, complex contracts
5. ✅ **Enhanced Validation** - Comprehensive field validation
6. ✅ **Progress Tracking** - Batch-by-batch progress with clear status
7. ✅ **Better Error Handling** - Detailed error messages and recovery

### Rollback Script (`rollback_migration.cjs`)

**Features:**
1. ✅ **3 Rollback Options** - Delete new collection, restore backup, or both
2. ✅ **Batch Processing** - Safe batch operations for large datasets
3. ✅ **Dry Run Mode** - Test rollback without making changes
4. ✅ **Automatic Backup Discovery** - Finds and lists available backups

### Enhanced Validation (`validate_target_enhanced.js`)

**Improvements:**
1. ✅ **Comprehensive Field Checks** - All required and optional fields
2. ✅ **Edge Case Detection** - Rookies, FA, trades, international players
3. ✅ **Data Quality Warnings** - Alerts for unusual values
4. ✅ **Percentage Validation** - Ensures percentages are decimals (0-1)

## 📋 Quick Start

### 1. Dry Run (Test Everything)
```bash
npm run migrate:dry
# OR with limit
node scripts/migrate_phase1_enhanced.cjs --dry-run --limit 10
```

**What it does:**
- Tests transformation on all players
- Validates all fields
- Detects edge cases
- Shows warnings and errors
- **NO database writes**

### 2. Shadow Migration (Safe Test)
```bash
npm run migrate:shadow
# OR with backup
npm run migrate:shadow-backup
```

**What it does:**
- Creates backup (if `--backup` flag used)
- Writes to `players_v2_shadow` collection
- Processes in batches of 450 documents
- Retries failed operations automatically
- Original `players` collection unchanged

### 3. Validate Shadow Data
```bash
# Check in Firebase Console
# Verify structure, calculations, edge cases
```

### 4. Live Migration (Production)
```bash
npm run migrate:live
```

**What it does:**
- Creates automatic backup
- Writes to `players_v2` collection
- Processes in batches with retry logic
- Shows progress and summary
- Detects and reports edge cases

### 5. Rollback (If Needed)
```bash
# Dry run to see what would happen
npm run migrate:rollback

# Execute rollback
npm run migrate:rollback-confirm --backup backup_players_1234567890.json
```

## 🔧 Command Reference

### Migration Commands

| Command | Description | Safe? |
|---------|-------------|-------|
| `npm run migrate:dry` | Test migration (no writes) | ✅ Yes |
| `npm run migrate:shadow` | Migrate to shadow collection | ✅ Yes |
| `npm run migrate:shadow-backup` | Shadow + backup | ✅ Yes |
| `npm run migrate:live` | Production migration | ⚠️ No |

### Rollback Commands

| Command | Description | Safe? |
|---------|-------------|-------|
| `npm run migrate:rollback` | Dry run rollback | ✅ Yes |
| `npm run migrate:rollback-confirm` | Execute rollback | ⚠️ No |

### Advanced Options

```bash
# Dry run with limit
node scripts/migrate_phase1_enhanced.cjs --dry-run --limit 100

# Shadow migration with custom start point
node scripts/migrate_phase1_enhanced.cjs --shadow --startAfter "player_id"

# Live migration with specific mapping
node scripts/migrate_phase1_enhanced.cjs --mapping ./custom_mapping.json --backup

# Rollback specific option
node scripts/rollback_migration.cjs --confirm --option 2 --backup ./backup_file.json
```

## 📊 Output Explained

### Migration Summary
```
==========================================
📊 Migration Summary:
   ✅ Success: 450
   ❌ Failed: 0
   ⚠️  Warnings: 12
   🔍 Edge Cases: 8
```

**What it means:**
- **Success**: Documents successfully migrated
- **Failed**: Validation errors (fix data and retry)
- **Warnings**: Data quality issues (review but not blocking)
- **Edge Cases**: Rookies, FA, complex contracts (manual review recommended)

### Edge Case Types

| Type | Description | Action |
|------|-------------|--------|
| **rookie** | No draft info | Verify bio data |
| **free_agent** | FA year <= current year | Check contract status |
| **complex_contract** | Has options/incentives | Verify contract details |
| **international** | Non-US player | Check name spelling |
| **traded** | Team mismatch | Verify current team |

## 🔍 Validation Details

### What's Validated

**Bio Section:**
- ✅ displayName (required, non-empty string)
- ✅ position (required, non-empty string)
- ✅ age (required, 18-50)
- ✅ height (optional, 60-96 inches)
- ✅ weight (optional, 150-350 lbs)
- ✅ yearsLeft (optional, >= 0)
- ✅ freeAgentYear (optional, reasonable range)

**Evaluations:**
- ✅ overallGrade (0-100)
- ✅ traits.* (0-100 each)
- ✅ shootingProfile (enum: Elite/Plus/Capable/Willing/Hesitant/Non)
- ✅ twoWay (0-100)

**Contracts:**
- ✅ contractValue (number)
- ✅ averageAnnualValue (number)
- ✅ salariesByYear (array with year/salary)
- ✅ options (array)

**Seasons:**
- ✅ stats.FG% (decimal 0-1, not percentage)
- ✅ stats.3PT% (decimal 0-1)
- ✅ stats.PTS (non-negative)
- ✅ contractView.contractId (present)

## 🚀 Migration Workflow

### Recommended Path (1-2 weeks)

#### Week 1: Testing & Validation
```bash
# Day 1: Dry run
npm run migrate:dry

# Day 2-3: Shadow migration
npm run migrate:shadow-backup

# Day 4-5: Validate shadow data
# - Check Firebase Console
# - Verify 10+ random players
# - Check edge cases
# - Test complex contracts
```

#### Week 2: Preparation
```bash
# Day 1-2: Update frontend code
# - Change collection references to players_v2
# - Update data selectors
# - Test locally

# Day 3: Final validation
npm run migrate:dry
# Ensure all issues resolved
```

#### Week 3: Execution
```bash
# Day 1: Live migration
npm run migrate:live

# Day 2-3: Deploy & monitor
# - Deploy frontend changes
# - Monitor for errors
# - Verify features work

# Day 4-7: Stabilization
# - Watch for issues
# - Fix any problems
# - Keep backup for 30 days
```

## 🔄 Rollback Options

### Option 1: Full Rollback (Recommended)
```bash
node scripts/rollback_migration.cjs --confirm --option 1
```
- Deletes `players_v2`
- Restores backup to `players`
- Complete rollback to pre-migration state

### Option 2: Restore Only
```bash
node scripts/rollback_migration.cjs --confirm --option 2
```
- Keeps `players_v2`
- Restores backup to `players`
- Allows comparison

### Option 3: Delete New Collection
```bash
node scripts/rollback_migration.cjs --confirm --option 3
```
- Deletes `players_v2`
- Keeps `players` unchanged
- Quick cleanup

## 🛡️ Safety Features

### Automatic Backups
- Created with `--backup` flag
- Timestamped (backup_players_1234567890.json)
- Contains all original data
- Used for rollback

### Batch Processing
- Max 450 operations per batch
- Safe margin below Firestore's 500 limit
- Prevents quota errors
- Progress tracking per batch

### Retry Logic
- 3 attempts with exponential backoff
- Handles transient errors
- 1s, 2s, 4s delays
- Detailed error logging

### Edge Case Detection
- Identifies unusual data patterns
- Alerts for manual review
- Doesn't block migration
- Helps find data quality issues

## 📝 Checklist

### Before Live Migration
- [ ] Ran dry run successfully
- [ ] Tested shadow migration
- [ ] Validated shadow data (10+ players)
- [ ] Checked edge cases
- [ ] Verified calculations
- [ ] Created backup
- [ ] Updated frontend code
- [ ] Tested locally
- [ ] Team notified

### After Live Migration
- [ ] Verified player count matches
- [ ] Spot-checked 10+ players
- [ ] Tested all app features
- [ ] Monitored for errors
- [ ] Verified performance
- [ ] Kept backup for 30 days

## 🐛 Troubleshooting

### Migration Fails with Validation Errors
```bash
# Check specific player
node scripts/migrate_phase1_enhanced.cjs --dry-run --startAfter "player_id" --limit 1
```
Fix data in source collection and retry.

### Batch Timeout Errors
```bash
# Reduce batch size (edit BATCH_SIZE in script)
# Default is 450, try 200 if issues persist
```

### Missing Backup File
```bash
# List available backups
ls -la backup_players_*.json

# Use specific backup
node scripts/rollback_migration.cjs --confirm --backup backup_players_1234567890.json
```

### Edge Cases Need Review
- Check Firebase Console for flagged players
- Verify data manually
- Update source if needed
- Re-run migration

## 💡 Best Practices

1. **Always use --backup flag** for live migrations
2. **Test with --dry-run first** to catch issues
3. **Validate shadow data thoroughly** before going live
4. **Keep backups for 30 days** after successful migration
5. **Monitor closely** for 48 hours post-migration
6. **Update frontend code** before deployment
7. **Have rollback plan ready** just in case

## 🎯 Success Criteria

### Migration Successful When:
- ✅ All players migrated (Success count = total)
- ✅ Zero validation failures
- ✅ Edge cases reviewed and accepted
- ✅ Shadow data matches expectations
- ✅ Backup created successfully

### Application Successful When:
- ✅ Site loads without errors
- ✅ All features work (search, filters, profiles)
- ✅ No performance degradation
- ✅ No user-reported issues

## 📞 Support

### Check Logs
```bash
# Redirect output to file
npm run migrate:live 2>&1 | tee migration.log

# Review specific errors
grep "ERROR" migration.log
grep "FAIL" migration.log
```

### Common Issues
1. **Firebase auth** - Check serviceAccountKey.json
2. **Validation errors** - Fix source data
3. **Batch timeouts** - Reduce batch size
4. **Edge cases** - Review manually

---

**All critical issues from the review have been addressed:**
1. ✅ Rollback capability added
2. ✅ Batch safety implemented
3. ✅ Validation enhanced
4. ✅ Edge case detection added
5. ✅ Production error handling
6. ✅ Comprehensive documentation

**You're now ready for safe, production-grade migration!** 🚀
