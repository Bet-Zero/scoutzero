# Phase 8: RFA/QO Correctness + Re-Signing (Bird Rights) Guardrails

**Date:** 2026-01-18  
**Owner:** architect/cap-sheet validation

---

## 1. Summary of Changes

Phase 8 makes the pipeline authoritative for:

1. **RFA/UFA/QO free agency state correctness** — Enforces qualifying offer constraints
2. **Re-signing (Bird rights) enforcement** — Verifies team eligibility for Bird rights signings

### Key Changes

| Change | Description |
|--------|-------------|
| RFA QO Hard-Block | Upgraded RFA missing `qualifyingOffer` from warning to hard-block |
| Year Plausibility | Added validation that RFA/UFA `freeAgency.year` is in 2020-2040 range |
| RFA Signing Block | Conservative hard-block on signing any RFA player (offer sheet matching not yet implemented) |
| Re-signing Eligibility | Blocks Bird rights signings when `player.teamId` doesn't match or `birdRights.status` is None/renounced |

---

## 2. Audit Map: Free Agency State Creators/Consumers

### Creators (Where FA State Is Set)

| File | Function | Purpose |
|------|----------|---------|
| `contractParser.js` | `normalizeFreeAgency()` | Normalizes freeAgency object including qualifyingOffer |
| `contractNormalization.js` | `normalizeFreeAgency()` | Converts string→object format |
| `mutationPipeline.js` | `computeSigningResult()` | Sets freeAgency on new contracts |
| `useArchitectActions.ts` | `handleSignFreeAgent()` | Sets freeAgency year/type on signing |

### Consumers (Where FA State Is Validated/Used)

| File | Function | Purpose |
|------|----------|---------|
| `contractNormalization.js` | `validateFreeAgencyState()` | Validates freeAgency canonical shape, QO requirements |
| `capLegalityValidation.js` | `validateSigning()` | Calls validateFreeAgencyState, RFA block, eligibility check |
| `rfaRules.js` | `computeRFAStatus()` | Computes RFA status and QO amount |

---

## 3. Canonical Invariants + Policy Choices

### A. RFA Qualifying Offer (HARD BLOCK)

- If `freeAgency.type === 'RFA'`:
  - `qualifyingOffer` MUST be a finite number > 0
  - Rule: `rfa_missing_qualifying_offer`

### B. Non-RFA Qualifying Offer (WARNING)

- If `freeAgency.type !== 'RFA'` and `qualifyingOffer` is set:
  - Warn with `non_rfa_has_qualifying_offer` (data hygiene issue but not blocking)

### C. Year Plausibility (HARD BLOCK)

- If `freeAgency.type` is `RFA` or `UFA`:
  - `year` must be an integer in 2020-2040 range
  - Rule: `rfa_state_invalid`

### D. RFA Signing (HARD BLOCK - Conservative)

- Signing any player with `freeAgency.type === 'RFA'` is blocked
- Rule: `rfa_signing_not_supported`
- Rationale: RFA offer sheet matching logic is not implemented

### E. Re-signing Eligibility (HARD BLOCK)

- When signing with Bird rights (`rightsType` is FULL_BIRD/EARLY_BIRD/NON_BIRD):
  - `player.teamId` must match `team.teamCode`
  - `birdRights.status` must not be 'None' or 'renounced'
  - Rule: `resigning_ineligible`

---

## 4. Enforcement Details (Rule IDs)

| Rule ID | Type | Trigger |
|---------|------|---------|
| `rfa_state_invalid` | Hard Block | RFA/UFA year outside 2020-2040 |
| `rfa_missing_qualifying_offer` | Hard Block | RFA type but QO not finite > 0 |
| `rfa_signing_not_supported` | Hard Block | Signing player with freeAgency.type === 'RFA' |
| `resigning_ineligible` | Hard Block | Bird rights signing but player not eligible for this team |
| `non_rfa_has_qualifying_offer` | Warning | Non-RFA has qualifyingOffer set |

---

## 5. Files Changed

| File | Changes |
|------|---------|
| `src/features/architect/utils/capLegalityValidation.js` | Added 4 new HARD_BLOCK rules, RFA signing block, re-signing eligibility check |
| `src/features/architect/utils/contractNormalization.js` | Upgraded RFA missing QO to hard-block, added year plausibility check |
| `tests/architect/capLegalityValidation.test.js` | Added 13 new Phase 8 tests |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added Phase 8 rules and changelog |

---

## 6. Tests + Output

```
✓ tests/architect/capLegalityValidation.test.js (129 tests) 154ms

Test Files  1 passed (1)
     Tests  129 passed (129)
  Duration  5.48s
```

### New Test Cases (13 total)

1. `hard-blocks RFA with missing qualifyingOffer`
2. `hard-blocks RFA with qualifyingOffer of 0`
3. `hard-blocks RFA with invalid year (outside 2020-2040)`
4. `warns on non-RFA (UFA) having qualifyingOffer set`
5. `allows valid RFA with proper qualifyingOffer`
6. `hard-blocks signing an RFA player`
7. `allows signing UFA player (not RFA)`
8. `blocks re-signing when player teamId does not match signing team`
9. `blocks re-signing when player has None Bird rights status`
10. `confirms rfa_state_invalid is a HARD_BLOCK rule`
11. `confirms rfa_missing_qualifying_offer is a HARD_BLOCK rule`
12. `confirms rfa_signing_not_supported is a HARD_BLOCK rule`
13. `confirms resigning_ineligible is a HARD_BLOCK rule`

---

## 7. Build Output

```
✓ 2927 modules transformed
✓ built in 39.60s
Exit code: 0
```

---

## 8. Master Doc Updates

Added to Section 5.3 (Hard Block Rules):

- `rfa_state_invalid`
- `rfa_missing_qualifying_offer`
- `rfa_signing_not_supported`
- `resigning_ineligible`

Added changelog entry for Phase 8.

---

## Stop Conditions

**No stop conditions were encountered.** The codebase has:

- ✅ `freeAgency.type` with RFA/UFA values
- ✅ `freeAgency.qualifyingOffer` field in schema
- ✅ `player.teamId` / `player.contract.signingTeam` for eligibility
- ✅ `birdRights.status` for rights detection
