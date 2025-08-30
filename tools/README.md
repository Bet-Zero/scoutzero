
# 🏀 ScoutZero Season Management & Data Pipeline Guide

This guide explains the **streamlined season management system** for transitioning between NBA seasons while preserving user evaluations and handling new players automatically.

---

## 🚀 Season Transition (Primary Workflow)

### Complete Season Update (Recommended)
```bash
npm run season:transition
```

**This single command handles everything:**
1. 📦 Archives current season data (preserves all user grades)
2. 🆕 Creates new season structure in Firestore
3. 📄 Updates contracts and bio data for all players
4. 👥 Automatically detects and adds newly drafted/signed players
5. 📊 Prepares stats structure for new season (ready for data)
6. ✅ Validates data integrity and preservation

**Example: 2024-25 → 2025-26 Transition**
- Archives all 2024-25 player evaluations (grades, traits, roles, blurbs)
- Creates 2025-26 season with updated rosters and contracts
- Handles rookies, trades, signings automatically
- Preserves your scouting work while updating system data

---

## 🔧 Individual Pipeline Commands

### Contract Updates Only
```bash
npm run contracts:update
```
**Pipeline:** Scrape contracts → Parse data → Merge with existing → Upload to Firebase → Generate cap sheets

### Stats Updates Only  
```bash
npm run stats:update
```
**Pipeline:** Merge stats data → Upload to Firebase (preserves bio/contract data)

### Cap Sheet Generation
```bash
npm run capsheets:generate
```
**Generates:** Team salary cap sheets for all 30 NBA teams

### Data Validation
```bash
npm run season:validate
```
**Validates:** Season structure, data integrity, grade preservation

---

## 📊 Data Sources & Structure

### Primary Data Source
- **File:** `public/players.json` (531+ NBA players)
- **Contains:** Bio, stats, contracts, and system metadata
- **Format:** Normalized player objects with comprehensive data

### New Player Detection
- **Automatic:** System detects players not in previous season
- **Handles:** Draft picks, free agent signings, international players
- **Aliases:** 200+ name variations and international character mappings
- **Edge Cases:** Suffixes (Jr, Sr, II, III), special characters, nicknames

### Firebase Structure (Per Player)
```json
{
  "player_id": "lebron_james",
  "Name": "LeBron James",
  "HT": "6-9", "WT": "250", "AGE": 40,
  "Team": "Lakers", "Position": "Forward",
  "Contract": "$48.7M / 2 yrs",
  "Free Agent": "2025 (UFA)",
  "MIN": 34.8, "PPG": 25.7, "RPG": 8.0, "APG": 6.2,
  // User evaluation data (preserved during transitions)
  "overall_grade": { ... },
  "traits": { ... },
  "roles": { ... },
  "badges": [ ... ],
  "blurbs": { ... }
}
```

---

## 🗄️ Season Management Commands

### Create New Season
```bash
npm run season:create [year]
```

### Archive Season  
```bash
npm run season:archive [year]
```

### List All Seasons
```bash
npm run season:list
```

### Prepare Stats Structure
```bash
npm run season:prepare-stats
```

---

## 🔄 Data Pipeline Architecture

### Contract Update Flow
```
scrape_all_contracts.py → parse_contract_data.py → 
merge_universal_player_data.py → push_bio_and_contract.py → 
generateCapSheets.js
```

### Stats Update Flow  
```
merge_universal_player_data.py → push_stat_data.py
```

### Season Transition Flow
```
Archive current → Create new season → Update contracts → 
Prepare stats → Validate integrity
```

---

## 🛡️ Data Preservation

### What's Preserved During Transitions
- ✅ **User Grades:** Overall ratings and detailed evaluations
- ✅ **Traits:** Scouting attributes and player characteristics  
- ✅ **Roles:** Position assignments and role definitions
- ✅ **Badges:** Achievement tags and special designations
- ✅ **Blurbs:** Custom scouting notes and analysis

### What's Updated
- 🔄 **Bio Data:** Age, team, position, physical stats
- 🔄 **Contracts:** Current deals, salary, free agency status
- 🔄 **Stats:** New season performance data (when available)

---

## 🆕 New Player Handling

The system automatically handles:
- **Draft Picks:** Newly drafted rookies
- **Free Agents:** Signed free agents  
- **International Players:** Overseas signings
- **Trades:** Players new to the database
- **Two-Way Players:** G-League call-ups

**Process:**
1. Compares current roster data to previous season
2. Identifies missing players using advanced matching
3. Creates new player records with proper structure
4. Applies naming aliases and special character handling
5. Initializes empty grade structure for scouting

---

## 🔍 Quick Reference

| Task | Command | Notes |
|------|---------|-------|
| **Full Season Update** | `npm run season:transition` | Complete automation |
| **Contract Updates** | `npm run contracts:update` | Contracts + cap sheets |
| **Stats Updates** | `npm run stats:update` | Performance data only |
| **Validate Data** | `npm run season:validate` | Check integrity |
| **List Seasons** | `npm run season:list` | Show all seasons |

**Firebase Setup:** Place `serviceAccountKey.json` in project root before running any commands.

---
