# TM_CAP_SHEET_P1 — PREFLIGHT RETURN PACKAGE

Date: 2026-02-28  
Mode: PREFLIGHT (discovery-only, docs-only output)  
Scope: Cap Sheet page workflows + wiring only (`activeTab === 'cap'`)  
Runtime observation: **Code-trace only** (app not launched)

---

## 1. Executive Summary

This preflight audited the Cap Sheet page surface rendered by:

- Route: `src/App.jsx:35` (`/gm/:teamId`)
- View: `src/pages/GmDashboardView.jsx:4-8`
- Tab gate: `src/features/architect/GMDashboard/GMDashboard.jsx:282-291`
- Section root: `src/features/architect/GMDashboard/sections/CapSheetSection.jsx:16-27`
- Child surfaces: `CapSheet` + `ExceptionTracker`

What the page does today:

1. Displays cap summary tiles, player salary rows, cap hold rows, breakdown totals, and exception/TPE summary cards.
2. Provides three primary workflows from this page surface:
- open player contract editor (`onSelectPlayer`)
- manage dead money (modal)
- manage exceptions (modal)
3. Applies optimistic local mutation flow for dead cap/exceptions in both base/world modes via `applyCapAuditedTeamMutation` (`useArchitectActions.ts:848-1022`), with post-state validator precheck and world persistence when `worldId` is present.

Highest-risk findings:

- **P0:** "Manage Exceptions" writes `team.exceptions`, but Exception Tracker cards read top-level `team.mle/tpMle/bae/dpe`, so edits do not drive the page’s own exception cards.
- **P0:** UI exposes `dpe`, but mutation validation rejects `dpe` as unknown key in world mode, causing save failure/rollback.
- **P1:** Trade exception expiry display reads `tpe.expires`, while canonical TPE normalization exposes `expirationDate` / `expiresOn`.

---

## 2. Cap Sheet Page Map

### 2.1 Route -> Page -> Section -> Components

| Layer | File / Symbol | Evidence |
| --- | --- | --- |
| Route registration | `src/App.jsx` -> `Route path="/gm/:teamId"` | `src/App.jsx:35` |
| Route-level page | `GmDashboardView` -> `<GMDashboard />` | `src/pages/GmDashboardView.jsx:4-8` |
| Tab control | `setActiveTab('cap')` via "Cap Sheet" button | `src/features/architect/GMDashboard/GMDashboard.jsx:211-220` |
| Cap tab render gate | `activeTab === 'cap'` -> `<CapSheetSection .../>` | `src/features/architect/GMDashboard/GMDashboard.jsx:282-291` |
| Cap section wrapper | `CapSheetSection` | `src/features/architect/GMDashboard/sections/CapSheetSection.jsx:4-29` |
| Main cap UI | `<CapSheet .../>` | `src/features/architect/GMDashboard/sections/CapSheetSection.jsx:18-25` |
| Exceptions/TPE summary | `<ExceptionTracker .../>` | `src/features/architect/GMDashboard/sections/CapSheetSection.jsx:26` |

### 2.2 Section/Subcomponent Map (with key props/hooks)

| Section | Primary file | Key props in | Key hooks/utils used |
| --- | --- | --- | --- |
| Cap Sheet shell + table + breakdown | `src/features/architect/capSheet/CapSheet/CapSheet.jsx` | `teamCapSheet`, `currentYear`, `onSelectPlayer`, `onSetDeadCap`, `onSetExceptions` (`CapSheet.jsx:36-42`) | `computeTeamCapTotals` (`:56-59`), `getContractYearSlice`/`getMinimumCapHit` (`:82-93`), `getActiveUnsignedCapHoldsByEndYear` (`:179-182`), `getCapPercentage` (`:288-289`), `usePlayerRulesProfiles` (`:48-53`) |
| Summary tiles | `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx` | `teamCapSheet`, `selectedYear`, `totals` (`CapSummaryTiles.jsx:10`) | `isHardCappedAtFirstApron`, `isHardCappedAtSecondApron`, `getFirstApronHardCapReason` (`:29-35`) |
| Dead money modal | `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx` | `isOpen`, `onClose`, `teamCapSheet`, `onSave`, `currentYear` (`ManageDeadMoneyModal.jsx:7-13`) | local `entries` state (`:14`), `handleSave` canonicalization (`:87-117`) |
| Exceptions modal | `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx` | `isOpen`, `onClose`, `teamCapSheet`, `onSave`, `currentYear` (`ManageExceptionsModal.jsx:67-73`) | `getCapSettingsForYear` (`:15`, `:89-96`), `canUseRoomException` (`:16`, `:80-86`), `handleSave` (`:152-176`) |
| Exception/TPE tracker | `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx` | `teamCapSheet`, `currentYear` (`ExceptionTracker.jsx:121`) | `getCapSettingsForYear` (`:133`), `getTeamTpeList` (`:129`), local hard-cap derivation (`:158-205`) |

### 2.3 Mode Differences (base vs world vs dev)

| Mode | Behavior |
| --- | --- |
| Base mode (`worldId = null`) | Team load falls back to base loader: `loadWorldTeamData` -> `loadTeamCapSheet` (`src/features/architect/utils/worldTeamData.ts:93-95`, `src/features/architect/utils/firebaseTeamPlanHelpers.js:190-204`). Cap mutations apply local optimistic state and local cap audit event only; no Firestore persistence (`useArchitectActions.ts:941-943`). |
| World mode (`worldId` set) | Team load via `getTeam(worldId, teamCode)` world-aware fallback (`worldTeamData.ts:97-101`). Mutations write optimistic preview + call `applyWorldMutation` (`useArchitectActions.ts:945`; `mutationPipeline.js:632-939`) then persist to `architect_worlds/{worldId}/teams/{teamCode}` + `events/{eventId}` (`mutationPipeline.js:2836-2837`, `2888-2894`, `2957`). |
| Dev/debug enablement | `CapAuditDebugPanel` is rendered by dashboard (`GMDashboard.jsx:360`) but returns `null` unless `import.meta.env.DEV` or local debug flag is enabled (`CapAuditDebugPanel.tsx:27-29`, `210-212`). |

---

## 3. Workflow Inventory

### 3.1 Workflow table (controls visible from Cap Sheet page)

| Workflow | Entry control | User steps | Expected state change | SSOT recompute trigger | Validator gates (exact functions) | Persistence mode (base vs world) | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Open Cap Sheet surface | Cap tab button in dashboard | 1) Open `/gm/:teamId` 2) Click `Cap Sheet` tab | `activeTab` changes to `'cap'`; `CapSheetSection` mounts | `CapSheet` computes totals via `computeTeamCapTotals(teamCapSheet, selectedYear)` in `useMemo` | none (view switch only) | base/world load differences handled in `useArchitectState` fetch effect (`useArchitectState.ts:462-503`) | Loading states shown if team/players missing (`CapSheetSection.jsx:12-14`, `CapSheet.jsx:61-67`) |
| Change displayed year | Year selector button in Cap Sheet header | Click a season chip | Local `selectedYear` changes (`CapSheet.jsx:245`) | `useMemo([teamCapSheet, selectedYear])` recomputes totals (`CapSheet.jsx:56-59`) | none | local UI-only state | none |
| Toggle cap holds detail rows | "Show/Hide Cap Holds" button | Click toggle | `showCapHolds` flips (`CapSheet.jsx:347`) and rows show/hide | No data mutation; render updates from existing `displayedCapHolds` | none | local UI-only state | none |
| Open player contract editor | Player name button in roster row | Click player name | Calls `onSelectPlayer(player)` (`CapSheet.jsx:297-304`) -> `handleEditContract` sets selected player + opens modal (`useArchitectActions.ts:1847-1857`) | No totals recompute on open | none on open; downstream modal actions have their own validators outside this specific click action | No persistence from open action itself | none on open |
| Open Manage Dead Money modal | "Manage Dead Money" button | Click button | `showDeadMoneyModal=true` (`CapSheet.jsx:400`) | none on open | none on open | local UI state only until save | none |
| Save dead money changes | "Save Changes" in dead money modal | 1) Edit rows 2) Save | Modal flattens rows -> `canonicalDeadCap` and calls `onSave(canonicalDeadCap)` (`ManageDeadMoneyModal.jsx:104-116`) | `setTeamCapSheet(afterTeamSnapshot)` in optimistic mutation path (`useArchitectActions.ts:939`) causes CapSheet totals recompute | Pre-apply gate: `validatePostStateCapLegality` via `buildCapAuditEvaluation` (`useArchitectActions.ts:540-617`, `576`). World pipeline gate: `validateDeadCap` in `validateMutation` (`mutationPipeline.js:2515-2523`), plus world post-state gate (`mutationPipeline.js:834-844`). | Base: local update + local cap audit event to `architect_base_capAuditEvents_v1` (`localCapAuditLog.ts:37`; `useArchitectActions.ts:922-925`, `941-943`). World: preview event in `architect_world_preview_capAuditEvents_v1` + `applyWorldMutation` persistence (`localCapAuditLog.ts:38`; `useArchitectActions.ts:945`; `mutationPipeline.js:2836-2837`, `2894`). | Validation fail pre-apply: blocked with `toast.error` (`useArchitectActions.ts:927-937`, `743-751`). World persist fail: optimistic rollback (`:964`) + error toasts (`persistMutation` at `:720`, `reportMutationError` at `:750`). |
| Open Manage Exceptions modal | "Manage Exceptions" button | Click button | `showExceptionsModal=true` (`CapSheet.jsx:394`) | none on open | none on open | local UI state only until save | none |
| Save exceptions changes | "Save Changes" in exceptions modal | 1) Edit exception rows 2) Save | Modal builds `canonicalExceptions` and calls `onSave` (`ManageExceptionsModal.jsx:152-175`) -> `handleSetExceptions` local optimistic update (`useArchitectActions.ts:1827-1845`) | `setTeamCapSheet(afterTeamSnapshot)` triggers CapSheet recompute (`useArchitectActions.ts:939`) | Pre-apply gate: `validatePostStateCapLegality` (`useArchitectActions.ts:576`). World pipeline gate: `validateExceptions` (`mutationPipeline.js:2525-2533`) + world post-state gate (`mutationPipeline.js:834-844`). | Base: local update only + base local cap audit log (`useArchitectActions.ts:922-925`, `941-943`; `localCapAuditLog.ts:37`). World: preview log + `applyWorldMutation` world writes (`useArchitectActions.ts:945`; `mutationPipeline.js:2836-2837`, `2894`). | World validation/persist failure: optimistic rollback + toasts (`useArchitectActions.ts:964-995`, `persistMutation :720`). |
| Cancel dead money/exceptions modal | Cancel button or close icon | Click cancel/close | Modal closes (`ManageDeadMoneyModal.jsx:126`, `217`; `ManageExceptionsModal.jsx:190`, `351`) | none | none | none | none |

### 3.2 Persistence boundary summary for Cap Sheet-triggered writes

- Local optimistic + audit wrapper: `applyCapAuditedTeamMutation` (`useArchitectActions.ts:848-1022`)
- World mutation entrypoint: `applyWorldMutation` (`mutationPipeline.js:632-939`)
- World writes:
- Team doc write: `worldTeamRef(worldId, teamCode)` (`mutationPipeline.js:2836-2837`, `architectFirestorePaths.ts:79-83`)
- Event write: `architect_worlds/{worldId}/events/{eventId}` (`mutationPipeline.js:2888-2894`, `2957`)

---

## 4. Field-by-Field Wiring Table

Legend:

- `Component` = UI location where value appears.
- `Data Source` = exact variable/property path used by render code.
- `Computation Origin` = function/derivation path feeding the value.

| UI Label / Display Name | Section / Component | Value Type | Data Source (exact path) | Computation Origin | Mode differences (base vs world) | Refresh / recompute conditions | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cap Sheet season header (e.g. `2025-26`) | `CapSheet` header | season string | `formatYearLabel(selectedYear)` (`CapSheet.jsx:229`) | Local formatter (`CapSheet.jsx:79-80`) | none | changes when `selectedYear` changes | Display-only |
| Confidence badge text (`Official/Reported/Projected/Unknown`) | `CapSheet` header | indicator label | `confidenceLabel.text` (`CapSheet.jsx:231-236`) | Derived from `totals._meta.rulesSourcesSummary` (`CapSheet.jsx:189-221`) from `computeTeamCapTotals` meta (`computeTeamCapTotals.js:264-269`) | none | recomputes when `totals` changes (`useMemo`) | Key indicator |
| Confidence badge style class | `CapSheet` header | indicator style | `confidenceLabel.className` | same as above | none | same as above | Key indicator |
| Year selector options | `CapSheet` header | season list | `allYears.map(year => formatYearLabel(year))` (`CapSheet.jsx:242-253`) | `generateYears(currentYear, 7)` (`CapSheet.jsx:69-72`) | none | recalculates if `currentYear` prop changes | UI-local navigation |
| Total Cap Allocations (tile) | `CapSummaryTiles` | currency | `totals.totalCapAllocations` (`CapSummaryTiles.jsx:16-17`, `52`) | `computeTeamCapTotals` (`CapSheet.jsx:56-59`; `computeTeamCapTotals.js:240-257`) | base/world source team differs; formula same | changes when `teamCapSheet` or `selectedYear` changes | SSOT totals path |
| Cap Space (tile) | `CapSummaryTiles` | currency | `capSpace = -deltas.vsCap` (`CapSummaryTiles.jsx:39`, `63`) | `deltas.vsCap` from SSOT totals (`computeTeamCapTotals.js:244-249`) | same | same as above | Sign inversion is local tile logic |
| Luxury Tax Space (tile) | `CapSummaryTiles` | currency | `luxuryTaxSpace = -(deltas.vsLuxuryTax || 0)` (`CapSummaryTiles.jsx:40`, `74`) | SSOT totals delta | same | same as above | local fallback to 0 |
| 1st Apron Space (tile) | `CapSummaryTiles` | currency | `firstApronSpace = -deltas.vsFirstApron` (`CapSummaryTiles.jsx:41`, `85`) | SSOT totals delta | same | same as above | |
| 2nd Apron Space (tile) | `CapSummaryTiles` | currency | `secondApronSpace = -deltas.vsSecondApron` (`CapSummaryTiles.jsx:42`, `112`) | SSOT totals delta | same | same as above | |
| 1st Apron hard-cap lock icon | `CapSummaryTiles` | boolean indicator | `isFirstApronHardCapped` (`CapSummaryTiles.jsx:29-32`, `87`) | `isHardCappedAtFirstApron(teamCapSheet, selectedYear)` (`hardCapUtils.js:83-134`) | base/world dependent on team fields (`hardCapFirstApron`, `mle/bae usage`, `hardCapped`) | updates when `teamCapSheet` or `selectedYear` changes | Key indicator |
| 1st Apron hard-cap reason tooltip | `CapSummaryTiles` | text indicator | `firstApronReason` (`CapSummaryTiles.jsx:35`, `98`) | `getFirstApronHardCapReason(teamCapSheet)` (`hardCapUtils.js:142-173`) | same | same as above | Key indicator |
| 2nd Apron hard-cap lock icon | `CapSummaryTiles` | boolean indicator | `isSecondApronHardCapped` (`CapSummaryTiles.jsx:33`, `114`) | `isHardCappedAtSecondApron(teamCapSheet)` (`hardCapUtils.js:136-140`) | same | updates when `teamCapSheet` changes | Key indicator |
| Player age | `CapSheet` roster row | count | `player.age ?? '-'` (`CapSheet.jsx:286`, `309`) | Direct player field | team data source differs by mode | updates when player row data updates | non-monetary numeric |
| Player cap hit | `CapSheet` roster row | currency | `capHit` (`CapSheet.jsx:282`, `318`) | `getCapHit()` local helper -> `getContractYearSlice` + `getMinimumCapHit` (`CapSheet.jsx:82-93`) | same logic, different source data by mode | recomputes on `teamCapSheet.players` / `selectedYear` change | Not read from `totals` |
| Player cap % | `CapSheet` roster row | derived % | `capPctDisplay` (`CapSheet.jsx:288-289`, `321-323`) | `getCapPercentage(capHit, salaryCap)` where `salaryCap = capProjections[yearKey]?.cap` (`CapSheet.jsx:73-78`) | same | recomputes on `selectedYear` / cap hit changes | **Potential drift** vs totals salary cap source |
| Player base salary | `CapSheet` roster row | currency | `salary` (`CapSheet.jsx:281`, `330`) | Contract slice salary/capHit fallback | same | recomputes on row data/year change | |
| Note badges: `2W/PO/TO/Vet Min/NG/EXT` | `CapSheet` roster row | key indicators | `renderNotes(...)` output (`CapSheet.jsx:99-165`, `334`) | Local conditional derivation from contract slice + rules profile | same | recomputes on row data/year/rules profile | Key indicators |
| Cap Holds toggle count badge | `CapSheet` footer | count | `displayedCapHolds.length` (`CapSheet.jsx:353`) | `getActiveUnsignedCapHoldsByEndYear(...).sort(...)` (`CapSheet.jsx:179-182`) | same | recomputes when `teamCapSheet.capHolds` or `selectedYear` changes | |
| Cap Holds row amount | `CapSheet` expanded holds table | currency | `(h.amount || 0)` (`CapSheet.jsx:378`) | source from filtered cap holds list | same | same as above + requires `showCapHolds=true` | |
| Cap Holds row reason | `CapSheet` expanded holds table | key indicator text | `h.reason || h.type || ''` (`CapSheet.jsx:381`) | direct cap hold fields | same | same as above | |
| Player Salaries (breakdown) | `CapSheet` breakdown | currency | `totals.playersTotal` (`CapSheet.jsx:412`) | SSOT totals (`computeTeamCapTotals.js:217`) | same | `teamCapSheet` or `selectedYear` change | |
| Dead Money (breakdown) | `CapSheet` breakdown | currency | `totals.deadMoneyTotal` (`CapSheet.jsx:415-420`) | SSOT totals `computeDeadMoneyForYear` (`computeTeamCapTotals.js:82-167`, `227`) | same | same as above | Row conditional if >0 |
| Cap Holds (breakdown) | `CapSheet` breakdown | currency | `totals.capHoldsTotal` (`CapSheet.jsx:423-428`) | SSOT totals via cap holds util (`computeTeamCapTotals.js:221-224`) | same | same as above | Row conditional if >0 |
| Incomplete Roster Charge amount | `CapSheet` breakdown | currency | `totals.incompleteChargesTotal` (`CapSheet.jsx:431-450`) | SSOT totals missing slots * rookieMin (`computeTeamCapTotals.js:233-237`) | same | same as above | Row conditional if >0 |
| Incomplete Roster Charge open slot count | `CapSheet` breakdown | count indicator | `totals._meta.incompleteRosterCharge.missingSlots` (`CapSheet.jsx:438-444`) | SSOT `_meta` block (`computeTeamCapTotals.js:271-279`) | same | same as above | Key indicator |
| Total Cap Hit (footer) | `CapSheet` footer total | currency | `totals.totalCapAllocations` (`CapSheet.jsx:461`) | SSOT totals | same | same as above | |
| Hard Capped banner visibility | `ExceptionTracker` `HardCapCard` | boolean indicator | `isActive = !!hardCapped || !!reason` (`ExceptionTracker.jsx:49-53`) | `hardCapped` from team + derived usage fallback (`ExceptionTracker.jsx:214`) | same | updates when tracker inputs change | Key indicator |
| Hard cap limit amount | `ExceptionTracker` `HardCapCard` | currency | `limitAmount` -> `${limitAmount?.toLocaleString()}` (`ExceptionTracker.jsx:56-57`, `86`) | `capData = getCapSettingsForYear(currentYear)` (`ExceptionTracker.jsx:133`) + level selection | same | updates with `currentYear` or hard-cap level | |
| Hard cap reason text | `ExceptionTracker` `HardCapCard` | indicator text | `description` (`ExceptionTracker.jsx:60-64`, `90`) | `hardCapReason` local branch logic (`ExceptionTracker.jsx:165-205`) | same | updates with exception usage/hard cap flags | Key indicator |
| NT-MLE remaining | `ExceptionTracker` card | currency | `mleRemaining` (`ExceptionTracker.jsx:147`, `222`) | `getRemaining(mle, capData.fullMLE)` + hard-cap adjustments (`:165-196`) | same | updates when `teamCapSheet.mle` or `currentYear` changes | Reads top-level `mle`, not `exceptions.mle` |
| TP-MLE remaining | `ExceptionTracker` card | currency | `tpRemaining` (`ExceptionTracker.jsx:148`, `229`) | same pattern | same | same | Reads top-level `tpMle` |
| BAE remaining | `ExceptionTracker` card | currency | `baeRemaining` (`ExceptionTracker.jsx:149`, `236`) | same pattern | same | same | Reads top-level `bae` |
| DPE remaining | `ExceptionTracker` card | currency | `dpeRemaining` (`ExceptionTracker.jsx:150`, `243`) | `getRemaining(dpe, 0)` + hard-cap adjustments (`:198-205`) | same | same | Reads top-level `dpe` |
| Exception availability status labels (`N/A`) | `ExceptionTracker` cards | key indicators | `mleStatus/tpStatus/baeStatus/dpeStatus` (`ExceptionTracker.jsx:152-155`, `225`, `233`, `240`, `247`) | local hard-cap/usage branch logic (`:165-205`) | same | updates with usage/hard cap flags | Key indicator |
| Trade Exceptions count badge | `ExceptionTracker` header | count | `tradeExceptions.length` (`ExceptionTracker.jsx:129`, `259`) | `getTeamTpeList(teamCapSheet)` (`ExceptionTracker.jsx:129`; `normalizeTeamTpe.js:280-302`) | source path differs based on available canonical/legacy TPE fields | updates when `teamCapSheet.exceptions.tpe` or `teamCapSheet.tradeExceptions` changes | |
| Trade Exception row amount | `ExceptionTracker` list | currency | `(tpe.amount || 0)` (`ExceptionTracker.jsx:104`) | normalized TPE field mapping (`normalizeTeamTpe.js:223-227`) | same | updates with TPE list changes | |
| Trade Exception row expiry | `ExceptionTracker` list | date-ish text | `tpe.expires` (`ExceptionTracker.jsx:114`) | direct field read | same | updates with TPE list changes | **Likely mismatch** with canonical normalized fields (`expirationDate`/`expiresOn`) |
| Dead Money modal row season | `ManageDeadMoneyModal` | season string input | `entry.seasonKey` (`ManageDeadMoneyModal.jsx:159-160`) | derived from existing `deadCap` or default current season (`:17-61`, `65`) | same | updates as user edits | Editable workflow field |
| Dead Money modal row amount | `ManageDeadMoneyModal` | currency input | `entry.amount` (`ManageDeadMoneyModal.jsx:168-169`) | local `entries` state -> canonical save map (`:104-113`) | same | updates as user edits | Editable workflow field |
| Exceptions modal total amount input | `ManageExceptionsModal` | currency input | `exc.totalAmount` (`ManageExceptionsModal.jsx:271`) | local modal state seeded from `teamCapSheet.exceptions` + defaults (`:98-130`) | same | updates as user edits | Editable workflow field |
| Exceptions modal used amount input | `ManageExceptionsModal` | currency input | `exc.usedAmount` (`ManageExceptionsModal.jsx:292`) | same as above | same | updates as user edits | Editable workflow field |
| Exceptions modal remaining column | `ManageExceptionsModal` | currency derived | `remaining = totalAmount - usedAmount` (`ManageExceptionsModal.jsx:221-223`, `310`) | local per-row arithmetic | same | updates on modal input edits | Can be negative (`isOverused`) |
| Exceptions modal room eligibility warning | `ManageExceptionsModal` | key indicator | `roomExceptionEligibility.eligible` (`ManageExceptionsModal.jsx:80-86`, `227-260`) | `canUseRoomException(teamCapSheet, currentYear)` (`computeTeamCapTotals.js:293-328`) | same | updates when team data/year changes | Key indicator |
| Exceptions modal default reference amounts | `ManageExceptionsModal` summary block | currency | `getDefaultTotalAmount(type, capSettings)` (`ManageExceptionsModal.jsx:341`) | `getCapSettingsForYear(currentYear)` (`:89-96`) + default map (`:43-61`) | same | updates when year changes/modal loads | Reference-only |

No currently displayed value on this page was left `UNTRACED`.

---

## 5. Ranked Gap List (P0 / P1 / P2)

### P0 Ship-Blockers

#### P0-1: Manage Exceptions workflow does not drive Exception Tracker cards (wiring hole)

- What user sees:
- User edits/saves exceptions in "Manage Exceptions", but NT-MLE/TP-MLE/BAE/DPE cards on the same page do not reflect those edits.
- Why this is a problem:
- Core page workflow appears successful but page-level outputs stay stale/misaligned.
- Evidence:
- Tracker reads top-level fields: `mle`, `tpMle`, `bae`, `dpe` (`src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx:122-129`).
- Modal writes `teamCapSheet.exceptions` (`src/features/architect/capSheet/modals/ManageExceptionsModal.jsx:152-175`).
- Mutation updates only `exceptions` field (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1834-1837`; `src/features/architect/utils/mutationPipeline.js:2426-2429`).
- Correct behavior (plain English):
- Exception cards should read the same canonical exception object that the modal writes, or the save path should also update the fields cards consume.
- Minimal repro:
1. Open Cap Sheet tab.
2. Click **Manage Exceptions**.
3. Change MLE total/used values and save.
4. Observe exception cards remain on prior values.

#### P0-2: DPE is exposed in UI but rejected by world mutation validation

- What user sees:
- DPE row is editable in Manage Exceptions; save in world mode can fail and rollback.
- Why this is a problem:
- UI advertises support for a control that authoritative persistence rejects.
- Evidence:
- UI supports `dpe`: `EXCEPTION_TYPES = ['mle','tpmle','bae','room','dpe']` (`src/features/architect/capSheet/modals/ManageExceptionsModal.jsx:22`).
- Validator allowlist excludes `dpe`: `VALID_EXCEPTION_KEYS = ['mle','tpmle','bae','room']` (`src/features/architect/utils/capLegalityValidation.js:946`).
- World pipeline validates with `validateExceptions` for `setExceptions` (`src/features/architect/utils/mutationPipeline.js:2525-2533`).
- World failure triggers rollback (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:964-995`).
- Correct behavior (plain English):
- Either remove DPE from this modal until supported end-to-end, or make validator and downstream consumers accept DPE consistently.
- Minimal repro:
1. Enter world mode.
2. Open **Manage Exceptions**.
3. Enable or set non-zero DPE.
4. Save.
5. Observe save failure toast + rollback.

### P1 Important

#### P1-1: Trade exception expiry column likely stale/blank for canonical TPE data

- What user sees:
- Trade Exception rows may show empty expiry text.
- Why this is a problem:
- Misleading lifecycle visibility for TPEs.
- Evidence:
- UI reads `tpe.expires` (`src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx:114`).
- Canonical normalize helper maps expiry aliases to `expirationDate` / `expiresOn`, not `expires` (`src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js:246-253`, `300-301`).
- Correct behavior (plain English):
- Expiry column should read normalized canonical expiry field(s) used by TPE helpers.
- Minimal repro:
1. Use a world/team with canonical `exceptions.tpe[]` data.
2. Open Cap Sheet > Trade Exceptions section.
3. Observe expiry cell empty despite TPE expiry existing.

#### P1-2: Modals close immediately on save before world persistence outcome

- What user sees:
- User clicks save, modal closes instantly, then failure toast may appear after close.
- Why this is a problem:
- Failed save can discard in-modal editing context and increase user confusion.
- Evidence:
- Dead money modal save closes immediately: `onSave(...); onClose();` (`src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx:115-116`).
- Exceptions modal save closes immediately: `onSave(...); onClose();` (`src/features/architect/capSheet/modals/ManageExceptionsModal.jsx:174-175`).
- World persistence is async and can fail later (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:945-997`).
- Correct behavior (plain English):
- Keep modal state alive until persistence confirms success, or re-open with preserved edits on failure.
- Minimal repro:
1. In world mode, submit invalid exceptions payload (e.g., DPE).
2. Click save.
3. Modal closes, then failure toast appears and state rolls back.

#### P1-3: Player cap % uses deprecated cap projection source instead of the same cap-rules source used by totals

- What user sees:
- Player row cap % can drift from summary totals math in edge-year/source mismatch scenarios.
- Why this is a problem:
- One page displays two salary-cap-derived values from different source chains.
- Evidence:
- Cap % denominator uses `capProjections[yearKey]?.cap` (`src/features/architect/capSheet/CapSheet/CapSheet.jsx:73-78`, `288-289`).
- Totals use `getCapRulesForYear(...)` via `computeTeamCapTotals` (`src/features/architect/utils/capTotals/computeTeamCapTotals.js:209-214`).
- `capProjections.js` marked deprecated header (`src/features/architect/utils/capProjections.js:2-4`).
- Correct behavior (plain English):
- Cap % denominator should be sourced from the same rules profile source used by totals.
- Minimal repro:
1. Open year with projected/fallback rule-source differences.
2. Compare row cap % implied cap to totals’ cap context.

### P2 Polish

#### P2-1: World save failure can emit duplicate error toasts

- What user sees:
- Two error toasts for one failed save event.
- Why this is a problem:
- Noisy UX; reduces clarity of the true failure.
- Evidence:
- `persistMutation` emits `toast.error` on failure (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:720`, `734`).
- `applyCapAuditedTeamMutation` failure callback then calls `reportMutationError`, which also toasts (`src/features/architect/GMDashboard/hooks/useArchitectActions.ts:989-995`, `743-751`).
- Correct behavior (plain English):
- Emit one consolidated user-facing failure toast per failed mutation.
- Minimal repro:
1. In world mode, trigger a known failing save (e.g., DPE in exceptions).
2. Observe duplicate failure toasts.

---

## 6. Minimal Smoke Checklist (Cap Sheet Page Only, <10 min)

### Base mode checks (`worldId = null`)

1. Open `/gm/:teamId`, click **Cap Sheet** tab.
2. Verify summary tiles render (Total Cap Allocations, Cap Space, Luxury Tax Space, 1st/2nd Apron Space).
3. Change year using selector; verify totals and player row cap values update.
4. Toggle Cap Holds; verify count badge and row amounts appear/hide.
5. Edit Dead Money:
- Open **Manage Dead Money**.
- Add one entry for current season with non-zero amount.
- Save.
- Verify Dead Money breakdown row and Total Cap Hit change.

### World mode checks (`worldId` selected)

1. Select a world, stay on **Cap Sheet**.
2. Repeat one dead money edit/save; refresh and confirm value persists.
3. Open **Manage Exceptions**, edit MLE/BAE values, save.
4. Confirm whether Exception Tracker cards reflect those values (expected current behavior: mismatch per P0-1).

### Illegal-state-blocked demonstration (from this page)

1. In world mode, open **Manage Exceptions**.
2. Enter non-zero DPE and save.
3. Expected current behavior:
- Save is blocked by validator (`exceptions_unknown_key`).
- Optimistic preview is rolled back.
- Error toast shown.

---

## 7. Appendix: File List and Key Symbols

### 7.1 Files examined (primary)

- `src/App.jsx`
- `src/pages/GmDashboardView.jsx`
- `src/features/architect/GMDashboard/GMDashboard.jsx`
- `src/features/architect/GMDashboard/sections/CapSheetSection.jsx`
- `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
- `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`
- `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectState.ts`
- `src/features/architect/GMDashboard/components/CapAuditDebugPanel.tsx`
- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/capLegality/postStateCapValidator.ts`
- `src/features/architect/utils/capLegalityValidation.js`
- `src/features/architect/utils/capTotals/computeTeamCapTotals.js`
- `src/features/architect/utils/capHolds.ts`
- `src/features/architect/utils/contractUtils.js`
- `src/features/architect/utils/basicArchitectUtils.js`
- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
- `src/features/architect/utils/architectFirestorePaths.ts`
- `src/features/architect/utils/firebaseTeamPlanHelpers.js`
- `src/constants/collections.ts`

### 7.2 Key symbols traced

- Routing/UI entry: `GMDashboard`, `CapSheetSection`, `CapSheet`, `CapSummaryTiles`, `ExceptionTracker`
- Mutation handlers: `handleSetDeadCap`, `handleSetExceptions`, `handleEditContract`
- Local/world mutation wrapper: `applyCapAuditedTeamMutation`, `persistMutation`
- World pipeline entry: `applyWorldMutation`
- Mutation compute functions: `computeSetDeadCapResult`, `computeSetExceptionsResult`
- Validators: `validatePostStateCapLegality`, `validateDeadCap`, `validateExceptions`
- Totals SSOT: `computeTeamCapTotals`, `canUseRoomException`
- TPE accessor: `getTeamTpeList`

---

## 8. Validation Commands Run / Skipped

### Actually run for this preflight

- `git status --short`
- `rg --files` / `rg -n` targeted code search
- `nl -ba ... | sed -n ...` targeted line-level inspection

### Intentionally skipped

- `npm run build` (skipped: preflight is docs-only, no code changes)
- `npm run typecheck` (skipped: no TS/TSX code changes)
- `npm run test:*` suites (skipped: no runtime behavior changes; preflight discovery only)

### Files changed in this preflight package

- `return_packages/architect/TM_CAP_SHEET_P1_PREFLIGHT_RETURN_PACKAGE.md` (new)
- `docs/architect/CAP_SHEET_MASTER.md` (new)
- `docs/SHIP_GATES_MASTER.md` (docs append)
