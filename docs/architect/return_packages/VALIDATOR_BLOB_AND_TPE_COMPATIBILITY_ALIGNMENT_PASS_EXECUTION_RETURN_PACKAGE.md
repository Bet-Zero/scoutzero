# VALIDATOR_BLOB_AND_TPE_COMPATIBILITY_ALIGNMENT_PASS — EXECUTION RETURN PACKAGE

**Date:** 2026-03-25  
**Type:** EXECUTION  
**Status:** COMPLETE

---

## 1. Summary

This pass narrowed the remaining live validator-output and legacy TPE compatibility surfaces on the mutation pipeline trade bridge without changing behavior.

The main outcome is that the live bridge no longer types `_validatedTradeContext` as an open blob:

- `ValidatedTradeContext` now exposes only the fields the live mutation path actually reads
- `_rawValidation` still stores the full validator producer result on the success path
- apply-time trade logic now consumes only `{ legal, teamResults }` from `_rawValidation`
- mixed legacy/canonical TPE overlap remains supported, but only through a small local helper in `tradeContext.ts`

---

## 2. Files Changed

- `src/features/architect/utils/tradeContext/types.ts`
- `src/features/architect/utils/tradeContext/tradeContext.ts`
- `src/features/architect/utils/mutationPipeline.ts`
- `src/tests/architect/validatorBlobAndTpeCompatibilityAlignment.test.ts`

---

## 3. Root Cause / Main Compatibility Boundaries Addressed

### `_validatedTradeContext`

The trade-context bridge still exposed an overly broad shape by typing `ValidatedTradeContext` as an open record and effectively inheriting a much larger validator-output surface than the live mutation path relied on.

This pass narrowed that contract to the actual live reads:

- `legal`
- `reason`
- `error`
- `violations`
- `warnings`
- `teamResults`
- `validationTeams`
- `_isValidatedTradeContext`
- optional `_rawValidation`

### `_rawValidation`

`_rawValidation` was still available to apply-time trade logic as a broad validator object even though the live path only needed:

- `legal`
- `teamResults`

This pass introduced an exact apply-time slice in `mutationPipeline.ts` so no other `_rawValidation` fields flow through the live mutation application path.

### Legacy TPE overlap compatibility

The trade snapshot builder still had to support pre-persistence mixed input from:

- legacy `team.tradeExceptions[]`
- canonical `team.exceptions.tpe[]`

That compatibility remains load-bearing before persistence normalization, so the pass kept it local to `tradeContext.ts` instead of widening the mutation pipeline or switching to a different accessor without proof of equivalent behavior.

---

## 4. Stronger Contracts Applied

### `ValidatedTradeContext` is now a producer-derived slice

`src/features/architect/utils/tradeContext/types.ts`

- Replaced `ValidatedTradeContext extends AnyRecord`
- Replaced `TeamResult = TradeTeamResult & AnyRecord`
- Narrowed `_rawValidation` to `TradeValidationResult | undefined`
- Removed broader validator metadata from the bridge contract

Important constraint:

- The bridge contract no longer promises `valid`, `summaryByTeamIndex`, `tradeReceipt`, `performance`, `dataWarnings`, `capSettings*`, or timing fields
- Success-path runtime objects may still carry extra producer fields because the implementation spreads the validator result, but those fields are no longer part of the typed bridge contract

### Catch-path fallback is now truthful

`src/features/architect/utils/tradeContext/tradeContext.ts`

The catch path no longer pretends it can produce unavailable validator metadata. It now returns only the fallback shape the live bridge can truthfully guarantee:

- `legal: false`
- `reason`
- `error`
- `violations`
- `warnings`
- `teamResults: []`
- `validationTeams`
- `_isValidatedTradeContext: true`

It intentionally omits:

- `_rawValidation`
- validator-only metadata that is unavailable when `validateTrade()` throws

### Apply-time `_rawValidation` is narrowed to an exact live slice

`src/features/architect/utils/mutationPipeline.ts`

Added a local helper that resolves only:

```ts
{
  legal: boolean;
  teamResults: TradeTeamResult[];
}
```

Behavior:

- if `_rawValidation` exists, apply-time logic reads only `legal` and `teamResults`
- otherwise it falls back to top-level `validatedContext.legal` and `validatedContext.teamResults`

This prevents the creation of a second mini-blob contract.

### Local TPE compatibility helper now normalizes only live-use fields

`src/features/architect/utils/tradeContext/tradeContext.ts`

The pre-persistence overlap helper now normalizes only the TPE fields the live trade path reads/writes:

- `id`
- `amount`
- `totalAmount`
- `remainingAmount`
- `usedAmount`
- `createdSeason`
- `expiresOn`
- `createdFrom`

Overlap rule:

- when legacy and canonical entries share an id, prefer the record with the greater count of these live-use fields present
- if completeness ties, keep the canonical `exceptions.tpe` record

This keeps the compatibility boundary small and intentional.

---

## 5. Deliberate Non-Changes

- Did not switch the snapshot builder to `getTeamTpeList()`
  - Current file-level evidence did not prove it preserves the same mixed-overlap pre-persistence behavior as the local compatibility helper
- Did not clean up unrelated validator-output consumers outside:
  - `src/features/architect/utils/tradeContext/types.ts`
  - `src/features/architect/utils/tradeContext/tradeContext.ts`
  - `src/features/architect/utils/mutationPipeline.ts`
- Did not widen the pass into a broader TPE subsystem rewrite
- Did not redesign validator producers
- Did not run the full suite
  - Prompt required only `typecheck`, one focused node test, and `build`
  - AGENTS.md also blocks full-suite execution unless the prompt contains `RUN FULL SUITE`

---

## 6. Validation Results

### Commands Run

```bash
npm run typecheck
npm run test:node -- --reporter=dot src/tests/architect/validatorBlobAndTpeCompatibilityAlignment.test.ts
npm run build
```

### Results

- `npm run typecheck` — passed
- `npm run test:node -- --reporter=dot src/tests/architect/validatorBlobAndTpeCompatibilityAlignment.test.ts` — passed
- `npm run build` — passed

### Focused Test Coverage Added

`src/tests/architect/validatorBlobAndTpeCompatibilityAlignment.test.ts`

High-signal behavior checks:

- narrowed `_validatedTradeContext` still supports `computeWorldMutation` on the live trade path
- narrowed apply-time `_rawValidation` handling still drives observable TPE consumption behavior correctly
- local mixed `tradeExceptions[]` + `exceptions.tpe[]` overlap handling still produces the expected deduped public snapshot result, including canonical tie-break behavior

All assertions were kept on public/exported behavior and observable trade results only.

### Build Warnings

`npm run build` emitted existing Vite warnings, but the build completed successfully:

- Browserslist data age warning
- existing dynamic/static import chunking warnings
- large chunk size warning

These were warnings only, not failures, and were not introduced by this pass.

---

## 7. Standing Failures (if any)

None.

No validation command failed after the implementation changes.

---

## 8. Recommended Next Step

If another validator-output consumer still appears broad, only narrow it in a separate pass if it is on the live mutation/trade bridge and its producer/consumer boundary can be proven truthfully.

For TPE compatibility specifically, the next truthful cleanup step would be to remove the remaining pre-persistence dual-source overlap only after there is proof that old-world inputs no longer require it.
