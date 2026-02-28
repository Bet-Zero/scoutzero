# CAP_SHEET_E2E_SSOT_PARITY_DEEP_REVIEW_P1 — PREFLIGHT RETURN PACKAGE

**Date:** 2026-02-28  
**Mode:** PREFLIGHT (Discovery-only)  
**Scope:** Cap Sheet SSOT parity across UI surfaces + cap-changing write paths (pipeline vs season advance)  
**STOP Triggered:** YES (SSOT drift risk + direct-write bypass + schema ambiguity)

## 1) Executive Summary

This preflight found a strong SSOT for cap totals (`computeTeamCapTotals()`), used by core Cap Sheet summary UI and recomputes, but end-to-end parity is not complete across all cap surfaces and write paths.

**High-risk gaps confirmed:**

1. **CapSheetFull “Total Cap”** is computed via local `yearTotals` and can drift from SSOT.
2. **Season advance write path** bypasses `applyWorldMutation` (uses a separate validation/persist pipeline).
3. **Data shape ambiguity** (`roster` objects vs ids; `deadCap.amountByYear` object-map vs array) can create compute/persist inconsistencies.

## 2) STOP Report

**Triggered? Yes**

| STOP Condition                                                                       | Status                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Repro Concept                                                                                                                                                                                                                                                     | Risk                                                                                                                                        |
| ------------------------------------------------------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1) **CapSheetFull totals are display-local (SSOT drift risk)**                       | **Triggered**                                | `CapSheetFull` computes local `yearTotals` and renders the “Total Cap” row from that local math instead of reading the SSOT totals object. See `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx` (local `yearTotals` compute block) and the “Total Cap” render row.                                                                                                                                                                                                               | Open **Full Cap Table** and compare “Total Cap” vs the main **Cap Sheet** SSOT totals for the same year, especially with **dead money** and/or **incomplete roster charges** present.                                                                             | **High** — user-facing financial number can be misleading even when SSOT is correct.                                                        |
| 2) **Validator/apply mismatch allowing illegal persist**                             | **Not conclusively triggered**               | `applyWorldMutation` runs validation before persistence (fail-closed) in `src/features/architect/utils/mutationPipeline.js` (apply → validate → persist sequence). UI-time cap checks can differ from apply-time checks, but apply-time still blocks invalid commits.                                                                                                                                                                                                                           | N/A (preflight did not produce a concrete case where a UI-pass/apply-fail state persists).                                                                                                                                                                        | **Medium (residual)** — parity drift can confuse users, but persist layer appears to remain fail-closed.                                    |
| 3) **Direct-write cap mutation path bypasses mutationPipeline validator matrix**     | **Triggered**                                | Season advance is initiated from `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx` and persists via `src/features/architect/utils/seasonManager.js` using Firestore batch writes, rather than routing through `applyWorldMutation` in `src/features/architect/utils/mutationPipeline.js`. It is validated, but by a separate regime (`resolveOffseasonTransition` / offseason validation), not the mutationPipeline validator matrix.                                      | Advance season from the **Offseason** flow and confirm the write path never enters `applyWorldMutation` / `validateMutation`.                                                                                                                                     | **High** — two separate validation/persist pipelines for cap-changing writes increases drift risk and makes “one gate to trust” impossible. |
| 4) **Schema ambiguity can break SSOT compute vs persisted state (roster + deadCap)** | **Triggered**                                | `roster` is hydrated as player objects in `src/features/architect/utils/firebaseTeamPlanHelpers.js`, while mutation logic treats roster as ids in `src/features/architect/utils/mutationPipeline.js`. Separately, `ManageDeadMoneyModal` writes `deadCap.amountByYear` as an object-map in `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx`, while SSOT dead-money compute reads an array-style structure in `src/features/architect/utils/capTotals/computeTeamCapTotals.js`. | (A) Modify roster via a cap mutation (waive/renounce/etc.) and verify the roster representation stays consistent across load → mutate → recompute. (B) Set dead money via the modal and verify SSOT totals + all cap surfaces reflect the same dead-money amount. | **High** — shape mismatch can cause dead money to be ignored/undercounted or roster diffs to apply inconsistently across surfaces.          |
| 5) **Non-atomic multi-write risk**                                                   | **Not triggered for Firestore commit layer** | Both mutation pipeline and season manager use batch commits (`batch.commit`) in `src/features/architect/utils/mutationPipeline.js` and `src/features/architect/utils/seasonManager.js`.                                                                                                                                                                                                                                                                                                         | N/A                                                                                                                                                                                                                                                               | **Low**                                                                                                                                     |

## 3) Cap Sheet UI Map

### Routes and Entry

- Route: [`/gm/:teamId` in App.jsx#L35](/Users/brenthibbitts/Desktop/ScoutZero/src/App.jsx#L35)
- View wrapper: [`GmDashboardView.jsx#L4-L8`](/Users/brenthibbitts/Desktop/ScoutZero/src/pages/GmDashboardView.jsx#L4)

### Component Tree (Cap surfaces)

- Dashboard root: [`GMDashboard.jsx`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/GMDashboard.jsx)
- Tab buttons include:
  - `Cap Sheet` [`GMDashboard.jsx#L210-L219`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/GMDashboard.jsx#L210)
  - `Full Cap Table` [`GMDashboard.jsx#L220-L229`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/GMDashboard.jsx#L220)
- `cap` tab:
  - [`CapSheetSection.jsx#L17-L27`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/sections/CapSheetSection.jsx#L17)
  - `CapSheet`
  - `ExceptionTracker`
- `capfull` tab:
  - [`CapTableSection.jsx#L11-L18`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/sections/CapTableSection.jsx#L11)
  - `CapSheetFull`

### Tabs/Sections as rendered

- Dashboard tabs: `Roster`, `Cap Sheet`, `Full Cap Table`, `Trade Machine`, `Free Agency`, `Offseason`, `Team History` ([`GMDashboard.jsx#L199-L269`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/GMDashboard.jsx#L199))
- Cap Sheet surface sections:
  - Summary tiles
  - Roster cap grid
  - Cap holds expandable block
  - Manage actions (`Manage Exceptions`, `Manage Dead Money`)
  - Cap breakdown rows
  - Total Cap Hit row
  - Exception Tracker cards + TPE list
- Full Cap Table surface sections:
  - Multi-year player grid
  - Total Cap row (year-by-year)
  - Separate cap holds table with renounce action

### Key hooks/selectors/loaders

- State/data: [`useArchitectState.ts`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectState.ts)
- Actions/write handlers: [`useArchitectActions.ts`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts)
- UI-time contract validation: [`useCapValidation.js`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/hooks/useCapValidation.js)
- Team loading fallback chain: [`teamLoader.js`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/teamLoader.js), [`worldTeamData.ts`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/worldTeamData.ts)

## 4) SSOT Compute Dossier

### Canonical SSOT Compute

- Canonical function: [`computeTeamCapTotals()`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capTotals/computeTeamCapTotals.js#L184)
- SSOT declaration in file header: [`computeTeamCapTotals.js#L6-L10`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capTotals/computeTeamCapTotals.js#L6)

### Inputs consumed

- `teamCapSheet.players` (contract slices)
- `teamCapSheet.capHolds` (active unsigned holds)
- Dead money sources: `deadCap`, fallback `waivedContracts/stretchHistory/deadMoney`
- Cap/rule context from `getCapRulesForYear(...)`
- Year context (`selectedYear` / end year)
- Optional `capProjections` override

### Outputs produced

`yearKey`, `playersTotal`, `deadMoneyTotal`, `capHoldsTotal`, `incompleteChargesTotal`, `totalCapAllocations`, `salaryCap`, `luxuryTax`, `firstApron`, `secondApron`, `deltas`, `_meta`  
(see [`computeTeamCapTotals.js#L231-L261`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capTotals/computeTeamCapTotals.js#L231))

### UI and apply-time callsites

- UI:
  - Cap Sheet uses SSOT once via memo: [`CapSheet.jsx#L56-L59`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.jsx#L56)
  - Trade cap impact uses SSOT: [`CapImpactTiles.jsx#L28-L31`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/CapImpactTiles.jsx#L28)
- Apply/compute:
  - Mutation pipeline recomputes on key mutations: [`mutationPipeline.js#L1659`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L1659), [`#L1797`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L1797), [`#L2041`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L2041), [`#L2123`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L2123)
  - Season transition path also recomputes SSOT: [`seasonManager.js#L1035`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/seasonManager.js#L1035), [`resolveOffseasonTransition.ts#L966`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/offseason/resolveOffseasonTransition.ts#L966)

### Duplicate / parallel compute implementations

| Implementation                                 | Classification                           | Evidence                                                                                                                                              | Notes                                     |
| ---------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `computeTeamCapTotals`                         | **Canonical**                            | [`computeTeamCapTotals.js#L184`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capTotals/computeTeamCapTotals.js#L184)          | SSOT                                      |
| `CapSheetFull yearTotals`                      | **Display-only local compute**           | [`CapSheetFull.jsx#L93-L119`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx#L93)               | Excludes full SSOT categories; drift risk |
| `useCapValidation -> calculateTeamCapHitLocal` | **Legacy/UI-validation compute**         | [`useCapValidation.js#L141-L143`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/hooks/useCapValidation.js#L141)                       | UI hinting path, not apply-time gate      |
| `ExceptionTracker local availability math`     | **Display/business-logic parallel path** | [`ExceptionTracker.jsx#L141-L205`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx#L141) | Uses top-level fields + local logic       |

## 5) UI Parity Matrix

| Displayed field label                    | Data source                                                                                                                                                                                                                               | Upstream SSOT field                          | Local math?            | Parity verdict                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| `TOTAL CAP ALLOCATIONS`                  | [`CapSummaryTiles.jsx#L50-L53`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx#L50)                                                                                                  | `totals.totalCapAllocations`                 | No                     | **Wired**                                                             |
| `CAP SPACE`                              | [`CapSummaryTiles.jsx#L57-L64`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx#L57)                                                                                                  | `-totals.deltas.vsCap`                       | Yes (simple transform) | **Wired**                                                             |
| `LUXURY TAX SPACE`                       | [`CapSummaryTiles.jsx#L67-L75`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx#L67)                                                                                                  | `-totals.deltas.vsLuxuryTax`                 | Yes                    | **Wired**                                                             |
| `1ST APRON SPACE`                        | [`CapSummaryTiles.jsx#L79-L86`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx#L79)                                                                                                  | `-totals.deltas.vsFirstApron`                | Yes                    | **Wired**                                                             |
| `2ND APRON SPACE`                        | [`CapSummaryTiles.jsx#L106-L113`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx#L106)                                                                                               | `-totals.deltas.vsSecondApron`               | Yes                    | **Wired**                                                             |
| `Player Salaries`                        | [`CapSheet.jsx#L410-L413`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.jsx#L410)                                                                                                             | `totals.playersTotal`                        | No                     | **Wired**                                                             |
| `Dead Money`                             | [`CapSheet.jsx#L416-L420`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.jsx#L416)                                                                                                             | `totals.deadMoneyTotal`                      | No                     | **Wired**                                                             |
| `Cap Holds` (breakdown row)              | [`CapSheet.jsx#L424-L428`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.jsx#L424)                                                                                                             | `totals.capHoldsTotal`                       | No                     | **Wired**                                                             |
| `Incomplete Roster Charge`               | [`CapSheet.jsx#L431-L450`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.jsx#L431)                                                                                                             | `totals.incompleteChargesTotal` + `_meta`    | No                     | **Wired**                                                             |
| `Total Cap Hit`                          | [`CapSheet.jsx#L456-L462`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.jsx#L456)                                                                                                             | `totals.totalCapAllocations`                 | No                     | **Wired**                                                             |
| `Cap Hit` per player row                 | [`CapSheet.jsx#L82-L93`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.jsx#L82)                                                                                                                | Contract slice, not totals object            | Yes                    | **Drift risk** (row math can diverge from aggregate assumptions)      |
| `Cap %` per player row                   | [`CapSheet.jsx#L77`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.jsx#L77), [`#L288-L289`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheet/CapSheet.jsx#L288) | Uses local `salaryCap` from projections      | Yes                    | **Drift risk**                                                        |
| `Future Cap Sheet > Total Cap`           | [`CapSheetFull.jsx#L343-L353`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx#L343)                                                                                                 | None (local `yearTotals`)                    | **Yes**                | **Drift risk (STOP)**                                                 |
| `ExceptionTracker NT-MLE/TP-MLE/BAE/DPE` | [`ExceptionTracker.jsx#L220-L247`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx#L220)                                                                                     | Top-level `mle/tpMle/bae/dpe` + cap settings | Yes                    | **Drift risk** (not consistently reading canonical `team.exceptions`) |
| `ExceptionTracker Trade Exceptions`      | [`ExceptionTracker.jsx#L129`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx#L129)                                                                                          | `getTeamTpeList` canonical/fallback reader   | No                     | **Wired**                                                             |

## 6) Cap Write-Path Ledger

### Write-path list

1. `signFreeAgent`
2. `signAndTrade`
3. `waivePlayer` (incl. stretch/buyout path)
4. `extendPlayer`
5. `optionDecision`
6. `renounceRights`
7. `setDeadCap`
8. `setExceptions`
9. `executeTrade` (cap state side effects)
10. `advanceSeasonInWorld` (offseason wizard path)

### Ledger table

| Action                 | Entry point                                                                                                                                            | Mutation routing                                                                                                                                                                 | Validation gate                                                                                                                                                                                                | Fail-closed behavior                                                     | Atomicity                        | Verdict                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------- | ----------------------------- |
| `signFreeAgent`        | [`useArchitectActions.ts#L880-L941`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L880)      | `runAuthoritativeFAMutation -> applyWorldMutation` [`#L549-L600`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L549)   | `validateMutation(signFreeAgent)` [`mutationPipeline.js#L2277`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L2277)                                                 | Blocks persist on violations                                             | Batch commit                     | **Wired**                     |
| `signAndTrade`         | [`useArchitectActions.ts#L1045-L1119`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L1045)   | Authoritative pipeline                                                                                                                                                           | Prevalidated signing + trade context, then validate/persist                                                                                                                                                    | Blocks persist                                                           | Batch commit                     | **Wired**                     |
| `waivePlayer`          | [`useArchitectActions.ts#L1684-L1774`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L1684)   | **Optimistic local state first** + `persistMutation` [`#L465-L505`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L465) | Pipeline validates on save                                                                                                                                                                                     | Persist blocked if invalid, but local optimistic state not rolled back   | Batch commit for persisted write | **Drift risk**                |
| `extendPlayer`         | [`useArchitectActions.ts#L1604-L1679`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L1604)   | Optimistic + `persistMutation`                                                                                                                                                   | Pipeline validates on save                                                                                                                                                                                     | Same rollback gap                                                        | Batch commit                     | **Drift risk**                |
| `optionDecision`       | [`useArchitectActions.ts#L1785-L1943`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L1785)   | Optimistic + `persistMutation`                                                                                                                                                   | Pipeline validates on save                                                                                                                                                                                     | Same rollback gap                                                        | Batch commit                     | **Drift risk**                |
| `renounceRights`       | [`useArchitectActions.ts#L1407-L1490`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L1407)   | Optimistic + `persistMutation`                                                                                                                                                   | Pipeline validates on save                                                                                                                                                                                     | Same rollback gap                                                        | Batch commit                     | **Drift risk**                |
| `setDeadCap`           | [`useArchitectActions.ts#L1352-L1367`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L1352)   | Optimistic + `persistMutation`                                                                                                                                                   | `validateDeadCap` [`mutationPipeline.js#L2257-L2264`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L2257)                                                           | Blocks persist when invalid; no local rollback                           | Batch commit                     | **Drift risk**                |
| `setExceptions`        | [`useArchitectActions.ts#L1372-L1387`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L1372)   | Optimistic + `persistMutation`                                                                                                                                                   | `validateExceptions` [`mutationPipeline.js#L2267-L2274`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L2267)                                                        | Blocks persist when invalid; no local rollback                           | Batch commit                     | **Drift risk**                |
| `executeTrade`         | [`useArchitectActions.ts#L614-L727`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L614)      | Authoritative pipeline                                                                                                                                                           | Trade context validation in pipeline                                                                                                                                                                           | Fail-closed                                                              | Batch commit                     | **Wired**                     |
| `advanceSeasonInWorld` | [`SeasonAdvanceModal.jsx#L351-L377`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx#L351) | **Direct `seasonManager` write path** [`seasonManager.js#L543-L772`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/seasonManager.js#L543)                  | `resolveOffseasonTransition + validateOffseasonState` [`resolveOffseasonTransition.ts#L973`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/offseason/resolveOffseasonTransition.ts#L973) | Fail-closed in that path, but bypasses mutationPipeline validator matrix | Batch commit                     | **STOP: direct-write bypass** |

## 7) Validator ↔ Apply ↔ Persist Parity

### Observed flow

1. UI hints: `EditContractModal` uses `useCapValidation` ([`EditContractModal.jsx#L309-L317`](/Users/brenthibbitts/Desktop/ScoutZero/src/shared/components/EditContractModal.jsx#L309), [`useCapValidation.js#L156`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/hooks/useCapValidation.js#L156)).
2. Apply path: `applyWorldMutation` runs compute, then `validateMutation`, then persist ([`mutationPipeline.js#L450-L681`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L450)).
3. Persist path: single batch commit in `persistWorldMutation` ([`mutationPipeline.js#L2501-L2646`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L2501)).
4. Persistence-contract enforcement is environment-gated, test-on/prod-off ([`enforcement.js#L37-L71`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/persistenceContracts/enforcement.js#L37), [`#L88-L92`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/persistenceContracts/enforcement.js#L88)).

### Parity verdicts

- **Apply-time validator parity (pipeline mutations):** Mostly strong; unknown mutation types fail closed ([`mutationPipeline.js#L2458-L2476`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L2458)).
- **UI-vs-apply parity:** Not strict. UI validator (`useCapValidation`) uses different computation path (`calculateTeamCapHitLocal`) and can disagree with pipeline apply validator.
- **Persist parity:** Strong atomic commit, but persistence contracts are not enforced in production by default.
- **STOP check:** **FAIL** due direct-write bypass (`advanceSeasonInWorld`) and structural shape ambiguity risks.

## 8) Data Model SSOT Risks

| Risk                                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why this is SSOT risk                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `roster` shape ambiguity (IDs vs objects)             | Base hydration returns `roster: players` in [`firebaseTeamPlanHelpers.js#L160-L162`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/firebaseTeamPlanHelpers.js#L160); mutations remove by ID in [`mutationPipeline.js#L1733-L1736`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L1733)                                                                                                                                                                                                                     | Read/compute and write paths may target different roster representations                |
| Snapshot pass-through without normalization           | [`teamLoader.js#L99-L103`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/teamLoader.js#L99) returns snapshot as-is when `players` exists                                                                                                                                                                                                                                                                                                                                                                                                              | Mixed snapshot shapes can persist across world chain                                    |
| `deadCap.amountByYear` object vs array mismatch       | Modal writes object-map in [`ManageDeadMoneyModal.jsx#L98-L100`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx#L98); SSOT dead-money path expects array item matching `season` in [`computeTeamCapTotals.js#L94-L103`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capTotals/computeTeamCapTotals.js#L94); deep contract expects array item keys in [`contracts.js#L184-L188`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/persistenceContracts/contracts.js#L184) | Persisted dead-cap can pass one layer but be ignored/misread by SSOT dead-money compute |
| Exceptions key mismatch (`dpe`)                       | Modal supports `dpe` in [`ManageExceptionsModal.jsx#L22-L30`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/modals/ManageExceptionsModal.jsx#L22); validator allowlist excludes it [`capLegalityValidation.js#L946-L995`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capLegalityValidation.js#L946); tracker reads top-level `dpe` [`ExceptionTracker.jsx#L122-L127`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx#L122)                                  | UI, validator, and persisted shape are not aligned on DPE semantics                     |
| Local-first action shape diverges from pipeline shape | Waive local marks waived but retains player in local array ([`useArchitectActions.ts#L1714-L1738`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L1714)); pipeline removes player/roster entry ([`mutationPipeline.js#L1733-L1741`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L1733) )                                                                                                                                                                               | Temporary UI/persist divergence during failures/retries                                 |
| `totals` recompute inconsistency for manual mutations | `computeSetDeadCapResult` and `computeSetExceptionsResult` do not recompute `team.totals` ([`mutationPipeline.js#L3444-L3477`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L3444), [`#L2145-L2190`](/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/mutationPipeline.js#L2145))                                                                                                                                                                                                                             | Stored overlay can carry stale `totals` relative to current cap-affecting fields        |

## 9) Validation Outputs

### Commands run

1. `npm run test:node -- --reporter=dot src/tests/architect/cap_legality_validation.test.js src/tests/architect/mutationPipeline.setDeadCap.test.js src/tests/architect/mutationPipeline.setExceptions.test.js src/tests/architect/mutationPipeline.optionDecision.test.js src/tests/architect/mutationPipeline.waivePlayer.test.js src/tests/architect/mutationPipeline.renounceRights.test.js`
2. `npm run test:ui -- --reporter=dot src/tests/architect/CapSheet.row11.incompleteCharge.ui.test.tsx src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js src/tests/architect/ExceptionTracker.phase65.tpe-read-canonical.test.js src/tests/architect/EditContractModal.phase75.room-exception-eligibility.test.jsx`
3. `npm run test:node -- --reporter=dot tests/architect/capLegalityValidation.test.js tests/architect/renounceRights.test.js src/tests/architect/deadCapManagement.test.js src/tests/architect/capTotals/deadMoney.test.js src/tests/architect/capTotals/incompleteRosterCharge.test.js src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`
4. `npm run test:ui -- --reporter=dot tests/architect/CapSheetFull.rules.test.jsx tests/architect/EditContractModal.rules.test.jsx tests/architect/ExceptionTracker.tpe.test.jsx`

### Results summary

- Command 1: **Failed** (`No test files found`)
- Command 2: **Failed** (`No test files found`)
- Command 3: **Passed** (7 files, 298 tests)
- Command 4: **Passed** (3 files, 17 tests)

## 10) Proposed Master Doc Deltas

1. In `docs/architect/CAP_SHEET_MASTER_DOC.md`, add a “Preflight Findings (P1)” section documenting that Full Cap Table `Total Cap` is currently display-local and may drift from canonical SSOT totals.
2. In `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`, update handler inventory language to distinguish:
   - authoritative `runAuthoritativeFAMutation` paths
   - optimistic local-first `persistMutation` paths (with no automatic rollback on persist failure).
3. In `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`, add an explicit schema-consistency note:
   - `deadCap.amountByYear` canonical shape used by SSOT compute and persistence deep rules
   - current manual modal emitted shape and resulting parity risk.
4. In `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`, add an Exceptions consistency note for `dpe` key parity across modal, validator allowlist, tracker display model, and persisted schema.
5. In `docs/SHIP_GATES_MASTER.md`, add a manual smoke gate class for “Cap SSOT parity checks” only if treated as ship-blocking:
   - compare Cap Sheet vs Full Cap Table totals under dead money + incomplete roster charges
   - verify failed save does not leave user-facing cap state inconsistent with persisted world.

---

1. Doc diffs made (paths + brief summary)

- No doc files were modified in this preflight run.

---

1. Exact commands run + summarized results

### Discovery commands

1. `rg --files src/features/architect | rg 'CapSheet|ExceptionTracker|capTotals|capLegalityValidation|mutationPipeline|useCapValidation|useArchitectActions|GMDashboard|SeasonAdvanceModal|seasonManager|teamLoader|firebaseTeamPlanHelpers|ManageDeadMoneyModal|ManageExceptionsModal|EditContractModal'`

- Result: located all relevant cap-sheet, compute, validation, mutation, and modal files.

1. `nl -ba src/features/architect/capSheet/CapSheet/CapSheet.jsx | sed -n '1,260p'`
2. `nl -ba src/features/architect/capSheet/CapSheet/CapSheet.jsx | sed -n '260,620p'`
3. `nl -ba src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx | sed -n '1,240p'`
4. `nl -ba src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx | sed -n '1,420p'`
5. `nl -ba src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx | sed -n '392,470p'`
6. `nl -ba src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx | sed -n '1,320p'`
7. `nl -ba src/features/architect/GMDashboard/GMDashboard.jsx | sed -n '1,360p'`
8. `nl -ba src/features/architect/GMDashboard/sections/CapSheetSection.jsx | sed -n '1,220p'`
9. `nl -ba src/features/architect/GMDashboard/sections/CapTableSection.jsx | sed -n '1,220p'`
10. `nl -ba src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx | sed -n '300,460p'`
11. `nl -ba src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx | sed -n '332,410p'`

- Result: confirmed UI map, tabs, data flow, and season-advance entry bypass path.

1. `nl -ba src/features/architect/utils/capTotals/computeTeamCapTotals.js | sed -n '1,340p'`
2. `nl -ba src/features/architect/utils/capTotals/index.js | sed -n '1,220p'`
3. `rg -n "computeTeamCapTotals\(|canUseRoomException\(|calculateTeamCapHit\(|totalCapAllocations|yearTotals\[" src/features/architect src/shared/components | sed -n '1,400p'`

- Result: identified canonical SSOT and duplicate/parallel compute paths.

1. `nl -ba src/features/architect/utils/capLegalityValidation.js | sed -n '1,340p'`
2. `nl -ba src/features/architect/utils/capLegalityValidation.js | sed -n '840,1060p'`
3. `nl -ba src/features/architect/utils/capLegalityValidation.js | sed -n '2300,2920p'`
4. `rg -n "export function validate(Mutation|Signing|Waive|OptionDecision|RenounceRights|DeadCap|Exceptions)|function validate(Mutation|Signing|Waive|OptionDecision|RenounceRights|DeadCap|Exceptions)|case '" src/features/architect/utils/capLegalityValidation.js | sed -n '1,260p'`

- Result: mapped validator rules and exception/dead-cap schema checks.

1. `nl -ba src/features/architect/utils/mutationPipeline.js | sed -n '1,760p'`
2. `nl -ba src/features/architect/utils/mutationPipeline.js | sed -n '760,1760p'`
3. `nl -ba src/features/architect/utils/mutationPipeline.js | sed -n '1760,2760p'`
4. `nl -ba src/features/architect/utils/mutationPipeline.js | sed -n '3408,3508p'`
5. `rg -n "computeSetDeadCapResult|validateMutation\(|persistWorldMutation\(|setDeadCap|setExceptions|validateDeadCap|validateExceptions|updatedTeam\.totals = computeTeamCapTotals|batch\.commit|applyWorldMutation|Unknown mutation type" src/features/architect/utils/mutationPipeline.js`

- Result: mapped apply/validate/persist pipeline and mutation-specific behavior.

1. `nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '1,720p'`
2. `nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '720,1560p'`
3. `nl -ba src/features/architect/GMDashboard/hooks/useArchitectActions.ts | sed -n '1560,2140p'`
4. `rg -n "applyWorldMutation\(|advanceSeasonInWorld\(|persistMutation\(|runAuthoritativeFAMutation\(" src/features/architect src/shared/components | sed -n '1,400p'`

- Result: complete cap write-path inventory and optimistic-vs-authoritative split.

1. `nl -ba src/features/architect/GMDashboard/hooks/useArchitectState.ts | sed -n '1,420p'`
2. `nl -ba src/features/architect/utils/teamLoader.js | sed -n '1,240p'`
3. `nl -ba src/features/architect/utils/firebaseTeamPlanHelpers.js | sed -n '120,220p'`
4. `nl -ba src/features/architect/utils/worldTeamData.ts | sed -n '1,320p'`

- Result: confirmed roster/player shape and loader normalization risks.

1. `nl -ba src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx | sed -n '1,260p'`
2. `nl -ba src/features/architect/capSheet/modals/ManageExceptionsModal.jsx | sed -n '1,260p'`
3. `nl -ba src/shared/components/EditContractModal.jsx | sed -n '250,430p'`
4. `nl -ba src/features/architect/hooks/useCapValidation.js | sed -n '1,420p'`

- Result: confirmed UI validator parity gaps and modal schema mismatches.

1. `rg -n "export async function advanceSeasonInWorld|writeBatch|batch\.set\(|batch\.update\(|batch\.commit\(|validate|computeTeamCapTotals|optionDecisions|deadCap|exceptions" src/features/architect/utils/seasonManager.js | sed -n '1,320p'`
2. `nl -ba src/features/architect/utils/seasonManager.js | sed -n '500,860p'`
3. `nl -ba src/features/architect/utils/seasonManager.js | sed -n '860,1140p'`
4. `nl -ba src/features/architect/utils/offseason/resolveOffseasonTransition.ts | sed -n '1,220p'`
5. `nl -ba src/features/architect/utils/offseason/resolveOffseasonTransition.ts | sed -n '860,1120p'`
6. `rg -n "validate|violation|fail|blocked|computeTeamCapTotals|nextTeamCapSheet|options|decision" src/features/architect/utils/offseason/resolveOffseasonTransition.ts | sed -n '1,260p'`

- Result: confirmed season-advance validation/persistence is separate from mutationPipeline.

1. `nl -ba docs/architect/CAP_SHEET_MASTER_DOC.md | sed -n '1,280p'`
2. `nl -ba docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md | sed -n '1,360p'`
3. `nl -ba docs/SHIP_GATES_MASTER.md | sed -n '1,260p'`
4. `rg -n "handleWaiveContract|handleExtendContract|handleOptionDecision|handleRenounceRights|Calls Pipeline|Uses Pipeline\?|session-only|local state|optimistic|setDeadCap|setExceptions|validateExceptions|dpe|mle, tpmle, bae, room" docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md | sed -n '1,260p'`
5. `nl -ba docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md | sed -n '120,220p'`

- Result: identified doc drift vs current code behavior.

1. `rg --files tests src/tests | rg -i 'cap|exception|deadCap|offseason|optionDecision|renounce|capTotals|capLegality|CapSheet|EditContractModal|seasonManager' | sed -n '1,260p'`

- Result: identified targeted cap-related test files.

1. `nl -ba src/App.jsx | sed -n '1,120p'`
2. `nl -ba src/pages/GmDashboardView.jsx | sed -n '1,120p'`
3. `nl -ba src/features/architect/GMDashboard/sections/OffseasonSection.jsx | sed -n '1,220p'`
4. `git status --short`

- Result: confirmed route map and clean worktree.

### Validation commands

1. `npm run test:node -- --reporter=dot src/tests/architect/cap_legality_validation.test.js src/tests/architect/mutationPipeline.setDeadCap.test.js src/tests/architect/mutationPipeline.setExceptions.test.js src/tests/architect/mutationPipeline.optionDecision.test.js src/tests/architect/mutationPipeline.waivePlayer.test.js src/tests/architect/mutationPipeline.renounceRights.test.js`

- Result: `No test files found` (exit 1)

1. `npm run test:ui -- --reporter=dot src/tests/architect/CapSheet.row11.incompleteCharge.ui.test.tsx src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js src/tests/architect/ExceptionTracker.phase65.tpe-read-canonical.test.js src/tests/architect/EditContractModal.phase75.room-exception-eligibility.test.jsx`

- Result: `No test files found` (exit 1)

1. `npm run test:node -- --reporter=dot tests/architect/capLegalityValidation.test.js tests/architect/renounceRights.test.js src/tests/architect/deadCapManagement.test.js src/tests/architect/capTotals/deadMoney.test.js src/tests/architect/capTotals/incompleteRosterCharge.test.js src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`

- Result: 7 files passed, 298 tests passed

1. `npm run test:ui -- --reporter=dot tests/architect/CapSheetFull.rules.test.jsx tests/architect/EditContractModal.rules.test.jsx tests/architect/ExceptionTracker.tpe.test.jsx`

- Result: 3 files passed, 17 tests passed
