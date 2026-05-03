# Phase 38 Return Package: Architect Second Apron Semantics Unification

## 1. Per-File Analysis

### `src/features/architect/utils/tradeHelpers.js`

- **Context**: `getApronStatus` (Line 283)
- **Code**: `if (secondApron && salary >= secondApron) return '2nd Apron';`
- **Intent**: Classification / UI Labeling.
- **Verdict**: **INCORRECT**. The CBA defines a "Second Apron Team" as one where salary strictly *exceeds* the apron (`>`).
- **Recommended Comparator**: `>` (Strict).
- **Exact Edits**: Change `>=` to `>` or delegate to SSOT.

### `src/features/architect/utils/capLegalityValidation.js`

- **Context**: `getHardCapStatus` (Line 439)
- **Code**: `if (currentCapHit >= secondApron) { return { isHardCapped: true ... } }`
- **Intent**: Ceiling / Violation Check.
- **Verdict**: **CONCEPTUALLY SUSPECT**.
  - *Issue*: This logic treats "reaching" the second apron as being "Hard Capped", implying you cannot go further. While the 2nd Apron triggers a hard cap *if* exceptions are used, the apron itself is just a tax boundary.
  - *Implication*: If this rule effectively means "You are now subject to the hard cap at this level," it might be acceptable. If it means "You have violated the hard cap," it is wrong (landing on it is fine unless you tried to go over).
- **Recommended Comparator**: Align with standard "Violation" logic: `>` (Strictly Over). If we want to flag that they are "at the limit", we should use a status label, not a "Hard Capped" boolean that might block valid operations.

### `src/features/architect/utils/capUtils.js` (Legacy)

- **Context**: `getApronStatus` (Line 7)
- **Code**: `if (teamSalary >= secondApron) ...`
- **Intent**: Classification.
- **Verdict**: **INCORRECT**.
- **Recommended Comparator**: `>` (Strict).

## 2. Duplicate Cap Utils Inventory

### A. Legacy Module

**Path**: `src/features/architect/utils/capUtils.js`

- **Exports**:
  - `getApronStatus(teamSalary, capSettings)`
  - `getAllowableIncomingMargin(team, capSettings)` (Deprecated)
- **Usage**:
  - Minimal/Legacy usage. Most modern features import from `capHelpers.js` or `tradeHelpers.js`.

### B. Modern SSOT Module

**Path**: `src/features/architect/utils/tradeMachine/utils/capUtils.js`

- **Exports**:
  - `isFirstApronTeam(team, capSettings)`
  - `isSecondApronTeam(teamLike, capSettings)` (Correct Strict `>`)
  - `getTeamApronStatus(team, capSettings)` (Correct Strict `>`)
  - `normalizeCaps(raw)`
  - `resolvePayroll(team)`
- **Usage**:
  - `TradeReceiptPanel.jsx`
  - `CapImpactTiles.jsx`
  - All Trade Machine Rules (`validateSalaryMatching`, `hardCapValidation`, etc.)
  - `schemaAdapter.js`

## 3. Proposed Consolidation Approach

**Recommendation: Option B (Modern is SSOT)**
We will maintain the Trade Machine's utility file as the Single Source of Truth for apron classification, as it already implements the correct strict semantics.

- **Strategy**:
    1. Keep `src/features/architect/utils/tradeMachine/utils/capUtils.js` as the authoritative definition.
    2. Rewrite the legacy `src/features/architect/utils/capUtils.js` to simply import and re-export functions from the SSOT.
    3. Map the legacy `getApronStatus` to the SSOT's `getTeamApronStatus`.

- **Pros**:
  - Zero "Blast Radius": Checksum-safe for files that import the legacy path; they get corrected logic without changing import paths.
  - Unifies logic instantly.
  - Deprecates the "Zombie" file content while keeping the file interface.

- **Blast Radius**: Low. Only logic changes (fixing the bug), no structural/dependency breaks.

## 4. Proposed Execution Plan (Phase 38)

### Files to Change

1. **`src/features/architect/utils/capUtils.js`**
    - Refactor to re-export from `tradeMachine/utils/capUtils.js`.
2. **`src/features/architect/utils/tradeHelpers.js`**
    - Update `getApronStatus` to use strict `>` (or call SSOT).
3. **`src/features/architect/utils/capLegalityValidation.js`**
    - Update `getHardCapStatus` to use strict `>` for the check.

### Exact Changes Summary

- **Consolidation**: Legacy `capUtils.js` becomes a shell re-exporting the modern utils.
- **Semantics**: All `apron >= limit` checks converted to `apron > limit` for classification/status.
- **Validation**: Hard cap check explicitly moves to `>` to allow landing exactly on the apron.

### Test Plan

1. **Run Existing Tests**: `src/tests/architect/capLegalityValidation.test.js` to ensure no regression in hard cap blocking.
2. **New Guardrail Test**: Create `src/tests/architect/apronSemantics.test.js`.
    - Test Case: Team Salary = $189.5M, Second Apron = $189.5M.
    - Expectation: `isSecondApronTeam` returns `false`. `getHardCapStatus` returns `false` (or `null`).
    - Test Case: Team Salary = $189.51M.
    - Expectation: Returns `true`.
