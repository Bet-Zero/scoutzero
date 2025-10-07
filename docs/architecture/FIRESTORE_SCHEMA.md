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

## 📁 Collection: `/worlds/{worldId}` - Architect GM Worlds

**⚠️ See [ARCHITECT_SCHEMA_SUMMARY.md](./ARCHITECT_SCHEMA_SUMMARY.md) for complete Architect schema proposal**

### Overview

Architect uses a **transaction log architecture** where each user's GM plan is stored as a "world" with a chronological log of all moves (trades, signings, extensions, waives).

### 📦 World Document Fields:

- `worldId`: Unique identifier (e.g., `w_user123_lal_2025_v1`)
- `userId`: Owner of this world
- `worldName`: User-defined name
- `teamId`: Team being managed (e.g., `lal`)
- `baselineSnapshot`: Reference to NBA baseline (e.g., `teams/lal`)
- `seasonYear`: Active season (e.g., `2025`)
- `isActive`, `isArchived`: World state flags
- `stats`: Denormalized quick stats (totalTransactions, currentSalaryCap, etc.)
- `createdAt`, `lastModified`, `lastAccessed`: Timestamps

### 📂 Subcollection: `/worlds/{worldId}/transactions/{txId}`

Transaction documents recording each GM move:

- `transactionId`: Unique ID (timestamp-based)
- `type`: `'trade' | 'signing' | 'extension' | 'waive' | 'release'`
- `timestamp`: When executed
- `status`: `'completed' | 'pending' | 'reversed'`
- `details`: Type-specific transaction data (outgoing/incoming players, contract terms, etc.)

**Current State Computation**: `baseline + apply(transactions) = world state`

---

## 📁 Collection: `/users/{userId}/worldsIndex/{worldId}` - User World Index

Quick lookup for a user's worlds:

- `worldId`: Reference to world
- `worldName`: Display name
- `teamId`, `teamName`: Team info
- `seasonYear`: Season
- `lastAccessed`, `lastModified`: Timestamps
- `isFavorite`, `isArchived`: Organization flags
- `transactionCount`: Number of moves

---

## 📁 Collection: `/freeAgents/{year}` - Global Free Agent Pool

Shared free agent pool across all worlds:

- `agents[]`: Array of available free agents with player data

---

## 🔐 Other Collections (optional / WIP)

- `/lists`, `/tierLists`: ScoutZero ranking tables
- `/rosterProjects`: Team-specific plans (DEPRECATED - use `/worlds/`)
- `/capSheets`: Archived snapshots per team per year (future use)
- `/teamPlans`: Legacy Architect structure (DEPRECATED - migrating to `/worlds/`)

---

## 🔁 Sync Notes

- `contract_clean` is generated during data cleaning and saved into `/teams`
- Can be optionally pushed into `/players` if you want salary data visible in ScoutZero or HoopZero
- **Architect Worlds**: Transaction log approach reduces storage by 66%+ vs. full cap sheet duplication
- **Migration**: Dual-write mode during transition from `/teamPlans/` to `/worlds/`
