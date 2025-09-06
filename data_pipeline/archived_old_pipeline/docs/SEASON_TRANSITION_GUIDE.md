# 🏀 ScoutZero Season Transition Quick Guide

## Complete Season Update (2024-25 → 2025-26)

### Single Command Solution
```bash
npm run season:transition
```

**What this does:**
1. 📦 Archives 2024-25 season data (preserves ALL user grades)
2. 🆕 Creates 2025-26 season structure
3. 📄 Updates contracts & bio data for all players
4. 👥 Automatically adds newly drafted/signed players
5. 📊 Prepares stats structure for new season
6. ✅ Validates data integrity

**Prerequisites:**
- Place `serviceAccountKey.json` in project root
- Ensure `public/players.json` has current player data

---

## Individual Update Commands

### Update Contracts Only
```bash
npm run contracts:update
```
- Scrapes latest contract data
- Updates player contracts & cap sheets
- Preserves user grades

### Update Stats Only
```bash
npm run stats:update
```
- Updates player performance stats
- Preserves bio data & user grades

### Generate Cap Sheets
```bash
npm run capsheets:generate
```
- Creates salary cap sheets for all 30 teams

### Validate Data
```bash
npm run season:validate
```
- Checks season structure integrity
- Validates grade preservation

---

## Season Management

### List All Seasons
```bash
npm run season:list
```

### Create New Season
```bash
npm run season:create 2026
```

### Archive Old Season
```bash
npm run season:archive 2025
```

---

## New Player Handling

The system automatically handles:
- ✅ **Draft picks** (rookies)
- ✅ **Free agent signings**
- ✅ **International players**
- ✅ **Trade acquisitions**
- ✅ **G-League call-ups**

**Process:**
1. Compares current roster to previous season
2. Identifies missing players
3. Creates new player records
4. Handles name variations & special characters
5. Sets up empty grade structure for scouting

---

## Data Preservation

### What's Preserved
- ✅ Overall grades & detailed evaluations
- ✅ Scouting traits & characteristics
- ✅ Role assignments & position data
- ✅ Achievement badges & tags
- ✅ Custom scouting notes & blurbs

### What's Updated
- 🔄 Player age, team, position
- 🔄 Contract details & salary info
- 🔄 Performance stats (when available)
- 🔄 Free agency status

---

## Quick Troubleshooting

### Firebase Credentials Missing
```
❌ Firebase credentials not found
```
**Solution:** Place `serviceAccountKey.json` in project root

### Player Data Not Found
```
❌ No player data file found
```
**Solution:** Ensure `public/players.json` exists with current data

### Season Already Exists
```
❌ Season already exists
```
**Solution:** Archive old season first or use validation command

---

## Year-Over-Year Process

### Before Season Starts
1. Run `npm run season:transition`
2. Verify new players were added correctly
3. Update any missing contract information
4. Prepare for stats updates once season begins

### During Season
1. Run `npm run stats:update` periodically
2. Use `npm run contracts:update` for mid-season trades
3. Generate updated cap sheets as needed

### After Season
1. Archive completed season: `npm run season:archive [year]`
2. Prepare for next season transition

---

## For Future Reference

**2025-26 → 2026-27 Transition:**
```bash
npm run season:transition
```

**2026-27 → 2027-28 Transition:**
```bash
npm run season:transition
```

The process is identical each year - the system automatically detects the current season and transitions appropriately.