# TM_E2E_FUNCTIONALITY_P2_PREFLIGHT_RETURN_PACKAGE

Date: 2026-02-28  
Mode: PREFLIGHT (Discovery-only, docs-only)  
Scope: STOP #4 and STOP #5 closure confirmation after E1

## 1) Executive Summary
P2 verdict: **CLOSED**.

Both STOPs remain closed on current code:
- STOP #5 (base-state apply gate): base-state apply (`worldId = null`) routes through authoritative compute (`computeWorldMutation('executeTrade')`), requires `_validatedTradeContext` + `legal`, and fail-closes before `setTeamCapSheet(...)` on invalid context.
- STOP #4 (years remaining): Trade row uses canonical `getYearsRemainingDisplay(...)`, and EditContractModal uses the same canonical source `getContractYearsForDisplay(...)` from `contractUtils.js` (including extension years from `futureContract.salariesByYear`).

No new Firestore write calls were found in the base-state apply branch.

## 2) STOP Re-check Table
| STOP | Re-check Result | Triggered? | Repo-relative Evidence |
|---|---|---|---|
| #5 Base-state apply bypasses authoritative gate | Base-state branch computes via `computeWorldMutation`, validates `_validatedTradeContext` and `legal`, then mutates local state only after gates pass | **Not Triggered** | `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:756`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:774`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:785`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:791`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:809` |
| #4 Years remaining display wrong | Trade row display and EditContract modal both use shared canonical helpers in architect `contractUtils` | **Not Triggered** | `src/features/architect/tradeMachine/TradePlayerRow.jsx:7`, `src/features/architect/tradeMachine/TradePlayerRow.jsx:74`, `src/shared/components/EditContractModal.jsx:25`, `src/shared/components/EditContractModal.jsx:194`, `src/features/architect/utils/contractUtils.js:94`, `src/features/architect/utils/contractUtils.js:127` |

## 3) Authoritative Gate Trace
Base-state apply call chain:

1. Apply click in Trade UI calls `onApplyTrade(tradeData)`:
   - `src/features/architect/tradeMachine/TradeEditor.jsx:502`
   - `src/features/architect/tradeMachine/TradeEditor.jsx:533`
2. `TradeSection` passes through `onApplyTrade`:
   - `src/features/architect/GMDashboard/sections/TradeSection.jsx:14`
   - `src/features/architect/GMDashboard/sections/TradeSection.jsx:19`
3. `GMDashboard` wires `onApplyTrade={actions.applyTradeToCapSheet}`:
   - `src/features/architect/GMDashboard/GMDashboard.jsx:303`
   - `src/features/architect/GMDashboard/GMDashboard.jsx:309`
4. `applyTradeToCapSheet(...)` in actions hook:
   - Entry: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:612`
   - World branch exits early via `runAuthoritativeFAMutation(...)` only when `worldId` exists: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:716`, `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:725`
   - Base-state branch (`worldId = null`) loads base snapshots: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:729`
   - Authoritative compute gate: `computeWorldMutation({ mutationType: 'executeTrade' ... })`: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:756`
   - Required validated context extraction: `_validatedTradeContext`: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:774`
   - Fail-closed checks:
     - missing validated context: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:785`
     - illegal validated context: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:791`
   - Local cap sheet mutation only after all checks pass: `setTeamCapSheet(updatedTeam as CapSheet)`: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:809`

Guardrail and behavior tests supporting fail-closed semantics:
- Source guardrail ordering: `src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts:10`
- Behavioral no-mutation when illegal validated context: `src/tests/architect/useArchitectActions.freeAgency.test.tsx:262`, `src/tests/architect/useArchitectActions.freeAgency.test.tsx:373`

## 4) Years Remaining Trace
Canonical helper definitions:
- `getContractYearsForDisplay(...)`: `src/features/architect/utils/contractUtils.js:94`
- Extension-year inclusion via `futureContract.salariesByYear`: `src/features/architect/utils/contractUtils.js:112`
- Year dedupe with extension precedence: `src/features/architect/utils/contractUtils.js:119`
- `getYearsRemainingDisplay(...)` uses assembled contract years first, then safe fallback paths: `src/features/architect/utils/contractUtils.js:127`, `src/features/architect/utils/contractUtils.js:133`, `src/features/architect/utils/contractUtils.js:143`, `src/features/architect/utils/contractUtils.js:150`

Trade row path:
- Import of canonical years helper: `src/features/architect/tradeMachine/TradePlayerRow.jsx:7`
- Usage for displayed years remaining: `src/features/architect/tradeMachine/TradePlayerRow.jsx:74`

EditContract modal path:
- Imports shared canonical assembly helper from same module: `src/shared/components/EditContractModal.jsx:25`
- Uses `getContractYearsForDisplay(player)` for modal contract-year source: `src/shared/components/EditContractModal.jsx:194`

Targeted UI proof:
- Extension-aware and non-extension years display assertions: `src/tests/architect/tradePlayerRow.yearsRemainingDisplay.test.tsx:33`, `src/tests/architect/tradePlayerRow.yearsRemainingDisplay.test.tsx:55`

## 5) Firestore Write Audit
Base-state apply branch audit target:
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:612-819`

Findings:
- No `writeBatch`, `setDoc`, `updateDoc`, `addDoc`, `deleteDoc`, or `batch.commit` calls are present in the base-state apply region.
- World-only persistence path remains isolated behind `worldId` gate via `runAuthoritativeFAMutation(...)` -> `applyWorldMutation(...)`:
  - world-required guard: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:555`
  - `applyWorldMutation(...)` call: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:571`
  - base-state branch split starts after early return: `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:725`

Command evidence:
- Region scan command:  
  `awk 'NR>=612 && NR<=819 {print NR":"$0}' src/features/architect/GMDashboard/hooks/useArchitectActions.ts | rg -n "writeBatch|setDoc|updateDoc|addDoc|deleteDoc|batch\\.commit|commit\\("`
- Output: no matches (`[no-write-calls-in-base-apply-region]`).

## 6) Commands Run + Results
1. `npm run test:node -- --run src/tests/architect/tradeApply_baseState_authoritativeGate.guardrail.test.ts --reporter=dot`  
   Result: PASS (`1 passed`)

2. `npm run test:ui -- --run src/tests/architect/tradePlayerRow.yearsRemainingDisplay.test.tsx --reporter=dot`  
   Result: PASS (`2 passed`)

Commands intentionally skipped:
- `npm run build`, `npm run typecheck`, `npm run validate:project`, and broader suites were skipped because this was PREFLIGHT discovery-only and scope was limited to STOP #4/#5 confirmation with targeted evidence.
