# Lists — E3 Docs + Cleanup — Execution Return Package

**Date**: 2026-02-05
**Status**: ✅ COMPLETE
**Master Doc**: `docs/features/lists_MASTER.md`

---

## Summary

E3 closes the Lists feature audit by aligning documentation with E1/E2 reality, removing dead code, and declaring ship-ready status.

### Changes Made

1. **Schema doc updated** (`docs/schema/CURRENT_FIRESTORE_SCHEMA.md`):
   - Added `lists` canonical schema (E1+): field list, types, defaults, legacy `players` field note, `divider::` entry semantics, service layer references.
   - Added `tierLists` canonical schema (E2+): `mode` field, inference behavior (`inferTierListMode`), Tieramid capacity note (UI-only), service layer references.
   - Added ownership/auth deferred note covering both collections.

2. **`/list-presentation` removed (Option B)**:
   - Confirmed: only referenced in `src/App.jsx` (import + route) and its own file. No nav link. No external imports.
   - Deleted: `src/pages/ListPresentationView.jsx`
   - Removed from `src/App.jsx`: import statement + `<Route>` entry

3. **Unused components deleted**:
   - `src/features/lists/ListExportToggle.jsx` — confirmed zero imports via grep; deleted.
   - `src/features/lists/ListExportTypeToggle.jsx` — confirmed zero imports via grep; deleted.

4. **Master doc updated** (`docs/features/lists_MASTER.md`):
   - Gaps & Risks statuses updated (E3 items marked RESOLVED).
   - E3 summary section added.
   - Final ship-ready stamp applied with remaining deferrals listed.

---

## Files Changed

| File                                                 | Action                                                   |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`            | Updated — added `lists` + `tierLists` schemas            |
| `src/App.jsx`                                        | Edited — removed `ListPresentationView` import and route |
| `src/pages/ListPresentationView.jsx`                 | **Deleted**                                              |
| `src/features/lists/ListExportToggle.jsx`            | **Deleted**                                              |
| `src/features/lists/ListExportTypeToggle.jsx`        | **Deleted**                                              |
| `docs/features/lists_MASTER.md`                      | Updated — E3 section, gap statuses, ship-ready stamp     |
| `return_packages/lists/EXECUTION_E3_docs_cleanup.md` | **Created** (this file)                                  |

---

## Decisions Made

| Decision               | Choice                | Rationale                                                                            |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `/list-presentation`   | **Option B (REMOVE)** | Only referenced in route wiring + own file. No nav link. Hardcoded sample data only. |
| `ListExportToggle`     | **DELETE**            | Zero imports anywhere in codebase.                                                   |
| `ListExportTypeToggle` | **DELETE**            | Zero imports anywhere in codebase.                                                   |

---

## Validation Results

- `npm run build`: ✅ PASS (55s, 3019 modules, no errors — chunk size warning is pre-existing/expected)

---

## Acceptance Criteria

- [x] `docs/schema/CURRENT_FIRESTORE_SCHEMA.md` reflects E1/E2 schemas for `lists` + `tierLists`
- [x] `/list-presentation` route removed safely (Option B)
- [x] Unused components (`ListExportToggle`, `ListExportTypeToggle`) deleted
- [x] `docs/features/lists_MASTER.md` updated and concludes SHIP-READY ✅ (Auth deferred)
- [x] App builds after cleanup
