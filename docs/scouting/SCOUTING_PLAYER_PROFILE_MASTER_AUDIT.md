/\*\*

- FILE: docs/scouting/SCOUTING_PLAYER_PROFILE_MASTER_AUDIT.md
- PURPOSE: Master audit of the Scouting Player Profile experience (routes, data contract, findings, phases).
- OWNERSHIP: Feature: scouting/player-profile
-
- HISTORY:
- - 2026-01-21: Created by plan `plans/_archive/scouting-player-profile-master-audit/plan.md`, chunk_n/a
- - 2026-01-21: Phase 1 data contract alignment (TwoWay + Blurbs + ShootingProfile)
- - 2026-01-21: Phase 2 save flow reliability (dirty state, resilient writes, save indicator)
- - 2026-01-22: Phase 3 feature completeness (video examples + blurbs wiring)
- - 2026-01-22: Phase 4 polish (debounced autosave + modal a11y)
-
- LINKS:
- - Plan: plans/_archive/scouting-player-profile-phase-4/plan.md
- - Phase 2 RP: docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_PHASE_2_RP.md
- - Phase 3 RP: docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_PHASE_3_RP.md
- - Phase 4 RP: docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_PHASE_4_RP.md
- - Latest Chunk: n/a (no chunks used)
    \*/

# Scouting Player Profile Master Audit

**Mode:** Preflight (review-only)  
**Date:** 2026-01-21  
**Scope:** HoopZero Scouting / Player Profile experience (`/profiles`)

---

## 1) Overview

The current Scouting Player Profile is a single-page workflow rendered at `/profiles` that lets users select a player (by team dropdowns or search) and view/edit scouting details: bio header, last-season stats, traits grid, offensive/defensive roles, subroles, shooting profile, two-way meter, badges, and an overall blurb + grade. Trait/role/subrole/shooting profile/two-way blurbs open in a modal. Changes are auto-saved via Firestore batch writes when `hasChanges` is true.

Data dependencies are entirely from Firestore `players_v2` and its subcollections. List data comes from `useSimplePlayerData` (main docs only). The selected player loads via `usePlayerDetail`, which fetches the player doc plus `contracts`, `seasons`, and `evaluations` subcollections. `enrichPlayerData` normalizes and denormalizes fields (currentContractView/currentSeasonStats/currentEvaluationView fallbacks).

---

## 2) File Map

### Routes / Pages

- `src/App.jsx` → `/profiles` route (`PlayerProfileView`).
- `src/pages/PlayerProfileView.jsx` → state orchestration, selection UI, data loading, auto-save, modal wiring.

### Major Components

- `src/features/profile/PlayerDetails/index.jsx` (composed profile layout)
- `src/features/profile/PlayerDetails/PlayerHeader/index.jsx` (bio header, contract, FA)
- `src/features/profile/PlayerDetails/PlayerStatsTable.jsx` (stats row)
- `src/features/profile/PlayerDetails/PlayerTraitsGrid.jsx` (traits + blurb icon)
- `src/features/profile/PlayerDetails/PlayerRolesSection/index.jsx`
  - `SubRoleSelector.jsx` (subrole modal)
  - `ShootingProfileSelector.jsx`
  - `TwoWayMeter.jsx`
- `src/features/profile/PlayerDetails/BadgeSelector.jsx`
- `src/features/profile/PlayerDetails/OverallBlurbBox.jsx`
- `src/features/profile/BreakdownModal.jsx` (trait/role/subrole/shooting/two-way blurbs)
- `src/features/profile/PlayerSearchBar.jsx`, `TeamPlayerDropdowns.jsx`, `PlayerNavigation.jsx`

### Shared UI Primitives

- `src/shared/components/ui/Modal.jsx` (blurbs modal wrapper)
- `src/shared/components/ui/VideoExamples.jsx` (embedded video list)
- `src/shared/components/ui/grades/OverallGradeBlock.jsx` (grade input)
- `src/shared/components/TeamLogo.jsx`, `src/shared/components/PlayerHeadshot.jsx`

### Utilities / Hooks / Services

- `src/shared/hooks/useSimplePlayerData.ts` (players list)
- `src/shared/hooks/usePlayerDetail.js` (full player doc + subcollections)
- `src/features/profile/hooks/useAutoSavePlayer.js` (batch save)
- `src/features/roster/utils/enrichPlayerData.js` (adapter/normalizer)
- `src/features/profile/utils/profileHelpers.js` (blurb labels/lookup/video examples)
- `src/data/firestorePaths.js` (collection/subcollection refs)
- `src/constants/collections.ts` (players_v2 collection names)
- `src/shared/utils/roles/roleUtils.js` + `src/constants/SubRoleMasterList.js`
- `src/constants/badgeList` (badge options)
- `src/constants/styles.js` (dropdown styling)

---

## 3) Data Contract

### Canonical Player Shape (repo example)

Source: `player-scrape/firestore_staging/docs/players_v2_structure.md` (Toumani Camara sample)

```json
{
  "bio": {
    "displayName": "Toumani Camara",
    "name": "Toumani Camara",
    "playerId": "toumani_camara",
    "position": "F",
    "height": 79,
    "weight": 230,
    "dob": "2000-05-08",
    "shoots": "Left",
    "draft": { "year": 2023, "round": 2, "pick": 52, "teamId": "PHX" },
    "display": {
      "team": "Portland Trail Blazers",
      "teamId": "POR",
      "POS": "F",
      "yearsPro": 2,
      "averageAnnualValue": 12319014,
      "yearsLeft": 5,
      "freeAgentYear": 2030,
      "freeAgentType": "UFA"
    }
  },
  "currentContractView": {
    "freeAgentYear": 2030,
    "freeAgentType": "UFA",
    "contractType": "ROOKIE CONTRACT",
    "options": ["TO"],
    "salaryByYear": { "2025": 2221677, "2026": 2406205 }
  },
  "currentEvaluationView": {
    "roles": {
      "offense1": null,
      "offense2": null,
      "defense1": null,
      "defense2": null
    },
    "subRoles": { "offense": [], "defense": [] },
    "shootingProfile": null,
    "badges": [],
    "traits": { "Shooting": null, "Passing": null }
  },
  "currentSeasonStats": { "PTS": 12.4, "REB": 5.0, "AST": 3.3, "FG%": 0.456 }
}
```

### Keying Strategy

- Player ID = Firestore doc id (`/players_v2/{playerId}`), used throughout:
  - `useSimplePlayerData` → `id` from doc id
  - `usePlayerDetail` → `playerId` input
  - `PlayerHeadshot` → `/assets/headshots/{playerId}.png`

### Section-by-Section Inputs / Paths / Defaults

**Bio / Header**

- Source:
  - Main doc `players_v2/{playerId}` (`bio` + `bio.display`)
  - Contracts from `currentContractView` or `contracts` subcollection
- Adapter:
  - `enrichPlayerData` derives `primaryContract`, `salaryByYear`, `formattedPosition`, `age`
- Defaults:
  - Missing height/weight/age display as `N/A`
  - `PlayerHeader` falls back to `player.name` for name
- Risk points:
  - `contractLength` is expected in `PlayerHeader` but not set for currentContractView-derived contracts

**Stats**

- Source:
  - `currentSeasonStats` (main doc) or `seasons/{seasonId}.stats`
- Adapter:
  - `enrichPlayerData` sets `latestSeasonStats` + `latestSeasonMeta`
- Defaults:
  - `PlayerStatsTable` uses `N/A` for missing stats
- Risk points:
  - Percentages assume decimals (0–1) and are multiplied by 100; inconsistent upstream formats can break display

**Traits**

- Source:
  - `currentEvaluationView.traits` or `evaluations/{doc}.traits`
- Adapter:
  - `enrichPlayerData` maps `traits` to top-level
- Defaults:
  - `PlayerProfileView` initializes `defaultTraits` (0s)
  - `PlayerTraitsGrid` treats `<=0` as ungraded (renders `—`)

**Roles (Primary)**

- Source:
  - `currentEvaluationView.roles` or `evaluations/{doc}.roles`
- Adapter:
  - `enrichPlayerData` maps `roles`
- Defaults:
  - `PlayerProfileView` uses `defaultRoles` with empty strings

**Subroles**

- Source:
  - `currentEvaluationView.subRoles` or `evaluations/{doc}.subRoles`
- Adapter:
  - `enrichPlayerData` maps `subRoles` to `{ offense: [], defense: [] }`
- Defaults:
  - `SubRoleSelector` normalizes to empty arrays when missing

**Shooting Profile**

- Source:
  - `currentEvaluationView.shootingProfile` or `evaluations/{doc}.shootingProfile`
- Adapter:
  - `enrichPlayerData` merges `evaluations/current` over `currentEvaluationView`
- Defaults:
  - `enrichPlayerData` returns `""` for no selection; selector expects one of `Elite|Plus|Capable|Willing|Hesitant|Non`

**Two-Way Meter**

- Source:
  - `evaluations/{doc}.twoWay` and `currentEvaluationView.twoWay`
- Adapter:
  - `enrichPlayerData` merges `evaluations/current` over `currentEvaluationView`
- Defaults:
  - `PlayerProfileView` defaults to `50` if missing

**Badges**

- Source:
  - `currentEvaluationView.badges` or `evaluations/{doc}.badges`
- Adapter:
  - `enrichPlayerData` maps `badges`
- Defaults:
  - `BadgeSelector` expects array; default `[]`

**Blurbs (Trait/Role/Subrole/Shooting/Two-Way/Overall)**

- Source:
  - `evaluations/{doc}.blurbs` (schema: `z.record(string, any)`)
- Adapter:
  - `normalizeBlurbs` accepts flat or nested shapes and returns canonical nested `{ traits, roles, subroles, shootingProfile, twoWayMeter, overall }`
  - `profileHelpers.getBlurbValue` reads from normalized blurbs
- Defaults:
  - `defaultBlurbs` in `PlayerProfileView`

### Save / Load Flow

**Load**

1. Player list: `useSimplePlayerData` → `players_v2` main docs
2. Selected player: `usePlayerDetail` → main doc + `contracts`, `seasons`, `evaluations`
3. `enrichPlayerData` → normalized fields for UI

**Save** (`useAutoSavePlayer`)

- Writes to:
  - `players_v2/{playerId}/evaluations/current` (full evaluation blob + blurbs)
  - `players_v2/{playerId}/seasons/{seasonId}` (denormalized `evaluationView`)
  - `players_v2/{playerId}` (denormalized `currentEvaluationView`)
- Trigger:
  - `hasChanges` flag in `PlayerProfileView` (only set by some edits)

---

## 4) Findings

### 🔴 Bugs / Incorrect Behavior

1. **Two-Way meter never loads saved values**

- Impact: The two-way slider always resets to `50`, ignoring saved evaluation data.
- Where: `src/features/roster/utils/enrichPlayerData.js:160`, `src/pages/PlayerProfileView.jsx:84`.
- Fix approach: Include `twoWay` in `currentEvaluationView` and map it in `enrichPlayerData` (or read from evaluations when available).
- Status: ✅ Resolved in Phase 1 (merge + denormalized `twoWay`).

1. **Blurbs likely never load when `currentEvaluationView` exists**

- Impact: Saved blurbs are invisible (modal opens empty) because blurbs are only in evaluations subcollection, not in currentEvaluationView.
- Where: `src/features/roster/utils/enrichPlayerData.js:160`, `src/pages/PlayerProfileView.jsx:84`.
- Fix approach: Merge `evaluations` blurbs into the enriched player object or denormalize blurbs into `currentEvaluationView`.
- Status: ✅ Resolved in Phase 1 (normalize + merge + denormalized `blurbs`).

1. **Subrole, badge, and shooting profile edits do not trigger auto-save**

- Impact: Changes appear in UI but are never persisted because `hasChanges` is not set.
- Where: `src/pages/PlayerProfileView.jsx:84`, `src/pages/PlayerProfileView.jsx:134`.
- Fix approach: Wrap setters to set `hasChanges(true)` or track dirty state in those components.
- Status: ✅ Resolved in Phase 2 (wrapped setters with `markDirty()`).

1. **Autosave batch fails if season doc is missing**

- Impact: `batch.update(seasonRef)` fails when the current season doc doesn't exist, aborting the entire batch save.
- Where: `src/features/profile/hooks/useAutoSavePlayer.js:53`.
- Fix approach: `set(seasonRef, { evaluationView }, { merge: true })` or check/create season doc before update.
- Status: ✅ Resolved in Phase 2 (changed to `set` with `merge: true` for all refs).

1. **Contract summary often renders as `—` despite salary data**

- Impact: Contract display in header is blank for currentContractView-derived data.
- Where: `src/features/profile/PlayerDetails/PlayerHeader/index.jsx:21`.
- Fix approach: Compute contract length from `salaryByYear` keys or use `yearsRemaining`/`averageAnnualValue` from `currentContractView`.

1. **Global arrow-key navigation interferes with typing**

- Impact: While editing blurbs or search, left/right arrows can switch players unexpectedly.
- Where: `src/pages/PlayerProfileView.jsx:125`.
- Fix approach: Ignore keydown events when focus is inside inputs/textarea/contentEditable.

### 🟠 Missing Wiring / Incomplete Features

1. **Video examples are stubbed**

- Impact: Only a hardcoded sample video exists; no per-player or per-section storage.
- Where: `src/features/profile/utils/profileHelpers.js:38`.
- Fix approach: Define video URL storage in evaluations (e.g., `blurbs.videoExamples.{key}`) and wire into modal.
- Status: ✅ Resolved in Phase 3 (videoExamples stored in evaluations/current + currentEvaluationView).

1. **No visible save state or error feedback**

- Impact: Users can’t tell if changes saved or failed.
- Where: `src/features/profile/hooks/useAutoSavePlayer.js:92`, `src/pages/PlayerProfileView.jsx:180`.
- Fix approach: Add saving/error UI states and surface errors.- Status: ✅ Resolved in Phase 2 (added `SaveStatusIndicator` component with idle/saving/saved/error states).

1. **Role blurbs unavailable before selecting a role**

- Impact: No way to draft role blurbs until a role is chosen.
- Where: `src/features/profile/PlayerDetails/PlayerRolesSection/index.jsx:23`.
- Fix approach: Allow blurbs even when role value is empty, or provide a dedicated blurb entry UI.

### 🟡 Cleanup / Tech Debt

1. **Trait color logic duplicated**

- Impact: Two separate color maps for traits and overall grade; risk of drift.
- Where: `src/features/profile/PlayerDetails/PlayerTraitsGrid.jsx:16`, `src/shared/components/ui/grades/OverallGradeBlock.jsx:10`.
- Fix approach: Centralize color scale in a shared utility.

1. **Subrole modal duplicates shared modal behavior**

- Impact: Two modal patterns (custom vs shared) with inconsistent a11y and close behavior.
- Where: `src/features/profile/PlayerDetails/PlayerRolesSection/SubRoleSelector.jsx`, `src/shared/components/ui/Modal.jsx`.
- Fix approach: Reuse shared modal or extract a shared modal base.

1. **Legacy/unused TeamPlayerSelector component**

- Impact: Uses legacy field names (`Team`, `Name`) and appears unused.
- Where: `src/features/profile/TeamPlayerSelector.jsx`.
- Fix approach: Remove or migrate to v2 schema and use it consistently.

1. **Shooting profile tiers duplicated**

- Impact: Hard-coded tiers in component vs shared roles utils.
- Where: `src/features/profile/PlayerDetails/PlayerRolesSection/ShootingProfileSelector.jsx`, `src/shared/utils/roles/roleUtils.js`.
- Fix approach: Use the shared tier list to prevent drift.

### 🟢 Nice-to-Have Polish

1. **Modal accessibility gaps**

- Impact: No ESC close, no focus trap, no ARIA labels.
- Where: `src/shared/components/ui/Modal.jsx` (notes already mention a11y gaps).
- Fix approach: Add aria attributes, focus trap, ESC handler, and restore focus.

1. **Autosave throttling**

- Impact: Rapid clicks can trigger frequent writes.
- Where: `src/features/profile/hooks/useAutoSavePlayer.js`.
- Fix approach: Debounce saves or batch changes with a short delay.

1. **Shooting profile default value mismatch**

- Impact: Missing data becomes `'—'`, which is not a valid tier option.
- Where: `src/features/roster/utils/enrichPlayerData.js`, `ShootingProfileSelector`.
- Fix approach: Use empty string or null instead of `'—'` for selector-bound values.
- Status: ✅ Resolved in Phase 1 (normalized empty string for missing values).

---

## 5) Recommended Execution Phases (3–6 phases)

### Phase 1 — Data Contract Alignment

- **Objective:** Ensure evaluation data loads consistently (twoWay/blurbs/roles/etc.).
- **Tasks:**
  - Map `twoWay` into `currentEvaluationView` and `enrichPlayerData`.
  - Merge blurbs from evaluations into the enriched player object.
  - Align shooting profile default values with selector expectations.
- **Acceptance Criteria:**
  - Existing saved evaluations display correctly across profile sections.
- **Validation Steps:**
  - Load a player with existing evaluations and confirm two-way/blurbs render.
- **Status:** ✅ Completed in Phase 1 (2026-01-21).

### Phase 2 — Save Flow Reliability

- **Objective:** Ensure all edits persist reliably.
- **Tasks:**
  - Set `hasChanges` on subrole, badge, and shooting profile edits.
  - Make autosave resilient when season docs are missing.
  - Add a visible save/error state.
- **Acceptance Criteria:**
  - All edits survive refresh; failed writes are visible to the user.
- **Validation Steps:**
  - Edit each section and verify Firestore writes (or mock in dev).
- **Status:** ✅ Completed in Phase 2 (2026-01-21).
- **Return Package:** `docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_PHASE_2_RP.md`

### Phase 3 — Feature Completeness (Blurbs + Media)

- **Objective:** Complete the blurb and video example UX.
- **Tasks:**
  - Define per-section video URL schema in evaluations.
  - Wire `getVideoExamples` to Firestore-backed data.
  - Decide whether role blurbs can exist without role selection.
- **Acceptance Criteria:**
  - Blurbless sections can be authored and video examples load per player.
- **Validation Steps:**
  - Open a blurb modal and confirm video list updates per player.
- **Status:** ✅ Completed in Phase 3 (2026-01-22).
- **Return Package:** `docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_PHASE_3_RP.md`

### Phase 4 — Cleanup & UX Polish

- **Objective:** Reduce autosave write spam and improve modal accessibility without design changes.
- **Tasks:**
  - Debounce autosave writes with an in-flight save guard.
  - Add modal a11y essentials (ESC close, focus in/out, aria attributes).
  - Source shooting profile tiers from shared constants and remove unused imports.
  - Confirm profile-related tests are under `src/tests/`.
- **Acceptance Criteria:**
  - Debounce active; rapid edits batch into fewer writes.
  - Modals close with ESC and restore focus to opener.
- **Validation Steps:**
  - Rapid edits only trigger a single save after pause.
  - ESC closes blurbs and subrole modal; focus returns to opener.
- **Status:** ✅ Completed in Phase 4 (2026-01-22).
- **Return Package:** `docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_PHASE_4_RP.md`

---

## 6) Open Questions / Unblocked Decisions

1. Should `/profiles` be read-only in the public HoopZero build, or gated to internal users? (Currently writes to Firestore via `useAutoSavePlayer`.)
2. Should blurbs and video examples live in `currentEvaluationView` for faster loads, or remain only in evaluations subcollection?
   - Decision: ✅ Denormalized into `currentEvaluationView` with evaluations/current as canonical source.
3. Is `currentSeasonStats` always decimals for percentages (0–1), or can it be 0–100?
