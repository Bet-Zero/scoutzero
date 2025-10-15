# 🏗️ Architecture Diagram - Scraping Pipeline

## Current State vs. Target State

### **What You Have Now (60% Complete)**

```
┌─────────────────────────────────────────────────────────────┐
│                    SCRAPING LAYER ✅                         │
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Player Scraper  │         │  Team Scraper   │           │
│  │   (TypeScript)  │         │  (TypeScript)   │           │
│  │                 │         │                 │           │
│  │ • Fetch pages   │         │ • Fetch pages   │           │
│  │ • Parse data    │         │ • Parse data    │           │
│  │ • Validate      │         │ • Validate      │           │
│  │ • Batch process │         │ • (manual)      │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           ↓                           ↓                     │
│  ┌─────────────────────────────────────────────┐           │
│  │          JSON Output Files                  │           │
│  │  player-scrape/output/austin_reaves.json   │           │
│  │  team-scrape/output/LAL.json               │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘

                            ❌ GAP ❌
                    (No upload/transform layer)

┌─────────────────────────────────────────────────────────────┐
│                   FIRESTORE COLLECTIONS                      │
│                                                              │
│  /architect/basePlayers  ❌ EMPTY                           │
│  /architect/baseTeams    ❌ EMPTY                           │
│                                                              │
│  /players               ✅ POPULATED (different pipeline)   │
│  /teams                 ✅ POPULATED (different pipeline)   │
└─────────────────────────────────────────────────────────────┘

                            ↓
                            
┌─────────────────────────────────────────────────────────────┐
│              ARCHITECT FEATURES ❌ CAN'T WORK               │
│                                                              │
│  • Trade Machine        - Needs basePlayers/baseTeams       │
│  • Cap Manager          - Needs basePlayers/baseTeams       │
│  • GM Tools             - Needs basePlayers/baseTeams       │
└─────────────────────────────────────────────────────────────┘
```

---

### **Target State (100% Complete - After 2-3 Days)**

```
┌─────────────────────────────────────────────────────────────┐
│                    SCRAPING LAYER ✅                         │
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Player Scraper  │         │  Team Scraper   │           │
│  │   (TypeScript)  │         │  (TypeScript)   │           │
│  │                 │         │                 │           │
│  │ • Batch process │         │ • Batch process │           │
│  │ • 530 players   │         │ • 30 teams      │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           ↓                           ↓                     │
│  ┌─────────────────────────────────────────────┐           │
│  │          JSON Output Files                  │           │
│  │  player-scrape/output/*.json (530 files)   │           │
│  │  team-scrape/output/*.json (30 files)      │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘

                            ↓
                            
┌─────────────────────────────────────────────────────────────┐
│              INTEGRATION LAYER ✅ NEW                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  scripts/architect-upload/                          │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │   │
│  │  │ Transform    │  │ Transform    │  │ Resolve   │ │   │
│  │  │ Player       │  │ Team         │  │ Player ID │ │   │
│  │  │ Schema       │  │ Schema       │  │           │ │   │
│  │  └──────────────┘  └──────────────┘  └───────────┘ │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │   │
│  │  │ Upload       │  │ Upload       │  │ Validate  │ │   │
│  │  │ Players      │  │ Teams        │  │ Data      │ │   │
│  │  └──────────────┘  └──────────────┘  └───────────┘ │   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  orchestrate.js - Master Pipeline          │   │   │
│  │  │  Scrape → Transform → Upload → Validate    │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

                            ↓
                            
┌─────────────────────────────────────────────────────────────┐
│                   FIRESTORE COLLECTIONS ✅                   │
│                                                              │
│  /architect/basePlayers/                                     │
│    ├── lebron_james/data                                    │
│    ├── stephen_curry/data                                   │
│    └── ... (530 players)                                    │
│                                                              │
│  /architect/baseTeams/                                       │
│    ├── LAL (Lakers)                                         │
│    ├── GSW (Warriors)                                       │
│    └── ... (30 teams)                                       │
└─────────────────────────────────────────────────────────────┘

                            ↓
                            
┌─────────────────────────────────────────────────────────────┐
│              ARCHITECT FEATURES ✅ WORKING                   │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Trade     │  │    Cap      │  │   GM Tools  │        │
│  │  Machine    │  │  Manager    │  │             │        │
│  │             │  │             │  │             │        │
│  │ • Load LAL  │  │ • View cap  │  │ • Plan      │        │
│  │ • Load GSW  │  │ • Check     │  │ • Save      │        │
│  │ • Validate  │  │   space     │  │ • Simulate  │        │
│  │   trades    │  │ • Calculate │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│  All CBA Rules Working:                                     │
│  ✅ Bird Rights     ✅ Poison Pill    ✅ Base Year Comp    │
│  ✅ Salary Match    ✅ Cap Holds      ✅ Trade Exceptions  │
└─────────────────────────────────────────────────────────────┘
```

---

## The 11-File Bridge

These files connect the scrapers to Firestore:

### **Upload Layer (5 files)**
```
upload_players.js      → Read player JSONs, upload to basePlayers
upload_teams.js        → Read team JSONs, upload to baseTeams
transform_player.js    → Convert scraper schema → architect schema
transform_team.js      → Convert scraper schema → architect schema
resolve_player_id.js   → Map SalarySwish URLs → ScoutZero IDs
```

### **Automation Layer (3 files)**
```
orchestrate.js         → Run complete pipeline end-to-end
validate.js            → Check data quality and completeness
batch_scrape_teams.ts  → Scrape all 30 teams (like player version)
```

### **Data Layer (3 files)**
```
all_nba_players.json   → List of 530 players to scrape
all_nba_teams.json     → List of 30 teams to scrape
package.json           → npm scripts to run pipeline
```

---

## Data Flow

### **Step-by-Step Pipeline**

```
1. SCRAPE PLAYERS
   Input:  all_nba_players.json (530 players)
   Tool:   batch_scrape_players.ts
   Output: player-scrape/output/*.json (530 files)
   Time:   ~1 hour

2. SCRAPE TEAMS
   Input:  all_nba_teams.json (30 teams)
   Tool:   batch_scrape_teams.ts
   Output: team-scrape/output/*.json (30 files)
   Time:   ~10 minutes

3. TRANSFORM PLAYERS
   Input:  player-scrape/output/*.json
   Tool:   transform_player.js
   Output: Architect-compatible objects
   Time:   Milliseconds per player

4. TRANSFORM TEAMS
   Input:  team-scrape/output/*.json
   Tool:   transform_team.js + resolve_player_id.js
   Output: Architect-compatible objects
   Time:   Milliseconds per team

5. UPLOAD PLAYERS
   Input:  Transformed player objects
   Tool:   upload_players.js
   Output: /architect/basePlayers/* (530 docs)
   Time:   ~10 minutes

6. UPLOAD TEAMS
   Input:  Transformed team objects
   Tool:   upload_teams.js
   Output: /architect/baseTeams/* (30 docs)
   Time:   ~1 minute

7. VALIDATE
   Input:  Firestore collections
   Tool:   validate.js
   Output: Validation report
   Time:   ~1 minute
```

**Total Pipeline Time:** ~1.5 hours (mostly scraping with rate limits)

---

## Schema Transformation Example

### Player Transformation

**Input (Scraper Output):**
```json
{
  "playerId": "lebron_james",
  "displayName": "LeBron James",
  "contract": {
    "contractType": "VETERAN CONTRACT",
    "birdRights": {
      "status": "Bird",
      "yearsOfService": 21
    },
    "tradeEligibility": {
      "canBeTradedNow": true,
      "rules": {
        "baseYearCompensation": false,
        "poisonPill": false
      }
    }
  }
}
```

**Output (Architect Schema):**
```json
{
  "playerId": "lebron_james",
  "displayName": "LeBron James",
  "contract": {
    "type": "veteran",
    "bird_rights": "Bird",
    "years_of_service": 21,
    "trade_eligible": true,
    "base_year_comp": false,
    "poison_pill": false
  }
}
```

**Transformation:** `transform_player.js` handles field mapping and structure changes

---

## Team Transformation

**Input (Scraper Output):**
```json
{
  "teamCode": "LAL",
  "roster": [
    { "name": "LeBron James", "url": "/players/lebron-james" }
  ],
  "totals": {
    "totalSalary": 210894723,
    "capSpace": -40173805
  }
}
```

**Output (Architect Schema):**
```json
{
  "teamCode": "LAL",
  "roster": ["lebron_james"],  // ← Resolved from URL
  "totals": {
    "total_salary": 210894723,
    "cap_space": -40173805
  }
}
```

**Transformation:** 
- `resolve_player_id.js` converts URLs to player IDs
- `transform_team.js` handles field mapping

---

## Why This Matters

### **Without the Integration Layer:**
```
✅ Can scrape player data
✅ Can scrape team data
❌ Can't use in trade machine
❌ Can't use in cap manager
❌ Can't use in GM tools
❌ Architect features broken
```

### **With the Integration Layer:**
```
✅ Can scrape player data
✅ Can scrape team data
✅ Can upload to Firestore
✅ Can use in trade machine
✅ Can use in cap manager
✅ Can use in GM tools
✅ Architect features working
```

---

## Timeline Visual

### **2-3 Day Implementation**

```
Day 1: Upload Infrastructure (6-8 hours)
├─ Morning
│  ├─ Create upload_players.js (2-3h)
│  └─ Create upload_teams.js (2-3h)
├─ Afternoon
│  ├─ Create transform_player.js (1-2h)
│  ├─ Create transform_team.js (1-2h)
│  └─ Create resolve_player_id.js (1-2h)
└─ Evening
   └─ Test with Lakers + sample players

Day 2: Automation (7-10 hours)
├─ Morning
│  ├─ Create orchestrate.js (1-2h)
│  ├─ Create validate.js (1-2h)
│  └─ Create batch_scrape_teams.ts (1-2h)
├─ Afternoon
│  ├─ Generate all_nba_players.json (1-2h)
│  ├─ Create all_nba_teams.json (0.5h)
│  └─ Update package.json (0.5h)
└─ Evening
   └─ Test pipeline on 3-5 teams

Day 3: Deployment (6-10 hours)
├─ Morning
│  ├─ Scrape all 530 players (~1h)
│  └─ Scrape all 30 teams (~10min)
├─ Afternoon
│  ├─ Upload all players (~10min)
│  ├─ Upload all teams (~1min)
│  └─ Run validation (~1min)
└─ Evening
   ├─ Test in trade machine (1-2h)
   ├─ Fix any issues (1-2h)
   └─ ✅ Production ready!
```

---

## Success Checklist

### **Data Validation ✅**
- [ ] 530 players in `/architect/basePlayers`
- [ ] 30 teams in `/architect/baseTeams`
- [ ] All required fields present
- [ ] Schema matches target exactly
- [ ] Player IDs resolve correctly

### **Feature Validation ✅**
- [ ] Trade machine loads teams
- [ ] Can select players to trade
- [ ] Salary matching validates
- [ ] Bird rights checks work
- [ ] Poison pill rules apply
- [ ] Base Year Comp calculates
- [ ] Cap calculations correct

### **Quality Checks ✅**
- [ ] No validation errors
- [ ] Cap math adds up
- [ ] All teams have roster
- [ ] All players have contracts
- [ ] Trade eligibility accurate

---

## Key Takeaway

**Your scrapers are excellent (90%+ complete)**. The 11 integration files are straightforward upload/transform scripts. Code templates are provided. Clear 2-3 day timeline with no blockers.

**You're closer than you think!** 🚀
