# AGENTS.md – HoopZero/ScoutZero AI Instructions

## Project Overview

HoopZero is a public-facing NBA scouting platform. It displays player bios, stats, roles, contracts, and grades using a clean layout. All player data is loaded from Firebase Firestore using a flattened player structure (no nested documents).

This is the read-only counterpart to **ScoutZero**, an internal grading tool used to assign player attributes and evaluations.  
Agents should **never write to Firestore** or attempt to save data — only read.

---

## Coding Conventions

- Framework: **React + Vite + Firebase**
- Backend: **Firestore** (flattened player documents in `players` collection)
- Style: **Tailwind CSS** with utility classes
- Imports: Use alias paths (e.g., `@/components/...`)
- File Format: **Named exports** preferred; default exports only for top-level views

---

## File Structure

Project follows a **feature-first structure** with scoped utility and component folders:

```

src/
components/     Shared UI + wrappers
features/      Domain features (table, profile, roster, lists, filters, tierMaker)
hooks/         Custom React hooks for Firebase + filtering
pages/         Route-level views
utils/         Helpers for filtering, formatting, roster logic
constants/     Role lists, badge sets, etc.
firebase/      Firestore helpers + config
styles/        Tailwind and additional styles

```

- New code should be grouped by **feature** where possible
- Reusable UI or logic goes in `shared/`, `hooks/`, or `utils/`

---

## Task Rules for Agents

- ✅ Refactors should preserve **visual layout and logic**
- ✅ Break large components (>200 lines) into **clean subcomponents**
- ✅ Keep **logic and layout separated** where appropriate
- ✅ Use **smart, readable file naming** (`TraitGradesBlock.jsx`, `AddPlayerDrawer.jsx`, etc.)
- ✅ Preserve modals, filters, blurbs, and Firestore reads
- ✅ Leave the worktree **clean** (`git status` should show no changes)
- ❌ Never create new branches
- ❌ Never amend or squash existing commits

---

## Firestore Data Source Rules

This project uses **two Firestore collections** for player/team data:

| Collection | Used For                                                                      |
| ---------- | ----------------------------------------------------------------------------- |
| `/players` | Global player data (bio, traits, roles, stats, badges, blurbs, raw contracts) |
| `/teams`   | Roster-specific data (contract_clean, team cap sheets, Architect tools)       |

- All role, trait, stat, badge, and evaluation info comes from `/players`
- All salary/cap validation logic must use `contract_clean` from `/teams`
- Only `/teams` should be modified when editing contracts or roster logic
- Treat `/players` as **read-only master records**

📄 Reference [`DATA_SOURCE_MAP.md`](../docs/DATA_SOURCE_MAP.md) for usage patterns  
📄 See [`FIRESTORE_SCHEMA.md`](../docs/FIRESTORE_SCHEMA.md) for full field breakdowns

---

## Firebase Rules

- All data is **read-only from Firestore**
- Main collections:
  - `players`: flattened player docs (traits, roles, stats, badges, blurbs, etc.)
  - `teams`: team rosters + `capSheet.players[]` with `contract_clean`

⚠️ Do not modify Firestore read logic without validating against `usePlayerData.js` and Firebase helpers.

---

## PR Guidelines

- Start PR titles with a **clear summary** (e.g., `refactor: split PlayerProfileView`)
- Include a **bullet summary** of changes
- Cite file paths using `【F:path†L#】` format
- Skip descriptions for unchanged UI unless relevant

---

## Documentation & Atlas Files

This project includes **auto-generated docs** under `atlas-docs/` for humans _and_ AI.

- **HUMAN_GUIDE.md** → plain-English overview of features & files
- **PLAIN_MAP.md** → skimmable file-by-file index
- **api.md** → list of exported functions/components
- **RULES_CATALOG.md / RULES_FLOW.md** → grouped rule sets + flow diagrams
- **all-deps.json** → machine-readable dependency graph (preferred for AI traversal)

### Refresh

```bash
npm run docs:all && npm run map:all
```

---

## Other Notes

- `DEVELOPER_GUIDE.md` → detailed file structure, key files, and component logic
- `README.md` → setup instructions & Atlas index
- Use `/features/profile/` and `/features/lists/` as **structural examples**
