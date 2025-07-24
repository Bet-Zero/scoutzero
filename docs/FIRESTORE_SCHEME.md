# 🗂️ FIRESTORE_SCHEMA.md

A full schema reference for all Firestore collections used in ScoutZero + Architect. Use this to understand field structures, nested paths, and usage.

---

## 📁 Collection: `/players/{playerId}`

### 📦 Top-Level Fields:

- `bio`: { AGE, HT, WT, Position, Team, Years Pro }
- `traits`: { Shooting, Defense, IQ, etc. }
- `roles`: { offense1, defense1, etc. }
- `blurbs`: { traits, roles, subroles, shootingProfile, twoWayMeter }
- `subRoles`: { offense: [], defense: [] }
- `badges`: array of badge strings
- `overall_grade`: number or string
- `shootingProfile`: string
- `system.stats`: { PTS, AST, FG%, eFG%, etc. }
- `contract`: raw scraped contract
- `contract_summary`: readable metadata summary
- `contract.extension`: full extension info (if signed)
- `draft`: { year, round, pick, team }
- `agent`: { name, agency }
- `status`: 'Signed', 'FA', '2-Way', etc.
- `team`: string
- `position`: string
- `player_id`: string
- `name`, `display_name`: string
- `cap_hold`, `qualifying_offer`, `no_trade_clause`, `trade_kicker`: flags

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
