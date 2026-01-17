# CAP RULES PROFILE MASTER DOC

> **SSOT Foundation Document**
> **Last Updated:** 2026-01-17
> **Status:** PREFLIGHT (Investigation Complete)

---

## 1. Purpose & Scope

This document establishes a **Single Source of Truth (SSOT)** for all cap rules, CBA constants, and season-specific thresholds used by:

- `computeTeamCapTotals` (cap allocations computation)
- `capLegalityValidation` (signing/waive/extend validations)
- Trade Machine (`tradeValidator`, `salaryMatchingRules`)
- UI Components (`CapSheet`, `TradeTeamCard`, `ExceptionTracker`)

### Goals

1. Eliminate multiple definitions of the same constant in different files
2. Ensure tests use the same source as runtime logic
3. Provide a canonical API for retrieving cap rules by season
4. Enable future migration to a database-driven rules source

### Out of Scope

- UI changes
- Trade validator salary-matching rules (unless they consume cap constants)
- Draft pick valuation

---

## 2. Definitions

| Term | Definition |
|------|------------|
| **yearKey** | Season END year (e.g., `2025` for the 2024-25 season) |
| **seasonKey** | Season string format (e.g., `"2024-25"`) |
| **Standard Roster** | Players on 15-man contracts (excludes two-way) |
| **Two-Way Contract** | Contracts allowing G League assignment (max 3 per team) |
| **Hard Cap** | Ceiling that cannot be exceeded once triggered (first/second apron) |
| **Incomplete Roster Charge** | Cap charge for teams below 14 standard roster players |

---

## 3. Canonical Concepts & Current Sources (Inventory Table)

### 3.1 Roster Requirements

| Constant/Concept | Current Value(s) Found | File(s) | Consumer(s) | Notes/Conflicts |
|------------------|------------------------|---------|-------------|-----------------|
| MIN_STANDARD_ROSTER | **14** | `cbaConstants.js` (ROSTER_REQUIREMENTS) | `computeTeamCapTotals`, tests | **CANONICAL** |
| MIN_ROSTER | **14** | `capLegalityValidation.js` (local const) | `validateWaive`, `validateSigning` | ⚠️ DUPLICATE |
| MIN_ROSTER | **14** | `rosterValidation.js` (local const) | Trade validation | ⚠️ DUPLICATE |
| MIN_ROSTER_SIZE | **12** | `seasonManager.js` (local const) | Empty roster charges | ⚠️ DIFFERENT VALUE - different use case |
| MIN_ROSTER_SIZE | **13** | `basicArchitectUtils.js` (local const) | Grace period minimum | ⚠️ DIFFERENT VALUE |
| GRACE_MIN_ROSTER | **13** | `capLegalityValidation.js`, `rosterValidation.js` | Grace period validation | ⚠️ DUPLICATE |
| OFFSEASON_MIN_ROSTER | **13** | `cbaConstants.js` (ROSTER_REQUIREMENTS) | Not consumed | Available but unused |
| MAX_STANDARD_ROSTER | **15** | `cbaConstants.js` (ROSTER_REQUIREMENTS) | Trade validation | **CANONICAL** |
| MAX_ROSTER | **15** | `capLegalityValidation.js`, `rosterValidation.js` | Local validation | ⚠️ DUPLICATE |
| MAX_TWO_WAY_CONTRACTS | **3** | `cbaConstants.js` (ROSTER_REQUIREMENTS) | Re-exported | **CANONICAL** |
| MAX_TWO_WAY | **3** | `capLegalityValidation.js`, `rosterValidation.js` | Local validation | ⚠️ DUPLICATE |
| MAX_TWO_WAY_PLAYERS | **3** | `cbaConstants.js` (feature-level) | `rosterUtils.js` | ⚠️ DUPLICATE (deprecated) |

### 3.2 Salary Cap / Apron / Tax Lines

| Constant/Concept | Current Value(s) Found | File(s) | Consumer(s) | Notes/Conflicts |
|------------------|------------------------|---------|-------------|-----------------|
| salaryCap (2024-25) | **$141,000,000** | `capProjections.js` (`cap` field) | UI, `capSettingsProvider` | **PRIMARY SOURCE** |
| SALARY_CAP (2024-25) | **$140,588,000** | `CBA_THRESHOLDS` in `cbaConstants.js` | `getThresholdForSeason` | ⚠️ CONFLICT: $412K difference |
| firstApron (2024-25) | **$179,000,000** | `capProjections.js` | UI, `capSettingsProvider` | **PRIMARY SOURCE** |
| FIRST_APRON (2024-25) | **$178,132,000** | `CBA_THRESHOLDS` in `cbaConstants.js` | `getThresholdForSeason` | ⚠️ CONFLICT: $868K difference |
| secondApron (2024-25) | **$190,000,000** | `capProjections.js` | UI, `capSettingsProvider` | **PRIMARY SOURCE** |
| SECOND_APRON (2024-25) | **$188,938,000** | `CBA_THRESHOLDS` in `cbaConstants.js` | `getThresholdForSeason` | ⚠️ CONFLICT: $1.06M difference |
| luxuryTax (2024-25) | **$171,000,000** | `capProjections.js` (`tax` field) | UI, `capSettingsProvider` | **PRIMARY SOURCE** |
| LUXURY_TAX (2024-25) | **$170,818,000** | `CBA_THRESHOLDS` in `cbaConstants.js` | `getThresholdForSeason` | ⚠️ CONFLICT: $182K difference |
| EMERGENCY_FALLBACK | **$141M cap** | `capSettingsProvider.js` (hardcoded) | Fallback only | Emergency use |

### 3.3 Minimum Salary Tables

### 3.3 Minimum Salary Tables

| Constant/Concept | Current Value(s) Found | File(s) | Consumer(s) | Notes/Conflicts |
|------------------|------------------------|---------|-------------|-----------------|
| MIN_SALARY_ROOKIE (2024-25) | **$1,119,563** | `capProjections.js` | `capRulesProfile`, `computeTeamCapTotals` | **CANONICAL** |
| MIN_SALARY_ROOKIE | **$1,119,563** | `CBA_THRESHOLDS` in `cbaConstants.js` | Legacy fallback | ⚠️ Deprecated source |
| MIN_SALARY | **$1,119,563** | `tradeHelpers.js` (hardcoded) | `TradeSalaryCalculator` | ⚠️ DUPLICATE |
| Minimum Salary Scale | Years of Service → Salary | `minimumSalaryScales.js` | `buildRuleContext`, `capHelpers` | More complete data |

> [!NOTE]
> `rookieMin` is now integrated into `capProjections.js` for all years (2024-2032). Values for 2026+ are projected with ~4% growth.

### 5. Conflicts & Decisions Needed

### Conflict 3: MIN_SALARY_ROOKIE Missing for Future Years - **RESOLVED**

**Files:**

- `capProjections.js`: Now contains `rookieMin` for confirmed years (2024-25, 2025-26).
- `capRulesProfile.ts`: Implements **Deterministic Projection Policy** for future years.

**Resolution:** Mixed approach.

- **Real Data:** Source from `capProjections.js` where `rookieMinSource: 'real'`.
- **Projection:** For missing years (2026+), `capRulesProfile` projects `rookieMin` based on Salary Cap YoY growth ratio.
  - Formula: `NewRookieMin = PrevRookieMin * (NewCap / PrevCap)`
- **Interface:** Exposed via `salaries.rookieMin` and `salaries.getMinimumForYOS(yos)`.

### 8. Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-17 | Claude | Initial preflight investigation complete |
| 2026-01-17 | Antigravity | **Phase 2 Execution**: Resolved `rookieMin` by extending `capProjections.js` for all years. Updated `capRulesProfile` validation. |
| 2026-01-17 | Antigravity | **Phase 3 Execution**: Implemented deterministic Min Salary Projection Policy (Cap Growth tied). Integrated `minimumSalaryScales` into `capRulesProfile` facade. |

### 3.4 Exception Limits (MLE/BAE)

| Constant/Concept | Current Value(s) Found | File(s) | Consumer(s) | Notes/Conflicts |
|------------------|------------------------|---------|-------------|-----------------|
| fullMLE (2024-25) | **$12,900,000** | `capProjections.js` | UI, hooks, `capSettingsProvider` | **CANONICAL** - multi-year |
| NON_TAXPAYER_MLE | **$12,860,000** | `CBA_THRESHOLDS` in `cbaConstants.js` | Not consumed | ⚠️ DIFFERENT VALUE |
| taxpayerMLE (2024-25) | **$5,000,000** | `capProjections.js` | UI, hooks | **CANONICAL** |
| TAXPAYER_MLE | **$5,204,000** | `CBA_THRESHOLDS` in `cbaConstants.js` | Not consumed | ⚠️ DIFFERENT VALUE |
| roomMLE (2024-25) | **$8,000,000** | `capProjections.js` | UI, hooks | **CANONICAL** |
| ROOM_MLE | **$8,008,000** | `CBA_THRESHOLDS` in `cbaConstants.js` | Not consumed | ⚠️ DIFFERENT VALUE |
| bae (2024-25) | **$4,700,000** | `capProjections.js` | UI, hooks | **CANONICAL** |
| BAE | **$4,189,000** | `CBA_THRESHOLDS` in `cbaConstants.js` | Not consumed | ⚠️ DIFFERENT VALUE |

> [!IMPORTANT]
> `capProjections.js` contains comprehensive multi-year data (2024-25 through 2031-32) and is the **de facto primary source** for runtime. `CBA_THRESHOLDS` contains more precise values for 2024-25 but is incomplete for other fields and years.

---

## 4. Consumer Wiring Map

### 4.1 computeTeamCapTotals

| Input | Constants Used | Source(s) Today | Risk |
|-------|----------------|-----------------|------|
| teamCapSheet | - | Firestore/hydrated | None |
| selectedYear | - | Prop | None |
| options.capProjections | salaryCap, firstApron, secondApron | `capSettingsProvider` → `capProjections.js` | Low |
| - | MIN_STANDARD_ROSTER | `cbaConstants.js` (ROSTER_REQUIREMENTS) | Low |
| - | MIN_SALARY_ROOKIE | `CBA_THRESHOLDS` (2024-25 only) | **HIGH** - no future year data |

### 4.2 capLegalityValidation

| Input | Constants Used | Source(s) Today | Risk |
|-------|----------------|-----------------|------|
| team, player, contract, year | - | Props | None |
| - | MIN_ROSTER, MAX_ROSTER | Local const (line 32-33) | ⚠️ Not using ROSTER_REQUIREMENTS |
| - | GRACE_MIN_ROSTER | Local const (line 34) | ⚠️ Not using ROSTER_REQUIREMENTS |
| - | MAX_TWO_WAY | Local const (line 35) | ⚠️ Not using ROSTER_REQUIREMENTS |
| year | capSettings (salaryCap, firstApron, secondApron) | `capHelpers.getCapSettings` AND `capSettingsProvider.getCapSettingsForYear` | ⚠️ Two sources |

### 4.3 rosterValidation.js (Trade Machine)

| Input | Constants Used | Source(s) Today | Risk |
|-------|----------------|-----------------|------|
| trade context | MIN_ROSTER, MAX_ROSTER | Local const (lines 8-9) | ⚠️ Not using ROSTER_REQUIREMENTS |
| - | GRACE_MIN_ROSTER | Local const (line 10) | ⚠️ Not using ROSTER_REQUIREMENTS |
| - | MAX_TWO_WAY | Local const (line 11) | ⚠️ Not using ROSTER_REQUIREMENTS |

### 4.4 capSettingsProvider

| Input | Constants Used | Source(s) Today | Risk |
|-------|----------------|-----------------|------|
| year | All cap/apron/MLE values | `capProjections.js` (default) | **Primary resolution layer** |
| providedCapSettings | Normalized values | User-provided override | Low |
| - | EMERGENCY_FALLBACK_2024_25 | Local hardcoded (line 54-63) | Low - only used when all else fails |

### 4.5 Tests

| Test File | Constants Used | Source(s) Today | Risk |
|-----------|----------------|-----------------|------|
| `incompleteRosterCharge.test.js` | MIN_STANDARD_ROSTER, MIN_SALARY_ROOKIE | `cbaConstants.js` (CBA_THRESHOLDS) | ✅ Correct source |
| `capSettingsProvider.test.js` | Various cap values | Test fixtures | ⚠️ May not match runtime |
| `tradeValidator.debug.js` | capProjections fixtures | Inline objects | ⚠️ Hardcoded test values |

---

## 5. Conflicts & Decisions Needed

### Conflict 1: Cap/Apron Values Differ Between Sources

**Files:**

- `capProjections.js`: `cap: 141_000_000`, `firstApron: 179_000_000`
- `cbaConstants.js` (CBA_THRESHOLDS): `SALARY_CAP: 140_588_000`, `FIRST_APRON: 178_132_000`

**Values Differ By:** $412K–$1.06M

**Recommendation:** Use `capProjections.js` as canonical.

- **Rationale:**
  - `capProjections` is already the de facto source for the UI and `capSettingsProvider`
  - Contains multi-year data (through 2031-32)
  - `CBA_THRESHOLDS` is incomplete (only 2024-25 + partial 2025-26)
- **Migration:** Update `CBA_THRESHOLDS` to match `capProjections` values, or deprecate `CBA_THRESHOLDS` cap values entirely.

### Conflict 2: Roster Constants Defined Locally in Multiple Files

**Files:**

- `capLegalityValidation.js`: Lines 32-35 (`MIN_ROSTER = 14`, etc.)
- `rosterValidation.js`: Lines 8-11 (`MIN_ROSTER = 14`, etc.)
- `cbaConstants.js`: `ROSTER_REQUIREMENTS.MIN_STANDARD_ROSTER = 14` (canonical)

**Values:** Consistent (14/15/3) but duplicated

**Recommendation:** Migrate all consumers to use `ROSTER_REQUIREMENTS` from `cbaConstants.js`.

- **Rationale:** Already canonical, already re-exported, no migration of values needed.
- **Risk:** Low - values match, just need to update imports.

### Conflict 3: MIN_SALARY_ROOKIE Missing for Future Years

**Files:**

- `CBA_THRESHOLDS` in `cbaConstants.js`: Only contains `MIN_SALARY_ROOKIE: 1_119_563` for 2024-25
- `tradeHelpers.js`: Hardcoded `MIN_SALARY = 1_119_563`
- `computeTeamCapTotals.js`: Falls back to 2024-25 value (line 86)

**Recommendation:** Extend `capProjections.js` to include `minSalaryRookie` per year, or create a separate `minimumSalaryByYear` object in `cbaConstants.js`.

- **Decision Fork:**
  - **Option A:** Add `minSalaryRookie` field to each year in `capProjections.js`
    - *Pro:* Keeps all per-year data in one place
    - *Con:* Mixes cap thresholds with salary tables
  - **Option B:** Create `MIN_SALARY_BY_YEAR` object in `cbaConstants.js`
    - *Pro:* Separates salary table from cap thresholds
    - *Con:* Another source to maintain

### Conflict 4: MLE/BAE Values Differ Between Sources

**Files:**

- `capProjections.js`: fullMLE = $12,900,000
- `CBA_THRESHOLDS`: NON_TAXPAYER_MLE = $12,860,000

**Recommendation:** Use `capProjections.js` as canonical (same reasoning as Conflict 1).

---

## 6. Proposed Canonical Interface

### 6.1 Function Signatures

```typescript
// File: src/features/architect/utils/capRulesProfile.js (NEW)

interface CapRulesProfile {
  // Roster Requirements (static across years for now)
  roster: {
    minStandard: number;      // 14
    maxStandard: number;      // 15
    gracePeriodMin: number;   // 13
    offseasonMin: number;     // 13
    maxTwoWay: number;        // 3
  };

  // Cap/Apron/Tax Lines (per-year)
  cap: {
    salaryCap: number;
    luxuryTax: number;
    firstApron: number;
    secondApron: number;
    floor: number;
  };

  // Exception Amounts (per-year)
  exceptions: {
    fullMLE: number;
    taxpayerMLE: number;
    roomMLE: number;
    bae: number;
  };

  // Minimum Salary Data (per-year)
  salaries: {
    rookieMin: number;        // Resolved 0 YOS minimum (Real or Projected)
    rookieMinSource: 'real' | 'projected' | 'reported' | 'unknown';
    getMinimumForYOS: (yos: number) => number; // Function to get value for any YOS
  };

  // Provenance Metadata (NEW 2026-01-17)
  _meta: {
    source: string;
    resolved: boolean;
    projectionMethod?: string;
    sourcesSummary: 'real' | 'reported' | 'projected' | 'unknown';
    sources: {
      cap: Record<string, string>;
      exceptions: Record<string, string>;
      salaries: { rookieMin: string };
    };
  };
}

/**
 * Get cap rules profile for a specific season.
 * This is the SINGLE SOURCE OF TRUTH for all cap/CBA constants.
 */
export function getCapRulesForYear(yearKey: number): CapRulesProfile;

/**
 * Get just roster requirements (static, not year-dependent).
 */
export function getRosterRequirements(): CapRulesProfile['roster'];
```

### 6.2 Ownership & Location

**Recommendation:** Create new file `src/features/architect/utils/capRulesProfile.js`

- Imports from `capProjections.js` for per-year cap/exception data
- Imports from `cbaConstants.js` (ROSTER_REQUIREMENTS) for roster rules
- Imports from `minimumSalaryScales.js` for salary data
- Exports unified interface

**Alternative:** Extend `capSettingsProvider.js` to include roster requirements and salary data.

- *Pro:* Already partly does cap resolution
- *Con:* Would need significant refactor; name implies "settings" not "rules"

---

## 7. Migration Plan Outline

### Phase 1: Consolidate Roster Constants (Low Risk)

**Goal:** All consumers use `ROSTER_REQUIREMENTS` from `cbaConstants.js`

**Changes:**

1. Update `capLegalityValidation.js` to import `ROSTER_REQUIREMENTS` and remove local consts
2. Update `rosterValidation.js` to import `ROSTER_REQUIREMENTS` and remove local consts
3. Verify `basearchitectUtils.js` and `seasonManager.js` use different values intentionally (document why)

**Stop Condition:** If any file uses a different numeric value intentionally, document the reason before proceeding.

### Phase 2: Unify Cap/Apron Constants (Medium Risk)

**Goal:** Single source for cap/apron values accessed via `capSettingsProvider`

**Changes:**

1. Update `CBA_THRESHOLDS` to match `capProjections.js` values (or deprecate)
2. Ensure all consumers go through `capSettingsProvider.getCapSettingsForYear`
3. Remove direct imports of `capProjections.js` in favor of provider

**Stop Condition:** If cap values differ between sources, verify which is correct against official NBA data before choosing canonical source.

### Phase 3: Add Missing Salary Data (Medium Risk)

**Goal:** `getMinSalaryForYear` returns accurate values for all supported years

**Changes:**

1. Add `minSalaryRookie` field to `capProjections.js` for years 2025-26 through 2031-32
2. Update `getMinSalaryForYear` to use this data
3. Remove hardcoded fallback

**Stop Condition:** If official rookie min salary data is unavailable for future years, document projection methodology.

### Phase 4: Create `getCapRulesForYear` Facade (Low Risk)

**Goal:** Single function that returns all cap/CBA data for a year

**Changes:**

1. Create `capRulesProfile.js` with proposed interface
2. Wire up to existing sources
3. Migrate `computeTeamCapTotals` to use `getCapRulesForYear`
4. Migrate `capLegalityValidation` to use `getCapRulesForYear`

**Stop Condition:** If any consumer needs data not in the profile, extend the interface before migrating that consumer.

### Phase 5: Test Alignment (Low Risk)

**Goal:** All tests use runtime sources (no hardcoded fixtures that differ)

**Changes:**

1. Update test fixtures to import from `capProjections.js` or `capRulesProfile.js`
2. Remove inline cap value fixtures
3. Add regression tests for value consistency

---

## 8. Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-17 | Claude | Initial preflight investigation complete |
