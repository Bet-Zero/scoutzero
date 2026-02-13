# T-2 + T-3 FILES TOUCHED

**Date:** 2026-02-05

---

## Source Changes (4 files)

| File | Lines Changed | Description |
|------|---------------|-------------|
| `src/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js` | -4 (else block removed), -1 (dead import) | T-2: Removed blanket current-year TPE block for 2nd-apron teams |
| `src/features/architect/utils/mutationPipeline.js` | +14 (extensionYearSet + map over existing rows) | T-3A: Mark overlapping original years as `voidedByExtension: true` |
| `src/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerContractMini.jsx` | +4 (flag in displaySeasons), +4 (voided render branch + row class) | T-3A: Dim + label voided year rows |
| `src/features/architect/tradeMachine/utils/entitlementWarnings.js` | -14 (Warning B block + flag + JSDoc line) | T-3B: Remove stale Stepien entitlement warning |

## Test Changes (3 files)

| File | Change | Tests |
|------|--------|-------|
| `tests/trade/secondApron_tpeBan.test.js` | Updated (1 test rewritten) | 3 total |
| `tests/architect/extension_voidedByExtension.test.js` | **New** | 3 |
| `tests/architect/PlayerContractMini.voidedByExtension.test.jsx` | **New** | 4 |

## Not Touched (confirmed)

- `mutationPipeline.js` lines outside `computeExtensionResult` — no changes
- `validateStepien.js` — enforcement logic untouched
- `basicRules.js` — prior-year TPE block and handcuffs enforcement untouched
- `normalizeTeamTpe.js` — TPE canonicalization untouched
- `getIncomingCeiling()` — already correct, untouched
- All Firestore / persistence layers — untouched
