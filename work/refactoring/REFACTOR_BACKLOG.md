# Refactor Backlog

Scanned 2026-05-10. Ordered by recommended execution sequence — small/safe first,
large/risky last. Each wave builds on the previous one.

---

## Summary Table

| # | Item | Effort | Files Touched | AI-Agent Impact | Status |
|---|------|--------|--------------|----------------|--------|
| 1 | Delete `useSeasonPlayerData` | XS (15 min) | 1 | Low | ✅ Done 2026-05-10 |
| 2 | Move `src/firebaseHelpers.ts` into `src/firebase/` | XS (20 min) | 2 | Low | ✅ Done 2026-05-10 |
| 3 | Barrel exports for all 8 feature folders | S (2–3 hr) | 8 new files | **High** | |
| 4 | Default export audit + conversion | M (half day) | 173+ files | Medium | |
| 5 | Split large React components (3 files) | M (half day) | 3 files | Medium | |
| 6 | Split `seasonManager.ts` | M (1 day) | ~5 new files | Medium | |
| 7 | Split `capLegalityValidation.ts` | L (1–2 days) | ~6 new files | **High** | |
| 8 | Split `useArchitectActions.ts` | L (2 days) | ~6 new files | **High** | |
| 9 | Split `mutationPipeline.ts` | XL (3–5 days) | ~10 new files | **Critical** | |

---

## Why this order

- **#1–2 first**: Zero-risk cleanup. Removes orphaned files and stops future confusion.
- **#3 before #4**: Barrel exports make the default-export conversion safer — once
  each feature has an `index.ts`, import sites can be updated to the barrel path
  instead of hunting individual deep paths.
- **#4 after #3**: Default export cleanup is wide but shallow. Safe to do after
  the structural baseline is in place.
- **#5 before #6–9**: Component splits are self-contained (no logic changes). Build
  the muscle before tackling the architect utility layer.
- **#6–9 in size order**: Each split de-risks the next. `seasonManager` is the
  smallest and most isolated; `mutationPipeline` is the most entangled and must
  be last.

---

## Wave 1 — Trivial Cleanup ✅ Complete (2026-05-10)

### 1. Delete `useSeasonPlayerData` ✅

**File:** ~~src/shared/hooks/useSeasonPlayerData.ts~~ (deleted)  
Removed the deprecated hook (zero active callers). Cleaned up the stale reference
in `src/tests/shared/hooks.smoke.test.tsx` comment. 57/57 smoke tests pass.

---

### 2. Move `src/firebaseHelpers.ts` into `src/firebase/` ✅

**File:** `src/firebaseHelpers.ts` → [src/firebase/firebaseHelpers.ts](../../src/firebase/firebaseHelpers.ts)  
Moved to sit alongside `listHelpers.ts`, `rankerHelpers.ts`, `rosterHelpers.ts`.
Updated relative `./firebaseConfig` import to `@/firebaseConfig`. No import sites
needed updating (file had no callers in the app). 57/57 smoke tests pass.

Note: The guardrail test variable named `firebaseHelpersSource` reads
`src/features/architect/utils/firebaseTeamPlanHelpers.ts` — a different file entirely.
No test path updates were required.

---

## Wave 2 — Structure (2–3 hours)

### 3. Barrel exports for all 8 feature folders

**Folders:** `architect`, `filters`, `lists`, `profile`, `ranker`, `roster`, `table`,
`tierMaker` — none have a top-level `index.ts`

**Why it matters for AI agents:** Without barrel exports, an agent editing the `filters`
feature needs to know the internal deep path of every export it references. With an
`index.ts`, agents can import from `@/features/filters` and internal restructuring
doesn't break anything outside the feature boundary.

**Approach per folder:**
1. Audit the folder's existing exports (what do other features actually import from it?)
2. Write an `index.ts` that re-exports those public items
3. Do NOT re-export every internal file — only the public surface
4. Run `npm run validate:project -- --reporter=dot` and `npm run typecheck`

**Start with `filters`** (most default-export cleanup still ahead) then `lists`,
`ranker`, `roster`, `table`, `tierMaker`. Leave `architect` and `profile` for last
since they have the deepest internal structure.

---

## Wave 3 — Moderate Refactors (half day each)

### 4. Default export audit and conversion

**Scope:** 173 non-page `export default` usages across all feature folders.  
**Complexity:** AGENTS.md requires named exports for everything except top-level page
views. However, some default exports are intentionally pinned by guardrail tests and
**cannot be converted without also updating those tests**.

**Before touching any file, check the guardrail test list:**

| File | Guardrail test that checks it |
|------|-------------------------------|
| `src/features/architect/tradeMachine/TradePreviewModal.tsx` | `tradeMachinePreviewExport.compatibility.guardrail.test.ts:18` |
| `src/features/architect/tradeMachine/TradeExportCapture.tsx` | `tradeMachinePreviewExport.compatibility.guardrail.test.ts:24` |
| `src/features/architect/tradeMachine/EntitlementPicksList.tsx` | `tradeTeamCardLeafFamily.compatibility.guardrail.test.tsx:158` |

These three must either stay as `export default`, or the guardrail tests must be updated
simultaneously as part of the same commit.

**Safe to convert immediately (no guardrail lock):** everything in `filters/` (17),
`lists/` (19), `ranker/` (11), `roster/` (22), `table/` (21), `tierMaker/` (5).

**Steps:**
1. Run the guardrail tests first to establish a clean baseline:
   `npm run test:architect -- --reporter=dot`
2. Convert one feature at a time, starting with `filters` (highest count, no locks)
3. For each file: change `export default X` → `export { X }` and update all import
   sites (`import X from '...'` → `import { X } from '...'`)
4. Re-run `npm run typecheck` after each feature
5. Leave the three locked architect files for last — convert them together with their
   guardrail tests in a single commit

---

### 5. Split the three oversized React components

Each of these is a single component file that has grown past 1,000 lines and violates
the 200-line guideline. Each is a self-contained split with no shared logic risk.

| File | Lines | Split strategy |
|------|-------|---------------|
| [TradeTeamCard.tsx](../../src/features/architect/tradeMachine/TradeTeamCard.tsx) | 1,211 | Extract player row, pick row, salary summary, and action controls into sibling files |
| [TieramidBoard.tsx](../../src/features/tierMaker/TieramidBoard.tsx) | 1,194 | Extract tier row, drag layer, and board controls |
| [SeasonAdvanceModal.tsx](../../src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx) | 1,175 | Extract step panels, confirmation dialogs, and summary cards |

**Approach for each:**
1. Read the full file and identify natural section breaks (distinct UI regions)
2. Extract each section into a co-located subcomponent file (same folder)
3. Parent file imports and composes them — no logic moves, just JSX structure
4. Run `npm run typecheck` and `npm run test:architect -- --reporter=dot`

**Note on `TradeTeamCard.tsx`:** This file is watched by `tradeTeamCardLeafFamily`
guardrail tests. Read those tests before splitting to ensure the extracted leaf files
satisfy the guardrail expectations.

---

## Wave 4 — Large Splits (days each)

### 6. Split `seasonManager.ts` (2,295 lines)

**File:** [src/features/architect/utils/seasonManager.ts](../../src/features/architect/utils/seasonManager.ts)  
**Effort:** M–L (1 day)  
**Risk:** Medium — consumed by `mutationPipeline.ts` and offseason utilities

Suggested split targets (audit the file to confirm):
- `seasonCalendar.ts` — date/phase logic
- `seasonContractHelpers.ts` — contract status per season
- `seasonCapProjection.ts` — cap projection calculations
- `seasonStateTransitions.ts` — state machine transitions

Keep `seasonManager.ts` as a thin re-export barrel after splitting.

---

### 7. Split `capLegalityValidation.ts` (4,820 lines)

**File:** [src/features/architect/utils/capLegalityValidation.ts](../../src/features/architect/utils/capLegalityValidation.ts)  
**Effort:** L (1–2 days)  
**Risk:** Medium-high — central to trade and contract validation across architect

This file contains all cap legality rules. It should be split by rule domain:

- `capRules/hardCapRules.ts`
- `capRules/tradeAggregationRules.ts`
- `capRules/exceptionsRules.ts`
- `capRules/twoWayRules.ts`
- `capRules/minimumSalaryRules.ts`
- `capLegalityValidation.ts` — thin orchestrator that calls domain modules

Run `npm run test:cap-sheet-boundary -- --reporter=dot` as the validation gate.

---

### 8. Split `useArchitectActions.ts` (6,139 lines)

**File:** [src/features/architect/GMDashboard/hooks/useArchitectActions.ts](../../src/features/architect/GMDashboard/hooks/useArchitectActions.ts)  
**Effort:** L (2 days)  
**Risk:** High — this hook is the primary action dispatcher for all Architect mutations

This is the most important structural split for AI-agent usability. Currently any
agent touching architect actions must reason about 6,000 lines of mixed-domain
action handlers in one context.

Suggested split by action domain:
- `useTradeActions.ts` — trade execution, validation, rollback
- `useContractActions.ts` — sign, extend, waive, option decisions
- `useRosterActions.ts` — roster moves, two-way conversions
- `useOffseasonActions.ts` — offseason resolution, draft, free agency
- `useArchitectActions.ts` — thin composer that combines the above hooks

Validation gate: `npm run test:architect -- --reporter=dot` (must stay green
throughout — split incrementally, one domain at a time).

---

### 9. Split `mutationPipeline.ts` (13,412 lines)

**File:** [src/features/architect/utils/mutationPipeline.ts](../../src/features/architect/utils/mutationPipeline.ts)  
**Effort:** XL (3–5 days)  
**Risk:** Very high — the central write layer for all Architect state changes

This is the single highest-leverage refactor in the codebase for AI agents. At 13,000+
lines, no agent can hold the full context of this file. Every architect mutation goes
through it, which means agents trying to add or debug a mutation always face a 
13k-line black box.

**Do this last** — the splits in #6, #7, and #8 will have already mapped the domain
boundaries. By the time this is tackled, the shape of the right split will be clear
from having done the surrounding work.

Anticipated split targets:
- `mutations/tradeMutations.ts`
- `mutations/contractMutations.ts`
- `mutations/rosterMutations.ts`
- `mutations/offseasonMutations.ts`
- `mutations/capSheetMutations.ts`
- `mutations/pickMutations.ts`
- `mutations/worldStateMutations.ts`
- `mutationPipeline.ts` — thin orchestrator with transaction helpers

Validation gate: full architect test suite (`npm run test:architect -- --reporter=dot`)
plus `npm run test:cap-sheet-boundary -- --reporter=dot`.

**Plan this work separately before starting.** Read the file's top-level exports and
call graph before committing to a split boundary. A wrong boundary here is expensive
to undo.

---

## What was already fixed (2026-05-10)

- Added `ARCHITECT_WORLD_TEAMS_SUBCOLLECTION` and `ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION`
  to `collections.ts`; replaced all hardcoded `'teams'`/`'players'` strings in
  `architectFirestorePaths.ts`
- Migrated `RankingResults.tsx` from `@/hooks/useImageDownload` to
  `@/shared/hooks/useImageDownload`
- Deleted `src/hooks/` (last file migrated, directory removed)
- Deleted `src/shared/hooks/useSeasonPlayerData.ts` (deprecated, zero callers) — Wave 1 #1
- Moved `src/firebaseHelpers.ts` → `src/firebase/firebaseHelpers.ts` — Wave 1 #2
