# Phase 24: Manual Dead Money Management - Return Package

## 1. Executive Summary

This phase implements the "Manage Dead Money" functionality, allowing users to manually Add, Edit, and Remove dead money entries directly from the Cap Sheet.

* **Status**: ✅ Complete & Verified
* **Audit Grade**: High (Atomic persistence, Schema validation, Test coverage)
* **Key Feature**: `ManageDeadMoneyModal` + `setDeadCap` mutation

## 2. Changes Implemented

### 2.1 UI Layer

* **New Modal**: `src/features/architect/capSheet/modals/ManageDeadMoneyModal.jsx` provides a table interface for editing dead money. Support for labeling, season selection, amount, and stretch flag.
* **Entry Point**: `CapSheet.jsx` footer now includes a "Manage Dead Money" button.
* **Action Wiring**: `useArchitectActions.ts` updated with `handleSetDeadCap` which optimistically updates local state and persists via pipeline.

### 2.2 Mutation Pipeline

* **New Mutation**: `setDeadCap` added to `mutationPipeline.js`.
* **Logic**: `computeSetDeadCapResult` performs full array replacement on the team object.
* **Validation**: `validateMutation` integrates `validateDeadCap` schema checks.

### 2.3 Validation Rules

* **New Hard Block**: `dead_cap_schema_invalid`
  * Enforces `deadCap` is an array.
  * Enforces each entry has `amountByYear` with positive numbers.
  * Enforces boolean types for flags.

## 3. Verification

### 3.1 Automated Tests

New test file `src/tests/architect/deadCapManagement.test.js` passes with 5/5 tests covering:

* Valid entry schema.
* Invalid array type (block).
* Missing/Invalid `amountByYear` (block).
* Negative amounts (block).
* Non-boolean types (block).
* Pipeline computation correctness.

### 3.2 Manual Verification Steps (Recommended)

1. Open GM Dashboard > Cap Sheet.
2. Scroll to footer, click "Manage Dead Money".
3. Add a new entry (e.g., "Waived: Smith", "2025-26", $1,500,000).
4. Click Save.
5. Verify "Total Cap Hit" updates immediately.
6. Refresh page (F5) to verify persistence (requires World mode).

## 4. Documentation

* **Master Doc**: Updated `CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` with new mutation type, validation rules, and changelog.

## 5. Next Steps

* **Phase 25**: Manual Exception Management (similar pattern to Dead Money).
