# 🏀 ScoutZero Data Pipeline - Simple Guide

## What This System Does

This system updates your NBA scouting app with fresh player data. It works with the complete player data in `public/players.json` and uploads it to Firebase where your app reads it.

## Your Data Flow

1. **`public/players.json`** - Contains 630+ NBA players with complete bio, contract, and stats data
2. **Upload to Firebase** - Your app reads player data from Firebase  
3. **Generate tools** - Capsheets and other tools read from Firebase

---

## Simple Commands

### 🔄 **Season Transition** (Start of new NBA season)
```bash
npm run season:transition
```
**What it does:** Uploads `players.json` to Firebase, preserving all your existing grades and scouting data for players who were already there, and adds new players (rookies, trades, etc.)

### 💰 **Update Contracts** (When trades happen)
```bash
npm run contracts:update
```
**What it does:** Updates contract information in `players.json` and uploads to Firebase

### 📊 **Update Stats** (During season)
```bash
npm run stats:update  
```
**What it does:** Updates player statistics in `players.json` and uploads to Firebase

### 🧾 **Generate Cap Sheets**
```bash
npm run capsheets:generate
```
**What it does:** Reads player data FROM Firebase and creates salary cap sheets for all 30 teams

---

## When To Use Each Command

### Before New Season (August)
- Run: `npm run season:transition`
- This preserves all your grades and adds new players

### During Season (October - June)  
- **When trades happen:** `npm run contracts:update`
- **For fresh stats:** `npm run stats:update`
- **Need cap info:** `npm run capsheets:generate`

---

## Prerequisites

- Place `serviceAccountKey.json` in your project root (download from Firebase Console)
- Your `public/players.json` file contains the current player data

---

## What Gets Preserved

When you run season transition, these are kept for existing players:
- ✅ All your grades and evaluations
- ✅ Scouting traits and characteristics  
- ✅ Role assignments
- ✅ Custom notes and blurbs

New players get fresh, empty grade structures ready for scouting.

---

## That's It!

Your system is designed to be simple:
1. **`players.json`** has everything
2. **Upload to Firebase** 
3. **Your app reads from Firebase**
4. **Tools read from Firebase**

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