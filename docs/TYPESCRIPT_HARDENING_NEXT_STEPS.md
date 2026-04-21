# TypeScript Hardening — Living Plan

**How this doc works:** When the user says "keep working on `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`," find the first step below with status `TODO` or `IN PROGRESS`, do it, then update the status to `DONE` (or leave it `IN PROGRESS` with a note if blocked or partial). One step per session unless a step is truly trivial or Steps 1 and 2 are being completed together as the kickoff evidence package. Do not skip ahead. Do not invent new steps unless the user explicitly asks to revise this plan. Checkpoints, reviews, and cleanup loops inside this doc must always reconnect to the next numbered step; they are not standalone end states. When all steps are `DONE`, tell the user this hardening plan is complete and state what remains as optional future work.

**Commit & status hygiene (REQUIRED — do not skip):**

1. Use the commit message specified in each step. Never use generic placeholder text.
2. BEFORE committing source changes, edit this file to change the step's `**Status:** TODO` line to `**Status:** DONE` and append a one-line completion note with today's date.
3. Include the plan-doc update in the same commit as the step's work.
4. If you cannot complete the step in one session, change the status to `IN PROGRESS` and add a brief note describing where you left off.
5. If a step is blocked on a real product-direction decision, mark it `BLOCKED`, ask the user one plain-language question, and stop. Do not widen the step to stay busy.

**Background context (read before starting any step):**

- The repo-wide TypeScript migration is structurally complete in runtime app code, but the post-migration hardening audit returned **CONCERN** rather than PASS.
- The audit found that runtime `src/` has no `.js` or `.jsx`, but the repo still behaves like a permissive TS repo rather than a hardened one.
- The strongest dishonesty signal surfaced by the audit is `src/global-shims.d.ts`, which still contains ambient module shims exporting `any`, including at least one shim that invents exports that the real implementation does not provide.
- Root TypeScript still runs with `strict: false`, so root `npm run typecheck` is not a proof of strong typing by itself.
- A scoped strict config exists (`tsconfig.architect-strict.json`) and currently fails with thousands of errors. That failure count is not a failure of this plan — it is the map of where hardening work still lives.
- A dedicated shared/runtime strict probe also exists (`tsconfig.shared-boundaries-strict.json`) so shared-boundary hardening is measured on the surface it actually changes rather than disappearing inside Architect-only metrics.
- The audit also found that user-content Firebase helpers (`src/firebase/listHelpers.ts`, `src/firebase/rosterHelpers.ts`, `src/firebase/rankerHelpers.ts`) are relatively honest and Zod-backed, while many Architect/base-data Firestore reads still rely on broad casts or bag types rather than schema-guarded boundaries.
- The audit found that tests are typed by extension but often bypass type truth with `any`, `as any`, broad mocks, and bag fixtures. That means test files can look "TS-complete" while still failing to reinforce runtime contracts.
- The goal of this plan is **not** to flip `strict: true` immediately. The goal is to remove the biggest dishonesty mechanisms first, harden the highest-value boundaries second, reduce the most damaging test/type bypass patterns third, and only then reassess strict-mode readiness with evidence.

**Plan continuity invariant (applies to the entire doc):**

- This is one living plan, not a set of disconnected cleanup ideas.
- Completing one step never throws the document off route; it only advances the plan to the next numbered step.
- Reviews, audits, cleanup loops, and prep phases are allowed only if they are written as bounded numbered steps that explicitly reconnect to the next phase or final closeout.
- Only the final closeout step may declare the plan complete.
- If future hardening phases are added later, they must be inserted into the numbered flow with an explicit resume point and an explicit path back to final closeout.

**Current planned flow:**

- Steps 1–2: establish the hardening baseline and execution map as one kickoff evidence package
- Steps 3–4: remove type-dishonesty shims and declaration-layer masking
- Steps 5–7: harden the highest-value runtime boundaries (shared data hooks + architect/base-data Firestore reads)
- Steps 8–9: reduce the worst typed-test dishonesty in the highest-value suites and mocks
- Step 10: checkpoint strictness readiness across the active probes and decide whether a narrow prep pass is justified
- Steps 11–12: execute one high-leverage strict-prep wave only if the checkpoint proves it is ripe, then close out residual risk honestly
- Step 13: final closeout and next-phase recommendation

**Universal constraints (apply to every step):**

- Discovery steps are doc-only unless the step explicitly allows source edits.
- Prefer the narrowest truthful fix. Do not widen types to make TypeScript quiet.
- `any` is not an acceptable escape hatch except at a truly unavoidable third-party boundary, and even there it must be localized and documented.
- At data boundaries (Firestore, JSON parsing, route params, local/session storage, external scraper inputs), use truthful runtime guards or Zod where appropriate. Cast + validation is acceptable; cast alone is not.
- Keep validation scoped. Use the cheapest approved commands that actually prove the touched area. Always append `--reporter=dot` to test scripts.
- `npm run typecheck` is a compatibility gate only; it is never sufficient by itself as evidence of hardening progress.
- Use the strict probe that matches the surface being hardened: `tsconfig.shared-boundaries-strict.json` for shared/runtime work, `tsconfig.architect-strict.json` for Architect/test work, and both when declaration-layer changes cross those surfaces.
- Do not run the full suite unless the prompt contains the exact phrase `RUN FULL SUITE`.
- If a step reveals duplicated utilities, duplicated schemas, or product/policy inconsistencies that are real but not in scope, record them in the Follow-up section at the bottom rather than widening the step.
- If a step removes a legacy shim or broad declaration, fix the downstream call sites or imports that break. Those breakages are the point.
- This plan is about **hardening trust**, not aesthetics. Do not spend time on style-only cleanup.

---

## Step 1 — Create the post-migration hardening evidence baseline

**Status:** DONE

Completed 2026-04-21: Created `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md` with live inventory, compiler posture, dishonesty-marker counts, strict-probe baselines, and audit risk themes.

**Goal:** Create a baseline doc that records the live hardening state of the repo so future steps can prove improvement rather than vaguely claiming it.

**Instructions:**
Create `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

The baseline must include:

1. Live file inventory counts for:
   - repo-wide `.ts`, `.tsx`, `.js`, `.jsx`, `.d.ts`
   - `src/` only
   - `tests/` + `src/tests/`
2. Current compiler posture:
   - root `tsconfig.json`
   - whether `strict` is on or off
   - other relevant safety flags already enabled/disabled
   - which additional tsconfig(s) exist and what they are for
3. Primary dishonesty-marker counts for the full repo and split by runtime vs tests:
   - `any`
   - `as any`
   - `as unknown as`
   - `@ts-ignore`
   - `@ts-expect-error`
   - `Record<string, any>`
4. Visibility counts tracked separately from dishonesty markers:
   - `unknown`
5. The current strict-check baselines for the active hardening probes:
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - current error counts
   - short note that these are measurement baselines, not pass/fail goals for Step 1
6. A list of the strongest audit-proven risk themes from the hardening audit return package.

This is a read-only baseline step. Do not change source files here.

**Constraints specific to this step:**

- Use live repo evidence, not prior plan docs as truth.
- Keep the baseline concise but concrete.
- This step must give later steps a before/after reference point.
- Steps 1 and 2 may be completed in the same kickoff session if the same evidence pass supports both docs.

**Done when:** `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md` exists with the baseline counts, compiler posture, primary dishonesty-marker counts, separate `unknown` visibility counts, both strict-probe baselines, and risk themes. Commit message: `docs: record TypeScript hardening baseline`.

---

## Step 2 — Turn the audit into a tracked execution map

**Status:** DONE

Completed 2026-04-21: Created `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md` with ordered declaration, shared/runtime, Architect, typed-test, and strict-prep waves mapped to Steps 3-12.

**Goal:** Convert the hardening audit into a concrete, ordered work map so future execution is driven by file groups and risk categories instead of ad hoc guesses.

**Instructions:**
Create `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md`.

Using the hardening audit and live repo inspection, group the hardening work into these buckets:

1. **Declaration-layer dishonesty**
   - `src/global-shims.d.ts`
   - any sibling `.d.ts` files that shadow or overstate implementation types
2. **Shared/runtime boundary honesty**
   - shared data hooks
   - JSON/storage boundaries
   - route-param boundaries
3. **Architect/base-data Firestore boundary honesty**
   - the highest-value loader/subscribe/helper files surfaced by the audit
4. **Typed-test dishonesty**
   - broad mocks
   - cast-heavy guardrail/integration tests
   - bag fixtures that bypass runtime truth
5. **Strict-prep candidates**
   - areas likely to give the biggest reduction in strict-scoped errors per file touched

For each candidate file or file group, record:

- path
- risk category
- one-sentence reason it matters
- whether it is runtime-critical, test-critical, or declaration-only
- which strict probe should measure progress (`tsconfig.shared-boundaries-strict.json`, `tsconfig.architect-strict.json`, or both)
- recommended execution wave
- recommended validation commands

End the doc with a `Recommended execution order` section that clearly maps to Steps 3–12 below.

Do not change source files in this step.

This step may be completed in the same kickoff session as Step 1 when the audit already exists and the same evidence pass can support both docs.

**Constraints specific to this step:**

- The map must stay narrow and high leverage. Do not expand into every weak file in the repo.
- Prioritize files that change how much the rest of the repo can trust types.
- Favor central boundaries over low-impact leaf components.

**Done when:** `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md` exists and provides a truthful execution map that directly feeds the remaining numbered steps. Commit message: `docs: map TypeScript hardening execution waves`.

---

## Step 3 — Remove dishonest ambient shims that mask real module types

**Status:** DONE

Completed 2026-04-21: Deleted `src/global-shims.d.ts`, removed the fake ambient module contracts, and fixed the downstream shared UI, cap totals, TPE, trade-context, and guardrail-test contracts exposed by real module types.

**Goal:** Eliminate or sharply narrow the declaration shims that make downstream TypeScript look safer than it is.

**Instructions:**
Use Step 2's execution map and start with `src/global-shims.d.ts`.

Work through the declaration layer in priority order:

1. Remove `declare module` blocks for modules that now have real `.ts` / `.tsx` implementations and should expose their actual exported types.
2. Where a declaration cannot yet be fully removed because a legacy consumer still depends on it, narrow it to the truthful minimum rather than exporting `any`.
3. If any declaration invents exports that the implementation does not actually provide, fix that mismatch immediately.
4. If a removed shim exposes downstream call-site or import errors, fix the real consumers rather than replacing the shim with a new lie.

Validation after each meaningful batch:

- `npm run typecheck`
- the relevant strict probe(s): `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` and/or `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run validate:project` if declaration removals or structural exports change
- the narrowest relevant scoped tests with `--reporter=dot`

**Constraints specific to this step:**

- Do not widen runtime code to preserve fake compatibility.
- Prefer deleting bad shims over preserving them.
- If a shim is still needed temporarily, add a one-line comment stating why it remains and what real file still depends on it.

**Done when:** The dishonest ambient shims surfaced by the audit are either removed or narrowed to truthful minimums, and downstream consumers now see real module types. Commit message: `refactor: remove dishonest TypeScript ambient shims`.

---

## Step 4 — Re-audit the declaration layer and classify what remains

**Status:** DONE

Completed 2026-04-21: Classified the three remaining project `.d.ts` files, confirmed there are no remaining live `declare module` shims, removed the stale strict-probe include for deleted `src/global-shims.d.ts`, and recorded `PlayerNameMini.d.ts` as the only suspicious local declaration bridge.

**Goal:** Confirm the declaration-layer cleanup actually changed type truth, and explicitly classify any remaining `.d.ts` shims as justified or still suspect.

**Instructions:**
After Step 3, append a `Declaration Layer Review` section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md` or create a focused companion doc if that reads better.

For every remaining non-library `.d.ts` file or ambient module declaration in the repo, classify it as:

- `Justified boundary declaration`
- `Temporary legacy bridge`
- `Still suspicious`

For each, give:

- file path
- why it still exists
- whether it exports real types or broad placeholders
- whether it blocks later hardening work

Then update this living plan with a short progress note under Step 4 explaining what remains and whether later steps must revisit it.

**Constraints specific to this step:**

- This is a review/classification step, not a broad new cleanup phase.
- Only make tiny source changes if the review exposes an obvious false statement that must be corrected.

**Done when:** Remaining declaration files are explicitly classified and the plan truthfully records whether declaration-layer dishonesty is mostly resolved or still a live blocker. Commit message: `docs: classify remaining TypeScript declaration bridges`.

---

## Step 5 — Harden shared data boundaries before widening Architect work

**Status:** DONE

Completed 2026-04-21: Added runtime schema parsing for shared player Firestore reads, guarded Tier Maker session-storage restore, and typed the route/list/roster/table surfaces required for the shared strict probe to pass.

**Goal:** Strengthen the highest-value shared runtime data boundaries so the general app surface stops relying on permissive casts where it should validate or narrow.

**Instructions:**
Use Step 2's execution map and start with the shared/runtime boundary files the audit called out, especially:

- `src/shared/hooks/usePlayerDetail.ts`
- `src/shared/hooks/useSimplePlayerData.ts`
- any nearby route/storage helper files proven to be weak in the execution map

For each file:

1. Identify every runtime data ingress point:
   - Firestore read
   - JSON parse
   - route param
   - local/session storage read
2. Replace cast-only flows with truthful validation or narrowing where appropriate.
3. If a DEV-only validation pattern exists and production still trusts unchecked data, convert it to an honest runtime boundary or clearly justify why the runtime cost must stay DEV-only.
4. Export or reuse existing schema-derived types rather than inventing local bag types.

Validation after each file or tight batch:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
- `npm run test:scouting -- --reporter=dot` and/or the narrowest relevant suite from the execution map
- `npm run build` after a meaningful shared-boundary batch

**Constraints specific to this step:**

- Do not rewrite whole hooks just to be cleaner.
- Preserve existing behavior unless the old behavior depended on false typing.
- If a runtime boundary reveals inconsistent real data, record it in the Follow-up section and keep the fix localized.

**Done when:** The highest-value shared runtime boundaries from the execution map stop relying on cast-only trust and pass both compatibility validation and the shared strict probe. Commit message: `refactor: harden shared runtime data boundaries`.

---

## Step 6 — Harden Architect/base-data Firestore boundaries (wave 1)

**Status:** DONE

Completed 2026-04-21: Added Architect Firestore boundary guards and routed `subscribeArchitectPlayerData`, `loadArchitectBasePlayer`, and `teamLoader` through record/player/team normalization; root typecheck, project validation, and targeted `teamLoader` tests pass, while the Architect strict probe still fails on the known broader strict backlog.

**Goal:** Fix the most important Architect/base-data read paths that currently reconstruct trust through casts rather than honest boundary validation.

**Instructions:**
Use Step 2's execution map and target the most central files first — the ones that many downstream Architect surfaces depend on.

Likely first-wave candidates include files surfaced by the audit such as:

- `src/features/architect/utils/subscribeArchitectPlayerData.ts`
- `src/features/architect/utils/loadArchitectBasePlayer.ts`
- `src/features/architect/utils/teamLoader.ts`

For each file:

1. Trace the Firestore/base-data ingress points.
2. Replace broad `snapshot.data() as ...` or bag-type reconstruction with truthful narrowing/validation.
3. Reuse canonical schema-derived types where possible.
4. Keep output contracts stable unless the old contract was itself dishonest; if so, fix the dependent callers.

Validation after each file or tight batch:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:architect -- --reporter=dot`
- any narrower architect-scoped test command identified in the execution map

**Constraints specific to this step:**

- This is a boundary-hardening step, not a full Architect redesign.
- Do not widen mutation or world logic unless the boundary hardening makes a downstream type bug visible.
- Stop and record any schema/contract mismatch that clearly belongs to a later dedicated cleanup pass.

**Done when:** The highest-value Architect/base-data boundary files in wave 1 are hardened away from cast-only trust and pass scoped Architect validation. Commit message: `refactor: harden architect Firestore boundaries wave 1`.

---

## Step 7 — Harden Architect/base-data Firestore boundaries (wave 2) and classify what can defer

**Status:** TODO

**Goal:** Finish the next most important Architect/base-data boundaries, then explicitly classify what remaining Architect type debt is real but safe to defer.

**Instructions:**
Continue from Step 6 using the next wave from the execution map.

Likely candidates include files such as:

- `src/features/architect/utils/worldManager.ts`
- `src/features/architect/utils/firebaseTeamPlanHelpers.ts`
- other map-designated base-data or helper boundaries that still use bag types or cast-only trust

For each file/group:

1. Harden the live ingress path.
2. Fix the downstream consumers exposed by truthful contracts.
3. Run the narrowest relevant architect-scoped validation, including `npm run typecheck -- --project tsconfig.architect-strict.json`.

Then append an `Architect Boundary Review` section to the baseline or execution-map docs that classifies remaining Architect type debt as:

- `Next-wave candidate`
- `Safe to defer`
- `Needs separate product/architecture decision`

**Constraints specific to this step:**

- Keep the step bounded to boundary honesty, not all strict errors.
- If a remaining file is ugly but not central, classify it rather than dragging it into this wave.

**Done when:** Wave 2 boundary hardening is complete and the remaining Architect boundary debt is explicitly classified rather than vaguely implied. Commit message: `refactor: harden architect Firestore boundaries wave 2`.

---

## Step 8 — Reduce typed-test dishonesty in the highest-value mocks and suites

**Status:** TODO

**Goal:** Make the most important typed tests reinforce runtime contracts instead of bypassing them with broad mocks and bag fixtures.

**Instructions:**
Use Step 2's execution map and start with the most central mock/test-support files, especially the Firebase mock layer and the highest-value integration/guardrail suites that the audit flagged.

Prioritize:

- `tests/__mocks__/firebase.ts`
- the most central Architect integration/closure/guardrail tests identified in the execution map
- any tests that directly exercise the boundaries hardened in Steps 5–7

For each target:

1. Remove unnecessary `any`, `as any`, and bag fixtures where a truthful narrowed type can be used.
2. Update mocks so they better match the real runtime shape instead of permissively swallowing everything.
3. Keep tests focused on proving behavior — do not rewrite whole suites just for aesthetics.
4. If a test truly needs a deliberately invalid value, keep that invalidity explicit rather than smuggling it through a broad cast.

Validation:

- `npm run typecheck`
- the relevant strict probe(s): `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json` and/or `npm run typecheck -- --project tsconfig.architect-strict.json`
- the narrowest relevant test scripts with `--reporter=dot`

**Constraints specific to this step:**

- Do not try to remove every `any` from tests in one pass.
- Focus on trust-critical mocks and suites, not low-value leaf tests.
- If a runtime file needs a small export/type tweak to let a test become truthful, that is allowed.

**Done when:** The highest-value mock/test-support surfaces and their most important consuming suites are noticeably more truthful and pass scoped validation. Commit message: `test: harden typed mocks and high-value suites`.

---

## Step 9 — Review test typing posture and classify what remains

**Status:** TODO

**Goal:** Re-measure the test layer after Step 8 and classify remaining typed-test debt so the repo has a truthful picture of whether tests are now reinforcing runtime contracts or still mostly bypassing them.

**Instructions:**
Append a `Test Typing Review` section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md` or create a companion doc if that reads better.

Include:

1. Updated primary dishonesty-marker counts for tests only.
2. `unknown` counts for tests only, recorded separately as context rather than scored as dishonesty.
3. Which central mocks/suites were improved in Step 8.
4. Which remaining test debt is:
   - `High-value next-wave candidate`
   - `Acceptable temporary compromise`
   - `Not worth targeted hardening right now`
5. A plain-language conclusion on whether the typed test layer is now mostly helping or still too often bypassing runtime truth.

**Constraints specific to this step:**

- This is a measurement/classification step.
- Do not widen back into another large cleanup wave here.

**Done when:** The repo has a truthful post-Step-8 review of test typing posture and a classified remainder list. Commit message: `docs: review typed test hardening posture`.

---

## Step 10 — Checkpoint: reassess strict-mode readiness with evidence

**Status:** TODO

**Goal:** Re-run the strictness measurement after the earlier hardening waves and decide whether a narrow strict-prep pass is worth doing now.

**Instructions:**
This is a decision step, not an automatic strict-mode step.

1. Re-run the strict probes from Step 1 that cover the work completed so far.
2. Record the new error counts and compare each relevant probe to its baseline.
3. Identify which error families dropped meaningfully because of Steps 3–9, separated by shared/runtime probe vs Architect/test probe when applicable.
4. Identify which remaining strict errors are concentrated in a narrow set of files vs spread everywhere.
5. Append a `Strictness Checkpoint` section to the baseline doc answering:
   - Is the repo still nowhere near ready?
   - Is it now somewhat ready with a narrow prep pass?
   - Which exact error families are now most worth targeting, and in which probe do they live?
   - Which probe(s) moved meaningfully and which did not?

Then propose one of:

- **Option A:** Stop after current hardening plan; no strict-prep wave is justified yet.
- **Option B:** Run one narrow strict-prep wave focused only on the highest-leverage error families already covered by the current probes.
- **Option C:** Do not start broader strict-prep inside this plan; record that a separate follow-on plan is warranted because the remaining work exceeds one bounded wave.

Do not choose beyond what the evidence supports.

**Constraints specific to this step:**

- This step must be measurement-driven, not optimism-driven.
- If strict error counts barely move, say so plainly.
- The user should not have to make a technical decision; recommend one option.

**Done when:** The `Strictness Checkpoint` section exists with before/after counts for each relevant probe, error-family analysis, and a clear recommendation that feeds Step 11. Commit message: `docs: record strictness readiness checkpoint`.

---

## Step 11 — Narrow strict-prep wave (only if Step 10 proves it is worth it)

**Status:** TODO

**Goal:** Execute a small, high-leverage strict-prep wave only if Step 10 shows there is real payoff.

**Instructions:**
If Step 10 recommends Option B, perform exactly one bounded strict-prep wave focused on the highest-leverage remaining error family or file cluster.

Examples of acceptable targets:

- one concentrated family of implicit-any or index-access issues
- one central file group whose cleanup will collapse many repeated strict errors
- one boundary contract family whose optionality/nullability is producing repeated strict churn

For the chosen wave:

1. State explicitly in this plan what the wave targets and why.
2. Fix the chosen error family/file cluster truthfully.
3. Run `npm run typecheck`, the relevant strict probe(s), and the narrowest relevant tests with `--reporter=dot`.
4. Re-run the same strict probe(s) and record the delta.

If Step 10 recommended Option A, mark Step 11 `DONE` with a note that no strict-prep wave was justified yet and move directly to Step 12.

If Step 10 recommended Option C, mark Step 11 `DONE` with a note that broader strict-prep must move into a separate follow-on plan, do not improvise that phase here, and move directly to Step 12.

**Constraints specific to this step:**

- Keep the wave narrow. Do not try to "just keep going" into a broad strict migration.
- Do not flip `strict: true` in root config here.
- The point is leverage, not volume.

**Done when:** One justified strict-prep wave is complete (or explicitly skipped based on Step 10 evidence), and the plan records the resulting strict-scoped delta. Commit message: `refactor: execute narrow TypeScript strict-prep wave`.

---

## Step 12 — Final hardening review and residual-risk classification

**Status:** TODO

**Goal:** Recheck the full hardening plan as one system and classify what risk remains after the completed waves.

**Instructions:**
Create or update `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md`.

Review together:

- declaration layer after Steps 3–4
- shared/runtime boundaries after Step 5
- Architect/base-data boundaries after Steps 6–7
- typed-test posture after Steps 8–9
- strictness checkpoint and any narrow prep wave or separate-plan recommendation after Steps 10–11

Classify the remaining issues into:

- `Resolved in this plan`
- `Safe to defer`
- `Needs dedicated follow-up plan`
- `Needs product/architecture decision`

Then give a plain-language verdict for the repo’s new state using this scale:

- `PASS — materially hardened`
- `PASS WITH DEBT — hardening meaningfully improved, targeted debt remains`
- `CONCERN — key trust issues remain`

**Constraints specific to this step:**

- Be honest. If major trust problems still remain, say so.
- This review is not a new execution wave.
- Only make tiny doc corrections here, not new source changes.

**Done when:** The final review doc exists and clearly states what this plan resolved, what remains, and the repo’s new post-hardening posture. Commit message: `docs: record final TypeScript hardening review`.

---

## Step 13 — Final closeout and next-phase recommendation

**Status:** TODO

**Goal:** Close this living plan cleanly and state what, if anything, should happen next.

**Instructions:**
Append a `Final Closeout` section to this doc that answers:

1. Which numbered steps completed source changes vs doc-only measurement/review?
2. What dishonesty mechanisms were removed or reduced?
3. Which runtime boundaries are now materially more trustworthy?
4. What test/mocking debt still remains?
5. Did strict-scoped readiness meaningfully improve?
6. Is a separate next-phase plan warranted, and if so, what should it be?

This is the only step in this document that may declare the plan complete.

**Constraints specific to this step:**

- Do not create Step 14+ unless the user explicitly asks to extend or re-scope the work.
- If the repo is improved but not perfect, say that directly.
- The plan is complete only after this explicit closeout is done.

**Done when:** This doc has a `Final Closeout` section, all prior steps are explicitly marked, and the next-phase recommendation is stated plainly. Commit message: `docs: close out TypeScript hardening living plan`.

---

## Follow-up items (populate during execution)

_Anything surfaced during hardening that is real but not in scope for the step that found it. Examples: duplicated schemas, policy inconsistencies, low-value leaf files still using weak types, or strictness-ready clusters that deserve their own later plan. Do not try to fix these in the same step they are found — add them here and address separately if they become the focus of a later dedicated plan._

---

## Status legend

- **TODO** — not started
- **IN PROGRESS** — partially done; agent should pick up where the last session left off (read the step's notes section if present)
- **DONE** — complete and merged
- **BLOCKED** — needs user input or external dependency; agent should explain why and stop

When marking a step DONE, agents may also append a brief `Completed YYYY-MM-DD: <one-line summary>` under the step header for future reference.
