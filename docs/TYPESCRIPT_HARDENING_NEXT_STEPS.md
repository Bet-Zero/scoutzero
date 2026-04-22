# TypeScript Hardening — Self-Extending Master Plan

**How this doc works:** When the user says "keep working on `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`," find the first step below with status `TODO` or `IN PROGRESS`, do it, then update the status to `DONE` (or leave it `IN PROGRESS` with a note if blocked or partial). One step per session unless a step is truly trivial or the current step explicitly allows a tightly coupled same-session batch. Do not skip ahead. Do not invent unrelated work. If a checkpoint, review, or strictness measurement reveals additional work that is still inside this document's mission, append new numbered steps to this same document immediately after the checkpoint that discovered it and continue. Do not close this plan while substantial mission-area debt remains.

**Mission statement (non-negotiable):** The mission of this document is to drive the repo to **complete TypeScript hardening across the full project**. This plan is not complete when a bounded phase ends. It is complete only when the repo is materially hardened end-to-end and no substantial hardening backlog remains inside the mission area.

**What counts as complete hardening for this plan:**

- No repo-wide declaration-layer dishonesty remains (no fake ambient module shims masking real TS/TSX exports).
- Shared/runtime boundaries are honestly typed and validated where appropriate.
- Architect/runtime boundaries are honestly typed and validated where appropriate.
- High-value typed tests and mocks reinforce runtime contracts rather than broadly bypassing them.
- Strictness readiness is no longer blocked by a large, known, mission-area backlog.
- Final review truthfully supports a completion-level verdict for the mission, not merely a phase-level win.

**Hard anti-loophole rules (REQUIRED — do not violate):**

1. **No fake completion:** Do not mark this plan complete if any step, checkpoint, review, return package, or strictness measurement states that a substantial remaining phase is still required inside this plan's mission.
2. **No separate-plan escape hatch:** Do not recommend or create a separate follow-on plan for work that is still inside the mission of this document. If more work is needed, append new numbered steps to this same plan and continue.
3. **Verdict must match closure:** If the most honest repo verdict is anything less than true completion of the mission (for example `PASS WITH DEBT`, `CONCERN`, or equivalent), this plan must remain open unless the remaining debt is explicitly outside scope by user instruction.
4. **Checkpoint extension rule:** If a checkpoint reveals broader remaining work than expected, the agent must add new numbered steps immediately after the checkpoint rather than closing the plan or deferring to a future plan.
5. **Final closeout gate:** The final closeout step may be marked `DONE` only if all of the following are true:
   - no substantial hardening backlog remains inside the mission area;
   - no baseline/review/probe says a dedicated follow-up is still required for mission-area work;
   - remaining issues are explicitly minor, optional, or user-declared out of scope;
   - the final review supports a completion-level verdict.

**Commit & status hygiene (REQUIRED — do not skip):**

1. Use the commit message specified in each step. Never use generic placeholder text.
2. BEFORE committing source changes, edit this file to change the step's `**Status:** TODO` line to `**Status:** DONE` and append a one-line completion note with today's date.
3. Include the plan-doc update in the same commit as the step's work.
4. If you cannot complete the step in one session, change the status to `IN PROGRESS` and add a brief note describing where you left off.
5. If a step is blocked on a real product-direction decision, mark it `BLOCKED`, ask the user one plain-language question, and stop. Do not widen the step to stay busy.
6. If a checkpoint forces the plan to extend, update the flow summary near the top of this document in the same commit that adds the new steps.

**Background context (read before starting any step):**

- The repo-wide TypeScript migration is structurally complete in runtime app code, but the original post-migration hardening audit returned **CONCERN** rather than PASS.
- The first hardening phase removed the largest declaration-layer lie (`src/global-shims.d.ts`), hardened the shared/runtime strict probe from `244` errors to `0`, hardened a planned set of Architect/base-data ingress points, and improved central Firebase mock truth.
- That phase did **not** complete the full mission. The Architect/test strict probe still reports a large remaining backlog and the earlier phase incorrectly treated that as a separate follow-on plan instead of extending this master plan.
- This rewritten master plan absorbs the already-completed hardening work and explicitly continues from there. The earlier phase is now part of this document's history, not a reason to close the mission.
- Root TypeScript still runs with `strict: false`, so root `npm run typecheck` remains only a compatibility gate, never sufficient proof of hardening.
- Active strict probes exist and must be used as mission progress instruments:
  - `tsconfig.shared-boundaries-strict.json`
  - `tsconfig.architect-strict.json`
- The remaining large mission-area backlog is concentrated in Architect runtime contracts, Architect dashboard/action adapter contracts, mutation-pipeline carrier contracts, and the highest-value Architect persistence / trade / season harnesses.

**Plan continuity invariant (applies to the entire doc):**

- This is one self-extending master plan, not a series of disconnected phase plans.
- Completing one step never throws the document off route; it only advances the plan to the next numbered step.
- Reviews, audits, cleanup loops, checkpoint decisions, and strictness assessments are allowed only if they explicitly reconnect to the next numbered step.
- New phases discovered by evidence must be appended to this same plan.
- The plan ends only when the mission ends.

**Current planned flow:**

- Steps 1–13: completed hardening foundation phase (baseline, execution map, declaration cleanup, shared/runtime hardening, initial Architect ingress hardening, initial typed-test hardening, strictness checkpoint)
- Steps 14–15: reset the master-plan truth and turn the remaining Architect/test backlog into an execution map inside this same plan
- Steps 16–18: normalize the highest-leverage Architect runtime carrier and adapter contracts
- Steps 19–21: harden the highest-value remaining Architect persistence / trade / season test harnesses and central supporting mocks/fixtures
- Step 22: reassess strictness readiness after the Architect normalization wave
- Steps 23+ : append additional numbered waves as required until the mission-level completion gates are actually satisfied
- Final closeout: only after the mission-level gates are satisfied

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

## Phase History — Completed foundation work (Steps 1-13)

The following steps are already complete and remain part of this master plan's history. They do not close the mission by themselves.

## Step 1 — Create the post-migration hardening evidence baseline

**Status:** DONE

Completed 2026-04-21: Created `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md` with live inventory, compiler posture, dishonesty-marker counts, strict-probe baselines, and audit risk themes.

---

## Step 2 — Turn the audit into a tracked execution map

**Status:** DONE

Completed 2026-04-21: Created `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md` with ordered declaration, shared/runtime, Architect, typed-test, and strict-prep waves mapped to Steps 3-12.

---

## Step 3 — Remove dishonest ambient shims that mask real module types

**Status:** DONE

Completed 2026-04-21: Deleted `src/global-shims.d.ts`, removed the fake ambient module contracts, and fixed the downstream shared UI, cap totals, TPE, trade-context, and guardrail-test contracts exposed by real module types.

---

## Step 4 — Re-audit the declaration layer and classify what remains

**Status:** DONE

Completed 2026-04-21: Classified the three remaining project `.d.ts` files, confirmed there are no remaining live `declare module` shims, removed the stale strict-probe include for deleted `src/global-shims.d.ts`, and recorded `PlayerNameMini.d.ts` as the only suspicious local declaration bridge.

---

## Step 5 — Harden shared data boundaries before widening Architect work

**Status:** DONE

Completed 2026-04-21: Added runtime schema parsing for shared player Firestore reads, guarded Tier Maker session-storage restore, and typed the route/list/roster/table surfaces required for the shared strict probe to pass.

---

## Step 6 — Harden Architect/base-data Firestore boundaries (wave 1)

**Status:** DONE

Completed 2026-04-21: Added Architect Firestore boundary guards and routed `subscribeArchitectPlayerData`, `loadArchitectBasePlayer`, and `teamLoader` through record/player/team normalization; root typecheck, project validation, and targeted `teamLoader` tests pass.

---

## Step 7 — Harden Architect/base-data Firestore boundaries (wave 2) and classify what can defer

**Status:** DONE

Completed 2026-04-21: Hardened `worldManager.ts` world metadata reads and `firebaseTeamPlanHelpers.ts` base team/player/free-agent reads with runtime boundary readers, then added the Architect Boundary Review classification to the baseline.

---

## Step 8 — Reduce typed-test dishonesty in the highest-value mocks and suites

**Status:** DONE

Completed 2026-04-21: Typed the shared Firebase mock, replaced trade-persistence bag fixtures with explicit fixture contracts, tightened the free-agency harness away from repeated fixture `as any` casts, and improved the first selected Architect suites.

---

## Step 9 — Review test typing posture and classify what remains

**Status:** DONE

Completed 2026-04-21: Added the baseline `Test Typing Review` with updated test-only marker counts, Step 8 deltas, a classified remainder list, and a plain-language conclusion that central mocks improved materially but Architect action/trade/cap harnesses still dominate the typed-bypass debt.

---

## Step 10 — Checkpoint: reassess strict-mode readiness with evidence

**Status:** DONE

Completed 2026-04-21: Added the baseline `Strictness Checkpoint`; the shared strict probe moved from `244` errors to `0`, while the Architect strict probe shifted from `2,567` to `2,632`.

**Important correction:** In the earlier bounded-phase version of this plan, Step 10 treated the remaining Architect/test backlog as a reason to create a separate follow-on plan. Under this self-extending master-plan contract, that outcome no longer permits closure. It instead forces this document to continue with new numbered steps.

---

## Step 11 — Strict-prep wave decision correction

**Status:** DONE

Completed 2026-04-21: The earlier bounded-phase plan skipped a strict-prep wave because the remaining Architect/test debt was too broad for one narrow pass. Under this master-plan rewrite, that result is preserved as evidence, but it no longer authorizes closure or a separate follow-on plan.

---

## Step 12 — Final hardening review from the foundation phase

**Status:** DONE

Completed 2026-04-21: Created `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md` with resolved, deferred, follow-up, and architecture-decision classifications plus a `PASS WITH DEBT` verdict.

**Important correction:** `PASS WITH DEBT` is a valid phase result, but under this master-plan contract it is not a completion verdict for the mission. The plan therefore remains open.

---

## Step 13 — Absorb the former closeout into this master plan

**Status:** DONE

Completed 2026-04-22: The previous closeout language has been superseded by this self-extending master-plan rewrite. The former claim that a separate next-phase plan was warranted is now treated as a checkpoint discovery that extends this same document rather than ending it.

---

## Step 14 — Reset the master-plan truth and create the remaining-work baseline

**Status:** DONE

Completed 2026-04-22: Added the `Master Plan Resume Baseline` with live shared/Architect strict-probe counts, current Architect hotspot files/error families, a plain-language blocker summary, and an explicit correction that the earlier `PASS WITH DEBT` verdict was phase-level only.

**Goal:** Create a truthful post-Step-13 baseline that explicitly records what remains inside the mission after the completed foundation phase, so the master plan resumes from the real remaining backlog rather than the old false closeout.

**Instructions:**
Update `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md` with a new section named `Master Plan Resume Baseline`.

That section must include:

1. The current strict-probe counts for:
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. A concise statement that the shared/runtime probe is now green and that the mission-area backlog is now concentrated in Architect runtime contracts and Architect tests.
3. Updated top Architect strict hotspots by file and error family.
4. A plain-language statement of what is still preventing full project type hardening.
5. A short explanation that `PASS WITH DEBT` from the earlier final review is now treated as an intermediate phase result, not a mission-complete result.

Do not change source files in this step.

**Constraints specific to this step:**

- This step is doc-only.
- Use live repo evidence, not old summaries as truth.
- The output must make it impossible for later steps to pretend the mission is done before the Architect/test backlog is addressed.

**Done when:** The baseline doc has a `Master Plan Resume Baseline` section that truthfully resets the plan around the remaining mission backlog. Commit message: `docs: reset TypeScript hardening master-plan baseline`.

---

## Step 15 — Convert the remaining Architect/test backlog into an execution map inside this same plan

**Status:** DONE

Completed 2026-04-22: Added `Master Plan Remaining Waves` to the execution map with live Architect strict hotspots, support-layer dependencies, and a Step 16-22 continuation order.

**Goal:** Turn the remaining Architect runtime + test strict backlog into a concrete execution map for the next hardening waves inside this same document.

**Instructions:**
Update `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md` with a new section named `Master Plan Remaining Waves`.

Using the current Architect strict-probe output and live file inspection, group the remaining mission-area backlog into these buckets:

1. **Architect runtime contract-normalization hotspots**
   - `src/features/architect/utils/mutationPipeline.ts`
   - `src/features/architect/GMDashboard/**`
   - `src/features/architect/hooks/useTradeMachine.ts`
   - `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
2. **Architect persistence / offer-sheet / season harnesses**
   - `tests/architect/seasonManager.test.ts`
   - `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
   - `tests/architect/offerSheetPersistence.test.ts`
   - the next strongest trade/cap integration harnesses by live strict count
3. **Architect remaining mock / fixture / compatibility layers**
   - any central helper or fixture files that still amplify test-side dishonesty or assignability churn
4. **Strict-prep families that remain after runtime/test normalization**
   - only if the evidence suggests a later focused cluster may still be needed

For each file or tight file group, record:

- path
- why it still matters
- whether it is runtime-critical, test-critical, or support-critical
- dominant current error families
- recommended wave order
- recommended validation commands

End the new section with a `Recommended continuation order` that maps directly to Steps 16–22 below.

Do not change source files in this step.

**Constraints specific to this step:**

- Keep the map centered on the remaining mission backlog. Do not reopen already-hardened shared/runtime work unless the live evidence says it regressed.
- Favor central contract owners over low-value leaf tests.
- This map must feed the next execution waves without requiring user decisions.

**Done when:** The execution map doc contains a truthful remaining-wave map for the Architect/runtime/test hardening backlog and the next steps below can execute directly from it. Commit message: `docs: map remaining TypeScript hardening waves`.

---

## Step 16 — Normalize the highest-leverage Architect runtime contract owners (wave 1)

**Status:** IN PROGRESS

Progress note 2026-04-22: Landed the isolated `SeasonAdvanceModal.tsx` null-to-undefined cleanup that cleared that 2-error pocket under `tsconfig.architect-strict.json`, but the broader `GMDashboard` / `useArchitectActions` / `mutationPipeline` runtime-carrier normalization attempt was reverted after it regressed the root compatibility gate. Resume from the current live hotspot cluster (`mutationPipeline.ts`: 55, `useArchitectActions.ts`: 22, `GMDashboard.tsx`: 5, `SeasonAdvanceModal.tsx`: 0).

**Goal:** Reduce the most central Architect runtime assignability/nullability debt by normalizing the contract owners that many downstream consumers depend on.

**Instructions:**
Use Step 15's remaining-wave map and begin with the highest-leverage runtime contract owners. Likely first-wave targets include:

- `src/features/architect/utils/mutationPipeline.ts`
- one tightly coupled dashboard/action adapter cluster that directly feeds it or receives its outputs

For the chosen wave:

1. Identify the concrete contract disagreements causing the dominant strict errors.
2. Normalize the runtime carrier types truthfully rather than layering more casts on top.
3. Fix downstream consumers that rely on the old dishonest contract.
4. Keep runtime behavior stable unless a behavior difference was only possible because the type contract was false.

Validation after each meaningful batch:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- the narrowest relevant Architect/runtime suites with `--reporter=dot`

**Constraints specific to this step:**

- This is a contract-normalization step, not a broad logic rewrite.
- Do not widen types to preserve false compatibility.
- If a product/architecture choice is truly required, ask one plain-language question and stop.

**Done when:** The first runtime contract-owner wave is normalized, the downstream consumers compile truthfully, and the Architect strict probe shows a meaningful reduction in the targeted error families. Commit message: `refactor: normalize architect runtime contracts wave 1`.

---

## Step 17 — Normalize the next Architect runtime contract owners (wave 2)

**Status:** TODO

**Goal:** Continue Architect runtime contract normalization through the next highest-leverage cluster exposed by Step 16 and the execution map.

**Instructions:**
Use the next wave from Step 15 and continue with the next highest-leverage contract cluster. Likely targets include:

- the remaining `GMDashboard/**` adapter surfaces
- `useTradeMachine.ts`
- `useArchitectActions.ts`
- any tight runtime bridge identified by the map as still central after Step 16

For the chosen wave:

1. Normalize the carrier/adapter contracts.
2. Remove casts or bag types that were only hiding disagreements.
3. Fix the consuming runtime surfaces truthfully.
4. Re-run the Architect strict probe and record the wave delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- the narrowest relevant Architect/runtime suites with `--reporter=dot`

**Constraints specific to this step:**

- Keep the wave bounded to the chosen cluster.
- Do not drift into unrelated low-value tests just because they also error.
- If Step 16 already collapses this cluster more than expected, record that and tighten the scope rather than over-expanding.

**Done when:** The second runtime contract wave is complete and the plan records the strict-probe delta plus what runtime hotspots remain. Commit message: `refactor: normalize architect runtime contracts wave 2`.

---

## Step 18 — Review runtime contract posture and classify the remaining runtime backlog

**Status:** TODO

**Goal:** After the first two runtime normalization waves, classify what Architect runtime debt remains and decide whether more runtime normalization is still needed before pushing harder on tests.

**Instructions:**
Append a `Runtime Contract Review` section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

Include:

1. Updated Architect strict-probe counts after Steps 16–17.
2. Which runtime hotspots were materially improved.
3. Which remaining runtime backlog is:
   - `Immediate next-wave candidate`
   - `Safe to defer until tests are tightened`
   - `Needs product/architecture decision`
4. A plain-language recommendation for whether the next wave should prioritize tests, more runtime normalization, or a mixed runtime/test cluster.

**Constraints specific to this step:**

- This is a review/classification step.
- Do not launch a third runtime wave inside this step; classify it instead.

**Done when:** The baseline doc truthfully records the runtime contract posture after the first normalization waves and the next priority is unambiguous. Commit message: `docs: review architect runtime contract posture`.

---

## Step 19 — Harden the highest-value remaining Architect persistence / season / offer-sheet harnesses (wave 1)

**Status:** TODO

**Goal:** Make the most important remaining Architect tests enforce the newly normalized runtime contracts instead of bypassing them with broad fixtures and compatibility casts.

**Instructions:**
Use Step 15's map and Step 18's recommendation. Start with the highest-value remaining test harness cluster, likely among:

- `tests/architect/seasonManager.test.ts`
- `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts`
- `tests/architect/offerSheetPersistence.test.ts`

For the chosen cluster:

1. Remove unnecessary `any`, `as any`, and bag fixtures.
2. Replace fake carrier shapes with truthful fixture contracts tied to the current runtime types.
3. Keep deliberately invalid test inputs explicit rather than hiding them inside permissive casts.
4. Update any shared fixture helpers needed by the selected cluster.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- the narrowest relevant test scripts with `--reporter=dot`

**Constraints specific to this step:**

- Focus on high-value harnesses only.
- Do not try to cleanse the entire test tree in one pass.
- If a runtime export/type tweak is needed to let the tests become truthful, that is allowed.

**Done when:** The first selected high-value Architect test cluster is materially more truthful and the strict probe drops meaningfully in its targeted files/error families. Commit message: `test: harden architect persistence harnesses wave 1`.

---

## Step 20 — Harden the next highest-value Architect test cluster (wave 2)

**Status:** TODO

**Goal:** Continue test-harness tightening through the next most central Architect cluster after Step 19.

**Instructions:**
Use the next cluster from the execution map and continue with the next highest-value remaining test hotspot.

For the chosen cluster:

1. Tighten fixtures, mocks, and helper contracts.
2. Remove broad typed bypasses where a truthful narrow contract can be used.
3. Keep test behavior the same unless the old behavior depended on a dishonest harness.
4. Re-run the Architect strict probe and record the delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- the narrowest relevant test scripts with `--reporter=dot`

**Constraints specific to this step:**

- Keep the wave bounded to one tight cluster.
- Do not drift into opportunistic cleanup of low-value leaf suites.

**Done when:** The second selected Architect test cluster is materially more truthful and the plan records the resulting strict-probe delta plus the remaining test hotspots. Commit message: `test: harden architect persistence harnesses wave 2`.

---

## Step 21 — Review typed-test posture again and classify what remains

**Status:** TODO

**Goal:** Re-measure the Architect test layer after the new harness waves and classify what test debt remains inside the mission.

**Instructions:**
Append a `Master Plan Test Review` section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

Include:

1. Updated test-side marker counts.
2. Which central Architect harnesses were materially improved in Steps 19–20.
3. Which remaining test backlog is:
   - `Immediate next-wave candidate`
   - `Safe to defer only if runtime strictness is otherwise mission-complete`
   - `Needs architecture-contract decision`
4. A plain-language conclusion on whether the high-value test layer is now mostly reinforcing runtime truth.

**Constraints specific to this step:**

- This is a measurement/classification step.
- Do not widen into another cleanup wave here.

**Done when:** The repo has a truthful post-wave review of the remaining Architect test debt and the next priority is clear. Commit message: `docs: review architect typed-test posture`.

---

## Step 22 — Master checkpoint: reassess full-project hardening readiness

**Status:** TODO

**Goal:** Re-run the mission-level measurements after the runtime and test normalization waves and determine whether the project is now actually close to complete hardening or whether another numbered wave must be appended.

**Instructions:**
This is the master checkpoint for the mission, not an exit ramp.

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Record the current counts and compare them to both:
   - the original baseline
   - the Step 14 master-plan resume baseline
3. Identify whether the remaining backlog is now:
   - small and localized enough for one final bounded wave,
   - still broad enough to require multiple additional waves,
   - blocked on a real product/architecture decision.
4. Append a `Master Hardening Checkpoint` section to the baseline doc that answers, plainly:
   - Are we now close to complete project hardening?
   - If not, exactly what remains?
   - What is the next highest-leverage wave?

Then do one of the following:

- If substantial mission-area backlog remains, append new numbered steps to this same plan immediately after Step 22 and update the flow summary near the top.
- If only a small final bounded wave remains, set up that final bounded wave as Steps 23–24 and continue.
- Only if the mission-level completion gates are truly satisfied may the plan proceed to the final review/closeout steps already at the bottom.

**Constraints specific to this step:**

- This step may not declare the mission complete by itself.
- If any substantial mission-area backlog remains, the plan must extend.
- Do not write "separate follow-on plan required" here. Extend this plan instead.

**Done when:** The baseline doc has a `Master Hardening Checkpoint` section and, if needed, this plan has been extended with the next numbered wave(s) inside the same document. Commit message: `docs: record master TypeScript hardening checkpoint`.

---

## Step 23 — Final review (only when the mission-level gates are truly satisfied)

**Status:** TODO

**Goal:** Recheck the full project as one system and produce a final review that truthfully supports mission completion.

**Instructions:**
Create or update `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md` only when the Step 22 master checkpoint proves that no substantial mission-area backlog remains.

The final review must cover:

- declaration layer
- shared/runtime boundaries
- Architect/runtime boundaries
- typed tests and mocks
- strictness posture
- remaining issues, if any

Classify the remaining issues only as:

- `Resolved in this master plan`
- `Minor optional follow-up`
- `User-declared out of scope`

The verdict must be a true mission-complete verdict. If the most honest verdict is still `PASS WITH DEBT`, `CONCERN`, or equivalent, this step is **not allowed to complete** and the plan must extend instead.

**Constraints specific to this step:**

- Do not use this step to smuggle in a phase-level win and call it project-complete.
- Only make tiny doc corrections here, not new source changes.

**Done when:** The final review doc truthfully supports completion of the mission and not merely completion of a phase. Commit message: `docs: record final project TypeScript hardening review`.

---

## Step 24 — Final closeout (only when the mission is actually done)

**Status:** TODO

**Goal:** Close this self-extending master plan only when the project is actually completely hardened according to the mission statement and the hard anti-loophole rules above.

**Instructions:**
Append a `Final Closeout` section to this doc only when all mission-level completion gates are satisfied.

The closeout must state:

1. Why the mission is now actually complete.
2. Which major dishonesty mechanisms were removed across the life of the master plan.
3. Which probes/measurements now support the completion claim.
4. Any remaining issues that are truly minor, optional, or user-declared out of scope.
5. Why no further mission-area numbered steps are required.

**Constraints specific to this step:**

- This step is forbidden unless the mission-level completion gates are satisfied.
- If a substantial mission-area backlog still exists, return to Step 22 behavior and extend the plan.

**Done when:** This document has a truthful final closeout and the repo is actually completely hardened for the mission defined at the top. Commit message: `docs: close out self-extending TypeScript hardening master plan`.

---

## Follow-up items (populate during execution)

_Anything surfaced during hardening that is real but not in scope for the step that found it. Examples: duplicated schemas, policy inconsistencies, low-value leaf files still using weak types, or minor optional cleanup that does not block mission completion. Do not use this section as a dumping ground for substantial mission-area backlog; substantial remaining hardening work must become numbered steps in this same plan._

---

## Status legend

- **TODO** — not started
- **IN PROGRESS** — partially done; agent should pick up where the last session left off (read the step's notes section if present)
- **DONE** — complete and merged
- **BLOCKED** — needs user input or external dependency; agent should explain why and stop

When marking a step DONE, agents may also append a brief `Completed YYYY-MM-DD: <one-line summary>` under the step header for future reference.
