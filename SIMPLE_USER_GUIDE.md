# 🏀 ScoutZero Data Pipeline - Simple User Guide

## What This System Does

This system helps you update NBA player data for your scouting app. Think of it like updating a database with fresh information about players, their contracts, and their stats.

---

## Super Simple Commands (Just Copy & Paste These)

### 1. 🔄 **Complete Season Update** (Use this most of the time)
```bash
npm run season:transition
```
**What it does:** Updates everything for a new NBA season - gets new players, updates contracts, prepares for new stats. This is what you run when a new NBA season starts.
**Time:** About 8-10 seconds

### 2. 💰 **Update Just Contracts** (For trades during season)
```bash
npm run contracts:update
```
**What it does:** Updates player contract information when trades happen or players sign new deals.
**Time:** About 8-10 seconds

### 3. 📊 **Update Just Stats** (During the season)
```bash
npm run stats:update
```
**What it does:** Updates player performance statistics with the latest numbers.
**Time:** About 2-3 seconds

### 4. 🧾 **Generate Cap Sheets**
```bash
npm run capsheets:generate
```
**What it does:** Creates salary cap worksheets for all 30 NBA teams.
**Time:** About 1-2 seconds

---

## When To Use Each Command

### Before New Season Starts (August)
- Run: `npm run season:transition`
- This gets all the rookies, trades, and contract changes ready

### During The Season (October - June)
- **When players get traded:** `npm run contracts:update`
- **When you want fresh stats:** `npm run stats:update`
- **If you need cap info:** `npm run capsheets:generate`

### The Normal Flow
**Step 1:** Your player data starts in `public/players.json` (630 NBA players)  
**Step 2:** System gets contract info from the internet  
**Step 3:** System merges everything together  
**Step 4:** Final data gets saved to `data/` folder  
**Step 5:** (Optional) Data uploads to your cloud database if you have Firebase credentials  

---

## Files You Care About

### Input Files (DON'T delete these!)
- **`public/players.json`** - Your main player database (630 players)

### Output Files (System creates these)
- **`data/players_merged.json`** - The updated data with contracts (1.4MB)
- **`data/contracts_parsed.json`** - Just the contract information (1.1MB)  
- **`data/team_cap_sheets.json`** - Salary cap sheets for all 30 teams (430KB)

### Optional Files
- **`serviceAccountKey.json`** - Firebase credentials (only needed for cloud uploads)

---

## What If Something Goes Wrong?

### "Firebase credentials not found"
**Don't worry!** This just means it won't upload to the cloud database. The system still works and creates all the files locally. Only add Firebase credentials if you specifically need cloud uploads.

### "No player data file found"
**Fix:** Make sure `public/players.json` exists and has your player data.

### Command takes a long time
**Normal for first run!** Getting data from the internet can take 5-10 minutes. But the simplified version should complete in under 10 seconds.

### "Contract scraping failed" 
**Don't worry!** The system uses fallback data and will still work. You'll get contract information, just not the very latest.

---

## Pro Tips

1. **Always run commands from the main project folder** (where package.json is)
2. **Don't delete the `data/` folder** - it contains your processed information
3. **The system automatically handles new players** - rookies, signings, trades
4. **Your scouting grades are never deleted** - the system only updates team/contract info
5. **Run one command at a time** - don't try to run multiple at once
6. **The system works offline** - no internet required after initial setup

---

## What The System Actually Does (For The Curious)

1. **Starts with your existing player data** (`public/players.json` - 630 players)
2. **Looks up current contracts** from basketball websites
3. **Finds any new players** (rookies, signings, etc.)
4. **Merges everything together** into one big file
5. **Creates salary cap sheets** for all 30 NBA teams
6. **Saves everything to `data/` folder**
7. **Optionally uploads to Firebase** (if you have credentials)

The system is smart about handling missing data and will work even if some websites are down. It uses fallback data to ensure you always get results.

---

## Advanced Commands (If You Need Them)

### For Full Bio Data Update (Slower)
```bash
npm run season:transition-full
```
**Warning:** This takes 5-10 minutes as it fetches fresh bio data from NBA.com

### Firebase Management (Requires credentials)
```bash
npm run season:list          # View all seasons in Firebase
npm run season:create 2026   # Create new season
npm run season:archive 2025  # Archive old season
```

---

## Need Help?

- **Check if the build works:** `npm run build`
- **Check if tests pass:** `npm run test -- --run`
- **See what was created:** `ls -la data/`

Most problems are just missing files or slow internet - the system is pretty robust and will work even with missing data!