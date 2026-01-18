/\*\*

- FILE: docs/architect/return-packages/2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_4_SIGNING_TERMS_AND_RAISES.md
- PURPOSE: Return package for Phase 4 signing terms + raise enforcement in cap sheet pipeline validation.
- OWNERSHIP: Feature: architect/cap-sheet validation
-
- HISTORY:
- - 2026-01-17: Created by plan `plans/_archive/cap-sheet-contract-rules-phase-4-signing-terms-2026-01-17/plan.md`, chunk_n/a
-
- LINKS:
- - Plan: plans/_archive/cap-sheet-contract-rules-phase-4-signing-terms-2026-01-17/plan.md
- - Latest Chunk: n/a (no chunks used)
    \*/

# 2026-01-17 Cap Sheet Contract Rules Phase 4 - Signing Terms + Raises

## 1) Summary of Changes

- Added Salary Engine signing terms helper to derive max years, raise caps, and engine max first-year constraints in `validateSigning`.
- Added new hard-block rule IDs for Salary Engine signing term violations.
- Added signing term/raise tests and updated contract-years tests to expect the new engine-driven rule.

## 2) New Rule IDs + Enforcement Logic

- `signing_terms_invalid`
  - Trigger: Salary Engine provides `maxYears` and `contractYears > maxYears`.
  - Enforcement: `validateSigningTermsAndRaises()` pushes a hard-block violation with Salary Engine max-year context.
  - Fallback: If no engine `maxYears`, Phase 2 exception limits (`contract_years_invalid`) remain active.

- `signing_raise_invalid`
  - Trigger: Salary Engine provides `raisePercentage` and any year-to-year raise exceeds the allowed cap.
  - Enforcement: `validateSigningRaises()` checks `salary` first, then `capHit` fallback; skips MINIMUM and non-standard contracts.

- Salary Engine max first-year overlay (existing rule `first_year_max_invalid`)
  - Trigger: Engine provides `maxFirstYearSalary` and first-year salary or cap hit exceeds it.
  - Enforcement: Applied in addition to Phase 2.5 exception caps; MINIMUM exactness rule remains intact.

## 3) Evidence: Salary Engine Terms Used

**Call Site**

- File: `src/features/architect/utils/capLegalityValidation.js`
- Function: `validateSigning()`

```javascript
const signingTerms = !isTwoWay
  ? getSigningTermsForPlayer({ team, player, contract, year, signedUsing })
  : null;
const engineSigningTerms =
  signingTerms?.source === 'salary_engine' ? signingTerms : null;

const termsValidation = validateSigningTermsAndRaises({
  contract,
  signingTerms: engineSigningTerms,
  mechanism: signingMechanism,
});
violations.push(...termsValidation.violations);
```

**Sample `signingTerms` Shape**

```typescript
const signingTerms = {
  maxYears: 4,
  minYears: 1,
  raisePercentage: 0.05,
  maxFirstYearSalary: 14_104_000,
  mechanism: 'FULL_MLE',
  source: 'salary_engine',
  notes: 'Bird rights: Full Bird | Exception override: FULL_MLE',
};
```

## 4) Files Changed

| File | Changes |
|------|---------|
| `src/features/architect/utils/capLegalityValidation.js` | Added Salary Engine signing terms helper, raise validation helper, new rule IDs, and wiring in `validateSigning` for engine max years/raises/first-year caps. |
| `tests/architect/capLegalityValidation.test.js` | Added Phase 4 signing terms/raises tests and updated contract-years assertions to expect engine-driven rule IDs. |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added Phase 4 rules to validation map + hard-block list, noted engine authority for signing guardrails, added changelog entry. |
| `plans/_archive/cap-sheet-contract-rules-phase-4-signing-terms-2026-01-17/plan.md` | Execution plan for Phase 4 signing terms + raises. |
| `docs/architect/return-packages/2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_4_SIGNING_TERMS_AND_RAISES.md` | Return package for Phase 4 (this document). |

## 5) Tests

### Command

```bash
npm test -- --run tests/architect/capLegalityValidation.test.js
```

### Results

```
✓ tests/architect/capLegalityValidation.test.js  (62 tests) 79ms

Test Files  1 passed (1)
     Tests  62 passed (62)
```

### New/Updated Tests

| Test Name | Purpose |
|-----------|---------|
| `blocks signing_raise_invalid when raise exceeds engine percentage` | Confirms raise caps block when above Salary Engine raise percentage. |
| `allows raises at the exact engine boundary` | Confirms boundary raises are permitted. |
| `blocks signing_terms_invalid when engine maxYears is lower than fallback` | Confirms engine max years overrides fallback limits. |
| `does not enforce raise rule when engine terms are unavailable` | Confirms raise enforcement is skipped without engine terms. |
| `confirms signing term rules are HARD_BLOCK rules` | Ensures new rule IDs are in `HARD_BLOCK_RULES`. |

## 6) Master Doc Updates + Changelog Entry

- Validation Map: added `signing_terms_invalid` and `signing_raise_invalid` entries.
- Hard Block list: added new rule IDs.
- Note added that signing guardrails are pipeline-authoritative via Salary Engine terms when available.
- Changelog: added **Contract Rules Phase 4** entry describing the signing-terms wiring.

## 7) STOP Conditions

None encountered.
