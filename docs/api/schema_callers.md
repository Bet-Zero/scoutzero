# Legacy Schema Callers

| File | Legacy Usage | Migration Plan |
| --- | --- | --- |
| `src/utils/filtering/playerFilterUtils.js` | Reads `player.traits`, `player.roles.offense1`, `player.system.stats.*`, `player.contract.annual_salaries`.【F:src/utils/filtering/playerFilterUtils.js†L202-L276】 | Replace direct field reads with selectors: load season doc via new schema adapters, compute filters using `getEvalGrades`, `getEvalRoles`, `getStat`, and `getContractView`. Maintain compatibility by dual-reading until all screens migrate. |
| `src/features/lists/ListTierHeader/ListPlayerRow.jsx` | Displays roles via `player.roles?.offense1/defense1`.【F:src/features/lists/ListTierHeader/ListPlayerRow.jsx†L30-L31】 | Pass seasonDoc and call `getEvalRoles` to populate offense/defense columns. |
| `src/features/tierMaker/TierMakerBoard.jsx` | Normalises roles, salaries, contract metadata from legacy flat fields.【F:src/features/tierMaker/TierMakerBoard.jsx†L33-L52】 | Update to request seasonDoc (or selectors output) and rely on `getEvalRoles`, `getEvalSubroles`, and `getContractView` plus `getStat`. |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/index.jsx` | Renders blurbs via `player.blurbs?.overall`.【F:src/features/table/PlayerTable/PlayerRow/PlayerDrawer/index.jsx†L23-L28】 | Switch to `getEvalBlurbs` to obtain `overall`, `traits`, etc. |
| `src/components/shared/EditContractModal.jsx` | Edits contracts using `player.contract_clean.salaries_by_year` and legacy options.【F:src/components/shared/EditContractModal.jsx†L70-L114】 | Migrate to new contract subcollection (`players/{id}/contracts/*`) and `getContractView`; keep editing on team cap sheets until rewrite completes. |
| `src/features/profile/PlayerDetails/PlayerHeader/index.jsx` | Reads `player.contract.annual_salaries` to show salary summary.【F:src/features/profile/PlayerDetails/PlayerHeader/index.jsx†L15-L24】 | Use `getContractView` for salary/year-left and `players/{id}/contracts/*` for detail modal. |
| `src/hooks/useRosterManager.js` | Uses `player.roles.offense1/defense1` when building filters.【F:src/hooks/useRosterManager.js†L40-L48】 | Refactor to load seasonDoc and adopt `getEvalRoles`/`getEvalSubroles`. |

## Backward Compatibility Strategy
1. **Dual Read:** During transition, fetch both legacy player doc and new `seasons/{season}` doc. Use selectors for UI, fallback to legacy fields if selector returns null.
2. **Feature Flag:** Gate UI changes behind a config flag (`useNewSchema`) to toggle between selectors and legacy reads for staged rollout.
3. **Shadow Validation:** Compare selector outputs against legacy renders in analytics logs; ensure parity before flipping flag.

## Rollback Plan
- Build a rollback script that iterates `players/{id}/seasons/{season}` and converts via `mapNewSeasonToLegacy`, writing results back to flat fields (or exporting).【F:schema_transition/utils/schemaAdapters.cjs†L284-L332】
- Maintain `players_shadow` as long as rollout is incomplete; rollback can swap by copying shadow docs back to legacy collections.

## Shadow Run Plan
1. Run `MODE=shadow` player migration to populate `players_shadow` + `playersByNbaId_shadow`.
2. Update app (behind flag) to read from shadow collections using selectors for smoke tests.
3. Once parity confirmed, execute `MODE=live CONFIRM_SHADOW=1` to swap production.
