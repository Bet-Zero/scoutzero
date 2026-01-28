# CAP SHEET CONTRACT RULES PHASE 5 — Guarantees/Options/CapHit Correctness

**Date:** 2026-01-18  
**Status:** ✅ Complete

---

## 1. Summary of Changes

Implemented pipeline-authoritative validation for contract row schema correctness:

- **3 new hard block rules** added to pipeline validation
- **4 validation helpers** created for salary rows, guarantees, options, and contract aggregation
- **Wired `validateContractRows`** into `validateSigning` for all contract types
- **14 new tests** added covering all validation scenarios
- **Policy decisions** documented for normalize vs hard-block

---

## 2. New Rule IDs

| Rule ID | Location | Description |
|---------|----------|-------------|
| `contract_row_schema_invalid` | `capLegalityValidation.js:validateSigning` | Blocks contracts with negative salary/capHit or missing season |
| `contract_guarantee_invalid` | `capLegalityValidation.js:validateSigning` | Blocks contradictory guarantee fields (e.g., `guaranteedAmount` > `salary`) |
| `contract_option_invalid` | `capLegalityValidation.js:validateSigning` | Blocks invalid option enum values (must be "Team Option", "Player Option", or null) |

---

## 3. Policy Decisions

| Mismatch Type | Policy | Rationale |
|---------------|--------|-----------|
| Negative `salary` | **Hard Block** | Invalid per CBA, could corrupt data |
| Negative `capHit` | **Hard Block** | Invalid per CBA |
| Missing `season` | **Hard Block** | Cannot determine time context |
| `guaranteedAmount` > `salary` | **Hard Block** | Logically impossible partial guarantee |
| `guaranteed=false` with `guaranteedAmount > 0` | **Hard Block** | Contradictory state |
| `optionUsed` boolean when `option=null` | **Normalize to null** | Safe cleanup per existing normalization |
| Invalid `option` enum value | **Hard Block** | Unknown option type cannot be processed |
| `capHit` ≠ `salary` | **Allowed** | Legitimate for incentives; apron projection uses `capHit` |

---

## 4. Validation Helper Functions

```javascript
// Per-row validation
validateSalaryRowSchema(row, index)     → {valid, violation}
validateGuaranteesPolicy(row, index)    → {valid, violation}
validateOptionsPolicy(row, index)       → {valid, violation, normalize}

// Aggregator
validateContractRows(contract)          → {violations: [], warnings: [], hasNormalizableOptions}
```

**Wiring:** `validateContractRows` is called in `validateSigning` after exception eligibility check, before roster checks. All contract types (including two-way) are validated for schema issues.

---

## 5. Files Changed

| File | Change Type |
|------|-------------|
| `src/features/architect/utils/capLegalityValidation.js` | Added 3 hard block rules, 4 validation helpers, wired into `validateSigning` |
| `tests/architect/capLegalityValidation.test.js` | Added 14 Phase 5 tests |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Updated Validation Map, Hard Block Rules, Changelog |

---

## 6. Tests Added (14 tests)

1. `blocks negative salary in contract row`
2. `blocks negative capHit in contract row`
3. `does not block when capHit is missing (defaults to salary)`
4. `blocks missing season in contract row`
5. `blocks guaranteedAmount > salary`
6. `blocks guaranteed=false with positive guaranteedAmount`
7. `blocks invalid option enum value`
8. `flags optionUsed normalization when option is null but optionUsed is boolean`
9. `allows valid Team Option and Player Option values`
10. `confirms contract_row_schema_invalid is a HARD_BLOCK rule`
11. `confirms contract_guarantee_invalid is a HARD_BLOCK rule`
12. `confirms contract_option_invalid is a HARD_BLOCK rule`
13. `blocks negative salary via validateSigning integration`
14. `validates apron projection uses capHit when capHit differs from salary`

### Test Command + Output

```bash
npm test -- --run tests/architect/capLegalityValidation.test.js

 ✓ tests/architect/capLegalityValidation.test.js (82)
   ✓ Phase 5 - Contract Row Schema Validation (14)
 Test Files  1 passed (1)
      Tests  82 passed (82)
   Duration  7.86s
```

---

## 7. Build Command + Output

```bash
npm run build

vite v4.5.14 building for production...
✓ 2926 modules transformed.
✓ built in 51.00s
Exit code: 0
```

---

## 8. Stop-Condition Notes

**None.** All implementation completed successfully:

- capHit is used consistently for apron projection (confirmed at line 1598)
- guaranteedAmount semantics are clear: partial guarantee amount ≤ salary
- Contract row season keys are consistent string format

---

## 9. Master Doc Updates

| Section | Change |
|---------|--------|
| 5.2 Validation Map | Added 3 new rows for Phase 5 rules |
| 5.3 Hard Block Rules | Added 3 new bullets for Phase 5 rules |
| 10 Change Log | Added Phase 5 entry dated 2026-01-18 |

---

## 10. Phase 4.5 Ambiguity Fix

**Verified:**

1. **`mechanism` vs `rightsType`:** The engine terms field `mechanism` at line 1305 contains Bird rights type (e.g., "Full Bird Rights") which is correct. The code uses this consistently for violation messages. No naming conflict with exception bucket (`signedUsing`/`signingMechanism`).

2. **MINIMUM skip claim alignment:** Line 1301 confirms `signingMechanism !== 'MINIMUM'` gates engine max first-year enforcement. This matches Phase 4.5 documentation that MINIMUM is skipped for engine max enforcement (MINIMUM uses exactness check via `first_year_max_invalid` instead).

**No code changes required** — implementation already aligned with documentation.

---

## 11. Canonical Contract Row Schema (Reference)

Per Master Doc Section 9.1, the canonical `salariesByYear[]` entry:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `season` | `string` | Yes | Format: `"YYYY-YY"` (e.g., `"2025-26"`) |
| `salary` | `number` | Yes | Base salary in dollars, must be ≥ 0 |
| `capHit` | `number` | Yes | Defaults to `salary` if not specified, must be ≥ 0 |
| `guaranteed` | `boolean` | Yes | Whether year is guaranteed |
| `guaranteedAmount` | `number` | No | Partial guarantee, must be ≤ `salary` |
| `option` | `string \| null` | No | `"Team Option"`, `"Player Option"`, or `null` |
| `optionUsed` | `boolean \| null` | No | `true`=accepted, `false`=declined, `null`=no decision |

---

**END OF RETURN PACKAGE**
