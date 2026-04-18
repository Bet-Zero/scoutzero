# JS → TS Conversion — Living Plan

**How this doc works:** When the user says "keep working on docs/TS_CONVERSION_NEXT_STEPS.md," find the first step below with status `TODO` or `IN PROGRESS`, do it, then update the status to `DONE` (or leave it `IN PROGRESS` with a note if blocked or partial). One step per session unless a step is trivial. Do not skip ahead. Do not invent new steps unless the user explicitly asks to revise this plan. Checkpoints, reviews, or temporary branches inside this doc must always reconnect to a later numbered step; they are not standalone end states. When all steps are `DONE`, tell the user the plan is complete and ask what's next.

**Commit & status hygiene (REQUIRED — do not skip):**

1. Use the commit message specified in each step. Never use generic placeholder text.
2. BEFORE committing source changes, edit this file to change the step's `**Status:** TODO` line to `**Status:** DONE` and append a one-line completion note with today's date.
3. Include the plan-doc update in the same commit as the step's work.
4. If you cannot complete the step in one session, change the status to `IN PROGRESS` and add a brief note describing where you left off.

**Background context (read before starting any step):**

- 297 JS/JSX files / ~62k lines remain unconverted. 565 TS/TSX files already migrated.
- The goal of this plan is NOT to convert all 297 files. It is to convert the high-leverage subset ("Pile A"): Firestore helpers, shared utils, shared hooks, firestore paths, and constants. These are the files where typed shapes will cascade to the most downstream code.
- Pile B in this plan means the remaining non-Architect feature hooks and feature utils / bridges under `src/features/**/hooks/**` and `src/features/**/utils/**`.
- Pile C (UI components under `features/*/**`) is explicitly deferred until the final closeout step. Convert those opportunistically when you touch them, not as part of the main numbered conversion flow unless the user later asks for a dedicated UI plan.
- User-facing framing: the user is not a professional engineer. Explain tradeoffs in plain terms. When a conversion surfaces duplication or bag types across multiple files, flag it — that's the "debt pointing at itself" the conversion is meant to reveal.

**Plan continuity invariant (applies to the entire doc):**

- Piles are phases inside one living plan, not disconnected plans.
- Completing one pile never throws the document off route; it only advances the plan to the next numbered step.
- Reviews, audits, cleanups, and branch decisions are allowed only if they are written as bounded numbered steps that explicitly reconnect to the next pile or the final closeout step.
- Only the final closeout step may declare the plan complete.
- If future piles are added later, they must be inserted into the numbered flow with an explicit resume point and an explicit path back to final closeout.

**Current planned flow:**

- Steps 1–7: Pile A conversion + checkpoint decision
- Steps 8–9: bounded Pile A reintegration review / blocker cleanup loop
- Steps 10–12: Pile B audit + conversion
- Step 13: explicit final closeout and Pile C handling

**Universal constraints (apply to every step):**

- One file per commit for Pile A Firestore helpers (high-stakes). Batches OK for smaller leaf utils.
- No `any` as an escape hatch. If conversion surfaces a shape you can't type cleanly, STOP and write a comment explaining what you'd need to know. Do not cast the problem away — the point of this plan is to NOT reintroduce the debt we just cleaned up in the architect hardening arc.
- At system boundaries (Firestore reads, URL params, external APIs) use Zod (see existing Zod usage in `src/features/architect/**` for patterns). Cast + Zod is correct; cast alone is not.
- Run `npm run typecheck` and the relevant test subset after each conversion. If converting a file surfaces type errors at call sites, fix the call sites — those errors are the point.
- If a file being converted has zero tests, add at least a smoke test before converting. Untested logic code is the riskiest to convert without a safety net.
- If a conversion reveals that a function is duplicated across multiple files with slight variations, note it in this plan as a follow-up item at the bottom — don't try to de-duplicate in the same step.
- If a checkpoint step inserts review work or follow-up cleanup, the doc must also add the explicit later numbered step where the main conversion path resumes. Never leave the plan on a side track with no written return path.

---

## Step 1 — Audit Pile A and produce conversion order

**Status:** DONE  
Completed 2026-04-18: `docs/TS_CONVERSION_PILE_A_AUDIT.md` created — 34 files catalogued across 5 groups, import graph resolved, 5-wave conversion order established, 6 pre-populated follow-up items noted.

**Goal:** A companion doc `docs/TS_CONVERSION_PILE_A_AUDIT.md` that lists every file in Pile A with: file path, line count, current exports, import graph (what imports it, what it imports), recommended conversion order (leaves first), and a one-sentence note on what the file does.

**Instructions:**
Scope is:

- `src/firebase/*.js` (3 files: `rosterHelpers.js`, `rankerHelpers.js`, `listHelpers.js`)
- `src/shared/utils/**/*.js` (~18 files across subdirs including `filtering/`, `formatting/`, `roles/`)
- `src/shared/hooks/*.js` (~6 files)
- `src/data/firestorePaths.js`
- `src/constants/*.js` (~6 files)

For each file, record: path, line count, top-level exports, where it's imported from (grep for the import), and a one-sentence description. Group by subdirectory. At the end of the doc, produce a "Recommended conversion order" section that orders files leaf-first (files that only export, don't import other Pile A files, go first; aggregator files go last).

Do NOT convert any files in this step. This is a read-only survey.

**Constraints specific to this step:**

- Doc-only work. No `.ts` files created.
- Keep the audit concise — single line per file is fine for simple utils. Expand for the Firestore helpers (they'll be higher-stakes).
- Skip `.test.js` / test files from the audit — tests are Pile D, handled elsewhere.

**Done when:** `docs/TS_CONVERSION_PILE_A_AUDIT.md` exists with every Pile A file listed + a recommended conversion order. Commit message: `docs: audit Pile A for JS-to-TS conversion`.

---

## Step 2 — Tooling sanity check (convert one small constant file)

**Status:** DONE  
Completed 2026-04-18: `src/constants/styles.js` → `styles.ts` with `as const` and exported `Styles` type. Typecheck live-confirmed (deliberate error surfaced correctly). Build and smoke tests pass.

**Goal:** Prove the conversion pipeline actually works before committing to larger files. Convert the smallest, safest file in Pile A (likely `src/constants/yearDefaults.js` or a similar pure-data constant file) to TypeScript. Verify typecheck picks up the new file, build still succeeds, tests still pass.

**Instructions:**
Pick the smallest file from the audit that has no imports (pure exports). Rename `.js` → `.ts`. Add explicit types to every exported constant and function. Remove any JSDoc type annotations (they're redundant now). Run in order:

1. `npm run typecheck` — should pass cleanly and actually include the new file (spot-check by temporarily introducing a type error in the file; `typecheck` should catch it; then revert).
2. `npm run build` — should succeed.
3. `npm test` (or scoped subset if slow) — should pass.
4. Grep for imports of the old `.js` path — modern bundlers resolve `.js` → `.ts` silently, but verify none of the call sites have a hardcoded `.js` extension in the import path.

If any step fails, STOP and document the blocker as an `IN PROGRESS` note. Fix the blocker before proceeding with later steps.

**Constraints specific to this step:**

- If the "smallest file" candidate turns out to have surprising complexity, pick the next smallest. Document why.
- Do NOT convert multiple files in this step — the point is to validate the pipeline on a single controlled case.

**Done when:** One Pile A file is `.ts`, typecheck/build/tests all pass, confidence that the pipeline works. Commit message: `refactor: convert <filename> to TypeScript (pipeline sanity check)`.

---

## Step 3 — Convert `src/constants/**` and `src/data/firestorePaths.js`

**Status:** DONE  
Completed 2026-04-18: All 5 remaining constants files and `firestorePaths.js` converted. `as const` + derived types on `teamList`; explicit `SubRole`/`SubRoleGroup` union types on `SubRoleMasterList`; `firestorePaths` simplified from spread-of-string[] to direct constant args (TypeScript spread TS2556). Typecheck clean, zero call-site errors.

**Goal:** All files under `src/constants/` and `src/data/firestorePaths.js` converted to TypeScript with explicit exported types. These are pure-data files that flow everywhere — typing them gives downstream files something to narrow against.

**Instructions:**
Convert each file one at a time (or in a single commit if all are trivial). For each:

1. Rename `.js` → `.ts`.
2. Add explicit types to every exported value. Use `as const` for literal arrays/objects where appropriate so downstream inference is narrow (e.g., `export const TEAM_CODES = ['ATL', 'BOS', ...] as const`).
3. Export named types derived from the constants where they'll be useful downstream (e.g., `export type TeamCode = typeof TEAM_CODES[number]`).
4. Run typecheck after each file. Fix any call sites that break — those breaks are the whole point.

If a call-site break reveals that the constant is being used in a way inconsistent with its declared type (e.g., code passes a string that isn't in the literal union), DO NOT widen the type to hide it. Fix the call site or flag it in this plan as a follow-up.

**Constraints specific to this step:**

- One commit per file is fine. Bundling is also fine IF all files convert cleanly.
- `as const` is strongly preferred for string/number literal arrays — it's free narrowing.
- Do NOT convert constants that are only used by unconverted UI components unless the UI conversion is trivial and within scope.

**Done when:** All `src/constants/*.js` and `src/data/firestorePaths.js` are `.ts` with explicit types; typecheck clean; tests pass. Commit message (per file or bundled): `refactor: convert <file/subdir> to TypeScript`.

---

## Step 4 — Convert `src/shared/utils/**`

**Status:** DONE  
Completed 2026-04-18: All 18 utils files converted across Wave 1 (pure leaves), Wave 2 (formatting + roles barrels), and Wave 3 (filtering). Key findings: (1) `newSchemeSelectors` has zero callers and its expected schema shape (bio, team.code, evaluations) diverges from `SeasonDocZ` — flagged in a prominent comment; (2) `salaryYear` in `PlayerFilters` is `number`, not `string` — corrected; (3) barrel import `@/shared/utils/roles` fails with `moduleResolution: "bundler"` — direct path required.

**Goal:** All ~18 utility files under `src/shared/utils/` converted to TypeScript. Function parameters and return types explicit. No `any` unless genuinely unavoidable (and documented if so).

**Instructions:**
Use the conversion order from Step 1's audit. Leaves first (files that don't import other Pile A files). One file per commit.

For each file:

1. Rename `.js` → `.ts`.
2. Add parameter and return types to every exported function. Prefer specific types over `unknown`; prefer `unknown` over `any`.
3. If a function's actual usage reveals it accepts multiple shapes, write a union type or a generic — don't bag-type it with `Record<string, unknown>`.
4. Run typecheck. Fix call-site errors.
5. If a call site error reveals the function was being passed data it doesn't actually handle correctly (a latent bug), STOP. Flag it to the user. Do not silently fix-forward with a cast.

If the utils subdirectory contains clear duplication (e.g., three formatting helpers that do 90% the same thing), flag it in this plan's follow-up section. Do NOT refactor the duplication in this step — conversion first, consolidation later.

**Constraints specific to this step:**

- One commit per file. This creates a clean revert path if one conversion reveals cascading issues.
- Utility functions are usually pure — if a function has a side effect (writes to Firestore, mutates arguments, etc.), flag it in a comment in the converted file.

**Done when:** All `src/shared/utils/**/*.js` files are `.ts`; typecheck clean; tests pass. Commit messages per file: `refactor: convert <filename> to TypeScript`.

---

## Step 5 — Convert `src/shared/hooks/**`

**Status:** DONE  
Completed 2026-04-18: All 6 JS hooks converted. `useClickOutside` (typed ref/handler), `useAuth` (Firebase `User` type, explicit `UseAuthResult`), `useImageDownload` (typed `DownloadFn`, worked around TS DOM lib gap for `FontFaceSet.add`), `useFirebaseQuery` (generic `<T>` with `UseFirebaseQueryResult<T>`, proper `Error | null` for error state), `useSeasonPlayerData` (deprecated, typed with `SimplePlayer` and `SeasonPlayerDiagnostics`), `usePlayerDetail` (returns `PlayerV2 | null`, Zod validation in DEV, typed subcollection records). Smoke test added for `useFirebaseQuery` at `src/tests/shared/hooks.smoke.test.tsx`. Also fixed `global-shims.d.ts` missing exports for `firestorePaths` module and added explicit return types to `firestorePaths.ts` to resolve TS 5.9 shim-layer inference issue.

**Goal:** All ~6 files under `src/shared/hooks/` converted to TypeScript with properly typed parameters, return values, and internal state.

**Instructions:**
React hooks benefit a lot from TS because the `useState`/`useEffect`/`useCallback` generics pin down what can flow through them. For each hook file:

1. Rename `.js` → `.ts` (or `.tsx` if it returns JSX).
2. Type every `useState<T>` explicitly — don't rely on inference from initial value if the state can become null/undefined later.
3. Type callback parameters and return values.
4. Export the hook's return type if callers need to destructure it with types.
5. Run typecheck, fix call-site errors.

**Constraints specific to this step:**

- If a hook uses `useReducer`, write explicit `Action` and `State` types — these are common sources of type confusion in JS hooks.
- `.ts` for pure logic hooks, `.tsx` only if the file contains JSX.

**Done when:** All `src/shared/hooks/*.js` files are `.ts` or `.tsx`; typecheck clean; tests pass. Commit message per file: `refactor: convert <hook-name> to TypeScript`.

---

## Step 6 — Convert `src/firebase/*.js` (Firestore helpers)

**Status:** DONE  
Started 2026-04-18: `src/firebase/rosterHelpers.js` → `rosterHelpers.ts` with explicit document/update types, Zod-validated reads, and direct smoke coverage at `src/tests/roster/rosterHelpers.smoke.test.ts`. Validation so far: `npm run typecheck`, `npm run validate:project`, `npm run test:roster -- --reporter=dot`, targeted UI roster test, and `npm run build`.
Updated 2026-04-18: `src/firebase/rankerHelpers.js` → `rankerHelpers.ts` with local Zod schemas for session/setup/result reads, typed create/update payloads, and direct CRUD smoke coverage at `src/tests/ranker/rankerHelpers.smoke.test.ts`. Also extended `tests/__mocks__/firebase.js` with `limit()` query support because the new smoke path exercises ordered+limited queries. Validation for this slice: `npm run typecheck`, `npm run validate:project`, `npm run test:node -- --reporter=dot src/tests/ranker/rankerHelpers.smoke.test.ts tests/rankerSessionSerialization.test.js`, and `npm run build`. Remaining: `listHelpers.js`. Full suite intentionally not run because AGENTS.md requires the exact phrase `RUN FULL SUITE`.
Completed 2026-04-18: `src/firebase/listHelpers.js` → `listHelpers.ts` with Zod-validated list/tier-list reads, typed ownership-guarded writes, preserved coded tier-list errors, and direct CRUD smoke coverage at `tests/listHelpers.smoke.test.ts`. Final validation: `npm run typecheck`, `npm run validate:project`, `npm run build`, and `npm run test:node -- --reporter=dot tests/listHelpers.smoke.test.ts tests/tierListModePersistence.test.js tests/tierSaveAsList.test.js tests/tierMakerListOrder.test.js`. Full suite intentionally not run because AGENTS.md requires the exact phrase `RUN FULL SUITE`.

**Goal:** `rosterHelpers.js`, `rankerHelpers.js`, `listHelpers.js` converted to TypeScript with explicit types for every read and write. Every Firestore read that crosses back into application code validates the shape with Zod (add Zod schemas where absent).

**Instructions:**
This is the highest-stakes step in the plan. Firestore helpers are the system boundary where untyped external data enters the app. Getting these typed correctly is the whole reason the conversion is worth doing.

For each helper file:

1. Rename `.js` → `.ts`.
2. For every `db.collection().doc().get()` style read: type the return using a Zod-parsed shape, not a bare cast. Look at existing Zod usage in `src/features/architect/**` for patterns.
3. For every write: type the input parameter. Callers should not be able to pass arbitrary objects.
4. Export named types for every document shape (e.g., `export type Roster = z.infer<typeof RosterSchema>`).
5. After conversion, run `npm run typecheck` and the full test suite. Firestore helper bugs cause data loss — do not rush this step.

If a read reveals that real Firestore documents have inconsistent shapes (some docs have field X, some don't), that is the most valuable finding in this entire plan. Document it in the file as a comment, and note it in this plan's follow-up section — it likely means existing data needs a migration script.

**Constraints specific to this step:**

- One commit per file. No bundling.
- If a write site in the helper accepts a partial shape (e.g., `updateRoster(id, { name })`), use `Partial<Roster>` or a dedicated update type. Do not widen to `Record<string, unknown>`.
- If Zod isn't already a dependency in this area, add it (`npm install zod` if needed — but check first; it's likely already installed given architect usage).

**Done when:** All three helper files are `.ts` with Zod-validated reads and typed writes. Typecheck clean. Full test suite passes. Commit messages: `refactor: convert <helper> to TypeScript with Zod validation`.

---

## Step 7 — Checkpoint: re-scope Pile B and Pile C

**Status:** DONE  
Completed 2026-04-18: User chose Option C. Clarification added 2026-04-18: in this plan, Option C means a bounded Pile A reintegration review + cleanup loop that returns to Pile B inside the same numbered sequence. It does not close or abandon the plan.

**Goal:** Pile A is done. Decide whether Pile B starts immediately or whether the plan inserts a bounded review / cleanup checkpoint first.

**Instructions:**
This step is a judgment call, not a conversion. After Steps 1–6 are done, answer these questions and append the answers to this plan as a "Phase 2 Decision" section:

1. How many type errors did Pile A conversion surface at call sites in Pile B/C files? (Higher = Pile B/C has more hidden debt.)
2. Did any conversion reveal shape inconsistencies in Firestore data? (Yes = a data migration is higher priority than more conversions.)
3. Were there any duplicated utilities that should be consolidated before further conversion? (Yes = consolidation step is higher priority.)
4. How much real time did Pile A take vs the estimate? (Calibrate appetite for Pile B.)

Based on the answers, propose one of:

- **Option A:** Proceed directly into Pile B Step 10+ work.
- **Option B:** Insert a lightweight Pile A reintegration review, resolve only confirmed resume blockers, then continue into Pile B.
- **Option C:** Insert a deeper Pile A reintegration review and cleanup checkpoint for cross-cutting contract seams, then continue into Pile B.

Present all three options to the user with a recommendation. Do not unilaterally pick one.

**Done when:** "Phase 2 Decision" section appended to this plan with answers to the four questions and a recommendation. User has chosen A, B, or C, and the later numbered steps explicitly show how that path returns to Pile B and then to final closeout.

---

## Phase 2 Decision

**Date:** 2026-04-18

### 1. How many type errors did Pile A surface at call sites in Pile B/C files?

Observed answer: **0 direct Pile B/C call-site edits landed during Pile A.**

Evidence from the 2026-04-18 conversion commits:

- The constants/utils/hooks/helper conversion commits only touched Pile A files, tests, `src/global-shims.d.ts`, and `docs/TS_CONVERSION_NEXT_STEPS.md`.
- No `src/features/*`, `src/pages/*`, or other Pile B/C source files were edited as part of the conversion wave.

Interpretation:

- Good news: Pile A conversions did not blow up downstream feature code.
- Important caveat: this does **not** prove Pile B/C is clean. Many downstream callers are still JS, so some debt is still masked because JS callers do not force strict type alignment the way TS callers would.

### 2. Did any conversion reveal shape inconsistencies in Firestore data?

Observed answer: **No confirmed Firestore document-shape inconsistency requiring a migration was found during Pile A.**

What *was* surfaced:

- `usePlayerDetail.ts`, `listHelpers.ts`, `rankerHelpers.ts`, and `rosterHelpers.ts` now all have Zod-validated read boundaries, so invalid shapes should fail loudly instead of drifting silently.
- Step 6 did expose an **ownership-policy inconsistency** across user-authored collections:
  - `listHelpers.ts` can auto-claim legacy docs with missing `ownerUid`
  - `rankerHelpers.ts` treats missing `ownerUid` as invalid
  - `rosterHelpers.ts` still has no `ownerUid` / `userId` guard at all

Interpretation:

- This is not a data-shape migration blocker.
- It **is** a product/security contract question that is probably higher-value than blindly converting deeper feature files.

### 3. Were there duplicated utilities that should be consolidated before further conversion?

Observed answer: **Yes.**

Concrete duplicates or contract seams already recorded in Follow-up items:

- `filterHelpers.ts` duplicates the stat abbreviation map from `statFilters.ts`
- `roleUtils.ts` duplicates position-label mapping logic between `POSITION_MAP` and `getPlayerPositionLabel`
- `newSchemeSelectors.ts` is dead code and expects a schema shape that does not match `SeasonDocZ`
- `global-shims.d.ts` still shadows real `.ts` exports and can hide new exports during future conversions

Interpretation:

- None of these blocked Pile A.
- They are the kind of small-but-real seams that become more expensive if Pile B expands on top of them unchanged.

### 4. How much real time did Pile A take vs the estimate?

Observed answer: **No explicit estimate was written into this plan, so only actual runtime is knowable.**

Measured from the 2026-04-18 commit trail:

- Step 1 audit commit: `02:11:45` ET
- Final Step 6 commit: `05:39:46` ET
- Execution time from Step 1 through Step 6: about **3 hours 28 minutes**
- If the initial plan-creation commit at `01:46:58` ET is included, total time is about **3 hours 53 minutes**

Interpretation:

- Pile A moved faster than a multi-session migration would suggest.
- That speed is partly because Pile A is the highest-leverage, lower-blast-radius part of the tree.
- Pile B is likely slower per file because it sits closer to feature logic and JS callers.

### Options For The User

- **Option A — Resume directly into Pile B:** Start the Pile B audit and conversion steps immediately. Best if the goal is maximum TS coverage now. Tradeoff: wider blast radius, more feature-specific churn, and less shared leverage per file than Pile A delivered.
- **Option B — Insert a lightweight review loop, then resume:** Recheck Pile A in totality, fix only confirmed resume blockers, then continue into Pile B. Best if the goal is to verify the shared layer really hangs together before widening scope.
- **Option C — Insert a deeper reintegration review, then resume:** Use the next cycle to review and, where necessary, clean up the higher-signal contract seams Pile A exposed before continuing into Pile B. Best if the goal is correctness and clearer contracts before deeper TS rollout, but still within the same plan.

### Recommendation

**Recommend Option C.**

Reasoning:

- Pile A already captured the highest-leverage shared surfaces.
- No Firestore shape migration was uncovered, so there is no emergency cleanup blocking the app.
- The most valuable new information from the conversion was not "convert more files immediately"; it was that ownership rules across user-authored Firestore helpers are inconsistent, and several shared utility contracts are still duplicated or shadowed.
- Fixing those seams first should make the later Pile B conversion cleaner and reduce the chance of converting bad assumptions into typed bad assumptions.
- This is a checkpoint recommendation, not an exit ramp. The plan should resume once the review loop is complete.

Conservative fallback:

- If the user wants to minimize detour time while still sanity-checking Pile A as one system, **Option B** is a reasonable second choice.

### User Decision

**Chosen option:** `C`

Decision recorded 2026-04-18: Insert a deeper Pile A reintegration review + cleanup checkpoint before Pile B. In this document, that means complete Steps 8 and 9, then resume the main migration path at Step 10. The plan remains open until the final closeout step is done.

---

## Step 8 — Review Pile A in totality and classify resume blockers

**Status:** DONE  
Completed 2026-04-18: Pile A reintegration review recorded. `npm run typecheck` and `npm run build` passed; `npm run test:diff -- --reporter=dot` exposed one stale smoke-test import (`@/constants/yearDefaults.js`), fixed in `tests/smoke/imports.smoke.test.js`, and the rerun passed. Resume blockers narrowed to the shim/barrel layer feeding `any` into future Pile B conversions.

**Goal:** Recheck the completed Pile A conversion as one coherent system, not as six isolated steps. Confirm what actually works together, what follow-up items are real blockers for Pile B, and what can safely be deferred.

**Instructions:**
This is the review loop that Option C was meant to trigger. Read the converted Pile A surfaces together:

- `src/constants/**`
- `src/data/firestorePaths.ts`
- `src/shared/utils/**`
- `src/shared/hooks/**`
- `src/firebase/*.ts`
- the existing follow-up items at the bottom of this doc

Then:

1. Run `npm run typecheck`.
2. Run `npm run build`.
3. Run `npm run test:diff -- --reporter=dot`.
4. Re-read every follow-up item and classify it in a new `Pile A Reintegration Review` section as either:
   - `Resume blocker` — should be addressed before Pile B
   - `Safe to defer` — can remain on the follow-up list while Pile B proceeds
5. Write a short explanation for each classification in plain language.
6. End the review section with an explicit recommendation for what Step 9 should fix, if anything.

**Constraints specific to this step:**

- Review-first step. Do NOT start Pile B conversion here.
- Only make source changes if the review exposes a tiny, obvious bug that would make the review notes false if left unfixed. Bigger fixes belong in Step 9.
- If a blocker requires user-facing product direction, ask one plain-language question and mark the step `BLOCKED` until answered.

**Done when:** A `Pile A Reintegration Review` section has been appended to this doc, every follow-up item is classified as `Resume blocker` or `Safe to defer`, and Step 9 has a truthful scoped input. Commit message: `docs: record Pile A reintegration review`.

---

## Pile A Reintegration Review

**Date:** 2026-04-18

### Validation results

- `npm run typecheck` — passed.
- `npm run build` — passed. Existing Vite warnings remain, but they are the same non-blocking warnings already visible before this review (`Browserslist` age, externalized `fs`, dynamic-import chunking, large chunk warning).
- First `npm run test:diff -- --reporter=dot` run — failed in `tests/smoke/imports.smoke.test.js` because the test still imported `@/constants/yearDefaults.js`, which no longer exists after the Pile A conversion.
- Review fix applied during Step 8: updated `tests/smoke/imports.smoke.test.js` to import `@/constants/yearDefaults`.
- Second `npm run test:diff -- --reporter=dot` run — passed.

### Follow-up item classification

- **`firestorePaths.js` `splitPath` indirection removed (Step 3) — `Safe to defer`.**  
  Live `firestorePaths.ts` typechecks, builds, and is already used successfully by converted Pile A code. This only becomes a real issue if collection constants ever become multi-segment paths, which Pile B does not depend on.

- **`newSchemeSelectors.ts` dead code + schema mismatch (Step 4) — `Safe to defer`.**  
  The issue is real, but the file has zero callers and the current review confirmed it still sits unused. It should not be wired into new work until the schema mismatch is reconciled, but it does not block Pile B conversion today. Note: the old follow-up text points to the wrong subdirectory; the live file is `src/shared/utils/selectors/newSchemeSelectors.ts`.

- **`filterHelpers.ts` stat abbreviation map duplicates `statFilters.ts` (Step 4) — `Safe to defer`.**  
  This is duplicate mapping logic, not a broken contract. It is worth consolidating later, but leaving it as-is does not prevent truthful typing from flowing into Pile B.

- **`roleUtils.ts` POSITION_MAP vs getPlayerPositionLabel duplication (Step 4) — `Safe to defer`.**  
  Same pattern as `filterHelpers`: duplicated mapping logic, but no current integration failure. Clean up later if it starts causing drift.

- **`moduleResolution: "bundler"` and barrel imports (Step 4) — `Resume blocker`.**  
  Pile B files already import `@/shared/utils/filtering` and `@/shared/utils/roles` heavily. This review confirmed those barrels are part of the live path into Pile B, so Step 9 needs to make the typed import strategy honest before Pile B starts: either keep the barrels truly TS-visible or move the affected imports to direct typed subpaths.

- **`global-shims.d.ts` overrides actual TS file exports (Step 5) — `Resume blocker`.**  
  This review confirmed the shim file still declares converted Pile A modules like `@/shared/utils/filtering`, `@/shared/utils/roles`, `@/data/firestorePaths`, `@/shared/hooks/usePlayerDetail`, `@/shared/hooks/useAuth`, `@/shared/hooks/useImageDownload`, and other shared helpers as `any`. If Pile B conversion starts with those declarations still in place, the main value of Pile A is blunted because downstream TS files will see `any` instead of real types.

- **`rosterHelpers.ts` still has no ownership guard (Step 6) — `Safe to defer`.**  
  The old follow-up note is stale. The live `rosterHelpers.ts` now creates with `ownerUid`, auto-claims legacy ownerless docs, and enforces ownership on guarded reads / updates / deletes. The remaining policy seam is narrower: `listHelpers.ts` and `rosterHelpers.ts` auto-claim legacy ownerless docs, while `rankerHelpers.ts` treats missing `ownerUid` as invalid. That inconsistency is real, but it does not block Pile B type flow.

### Review conclusion

Pile A holds together as one system well enough to continue. The review did not uncover a broad runtime regression from the conversion work. The blockers are narrower and more practical:

- Pile A types are not yet guaranteed to flow into Pile B because the shim layer still overrides several converted modules as `any`.
- The barrel-import story for `@/shared/utils/filtering` and `@/shared/utils/roles` needs to be made explicit before Pile B relies on those surfaces for real types.

### Step 9 recommendation

Step 9 should stay narrow and fix only the resume blockers proven by this review:

1. Remove or sharply narrow the Pile A-related `declare module` blocks in `src/global-shims.d.ts` so converted modules stop collapsing to `any`.
2. Make the Pile B-facing import strategy explicit for `@/shared/utils/filtering`, `@/shared/utils/roles`, `@/data/firestorePaths`, and the converted shared hooks:
   either preserve typed barrels cleanly or move affected imports to direct typed subpaths.
3. While touching that area, refresh the stale follow-up wording that this review disproved (`rosterHelpers` ownership note and the incorrect `newSchemeSelectors` path), but do not widen into unrelated cleanup.

No additional product-direction question is needed before Step 9. The ownership-policy inconsistency can remain deferred unless the Step 9 implementation proves it is directly entangled with the shim/barrel fix.

---

## Step 9 — Resolve Pile A resume blockers before Pile B

**Status:** DONE  
Completed 2026-04-18: Removed stale Pile A/shared TS declarations from `src/global-shims.d.ts` so real typed exports now flow into downstream TS. Typecheck exposed and fixed narrow downstream contract issues in readonly team-list usage, numeric route/team IDs, trade export year/team normalization, and roster helper optional-player shapes. Validation passed: `npm run typecheck`, `npm run build`, `npm run test:diff -- --reporter=dot`, `npm run test:roster -- --reporter=dot`, and `npm run test:architect -- --reporter=dot`.

**Goal:** Fix only the issues that Step 8 proves should block Pile B from starting. Keep the cleanup narrow and tied to the review.

**Instructions:**
Use Step 8's blocker list as the source of truth. Work through the blockers in priority order. Likely candidates include:

- Firestore ownership-policy inconsistency across `listHelpers.ts`, `rankerHelpers.ts`, and `rosterHelpers.ts`
- `global-shims.d.ts` shadowing real `.ts` exports
- dead code or schema mismatch that would mislead future Pile B conversion work
- duplicated shared maps or contracts, but only if Step 8 proves they are real resume blockers

For each blocker:

1. Fix the code or documentation seam directly.
2. Run `npm run typecheck`.
3. Run the narrowest relevant validation command(s) and always append `--reporter=dot` to test scripts.
4. Update this plan's follow-up list and Step 9 completion note so it is clear what was fixed and what remains deferred.

**Constraints specific to this step:**

- Do NOT widen into unrelated feature work.
- If Step 8 finds zero resume blockers, mark this step `DONE` with a note saying no code changes were required and move directly to Step 10.
- If a blocker needs a product-direction decision, stop and ask in plain language rather than guessing.

**Done when:** Every Step 8 `Resume blocker` is resolved, reclassified with user approval, or explicitly deferred with a written reason that still allows Pile B to begin honestly. Commit message: `refactor: resolve Pile A blockers before Pile B`.

---

## Step 10 — Audit Pile B and produce conversion order

**Status:** DONE  
Completed 2026-04-18: `docs/TS_CONVERSION_PILE_B_AUDIT.md` created — 19 files catalogued across filters, profile, ranker, roster, table, and tierMaker. Conversion order now splits Step 11 utility/bridge leaves from Step 12 hooks and flags Firestore, storage, routing, and cross-feature boundaries.

**Goal:** Create a companion doc `docs/TS_CONVERSION_PILE_B_AUDIT.md` that lists every Pile B file with path, line count, exports, import graph, feature owner, and recommended conversion order.

**Instructions:**
Scope is the remaining non-Architect feature logic files under:

- `src/features/**/hooks/**/*.js`
- `src/features/**/utils/**/*.js`

As of 2026-04-18, this is currently 19 files across `filters`, `profile`, `ranker`, `roster`, `table`, and `tierMaker`.

For each file, record:

- path
- line count
- top-level exports
- what it imports
- what imports it
- one-sentence description of what it does
- whether it depends directly on newly converted Pile A surfaces

Group by feature. End with a `Recommended conversion order` section that is leaf-first and notes any files that should move together because of tight coupling.

Do NOT convert any files in this step.

**Constraints specific to this step:**

- Audit only the hook / util / bridge layer. Do not pull `.jsx` UI components into the formal scope here.
- Keep the doc concise, but call out high-risk files that touch persistence, local storage, routing, or cross-feature shared logic.

**Done when:** `docs/TS_CONVERSION_PILE_B_AUDIT.md` exists with every Pile B file listed and a recommended conversion order. Commit message: `docs: audit Pile B for JS-to-TS conversion`.

---

## Step 11 — Convert Pile B feature utils and bridges

**Status:** DONE
Started 2026-04-18: `src/features/roster/utils/contractUtils.js` → `contractUtils.ts` with explicit contract/player input types. Added direct roster smoke coverage for `isTwoWayContract` and updated the roster utils barrel to resolve the converted file. Validation so far: `npm run typecheck`, `npm run validate:project`, and `npm run test:roster -- --reporter=dot`.
Updated 2026-04-18: `src/features/roster/utils/rosterUtils.js` → `rosterUtils.ts` with generic `RosterShape<T>`, named normalized/missing roster player types, and an explicit missing-player type guard. Updated the roster barrel to resolve the converted file. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:roster -- --reporter=dot`.
Updated 2026-04-18: `src/features/ranker/utils/saveAsListBridge.js` → `saveAsListBridge.ts` with typed ranker list items, injected list helper signatures, saved-list payload shape, and unknown-safe error messages. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:node -- --reporter=dot tests/rankerSaveAsList.test.js`.
Updated 2026-04-18: `src/features/profile/utils/profileHelpers.js` → `profileHelpers.ts` with typed player summary maps, profile detail keys, blurb/video return shapes, and the stale `global-shims.d.ts` declaration removed so callers see real helper types. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:scouting -- --reporter=dot`.
Updated 2026-04-18: `src/features/ranker/utils/rankerLocalDraft.js` → `rankerLocalDraft.ts` with typed draft/patch/setup/comparison shapes, guarded JSON parsing for `sessionStorage`, and preserved skipped-pair Set serialization helpers. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:node -- --reporter=dot tests/rankerLocalDraft.test.js`.
Updated 2026-04-18: `src/features/ranker/utils/rankingEngine.js` → `rankingEngine.ts` with exported ranker player/comparison/pair/cache types, typed graph/closure internals, and preserved runtime guards for invalid closure-cache inputs. Updated explicit `.js` test imports to extensionless ranker engine imports. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:node -- --reporter=dot tests/rankingEngine.test.js tests/buildAnchorComparisons.test.js tests/rankerSessionSerialization.test.js tests/rankerLocalDraft.test.js`.
Updated 2026-04-18: `src/features/roster/utils/rosterBuilderHelpers.js` → `rosterBuilderHelpers.ts` with explicit salary lookup, add-player filter, processed drawer player, selected team, and team lookup types. Updated the roster utils barrel to resolve the converted file and tightened `isPlayerTwoWay`'s nested `original` type so the roster drawer original player does not need an open bag type. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:roster -- --reporter=dot`.
Updated 2026-04-18: `src/features/roster/utils/enrichPlayerData.js` → `enrichPlayerData.ts` with typed raw player, contract, evaluation, stats, and enriched-output shapes. Removed the direct ambient shim for this module and updated the roster utils barrel to resolve the converted file. Validation for this slice: `npm run typecheck`, `npm run validate:project`, `npm run test:scouting -- --reporter=dot`, and `npm run test:roster -- --reporter=dot`.
Updated 2026-04-18: `src/features/tierMaker/utils/saveAsListBridge.js` → `saveAsListBridge.ts` with typed tier-board entries, standard/pyramid payload inputs, saved-list payloads, and save orchestration result shapes wired to `SaveListInput`. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:node -- --reporter=dot tests/tierSaveAsList.test.js tests/tierMakerListOrder.test.js tests/tierListModePersistence.test.js`.
Completed 2026-04-18: `src/features/roster/utils/index.js` → `index.ts`, removed the stale roster-utils ambient barrel shim, and tightened `EnrichedPlayerData` so typed barrel callers inherit the base enrichable player fields. No Pile B utility or bridge `.js` files remain. Final Step 11 validation: `npm run typecheck`, `npm run validate:project`, `npm run test:roster -- --reporter=dot`, and `npm run test:scouting -- --reporter=dot`.

**Goal:** All Pile B utility and bridge files under `src/features/**/utils/**/*.js` are converted to TypeScript with explicit parameter and return types.

**Instructions:**
Use the conversion order from Step 10's audit. Leaves first. One file per commit is preferred; a small same-feature batch is acceptable if the files are tightly coupled and the validation remains narrow.

For each file:

1. Rename `.js` → `.ts`.
2. Add explicit parameter and return types to every exported function.
3. If the file sits at an external boundary (storage, URL params, Firebase reads passed through from a helper, etc.), use truthful runtime guards or Zod where appropriate.
4. Run `npm run typecheck`.
5. Run the narrowest relevant test script(s) with `--reporter=dot`.
6. Fix truthful call-site errors rather than widening the type.

**Constraints specific to this step:**

- Do NOT widen bag types just to keep feature code quiet.
- Do NOT convert `.jsx` components in this step unless an import rename is trivial and purely mechanical.
- `saveAsListBridge.js` files count as bridge logic and belong in this step.

**Done when:** All Pile B utils / bridge files are `.ts`, typecheck is clean, and the relevant scoped tests pass. Commit messages per file or feature batch: `refactor: convert <feature>/<filename> to TypeScript`.

---

## Step 12 — Convert Pile B feature hooks

**Status:** IN PROGRESS
Started 2026-04-18: `src/features/table/PlayerTable/hooks/usePlayerTableDensity.js` → `usePlayerTableDensity.ts` with `DensityMode`, typed scale map, explicit hook result type, and a runtime density-mode guard. Added focused jsdom coverage at `src/tests/table/usePlayerTableDensity.test.tsx` for defaults, localStorage restore/persist, and invalid mode rejection. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:ui -- --reporter=dot src/tests/table/usePlayerTableDensity.test.tsx`.
Updated 2026-04-18: `src/features/table/hooks/useFilteredPlayers.js` → `useFilteredPlayers.ts` using the existing shared `PlayerFilters` type plus inferred `filterPlayers`/`sortPlayers` player types. Added focused hook coverage at `src/tests/table/useFilteredPlayers.test.tsx`. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:ui -- --reporter=dot src/tests/table`.
Updated 2026-04-18: `src/features/filters/hooks/useActiveFilterCount.js` → `useActiveFilterCount.ts` with a generic active-filter state type, typed default-filter callback, readonly exclude list, and explicit subrole counting guard. Added focused coverage at `src/tests/filters/useActiveFilterCount.test.tsx`. Validation for this slice: `npm run typecheck`, `npm run validate:project`, and `npm run test:ui -- --reporter=dot src/tests/filters/useActiveFilterCount.test.tsx src/tests/table`.

**Goal:** All remaining Pile B feature hooks under `src/features/**/hooks/**/*.js` are converted to TypeScript.

**Instructions:**
After Step 11, convert the feature hooks in the audit order. One hook per commit is preferred unless two hooks are tightly coupled inside the same feature.

For each hook:

1. Rename `.js` → `.ts` (or `.tsx` only if the hook file actually contains JSX).
2. Type all state, callback parameters, callback return values, and exported hook result shapes.
3. Export the hook return type where that improves downstream clarity.
4. Run `npm run typecheck`.
5. Run the narrowest relevant test script(s) with `--reporter=dot`.
6. Fix downstream call sites if the hook now exposes a more truthful contract.

**Constraints specific to this step:**

- Keep the scope on hooks, not their surrounding UI components.
- If a hook is entangled with an unconverted `.jsx` component, convert only the hook unless a tiny import-path change is needed.
- If a hook has no meaningful test coverage, add at least a smoke test before converting it.

**Done when:** All Pile B hooks are `.ts` / `.tsx`, typecheck is clean, and the relevant scoped tests pass. Commit messages per hook or feature batch: `refactor: convert <hook-name> to TypeScript`.

---

## Step 13 — Final checkpoint and close out the living plan

**Status:** TODO

**Goal:** After Pile A, the Step 8-9 review loop, and Pile B are complete, explicitly record what remains for Pile C and then close this plan cleanly.

**Instructions:**
Append a `Final Closeout` section to this doc that answers:

1. What JS / JSX files remain?
2. Which of those are intentionally deferred Pile C UI components?
3. What follow-up items remain open after Pile B?
4. What is the rule for opportunistic Pile C conversion when product work touches those files?
5. Is a dedicated Pile C plan needed, or is opportunistic conversion enough?

This is the only step in this document that may declare the plan complete.

**Constraints specific to this step:**

- Do NOT create Step 14+ unless the user explicitly asks to re-scope the plan.
- Pile C remains opportunistic unless the user asks for a dedicated UI conversion plan.
- If future piles are added later, insert them before the final closeout step and update the flow summary at the top of this doc so the return path stays explicit.
- The plan is not complete just because Pile A is done; it is complete only after this explicit closeout step is done.

**Done when:** The doc has a `Final Closeout` section, Pile A + Pile B are explicitly recorded as complete, and the remaining Pile C handling is spelled out plainly. Commit message: `docs: close out JS-to-TS living plan`.

---

## Follow-up items (populated as conversion progresses)

*Anything surfaced during conversion that isn't in scope for the step that found it. Examples: duplicated utilities across files, inconsistent Firestore shapes, functions with undocumented side effects, missing tests on critical paths. Do not try to fix these in the same step they're found — add them here and address separately.*

- **`firestorePaths.js` `splitPath` indirection removed (Step 3):** The original JS used `splitPath()` to spread collection constants into `doc()`/`collection()` rest params. TypeScript TS2556 prevents spreading `string[]` into a typed rest param. Since all collection constants are single-segment names (no internal slashes), we eliminated `splitPath` and pass the constants directly. If env vars are ever set to multi-segment paths, this file will need to be revisited.

- **`newSchemeSelectors.ts` dead code + schema mismatch (Step 4):** Zero callers in the codebase. Expects `bio`, `team.code`, `evaluations` fields but `SeasonDocZ` has `age` (flat), `team` (string), `evaluationView`. Before wiring any callers, decide which schema shape applies and update either the selectors or the Zod schema.

- **`filterHelpers.ts` stat abbreviation map duplicates `statFilters.ts` (Step 4):** Both files define stat-key → display-label mappings (`PPG → ppg`, `FGP → fg%`, etc.). Consolidation opportunity: extract a single `STAT_ABBREVIATION_MAP` constant into `statFilters.ts` and import it in `filterHelpers.ts`.

- **`roleUtils.ts` POSITION_MAP vs getPlayerPositionLabel duplication (Step 4):** Both `POSITION_MAP` and `getPlayerPositionLabel` hardcode the same position → abbreviation map. Consolidation: `getPlayerPositionLabel` should delegate to `POSITION_MAP` (or vice versa).

- **`moduleResolution: "bundler"` and barrel imports (Step 4, rechecked Step 9):** Typed `.ts` index barrels now resolve cleanly for the converted shared utility surfaces after the stale ambient shims were removed. Prefer preserving real `.ts` barrels for Pile B-facing shared surfaces; use direct sub-path imports only when a barrel does not yet have a typed index.

- **`global-shims.d.ts` overrides actual TS file exports (Step 5, resolved for Pile A in Step 9):** Pile A/shared declarations for formatting, roles, filtering, contracts, video examples, player routing, shared hooks, team constants, and Firestore paths were removed. Remaining declarations should be treated as legacy JS/JSX bridges only; when a declared module is converted to TypeScript, remove the matching `declare module` block in the same step.

- **User-authored Firestore ownership policy inconsistency (Step 6, narrowed Step 8):** `listHelpers.ts` and `rosterHelpers.ts` auto-claim legacy ownerless docs, while `rankerHelpers.ts` treats missing `ownerUid` as invalid. This is deferred product/security policy work, not a Pile B type-flow blocker.

---

## Status legend

- **TODO** — not started
- **IN PROGRESS** — partially done; agent should pick up where the last session left off (read the step's notes section if present)
- **DONE** — complete and merged
- **BLOCKED** — needs user input or external dependency; agent should explain why and stop

When marking a step DONE, agents may also append a brief "Completed YYYY-MM-DD: <one-line summary>" under the step header for future reference.
