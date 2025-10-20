# AGENTS.md – HoopZero/ScoutZero AI Instructions

## Project Overview

HoopZero is a public-facing NBA scouting platform. It displays player bios, stats, roles, contracts, and grades using a clean layout. All player data is loaded from Firebase Firestore using a **hierarchical player structure with subcollections** (not flattened documents).

This is the read-only counterpart to **ScoutZero**, an internal grading tool used to assign player attributes and evaluations.  
Agents should **never write to Firestore** or attempt to save data — only read.

---

## Coding Conventions

- Framework: **React + Vite + Firebase**
- Backend: **Firestore** (hierarchical player documents in `players_v2` collection)
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

This project uses **two main Firestore collections** for player/team data:

| Collection | Used For | Structure |
| ---------- | -------- | --------- |
| `/players_v2` | Player bio, contracts, seasons, evaluations | Hierarchical with subcollections |
| `/teams` | Team rosters, cap sheets (currently in migration to `/architect/`) | Flattened structure |

### Current Data Access Patterns

**For `/players_v2` (hierarchical structure):**
```javascript
// Access player bio data
const player = await getDoc(doc(db, 'players_v2', playerId));
const displayName = player.data().bio.displayName;
const age = player.data().bio.age;
const position = player.data().bio.position;

// Access contract subcollection
const contracts = await getDocs(collection(doc(db, 'players_v2', playerId), 'contracts'));

// Access season stats subcollection  
const seasons = await getDocs(collection(doc(db, 'players_v2', playerId), 'seasons'));
```

**For `/teams` (current structure during migration):**
```javascript
// Access team roster data
const team = await getDoc(doc(db, 'teams', teamId));
const players = team.data().capSheet.players; // Array of flattened player objects
```

### Migration Context
- **`/players_v2`**: Migration complete - use hierarchical access patterns
- **`/teams`**: Currently migrating to `/architect/` collections - see `docs/architect-teams-plan/` for target schema
- **Legacy `/players`**: Preserved for rollback, do not use for new code

📄 Reference `docs/CURRENT_FIRESTORE_SCHEMA.md` for current schema status  
📄 See `docs/architect-teams-plan/03-TARGET-SCHEMA.md` for migration targets

---

## Firebase Rules

- All data is **read-only from Firestore**
- Main collections:
  - `players_v2`: hierarchical player docs with bio, contracts, seasons, evaluations subcollections
  - `teams`: team rosters + `capSheet.players[]` with `contract_clean` (migrating to `/architect/`)

⚠️ Do not modify Firestore read logic without validating against `usePlayerData.js` and Firebase helpers.

---

## PR Guidelines

- Start PR titles with a **clear summary** (e.g., `refactor: split PlayerProfileView`)
- Include a **bullet summary** of changes
- Cite file paths using `【F:path†L#】` format
- Skip descriptions for unchanged UI unless relevant

---

## Documentation References

This project includes **generated docs** for navigation:

- **Component hierarchies**: `docs/ArchitectHierarchy.md`, `docs/FiltersHierarchy.md`, etc.
- **Migration documentation**: `docs/architect-teams-plan/` for target schema
- **Current schema**: `docs/CURRENT_FIRESTORE_SCHEMA.md` for active collections

### Refresh Documentation

```bash
npm run docs
```

---

## Other Notes

- `DEVELOPER_GUIDE.md` → detailed file structure, key files, and component logic
- `README.md` → setup instructions
- `docs/architect-teams-plan/` → target schema for teams migration
- Use `/features/profile/` and `/features/lists/` as **structural examples**
