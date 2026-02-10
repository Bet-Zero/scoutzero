# Architect Free Agency MASTER

## Purpose / Definition of Done

This document is the SSOT for Architect Free Agency preflight findings and high-level requirements to reach a shippable FA tab.

Definition of Done (high-level):

- Free Agency reads/writes through the same Architect SSOT used by Cap Sheet and Trade Machine.
- FA list is derived from the same canonical Architect contract/player state (including world context).
- Core FA mechanics (signings, cap holds, rights, exceptions, offer sheets, options, renounce) are wired, reflected in cap sheet state, and persisted only to writable Architect world/plan storage.
- No GM action writes to base `/teams`-style immutable datasets.
- Vacuum/worldless behavior is coherent and intentional.

---

## Current State (as-found)

### Live entry + tab chain

- Route chain is live: `/gm/:teamId` -> `GmDashboardView` -> `GMDashboard`.
- Free Agency is a live tab inside `GMDashboard` (`activeTab === 'fa'`) and is wired through `FreeAgencySection`.
- Key evidence:
  - `src/App.jsx:35`
  - `src/pages/GmDashboardView.jsx:7`
  - `src/features/architect/GMDashboard/GMDashboard.jsx:317`
  - `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:49`

### Shared SSOT layer

- Shared dashboard state: `useArchitectState`.
- Shared dashboard actions/mutations: `useArchitectActions`.
- Persist path: `persistMutation` -> `applyWorldMutation` -> `persistWorldMutation` -> `architect_worlds/{worldId}/...`.
- Key evidence:
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:268`
  - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:392`
  - `src/features/architect/utils/mutationPipeline.js:447`
  - `src/features/architect/utils/mutationPipeline.js:2425`

### Free-agent pool as-found

- Displayed pool is derived from `architect_basePlayers` contracts in `useArchitectState`.
- World player overrides are not part of this derivation path.
- A separate `freeAgents` collection loader exists but does not drive live list rendering.
- Key evidence:
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:335`
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:420`
  - `src/features/architect/utils/subscribeArchitectPlayerData.ts:77`
  - `src/features/architect/GMDashboard/hooks/useArchitectState.ts:384`
  - `src/features/architect/utils/firebaseTeamPlanHelpers.js:257`

---

## SSOT Requirements (what Free Agency must use)

- Use one shared state container for dashboard surfaces (Cap Sheet, Trade, FA), not parallel local data models.
- Use one shared mutation pipeline for all FA mutations, including validation and persistence contracts.
- Use world-aware loaders for all team/player reads in world mode.
- Persist only to Architect writable world/plan storage (`architect_worlds` or formal equivalent), never base team collections.
- Preserve intentional vacuum-mode behavior with explicit guarantees for each FA operation.

Reference anchors:

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:268`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:392`
- `src/features/architect/utils/worldTeamData.ts:81`
- `src/features/architect/utils/teamLoader.js:25`
- `src/features/architect/utils/mutationPipeline.js:588`
- `src/constants/collections.ts:58`

---

## Free Agent Pool Requirements

- Pool derivation must be from canonical architect player/contract schema (not legacy static pools).
- In world mode, pool must resolve against world-overlaid player state (including world player overrides and parent fallback behavior).
- Pool transitions (sign, option decline, renounce effects, offer-sheet status changes) must reflect immediately from shared state and survive reload.
- Remove or formally deprecate parallel/unused pool loaders that can drift from live behavior.

Reference anchors:

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:420`
- `src/features/architect/utils/teamLoader.js:229`
- `src/features/architect/utils/firebaseTeamPlanHelpers.js:255`

---

## Rules & Mechanics Requirements (high-level)

- **Signings:** enforce rights/exception/apron/hard-cap/roster checks and apply all cap effects in shared state.
- **Cap holds:** creation/removal must be consistent across signings/options/renounce and reflected in cap totals.
- **Bird rights:** support eligibility gates and renounce transitions.
- **Exceptions:** MLE/TPMLE/Room/BAE/Minimum eligibility and usage tracking must be consistent in UI/state/persisted data.
- **Offer sheets:** store/match/decline/finalize must be fully operable from live UI with correct team-role gating and cleanup.
- **Options/Renounce:** accept/decline + renounce flows must mutate canonical state and persist correctly.
- **Vacuum mode:** behavior must be coherent and documented for every FA operation.

Reference anchors:

- `src/features/architect/utils/capLegalityValidation.js:2029`
- `src/features/architect/utils/capLegalityValidation.js:3038`
- `src/features/architect/utils/capLegalityValidation.js:3425`
- `src/features/architect/utils/capLegalityValidation.js:3758`
- `src/features/architect/utils/capLegalityValidation.js:3819`
- `src/features/architect/utils/mutationPipeline.js:1438`
- `src/features/architect/utils/mutationPipeline.js:1808`
- `src/features/architect/utils/mutationPipeline.js:1968`
- `src/features/architect/utils/mutationPipeline.js:2568`
- `src/features/architect/utils/mutationPipeline.js:3169`

---

## Gaps

### A) SSOT alignment gaps

- FA pool derives from base players subscription, not world-overlaid player state.
- `loadFreeAgents()` legacy source is still invoked though not used in live pool rendering.

### B) Operation wiring gaps

- `handleSign` local optimistic update does not apply full pipeline mechanics (cap-hold removal, exception usage, hard-cap updates).
- Offer-sheet finalize buttons call action with wrong argument shape (live finalize can no-op).
- Multiple offer-sheet/sign-and-trade actions are persist-only with no shared-state optimistic update.

### C) Vacuum-mode coherence gaps

- Persistence hard-skips with null `worldId`; behavior differs by operation depending on whether local optimistic update exists.

### D) Validation/test surface gaps

- Strong pipeline/unit coverage exists, but UI-level FA wiring coverage is lighter than pipeline coverage.

Reference anchors:

- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:335`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts:384`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:632`
- `src/features/architect/GMDashboard/components/OfferSheetList.jsx:83`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:800`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:398`

---

## Open Questions

- Should FA pool in world mode include world player overrides only, or merged world->parent->base exactly like teamLoader player resolution?
- For vacuum mode, should all FA operations be supported purely in-memory, or should some be explicitly disabled with UI messaging?
- Should offer-sheet finalize remain list-driven, modal-driven, or both (single canonical UX path)?
- Is the legacy `freeAgents` collection path intentionally retained for fallback tooling, or should it be fully retired from dashboard runtime paths?
- What is the expected product behavior for QO/withdraw-QO flows in this phase (explicitly unsupported vs required)?
