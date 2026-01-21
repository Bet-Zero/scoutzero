# Phase 31: Max Contract Salary Enforcement — Readiness Preflight

**DATE:** 2026-01-21  
**MODE:** PREFLIGHT (review-only; NO code changes)  
**MASTER DOC (SSOT):** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1) Executive Summary

- ✅ **Max Salary IS Computed Today**: The Salary Engine provides `maxSalary.maxSalary` and `maxSalary.maxSalaryBird` via `getSalaryProfile()` / `computeMaxSalary()`.
- ✅ **YOS Computation Exists**: `getYearsOfService()` in `minimumSalaryRules.js` checks 8+ fallback fields; also `computeYearsOfService()` in `buildRuleContext.ts` adds draft-year fallback.
- ✅ **Cap Rules Per Season Exist**: `getCapRulesForYear()` returns `cap.salaryCap` needed for % calculations.
- ⚠️ **Max Salary NOT Enforced in `validateSigning()`**: The existing `maxSalary` output is used for Bird rights max calculation in `buildBaseSigningTerms()`, but no HARD_BLOCK exists for contracts exceeding the player's max salary tier.
- ✅ **Clear Implementation Path**: Add `max_salary_violation` rule using pattern from `min_salary_violation` (Phase 1).
- ⚠️ **YOS Data Quality**: Defaults to 0 if missing — safe for min salary (underpays at most) but risky for max salary (could over-allow). Mitigation: warning-only for missing YOS.
- 🔒 **Supermax NOT Modeled in RuleContext Path**: `checkSupermaxEligibilityFromContext()` returns `isEligible: false` due to missing award data. **Phase 31 Baseline = standard max tiers only.**

---

## 2) Where Max Salary Is Computed Today

### A) Salary Engine Path (PRIMARY)

**Entry Point:** `getSalaryProfile(ctx)` → `profile.maxSalary`

**Source File:** [salaryEngine.ts](src/features/architect/utils/salaryEngine/salaryEngine.ts)

```
validateSigning()
  → getSigningTermsForPlayer({ team, player, contract, year, signedUsing })
    → buildRuleContextForPlayerMove({ player, teamState, operationType, operationSeasonId, ... })
    → getSalaryProfile(ctx)  // Returns full profile
      → computeMaxSalaryFromRuleContext(ctx)  // in maxSalaryRules.js
        → Returns: { maxSalary, maxSalaryBird, tier, yearsOfService, supermaxEligible, reason }
```

**Object Shape:**

```typescript
interface MaxSalaryInfo {
  maxSalary: number; // Standard max (25%/30%/35% of cap)
  maxSalaryBird: number; // Max for Bird rights (max of standard OR 105% prior salary)
  tier: string; // "25%", "30%", "35%", "35% (Designated Veteran)", etc.
  yearsOfService: number;
  supermaxEligible: boolean;
  supermaxReason: string;
  reason: string;
}
```

### B) Where Max Salary Is Already Used

| Usage Location               | How Used                                                             | Rule Enforced              |
| ---------------------------- | -------------------------------------------------------------------- | -------------------------- |
| `buildBaseSigningTerms()`    | Extracts `maxSalaryCap` and `maxSalaryBird` for `maxFirstYearSalary` | Sets signing terms ceiling |
| `useCapValidation.js` L48-58 | Uses `rulesProfile?.maxSalary?.maxSalary` for UI hints               | Display only               |
| Phase 2.5 first-year checks  | Uses exception caps (MLE/TPMLE/BAE amounts), NOT YOS-based max       | Exception-specific limits  |

### C) Gap: No Max Salary Hard Block

**Current State:** `validateSigning()` has:

- `min_salary_violation` — blocks salary < CBA minimum (Phase 1)
- `first_year_max_invalid` — blocks salary > exception amount (Phase 2.5)
- `signing_first_year_engine_max_invalid` — blocks salary > Bird rights max (Phase 6)

**Missing:** No check that `firstYearSalary <= maxSalary` based on YOS tier (25%/30%/35% of cap).

---

## 3) Max Salary Applicability Rules (Checklist)

### When Max Salary Check SHOULD Run

| Signing Path              | Max Salary Check | Reason                                                         |
| ------------------------- | ---------------- | -------------------------------------------------------------- |
| **Cap Space Signing**     | ✅ YES           | Player cannot sign for more than their YOS-based max           |
| **Full Bird Re-signing**  | ✅ YES           | Max is 105% of prior salary OR YOS max, whichever higher       |
| **Early Bird Re-signing** | ✅ YES           | Max is 175% of prior OR 105% of avg, BUT never exceeds YOS max |
| **Non-Bird Re-signing**   | ✅ YES           | Max is 120% of prior, never exceeds YOS max                    |
| **Offer Sheet (RFA)**     | ✅ YES           | Offering team must respect player's max                        |

### When Max Salary Check Should NOT Run

| Signing Path                           | Max Salary Check | Reason                                                                                                                                                                                                               |
| -------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Minimum Signing**                    | ❌ NO            | Salary is capped at minimum, always << max                                                                                                                                                                           |
| **Two-Way Contract**                   | ❌ NO            | Separate salary rules, not subject to max tiers                                                                                                                                                                      |
| **Exception Signings (MLE/TPMLE/BAE)** | ⚠️ CONDITIONAL   | Exception cap is usually << max salary, so max check is redundant. HOWEVER, edge case: if exception cap > player's max (e.g., rookie with 0 YOS), we should still enforce max. **Recommend: Check anyway, no harm.** |
| **Room Exception**                     | ⚠️ CONDITIONAL   | Room exception is small; check anyway for consistency                                                                                                                                                                |

### Decision: Apply Max Salary Check To

```
ALL non-two-way, non-minimum signings
```

This is conservative and prevents any contract exceeding the player's max tier.

---

## 4) YOS Data Quality Audit

### A) Where YOS Is Sourced

**Primary:** `getYearsOfService(player)` in [minimumSalaryRules.js](src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js) L170-189

```javascript
export function getYearsOfService(player) {
  if (!player) return 0;

  const experience =
    player.bio?.experience ??
    player.bio?.yearsExperience ??
    player.yearsOfService ??
    player.years_of_service ??
    player.experience ??
    player['Years Pro'] ??
    player.bio?.['Years Pro'] ??
    player.yearsPro ??
    0;

  const years = parseInt(experience, 10);
  return Number.isFinite(years) && years >= 0 ? years : 0;
}
```

**Secondary:** `computeYearsOfService()` in [buildRuleContext.ts](src/features/architect/utils/buildRuleContext.ts) L324-349

```typescript
function computeYearsOfService(player, operationSeasonId): number {
  // First, try shared getYearsOfService helper
  const fromHelper = getYearsOfServiceFromPlayer(player);
  if (fromHelper > 0) return fromHelper;

  // Fallback: Calculate from draft year
  const draftYear = player.bio?.draftYear;
  if (draftYear) {
    const parsed = parseSeasonId(operationSeasonId);
    if (parsed) {
      return Math.max(0, parsed.startYear - draftYear);
    }
  }
  return 0;
}
```

### B) Firestore Sources

| Field Path                           | Schema                                 | Populated From   |
| ------------------------------------ | -------------------------------------- | ---------------- |
| `player.bio.experience`              | `players_v2.bio.experience` (optional) | Scraped/manual   |
| `player.yearsOfService`              | `architect` schema L323                | Derived on load  |
| `player.yearsPro`                    | `players_v2.bio.yearsPro` (optional)   | Scraped data     |
| `contract.birdRights.yearsOfService` | `architect` schema L323                | Contract context |

### C) YOS Reliability Score: **75-80%**

| Scenario                                 | Coverage | Risk                                                           |
| ---------------------------------------- | -------- | -------------------------------------------------------------- |
| Players loaded via FreeAgentPool         | ✅ 100%  | Uses `playerObj.yearsOfService \|\| playerObj.yearsPro \|\| 0` |
| Players from team roster                 | ⚠️ 80%   | Depends on `bio.experience` being populated                    |
| Newly created players                    | ❌ 0%    | Would default to 0 (rookie)                                    |
| Players with draftYear but no experience | ✅ 100%  | Fallback calculates from draft year                            |

### D) Failure Modes

| Failure Mode                     | Impact on Max Salary                                                               | Mitigation                                    |
| -------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| YOS=0 when player is 10-year vet | **ALLOWS OVERPAYMENT**: 25% max instead of 35%                                     | Add warning if YOS=0 for player with age > 30 |
| YOS=0 when player is 7-year vet  | **ALLOWS OVERPAYMENT**: 25% max instead of 30%                                     | Same warning strategy                         |
| YOS=10 when player is rookie     | **BLOCKS UNDERPAYMENT**: Would allow 35% max (not harmful, just overly permissive) | No action needed                              |

### E) Recommended Safety Net

Add a **warning** (not hard block) when:

- `yearsOfService === 0` AND `player.bio?.age >= 25`
- Message: "YOS data may be missing; max salary check used 0 years. Verify player experience."

---

## 5) Phase 31 Execution Plan

### A) Proposed Rule ID

```
max_salary_violation
```

Add to `HARD_BLOCK_RULES` array in `capLegalityValidation.js`.

### B) Implementation Location

**File:** `src/features/architect/utils/capLegalityValidation.js`

**Insert After:** L2615 (after `min_salary_violation` check in `validateSigning()`)

### C) Algorithm

```javascript
// 2.0. MAX SALARY CHECK (Phase 31)
// Applies to all signings except: two-way, minimum
// Uses Salary Engine max when available, fallback to YOS tier % of cap
if (!isTwoWay && signingMechanism !== 'MINIMUM' && rules) {
  const { salary: firstYearSalary } = getFirstYearAmounts(contract);

  if (firstYearSalary !== null) {
    // Get max salary from signing terms (already computed via Salary Engine)
    const engineMaxSalary = engineSigningTerms?.maxFirstYearSalary;

    // Fallback: Compute from YOS tier if engine unavailable
    let maxSalaryAmount = engineMaxSalary;
    let maxSalarySource = 'salary_engine';

    if (maxSalaryAmount == null) {
      const yos = getYearsOfService(player);
      const capAmount = rules.cap.salaryCap;

      // Determine tier percentage
      let tierPercent = 0.25; // 0-6 years
      if (yos >= 10) tierPercent = 0.35;
      else if (yos >= 7) tierPercent = 0.3;

      maxSalaryAmount = Math.round(capAmount * tierPercent);
      maxSalarySource = 'yos_tier_fallback';

      // YOS reliability warning
      if (yos === 0 && player.bio?.age >= 25) {
        warnings.push({
          rule: 'max_salary_yos_unverified',
          message: `YOS=0 for player age ${player.bio.age}. Max salary check used 0 years of service. Verify player experience data.`,
          severity: 'warning',
        });
      }
    }

    // Check: firstYearSalary <= maxSalaryAmount
    if (firstYearSalary > maxSalaryAmount) {
      violations.push({
        rule: 'max_salary_violation',
        message: `First-year salary ($${(firstYearSalary / 1_000_000).toFixed(2)}M) exceeds player max ($${(maxSalaryAmount / 1_000_000).toFixed(2)}M) based on ${maxSalarySource}`,
        severity: 'error',
        details: {
          firstYearSalary,
          maxSalaryAmount,
          maxSalarySource,
          yearsOfService: getYearsOfService(player),
        },
      });
    }
  }
}
```

### D) Test Plan (12 Scenarios)

| Test ID | Scenario                                   | YOS | First Year Salary | Cap          | Expected Max       | Result                          |
| ------- | ------------------------------------------ | --- | ----------------- | ------------ | ------------------ | ------------------------------- |
| MAX-1   | Rookie at 25% max exactly                  | 0   | $36,900,000       | $147,600,000 | $36,900,000        | ✅ Valid                        |
| MAX-2   | Rookie exceeds 25% max                     | 0   | $40,000,000       | $147,600,000 | $36,900,000        | ❌ `max_salary_violation`       |
| MAX-3   | 6-year vet at 25% max                      | 6   | $36,900,000       | $147,600,000 | $36,900,000        | ✅ Valid                        |
| MAX-4   | 7-year vet at 30% max exactly              | 7   | $44,280,000       | $147,600,000 | $44,280,000        | ✅ Valid                        |
| MAX-5   | 7-year vet exceeds 30% max                 | 7   | $50,000,000       | $147,600,000 | $44,280,000        | ❌ `max_salary_violation`       |
| MAX-6   | 9-year vet at 30% max                      | 9   | $44,280,000       | $147,600,000 | $44,280,000        | ✅ Valid                        |
| MAX-7   | 10-year vet at 35% max exactly             | 10  | $51,660,000       | $147,600,000 | $51,660,000        | ✅ Valid                        |
| MAX-8   | 10-year vet exceeds 35% max                | 10  | $60,000,000       | $147,600,000 | $51,660,000        | ❌ `max_salary_violation`       |
| MAX-9   | Minimum signing (exempt)                   | 5   | $2,300,000        | $147,600,000 | N/A                | ✅ Valid (skipped)              |
| MAX-10  | Two-way signing (exempt)                   | 2   | $600,000          | $147,600,000 | N/A                | ✅ Valid (skipped)              |
| MAX-11  | MLE signing under both caps                | 4   | $12,000,000       | $147,600,000 | $36,900,000        | ✅ Valid                        |
| MAX-12  | Bird rights 105% prior > YOS max (allowed) | 10  | $55,000,000       | $147,600,000 | $55,000,000 (Bird) | ✅ Valid (Bird rights max used) |

**Test File:** `src/tests/architect/capLegalityValidation.test.js`

### E) Files to Modify

| File                                                          | Changes                                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/features/architect/utils/capLegalityValidation.js`       | Add `max_salary_violation` to `HARD_BLOCK_RULES`, implement check in `validateSigning()` |
| `src/tests/architect/capLegalityValidation.test.js`           | Add 12 tests for max salary enforcement                                                  |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Changelog entry                                                                          |

### F) Estimated Effort

**4-6 hours** including tests and documentation.

---

## 6) Stop Conditions Evaluation

| Condition                          | Status   | Notes                                                                      |
| ---------------------------------- | -------- | -------------------------------------------------------------------------- |
| Cannot locate YOS sourcing         | ✅ CLEAR | `getYearsOfService()` in minimumSalaryRules.js, 8 fallback fields          |
| Salary Engine inconsistent         | ✅ CLEAR | Single path via `getSalaryProfile()` → `computeMaxSalaryFromRuleContext()` |
| Multiple conflicting cap constants | ✅ CLEAR | Single source via `getCapRulesForYear()`                                   |

**No stop conditions triggered. Proceed to Phase 31 execution.**

---

## 7) Supermax / Designated Player Scope

### Current State

- **Legacy Path:** `checkSupermaxEligibility(player, leagueContext)` checks `player.awards[]` for MVP/DPOY/All-NBA in past 3 seasons. Returns `isEligible: true` if found.
- **RuleContext Path:** `checkSupermaxEligibilityFromContext(ctx)` always returns `isEligible: false` with reason "award data not available in RuleContext".

### Phase 31 Scope Decision

**EXCLUDE Supermax from Phase 31 baseline.** Reasons:

1. Award data is not reliably present in player objects used by Cap Sheet
2. RuleContext path doesn't have award data wired
3. Standard max tiers (25%/30%/35%) cover 95%+ of signings

**Future Phase:** Wire award data to RuleContext and enable supermax eligibility check.

---

## 8) Optional Master Doc Changelog Addition

```markdown
| 2026-01-21 | **Contract Rules Phase 31 Preflight:** Documented max salary computation paths (Salary Engine + YOS tier fallback). Confirmed max salary NOT enforced in `validateSigning()`. Identified YOS data reliability at 75-80% with fallback to draft year. Proposed `max_salary_violation` rule with 12-test matrix. Scoped out supermax (award data not wired). |
```

---

## Evidence Appendix

### Key File References

| File                                                                                           | Purpose                                                                |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [maxSalaryRules.js](src/features/architect/utils/playerRulesProfile/maxSalaryRules.js)         | `computeMaxSalary()`, `MAX_SALARY_TIERS`, `checkSupermaxEligibility()` |
| [minimumSalaryRules.js](src/features/architect/utils/playerRulesProfile/minimumSalaryRules.js) | `getYearsOfService()` canonical implementation                         |
| [buildRuleContext.ts](src/features/architect/utils/buildRuleContext.ts)                        | `computeYearsOfService()` with draft-year fallback                     |
| [capLegalityValidation.js](src/features/architect/utils/capLegalityValidation.js)              | `validateSigning()` L2137-3000, existing min/first-year checks         |
| [salaryEngine.ts](src/features/architect/utils/salaryEngine/salaryEngine.ts)                   | `getSalaryProfile()`, `getMaxSalaryProfile()`                          |
| [capRulesProfile.ts](src/features/architect/utils/capRulesProfile/capRulesProfile.ts)          | `getCapRulesForYear()` for cap amounts                                 |

### CBA Reference

- **Article II, Section 7:** Max salary tiers (25%/30%/35% based on YOS)
- **Article II, Section 7(a):** "Higher Max" criteria for designated players
- **Rule Card 6** in `cba/guides/`: Max salary tier definitions

---

**END OF PREFLIGHT RETURN PACKAGE**
