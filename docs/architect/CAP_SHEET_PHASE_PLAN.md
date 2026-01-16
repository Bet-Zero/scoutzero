# CAP SHEET — PHASE PLAN

**STATUS:** DRAFT | **TYPE:** EXECUTION PLAN | **TARGET:** SSOT CONSOLIDATION

## A) Purpose

This document provides the step-by-step execution plan to consolidate the Cap Sheet architecture into a Single Source of Truth (SSOT). It converts the doctrines defined in `CAP_SHEET_MASTER_DOC.md` into actionable engineering tasks.

**How to use this plan:**

1. Execute phases sequentially (Starts at Phase 0.5, then 1 through 4).
2. Do not proceed to the next phase until the **Stop Conditions** of the current phase are cleared.
3. Each phase requires a **Return Package** verifying the changes.

## B) Preconditions

Before Phase 1 starts:

- [ ] `docs/architect/CAP_SHEET_MASTER_DOC.md` exists and is marked SSOT.
- [ ] Logic for `computeTeamCapTotals.js` is confirmed as the canonical SSOT.
- [ ] The repository is in a clean state (no uncommitted changes).

## C) Execution Phases

### Phase 0.5: Verification of Uncertain Paths

**Goal:** Confirm current wiring of components flagged as uncertain in the Master Doc.

**Tasks:**

- [ ] **Verify `CapSummaryTiles` wiring:** Does it purely read from properties passed to it, or does it do local math?
- [ ] **Trace `worldlessBaselineSalary.js`:** Confirm exact usage beyond known test files.

**Acceptance Criteria:**

- [ ] `CapSummaryTiles` input source is definitively known.
- [ ] `worldlessBaselineSalary.js` usage is fully mapped.

**Validation:**

- Manual code trace.
- `grep` search for component usages.

**Stop Conditions:**

- If `CapSummaryTiles` is found to do complex local math, pause and add a refactor task to Phase 1.

**Return Package:**

- List of confirmed wiring for checked components.

---

### Phase 1: SSOT Consolidation (Consumers)

**Goal:** Refactor primary UI consumers to read directly from `computeTeamCapTotals` (or `TeamCapTotals` object) instead of performing local calculations.

**Tasks:**

- [ ] **Fix `CapSheet.jsx`:**
  - [ ] Remove `calculateCapHitTotal` (and any other local aggregation logic).
  - [ ] Ensure it consumes `TeamCapTotals` from `useTeamCap`.
- [ ] **Fix `TradeTeamCard`:**
  - [ ] Remove reliance on `teamTotalSalary` or `getSalaryForYear` if they use local math.
  - [ ] Wire it to accept a matching `TeamCapTotals` shape or derived prop.

**Acceptance Criteria:**

- [ ] `CapSheet.jsx` contains NO `reduce` or `+` math for total cap allocations.
- [ ] `TradeTeamCard` uses the exact same total as the Cap Sheet for the same team/year.

**Validation:**

- **Visual Check:** Compare Cap Sheet Total vs. Trade Machine Total for the same team. They MUST match.
- **Unit/Integration Test:** Verify `CapSheet` renders correct totals given a mock `TeamCapTotals`.

**Stop Conditions:**

- If UI breaks or displays `NaN`, revert and debug.
- If removing local math breaks strict "worldless" rendering (i.e. if SSOT requires a world and one isn't present), pause to fix the loader.

**Return Package:**

- Diff of `CapSheet.jsx` showing removal of math.
- Diff of `TradeTeamCard` showing new prop usage.

---

### Phase 2: SSOT Consolidation (Duplicate Helpers)

**Goal:** Eliminate or redirect legacy helper functions that duplicate SSOT logic.

**Tasks:**

- [ ] **Refactor `salaryUtils.js`:**
  - [ ] Identify `payrollForYearFromCapSheet` and `deadMoneyForYear`.
  - [ ] Replace implementation to wrap `computeTeamCapTotals` OR deprecate/redirect calls to the SSOT.
- [ ] **Refactor `useTradeMachine.js`:**
  - [ ] Find inline payroll/dead money calculations.
  - [ ] Replace with calls to `computeTeamCapTotals`.

**Acceptance Criteria:**

- [ ] `salaryUtils.js` no longer contains independent summation logic for payroll/dead money.
- [ ] `useTradeMachine.js` delegates all cap math to the SSOT function.

**Validation:**

- **Regression Test:** Run Trade Machine scenarios. Ensure cap space updates correctly when players are traded.
- **Code Scan:** Search for `reduce((sum` logic in these files. Should be zero matches for cap totals.

**Stop Conditions:**

- If circular dependencies arise when importing SSOT into utils, pause to restructure imports.

**Return Package:**

- List of functions verified as "Passthrough" or "Deleted".

---

### Phase 3: WorldlessBaselineSalary Disposition

**Goal:** Safely remove the redundant "parallel SSOT" `worldlessBaselineSalary.js`.

**Tasks:**

- [ ] **Repo-wide Import Scan:**
  - [ ] Exact strict search for `worldlessBaselineSalary` and `getWorldlessTeamBaselineTotal`.
- [ ] **Disposition:**
  - [ ] If TRULY unused (except tests): DELETE file and tests.
  - [ ] If used: Refactor consumer to use `computeTeamCapTotals` (passing base data only), then DELETE.

**Acceptance Criteria:**

- [ ] `src/features/architect/utils/worldlessBaselineSalary.js` is deleted.
- [ ] No build errors or runtime crashes.

**Validation:**

- `grep` search returns 0 results for the filename.
- Full application build pass.

**Stop Conditions:**

- If a consumer heavily relies on this for a specific "no-world" edge case that `computeTeamCapTotals` cannot handle, ABORT deletion and flag for re-design.

**Return Package:**

- Confirmation of file deletion.

---

### Phase 4: Wiring Map Audit + Enforcement

**Goal:** Final sweep to ensure no hidden local math remains and lock in the Wiring Map.

**Tasks:**

- [ ] **Audit Remaining Files:** Scan for "payroll", "cap space", "dead money" keywords.
- [ ] **Enforce Wiring:**
  - [ ] Any component displaying these metrics MUST prove it receives `TeamCapTotals` or calls `computeTeamCapTotals`.
- [ ] **Update Master Doc:** Mark "Wiring Map" table as "Verified" if all violations are resolved.

**Acceptance Criteria:**

- [ ] No "High" severity risks remain from Master Doc Risk table.
- [ ] Wiring Map in Master Doc reflects reality (no "VIOLATION" tags).

**Validation:**

- Fill out the **Validation Matrix** (see Section F).

**Stop Conditions:**

- If new hidden logic is found, add a Phase 4.5.

**Return Package:**

- Completed Validation Matrix.

## D) SSOT Enforcement Rules

1. **NO Local Math:** UI components strictly display data. They do not add, subtract, or aggregate salaries.
2. **One Import:** Cap totals come from `computeTeamCapTotals` (direct or via hook) or `TeamCapTotals` object props.
3. **No "Backdoor" Props:** Do not pass raw `players` arrays to a card for the purpose of calculating salary sum locally. Pass the computed `total`.

## E) Risk Checklist

| Risk | Detection | Mitigation |
| :--- | :--- | :--- |
| **Logic Drift** | Cap Sheet says $150M, Trade Machine says $148M. | **Validation Matrix** comparisons. |
| **Performance** | `computeTeamCapTotals` running too often (render loop). | Use React Profiler / `useMemo` on the computation. |
| **Missing "World" Context** | SSOT assumes a World exists but consumer has none. | Ensure SSOT fallback logic handles "Base Only" inputs gracefully. |

## F) Validation Matrix

*(To be filled during execution)*

| Metric | Cap Sheet UI | Trade Machine Tiles | TradeTeamCard |
| :--- | :--- | :--- | :--- |
| **playersTotal** | Matches SSOT | Matches SSOT | Matches SSOT |
| **deadMoneyTotal** | Matches SSOT | Matches SSOT | Matches SSOT |
| **capHoldsTotal** | Matches SSOT | Matches SSOT | Matches SSOT |
| **totalCapAllocations** | Matches SSOT | Matches SSOT | Matches SSOT |
| **deltas (Cap Space)** | Matches SSOT | Matches SSOT | Matches SSOT |

**Verification Method:**

1. Open Cap Sheet for a team (e.g. LAL, 2025-26). Record numbers.
2. Open Trade Machine. Add the same team. Record numbers on detailed card.
3. **All numbers must be identical.**
