# PHASE TM-6 — File Diff List

**Date:** 2026-02-05

---

## Source Files Modified

| File | Lines | Why |
|------|-------|-----|
| `src/features/architect/utils/entitlements/entitlementTerms.ts` | 263-268 | Added swapType label to `formatEntitlementTermsShort()` — shows "Swap best" or "Swap worst" |
| `src/features/architect/tradeMachine/EntitlementPickRow.jsx` | 27, 73, 179-188 | Added Layers icon import, `isPooled` check, pooled indicator JSX |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | 149-181 | Improved Stepien warning messages with tier count and pool size |

---

## Test Files Added/Modified

| File | Why |
|------|-----|
| `src/tests/entitlements/entitlementTermsShort.test.ts` | NEW — 7 test cases for swapType visibility in formatEntitlementTermsShort |
| `src/tests/architect/entitlementPickRowDisplay.test.jsx` | EXTENDED — Added pooled/encumbered indicator tests |
| `src/tests/tradeMachine/stepienObligations.test.js` | EXTENDED — Added TM-6 warning message tests (5 cases) |
| `src/tests/architect/entitlementEditorModal.test.tsx` | EXTENDED — Added TM-6 edit flow integration tests |

---

## Documentation Files Modified

| File | Why |
|------|-----|
| `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md` | Added TM-6 section with status, files changed, tests added |

---

## Return Package Files Created

| File | Why |
|------|-----|
| `return_packages/PHASE_TM_6_ENTITLEMENT_AUTHORING_MVP.md` | Full summary of what works, limitations, verification checklist |
| `return_packages/PHASE_TM_6_FILE_DIFF_LIST.md` | This file |
