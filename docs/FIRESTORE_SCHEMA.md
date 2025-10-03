# 🗂️ FIRESTORE_SCHEMA.md

A full schema reference for all Firestore collections used in ScoutZero + Architect. Use this to understand field structures, nested paths, and usage.

---

## 📁 Collection: `/players/{playerId}`

### 📦 Top-Level Fields (Root Document):

- `bio`: { AGE, HT, WT, Position, Team, Years Pro, Name }
- `traits`: { Shooting, Defense, IQ, etc. }
- `roles`: { offense1, defense1, etc. }
- `blurbs`: { traits, roles, subroles, shootingProfile, twoWayMeter }
- `subRoles`: { offense: [], defense: [] }
- `badges`: array of badge strings
- `overall_grade`: number or string
- `shootingProfile`: string
- `draft`: { year, round, pick, team }
- `team`: string
- `position`: string
- `player_id`: string
- `name`, `display_name`: string
- `nba_player_id`: number
- `is_active_nba`: boolean
- `discovery_source`: string
- `last_updated`: timestamp
- `last_bio_update`: timestamp

### 📋 Subcollection: `/players/{playerId}/contracts/{contractId}`

Contract data is now stored in a subcollection for better organization and historical tracking.

**Document ID**: Typically `current_YYYY` (e.g., `current_2025`)

**Fields**:
- `Contract`: string (e.g., "$48.7M / 2 yrs")
- `Free Agent`: string (e.g., "2026 (UFA)")
- `bird_rights`: string (e.g., "Bird", "Early Bird", "Non-Bird")
- `free_agent_type`: string (e.g., "UFA", "RFA")
- `free_agency_year`: number
- `contract_summary`: string
- `contract`: object (raw scraped contract)
- `contract_clean`: object (cleaned contract data)
- `cap_hold`: number
- `qualifying_offer`: number
- `no_trade_clause`: boolean
- `trade_kicker`: number
- `agent`: { name, agency }
- `status`: string (e.g., 'Signed', 'FA', '2-Way')
- `updated_at`: timestamp

### 📊 Subcollection: `/players/{playerId}/seasons/{seasonId}`

Season statistics are now stored in a subcollection for multi-season support.

**Document ID**: Season identifier (e.g., `2024-25`)

**Fields**:
- `MIN`: number (minutes per game)
- `PPG`: number (points per game)
- `RPG`: number (rebounds per game)
- `APG`: number (assists per game)
- `FG%`: string (field goal percentage)
- `3PT%`: string (three-point percentage)
- `FT%`: string (free throw percentage)
- `EFG%`: string (effective field goal percentage)
- `TS%`: string (true shooting percentage)
- `USG%`: string (usage percentage)
- `BPM`: number (box plus/minus)
- `VORP`: number (value over replacement player)
- `WS`: number (win shares)
- `PER`: number (player efficiency rating)
- `Games Played`: number
- `season_id`: string (e.g., "2024-25")
- `updated_at`: timestamp

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
