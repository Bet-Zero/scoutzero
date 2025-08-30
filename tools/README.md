
# 🧠 ScoutZero / HoopZero – Data Flow & Script Index

This guide explains the **complete data pipeline** for your player database, from source files to Firebase.  
It also details what each script does and what files it reads/writes.

---

## 📦 Data Sources (Raw Inputs)
Stored in `/data/`

| File | Description |
|------|-------------|
| `contracts_parsed.json` | Contract data from your scraping script |
| `players_bios_2025.json` | Bio info (height, weight, age, team, etc.) |
| `nba_per_game_2025.csv` | Per-game stats (PPG, RPG, etc.) from your stat scraper |

---

## 🔀 Step 1: Merge & Transform
**Script:** `merge_universal_player_data.py`  
**Output:** `/data/players.json`

This script:
- Merges the 3 raw data sources
- Applies aliases and manual overrides
- Flattens each player into a single object:
```json
{
  "player_id": "lebron-james",
  "name": "LeBron James",
  "display_name": "LeBron James",
  "bio": { ... },
  "contract": { ... },
  "free_agency_year": 2025,
  "stats": { ... },
  ...
}
```
This is your **source of truth** going forward.

---

## ☁️ Step 2: Push to Firebase

### 🔹 A. System Data (Name, Bio, Contract)

**Script:** `push_bio_and_contract.py`  
**Run from:** `/scripts/`  
**Reads from:** `../data/players.json`  
**Pushes:**
- `name`
- `display_name`
- `bio`
- `contract`
- `free_agency_year`  
**Does NOT push:** stats, traits, roles, badges, blurbs

```bash
cd scripts
python3 push_bio_and_contract.py
```

---

### 🔹 B. Stats Only

**Script:** `push_stat_data.py`  
**Reads from:** `../data/nba_per_game_2025.csv`  
**Pushes:** `stats` block only  
**Run separately whenever stat updates are needed**

```bash
cd scripts
python3 push_stat_data.py
```

---

## 🧹 Optional: One-Time Cleanup

**Script:** `cleanup_legacy_fields.py`  
Use this ONCE to delete legacy top-level fields like:
- `age`, `position`, `height`, etc.  
They now live under `bio`.

```bash
python3 cleanup_legacy_fields.py
```

---

## 🗑 Deprecated Scripts

| Script | Reason |
|--------|--------|
| `transform_and_push_to_firebase.py` | ❌ Outdated – only pushes contracts from old file |
| `merge_contracts_and_stats.py` | ❌ Replaced by `merge_universal_player_data.py` |

---

## ✅ Final Firebase Structure (Per Player)

```json
{
  "player_id": "lebron-james",
  "name": "LeBron James",
  "display_name": "LeBron James",
  "bio": { ... },
  "contract": { ... },
  "free_agency_year": 2025,
  "stats": { ... },
  "traits": { ... },           // Scouting data (internal only)
  "roles": { ... },
  "subroles": { ... },
  "blurbs": { ... }
}
```

This format keeps system data clean and allows for targeted updates without overwriting scouting content.

---
