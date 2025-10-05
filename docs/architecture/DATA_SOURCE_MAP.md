# 📘 DATA_SOURCE_MAP.md

This file defines which Firestore collections serve as the source of truth for different types of player/team data. It clarifies what data lives where, which tools use which paths, and what rules Codex should follow.

---

## 🔹 /players — Universal Player Records

- One document per player (`player_id`)
- Used by: ScoutZero, HoopZero (public site), Rankings, Clip Tagger
- Stores all player data except team cap/roster context
- **DO NOT store roster-specific contract logic here** (use `/teams` for that)

### 📦 Main Fields:

- `bio`: AGE, HT, WT, Team, Position, Years Pro
- `traits`: Trait grades (Defense, Shooting, etc.)
- `blurbs`: All trait/role/shot-profile descriptions
- `roles`, `subRoles`, `shootingProfile`: Role & label system
- `badges`, `overall_grade`, `status`: Evaluation metadata
- `system.stats`: Per-game & advanced stats
- `contract`: Raw scraped contract data
- `contract_summary`: Structured version for quick reference
- `draft`, `agent`, `team`, `position`, `player_id`, `display_name`: Identifiers & metadata

---

## 🔸 /teams — Cap Sheet & Roster Info (Architect)

- One document per team (`teamId`)
- Used only by Architect tools (Cap Manager, Trade Machine, FA System)
- Source of truth for active roster, contracts, and cap sheets

### 📦 Structure:

- `capSheet.lastUpdated`: Timestamp
- `capSheet.players[]`: Full player objects with cleaned contract data

Each player includes:

- Basic info: `name`, `player_id`, `position`, `height`, `weight`, `age`, `display_name`
- `contract_clean`: Finalized contract with structure:
  - `years`, `total_value`, `average_value`
  - `salaries_by_year`: `{ [year]: { salary, guaranteed, option, source } }`
  - `fa_year`, `fa_type`, `bird_rights`, `has_extension`

---

## ⚙️ Rules for Codex

| Task                                  | Use Collection                      |
| ------------------------------------- | ----------------------------------- |
| Player scouting, grading, stats       | `/players`                          |
| Showing bio & roles in tables         | `/players`                          |
| Showing salary in rankings (optional) | `/players.contract_clean` if synced |
| Cap validation, roster moves          | `/teams` only                       |
| Contract editing                      | `/teams.contract_clean` only        |

---

## 🧠 Reminder for Codex:

- Treat `/players` as the _public, clean, global player record_
- Treat `/teams` as the _private, editable roster state for GM tools_
