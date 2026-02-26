# TRADE_E2E_TPE_EXCEPTIONS_DEEP_REVIEW_P1 — Return Package

## 1) STOP REPORT
**Triggered:** YES

| Stop Condition | Triggered | Evidence |
|---|---|---|
| 1) UI shows exceptions (especially TPE) not wired to validator/apply-time behavior | **YES** | `TradePlayerRow` sends action `'tradeException'` (`src/features/architect/tradeMachine/TradePlayerRow.jsx:226-231,426-427`) but `setPlayerTrade` has no `case 'tradeException'` (`src/features/architect/hooks/useTradeMachine.js:472-623`). `TradeEditor` applies exception by `tpe.teamId` (`src/features/architect/tradeMachine/TradeEditor.jsx:149-153`) but seeded/created TPE shapes do not set `teamId` (`src/features/architect/hooks/useTradeMachine.js:213-228`, `src/features/architect/utils/mutationPipeline.js:1337-1347`, `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js:217-264`). |
| 2) Validator claims exception support but apply-time does not persist/consume it (or vice versa) | **YES** | Validator auto-matches `absorptionMode='TPE'` without `tpeId` (`src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js:229-241`) and still excludes absorbed salary (`314`). Apply-time consumption requires explicit `player.tpeId` (`src/features/architect/utils/mutationPipeline.js:1192-1194`) and skips otherwise. UI allows `TPE` mode with empty selection (`src/features/architect/tradeMachine/TradeTeamCard.jsx:852-862`). |
| 3) Exceptions exist in storage but have no expiry/reset semantics while UI implies they do | NO | TPE expiry processing exists (`src/features/architect/utils/tpeLifecycle.js:27-112`), is applied on season transition (`src/features/architect/utils/offseason/resolveOffseasonTransition.ts:918-955`), and non-TPE reset exists (`src/features/architect/utils/exceptions/exceptionLifecycle.js:74-223`). |
| 4) World inheritance causes unexplained legality-changing exception differences across world/parent/base | NO (not proven) | Fallback chain is explicit and deterministic (`src/features/architect/utils/teamLoader.js:34-70`, `115-199`; `src/features/architect/utils/worldTeamData.ts:72-100`). No direct contradictory legality case was found in this audit. |

## 2) Ship-Readiness Verdict for Exceptions
**Not ship-ready** for exception semantics parity (UI <-> validator <-> apply).

## 3) System Map (SSOT table)
| Exception type | Storage location | Compute source | Validator usage (`validateTrade`) | Apply-time usage | UI surfaces | World-awareness | Expiry/reset rules |
|---|---|---|---|---|---|---|---|
| **TPE** | Canonical persisted path `team.exceptions.tpe[]` (`src/schemas/architect.ts:128-147,285`). Legacy read fallback `team.tradeExceptions[]` via accessor (`src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js:280-302`). Persistence contract only allows nested `exceptions.tpe` (`src/features/architect/utils/persistenceContracts/contracts.js:46-66,345-351`). | Creation helper `createTPE()` (`src/features/architect/utils/tradeMachine/utils/tradeUtilities.js:31-48`). Validator also sets `teamResult.createdTPE` (`src/features/architect/utils/tradeMachine/engine/tradeValidator.js:941-956`). | Allowable incoming includes per-player TPE absorption and subtracts absorbed salary from matching (`src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js:175-315`). `validateTradeExceptions` exists (`src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js:14-137`) but expects top-level `tradeExceptions/appliedTPEs` (`22-24,40-42`). In TradeEditor path, teams passed to validator do not include top-level TPE arrays (`src/features/architect/hooks/useTradeMachine.js:942-953`; `src/features/architect/utils/tradeContext/tradeContext.js:543-554`). | Consumption/creation in `computeTradeResult` (`src/features/architect/utils/mutationPipeline.js:1181-1257,1293-1385`), then normalize to canonical path and remove legacy on persistence (`2477-2489`) and commit atomically (`2602`). | Trade Machine: `TradeTeamCard`, `TradeExceptionManager`, `TradeExceptionDashboard`, `TradePlayerRow`, `ValidationDetailsPanel` (`src/features/architect/tradeMachine/*`). Cap sheet/dashboard: `ExceptionTracker`, `SeasonAdvanceModal`, `GMDashboard` offseason summary (`src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`, `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`, `src/features/architect/GMDashboard/GMDashboard.jsx`). | Team load fallback world -> parent -> base (`src/features/architect/utils/teamLoader.js:34-70,115-199`; `src/features/architect/utils/worldTeamData.ts:72-100`). | TPE lifecycle processor (`src/features/architect/utils/tpeLifecycle.js:27-112`), applied in offseason transition (`src/features/architect/utils/offseason/resolveOffseasonTransition.ts:918-955`) and aggregated in season advance summary (`src/features/architect/utils/seasonManager.js:604-647,1010-1013`). |
| **MLE (non-tax)** | `team.exceptions.mle` (schema supports exceptions object; see `src/schemas/architect.ts:139-149`). | Reset/recompute during season advance (`src/features/architect/utils/exceptions/exceptionLifecycle.js:31-41,74-193`). Manual edit via `setExceptions` mutation (`src/features/architect/utils/mutationPipeline.js:2101-2146`). | Not used in `validateTrade` allowable incoming. Used in signing validator as exception eligibility (`src/features/architect/utils/capLegalityValidation.js:2016-2182,2199-2233`). | Signing flow decrements usage when `signedUsing` indicates MLE (`src/features/architect/utils/mutationPipeline.js:1532-1547`). Can trigger hard-cap flags (`1550-1555`). | `ManageExceptionsModal` and cap sheet `ExceptionTracker` (`src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`, `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`). | Same world fallback chain via team loader. | Reset each new season (`src/features/architect/utils/exceptions/exceptionLifecycle.js:74-193`, applied by `resolveOffseasonTransition.ts:877-887`). |
| **TPMLE** | `team.exceptions.tpmle` (canonical lifecycle key) (`src/features/architect/utils/exceptions/exceptionLifecycle.js:36-41,47-52`). | Same exception lifecycle reset module (`74-193`). | Not used in `validateTrade` allowable incoming. Signing validator supports taxpayer/non-taxpayer gating (`src/features/architect/utils/capLegalityValidation.js:2124-2149`). | No explicit TPMLE decrement branch in trade apply; signing update path currently covers `mle`, `bae`, `room` branches (`src/features/architect/utils/mutationPipeline.js:1537-1587`). | `ManageExceptionsModal` and `ExceptionTracker`. | Same world fallback chain. | Reset on season advance via exception lifecycle. |
| **BAE** | `team.exceptions.bae` (`src/schemas/architect.ts:144`). | Same lifecycle reset (`src/features/architect/utils/exceptions/exceptionLifecycle.js:74-193`). | Not used in `validateTrade` allowable incoming. Signing validator blocks/permits by apron state (`src/features/architect/utils/capLegalityValidation.js:2105-2160`). | Signing apply decrements `exceptions.bae` (`src/features/architect/utils/mutationPipeline.js:1556-1566`). | `ManageExceptionsModal`, `ExceptionTracker`. | Same world fallback chain. | Reset on season advance via exception lifecycle. |
| **Room Exception** | `team.exceptions.room` (`src/features/architect/utils/exceptions/exceptionLifecycle.js:36-41`). | Lifecycle reset + room eligibility utility in UI modal (`src/features/architect/capSheet/modals/ManageExceptionsModal.jsx:80-86`). | Not used in `validateTrade` allowable incoming. Signing validator enforces room eligibility/apron constraints (`src/features/architect/utils/capLegalityValidation.js:2054-2076,2162-2178`). | Signing apply decrements `exceptions.room` (`src/features/architect/utils/mutationPipeline.js:1568-1587`). | `ManageExceptionsModal`, `ExceptionTracker`. | Same world fallback chain. | Reset on season advance via exception lifecycle. |
| **DPE** | `team.exceptions.dpe` reset/managed in lifecycle (`src/features/architect/utils/exceptions/exceptionLifecycle.js:195-218`). | Season rollover hard-clear (`195-218`), also in offseason transition (`src/features/architect/utils/offseason/resolveOffseasonTransition.ts:889-916`). | No `validateTrade` usage. `setExceptions` validation **does not allow dpe key** (`src/features/architect/utils/capLegalityValidation.js:946,983-995`). | `setExceptions` full replacement path (`src/features/architect/utils/mutationPipeline.js:2101-2146`) but payload containing `dpe` fails validation (`2223-2230` + `capLegalityValidation.js:946-995`). | `ManageExceptionsModal` includes DPE toggle/input (`src/features/architect/capSheet/modals/ManageExceptionsModal.jsx:22-30,54-57,157-172`). | Same world fallback chain. | Explicitly cleared on season rollover (`exceptionLifecycle.js:195-218`, `resolveOffseasonTransition.ts:889-916`). |
| **FA exception buckets (trade runtime)** | Runtime-only `team.faExceptionBuckets` in hook state (`src/features/architect/hooks/useTradeMachine.js:196-206`), not canonical exceptions schema. | Seeded in hook augmentation (`196-206`). | `validateSalaryMatching` has team-level FA branch (`src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js:143-171`), but Trade UI sets per-player absorption mode (`src/features/architect/hooks/useTradeMachine.js:534-589`), so branch linkage is weak. `validateFaExceptionUsage` exists but is not called by `tradeValidator` (`src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js`, `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:737-760`). | No dedicated executeTrade branch for FA trade-bucket consumption; non-trade signing path handles `signedUsing`. | `FaExceptionTracker`, `TradeTeamCard` absorption controls. | Same world fallback chain for team snapshot. | Not governed by TPE lifecycle; separate signing/cap legality flows. |

## 4) E2E Flow Traces
### Flow 1: Create TPE (implemented)
`Trade proposal -> validateTrade -> computeTradeResult -> persistWorldMutation`
1. Trade editor sends teams to `validateTrade` (`src/features/architect/hooks/useTradeMachine.js:941-962`).
2. `tradeValidator` computes `teamResult.createdTPE` via `createTPE` (`src/features/architect/utils/tradeMachine/engine/tradeValidator.js:941-956`; `tradeUtilities.js:31-48`).
3. `computeTradeResult` appends created TPE into `updatedTeam.tradeExceptions` with id/signature dedupe and history (`src/features/architect/utils/mutationPipeline.js:1293-1389`).
4. `persistWorldMutation` normalizes `tradeExceptions -> exceptions.tpe` then batch-commits (`2477-2492`, `2602`).

### Flow 2: Use TPE (partially implemented, parity break)
`Selection/declaration -> allowable incoming -> apply-time consumption`
1. UI supports TPE mode and optional `tpeId` selection (`src/features/architect/tradeMachine/TradeTeamCard.jsx:852-889`).
2. Validator salary matching applies TPE semantics even without explicit `tpeId` (auto-match branch) and excludes absorbed salary from matching (`validateSalaryMatching.js:229-241,314`).
3. Apply-time consumption only decrements when `player.tpeId` exists and `matchIncoming` exists (`mutationPipeline.js:1192-1215`).
4. Result: if user sets mode `TPE` but leaves `tpeId` blank, validator may allow more incoming, but apply-time can skip consumption. **STOP-triggering parity break.**

### Flow 3: Use Trade Exception action from row/modal (not implemented in active path)
`Player row action -> setPlayerTrade -> state mutation`
1. Player row calls `onSetPlayerTrade(..., 'tradeException', ..., validTPE)` (`src/features/architect/tradeMachine/TradePlayerRow.jsx:226-231,426-427`).
2. `setPlayerTrade` switch has no `'tradeException'` branch (`src/features/architect/hooks/useTradeMachine.js:472-623`).
3. Outgoing list uses shared modal (`src/features/architect/tradeMachine/OutgoingPlayersList.jsx:3,97-107`) whose callback signature does not match feature TPE modal behavior (`src/shared/components/TradeExceptionModal.jsx:11-18`).
4. **Not implemented in effective path** (UI affordance present, state/action plumbing incomplete).

### Flow 4: Expiry / season advance (implemented, with one UI summary drift)
`Season advance preview -> season advance transition -> persisted result`
1. Preview modal finds expiring TPEs via shared lifecycle logic (`src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx:168-183,471-485`).
2. Offseason transition resets non-TPE exceptions and processes TPE expiry (`src/features/architect/utils/offseason/resolveOffseasonTransition.ts:877-925`), appending expiry history (`930-954`).
3. `seasonManager` aggregates `summary.expiredTPEs` (`src/features/architect/utils/seasonManager.js:604-647,1010-1013`).
4. `OffseasonSection` currently sets `expiredTPEs: []` in local summary state (`src/features/architect/GMDashboard/sections/OffseasonSection.jsx:85-93`), so one surface can under-report actual expiries.

### Flow 5: Hard-cap/apron interaction when using exceptions (partially implemented)
1. Salary matching computes `effectiveSalaryIn = salaryIn - tpeAbsorbedSalary` and applies apron bands + hard-cap incoming ceiling (`src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js:314-441`).
2. Hard-cap validator separately evaluates using raw `salaryIn` (`src/features/architect/utils/tradeMachine/rules/hardCapValidation.js:48-50,103-110,139-144`).
3. Second-apron prior-year TPE checks exist (`validateTradeExceptions.js:50-58`, `basicRules.js:77-85`) but are dependent on top-level TPE arrays in current call shape.
4. Inference: second-apron prior-year TPE enforcement may be bypassed in common TradeEditor path because TPE arrays are nested under `team.team` while those rules read top-level inputs (`useTradeMachine.js:942-953`; `tradeContext.js:543-554`).

## 5) UI Parity Findings (wired vs cosmetic)
| Surface | What it displays | Data field(s) read | Wiring verdict |
|---|---|---|---|
| `TradeTeamCard` | Team TPE chips/list, per-incoming absorption mode + TPE selector | `getTeamTpeList(team)`, incoming player `absorptionMode/tpeId` | **Partially wired**. Core read path is canonical; but empty `tpeId` is allowed and can diverge from apply consumption (`TradeTeamCard.jsx:852-862` vs `mutationPipeline.js:1192-1194`). |
| `TradeExceptionManager` | Active/expired TPE list and click-to-apply | `exceptions` prop from `teamTradeExceptions` | **Partially wired**. Display is fed by canonical accessor. Apply callback depends on upstream `handleApplyTradeException` team lookup by `tpe.teamId` (often missing). |
| `TradePlayerRow` | "Use Trade Exception" menu action | first fitting `tradeExceptions.find(...)` | **Cosmetic/broken path**. Emits `'tradeException'` action that has no reducer case (`TradePlayerRow.jsx:226-231`; `useTradeMachine.js:472-623`). |
| `OutgoingPlayersList` + shared `TradeExceptionModal` | Exception modal for applying TPE | Shared modal local `amount/createNew` state | **Cosmetic/broken path**. Imports shared modal (`OutgoingPlayersList.jsx:3`) with mismatched `onApply(player, amount, createNew)` signature (`shared/TradeExceptionModal.jsx:15-18`) and no valid `'tradeException'` handling downstream. |
| Feature `TradeExceptionModal` (`tradeMachine/`) | Rich TPE picker modal | `tradeExceptions` + selected TPE | **Unused** in active imports (`rg` shows only shared modal import from OutgoingPlayersList). |
| `TradeExceptionDashboard` | Created/existing TPEs and "TPE usage" list | `result.teamResults`, `team.incomingPlayers/outgoingPlayers` | **Partially cosmetic**. Created/existing TPEs display works; usage subsection depends on `team.incomingPlayers` in `teamResults` which validator result object does not provide (`tradeValidator.js:922-961`). |
| `TradeLegalChecker` | Rule pass/fail including tradeExceptions | `team.rules.tradeExceptions` | **Wired** to validator output object. |
| `ValidationDetailsPanel` | Hosts exception dashboards + salary calculator | `TradeExceptionDashboard`, `FaExceptionTracker`, `getTeamTpeList(selectedTeam.team)` | **Mixed**. Includes exploratory calculator explicitly marked non-authoritative (`TradeSalaryCalculator.jsx:16-23`). |
| `FaExceptionTracker` | FA buckets and FA usage/hard-cap warnings | `teamData.team.faExceptions`, `team.incomingPlayers` | **Mostly cosmetic in current path**; depends on fields often not present in `teamResults`/team snapshot conventions. |
| `ExceptionTracker` (cap sheet) | NT-MLE/TP-MLE/BAE/DPE cards and TPE list | top-level `teamCapSheet.mle/tpMle/bae/dpe`, plus `getTeamTpeList(teamCapSheet)` | **Mixed**. TPE list wired via accessor; non-TPE cards rely on top-level fields not canonical `team.exceptions.*`, risk drift. |
| `ManageExceptionsModal` | Manual edit of MLE/TPMLE/BAE/ROOM/**DPE** | `teamCapSheet.exceptions` | **Partially wired with blocker gap**. Includes DPE (`ManageExceptionsModal.jsx:22`) but `setExceptions` validator rejects unknown keys outside `mle,tpmle,bae,room` (`capLegalityValidation.js:946-995`). |
| `ExceptionHistoryTracker` | TPE and MLE history tables | `teamCapSheet.exceptionHistory`, `mleHistory` | **Likely cosmetic mismatch**. UI expects `entry.date/action/amount/source/expires` but history helpers persist `timestamp/type/amountCreated...` (`ExceptionHistoryTracker.jsx:21-28` vs `historyHelpers.js:92-111,157-176,255-272`). |
| `SeasonAdvanceModal` | Expiring TPE preview | `getTeamTpeList + processTradeExceptions` | **Wired** preview path. |
| `GMDashboard` offseason summary modal | Expired TPE list, reset MLE text | `offseasonSummary.expiredTPEs/resetMLE` | **Partially cosmetic**: `OffseasonSection` hardcodes `expiredTPEs: []` and `resetMLE: true` (`OffseasonSection.jsx:85-93`). |

## 6) Validator Findings
- Allowable incoming is exception-aware **for TPE only** through `validateSalaryMatching` (`validateSalaryMatching.js:175-315`).
- Hard-cap enforcement is applied in two places:
  - salary matching effective ceiling (`validateSalaryMatching.js:404-441`), and
  - standalone hard-cap validator (`hardCapValidation.js:15-160`).
- `validateTradeExceptions` contains expiry/capacity/second-apron prior-year checks (`validateTradeExceptions.js:50-113`) but depends on top-level `team.appliedTPEs` or `team.tradeExceptions` (`22-42`).
- In TradeEditor and apply validation context, teams are passed without top-level TPE arrays (`useTradeMachine.js:942-953`, `tradeContext.js:543-554`).
- Inference: important TPE branches in `validateTradeExceptions` and `validateSecondApronRules` can become no-op in this path, while salary matching still applies TPE absorption from nested `team.team` (`validateSalaryMatching.js:193`).
- No hidden alternate allowable-incoming exception path found in `salaryMatchingRules.js` (rule math only).

## 7) Apply-Time Findings
- TPE apply semantics in execute flow are implemented in one branch:
  - consume by `incoming player tpeId + matchIncoming` (`mutationPipeline.js:1192-1257`),
  - create from `teamResult.createdTPE` (`1293-1385`),
  - append exception history (`1273-1290,1349-1366,1387-1389`).
- Persistence is fail-closed and atomic:
  - all writes staged in one Firestore batch and committed once (`persistWorldMutation` `2457-2602`).
- World scoping is explicit via world refs and world metadata patch (`worldTeamRef/worldMetadataRef` inside `persistWorldMutation`).
- Canonical schema enforcement is present:
  - sanitize -> normalize TPE schema -> contract validation -> remove undefined (`2475-2489`).
- Parity risk remains: validator can allow TPE absorption without `tpeId`, but apply-time consumption requires `tpeId`.

## 8) Issues List (Blockers / Majors / Minors)
### Blockers
1. **Validator/apply consumption mismatch for TPE without explicit `tpeId`.**
   - Validator auto-matches TPE (`validateSalaryMatching.js:229-241`) but apply only consumes with explicit `player.tpeId` (`mutationPipeline.js:1192-1194`).
2. **Primary UI "Use Trade Exception" action path is not implemented end-to-end.**
   - `'tradeException'` action emitted (`TradePlayerRow.jsx:226-231,426-427`) but no handler case (`useTradeMachine.js:472-623`).
3. **Trade exception rule inputs are disconnected from main validateTrade call shape.**
   - `validateTradeExceptions` expects top-level TPE arrays (`validateTradeExceptions.js:22-42`), while caller path sends only nested `team` object (`useTradeMachine.js:942-953`; `tradeContext.js:543-554`).

### Majors
1. **`TradeEditor` apply-by-teamId path likely fails for many TPE objects.**
   - `tpe.teamId` lookup (`TradeEditor.jsx:149-153`) but created/seeded TPEs omit `teamId`.
2. **Manage Exceptions modal exposes DPE, but mutation validation rejects DPE key.**
   - UI includes `dpe` (`ManageExceptionsModal.jsx:22`) vs validator allowlist (`capLegalityValidation.js:946-995`).
3. **Offseason summary UI drops real `expiredTPEs` data.**
   - `seasonManager` computes it (`seasonManager.js:644-647`) but `OffseasonSection` sets `expiredTPEs: []` (`OffseasonSection.jsx:85-93`).
4. **Exception history UI field mapping likely mismatched with persisted history shape.**
   - UI expects `date/action/amount/source/expires` vs stored entries use `timestamp/type/...`.
5. **Duplicate/legacy exception rule files create semantic ambiguity.**
   - `rules/tradeExceptions.js` and `rules/validateTradeExceptions.js` both exist and both exported (`rules/index.js:29-31`).

### Minors
1. Seeded test TPEs in hook (`useTradeMachine.js:208-228`) can make UI appear to have real exceptions in worlds with none.
2. `tradeValidator` computes `createdTPE` separately from rule output, increasing divergence risk (`tradeValidator.js:941-956` vs `validateTradeExceptions.js:117-127`).
3. Several dashboards include diagnostic/cosmetic fields that are not authoritative by design (notably `TradeSalaryCalculator` sandbox mode).

## 9) Proposed Master Doc Deltas (do not apply)
1. In `docs/architect/TRADE_MACHINE_MASTER.md`, add a dedicated "Trade Exception Parity Contract" section:
   - required TPE input shape for validator,
   - required apply-time consumption keys (`tpeId`, `matchIncoming`),
   - explicit prohibition on auto-match without persistence mapping.
2. Add an "Exception Surface Truth Table" appendix:
   - each UI surface, canonical data source, and whether authoritative vs diagnostic.
3. Add explicit note that canonical persisted path is `team.exceptions.tpe[]`, with `team.tradeExceptions[]` read-compat only.
4. Add season-advance note defining which UI summary surfaces must reflect `summary.expiredTPEs` exactly.
5. Add guardrail requirement: manual exception edit allowlist and UI exception types must stay in lock-step.

## 10) Validation Outputs
**Files changed in this preflight:**
- `return_packages/trade_machine/TRADE_E2E_TPE_EXCEPTIONS_DEEP_REVIEW_P1_RETURN_PACKAGE.md`

**Commands run:**
1. `npm run test:trade -- --reporter=dot` -> **PASS**
   - `Test Files 54 passed`
   - `Tests 508 passed | 1 skipped | 3 todo`
   - Duration `17.34s`
2. `npm run test:architect -- --reporter=dot` -> **PASS**
   - `Test Files 136 passed`
   - `Tests 2206 passed | 1 skipped | 3 todo`
   - Duration `54.26s`
3. `npm run build` -> **PASS**
   - Build completed successfully (`built in 28.26s`)
   - Non-blocking warnings: module externalization/chunk-size notices.
4. `npm run validate:project` -> **PASS**
   - `All validations passed!`

**Commands intentionally skipped:**
- Full suite (`npm run test`, `npm run test:full`, raw `vitest`) skipped by policy and prompt scope.

## 11) Exact files/functions referenced
- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
  - `normalizeTeamTpeSchema` (`144-203`)
  - `getTeamTpeList` (`280-302`)
- `src/features/architect/utils/persistenceContracts/contracts.js`
  - `TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST` (`46-94`)
  - `TEAM_DEEP_RULES` (`345-357`)
- `src/schemas/architect.ts`
  - `TradeExceptionZ`, `ExceptionsZ`, `BaseTeamDocZ.exceptions` (`128-149`, `285`)
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - validator wiring (`737-760`)
  - team result payload incl. `createdTPE` (`922-961`)
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
  - TPE per-player path (`175-315`)
  - hard-cap ceiling merge (`404-441`)
- `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js`
  - input shape + checks (`22-113`)
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
  - hard-cap calculations (`48-53`, `103-110`, `139-144`)
- `src/features/architect/utils/tradeMachine/rules/basicRules.js`
  - second-apron TPE prior-year check (`77-85`)
- `src/features/architect/hooks/useTradeMachine.js`
  - seeded TPEs (`193-229`)
  - `setPlayerTrade` switch (`462-623`)
  - validateTrade call shape (`941-953`)
  - `applyTradeException` (`1065-1092`)
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`
  - canonical TPE accessor usage (`112`)
  - TPE mode + selector (`820-889`)
- `src/features/architect/tradeMachine/TradePlayerRow.jsx`
  - `tradeException` action emission (`226-231`, `426-427`)
- `src/features/architect/tradeMachine/TradeEditor.jsx`
  - `handleApplyTradeException` (`149-153`)
- `src/features/architect/tradeMachine/OutgoingPlayersList.jsx`
  - shared modal import + apply callback (`3`, `97-107`)
- `src/shared/components/TradeExceptionModal.jsx`
  - callback signature (`11-18`)
- `src/features/architect/tradeMachine/TradeExceptionModal.jsx`
  - richer modal implementation (unused path)
- `src/features/architect/tradeMachine/TradeExceptionDashboard.jsx`
  - dashboard mapping assumptions (`12-25`, `96-107`)
- `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`
  - exception dashboard/salary calculator inclusion (`267-287`)
- `src/features/architect/tradeMachine/TradeLegalChecker.jsx`
  - `team.rules.tradeExceptions` surface (`75-79`)
- `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - exception type list includes DPE (`22-30`, `157-172`)
- `src/features/architect/utils/capLegalityValidation.js`
  - `validateExceptions` allowlist excludes DPE (`946-995`)
  - `validateExceptionEligibility` (`2016-2182`)
- `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`
  - mixed non-TPE/TPE display sources (`121-150`, `129`, `270-272`)
- `src/features/architect/capSheet/ExceptionHistoryTracker/ExceptionHistoryTracker.jsx`
  - expected UI fields (`21-28`)
- `src/features/architect/utils/exceptionHistory/historyHelpers.js`
  - persisted history entry shapes (`63-121`, `123-186`, `238-282`, `284-327`)
- `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
  - expiring TPE preview (`168-183`, `471-485`)
- `src/features/architect/GMDashboard/sections/OffseasonSection.jsx`
  - offseason summary assignment (`85-93`)
- `src/features/architect/GMDashboard/GMDashboard.jsx`
  - expired TPE summary rendering (`383-391`)
- `src/features/architect/utils/mutationPipeline.js`
  - TPE consumption/creation (`1181-1389`)
  - `persistWorldMutation` batch + normalization (`2457-2602`)
  - `computeSetExceptionsResult` (`2101-2146`)
- `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`
  - non-TPE reset + TPE lifecycle + history (`877-955`)
- `src/features/architect/utils/tpeLifecycle.js`
  - `processTradeExceptions` (`27-112`)
- `src/features/architect/utils/exceptions/exceptionLifecycle.js`
  - `resetTeamNonTpeExceptionsForNewSeason` (`74-223`)
- `src/features/architect/utils/seasonManager.js`
  - season summary aggregation (`604-647`, `1010-1013`)
- `src/features/architect/utils/teamLoader.js`
  - world -> parent -> base fallback (`34-70`, `115-199`)
- `src/features/architect/utils/worldTeamData.ts`
  - world-aware loader notes/usage (`72-100`)
- `docs/architect/TRADE_MACHINE_MASTER.md`
- `docs/SHIP_GATES_MASTER.md`
- `docs/guides/ORDER_OF_OPERATIONS.md`
