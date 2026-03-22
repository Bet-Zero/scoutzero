# ARCHITECT_RUNTIME_BLOCKERS_MASTER

## 1. Objective

Finish Architect by replacing placeholder and bridge typing with specific, meaningful contracts in the remaining runtime blocker files.

## 2. Definition Of Done

- important runtime flows must not be dominated by `any`, `LooseRecord`, open index signatures, bag types, or bridge casts
- any looseness that remains must be localized and intentional

## 3. Known Remaining Runtime Blockers

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`

A later follow-up pass may still be needed for the Architect-reached shared runtime pocket, but that is not this pass.

## 4. Pass Plan

### Pass 1 — Core runtime blocker hardening

Files:

- `mutationPipeline.ts`
- `useArchitectActions.ts`
- `resolveOffseasonTransition.ts`

Goal:

- materially reduce placeholder typing in the core runtime blocker files

### Pass 2 — Shared runtime pocket hardening

Reserved but not executed in this run:

- `TeamSelectDropdown.tsx`
- `Dialog.tsx`
- `BirdRightsIcon.tsx`
- `MultiSelectFilter.tsx`
- `EditContractModal.tsx`

### Final Audit

Reserved but not executed in this run.

## 5. Pass Status Ledger

- `Pass 1 — Core runtime blocker hardening — COMPLETE`
  Summary: tightened the main `executeTrade` payload/result/update contracts in `mutationPipeline.ts`, aligned the world-mode free-agency action path in `useArchitectActions.ts` to those stronger contracts, tightened offseason transition context/dead-cap/exception contracts in `resolveOffseasonTransition.ts`, added a focused runtime proof, and kept runtime behavior unchanged in scoped validation.
  Support edits used: 1
- `Pass 2 — Shared runtime pocket hardening — NOT STARTED`
- `Final Audit — NOT STARTED`

## 6. Current Risks / Open Questions

- `mutationPipeline.ts` shed the highest-value trade-path placeholder usage, but broader compatibility aliases still remain outside the targeted trade and audit/result helpers to avoid widening into a larger orchestration refactor.
- `useArchitectActions.ts` now consumes stronger mutation payload/result contracts for the key mutation paths, but it still keeps localized adapter casts for validator boundaries, dev fixtures, and reset flows that were deliberately left out of Pass 1.
- `resolveOffseasonTransition.ts` no longer relies on open bags for the core transition fields it reads and rewrites, but it still preserves opaque forwarded exception keys where closing the full exception contract would widen into a shared refactor.
- One tiny support edit was needed: `capRulesProfile.ts` now exports the canonical cap-projection override type consumed by `resolveOffseasonTransition.ts`.
- The `handleSign` bridge was removed without widening contract normalization beyond scope; if future signing normalization work expands, that should be treated as a separate follow-up rather than folded back into Pass 1.

## 7. Validation Ledger

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectRuntimeBlockers.pass1.test.ts` — PASS
  Notes: 3/3 tests passed. Test output included the expected projected-cap warning from the trade validation path for `2025-26`.
- `npm run build` — PASS
  Warnings: pre-existing Browserslist staleness notice; pre-existing Vite browser externalization warning for `fs`; pre-existing mixed static/dynamic import warnings for `firebaseConfig.js`, `entitlementResolver.ts`, and `leagueInvariants.ts`; pre-existing large chunk size warning for the main build output.
- `npm run validate:project` — PASS

## 8. Final Audit Gate

After Pass 1 and Pass 2 complete, run one final closeout audit.

Do not run an interim audit between passes unless a severe unexpected blocker appears.
