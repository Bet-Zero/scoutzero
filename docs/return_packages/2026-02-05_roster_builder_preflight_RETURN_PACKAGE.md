# Roster Builder Quick Audit — Preflight Return Package (2026-02-05)

## Works Today (Observed in Code)

- `/roster` renders the quick lineup builder with starters/rotation/bench sections.
- Team selection + “Current NBA Roster” auto‑fills from `players_v2` data.
- Add player flow works via drawer (targeted slot or next available slot).
- Remove player flow works via the ✕ control on cards.
- Search by player name filters the add‑player list.
- Save new roster creates a Firestore document in `rosterProjects`.
- `/rosters` lists saved rosters and links to `/roster/:id`.
- Rosters can be renamed or deleted from `/rosters`.

## Missing for v1 (Core Builder Scope)

- Save/overwrite for an **existing** roster (update flow is not wired).
- Team filter in the add‑player drawer (value mismatch prevents filtering).
- Free‑agent type filter in the add‑player drawer (case mismatch prevents filtering).
- Export/preview/download is not wired to any UI control.
- Duplicate‑player prevention (same player can be added to multiple slots).
- Basic roster integrity rules (position/slot constraints, roster size checks) are absent.

## Routes and How to Reach

- **`/roster`**: Header `Tools → Roster Builder`.
- **`/roster/:rosterId?`**: Open a saved roster from `/rosters` or direct link.
- **`/rosters`**: Header `Saved → Rosters` (list of saved rosters).

## Storage Locations / Collections / Keys

- **Firestore collection**: `rosterProjects`.
- **Document fields**: `name`, `team`, `starters`, `rotation`, `bench`, `createdAt`, `updatedAt`.
- **Doc ID**: used as `:rosterId` route param.

## Accidental Architect Coupling

- **One‑way reuse only**: Architect consumes roster UI/utilities (`RosterSection`, `buildInitialRoster`, `normalizePlayer`, `isTwoWayContract`) in `src/features/architect/shared/RosterVisual/RosterVisual.jsx`.
- **Roster Builder does not depend on Architect**.

## Validation Status

- **Not run** in this environment. Manual test script is provided in the master doc.
