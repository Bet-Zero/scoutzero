# JS → TS Conversion — Living Plan

**How this doc works:** When the user says "keep working on docs/TS_CONVERSION_NEXT_STEPS.md," find the first step below with status `TODO` or `IN PROGRESS`, do it, then update the status to `DONE` (or leave it `IN PROGRESS` with a note if blocked or partial). One step per session unless a step is trivial. Do not skip ahead. Do not invent new steps. When all steps are `DONE`, tell the user the plan is complete and ask what's next.

**Commit & status hygiene (REQUIRED — do not skip):**

1. Use the commit message specified in each step. Never use generic placeholder text.
2. BEFORE committing source changes, edit this file to change the step's `**Status:** TODO` line to `**Status:** DONE` and append a one-line completion note with today's date.
3. Include the plan-doc update in the same commit as the step's work.
4. If you cannot complete the step in one session, change the status to `IN PROGRESS` and add a brief note describing where you left off.

**Background context (read before starting any step):**

- 297 JS/JSX files / ~62k lines remain unconverted. 565 TS/TSX files already migrated.
- The goal of this plan is NOT to convert all 297 files. It is to convert the high-leverage subset ("Pile A"): Firestore helpers, shared utils, shared hooks, firestore paths, and constants. These are the files where typed shapes will cascade to the most downstream code.
- Pile C (UI components under `features/*/**`) is explicitly deferred. Convert those opportunistically when you touch them, not as part of this plan.
- User-facing framing: the user is not a professional engineer. Explain tradeoffs in plain terms. When a conversion surfaces duplication or bag types across multiple files, flag it — that's the "debt pointing at itself" the conversion is meant to reveal.

**Universal constraints (apply to every step):**

- One file per commit for Pile A Firestore helpers (high-stakes). Batches OK for smaller leaf utils.
- No `any` as an escape hatch. If conversion surfaces a shape you can't type cleanly, STOP and write a comment explaining what you'd need to know. Do not cast the problem away — the point of this plan is to NOT reintroduce the debt we just cleaned up in the architect hardening arc.
- At system boundaries (Firestore reads, URL params, external APIs) use Zod (see existing Zod usage in `src/features/architect/**` for patterns). Cast + Zod is correct; cast alone is not.
- Run `npm run typecheck` and the relevant test subset after each conversion. If converting a file surfaces type errors at call sites, fix the call sites — those errors are the point.
- If a file being converted has zero tests, add at least a smoke test before converting. Untested logic code is the riskiest to convert without a safety net.
- If a conversion reveals that a function is duplicated across multiple files with slight variations, note it in this plan as a follow-up item at the bottom — don't try to de-duplicate in the same step.

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

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

**Status:** TODO

**Goal:** Pile A is done. Decide whether to extend this plan to Pile B (feature-level hooks + `features/*/utils/`) or declare the plan complete and move on.

**Instructions:**
This step is a judgment call, not a conversion. After Steps 1–6 are done, answer these questions and append the answers to this plan as a "Phase 2 Decision" section:

1. How many type errors did Pile A conversion surface at call sites in Pile B/C files? (Higher = Pile B/C has more hidden debt.)
2. Did any conversion reveal shape inconsistencies in Firestore data? (Yes = a data migration is higher priority than more conversions.)
3. Were there any duplicated utilities that should be consolidated before further conversion? (Yes = consolidation step is higher priority.)
4. How much real time did Pile A take vs the estimate? (Calibrate appetite for Pile B.)

Based on the answers, propose one of:

- **Option A:** Extend this plan with Step 8+ for Pile B (feature-level hooks + utils).
- **Option B:** Declare the plan complete; Pile C (UI components) converts opportunistically when files are touched.
- **Option C:** Pause conversion; address a higher-priority finding (data migration, duplication consolidation, etc.).

Present all three options to the user with a recommendation. Do not unilaterally pick one.

**Done when:** "Phase 2 Decision" section appended to this plan with answers to the four questions and a recommendation. User has chosen A, B, or C.

---

## Follow-up items (populated as conversion progresses)

_Anything surfaced during conversion that isn't in scope for the step that found it. Examples: duplicated utilities across files, inconsistent Firestore shapes, functions with undocumented side effects, missing tests on critical paths. Do not try to fix these in the same step they're found — add them here and address separately._

- _(empty)_

---

## Status legend

- **TODO** — not started
- **IN PROGRESS** — partially done; agent should pick up where the last session left off (read the step's notes section if present)
- **DONE** — complete and merged
- **BLOCKED** — needs user input or external dependency; agent should explain why and stop

When marking a step DONE, agents may also append a brief "Completed YYYY-MM-DD: <one-line summary>" under the step header for future reference.
