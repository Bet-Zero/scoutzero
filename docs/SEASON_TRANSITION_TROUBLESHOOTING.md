# 🛠️ Season Transition Troubleshooting Guide

This guide helps resolve common issues during season transitions.

## 🚨 Emergency Procedures

### If Something Goes Wrong During Transition

1. **STOP IMMEDIATELY** - Don't continue if you see errors
2. **Check your Firestore backup** - Ensure you can restore if needed
3. **Document the error** - Take screenshots, copy error messages
4. **Check archive data** - Verify previous season data is safe in `seasons/{year}/`

### Quick Data Integrity Check

```bash
# Quick check that grades are still there
npm run season:validate {old_year} {new_year} --quick-check

# List what seasons exist
npm run season:list

# Check a few players manually in Firebase console
```

## 🔧 Common Issues and Solutions

### "Firebase service account key not found"

**Error:** `❌ Service account key not found: ../src/serviceAccountKey.json`

**Solution:**
1. Download your Firebase service account key from Firebase Console
2. Place it at `src/serviceAccountKey.json` in your project
3. Ensure the file has proper permissions (not readable by others)

### "Player grades disappeared after contract update"

**Cause:** Contract update pipeline changed player IDs or overwrote user data

**Investigation:**
```bash
# Check if data is in archive
npm run season:validate {old_year} {new_year}

# Look for the player in previous season archive
# Check Firebase Console: seasons/{old_year}/playerGrades/{playerId}
```

**Solutions:**
1. **If data is in archive:** Restore grades from archive to current players
2. **If IDs changed:** Create player ID mapping script
3. **If data truly lost:** Restore from Firestore backup

### "Contract update failed with network errors"

**Cause:** Firebase rate limiting or network issues

**Solution:**
```bash
# Try contract update again (it's designed to be re-runnable)
npm run contracts:update

# If still failing, check Firebase quotas in console
# Consider running during off-peak hours
```

### "Some players missing after contract update"

**Cause:** Players filtered out as inactive or retired

**Investigation:**
1. Check the contract data source - are they still active?
2. Look in contract pipeline logs for filtering reasons
3. Check if they're in the raw contract data files

**Solution:**
```bash
# Check what contract data was downloaded
ls -la data/

# Re-run just the contract scraping to get fresh data
python3 scripts/contracts/scrape_all_contracts.py

# Re-run the full pipeline
npm run contracts:update
```

### "Archive creation failed"

**Error:** Errors during `npm run season:archive`

**Causes & Solutions:**

1. **Firestore permissions:** Ensure service account has write access
2. **Batch size too large:** Archive script handles batching automatically
3. **Network timeout:** Re-run the archive command (it's safe to run multiple times)

```bash
# Check if partial archive exists
npm run season:list

# If partial, clean up and re-run
# (Archive script will overwrite existing archive data)
npm run season:archive {year}
```

### "Stats from previous season overwritten"

**Cause:** Ran `npm run stats:update` too early

**Recovery:**
1. **Check archive:** Previous season stats should be in `seasons/{year}/playerGrades/`
2. **Restore from archive:** Extract `stats_snapshot` from archived data
3. **Reset current stats:** Re-run stats preparation to clear incorrect data

```bash
# Reset stats structure for new season
npm run season:prepare-stats --season {new_year}

# Validate current season stats are placeholders
npm run season:validate {old_year} {new_year}
```

### "Validation shows many errors"

**Common validation errors and their meanings:**

1. **"Player X has no user data"**
   - Normal for new players (rookies, etc.)
   - Concerning if it's a veteran player with known grades

2. **"Player X not found in archive"**
   - Normal for new players
   - Concerning if it's a player who should have been archived

3. **"Player X has wrong season in stats"**
   - Stats preparation may have failed
   - Re-run `npm run season:prepare-stats`

4. **"Archive missing fields"**
   - Archive corruption or incomplete archiving
   - Re-run archive process

### "Can't access archived data from previous seasons"

**Investigation:**
```bash
# Check what seasons exist
npm run season:list

# Verify archive structure in Firebase Console
# Go to: seasons/{year}/playerGrades/ and seasons/{year}/teamData/
```

**Solutions:**
1. **Missing seasons:** Archive may not have been run
2. **Incomplete archives:** Re-run archive for those seasons
3. **Wrong season year:** Check season naming convention (2025 = 2024-25 season)

## 🔍 Data Verification Checklist

After a season transition, manually verify:

### In Firebase Console:

1. **Current Players (`players/` collection):**
   - [ ] Player has correct team after trades/signings
   - [ ] Contract information is updated
   - [ ] User grades, roles, traits, badges, blurbs are preserved
   - [ ] Stats structure shows new season year with placeholder values

2. **Previous Season Archive (`seasons/{year}/playerGrades/`):**
   - [ ] All players from previous season are archived
   - [ ] Archive contains user grades, roles, traits, badges
   - [ ] Archive has correct season year and timestamp
   - [ ] Stats snapshot from previous season is preserved

3. **Current Season (`seasons/{new_year}/`):**
   - [ ] Season document exists with correct metadata
   - [ ] Status is "active"
   - [ ] Display name is correct (e.g., "2024-25")

### Sample Players to Check:

Pick a few specific players and verify:
- **Veteran who stayed on same team:** All data preserved, contract updated
- **Player who was traded:** New team, preserved grades, contract updated
- **Free agent who signed:** New team, preserved grades if they had any
- **Rookie:** New player, no previous grades (expected)

## 🆘 When to Seek Help

Contact support if:
- Multiple validation checks fail
- You see systematic data loss across many players
- Archive process consistently fails
- You're unsure about any errors and don't want to risk data loss

## 📊 Monitoring Season Health

After transition, periodically check:

```bash
# Weekly validation during season
npm run season:validate {old_year} {new_year} --quick-check

# Before running stats updates
npm run season:list  # Verify seasons exist

# After major data updates
npm run season:validate {old_year} {new_year}  # Full validation
```

## 🔄 Rolling Back Changes

If you need to undo a failed transition:

1. **Restore from Firestore backup** (recommended)
2. **Use archive data to reconstruct previous state**
3. **Re-run individual phases** that worked correctly

**Prevention:**
- Always test in development environment first
- Keep regular Firestore backups
- Document what worked for future transitions

## 📱 Quick Commands Reference

```bash
# Full transition
npm run season:transition --from-season 2024 --to-season 2025

# Individual phases
npm run season:archive 2024
npm run season:create 2025
npm run contracts:update
npm run season:prepare-stats --season 2025
npm run season:validate 2024 2025

# Emergency checks
npm run season:list
npm run season:validate 2024 2025 --quick-check
```

Remember: **When in doubt, don't proceed.** Better to ask for help than lose valuable user data.