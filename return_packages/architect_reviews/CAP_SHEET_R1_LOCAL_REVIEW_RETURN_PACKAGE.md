# CAP_SHEET_R1_LOCAL — REVIEW RETURN PACKAGE
**Date:** 2026-03-01
**Status:** FAIL (9 PASS / 2 FAIL / 1 BLOCKED)

## Executive Summary
- Pass count: 9
- Fail count: 2
- Blocked count: 1
- Top critical failures:
1. Checklist #6 `FAIL`: cap-sheet transaction flows were mapped, but not all were runtime-executed end-to-end (state delta + totals delta + persistence destination + gates) in this review pass.
2. Checklist #12 `FAIL`: missing deterministic integration coverage for cap-sheet transaction matrix and world-toggle cap-sheet boundary flow.
3. Checklist #4 `BLOCKED`: emulator walkthrough did not expose a clearly verifiable `futureContract` fixture for required “2 players including extension/futureContract” runtime proof.

## A) Scope Inventory
### UI surfaces (Cap Sheet section)
| Surface | How to reach | Observed behavior | Evidence |
|---|---|---|---|
| Architect route shell | `/gm/lakers?season=2026` | GM Dashboard renders team shell and tab bar | Harness body snapshot included `Roster`, `Cap Sheet`, `Full Cap Table`, `Trade Machine`, `Free Agency`, `Offseason`, `Team History` |
| Cap Sheet tab (`cap`) | Click `Cap Sheet` tab | Cap Sheet header, year chips, summary tiles, roster cap table render | Runtime JSON: header `Cap Sheet \| 2025-26`, totals populated |
| Cap Sheet year selector (local to cap tab) | Cap Sheet tab -> year chips | Switching to `2031-32` changes displayed totals | Runtime JSON: `TOTAL CAP ALLOCATIONS $0`, `CAP SPACE $266,494,000` |
| Summary tiles | Cap Sheet tab top tiles | Team totals/apron-space/hard-cap status display | Runtime JSON values for all five tiles + hard-cap text |
| Manage Exceptions modal | Cap Sheet -> `Manage Exceptions` | Modal opens and shows exception controls | Modal signal evidence: `Exception Management:`, `MLE`, `TPMLE`, `BAE`, `ROOM`, save control |
| Manage Dead Money modal | Cap Sheet -> `Manage Dead Money` | Modal opens and exposes manual dead-cap editor | Modal signal evidence: `Manual Override Mode:`, `Add Entry`, save control |
| Player contract modal | Cap Sheet -> click `LeBron James` row | Edit actions are exposed | Runtime JSON: `Extend Contract`, `Waive Player`, `Waive & Stretch`, `Buyout Contract` |
| ExceptionTracker panel | Bottom of Cap Sheet section | Hard-cap card, exception cards, TPE list render | UI body snapshot showed NT-MLE/TP-MLE/BAE/ROOM and trade exception rows |
| Full Cap Table tab (`capfull`) | Click `Full Cap Table` | Multi-year cap sheet opens | Runtime JSON: `opened: true` for Future Cap Sheet |
| Cap Holds subpanel | Full Cap Table -> `Cap Holds` toggle | Expand shows cap-hold rows and `Absolve` action | Runtime JSON: `absolve: true` |
| Rights modal (`RFA`) | Full Cap Table -> click visible `RFA` tag | Rights action modal opens | Runtime JSON: `Re-sign Player`, `Sign & Trade`, `Renounce Rights` all true |
| World selector & create modal | Header -> `+ New` | Create-world modal opens and world can activate | Runtime JSON: `modal: true`, `worldValue: world_1772397272142_1y2ejy3bp`, Cap Audit Debug shows active world |
| Global season selector | Header season dropdown | Season context control present and wired | Route body snapshots include season dropdown options |

### Data surfaces (reads + writes)
| Surface | Type | Source / destination | Function-level pointer(s) |
|---|---|---|---|
| Team snapshot read (base/world) | Read | Base: `architect_baseTeams/{teamCode}`; World: `architect_worlds/{worldId}/teams/{teamCode}` with parent fallback | `getTeam` in `src/features/architect/utils/teamLoader.js:34-71`; `loadWorldTeamData` in `src/features/architect/utils/worldTeamData.ts:81-105` |
| World metadata read | Read | `architect_worlds/{worldId}` | `getWorldMetadata` in `src/features/architect/utils/worldManager.js:135-149` |
| World selector list read | Read | Query `architect_worlds` by `createdBy` | `listUserWorlds` in `src/features/architect/utils/worldManager.js:161-243` |
| Cap totals SSOT | Compute/read | In-memory team state + cap rules | `computeTeamCapTotals` in `src/features/architect/utils/capTotals/computeTeamCapTotals.js:204-282`; consumed by `CapSheet.jsx:54-58`, `CapSheetFull.jsx:94-104` |
| Cap rules SSOT | Compute/read | Cap settings + CBA constants | `getCapRulesForYear` in `src/features/architect/utils/capRulesProfile/capRulesProfile.ts:88-245`; `getCapSettingsForYear` in `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js:270-282` |
| Contract row resolution | Compute/read | `player.contract` + `player.futureContract` | `getContractYearsForDisplay` / `getContractYearSlice` in `src/features/architect/utils/contractUtils.js:94-175` |
| Exception tracker read | Read | Canonical `team.exceptions.*` (with legacy fallback) + TPE list | `normalizeExceptionForTracker` in `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx:12-50`; `getTeamTpeList` usage at `:4,172` |
| Cap action entry points | Write intent | Local optimistic mutation; world persistence when world selected | `handleSetDeadCap` `:1896-1917`, `handleSetExceptions` `:1920-1942`, `handleCapSheetAction` `:2060-2092`, contract actions `:2170-2590` in `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` |
| World mutation gateway | Write | `architect_worlds/{worldId}/...` only | `applyWorldMutation` in `src/features/architect/utils/mutationPipeline.js:632-939` |
| Firestore persistence sink | Write | `architect_worlds/{worldId}/teams/{teamCode}`, `/teams/{teamCode}/players/{playerId}`, `/entitlements/{entitlementId}`, `/events/{eventId}`, world metadata patch | `persistWorldMutation` in `src/features/architect/utils/mutationPipeline.js:2823-3013` |
| World creation write | Write | `architect_worlds/{worldId}` metadata doc + parent child linkage | `createWorld` in `src/features/architect/utils/worldManager.js:65-126` |
| Local storage: active world | Local | `architect.activeWorldId.{userId}` | `WorldSelector.jsx:30-31,109-143` |
| Local storage: season | Local | `hz.currentSeasonEndYear` | `useArchitectState.ts:218,322-327,447-453` |
| Local storage: cap audit events | Local | `architect_base_capAuditEvents_v1`, `architect_world_preview_capAuditEvents_v1` | `localCapAuditLog.ts:37-40,123-181`; used by cap-audited mutation flow `useArchitectActions.ts:939-943,972-1007` |
| sessionStorage usage | Local | None found in Architect/Cap Sheet surfaces | `rg sessionStorage` scan result: `NO_SESSIONSTORAGE_MATCHES` |

## B) PASS/FAIL Checklist (1–12)
### 1) UI Wiring (No dead UI)
- Status: `PASS`
- Evidence:
1. Cap tab and Full Cap Table tab are clickable and stateful (`GMDashboard.jsx:211-230`, `:282-302`).
2. `Manage Exceptions` click opens modal with modal-only helper text (`Exception Management:`).
3. `Manage Dead Money` click opens modal with modal-only helper text (`Manual Override Mode:`).
4. Player row click opens contract action modal with 4 concrete actions.
5. Full Cap Table Cap Holds toggle reveals `Absolve`.
6. `RFA` tag click opens rights modal actions (`Re-sign Player`, `Sign & Trade`, `Renounce Rights`).

### 2) Team Cap Totals Are Real and Consistent
- Status: `PASS`
- Evidence:
1. Runtime (LAL, 2025-26): `TOTAL CAP ALLOCATIONS $196,602,089`, `CAP SPACE -$41,955,089`, `LUXURY TAX SPACE -$8,707,089`, `1ST APRON SPACE -$657,089`, `2ND APRON SPACE $11,221,911`.
2. Cap Sheet computes totals once via SSOT and passes them down (`CapSheet.jsx:54-58`, `:252-256`).
3. Display rows and total cap hit read from `totals` object (`CapSheet.jsx:403-457`).
4. Season switch to `2031-32` changed totals to `TOTAL CAP ALLOCATIONS $0` and `CAP SPACE $266,494,000`, proving selector drives displayed computation.
5. Dead money and incomplete roster charge are part of SSOT (`computeTeamCapTotals.js:82-167`, `:229-242`).

### 3) Cap Rules and Thresholds Are Connected
- Status: `PASS`
- Evidence:
1. Cap thresholds are sourced via `getCapRulesForYear` facade (`capRulesProfile.ts:88-245`) and `getCapSettingsForYear` provider (`capSettingsProvider.js:270-282`).
2. SSOT totals include cap/tax/aprons and deltas (`computeTeamCapTotals.js:211-249`).
3. UI hard-cap messaging shown at runtime and linked to hard-cap utilities (`hardCapUtils.js:83-173`) and exception/hard-cap validation (`capLegalityValidation.js:2016-2182`).

### 4) Contract Data Wiring (Player -> Contract -> Cap Totals)
- Status: `BLOCKED`
- Evidence:
1. Code path is wired: `getContractYearsForDisplay` merges `contract` + `futureContract` (`contractUtils.js:94-125`), `getContractYearSlice` consumed by Cap Sheet + Full table (`CapSheet.jsx:161-169`, `CapSheetFull.jsx:165-187`).
2. Runtime proof for visible contract actions exists (LeBron modal actions and PO note), but this dataset walkthrough did not expose a clearly attributable `futureContract.salariesByYear` row as distinct from extension-eligibility labeling.
3. Required blocker data: at least one player in emulator snapshot with explicit persisted `futureContract.salariesByYear` to verify end-to-end flow in runtime UI.

### 5) Exceptions and Tools
- Status: `PASS`
- Evidence:
1. Exceptions modal is wired and editable for `mle`, `tpmle`, `bae`, `room` (`ManageExceptionsModal.jsx:22`, `:151-193`, `:367-390`).
2. Dead money modal is wired and editable (`ManageDeadMoneyModal.jsx:69-141`, `:236-268`).
3. Exception tracker renders canonical exception values and TPE list (`ExceptionTracker.jsx:12-50`, `:170-313`).
4. Enforcement path exists in validator: exception eligibility blocks by apron/hard-cap and room-under-cap rule (`capLegalityValidation.js:2029-2182`).
5. Related test coverage included in passing architect suite (e.g., `src/tests/architect/capLegality/exceptionBlocking.test.js`, `src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js`).

### 6) Transactions / Mutations
- Status: `FAIL`
- Evidence:
1. Action surfaces are present: Cap Sheet modal (`Extend`, `Waive`, `Waive & Stretch`, `Buyout`), Full table rights (`Re-sign`, `Sign & Trade`, `Renounce`), Cap Holds `Absolve`.
2. Mutation pipeline/gates are strongly mapped: optimistic lock + post-state validator + world persistence (`useArchitectActions.ts:861-1045`; `mutationPipeline.js:632-939`, `:2489-2554`, `:2823-3013`).
3. Failure reason: this review pass did not execute every available mutation path to completion with runtime proof of all three required properties for each path: state delta, totals delta, and confirmed destination+gate behavior.

### 7) Base vs World Mode Boundary
- Status: `PASS`
- Evidence:
1. Runtime world activation evidence: after create-world flow, selector value switched to `world_1772397272142_1y2ejy3bp`; debug panel showed `World: world_1772397272142_1y2ejy3bp | Base events: 0 | Preview events: 0`.
2. Read boundary code uses world snapshot -> parent world -> base fallback (`teamLoader.js:34-71`; `worldTeamData.ts:81-105`).
3. Base-mode persistence short-circuits without Firestore writes (`useArchitectActions.ts:697-707`, `:958-964`).
4. Guardrail coverage passed in architect suite: `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts`, `src/tests/architect/baseMode_no_firestore_writes.guardrail.test.ts`.

### 8) Write Paths & Safety Gates (Map All)
- Status: `PASS`
- Evidence:
1. Cap-sheet write entry points mapped:
   - `setDeadCap`, `setExceptions`, `renounceRights`, `extendPlayer`, `waivePlayer`, `optionDecision` in `useArchitectActions.ts:1896-2590`.
2. Gate stack mapped:
   - optimistic lock (`:881-900`)
   - preview post-state cap validation (`:925-954`)
   - world-only persist branch (`:958-1040`).
3. Authoritative world mutation gate stack mapped:
   - input checks (`mutationPipeline.js:642-656`)
   - validation/invariants/post-state cap validator (`:710-858`)
   - single persistence sink (`:2823-3013`).
4. Destinations mapped:
   - world teams, world player overrides, world entitlements, world events, world metadata patch (`mutationPipeline.js:2835-2997`).
5. Plan-save path status:
   - legacy `teamPlans` paths are removed (commented cleanup notes in `mutationPipeline.js:8`, `firebaseTeamPlanHelpers.js:7`).
6. Local overlays mapped:
   - season/world selector/cap-audit localStorage keys.

### 9) Forbidden Writes Rule (No `/teams/` root writes)
- Status: `PASS`
- Evidence:
1. Search command:  
   `rg -n "doc\\(db,\\s*['\\\"]teams['\\\"]|collection\\(db,\\s*['\\\"]teams['\\\"]|setDoc\\([^\\n]*['\\\"]teams['\\\"]|updateDoc\\([^\\n]*['\\\"]teams['\\\"]|addDoc\\([^\\n]*['\\\"]teams['\\\"]|deleteDoc\\([^\\n]*['\\\"]teams['\\\"]" src/features/architect src/firebase src/data src/constants`
2. Result: `NO_ROOT_TEAMS_WRITE_MATCHES`.

### 10) Error Handling / Edge Cases
- Status: `PASS`
- Evidence:
1. Empty/missing salary/roster edge: incomplete roster charge logic in SSOT (`computeTeamCapTotals.js:229-238`) with dedicated tests (`src/tests/architect/capTotals/incompleteRosterCharge.test.js`).
2. Illegal action blocked: exception/apron/hard-cap blocks in `validateExceptionEligibility` (`capLegalityValidation.js:2029-2182`) with tests (`src/tests/architect/capLegality/exceptionBlocking.test.js`).
3. Failed persist/rollback and user-facing error behavior: cap-sheet toast dedupe and optimistic rollback paths (`useArchitectActions.ts:984-1017`) with test evidence from `src/tests/architect/capSheet_toast_dedupe.behavior.test.ts` and lock/validator behavior tests in architect suite output.

### 11) Performance Footguns
- Status: `PASS` (no critical footgun found)
- Evidence:
1. Cap Sheet totals are memoized once per `teamCapSheet/selectedYear` (`CapSheet.jsx:54-58`).
2. Full Cap Table yearly totals are memoized (`CapSheetFull.jsx:97-104`).
3. No duplicate subscription/listener loop found in cap-sheet paths; data fetch effect is scoped to `teamId/authLoading/worldId` (`useArchitectState.ts:463-503`).
4. Residual risk (non-blocking): Full table recomputes 7 yearly totals on each team snapshot change; currently bounded and memoized.

### 12) Tests
- Status: `FAIL`
- Evidence:
1. Existing cap-related inventory is substantial (examples):  
   `src/tests/architect/capSheet_exception_wiring.behavior.test.jsx`,  
   `src/tests/architect/capSheetFull_ssot_parity_guardrails.test.js`,  
   `src/tests/architect/capTotals/deadMoney.test.js`,  
   `src/tests/architect/capLegality/exceptionBlocking.test.js`,  
   `src/tests/architect/baseMode_no_firestore_writes.guardrail.test.ts`,  
   `src/tests/architect/worldContext_parentFallback_capLegality.guardrail.test.ts`.
2. Executed suites:
   - `npm run test:architect -- --reporter=dot` -> PASS (`158 files`, `2412 tests`, `2408 passed`, `1 skipped`, `3 todo`).
   - `npm run test:trade -- --reporter=dot` -> PASS (`58 files`, `536 tests`, `532 passed`, `1 skipped`, `3 todo`).
3. Coverage gaps that keep this checklist item as `FAIL`:
   - No deterministic integration test covering Cap Sheet transaction matrix end-to-end in UI context (extend/waive/stretch/buyout/renounce with totals assertions).
   - No explicit test fixture guaranteeing a `futureContract` runtime proof path in the emulator walkthrough dataset.
   - No deterministic UI integration test for world selector create -> activate -> cap-sheet world-read boundary proof.

## C) Evidence Appendix
### Required commands (executed)
```bash
npm run validate:project
# ✅ PASS
# VALIDATION SUMMARY: All validations passed

npm run build
# ✅ PASS
# Built successfully (non-blocking warnings):
# - dynamic import/static import chunk warnings
# - large chunk warning

npm run dev
# ✅ PASS (manual walkthrough harness)
# VITE ready on http://localhost:5179/ and later http://localhost:5180/

npm run test:architect -- --reporter=dot
# ✅ PASS
# Test Files 158 passed
# Tests 2408 passed | 1 skipped | 3 todo (2412)

npm run test:trade -- --reporter=dot
# ✅ PASS
# Test Files 58 passed
# Tests 532 passed | 1 skipped | 3 todo (536)
```

### Key runtime snippets
```json
{
  "capSummary": {
    "header": true,
    "totalCapAllocations": "TOTAL CAP ALLOCATIONS\n$196,602,089",
    "capSpace": "CAP SPACE\n-$41,955,089",
    "taxSpace": "LUXURY TAX SPACE\n-$8,707,089",
    "firstApronSpace": "1ST APRON SPACE\n-$657,089",
    "secondApronSpace": "2ND APRON SPACE\n$11,221,911",
    "hardCapText": true
  },
  "seasonSwitch": {
    "header2031": true,
    "totalCapAllocations": "TOTAL CAP ALLOCATIONS\n$0",
    "capSpace": "CAP SPACE\n$266,494,000"
  }
}
```

```json
{
  "exceptions": {
    "click": { "clicked": true, "count": 1 },
    "modalSignals": {
      "helper": true,
      "mle": true,
      "tpmle": true,
      "bae": true,
      "room": true,
      "save": true
    }
  },
  "deadMoney": {
    "click": { "clicked": true, "count": 1 },
    "modalSignals": {
      "helper": true,
      "addEntry": true,
      "save": true
    }
  }
}
```

```json
{
  "playerModal": {
    "opened": true,
    "extend": true,
    "waive": true,
    "waiveStretch": true,
    "buyout": true
  },
  "fullCapTable": {
    "tabButtonCount": 1,
    "opened": true,
    "capHoldsBtnCount": 1,
    "absolve": true
  },
  "rightsModal": {
    "opened": true,
    "resign": true,
    "signAndTrade": true,
    "renounce": true
  }
}
```

```json
{
  "worldCreate": {
    "modal": true,
    "worldValue": "world_1772397272142_1y2ejy3bp",
    "worldDebug": "World: world_1772397272142_1y2ejy3bp | Base events: 0 | Preview events: 0"
  }
}
```

### Forbidden write scan
```bash
NO_ROOT_TEAMS_WRITE_MATCHES
```

## D) Fix Punchlist (NO FIXES IMPLEMENTED)
| Severity | Issue | File path(s) + function(s) | Acceptance criteria |
|---|---|---|---|
| Critical | Complete runtime transaction verification matrix for Cap Sheet actions (#6) | `src/shared/components/EditContractModal.jsx` (`handleConfirm`), `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (`handleSetDeadCap`, `handleSetExceptions`, `handleCapSheetAction`, `handleExtendContract`, `handleWaiveContract`, `handleOptionDecision`) | For each reachable action (extend, waive, waive&stretch, buyout, renounce, option accept/decline, rights actions), provide runtime proof of: state delta, totals delta, destination (`world` vs base), and gate behavior (blocked/allowed). |
| High | Unblock explicit `futureContract` runtime proof dataset for contract wiring (#4) | Emulator data source for Architect base/world team snapshots; Cap Sheet UI contract inspection surfaces | Provide at least one player fixture with non-empty `futureContract.salariesByYear`; verify in Cap Sheet/Full Cap Table that this data flows to displayed year rows and totals. |
| High | Add deterministic integration tests for cap-sheet world boundary + transaction matrix (#12) | New tests under `src/tests/architect/` (cap sheet integration scope) | Add automated tests that cover world create/select activation, cap-sheet read boundary (world vs base), and all cap-sheet transaction actions with totals assertions and persistence destination assertions. |
| Medium | Improve modal/test selectors for deterministic UI automation | `src/features/architect/capSheet/CapSheet/CapSheet.jsx`, `src/features/architect/capSheet/modals/*`, `src/features/architect/capSheet/CapSheetFull/CapSheetFull.jsx`, `src/features/architect/GMDashboard/components/WorldSelector.jsx` | Add stable `data-testid` hooks to Cap Sheet buttons/modals/RFA tags/cap-holds toggles/world-create controls so harnesses do not rely on ambiguous text matching. |

## E) Closure Criteria
Cap Sheet can be marked functionally complete after all below are true:
1. Checklist #6 is closed with runtime-verified action matrix evidence.
2. Checklist #4 blocker is resolved with explicit `futureContract` fixture proof for at least one player (plus one additional player control case).
3. Checklist #12 test gaps are closed with deterministic integration tests that pass in CI/emulator runs.
4. Forbidden-write scan continues to report no root `/teams/` writes.
5. Base/world boundary proof remains green in both runtime walkthrough and guardrail tests.

## F) AGENTS Return Package Additions
### Files changed
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- `return_packages/architect_reviews/CAP_SHEET_R1_LOCAL_REVIEW_RETURN_PACKAGE.md`

### Validation commands actually run
- `npm run validate:project`
- `npm run build`
- `npm run dev`
- `npm run test:architect -- --reporter=dot`
- `npm run test:trade -- --reporter=dot`

### Commands intentionally skipped
- `npm run test:diff -- --reporter=dot` skipped: architect/trade scoped suites already covered cap-related surfaces for this review run.
- `npm run test:full` skipped: blocked by policy without explicit `RUN FULL SUITE`.
- Review seeding scripts skipped by instruction: emulator dataset was already running and had to remain unchanged.
