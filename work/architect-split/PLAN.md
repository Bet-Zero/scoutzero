# Wave 4 — Architect Large-File Splits

Planned 2026-05-11. Execution will span multiple sessions (usage-limit interruptions expected).
Each step is independently shippable — complete it, confirm tests pass, commit, then stop or continue.

---

## Resume protocol (read this first when starting a session)

Do these three things in order before touching any source files:

1. **Read [STATUS.md](./STATUS.md).** Find the first row marked 🟡 In progress or ⬜ Not
   started. That is where you pick up. The "Last session checkpoint" section at the bottom
   tells you what the previous session was mid-doing, if anything.

2. **Read the most recent entries in [DECISIONS.md](./DECISIONS.md).** Any deviations from
   PLAN.md (skipped steps, scope reductions, Path A/B choices) are recorded there. Honor
   them — they were made deliberately by a previous session.

3. **Verify the baseline is green** before adding to it:

   ```
   npm run typecheck
   npm run test:architect -- --reporter=dot
   ```

   If either fails, the previous session ended in a bad state. Investigate before
   continuing — do not stack new changes on a red baseline. Record what you found in
   DECISIONS.md.

At the end of every session, update STATUS.md (the relevant step row + the "Last session
checkpoint" block + the "Validation snapshot" rows you ran) and commit it alongside the
source changes. If you made any judgment call beyond following PLAN.md verbatim, add an
entry to DECISIONS.md in the same commit.

---

## Quick reference

| Step | Target | Lines | Risk | Validation gate |
|------|--------|-------|------|----------------|
| 0 | Fix architect compatibility guardrail tests | — | Low | `npm run test:fast -- --reporter=dot` |
| 0.5 | Split `SeasonAdvanceModal.tsx` | 1,175 | Low | `npm run test:architect -- --reporter=dot` |
| 1 | Split `seasonManager.ts` | 2,295 | Medium | `npm run test:architect -- --reporter=dot` |
| 2 | Split `capLegalityValidation.ts` | 4,814 | Medium-high | `npm run test:cap-sheet-boundary` + `test:architect` |
| 3 | Split `useArchitectActions.ts` (**optional**) | 6,139 | High | `npm run test:architect -- --reporter=dot` |
| 4a | Map + verify `mutationPipeline.ts` phase boundaries | — | Low | doc-only; updates this plan |
| 4 | Split `mutationPipeline.ts` | 13,412 | Very high | full architect + cap-sheet-boundary suites |

> **Test commands.** This repo has `test:fast` (runs `tests/smoke`), `test:architect`,
> `test:cap-sheet-boundary`, etc. There is **no** `test:smoke` script. Always append
> `--reporter=dot` per AGENTS.md. Use `npm run typecheck` (not raw `tsc --noEmit`).
> After any file move/split, also run `npm run validate:project`.

Do **not** skip steps or reorder them. Each split de-risks the next.

---

## Step 0 — Fix architect compatibility guardrail tests

**Why first:** Some guardrail tests currently assert `Object.keys(module).toEqual(['default'])`
or check source-text for `export default …` strings. Wave 3 converted many files to named
exports while restoring `export default` on a small set of compat-locked files. The result is
that some guardrails are now stale, and we need a clean baseline before Wave 4 begins.

### Discovery (do this first — do not assume which tests are broken)

1. Run the targeted suite that exercises these guardrails:

   ```
   npm run test:architect -- --reporter=dot
   ```

2. Capture the failing test list. Only fix tests that actually fail. Do **not** preemptively
   edit guardrails based on this plan's expectations — Wave 3 may have restored some defaults
   for compat reasons (e.g., `692f4f8a refactor: remove 4 remaining export-default object
   blocks; restore compat defaults`).

3. As supplementary evidence, also list candidate files via:

   ```
   grep -rn "toEqual(\['default'\])" src/tests/
   ```

   Treat this list as a **hint set**, not a worklist — only entries whose source files
   actually changed need updating.

### How to fix each failing guardrail

For each guardrail that fails because the module's actual shape no longer matches its assertion:

1. Add a one-time `console.log(Object.keys(module))` (or print the source line) in the test
   to confirm the new shape, then remove the log.
2. Update the assertion to the current export surface.
3. Add a comment: `// updated: Wave 3 export-shape change (see commits 10f5fed7, 692f4f8a)`.
4. If the file was *intentionally* kept default-only by Wave 3 (e.g., `GMDashboard.tsx`,
   `TradePreviewModal.tsx`), the guardrail is correct as-is — investigate why the test fails
   before changing the assertion. The fix may be in source, not in the test.

### Validation gate

```
npm run typecheck
npm run test:fast -- --reporter=dot
npm run test:architect -- --reporter=dot
```

All targeted suites must be green. Commit when clean.

---

## Step 0.5 — Split `SeasonAdvanceModal.tsx` (deferred from Wave 3)

**File:** `src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx` (1,175 lines)

**Why deferred:** Two guardrails couple to this file:

- `src/tests/architect/offseason.devGate.guardrail.test.ts` reads the file by exact path and
  asserts `toContain('committedTeamCapSheet: SeasonAdvanceModalTeamCapSheet | null;')`.
- `src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx` imports
  `SeasonAdvanceModalTeamCapSheet` from the modal **and** asserts
  `Object.keys(SeasonAdvanceModalModule).toEqual(['default'])` — meaning any new named exports
  added to the modal file (or removal of the type re-export) will break it.

### The coordinated commit approach

This must be a **single commit** that:

1. Extracts `SeasonAdvanceModalTeamCapSheet` and other types into `SeasonAdvanceModal.types.ts`.
2. Re-exports `SeasonAdvanceModalTeamCapSheet` from `SeasonAdvanceModal.tsx` so existing
   import sites keep working — but use `export type { ... }` (type-only re-export erases at
   runtime, so `Object.keys(module)` stays `['default']` and the dashboardWorldBoundary
   guardrail keeps passing).
3. Updates `offseason.devGate.guardrail.test.ts` to check the new path
   (`SeasonAdvanceModal.types.ts`) for the `committedTeamCapSheet:` assertion, OR keep that
   assertion on the modal file if the line is preserved verbatim by the re-export approach.
   Verify by running the test before committing.
4. Re-runs `dashboardWorldBoundary.compatibility.guardrail.test.tsx` to confirm the modal's
   runtime keys are still `['default']`.

### Target file structure

```
src/features/architect/GMDashboard/components/
  SeasonAdvanceModal.tsx          (~700 lines — component + handlers only)
  SeasonAdvanceModal.types.ts     (~200 lines — all exported types/interfaces)
  SeasonAdvanceModal.helpers.ts   (~275 lines — pure utility functions)
```

### Validation gate

```
npm run typecheck
npm run validate:project
npm run test:architect -- --reporter=dot
```

---

## Step 1 — Split `seasonManager.ts`

**File:** `src/features/architect/utils/seasonManager.ts` (2,295 lines)  
**Imports from:** Firebase, various cap/player helpers  
**Consumed by:** `mutationPipeline.ts`, various offseason utilities, 26 test files

### Export surface (current)

**Types (9):**

- `SeasonPhase`, `SeasonStatus`, `SeasonCalendarEntry`, `SeasonConfig`
- `ContractSeasonStatus`, `CapProjectionResult`
- `DraftPickSwapResult`, `DraftPickConveyanceResult`, `SeasonTransitionState`

**Functions (3):**

- `advanceSeasonInWorld` — main orchestration function
- `resolveDraftPickSwapsForYear` — pure draft-pick swap resolution
- `resolveDraftPickConveyanceForYear` — pure draft-pick conveyance resolution

### Proposed split

```
src/features/architect/utils/
  seasonManager.ts                 (~800 lines — thin orchestrator; re-exports everything)
  seasonManager.draftResolution.ts (~300 lines — resolveDraftPickSwapsForYear,
                                                  resolveDraftPickConveyanceForYear,
                                                  DraftPickSwapResult,
                                                  DraftPickConveyanceResult)
  seasonManager.types.ts           (~150 lines — all 9 types; optional but recommended)
```

**Do not** create `seasonCalendar.ts`, `seasonCapProjection.ts`, `seasonStateTransitions.ts`
yet — the analysis did not find clean internal section boundaries for those. The draftResolution
split is the only clearly isolated domain.

### Execution steps

1. Read `seasonManager.ts` top-to-bottom; note the line ranges for:
   - Type definitions
   - `resolveDraftPickSwapsForYear` and its helpers
   - `resolveDraftPickConveyanceForYear` and its helpers
   - `advanceSeasonInWorld` and everything it calls
2. Create `seasonManager.draftResolution.ts` with the two draft-resolution functions and
   their direct dependencies. Import from `@/` paths (no relative imports into the
   original file).
3. In `seasonManager.ts`, replace the moved functions with imports from
   `./seasonManager.draftResolution`, and add re-exports so existing callers are unaffected.
4. Optionally extract types into `seasonManager.types.ts` and re-export from both files.
5. Run typecheck + tests.

### Validation gate

```
npm run typecheck
npm run validate:project
npm run test:architect -- --reporter=dot
```

All 26 test files that import `seasonManager.ts` must stay green. Commit when clean.

---

## Step 2 — Split `capLegalityValidation.ts`

**File:** `src/features/architect/utils/capLegalityValidation.ts` (4,820 lines)  
**Consumed by:** `mutationPipeline.ts`, `useArchitectActions.ts`, 82 import sites total

### Export surface (current)

50+ named exports across 8 logical sections:

| Section | Exports (approximate) | Lines |
|---------|----------------------|-------|
| Constants | `CAP_FLOOR_THRESHOLD`, `HARD_CAP_APRONS`, etc. | ~150 |
| Schema / types | `CapLegalityResult`, `ValidationContext`, etc. | ~300 |
| Signing terms | `computeSigningTerms`, `getMaxContractYears`, etc. | ~600 |
| Offer sheets | `validateOfferSheet`, `computeOfferSheetTerms`, etc. | ~400 |
| Signing validator | `validateSigning` (main) + helpers | ~1,200 |
| Waive | `validateWaive` + helpers | ~600 |
| Extension | `validateExtension` + helpers | ~900 |
| Options | `validateOptionDecision` + helpers | ~700 |

Plus a retained `export default { validateSigning, validateWaive, ... }` namespace object
(35 properties) required by the smoke test `capLegalityValidationImports.smoke.test.ts`.

### Proposed split

```
src/features/architect/utils/capLegalityValidation/
  constants.ts          (~150 lines — all cap-rule constants)
  schema.ts             (~300 lines — CapLegalityResult, ValidationContext, all types)
  signing.ts            (~1,800 lines — signing terms + offer sheets + validateSigning)
  extension.ts          (~900 lines — validateExtension)
  actionValidators.ts   (~700 lines — validateWaive + validateOptionDecision)

src/features/architect/utils/capLegalityValidation.ts  (thin orchestrator — re-exports
                                                         everything + retains default namespace)
```

**Critical:** The `export default { ... }` namespace object must stay in
`capLegalityValidation.ts` (the orchestrator), not in any submodule, because the smoke test
imports from the extensionless path `@/features/architect/utils/capLegalityValidation`.

### Execution steps

Work one submodule at a time. After each step, run the full validation gate (below).

1. **Step 2a — extract constants:** Create `capLegalityValidation/constants.ts`. Move
   constants from the original file. Add `export * from './capLegalityValidation/constants'`
   to the orchestrator. ✓ full gate.

2. **Step 2b — extract schema/types:** Create `capLegalityValidation/schema.ts`. Move
   type definitions. Orchestrator re-exports. ✓ full gate.

3. **Step 2c — extract signing:** Create `capLegalityValidation/signing.ts` with signing
   terms, offer sheet helpers, and `validateSigning`. Orchestrator re-exports. ✓ full gate.

4. **Step 2d — extract extension:** Create `capLegalityValidation/extension.ts`. ✓ full gate.

5. **Step 2e — extract action validators:** Create `capLegalityValidation/actionValidators.ts`
   with `validateWaive` and `validateOptionDecision`. ✓ full gate.

6. Confirm the orchestrator still has the `export default { ... }` namespace object intact.

### Validation gate (after each sub-step)

```
npm run typecheck
npm run validate:project
npm run test:cap-sheet-boundary -- --reporter=dot
npm run test:architect -- --reporter=dot
npm run test:fast -- --reporter=dot
```

`capLegalityValidation` has 82 import sites including trade flows and the action hook.
`cap-sheet-boundary` alone does not exercise trade-machine consumers — running
`test:architect` after every sub-step catches regressions while the diff is still small
enough to bisect. Cost is ~1 minute per sub-step; well worth it.

---

## Step 3 — Split `useArchitectActions.ts` (**OPTIONAL — low value, may be skipped**)

**File:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` (6,139 lines)  
**Consumed by:** primary action dispatcher for all Architect mutations; 20+ test files

### ⚠️ Honest assessment: this step has low value

The proposed split extracts types (~400 lines) and normalization utilities (~200 lines).
That takes the hook body from 6,139 → ~5,500 lines. The hard part of this file — navigating
20 handlers that share closure state — is **unchanged** by this split. It is essentially a
cosmetic improvement.

Two valid paths forward:

- **A) Execute Step 3 as written below.** Low risk, low reward. Worth doing if Steps 1–2
  finished quickly and there's budget remaining. Removes the type definitions from the
  hook file, which does meaningfully improve navigation when reading just the handler logic.

- **B) Skip Step 3 entirely and proceed directly to Step 4a.** Recommended if time is tight
  or if Step 2 took longer than expected. The real architectural problem in this file
  (shared closure across 20 handlers) cannot be solved by a types-only extraction; solving
  it requires a separate, scoped initiative to refactor the hook into a context + sub-hooks
  pattern, which is out of scope for Wave 4.

**Decide A vs B before starting.** Do not start Step 3 "to see how it goes" — half-finishing
this step leaves the hook in a worse state than not starting.

### Export surface (current)

- 13 exported interfaces (parameter types for each action)
- `UseArchitectActionsReturn` — the hook's return type (~20 action handlers)
- 2 utility functions (`buildTradeOptions`, `formatContractOption`)
- Main hook: `useArchitectActions` (returns all ~20 handlers)

### Proposed split (only if Path A is chosen)

This hook cannot be cleanly split into separate sub-hooks at this time because all 20 handlers
share the same closure state (team data, roster, cap context). The right split is:

```
src/features/architect/GMDashboard/hooks/
  useArchitectActions.types.ts          (~400 lines — all 13 param interfaces +
                                                       UseArchitectActionsReturn type)
  useArchitectActions.normalization.ts  (~200 lines — buildTradeOptions,
                                                       formatContractOption,
                                                       any other pure helpers)
  useArchitectActions.ts                (~5,500 lines — hook body only; imports from above)
```

**Note on domain sub-hooks:** The backlog suggested `useTradeActions`, `useContractActions`,
etc. Defer this. At 6,139 lines the hook's shared closure makes sub-hook extraction a
significant rewrite risk that is out of scope for Wave 4.

### Execution steps

1. **Step 3a — extract types:** Create `useArchitectActions.types.ts`. Move all interface
   and type definitions. The hook file imports them. ✓ typecheck + tests.

2. **Step 3b — extract normalization utilities:** Create `useArchitectActions.normalization.ts`.
   Move `buildTradeOptions`, `formatContractOption`, and any other functions that don't
   reference the hook's closure. ✓ typecheck + tests.

3. Confirm the hook file compiles cleanly and all 20+ test files still pass.

### Validation gate

```
npm run typecheck
npm run validate:project
npm run test:architect -- --reporter=dot
npm run test:fast -- --reporter=dot
```

---

## Step 4a — Map and verify `mutationPipeline.ts` phase boundaries (doc-only)

**Run this before Step 4. Do not skip — the rest of Step 4 depends on accurate boundaries.**

The line ranges below are unverified estimates from the original planning pass. Splitting on
the wrong line at 13,412 lines is the failure mode that turns Wave 4 into a multi-day debug
session. Confirm before cutting.

### What to produce

A short follow-up doc at `work/architect-split/STEP4_LINE_MAP.md` containing:

1. **Verified phase ranges**, derived by reading the file top to bottom:
   - READ start/end line numbers
   - COMPUTE start/end line numbers
   - VALIDATE start/end line numbers
   - PERSIST start/end line numbers
2. **Per-`compute*Result()` analysis** — for each of the 14 compute functions:
   - Line range
   - Whether it is truly pure (calls only the input args + other compute functions)
   - Any forbidden cross-phase calls (compute → read helper, compute → persist helper)
3. **Cross-phase dependency list** — any function in one phase that calls into another phase.
   These are the splitter's landmines.
4. **Confirmed updates to this PLAN.md** — if the unverified line ranges below are wrong,
   update the table in Step 4 to match reality.

### Validation gate

Doc-only step. No tests required. Commit the line map + plan update together.

### Stop condition

If Step 4a reveals that the phases are not cleanly separable (e.g., COMPUTE functions
repeatedly call into READ helpers in ways that can't be untangled), **stop and surface the
finding**. Wave 4 may need to land a smaller Step 4 (types-only extraction) rather than the
full READ/COMPUTE split. This is a "user decision required" blocker per AGENTS.md.

---

## Step 4 — Split `mutationPipeline.ts`

**File:** `src/features/architect/utils/mutationPipeline.ts` (13,412 lines)  
**This is the highest-risk change in Wave 4. Do not start until Steps 1–2 are complete and
Step 4a has produced a verified line map.** (Step 3 is optional — see its notes.)

### Why last

- 60+ files import from it
- It is the central write layer for all Architect state changes
- Trade context modules import FROM it, creating circular-import risk if split carelessly
- Doing Steps 1–2 first maps the domain boundaries; by this point the right split will be clear

### Export surface (current)

68 total exports:

- **51 types** — one per mutation type plus shared context shapes
- **17 functions** — 14 `compute*Result()` functions (one per mutation type) + 3 orchestration
  functions (`runMutation`, `runMutationBatch`, `buildMutationContext`)

### 4 internal phases (**UNVERIFIED — Step 4a confirms these**)

| Phase | Lines (approx) | Content |
|-------|---------------|---------|
| READ | 1–10390 | State loading, context building, all 14 mutation type definitions |
| COMPUTE | 10391–12009 | All 14 `compute*Result()` pure functions |
| VALIDATE | 12010–12147 | Cross-mutation constraint checks |
| PERSIST | 12148–13412 | Firebase write orchestration |

> **Note:** READ at ~10,390 lines is too large to leave as a single module. The proposed
> split below extracts both COMPUTE and READ into their own modules, leaving the main file
> at ~3,000–4,000 lines (VALIDATE + PERSIST + orchestrators).

### Proposed split

```
src/features/architect/utils/
  mutationPipeline.types.ts    (~1,400 lines — all 51 types + 14 mutation type enums)
  mutationPipeline.read.ts     (~9,000 lines — state loading, context building,
                                                buildMutationContext, all read-side helpers;
                                                imports types from .types.ts)
  mutationPipeline.compute.ts  (~3,500 lines — all 14 compute*Result() functions;
                                                imports types from .types.ts,
                                                imports validation from capLegalityValidation,
                                                MUST NOT import from .read.ts)
  mutationPipeline.ts          (~3,000 lines — VALIDATE + PERSIST + runMutation/runMutationBatch
                                                orchestrators; imports from all three submodules;
                                                retains all existing named exports via re-export)
```

**Why this split:** The original three-file plan (types + compute + main) left the main file
at ~8,500 lines — still a monolith. Extracting READ separately is the only way Wave 4
materially improves navigability of this file. The risk is contained because READ is mostly
self-referential; the cross-phase boundary to manage carefully is COMPUTE → READ (compute
must not call back into read helpers, which Step 4a verifies).

**Critical constraint:** Trade context submodules (`tradeContext/`) import directly from
`mutationPipeline.ts`. They must continue to import from the root `mutationPipeline.ts`
orchestrator, NOT from the submodules directly. Do not create barrel imports that could
form cycles. Specifically:

- `.compute.ts` MUST NOT import from `.read.ts` (cycle risk via tradeContext).
- `.read.ts` MUST NOT import from `.compute.ts`.
- Both may import from `.types.ts` (types-only, no runtime cycles possible).
- The orchestrator (`mutationPipeline.ts`) imports from all three.

### Execution steps

1. **Step 4a — line map and verification.** See the Step 4a section above. Must be done and
   committed before any source changes.

2. **Step 4b — extract types:** Create `mutationPipeline.types.ts` with all type/interface
   definitions. The main file imports from it. ✓ full gate.

3. **Step 4c — extract READ:** Create `mutationPipeline.read.ts` with all state-loading,
   context-building, and read-helper functions identified in the Step 4a line map.
   `buildMutationContext` lives here. Main file imports from it. ✓ full gate.

   **Stop condition:** If `.read.ts` accidentally imports from `.compute.ts` or vice versa
   during this step, stop and re-plan. The Step 4a analysis missed a cross-phase dependency.

4. **Step 4d — extract compute functions:** Create `mutationPipeline.compute.ts` with all
   14 `compute*Result()` functions. Confirm each is truly pure (no Firebase calls, no
   closure state from the hook layer, no calls into `.read.ts`). ✓ full gate.

5. **Step 4e — verify all imports.** Run full architect suite. Check for circular imports —
   see "Circular import check" below.

6. Final: all 60+ import sites still use `@/features/architect/utils/mutationPipeline` —
   no changes needed at call sites.

### Circular import check

`madge` is **not** installed in this repo. Choose one of:

- **Preferred:** add it as a one-shot devDep before the check:

  ```
  npm install --save-dev --no-save madge
  npx madge --circular --extensions ts,tsx src/features/architect/utils/mutationPipeline.ts
  ```

  Do not commit the `package.json` change — keep it local for the audit. Or, if it's worth
  keeping for future refactors, ask the user before committing the dependency add.

- **Fallback (no install):** rely on `npm run typecheck` + `npm run build`. Vite/Rollup will
  fail loudly on cycles that break ESM evaluation order, and TypeScript will catch most
  cycles that affect type resolution. This is weaker than `madge` (silent runtime cycles can
  still slip through) but is acceptable if installing madge is undesirable.

### Validation gate (after EACH source-change sub-step — 4b, 4c, 4d)

```
npm run typecheck
npm run validate:project
npm run test:architect -- --reporter=dot
npm run test:cap-sheet-boundary -- --reporter=dot
npm run test:fast -- --reporter=dot
```

After Step 4e, also run the circular-import check (above) and `npm run build` to confirm the
production bundler resolves the new module graph without cycles. A green typecheck does NOT
guarantee a green bundle — Rollup is stricter about runtime cycles than tsc.

---

## Per-session checkpoint protocol

Since each session may be interrupted by usage limits, end every session at a clean checkpoint:

1. All modified files are saved.
2. `npm run typecheck` is clean.
3. `npm run validate:project` is clean (any structural change in this session).
4. The relevant scoped test suite passes with `--reporter=dot`.
5. A git commit is made with a message describing exactly where you stopped.
6. The REFACTOR_BACKLOG.md status column is updated.

When resuming, read this document + the backlog status column to know where to pick up.

---

## What NOT to do

- **Do not batch multiple steps into one commit.** One sub-step, one commit.
- **Do not touch `mutationPipeline.ts` until Steps 1–3 are done.** The surrounding
  context from those splits is required to split it correctly.
- **Do not remove the `export default` namespace object from `capLegalityValidation.ts`.**
  The smoke test asserts it; removing it breaks the test.
- **Do not import from a sibling submodule inside another sibling submodule.** Always
  import up to the orchestrator, or down to shared types. Cross-sibling imports create
  cycles.
- **Do not use relative deep imports from outside the architect feature.** All import
  sites outside `src/features/architect/` use `@/features/architect/...` paths which
  resolve to the orchestrator — this is intentional and must not change.

---

## Out of scope for Wave 4

The following came up in `REFACTOR_BACKLOG.md` but is **not** included here. Do not
opportunistically add it during Wave 4:

- **Architect sub-barrels** (`src/features/architect/utils/index.ts`,
  `GMDashboard/index.ts`, `tradeMachine/index.ts`, `hooks/index.ts`). Wave 2 deferred
  these because architect has 145+ unique import paths from outside the feature. Adding
  barrels mid-split risks circular imports between the new orchestrators and the very
  barrels that re-export from them. Plan barrels as a separate wave **after** Wave 4
  ships.
- **Sub-hooks for `useArchitectActions`** (`useTradeActions`, `useContractActions`, etc.).
  Step 3 explicitly defers these — see Step 3 notes.
- **Further splits of `seasonManager.ts`** beyond the draft-resolution module.
  See Step 1 notes — no other clean section boundaries were found.
