# CAP SHEET CONTRACT RULES — PHASE 10 RETURN PACKAGE

# RFA Workflow Guardrails (Home-Team vs Offer Sheet) + QO Enforcement Tightening

# DATE: 2026-01-18

---

## 1. Summary of Changes

Replaced the blunt "block all RFA signings" behavior with pipeline-authoritative differentiation:

| Scenario                                            | Behavior                                              |
| --------------------------------------------------- | ----------------------------------------------------- |
| **Offer Sheet Attempt** (non-home team signing RFA) | Hard-blocked with `rfa_offer_sheet_not_supported`     |
| **Home Team RFA Action** (team matches)             | Allowed through normal validation (QO still enforced) |
| **Unverifiable Team Identity**                      | Hard-blocked with `rfa_team_identity_unverifiable`    |
| **Suspicious QO** (> 3x last salary)                | Warning only: `rfa_qualifying_offer_suspicious`       |

---

## 2. Audit Findings

### Location of Old RFA Block

**File:** `src/features/architect/utils/capLegalityValidation.js`  
**Lines:** 1623-1635

```javascript
// 0.7. PHASE 8: RFA SIGNING BLOCK
const playerFreeAgency = player?.freeAgency || player?.contract?.freeAgency;
if (playerFreeAgency?.type === 'RFA') {
  violations.push({
    rule: 'rfa_signing_not_supported',
    message: 'Signing RFA players is not yet supported...',
    ...
  });
}
```

### Inputs Available at Trigger Point

- `team` - signing team object (`teamCode`, `code`)
- `player` - player being signed (`teamId`, `team_id`, `contract.signingTeam`, `freeAgency`)
- `contract` - new contract object
- `signedUsing` - exception bucket used
- `year` - signing year

### Normalization Helpers Used (Phase 9)

- `normalizeTeamRef(team)` → `"LAL"` (handles `"NBA:LAL"`, `"lal"`)
- `normalizePlayerTeamRef(player)` → `"LAL"` (extracts from teamId, team_id, etc.)

---

## 3. New Rule IDs

### Hard Block Rules

| Rule ID                          | Trigger                                                                      | Payload                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `rfa_offer_sheet_not_supported`  | `player.freeAgency.type === 'RFA'` AND normalized player team ≠ signing team | `normalizedPlayerTeam`, `normalizedSigningTeam`, `freeAgency.year`, `qualifyingOffer` |
| `rfa_team_identity_unverifiable` | RFA signing where player OR team refs cannot be normalized                   | `rawSigningTeamRef`, `rawPlayerTeamRef`, `freeAgency`                                 |

### Warning Rules

| Rule ID                           | Trigger                                         | Payload                                      |
| --------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| `rfa_qualifying_offer_suspicious` | RFA with `qualifyingOffer > lastYearSalary * 3` | `qualifyingOffer`, `lastYearSalary`, `ratio` |

### Removed Rules

| Rule ID                     | Reason                                 |
| --------------------------- | -------------------------------------- |
| `rfa_signing_not_supported` | Replaced by differentiated rules above |

---

## 4. Decision Logic: Home Team vs Offer Sheet

```
IF player.freeAgency.type === 'RFA':
  normalizedSigningTeam = normalizeTeamRef(team)
  normalizedPlayerTeam = normalizePlayerTeamRef(player)

  IF normalizedSigningTeam === null OR normalizedPlayerTeam === null:
    → HARD BLOCK: rfa_team_identity_unverifiable

  ELSE IF normalizedPlayerTeam !== normalizedSigningTeam:
    → HARD BLOCK: rfa_offer_sheet_not_supported

  ELSE:
    → ALLOWED: Continue through normal validation
    → QO checks, re-signing eligibility still enforced
```

---

## 5. Files Changed

| File                                                          | Change                                                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/features/architect/utils/capLegalityValidation.js`       | Replaced RFA block (lines 1623-1665); updated `HARD_BLOCK_RULES` and `SOFT_WARNING_RULES` |
| `src/features/architect/utils/contractNormalization.js`       | Added QO suspicious warning to `validateFreeAgencyState()`                                |
| `tests/architect/capLegalityValidation.test.js`               | Updated old Phase 8 tests; added 15 new Phase 10 tests                                    |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Updated rule IDs and changelog                                                            |

---

## 6. Tests

### New Tests Added (Phase 10 Suite)

1. `hard-blocks RFA player signed by non-home team (offer sheet attempt)`
2. `includes correct payload in offer sheet violation`
3. `allows home team to sign their own RFA player (no offer sheet rule)`
4. `still enforces QO hard-block even for home team RFA`
5. `hard-blocks RFA signing when player team ref is missing`
6. `hard-blocks RFA signing when signing team ref is missing`
7. `includes raw refs in unverifiable violation payload`
8. `warns when QO is greater than 3x last salary`
9. `includes correct payload in suspicious QO warning`
10. `does NOT warn when QO is 3x or less of last salary`
11. `does NOT warn when lastYearSalary is not provided`
12. `confirms rfa_offer_sheet_not_supported is a HARD_BLOCK rule`
13. `confirms rfa_team_identity_unverifiable is a HARD_BLOCK rule`
14. `confirms rfa_signing_not_supported is NO LONGER in HARD_BLOCK_RULES`

### Updated Phase 8 Tests

- `hard-blocks signing an RFA player` → now tests offer sheet block with `teamId: 'GSW'`
- Hard block rule confirmation updated for new rule IDs

### Test Output

```
npm test -- --run tests/architect/capLegalityValidation.test.js

✓ tests/architect/capLegalityValidation.test.js (152 tests) 206ms

Test Files  1 passed (1)
     Tests  152 passed (152)
```

---

## 7. Build Output

```
npm run build

✓ 2927 modules transformed
✓ built in 46.92s
Exit code: 0
```

---

## 8. Master Doc Updates

### Rule IDs Updated

```diff
- * `rfa_signing_not_supported` - Signing RFA players blocked
+ * `rfa_offer_sheet_not_supported` - Phase 10: Signing RFA from non-home team
+ * `rfa_team_identity_unverifiable` - Phase 10: RFA signing where identity cannot be verified

Soft Warning Rules:
+ * `rfa_qualifying_offer_suspicious` - Phase 10: QO > 3x last salary
```

### Changelog Entry

> **Contract Rules Phase 10:** RFA Workflow Guardrails (Home-Team vs Offer Sheet). Replaced blunt `rfa_signing_not_supported` block with differentiated logic: (1) `rfa_offer_sheet_not_supported` hard-blocks non-home team RFA signings (offer sheet matching required). (2) `rfa_team_identity_unverifiable` hard-blocks when team identity cannot be normalized. (3) Home-team RFA signings allowed through normal validation (QO still enforced). Added `rfa_qualifying_offer_suspicious` warning when QO > 3x last salary. Uses Phase 9 team normalizers for identity comparison. 15 new tests added.

---

### Phase 10.1 — World Validation

- World validation passed under emulators using anonymous auth + world ownership gating.

---

## END
