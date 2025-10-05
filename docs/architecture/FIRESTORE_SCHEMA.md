# 🗂️ FIRESTORE_SCHEMA.md

A full schema reference for all Firestore collections used in ScoutZero + Architect. Use this to understand field structures, nested paths, and usage.

---

## 📁 Collection: `/players_v2/{playerId}`

### 📦 Top-Level Fields:

- `bio`: { AGE, HT, WT, Position, Team, Years Pro }
- `bio.displayName`: Player display name
- `bio.position`: Player position
- `bio.age`: Player age
- `bio.height`: Height in inches
- `bio.weight`: Weight in pounds
- `bio.display`: { team, yearsPro, averageAnnualValue, freeAgentYear, freeAgentType, etc. }
- `bio.agent`: { name, agency }
- `bio.draft`: { year, round, pick, team }

### 📂 Subcollection: `/players_v2/{playerId}/contracts/{contractId}`

Contract documents with details like:

- `signingTeam`: Team that signed the contract
- `contractType`: Type of contract (Standard, Two-Way, etc.)
- `signedUsing`: Exception or method used (Bird Rights, MLE, etc.)
- `contractValue`: Total contract value
- `contractLength`: Number of years
- `averageAnnualValue`: AAV of the contract
- `guaranteedValue`: Guaranteed money
- `salariesByYear[]`: Array of salary details per year
- `options[]`: Player/team options
- `incentives`: { likely, unlikely }
- `noTradeClause`: Boolean
- `tradeKicker`: Trade kicker percentage
- `freeAgency`: { freeAgentYear, freeAgentType, capHold, birdRights }

### 📂 Subcollection: `/players_v2/{playerId}/seasons/{seasonId}`

Season-specific data like:

- `team`: Team abbreviation
- `age`: Age during that season
- `stats`: { PTS, AST, REB, FG%, 3PT%, FT%, etc. }
- `contractView`: Denormalized contract info for quick access
- `evaluationView`: Denormalized evaluation info for quick access

### 📂 Subcollection: `/players_v2/{playerId}/evaluations/{evaluationId}`

Evaluation and grading data:

- `traits`: { Shooting, Passing, Defense, IQ, etc. }
- `roles`: { offense1, offense2, defense1, defense2 }
- `subRoles`: { offense: [], defense: [] }
- `badges`: Array of badge strings
- `overallGrade`: Overall player grade (0-100)
- `shootingProfile`: Shooting capability description
- `twoWay`: Two-way rating
- `blurbs`: { overall, shootingProfile, twoWayMeter, traits, roles, subroles }
- `meta`: { methodVersion, updatedAt, updatedBy, seasonContext }

**Note**: Current evaluations are stored with document ID `current` for easy access.

---

## 📁 Collection: `/teams/{teamId}`

### 📦 Fields:

- `capSheet.lastUpdated`: timestamp
- `capSheet.players[]`: array of full player objects

### 🔁 Each `capSheet.players[i]` includes:

- `name`, `player_id`, `display_name`, `position`, `age`, `height`, `weight`
- `contract_clean`: object with:
  - `years`, `total_value`, `average_value`
  - `bird_rights`, `fa_type`, `fa_year`, `has_extension`
  - `salaries_by_year`: {
    `2025`: {
    `salary`: number,
    `guaranteed`: number,
    `option`: 'Team' | 'Player' | null,
    `source`: string
    }
    }

---

## 🔐 Other Collections (optional / WIP)

- `/lists`, `/tierLists`: ScoutZero ranking tables
- `/rosterProjects`: Team-specific plans (WIP)
- `/capSheets`: Archived snapshots per team per year (future use)

---

## 🔁 Sync Notes

- `contract_clean` is generated during data cleaning and saved into `/teams`
- Can be optionally pushed into `/players` if you want salary data visible in ScoutZero or HoopZero
