# EDIT_CONTRACT_MASTER

**Feature:** Architect Edit Contract modal  
**Primary entry covered here:** Cap Sheet tab (`activeTab === 'cap'`) row-click flow  
**Last updated:** 2026-03-01  
**Source packages:**

- `return_packages/architect/TM_EDIT_CONTRACT_P1_PREFLIGHT_RETURN_PACKAGE.md`
- `return_packages/architect/TM_EDIT_CONTRACT_E1_EXECUTION_RETURN_PACKAGE.md`

Historical note: the referenced `TM_EDIT_CONTRACT_*` return-package artifacts are
not present in the current workspace. Preserve those paths as historical evidence
labels rather than treating them as live workspace links.

---

## 1. Purpose

This master doc is the running source-of-truth for Edit Contract wiring from the Cap Sheet entry path:

- Cap Sheet row click
- Edit Contract modal open/context
- Save actions and mutation pipeline
- Totals refresh and base/world persistence parity

---

## 2. Current Wiring Baseline (P1 Preflight)

Verified flow:

1. Route `/gm/:teamId` renders `GMDashboard`.
2. `activeTab === 'cap'` renders `CapSheetSection` with `onSelectPlayer={actions.handleEditContract}`.
3. Cap Sheet row button calls `onSelectPlayer(player)`.
4. `handleEditContract` sets selected player/rules year and opens modal.
5. `EditContractModal` receives `player`, `teamCapSheet`, `currentYear`, and save handlers.
6. Save handlers route through `useArchitectActions` with local optimistic updates and validator gates.

Reference evidence was captured in the original return-package Section 2, but the
package file itself is not present in the current workspace.

---

## 3. Key Findings Snapshot

### P0

- Buyout action is not fully wired (no buyout amount input/payload semantics).
- World authoritative semantics diverge from local optimistic state for some flows (`waive`, `option decline`), creating post-refresh drift risk.

### P1

- Modal currently closes unconditionally after confirm, including canceled/failed flows.
- Option-set precedence can hide under-contract actions for option players from Cap Sheet entry.

### P2

- Extension world compute path does not explicitly recompute persisted `team.totals`.

Full evidence and repro steps were originally recorded in return-package
Sections 8 and 12; those package artifacts are not present in the current
workspace.

---

## 4. Validation Snapshot

Commands executed for this preflight:

- `npm run test:node -- --run --reporter=dot` ✅
- `npm run test:ui -- --run --reporter=dot` ✅
- `npm run build` ✅
- `npm run validate:project` ✅
- `npm run test:architect -- --run src/tests/architect/baseMode_no_firestore_writes.guardrail.test.ts src/tests/architect/worldOptimistic_postStateValidator_blocks_violation.behavior.test.ts --reporter=dot` ✅

---

## 5. Next Use

Use this doc plus the P1 return package as the baseline for any execution-phase ticket that touches:

- Edit Contract action surfaces
- Save-path parity (base vs world)
- Cap Sheet post-save refresh behavior
- Buyout/waive/option semantics

---

## 6. E1 Execution Closure (2026-03-01)

Status: **COMPLETE**

Scope closed in E1:

- Cap Sheet modal buyout workflow now captures and forwards buyout amount.
- World-mode optimistic/apply drift is closed for modal cap mutations via authoritative success resync.
- Modal close behavior is now success-gated (no close on canceled confirm or failed save).

### 6.1 Buyout Workflow (P0 Closed)

Implemented:

1. `EditContractModal` renders **Buyout Amount** input only when action = `buyout`.
2. Confirm path forwards:
   - `onWaive(player, { buyout: true, buyoutAmount, ... })`
3. `handleWaiveContract` now forwards buyout fields to persistence payload:
   - `buyout`, `buyoutAmount`
4. Local optimistic and world compute use the same buyout semantics:
   - `deadCapAmount = max(0, remainingGuaranteed - buyoutAmount)`
5. Optimistic waive now writes canonical team `deadCap` entries (instead of player-only dead-cap metadata), matching world compute shape.

### 6.2 Authoritative Resync (P0 Closed)

`applyCapAuditedTeamMutation` success path now performs authoritative in-memory sync:

- After successful world persist, it calls `syncTeamFromMutationResult(...)`.
- If `changedTeams` includes current team, in-memory `teamCapSheet` updates to authoritative snapshot.
- Existing rollback-on-failure behavior is preserved.
- This closes optimistic-vs-authoritative drift for modal cap mutations (`waivePlayer`, `optionDecision`, `extendPlayer`, `renounceRights`, plus shared cap mutation helper users).

### 6.3 Modal Close Gating (P1 Closed)

`EditContractModal` confirm flow is now async and success-gated:

- Awaits handler promise result.
- Closes only on `{ success: true }`.
- Keeps modal open and shows inline error on:
  - canceled confirm (`{ success: false, message: ... }`)
  - world save failure
  - validation/handler failure

This mirrors the dead money / exceptions modal close-after-success behavior.

### 6.4 Extension Totals Consistency (P2 Verified, No Change)

Verified: `extendPlayer` compute path is future-contract only and does not change current-season cap allocations.  
`computeExtensionResult` still intentionally does not recompute `team.totals` (current-year totals are unchanged by extension-only writes).  
No behavioral change was required for this ticket.

### 6.5 E1 Tests Added

- `src/tests/architect/editContractModal_buyout_and_close.behavior.test.jsx`
  - buyout amount input + payload forwarding
  - modal remains open on canceled/failure result
- `src/tests/architect/useArchitectActions_editContract_resync.behavior.test.tsx`
  - buyout payload forwarding through world mutation call
  - optimistic dead-cap update
  - authoritative `changedTeams` resync
  - totals parity via `computeTeamCapTotals`-driven state

### 6.6 E1 Validation Snapshot

- `npm run test:node -- --run --reporter=dot` ✅
- `npm run test:ui -- --run --reporter=dot` ✅
- `npm run build` ✅
- `npm run validate:project` ✅
- Targeted E1 tests:
  - `npm run test:ui -- --run src/tests/architect/editContractModal_buyout_and_close.behavior.test.jsx src/tests/architect/useArchitectActions_editContract_resync.behavior.test.tsx --reporter=dot` ✅

### 6.7 Base vs World Parity Rules (Current)

- Base mode (`worldId === null`): no Firestore writes, optimistic local state only.
- World mode:
  - optimistic state applied immediately (with validator gate)
  - authoritative world persist attempted
  - authoritative `changedTeams` snapshot re-applied on success
  - optimistic rollback on failure

---

## 7. E2 Closure Permanence Gates (2026-03-01)

Status: **COMPLETE**

### 7.1 Purpose

E2 adds source-scanning gate tests that permanently guard E1 closures from regression. These gates:

- Scan source files for required code patterns
- Run fast (no UI rendering, no Firestore)
- Fail CI if E1 closures regress

### 7.2 Gate Categories

| Gate                                                   | What It Protects                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Gate 1: Buyout Amount UI + Forwarding**              | Buyout amount input exists, conditionally rendered for buyout action, and `buyoutAmount` is forwarded (not hardcoded)        |
| **Gate 2: Success-Gated Modal Close**                  | `handleConfirm` is async, normalizes result, only calls `onClose()` on success, and sets `saveError` on failure              |
| **Gate 3: Cancel Confirm Returns `{ success:false }`** | Waive and renounce handlers return `{ success: false, message }` on canceled confirm                                         |
| **Gate 4: World Success Authoritative Re-sync**        | `syncTeamFromMutationResult` exists and is called on mutation success                                                        |
| **Gate 5: World Compute Honors Buyout Fields**         | `computeWaiveResult` reads `payload.buyoutAmount`, clamps with `boundedBuyoutAmount`, and computes `deadCapAmount` correctly |
| **Gate 6: Callback Compatibility Contract**            | Modal save callbacks in FreeAgentPool and TradeEditor return `{ success, message }` contract                                 |

### 7.3 Run Command

```bash
npm run test:node -- --run src/tests/architect/editContractModal_closure.gate.test.ts --reporter=dot
```

### 7.4 Gate Test File

`src/tests/architect/editContractModal_closure.gate.test.ts`

### 7.5 Policy

- **Tests + docs only** — no runtime production code changes
- **Source-scanning** — gates read source files and verify regex patterns
- **Resilient to formatting** — regex patterns allow whitespace variation
