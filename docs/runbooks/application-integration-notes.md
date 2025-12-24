# Application Integration – Current Data Usage Audit

Last updated: 2025-11-10

### Player Data

- **Primary hooks**
  - `useSimplePlayerData` subscribes to `PLAYERS_COLLECTION` (defaults to `players_v2`) and returns only the root docs. It enriches each record via `utils/roster/enrichPlayerData` and exposes `name` for backwards compatibility.
  - `usePlayerData` is a thin wrapper around `useSimplePlayerData` that adds diagnostics.
  - `usePlayerDetail` queries `players_v2/{playerId}` plus `contracts`, `seasons`, and `evaluations` subcollections using helpers from `src/data/firestorePaths.js` and validates with `schemas/players_v2`.
  - Deprecated `useSeasonPlayerData` still exists; it attempts legacy fallbacks (`/seasons`, `/players`, local `/players.json`). Several diagnostics/components (e.g., `FirestoreDataDiagnostic`) still reference these legacy locations.
  - `useSeasonPlayerData` and diagnostics hard-code the `players`, `seasons`, and `teams` collections.
- **Helpers & selectors**
- `src/data/firestorePaths.js` now centralises path parsing for `players_v2`, `architect/basePlayers`, and `architect/baseTeams`, exposing helpers like `baseTeamRef`, `basePlayerRef`, etc.
- `constants/collections.ts` gained env-driven architect path overrides; `constants/teamList.js` now tracks both slugs (`id`) and three-letter codes (`code`) with lookup maps.
  - `utils/roster/enrichPlayerData` expects the v2 nested structure and derives convenience fields (primary contract, salary map, evaluation summaries).
  - `utils/selectors/newSchemeSelectors.js` contains schema-aware getters but is not referenced anywhere yet.
- **Writes**
  - `useAutoSavePlayer` writes evaluation data to `players_v2/{playerId}/evaluations/current` and updates the current season doc. No architect writes exist today.

### Team Data

- `utils/architect/firebaseTeamPlanHelpers.js` resolves architect team codes, fetches `/architect/baseTeams/{teamCode}`, and hydrates roster players by reading `/architect/basePlayers/{playerId}` docs, converting those contracts into the legacy `contract_clean` / `salaryByYear` structure.
- Architect views (`features/architect/*`) continue to consume that normalized shape, with all inputs sourced from architect collections. TPE/MLE/BAE values are derived from architect exception fields.
- Base team fallbacks pull from `TeamListFull` only when architect data is unavailable.

### Other Firestore Usage

- Lists, tier lists, roster projects, team plans, and free-agent pools live under their existing collections (`lists`, `tierLists`, `rosterProjects`, `teamPlans`, `freeAgents`) and are unaffected by the architect migration.
- `useFirebaseQuery` is a generic read helper still pointing to arbitrary collection names (defaults to legacy names where used).

### Config / Deployment Notes

- Vite env overrides:
  - `VITE_PLAYERS_COLLECTION` (defaults to `players_v2`)
  - `VITE_ARCHITECT_BASE_PLAYERS_PATH` (defaults to `architect/basePlayers`)
  - `VITE_ARCHITECT_BASE_TEAMS_PATH` (defaults to `architect/baseTeams`)
- Front-end expects Firebase rules/indices to permit read access on:
  - `players_v2/*` docs and `contracts|seasons|evaluations` subcollections
  - `/architect/basePlayers/*`
  - `/architect/baseTeams/*`
- Static team metadata (`TeamListFull`) now carries both `id` (route slug) and `code` (Firestorm acronym); ensure any downstream tooling aligns with the new `code` values.

### Observations / Migration Impact

- Architect flows now rely exclusively on `/architect/baseTeams` and `/architect/basePlayers`, while HoopZero continues to read `players_v2`. Contract data is converted on the fly to the `contract_clean` helper shape.
- Legacy season fallbacks (`useSeasonPlayerData`, diagnostic tooling) remain and should eventually be removed or pointed at architect collections.
- `TeamListFull` retains slug IDs for routing but now exports explicit `code` values for architect lookups; additional selectors/hooks should lean on these maps to avoid slug/code mismatches.
