# TM_EDIT_CONTRACT_E1_EXECUTION_RETURN_PACKAGE

- Ticket: `TM_EDIT_CONTRACT_E1`
- Mode: `EXECUTION`
- Date: `2026-03-01`
- Scope: Cap Sheet tab only (`activeTab === 'cap'`) row-click -> `EditContractModal` -> save -> cap totals refresh
- SSOT: `docs/architect/EDIT_CONTRACT_MASTER.md`

---

## 1) Summary

E1 is closed for the Cap Sheet Edit Contract modal flow.

- Objective A (P0) closed: buyout amount is now collected in modal, forwarded through `onWaive`, accepted by handler payload, and applied in both optimistic and world compute paths.
- Objective B (P0) closed: world-mode success now re-syncs `teamCapSheet` from authoritative mutation output (`changedTeams`) to remove optimistic-vs-authoritative drift.
- Objective C (P1) closed: modal confirm is async and close is success-gated; canceled confirm or failed save keeps modal open and surfaces inline error.
- Objective D (P2) verified/no change: extension path does not require current-year totals mutation; no inconsistency requiring behavioral change was found.
- Follow-up hardening: roster removals in `handleWaiveContract` and option-decline now guard `beforeTeam.roster` with `Array.isArray(...)` to avoid introducing new TypeScript errors.

No stop conditions were triggered.

---

## 2) Files Changed

| File | Change |
|---|---|
| `src/shared/components/EditContractModal.jsx` | Added buyout amount UI + validation; async/success-gated confirm flow; inline save error surface; submitting state handling. |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | Added mutation result contract (`{ success, message }`), authoritative success re-sync, standardized mutation finalization, buyout-aware waive logic, option-decline roster/player parity updates, confirm-cancel result propagation. |
| `src/features/architect/utils/mutationPipeline.js` | Updated `computeWaiveResult` to honor `buyout` + `buyoutAmount` and compute dead cap consistently with local optimistic model. |
| `src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.jsx` | Returned explicit success/failure object from modal save callback for success-gated modal close contract compatibility. |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | Returned explicit success/failure object from sign-and-trade modal callback for success-gated modal close contract compatibility. |
| `src/tests/architect/editContractModal_buyout_and_close.behavior.test.jsx` | Added buyout forwarding + modal close-gating behavior tests. |
| `src/tests/architect/useArchitectActions_editContract_resync.behavior.test.tsx` | Added authoritative resync behavior test for modal-triggered world waive/buyout flow. |
| `docs/architect/EDIT_CONTRACT_MASTER.md` | Added E1 closure section with buyout wiring, authoritative resync, close gating, and parity rules. |
| `docs/SHIP_GATES_MASTER.md` | Added E1 closure gate/status section and targeted test command. |
| `return_packages/architect/TM_EDIT_CONTRACT_E1_EXECUTION_RETURN_PACKAGE.md` | This return package. |

---

## 3) Evidence Snippets

### A) Buyout amount capture + forward + success-gated close

- `src/shared/components/EditContractModal.jsx:676` (`handleConfirm` async + normalize result)
- `src/shared/components/EditContractModal.jsx:799` (buyout payload includes `buyoutAmount`)
- `src/shared/components/EditContractModal.jsx:1324` (conditional Buyout Terms block)
- `src/shared/components/EditContractModal.jsx:1443` (inline error alert)

```jsx
case 'buyout':
  actionResult = await onWaive?.(player, {
    stretch: false,
    buyout: true,
    buyoutAmount: parsedBuyoutAmount ?? 0,
    ...(overrideMetadata || {}),
  });
  break;

const normalizedResult = normalizeActionResult(actionResult);
if (normalizedResult.success) {
  onClose();
  return;
}
setSaveError(normalizedResult.message || 'Action was not completed. Review details and try again.');
```

### B) World success authoritative re-sync (drift closure)

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:768` (`syncTeamFromMutationResult`)
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1019` (`persistPromise` completion sync)
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1059` (`finalizeCapMutationResult`)

```ts
const persistCompletionPromise = persistPromise
  .then(async (result) => {
    if (!result?.success) return false;
    await syncTeamFromMutationResult(mutationType, result);
    return true;
  })
  .catch(() => false);
```

### C) Buyout semantics parity in world compute

- `src/features/architect/utils/mutationPipeline.js:1967` (`computeWaiveResult`)
- `src/features/architect/utils/mutationPipeline.js:2013` (buyout amount normalization)
- `src/features/architect/utils/mutationPipeline.js:2017` (dead cap derivation)

```js
const rawBuyoutAmount = buyout ? Math.max(0, Number(payload.buyoutAmount) || 0) : 0;
const boundedBuyoutAmount = buyout ? Math.min(remainingSalary, rawBuyoutAmount) : 0;
const deadCapAmount = buyout
  ? Math.max(0, remainingSalary - boundedBuyoutAmount)
  : remainingSalary;
```

### D) Cancel-confirm does not close modal

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:1960` (`confirmAndRenounceRights` returns `{ success:false }` on cancel)
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts:2257` (`handleWaiveContract` returns cancel result)

```ts
if (!window.confirm(confirmMsg)) {
  return {
    success: false,
    message: 'Action canceled. No changes were saved.',
  };
}
```

---

## 4) Tests Added

1. `src/tests/architect/editContractModal_buyout_and_close.behavior.test.jsx`
- Verifies buyout amount input appears for buyout action and forwards `{ buyout: true, buyoutAmount }`.
- Verifies modal stays open and shows inline error when handler returns canceled/failure.

2. `src/tests/architect/useArchitectActions_editContract_resync.behavior.test.tsx`
- Verifies buyout payload reaches world mutation call.
- Verifies optimistic dead-cap update happens immediately.
- Verifies authoritative `changedTeams` re-sync overwrites optimistic state.
- Verifies totals parity via dead-cap total in resulting team snapshot.

---

## 5) Validation Commands + Outputs

### Required by prompt

1. `npm run test:node -- --run --reporter=dot` -> PASS
- Test Files: `254 passed | 1 skipped`
- Tests: `3214 passed | 9 skipped | 3 todo`
- Duration: `231.34s`

2. `npm run test:ui -- --run --reporter=dot` -> PASS
- Test Files: `39 passed`
- Tests: `384 passed | 2 skipped`
- Duration: `127.28s`

3. `npm run build` -> PASS
- Vite build completed in `1m 52s`
- Non-blocking warnings observed:
  - Browserslist dataset age notice
  - Chunk size warning (`index-e20603e7.js` > 500kB)
  - Existing dynamic/static import chunking warnings

4. `npm run validate:project` -> PASS
- `VALIDATION SUMMARY: All validations passed`

### Targeted E1 command

5. `npm run test:ui -- --run src/tests/architect/editContractModal_buyout_and_close.behavior.test.jsx src/tests/architect/useArchitectActions_editContract_resync.behavior.test.tsx --reporter=dot` -> PASS
- Test Files: `2 passed`
- Tests: `3 passed`
- Duration: `19.18s`

### Additional check (not required by prompt)

6. `npm run typecheck` -> FAIL (pre-existing repository issues outside E1 scope)
- Verified no remaining `useArchitectActions.ts` TypeScript errors from this ticket after patching (`Array.isArray` guards on roster filter paths).

---

## 6) Acceptance Criteria Check

- [x] Buyout action has amount input and forwards through save pipeline.
- [x] Buyout behavior is consistent between base and world modeling paths.
- [x] Waive + option-decline world drift mitigated via authoritative success re-sync.
- [x] EditContractModal closes only on success; remains open on canceled/failed save with inline error.
- [x] Cap totals refresh remains correct for optimistic and authoritative states.
- [x] Base mode keeps no-world-write behavior (`worldId === null` path remains local-only).
- [x] Required validation commands passed.
- [x] Master doc updated with E1 wiring/parity notes.
- [x] Ship gates doc updated with E1 status + targeted tests.
- [x] Return package produced.

---

## 7) Commands Intentionally Skipped

- `npm run test:full` (and raw `vitest`/`npm test`) skipped intentionally because prompt did not include exact phrase `RUN FULL SUITE`.
- `npm run lint` skipped because not required by this ticket and repository guidance marks lint as opt-in.

---

## 8) Remaining Gaps

None identified within E1 ticket scope.
