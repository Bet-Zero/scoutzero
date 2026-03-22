# ARCHITECT_FINAL_HARDENING_PACK_MASTER

## 1. Objective

Move Architect from structurally TypeScript-converted but not fully hardened to a stricter end state where the remaining core flows use specific, meaningful types.

This pack is not a migration pass. It is a final hardening pass on the small set of remaining core files where placeholder, bag, or bridge typing still dominates important flows.

## 2. Definition Of Done

Architect is done by this standard when the important flows in the remaining target files are no longer dominated by:

- `any`
- `unknown[]`
- `Record<string, unknown>`
- `[key: string]: unknown`
- vague local `...Like` bags
- broad compatibility bridges
- cast-based type forcing in core flows

Any looseness that remains must be small, localized, intentional, and justified by a genuinely dynamic runtime contract.

## 3. Remaining Target Files

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`
- `src/features/architect/hooks/useCapValidation.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

## 4. Chunk Plan

### Chunk 1 — Core pipeline + transition hardening

Files:

- `src/features/architect/utils/mutationPipeline.ts`
- `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`

Goal:

- tighten the highest-value core orchestration and offseason transition contracts so the important trade and transition flows stop leaning on broad placeholder shapes

Execution notes:

- keep `mutationPipeline.ts` strictly trade-path only
- do not redesign mutation orchestration or offseason behavior
- default to zero support edits
- allow at most one tiny type-only support edit in an existing authoritative module only if Chunk 1 cannot complete otherwise

### Chunk 2 — Validation + dashboard action hardening

Files:

- `src/features/architect/hooks/useCapValidation.ts`
- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

Goal:

- tighten validation and dashboard action payload/result contracts so these files stop leaning on broad compatibility typing for important flows
- consume and align with the stronger trade/transition contracts established in Chunk 1 rather than introducing new parallel compatibility shapes

## 5. Chunk Status Ledger

- `Chunk 1 — Core pipeline + transition hardening — COMPLETE`
  Summary: hardened the `executeTrade` path in `mutationPipeline.ts`, tightened the main transition input/output/state contracts in `resolveOffseasonTransition.ts`, added a focused node proof for one representative trade path plus two representative offseason transition paths, and kept runtime behavior unchanged.
  Support edits used: `0`
- `Chunk 2 — Validation + dashboard action hardening — COMPLETE`
  Summary: hardened the two Chunk 2 target files with zero support edits and kept runtime behavior unchanged.
  - `useCapValidation.ts`: already clean at start of chunk (0 `any`, 0 `unknown`, 0 catch-all index signatures); both boundary casts (`getCapSettings → CapSettingsLike` and `CapValidationPlayer[] → Player[]`) are load-bearing adapter casts where the shapes genuinely differ (`CapSettingsLike` adds `minimumSalary` not present in `RawCapProjection`; `Player` is broader than `CapValidationPlayer`). No changes needed — documented as intentional.
  - `useArchitectActions.ts`: narrowed `CapSheet.tradeExceptions?: unknown[]` to `TradeException[]` using the canonical schema-derived type already exported from `@/features/architect/types`; the three double-casts (lines 1729, 2312, 3177) are load-bearing adapter bridges (different `TeamCapSheetLike` types from two separate modules; `LocalContract` → `Record<string, unknown>` has no structural overlap for a single-cast); remaining `unknown[]` fields in `CapSheet` (`waivedContracts`, `exceptionHistory`, `mleHistory`, `pickLog`, `historyTimeline`) and `Record<string, unknown>` fields are legacy data with no canonical typed shapes available without new type introductions.
  Support edits used: `0`
- `Final Audit — NOT STARTED`

## 6. Current Risks / Open Questions

- `mutationPipeline.ts` no longer relies on broad bags for the main `executeTrade` result flow, but route identifiers inside trade payload entries are still normalized from intentionally loose `unknown` values because upstream payload shapes are not yet canonicalized.
- `mutationPipeline.ts` still keeps broader shared mutation aliases outside the trade path; widening those would spill into signing, waive, option, and offer-sheet branches that were explicitly out of scope for Chunk 1.
- `resolveOffseasonTransition.ts` now uses specific transition contracts for players, cap sheet state, option decisions, and applied summary output, but `context.capProjections` remains intentionally loose because this pass did not establish a stronger shared projection contract.
- `resolveOffseasonTransition.ts` still retains a few localized compatibility casts inside option decision normalization where runtime input can arrive as either string decisions or decision objects.
- `useCapValidation.ts`: both boundary casts are intentional adapters; local `...Like` interfaces are well-enumerated (no catch-alls) and serve as clean input boundary contracts.
- `useArchitectActions.ts`: `CapSheet.tradeExceptions` narrowed to `TradeException[]`; remaining `unknown[]` legacy fields (`waivedContracts`, `exceptionHistory`, `mleHistory`, `pickLog`, `historyTimeline`) and `Record<string, unknown>` metadata fields are intentionally loose — genuinely dynamic legacy data with no canonical typed shapes and no element-level access in this file.

## 7. Validation Ledger

**Post-Chunk 1:**

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectFinalHardeningPack.chunk1.test.ts` — PASS
- `npm run build` — PASS
  Warnings: pre-existing Browserslist staleness notice; pre-existing Vite warnings for `fs` browser externalization, mixed static/dynamic imports, and large chunk size reporting
- `npm run validate:project` — PASS

**Post-Chunk 2:**

- `npm run typecheck` — PASS
- `npm run test:node -- --reporter=dot src/tests/architect/architectFinalHardeningPack.chunk1.test.ts` — PASS (3/3)
- `npm run build` — PASS
  Warnings: same pre-existing set as after Chunk 1; no new warnings introduced
- `npm run validate:project` — PASS

## 8. Final Audit Gate

After both chunks complete, run one final Architect closeout audit.

Do not run interim audits between chunks unless a severe unexpected blocker appears.
