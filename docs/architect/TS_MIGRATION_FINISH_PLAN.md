# Plan: Finish the TypeScript Migration

## Why it feels like you're getting nowhere

The migration has been audit-driven: each pass produces findings, guardrails, return packages, and E-series scope numbers — but the JS files and permissive types remain. The 111 E-series scopes moved all business logic to TS, which was the hard part. But the visible artifacts (33 shim files, 355 `any`, 567 permissive bags) haven't been deleted/fixed because the approach was "audit first, then clean up" — and cleanup kept getting deferred for the next audit.

The path to done is not another audit. It's two concrete lanes of work:

## Lane 1: Delete all JS/JSX files — DONE (2026-03-21)

**Status: COMPLETE.** Zero JS/JSX files remain in the Architect scope.

### What was executed

- **35 files deleted**: 13 JSX component shims, 5 hook JS shims, 3 utility JS shims, 9 shared shims, 2 barrel shims, 1 enforceEligibility wrapper, 2 barrel index.js files
- **3 files converted**: `draftPickUtils.js` → `.ts` (with typed interfaces), `enforceEligibility.js` deleted (retargeted test import to `validateEligibility`), `validatePhase21.test.js` → `.ts`
- **1 test file renamed**: `phase15_trade_payload_entitlements_only_guardrail.test.js` → `.ts` (added param types)
- **~40 test files updated**: Fixed all `.js`/`.jsx` import specifiers across architect, trade, smoke, and validator test suites (26 `capProjections.js` imports alone)
- **12 guardrail tests updated**: Changed from "shim exists with content X" → "shim is deleted" (`fs.existsSync` → `false`)
- **2 Vite aliases removed**: `@/shared/components/ui/filters` and `@/shared/utils/contracts` aliases in `vite.config.js` were only needed to bypass the JS barrels
- **E132 inventory gate rewritten**: Now asserts 0 JS/JSX files and 0 explicit `.js`/`.jsx` Architect import specifiers

### Validation results

- `npm run typecheck` — passes
- `npm run build` — passes (3062 modules)
- `npm run test:architect` — 210 passed, 4 failed (all 4 pre-existing, not introduced by Lane 1)

### Out-of-scope items confirmed

- 10 explicit `.js` imports outside Architect scope (`validationFlags.js`, `basicFormatting.js`, etc.) — not touched per plan
- ~300 JS/JSX files outside Architect scope (pages, features, shared hooks/utils) — separate migration

---

## Lane 2: Type hardening — the 80/20 cut (~16 hours across multiple sessions)

This is the work that turns "converted TypeScript" into "well-typed TypeScript." The 80/20 analysis identified 12 files that account for ~70% of all permissive patterns. Fix them in dependency order.

### Step 2A: Close the type definitions hub (2 hours)

**File:** `src/features/architect/utils/tradeMachine/constants/types.ts`

- 23 index signatures, all on known structures
- Enumerate the actual fields on CapSettings, NormalizedPlayer, TradeExceptionPlayer, TradeExceptionRecord, NormalizedTeam
- Remove every `[key: string]: unknown`
- This unblocks 50+ downstream files that import these types

### Step 2B: Harden the main action hub (2.5 hours)

**File:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

- 13 index signatures across SalaryByYear, LocalContract, LocalBio, ArchitectPlayer
- Close each interface to known fields
- Use discriminated union for LocalContractLegacySalaryInput
- Import schema-backed types from src/schemas/architect.ts where applicable

### Step 2C: Harden the mutation pipeline (3 hours)

**File:** `src/features/architect/utils/mutationPipeline.ts`

- 173 `any` references, mostly via 6 local type aliases
- Replace the aliases with proper types (now possible after 2A and 2B)
- This is the biggest single file — take it methodically

### Step 2D: Batch the data transforms (4 hours total)

Fix these in order:

1. `normalizeTradeInput.ts` — 10 index sigs, 1.5 hours
2. `contractNormalization.ts` — 8 index sigs, 1 hour
3. `resolveOffseasonTransition.ts` — 45 `any`, 1.5 hours

### Step 2E: Batch the utilities (3 hours total)

Fix these as a batch:

1. `salaryMargin.ts` — 7 index sigs, 45 mins
2. `matchingValues.ts` — 7 index sigs, 45 mins
3. `consentUtils.ts` — 6 index sigs, 45 mins
4. `validateInput.ts` — 6 index sigs, 45 mins

### Step 2F: Clean up the state hook (30 mins)

**File:** `src/features/architect/GMDashboard/hooks/useArchitectState.ts`

- 5 index signatures — straightforward after 2A/2B

### Step 2G: Validate after each batch

Run `npm run typecheck` and `npm run test:architect -- --reporter=dot` after each step.

**Result:** ~70% of permissive patterns eliminated. Architect qualifies as "partially hardened approaching well-typed."

---

## What we are NOT doing (and why)

- **UI component type hardening** (TradeTeamCard, RosterVisual, FreeAgentPool) — diminishing returns. Render-time data shaping is harder to fully type and the payoff is low.
- **Adding Zod runtime validation** — the codebase validates at the Firestore boundary + tests. Adding Zod is a different project.
- **Fixing the 10 out-of-scope explicit .js imports** (validationFlags.js, basicFormatting.js) — these are outside the Architect scope. Can be addressed separately.
- **Reaching zero `any`** — after the 80/20 cut, the remaining ~50-80 `any` are in scattered locations with low impact. Chasing them has high cost, low value.

---

## Execution order

**Do Lane 1 first.** It's fast, it's visible, and it eliminates the "33 JS files still exist" finding that makes every audit say "not done." After Lane 1, the migration IS done structurally.

**Then do Lane 2 in 2-3 sessions** following the dependency order (2A → 2B → 2C → 2D → 2E → 2F). Each step is self-contained and produces a working codebase.

## Verification

- After Lane 1: `npm run typecheck && npm run build && npm run test:architect -- --reporter=dot`
- After each Lane 2 step: `npm run typecheck && npm run test:architect -- --reporter=dot`
- Final: Run the closeout audit one last time to confirm the verdict changes.
