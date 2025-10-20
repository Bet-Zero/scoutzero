# Current Status & Existing Structure

## Overview

This document describes what currently exists in the ScoutZero codebase related to the Architect feature, based on analysis of the repository.

---

## Existing Architect Feature

### Location

- **Main Entry:** `/src/pages/GMDashboard.jsx`
- **Utils:** `/src/utils/architect/`
- **Components:** Various components in `/src/components/`

### Current Capabilities

The Architect (GM Tools) currently includes:

1. **Cap Sheet** - View team salary cap situation
2. **Trade Machine** - Validate trades between teams
3. **Cap Sheet Full** - Detailed cap breakdown

### Existing Save/Load Functionality

Based on previous conversation context, there are basic save/load functions:

- `saveUserTeamPlan()` - Saves team modifications
- `loadUserTeamPlan()` - Loads saved team plans

**Location:** Likely in `/src/utils/architect/` or similar utility directory

**Current Behavior (Best Understanding):**

- Saves full team snapshots (not organized as "worlds")
- No multi-season support
- No branching capability
- No immutable baseline separation

---

## Existing Data Collections

### `/players` Collection (Current)

- **Purpose:** Player scouting data (bio, stats, grades, roles)
- **Size:** ~530 documents
- **Structure:** Flat player documents
- **Will NOT be modified:** This stays for scouting features

### `/teams` Collection (Current - if exists)

- **Purpose:** Basic team information
- **Status:** Read-only base data
- **Will NOT be modified:** Separate from Architect data

---

## Current Player Contract Schema

### Existing Fields (from previous comment)

Based on the user's provided current schema:

```javascript
{
  // Aggregate values
  averageAnnualValue: 7976666,
  capPercentage: 5,
  contractLength: 3,
  contractType: "VETERAN CONTRACT",
  contractValue: 23930000,
  endSeason: "2028",
  startSeason: "2026",

  // Free agency
  freeAgency: {
    birdRights: "Bird",
    capHold: 14706000,
    freeAgentType: null,
    freeAgentYear: 2028,
    qualifyingOffer: null
  },

  // Guarantees
  guaranteedValue: 23930000,
  guaranteedYears: 3,

  // Incentives
  incentives: {
    likely: 0,
    unlikely: 0
  },

  // Contract metadata
  isExtension: null,
  noTradeClause: false,
  signedUsing: "Bird Exception",
  signingDate: "June 29, 2025",
  signingTeam: null,
  tradeKicker: null,

  // Per-year breakdown
  salariesByYear: [
    {
      year: 2026,          // ⚠️ Format to change to "2026-27"
      salary: 8450000,
      guaranteed: true,
      option: null
    },
    {
      year: 2027,
      salary: 7740000,
      guaranteed: true,
      option: null
    },
    {
      year: 2028,
      salary: 7740000,
      guaranteed: true,
      option: null
    }
  ],

  // Metadata
  source: "SalarySwish"
}
```

### Issues with Current Schema

1. **Year format:** Single year (2026) instead of season format ("2026-27")
2. **Missing CBA fields:**
   - `yearsOfService` (needed for extension rules)
   - `isRookieScale` (needed for poison pill logic)
   - `capHitByYear` (cap hit differs from salary when incentives exist)
   - `tradeBonus` per-year breakdown (some kickers only apply to specific years)

---

## Existing Firestore Structure

### Current Known Collections

```
/players            # Player scouting data (stays unchanged)
/teams              # Basic team info (stays unchanged, if exists)
/seasons            # Season metadata (if exists)
/teamPlans          # User team plans (to be replaced)
```

### What We're Adding

```
/architect/         # NEW: Architect-specific data
  ├─ baseTeams/     # NEW: Immutable real NBA teams
  ├─ basePlayers/   # NEW: Immutable real player contracts
  └─ worlds/        # NEW: User simulation scenarios
```

---

## Existing Cap Calculation Logic

### Known Utilities (Likely Exist)

Based on the Trade Machine feature, these probably exist:

- Salary matching validation
- Cap space calculations
- Apron threshold checks
- Trade eligibility rules

### Location (Best Guess)

- `/src/utils/architect/tradeMachine/`
- `/src/utils/architect/capUtils.js`
- `/src/utils/capCalculations.js`

### Will Need Updates

- Extend to read from new `/architect/baseTeams` and `/architect/basePlayers` collections
- Support world-based data loading
- Add multi-season calculation support

---

## Existing UI Components

### GMDashboard Components (Known)

- **CapSheet component** - Displays team cap situation
- **TradeMachine component** - Trade builder and validator
- **Team selector** - Choose which team to view

### Will Need Additions

- **World selector dropdown** - Choose scenario to view
- **Season navigator** - Advance/rewind through seasons
- **Branch button** - Fork current world
- **World management panel** - Create/rename/delete worlds
- **Decision tree visualizer** - See branching structure

---

## Data Pipeline (Current)

### Existing Scraping/Import

Based on repo exploration, there likely exists:

- Python scripts in `/data_pipeline/` for player data imports
- Firebase upload scripts in `/scripts/`
- Some form of SalarySwish data collection (user mentioned previous scraping)

**Status:** User deleted previous scraper, wants fresh start

### What We're Building

- New team-focused scraper (team pages + player pages)
- Target schema defined in `03-TARGET-SCHEMA.md`
- Upload to new `/architect/` collections

---

## Security Rules (Current)

### Firestore Rules

- Likely exist for `/players` collection
- May exist for `/teams` or `/teamPlans` collections

### Will Need Updates

```javascript
// Need to add rules for:
match /architect/{document=**} {
  // Base collections (read-only to all)
  match /baseTeams/{teamCode} {
    allow read: if true;
    allow write: if false;  // Admin only
  }

  match /basePlayers/{playerId} {
    allow read: if true;
    allow write: if false;  // Admin only
  }

  // User worlds (read/write by owner)
  match /worlds/{worldId} {
    allow read, write: if request.auth != null &&
      resource.data.createdBy == request.auth.uid;
  }
}
```

---

## Known Gaps / Missing Features

### Not Currently Implemented

- ❌ Multi-season support
- ❌ Branching/forking scenarios
- ❌ Immutable baseline separation
- ❌ World metadata tracking
- ❌ Action history/audit trail
- ❌ Optimized read performance with snapshots

### Partial Implementation

- ⚠️ Basic team plan saving (exists but needs upgrade)
- ⚠️ Trade validation (exists but may need CBA accuracy improvements)
- ⚠️ Cap calculations (exists but needs multi-season support)

---

## Migration Strategy

### Clean Slate Approach ✅

User preference: Start fresh rather than migrate existing data

**What We're NOT Migrating:**

- Old team plans (if any exist in `/teamPlans`)
- Previous player contract data (rebuilding from SalarySwish)
- Historical scenarios

**What We're Preserving:**

- Player scouting data in `/players` (untouched)
- Existing UI components (upgrade in place)
- Cap calculation logic (extend, don't replace)

---

## Technical Stack (Known)

### Frontend

- React 18+
- Vite (build tool)
- Firebase SDK (client-side)

### Backend

- Firebase Firestore (database)
- Firebase Admin SDK (Node.js for data import)
- Python (data pipeline scripts)

### Data Sources

- SalarySwish.com (NBA contract data)
- Manual team/player data entry (if needed)

---

## Next Steps

After this documentation phase, we'll move to:

1. Confirm understanding of current system
2. Validate target schema
3. Begin implementation with data scraping
4. Upgrade existing Architect features to use new structure

**No code implementation in this phase** - just planning and documentation.
