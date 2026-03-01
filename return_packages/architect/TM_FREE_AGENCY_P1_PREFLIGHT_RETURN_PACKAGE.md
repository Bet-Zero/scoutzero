# TM_FREE_AGENCY_P1 — PREFLIGHT RETURN PACKAGE

Date: 2026-03-01  
Ticket: `TM_FREE_AGENCY_P1`  
Mode: PREFLIGHT (discovery-only, docs-only)  
Scope: Free Agency tab only (`activeTab === 'fa'`) in GM Dashboard  
Entry Path: `/gm/:teamId` -> click **Free Agency**

## 0) Stop-Condition Status

- Stop Condition 1 (cannot locate FA render gate): **not triggered**. Route and render gate were located. (Evidence: `src/App.jsx:35`, `src/features/architect/GMDashboard/GMDashboard.jsx:241-250`, `src/features/architect/GMDashboard/GMDashboard.jsx:318-335`)
- Stop Condition 2 (saves not traceable): **not triggered**. All cap-impacting FA actions are traceable to named handlers and mutation types. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1360-1551`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1566-1893`)
- Stop Condition 3 (UI success without persistence path): **not triggered** for traced FA actions. World actions route to `applyWorldMutation`; base-mode-only flows avoid Firestore writes. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:798-849`, `src/features/architect/utils/mutationPipeline.js:632-647`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1469-1480`)
- Stop Condition 4 (base mode writes Firestore): **not triggered** in traced FA workflows. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1402-1428`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1469-1480`, `src/features/architect/utils/mutationPipeline.js:867-868`)

## 1) Route -> Tab -> Component Tree Proof

### 1.1 Route registration to dashboard

- `/gm/:teamId` is registered in app routes and mounts `GmDashboardView`. (Evidence: `src/App.jsx:35`)
- `GmDashboardView` renders `GMDashboard` directly. (Evidence: `src/pages/GmDashboardView.jsx:2-8`)

### 1.2 Free Agency tab gate

- Tab button sets `activeTab` to `'fa'`. (Evidence: `src/features/architect/GMDashboard/GMDashboard.jsx:241-250`)
- Free Agency render gate is `activeTab === 'fa'` and mounts `FreeAgencySection`. (Evidence: `src/features/architect/GMDashboard/GMDashboard.jsx:318-335`)

### 1.3 Free Agency section root + child surfaces

- `FreeAgencySection` renders:
  - world-gating warning text,
  - incoming `OfferSheetList`,
  - outgoing `OfferSheetList`,
  - `FreeAgentPool`.  
    (Evidence: `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:32-75`)
- `FreeAgentPool` renders:
  - `FreeAgencyFilterBar`,
  - `FreeAgentPoolHeader`,
  - `SelectedFreeAgentCards`,
  - list of `FreeAgentRow`,
  - shared `EditContractModal` instance for signing.  
    (Evidence: `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:129-191`)

## 2) Modal(s) Used for Signing

- Free Agency tab uses the shared `EditContractModal`, instantiated inside `FreeAgentPool`, with callbacks:
  - `onSave={handleSaveFromModal}`,
  - `onSignAndTrade={onSignAndTrade}`,
  - `actionsOverride={worldId ? ['resign','signAndTrade'] : ['resign']}`.  
    (Evidence: `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:176-190`)
- Callback close-gating uses `{ success, message }` semantics:
  - modal normalizes result (`normalizeActionResult`),
  - closes only when `normalizedResult.success` is true,
  - otherwise keeps modal open and sets `saveError`.  
    (Evidence: `src/shared/components/EditContractModal.jsx:657-674`, `src/shared/components/EditContractModal.jsx:813-823`)
- Action callback resolution in modal:
  - `resign` -> `(onResign || onSaveContract || onSave)`,
  - `signAndTrade` -> `onSignAndTrade(...)`.  
    (Evidence: `src/shared/components/EditContractModal.jsx:749-767`)
- A second shared `EditContractModal` exists at dashboard root for non-FA-tab edit flows (`handleEditContract`/`handleCapSheetAction`), confirming shared component reuse across surfaces. (Evidence: `src/features/architect/GMDashboard/GMDashboard.jsx:422-446`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1944-1955`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:2060-2083`)

## 3) Save Path / Mutations / Validators / Persistence / Cap Refresh

### 3.1 Free Agency workflow inventory (all user-triggerable controls in tab)

| Workflow                              | Entry control                                             | User steps                                    | Expected state change                                                                                                                            | Handler / mutation                                                                                                           | Validator gates                                                                                                                                                        | Base vs world persistence                                                                                                              | Failure behavior                                                                               | Cap totals refresh                                                                                                               |
| ------------------------------------- | --------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| FA-WF-01 Filter/search/sort/clear     | Filter input/selects + Clear button                       | Change query/filters/sort or click Clear      | `filterState.query/position/ageBucket/salaryBucket/sortBy` updates; persisted to localStorage key `architect-free-agency-filters-v1`             | Local hook only (`useFreeAgencyFilterPersistence`)                                                                           | None (UI-only)                                                                                                                                                         | No Firestore writes; localStorage only                                                                                                 | N/A (UI-only)                                                                                  | None (list filtering only)                                                                                                       |
| FA-WF-02 Select / unselect FA row     | Click row                                                 | Toggle player in selected strip               | `selectedPlayers` add/remove; `signResults[name]` reset                                                                                          | Local state (`handleSelect`)                                                                                                 | None                                                                                                                                                                   | No Firestore writes                                                                                                                    | N/A                                                                                            | None                                                                                                                             |
| FA-WF-03 Remove selected card         | Card remove button (`X`)                                  | Remove card from selected strip               | `selectedPlayers` remove                                                                                                                         | Local state (`handleRemove`)                                                                                                 | None                                                                                                                                                                   | No Firestore writes                                                                                                                    | N/A                                                                                            | None                                                                                                                             |
| FA-WF-04 Open signing modal           | Row menu `Sign Free Agent` or selected card `Sign Player` | Open modal for chosen player                  | `contractPlayer` set; modal mounts                                                                                                               | Local state + shared `EditContractModal`                                                                                     | None before submit                                                                                                                                                     | No Firestore writes on open                                                                                                            | N/A                                                                                            | None                                                                                                                             |
| FA-WF-05 Sign Free Agent submit       | Modal action `Sign Free Agent` (resign path)              | Fill contract -> Confirm                      | Team/player snapshot updates; signed player removed from `freeAgents` list                                                                       | `EditContractModal(resign)` -> `onSave(handleSaveFromModal)` -> `onSign(actions.handleSign)` -> mutationType `signFreeAgent` | Base: `validateSigning` + local `validatePostStateCapLegality` via `buildCapAuditEvaluation`; World: pipeline `validateSigning` + world `validatePostStateCapLegality` | Base: `computeWorldMutation(... worldId:null)` + local state only; World: `runAuthoritativeFAMutation` -> `applyWorldMutation` persist | Modal stays open with `saveError` on `{success:false}`; toast errors from action layer         | `computeSigningResult` recalculates team totals; `setTeamCapSheet(...)` triggers downstream cap views using SSOT compute         |
| FA-WF-06 Sign-and-Trade submit        | Modal action `Sign & Trade` (world only)                  | Select destination team -> Confirm            | Team/player updates across two teams from trade result                                                                                           | `actions.handleSignAndTrade` -> mutationType `signAndTrade`                                                                  | `computeSignAndTradeResult` attaches prevalidated signing + trade contexts; world post-state validator also runs                                                       | Base: blocked (requires world). World: `runAuthoritativeFAMutation` -> `applyWorldMutation` persist                                    | Missing world/destination/player/contract yields `{success:false,message}`; modal remains open | Trade compute returns updated teams; current team synced via `syncTeamFromMutationResult`; cap views recompute from updated team |
| FA-WF-07 Match incoming offer sheet   | Offer row `Match`                                         | Click Match on `PENDING_MATCH` incoming row   | Offer sheet status transitions to `MATCHED` on offering + mirrored incoming sheet                                                                | `actions.handleMatchOfferSheet` -> mutationType `matchOfferSheet`                                                            | `validateOfferSheetResolution(action:'match')` + world post-state validator                                                                                            | Base: blocked and UI-disabled. World: authoritative pipeline persist                                                                   | `reportMutationError` toast on missing world/input/validation failure                          | Status-only change (no contract transfer); no totals recompute in this step                                                      |
| FA-WF-08 Decline incoming offer sheet | Offer row `Decline`                                       | Click Decline on `PENDING_MATCH` incoming row | Offer sheet status transitions to `DECLINED` on offering + mirrored incoming sheet                                                               | `actions.handleDeclineOfferSheet` -> mutationType `declineOfferSheet`                                                        | `validateOfferSheetResolution(action:'decline')` + world post-state validator                                                                                          | Base: blocked and UI-disabled. World: authoritative pipeline persist                                                                   | `reportMutationError` toast on failures                                                        | Status-only change (no totals recompute in this step)                                                                            |
| FA-WF-09 Finalize matched offer       | Incoming row `Finalize Match`                             | Click finalize on `MATCHED` incoming row      | Home team: remove incoming sheet + apply contract to player + recompute totals; Offering team: remove outgoing sheet                             | `actions.handleFinalizeOfferSheet` -> mutationType `finalizeMatchedOfferSheet`                                               | `validateOfferSheetResolution(action:'finalize')` + world post-state validator                                                                                         | Base: blocked and UI-disabled. World: authoritative pipeline persist                                                                   | `reportMutationError` toast for missing world/data/status mismatch                             | Home team totals recomputed in compute stage; synced team drives SSOT cap recompute in cap views                                 |
| FA-WF-10 Finalize declined offer      | Outgoing row `Finalize Signing`                           | Click finalize on outgoing `DECLINED` row     | Offering team signs/rosters player, removes sheet, recomputes totals; Home team removes incoming sheet/player/roster entry and recomputes totals | `actions.handleFinalizeOfferSheet` -> mutationType `finalizeDeclinedOfferSheet`                                              | `validateOfferSheetResolution(action:'finalize')` + world post-state validator                                                                                         | Base: blocked and UI-disabled. World: authoritative pipeline persist                                                                   | `reportMutationError` toast for missing world/data/status mismatch                             | Both teams totals recomputed in compute stage; current team sync updates UI state                                                |
| FA-WF-11 View profile navigation      | Row menu `View Profile`                                   | Click menu item                               | Browser location changes to `/profiles?player=...`                                                                                               | direct `window.location.href`                                                                                                | None                                                                                                                                                                   | No Firestore writes                                                                                                                    | N/A                                                                                            | None                                                                                                                             |

Workflow evidence bundle:  
`src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx:44-123`  
`src/features/architect/freeAgency/useFreeAgencyFilterPersistence.ts:116-143`  
`src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:51-116`  
`src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:119-191`  
`src/features/architect/freeAgency/FreeAgentPool/FreeAgentRow.jsx:186-221`  
`src/features/architect/GMDashboard/components/OfferSheetList.jsx:70-123`

### 3.2 Mutation path proof by workflow family

#### Signing (`signFreeAgent`)

- World mode path: `handleSign` -> `runAuthoritativeFAMutation('signFreeAgent', ...)` -> `applyWorldMutation(...)`. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1402-1410`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:798-828`)
- Base mode path: `handleSign` runs `validateSigning`, then `computeWorldMutation('signFreeAgent', worldId:null)`, then local post-state cap audit evaluation, then `setTeamCapSheet(updatedTeam)`. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1449-1551`)
- Base mode avoids Firestore mutation call in this path. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1469-1480`)

#### Sign-and-trade (`signAndTrade`)

- Requires world; base mode blocked with explicit error. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1572-1581`)
- World mode uses `runAuthoritativeFAMutation('signAndTrade', ...)`. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1629-1642`)

#### Offer-sheet actions (`match/decline/finalize`)

- All offer-sheet actions require world and route through `runAuthoritativeFAMutation(...)` with mutation types:
  - `matchOfferSheet`,
  - `declineOfferSheet`,
  - `finalizeMatchedOfferSheet`,
  - `finalizeDeclinedOfferSheet`.  
    (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1734-1893`)
- UI disables offer-sheet action buttons when no world. (Evidence: `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:37-63`, `src/features/architect/GMDashboard/components/OfferSheetList.jsx:74-76`)

## 4) Validators + Cap Audit Event Envelope

### 4.1 Pre-apply local validator (dashboard-side)

- `applyCapAuditedTeamMutation` builds preview cap audit event + runs `validatePostStateCapLegality` before applying local optimistic state. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:925-947`)
- This helper also tracks authoritative linkage / persist failures for world preview events. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:966-1041`)

### 4.2 World pipeline validator phases (authoritative)

- `applyWorldMutation` enforces `READ -> COMPUTE -> VALIDATE -> PERSIST -> POST-UPDATE`. (Evidence: `src/features/architect/utils/mutationPipeline.js:626-728`)
- Mutation-specific validation examples:
  - `signFreeAgent` -> `validateSigning(...)`. (Evidence: `src/features/architect/utils/mutationPipeline.js:2556-2571`)
  - `storeOfferSheet` -> `validateSigning(...)`. (Evidence: `src/features/architect/utils/mutationPipeline.js:2631-2646`)
  - `match/decline/finalize offer sheet` -> `validateOfferSheetResolution(...)`. (Evidence: `src/features/architect/utils/mutationPipeline.js:2648-2727`)
  - `signAndTrade` -> consumes prevalidated signing/trade contexts. (Evidence: `src/features/architect/utils/mutationPipeline.js:2742-2769`)
- World post-state validator always runs before persistence. (Evidence: `src/features/architect/utils/mutationPipeline.js:810-858`)

### 4.3 Cap audit envelope

- World event envelope includes `schemaVersion`, `validatorVersion`, `operationId`, `mutationType`, `worldId`, `teamCodes`, `playerIds`, `beforeTotalsByTeam`, `afterTotalsByTeam`, `valid`, `violations`, `warnings`, `diffSummary`. (Evidence: `src/features/architect/utils/mutationPipeline.js:2933-2966`)
- Firestore persistence is documented in pipeline as the only write phase. (Evidence: `src/features/architect/utils/mutationPipeline.js:867-868`)
- Base/local event shape mirrors the cap audit envelope fields. (Evidence: `src/features/architect/utils/capLegality/localCapAuditLog.ts:11-30`)

## 5) Cap Totals Refresh (SSOT) Proof

- Cap-impacting signing compute recalculates team totals via `computeTeamCapTotals(updatedTeam, toEndYear(seasonId))`. (Evidence: `src/features/architect/utils/mutationPipeline.js:1916-1917`)
- Offer-sheet finalization recomputes totals where contract/roster changes happen:
  - matched finalize -> home team totals recompute, (Evidence: `src/features/architect/utils/mutationPipeline.js:3408-3412`)
  - declined finalize -> offering + home totals recompute. (Evidence: `src/features/architect/utils/mutationPipeline.js:3544-3585`)
- UI team state refresh after world mutation runs through `syncTeamFromMutationResult`, setting `teamCapSheet` and refreshing world roster index. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:768-788`)
- Cap sheet surfaces derive totals from SSOT compute on `teamCapSheet` change (`useMemo(() => computeTeamCapTotals(...))`). (Evidence: `src/features/architect/capSheet/CapSheet/CapSheet.jsx:54-58`)
- SSOT helper declares canonical role for totals. (Evidence: `src/features/architect/utils/capTotals/computeTeamCapTotals.js:190-204`)

## 6) Ranked Gap List (P0/P1/P2)

### P0

- No P0 wiring hole was found in scoped Free Agency tab flows.

### P1-1 — No FA-tab path to create new offer sheets

- What user sees: Free Agency tab shows incoming/outgoing offer-sheet lists and resolution actions, but no visible control in this tab to create/store a new offer sheet.
- Why it matters: UI suggests full offer-sheet workflow on tab, but initiation likely depends on another tab/modal path, increasing feature discoverability risk.
- Evidence:
  - FA tab renders offer-sheet lists. (`src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:43-63`)
  - FA-tab modal instance uses `actionsOverride` limited to `resign`/`signAndTrade`, and does not pass `onStoreOfferSheet`. (`src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:186-190`)
  - Offer-sheet toggle in modal appears only when `selectedAction === 'signNew'` and `onStoreOfferSheet` is provided. (`src/shared/components/EditContractModal.jsx:1097-1110`)
- Minimal repro:
  1. Enter `/gm/:teamId`, open Free Agency tab in world mode.
  2. Attempt to initiate a new offer sheet from this tab.
  3. Observe only sign/sign-and-trade paths are available.
- Likely fix direction: Expose a clear "Offer Sheet" action from Free Agency tab by passing `onStoreOfferSheet` and enabling a supported action path, or explicitly label the tab as "resolve-only" for offer sheets.

### P1-2 — Free Agency world writes bypass local preview/audit helper used by other cap mutations

- What user sees: Signing/offer actions save and validate via world pipeline, but do not use the local preview/optimistic audited mutation path used elsewhere.
- Why it matters: Inconsistent pre-apply UX and audit parity across cap-impacting actions increases drift risk between tabs.
- Evidence:
  - Preview helper performs local post-state validation + preview event handling. (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:861-947`)
  - FA world actions call `runAuthoritativeFAMutation` directly. (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1402-1410`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1629-1642`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1734-1893`)
  - Authoritative runner goes straight to `applyWorldMutation`. (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:822-828`)
- Minimal repro:
  1. In world mode, sign a free agent from FA tab.
  2. Compare behavior with cap-sheet action that routes through `applyCapAuditedTeamMutation` (pre-apply preview event path).
  3. Observe FA path is direct authoritative call rather than local preview-first path.
- Likely fix direction: Either document intentional split clearly in SSOT docs or standardize FA world actions on a single audited path contract to reduce behavioral drift.

### P2-1 — FreeAgencySection -> FreeAgentPool prop API drift

- What user sees: No immediate user-visible break.
- Why it matters: stale prop contracts increase maintenance risk and misleading wiring assumptions.
- Evidence:
  - `FreeAgencySection` passes `teamCapSheet` and `capProjections` to `FreeAgentPool`. (`src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:65-69`)
  - `FreeAgentPool` component signature does not consume either prop. (`src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:42-50`)
- Minimal repro:
  1. Trace `FreeAgencySection` props into `FreeAgentPool`.
  2. Confirm the props are not read in `FreeAgentPool` body.
- Likely fix direction: Remove unused props or add explicit usage comments/typing so contracts stay intentional.

### P2-2 — Active tab type union is stale vs runtime tab keys

- What user sees: runtime tab switching still works in JS surface.
- Why it matters: Type safety for tab wiring is weakened; regressions can slip through type checks or produce TS noise.
- Evidence:
  - `ActiveTab` union contains `capTable` / `freeAgency`. (`src/features/architect/GMDashboard/hooks/useArchitectState.ts:157-163`)
  - Runtime uses `cap`, `capfull`, and `fa`. (`src/features/architect/GMDashboard/GMDashboard.jsx:282-294`, `src/features/architect/GMDashboard/GMDashboard.jsx:318-319`)
- Minimal repro:
  1. Compare union type values with `setActiveTab(...)` literals used by dashboard tabs.
  2. Observe string-set mismatch.
- Likely fix direction: Align `ActiveTab` union with actual runtime keys and type all tab literals from a shared constant.

## 7) Minimal Smoke Checklist (<10 min, Free Agency tab only)

### Base mode (no world selected)

1. Open `/gm/:teamId`, click Free Agency tab. Confirm warning text about world-required offer-sheet/sign-and-trade actions. (Evidence: `src/features/architect/GMDashboard/sections/FreeAgencySection.jsx:37-40`)
2. Verify offer-sheet action buttons are disabled with tooltips/reason text. (Evidence: `src/features/architect/GMDashboard/components/OfferSheetList.jsx:74-76`)
3. Open FA signing modal and confirm only `Sign Free Agent` action path is available from this tab (no sign-and-trade action in base mode). (Evidence: `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx:188`)
4. Known-invalid attempt: try an intentionally illegal signing payload (for example, extreme salary structure) and confirm modal stays open with error text instead of closing. (Evidence: `src/shared/components/EditContractModal.jsx:657-674`, `src/shared/components/EditContractModal.jsx:813-823`)

### World mode (active world selected)

1. Open Free Agency tab with active world.
2. Complete a legal `Sign Free Agent` action and confirm player leaves pool and save toast appears. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1419-1427`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:838-840`)
3. If incoming `PENDING_MATCH` offer exists, run `Match` then confirm status update in list. (Evidence: `src/features/architect/GMDashboard/components/OfferSheetList.jsx:70-83`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1756-1767`)
4. Known-invalid attempt: trigger finalize with status/team mismatch (for example stale row state) and confirm user-facing error toast. (Evidence: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1884-1889`)

## 8) Commands Run / Skipped

### Commands actually run

- `git status --short`
- `rg -n "gm/:teamId|/gm/" src`
- `rg -n "activeTab|setActiveTab|fa|Free Agency|FreeAgency" src/pages src/features/architect`
- `rg --files src/features/architect | rg "FreeAgentPool|freeAgency|OfferSheet|useArchitectActions|useArchitectState"`
- `rg -n "handleSign|handleSignAndTrade|handleMatchOfferSheet|handleDeclineOfferSheet|handleFinalizeOfferSheet|applyCapAuditedTeamMutation|runAuthoritativeFAMutation|validatePostStateCapLegality|mutationType"` `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `rg -n "applyWorldMutation|computeWorldMutation|validatePostStateCapLegality|signFreeAgent|storeOfferSheet|matchOfferSheet|declineOfferSheet|finalizeMatchedOfferSheet|finalizeDeclinedOfferSheet|signAndTrade"` `src/features/architect/utils/mutationPipeline.js`
- `rg -n "computeTeamCapTotals|useMemo" src/features/architect`
- Multiple evidence extractions with `nl -ba <file> | sed -n '<start>,<end>p'` across routed files listed in this return package.

### Commands intentionally skipped

- `npm run dev` (skipped: preflight is docs-only discovery; no manual runtime session was required)
- `npm run build` (skipped: no runtime code changes)
- `npm run test:*` (skipped: preflight discovery-only, no implementation changes)
- `npm run validate:project` (skipped: no structural code changes introduced)

## 9) Files Changed (this task)

- `return_packages/architect/TM_FREE_AGENCY_P1_PREFLIGHT_RETURN_PACKAGE.md` (new)
- `docs/architect/FREE_AGENCY_MASTER.md` (updated in same preflight pass)
