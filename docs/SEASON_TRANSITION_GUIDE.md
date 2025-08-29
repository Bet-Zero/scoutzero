# 🏀 Season Transition Guide - Complete Workflow

This comprehensive guide explains how to update ScoutZero from one NBA season to the next, preserving all user data while updating contracts, bios, and preparing for new stats.

## 📋 Overview

When transitioning to a new NBA season, you need to:
1. **Archive current season data** (grades, ratings, blurbs)
2. **Update player contracts and bio info** (teams, contract terms)
3. **Prepare stats structure** for new season while preserving old stats
4. **Ensure user data continuity** (grades carry forward, archive history preserved)

## 🏗️ Data Architecture Overview

ScoutZero organizes data by season using this structure:

```
Firestore Collections:
├── players/                    # Active player data (current season)
│   ├── {playerId}/
│   │   ├── bio: {}            # Bio info (age, height, etc.)
│   │   ├── contract_summary: {} # Contract details
│   │   ├── team: "string"     # Current team
│   │   ├── overall_grade: {}  # User grades
│   │   ├── roles: {}          # User-defined roles
│   │   ├── traits: {}         # User traits
│   │   ├── badges: []         # User badges
│   │   ├── blurbs: {}         # User blurbs
│   │   └── system: {stats: {}} # Current season stats
│   
├── seasons/                   # Season-specific archives
│   ├── {year}/               # e.g., "2025" for 2024-25 season
│   │   ├── status: "archived"
│   │   ├── display_name: "2024-25"
│   │   ├── playerGrades/     # Archived user grades
│   │   │   └── {playerId}/   # Snapshot of grades at season end
│   │   └── teamData/         # Archived team/contract data
│   │       └── {teamId}/     # Snapshot of cap sheets
│   
└── teams/                    # Active team data (current season)
    └── {teamId}/
        ├── capSheet: {}      # Current cap sheet
        ├── players: {}       # Current roster
        └── totalSalaryByYear: {}
```

## 🚀 Step-by-Step Transition Process

### Phase 1: Archive Current Season

**Before making any changes**, archive all current user data:

```bash
# Archive current season (e.g., 2024 for 2023-24 season)
npm run season:archive 2024

# Verify archive was successful
npm run season:list
```

This preserves:
- All user grades, roles, traits, badges, blurbs
- Team cap sheet data
- Contract information at time of archiving
- Stats snapshot from completed season

### Phase 2: Create New Season

```bash
# Create new season (e.g., 2025 for 2024-25 season)
npm run season:create 2025
```

This initializes:
- New season document with proper metadata
- Season-specific subcollections structure
- Status tracking for data updates

### Phase 3: Update Contracts and Bio Data

**This is where contract changes and team moves are handled:**

```bash
# Run complete contract update pipeline
npm run contracts:update
```

This pipeline:
1. **Scrapes new contract data** (teams, salaries, years)
2. **Parses and cleans data** (handles formatting, validation)
3. **Merges with existing player data** (preserves IDs, adds new contracts)
4. **Uploads to Firestore** (updates `players/` collection)
5. **Regenerates cap sheets** (updates `teams/` collection)

**What gets updated:**
- `bio.team` - New team assignments
- `contract_summary` - New contract terms, years, salaries
- `status` - Signed, Free Agent, etc.
- Team rosters and cap sheets

**What stays the same:**
- Player IDs (crucial for grade continuity)
- All user grades, roles, traits, badges, blurbs
- Bio info like age, height, position (unless changed)

### Phase 4: Prepare Stats Structure (Without Overwriting)

**Key Insight**: Don't run stats update until new season games begin!

```bash
# This prepares the stats structure but keeps old stats
npm run stats:prepare-new-season  # (We'll create this script)
```

**What this should do:**
- Add new season year to stats tracking
- Initialize empty stats objects for new season
- **Preserve previous season stats** in archive
- Set up stats collection structure for when games start

### Phase 5: Verify User Data Continuity

**Critical validation step:**

```bash
# Verify grades carried forward properly
npm run season:validate-transition 2024 2025  # (We'll create this script)
```

**What to check:**
- All players still have their grades, roles, traits, badges, blurbs
- Player IDs match between old and new season
- Archive data is complete and accessible
- No user data was lost in transition

## 🔧 User Data Preservation Details

### How User Grades Carry Forward

1. **During contract update**: Player records in `players/` collection are updated with new contract/bio info
2. **User data preservation**: All user-inputted fields (`overall_grade`, `roles`, `traits`, `badges`, `blurbs`) remain untouched
3. **Archive linkage**: Archived data in `seasons/{oldYear}/playerGrades/` maintains connection via `player_id`

### Archive History Continuity

The archive system maintains complete history:

```javascript
// Example archived grade record
{
  player_id: "playerABC123",
  season: 2024,
  overall_grade: { /* user grades */ },
  roles: { /* user roles */ },
  traits: { /* user traits */ },
  badges: [ /* user badges */ ],
  blurbs: { /* user blurbs */ },
  
  // Context at time of archiving
  bio_snapshot: {
    age: 28,
    team: "LAL",  // Team before trade/signing
    position: "PG"
  },
  stats_snapshot: {
    PPG: 18.5,  // Final stats from that season
    RPG: 4.2,
    APG: 8.1
  },
  
  archived_date: "2024-06-30T...",
  reason: "season_archive"
}
```

### Connecting Across Seasons

Users can view player history across seasons:
- Current grades in `players/{playerId}`
- 2023-24 grades in `seasons/2024/playerGrades/{playerId}`
- 2022-23 grades in `seasons/2023/playerGrades/{playerId}`
- etc.

All connected by the same `player_id`, regardless of team changes.

## 📊 Stats Management Strategy

### Current Season Stats (Old)
- **Before transition**: In `players/{playerId}/system/stats`
- **After archiving**: Preserved in archive, accessible for historical comparison

### New Season Stats Preparation
- **Initially**: Empty or minimal structure in `players/{playerId}/system/stats`
- **When season starts**: Updated via `npm run stats:update`

### Example Stats Evolution:
```javascript
// Before new season (2023-24 stats)
{
  system: {
    stats: {
      PPG: 18.5,
      RPG: 4.2,
      season: "2023-24"
    }
  }
}

// After transition prep (placeholder for 2024-25)
{
  system: {
    stats: {
      PPG: 0,        // Placeholder until games start
      RPG: 0,
      season: "2024-25"
    }
  }
}

// Mid-season 2024-25 (after running stats update)
{
  system: {
    stats: {
      PPG: 22.1,     // New season stats
      RPG: 5.8,
      season: "2024-25"
    }
  }
}
```

## 🛡️ Safety Measures

### Before Starting
1. **Backup Firestore** - Export current data
2. **Test in development** - Run full process in dev environment first
3. **Verify archive** - Ensure previous season archive completed successfully

### During Process
1. **Run validation** after each phase
2. **Monitor for errors** in console output
3. **Spot-check players** to ensure data integrity

### Emergency Rollback
If something goes wrong:
1. **Restore from backup** (if available)
2. **Check archive data** - Previous season should be safe in `seasons/{year}/`
3. **Re-run specific phases** - Each phase is designed to be re-runnable

## 🔍 Troubleshooting Common Issues

### "Player grades disappeared"
- **Check**: Did contract update change player IDs?
- **Solution**: Player ID mapping script to reconnect grades

### "Archive data missing"
- **Check**: Was archive phase completed successfully?
- **Solution**: Re-run archive for previous season

### "Stats from last season overwritten"
- **Check**: Did you run stats update too early?
- **Solution**: Restore stats from archive data

### "Some players missing after contract update"
- **Check**: Were they filtered out as inactive?
- **Solution**: Check contract pipeline filtering logic

## 📝 Summary Checklist

When transitioning seasons:

- [ ] **Archive current season** (`npm run season:archive {oldYear}`)
- [ ] **Create new season** (`npm run season:create {newYear}`)
- [ ] **Update contracts/bio** (`npm run contracts:update`)
- [ ] **Prepare stats structure** (keep old stats, prep for new)
- [ ] **Validate user data continuity** (grades, roles, traits preserved)
- [ ] **Verify archive accessibility** (can view historical data)
- [ ] **Wait for season start** before updating actual stats

Following this process ensures:
✅ All user grades, ratings, blurbs are preserved  
✅ Contract and bio updates reflect team changes  
✅ Archive history remains intact and connected  
✅ Stats are ready for new season without losing old data  
✅ Full rollback capability if needed  

## 🚨 When Things Go Wrong

If you encounter issues during transition:

1. **Stop immediately** - Don't continue if errors occur
2. **Check the logs** - Each script provides detailed output
3. **Verify archive** - Ensure previous season data is safe
4. **Seek help** - Contact support with specific error messages
5. **Consider rollback** - Better to start over than corrupt data

The key principle: **Never sacrifice user data for system convenience.**