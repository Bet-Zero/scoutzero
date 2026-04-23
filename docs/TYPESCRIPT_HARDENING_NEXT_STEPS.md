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
- Steps 23–24: harden the next persistence/world/cap truth clusters exposed by the master checkpoint
- Step 25: reassess post-wave readiness and split the remaining Architect/test debt into the next bounded waves
- Steps 26–27: harden the remaining exception/parity guardrail cluster, then the remaining integration/normalization harness cluster
- Step 28: reassess final-review readiness after the exception/parity and integration/normalization waves, then extend the plan again from the remaining backlog
- Steps 29–30: harden the next Architect/trade guardrail cluster and the next trade validator/unit truth cluster exposed by the Step 28 checkpoint
- Step 31: reassess readiness again after those new waves and extend again if substantial mission-area debt remains
- Steps 32–33: harden the next Architect DARE/trade-apply cluster, then the next trade-rule/TPE unit cluster exposed by the Step 31 checkpoint
- Step 34: reassess readiness again after those new waves and extend again if substantial mission-area debt remains
- Steps 35+ : append additional numbered waves as required until the mission-level completion gates are actually satisfied
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

**Status:** DONE

Progress note 2026-04-22: Landed the isolated `SeasonAdvanceModal.tsx` null-to-undefined cleanup that cleared that 2-error pocket under `tsconfig.architect-strict.json`, but the broader `GMDashboard` / `useArchitectActions` / `mutationPipeline` runtime-carrier normalization attempt was reverted after it regressed the root compatibility gate. Resume from the current live hotspot cluster (`mutationPipeline.ts`: 55, `useArchitectActions.ts`: 22, `GMDashboard.tsx`: 5, `SeasonAdvanceModal.tsx`: 0).

Completed 2026-04-22: Normalized the dashboard/action runtime adapter wave, manual cap-sheet payload handoffs, dev fixture generics, and trade-machine team lookup contracts while keeping root typecheck green. Architect strict probe moved from the Step 16 resume count of `2,632` to `2,549`; `useArchitectActions.ts`, `GMDashboard.tsx`, cap-sheet handoffs, and `useTradeMachine.ts` no longer appear in the runtime hotspot list. Remaining runtime work is concentrated in `mutationPipeline.ts` and `TradeEditor.tsx` for Step 17.

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

**Status:** DONE

Completed 2026-04-22: Normalized the remaining trade-editor/team-card runtime display adapters around nullable hook team and entitlement payloads, tightened current-state normalizers in `mutationPipeline.ts`, and recorded the Architect strict probe delta from `2,549` to `2,501`; `TradeEditor.tsx` / child trade-machine UI files no longer appear in the Architect strict output, while remaining runtime debt is concentrated in `mutationPipeline.ts` for Step 18 classification.

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

**Status:** DONE

Completed 2026-04-22: Added the baseline `Runtime Contract Review` with the
confirmed `2,501` Architect-strict count, runtime-vs-test concentration
breakdown, remaining runtime classification, and a recommendation to shift the
next wave to the highest-value test harnesses while keeping
`mutationPipeline.ts` as the next bounded runtime candidate.

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

**Status:** DONE

Completed 2026-04-22: Hardened `tests/helpers/architectTestHelpers.ts` and `tests/architect/seasonManager.test.ts` with truthful helper contracts, typed mock readers, and explicit season-advance success/failure narrowing; Architect strict moved from `2,501` to `2,403`, while both targeted files fell to `0` strict errors.

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

**Status:** DONE

Completed 2026-04-22: Hardened `src/tests/architect/phase50_executeTrade_integration_persistence.test.ts` and `tests/architect/offerSheetPersistence.test.ts` around typed mutation fixtures and required result helpers; the Architect strict probe dropped from `2,403` to `2,228`, both target files cleared from the strict output, and the narrow node test run passed for both harnesses.

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

**Status:** DONE

Completed 2026-04-22: Added the baseline `Master Plan Test Review` with live test-side marker counts, current Architect-strict test concentration, the Step 19-20 harness improvements, and a classification that keeps the next wave centered on cap/world/persistence truth while deferring the broader exception/parity guardrails.

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

**Status:** DONE

Completed 2026-04-22: Re-ran the root, shared-strict, and architect-strict probes; shared remains green while Architect improved to `2,228`, but the backlog is still broad across `168` files and dominated by test clusters. Added the `Master Hardening Checkpoint`, then extended this same plan with Steps 23-25 for the next persistence/world/cap waves instead of allowing any completion path.

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

## Step 23 — Harden the remaining persistence/world truth cluster (wave 3)

**Status:** DONE

Completed 2026-04-22: Hardened truthful persisted world/team readers plus the `mutationPipeline.tradePersistenceTruth`, `worldManager`, and `teamLoader` harnesses; the Architect strict probe dropped from `2,228` to `2,050`, none of the Step 23 files still appear in that output, and the targeted node run passed `87 / 87` tests.

**Goal:** Tighten the highest-leverage remaining persistence/world test harnesses that still sit closest to the hardened runtime readers and mutation carriers.

**Instructions:**
Use the Step 22 master checkpoint and the Step 21 test review. Focus this wave on the current persistence/world truth cluster, starting with:

- `tests/architect/mutationPipeline.tradePersistenceTruth.test.ts`
- `tests/architect/worldManager.test.ts`
- `tests/architect/teamLoader.test.ts`
- only the minimum supporting mock/helper readers needed to make those harnesses truthful

For the chosen cluster:

1. Replace bag-shaped persisted team/world snapshots with truthful helper-backed fixtures.
2. Align mock snapshot readers with the current hardened reader/runtime contracts instead of broad object assumptions.
3. Remove typed bypasses that only exist to paper over persistence-shape disagreement.
4. Keep runtime behavior the same unless the previous harness shape depended on false persistence truth.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/architect/mutationPipeline.tradePersistenceTruth.test.ts tests/architect/worldManager.test.ts tests/architect/teamLoader.test.ts`

**Constraints specific to this step:**

- Keep the wave bounded to the persistence/world truth cluster.
- Do not drift into cap legality, renounce rights, or exception parity in this step.
- Runtime helper edits are allowed only when they are the minimum needed to make the selected harnesses truthful.

**Done when:** The persistence/world truth cluster is materially more truthful, the targeted tests pass, and the Architect strict probe shows a meaningful drop in those files. Commit message: `test: harden architect persistence truth wave 3`.

---

## Step 24 — Harden the cap legality / rights persistence cluster (wave 4)

**Status:** DONE

Completed 2026-04-22: Hardened the `capLegalityValidation` and `renounceRights` harnesses around truthful cap/rules fixtures, required violation/warning readers, and persisted-state payload guards; the Architect strict probe dropped from `2,050` to `1,914`, neither Step 24 file still appears in that output, and the targeted node run passed `248 / 248` tests.

**Goal:** Tighten the next highest-value cap/rules persistence harnesses after the world/persistence truth cluster.

**Instructions:**
Use the next hotspot cluster from the Step 22 checkpoint. Focus on:

- `tests/architect/capLegalityValidation.test.ts`
- `tests/architect/renounceRights.test.ts`
- the minimum supporting cap/rights helpers or runtime contract nips required to keep those harnesses truthful

For the chosen cluster:

1. Remove raw persisted-state assumptions and broad typed bypasses.
2. Normalize fixture/state builders around the current cap legality and renounce-rights contracts.
3. Keep behavior unchanged unless the old harness depended on a dishonest shape.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/architect/capLegalityValidation.test.ts tests/architect/renounceRights.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to cap legality / renounce-rights truth.
- Do not widen into the exception/parity guardrail suites yet.

**Done when:** The cap legality / rights persistence cluster is materially more truthful and the plan records the resulting strict-probe delta plus what still remains. Commit message: `test: harden architect cap and rights harnesses`.

---

## Step 25 — Post-wave checkpoint: classify the remaining exception/parity backlog

**Status:** DONE

Completed 2026-04-22: Re-ran the root compatibility gate plus the shared and Architect strict probes, confirmed the shared probe remains green while Architect strict sits at `1,914`, and classified the remaining backlog as two more bounded waves rather than one last cleanup pass or an architecture blocker.

**Goal:** Re-run the mission-level measurements after Steps 23-24 and decide whether the remaining exception/parity/integration debt is one final bounded wave or still broad enough to require multiple additional waves.

**Instructions:**
Append a `Post-Step-24 Hardening Checkpoint` section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint.
3. Classify whether the remaining backlog is now:
   - one bounded exception/parity wave,
   - still multiple waves,
   - blocked on a real architecture decision.
4. Append the next numbered steps to this same plan immediately after Step 25 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the post-wave checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-wave architect hardening checkpoint`.

---

## Step 26 — Harden the exception lifecycle / parity guardrail cluster (wave 5)

**Status:** DONE

Completed 2026-04-22: Hardened the `phase76` exception lifecycle parity, `phase74` room exception, and `exceptionManagement` harnesses around truthful exception fixtures plus required violation/team-update readers; the Architect strict probe dropped from `1,914` to `1,730`, none of the Step 26 files still appear in that output, and the targeted node run passed `59 / 59` tests.

**Goal:** Tighten the remaining exception/parity guardrail harnesses that now dominate the Architect strict backlog after the cap-legality / rights wave.

**Instructions:**
Focus this wave on the tightest remaining exception/parity cluster:

- `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts`
- `src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts`
- `src/tests/architect/exceptionManagement.test.ts`
- only the minimum supporting helper/runtime edits required to make those harnesses truthful

For the chosen cluster:

1. Replace raw optional exception snapshots and parity assumptions with required-reader helpers.
2. Align fixture builders with the current exception lifecycle and season-advance contracts instead of bag-shaped state.
3. Keep runtime behavior unchanged unless a harness depended on a dishonest contract.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.ts src/tests/architect/phase74_room_exception_mvp_guardrails.test.ts src/tests/architect/exceptionManagement.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to exception lifecycle / parity truth.
- Do not widen into the broader integration/normalization suites in this step.

**Done when:** The exception/parity guardrail cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect exception parity guardrails`.

---

## Step 27 — Harden the remaining integration / normalization harness cluster (wave 6)

**Status:** DONE

Completed 2026-04-23: Hardened the planned integration/normalization harness cluster across `contractNormalization`, `schemaAdapter`, `integration`, `e2e-workflows`, and the Phase 13 entitlement guardrail; Step 27 validation passed with root typecheck green, the targeted node pack at `100 / 100`, and Architect strict reduced from `1,730` to `1,502`.

**Goal:** Tighten the next highest-leverage integration/normalization harnesses after the exception/parity cluster is reduced.

**Instructions:**
Focus this wave on:

- `tests/architect/contractNormalization.test.ts`
- `tests/architect/integration.test.ts`
- `tests/architect/e2e-workflows.test.ts`
- `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts`
- `tests/architect/schemaAdapter.test.ts`
- any tiny follow-up helper fixups from the earlier cap-legality/rights wave only if they are required to keep this cluster truthful

For the chosen cluster:

1. Remove broad typed bypasses and raw optional integration-state assumptions.
2. Align normalization/integration fixtures with the current runtime contracts.
3. Keep runtime behavior unchanged unless an assertion depended on a dishonest shape.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/architect/contractNormalization.test.ts tests/architect/integration.test.ts tests/architect/e2e-workflows.test.ts src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.ts tests/architect/schemaAdapter.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the integration/normalization cluster.
- Do not reopen the already-cleared persistence/world/cap truth harnesses except for minimal shared helper truth.

**Done when:** The integration/normalization cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect integration normalization harnesses`.

---

## Step 28 — Post-wave checkpoint: reassess final-review readiness

**Status:** DONE

Completed 2026-04-23: Re-ran the root/shared/architect probes after Steps 26-27, confirmed root/shared remain green while Architect strict still sits at `1,502`, and extended the plan with new bounded waves instead of routing dishonestly to final review.

**Goal:** Re-run the mission-level measurements after Steps 26-27 and decide whether the plan is honestly ready for final review or still needs more numbered waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 25 post-wave checkpoint.
3. State whether the mission is honestly ready for final review or still needs more numbered waves.
4. Append additional numbered steps immediately after Step 28 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-exception architect hardening checkpoint`.

---

## Step 29 — Harden the next Architect / trade guardrail cluster (wave 7)

**Status:** DONE

Completed 2026-04-23: Hardened the planned Phase 17 / Phase 5 / Phase 55 / Phase 61 / Phase 79 guardrail cluster, kept root typecheck green, passed the bounded node pack at `100 / 100`, and reduced Architect strict from `1,502` to `1,336` without reopening `mutationPipeline.ts` beyond test-driven guardrail truth.

**Goal:** Tighten the next highest-leverage Architect/trade guardrail cluster now that the integration/normalization wave is clear.

**Instructions:**
Focus this wave on:

- `src/tests/architect/phase17_entitlement_routing_guardrail.test.ts`
- `src/tests/tradeMachine/phase5DraftPositions.test.ts`
- `src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts`
- `src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts`
- `src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts`
- any tiny `src/features/architect/utils/mutationPipeline.ts` contract-owner fixups that are directly required to keep this cluster truthful

For the chosen cluster:

1. Remove raw optional update/validation assumptions and stale fixture shapes.
2. Tighten entitlement-routing, draft-position, allowlist, and totals/persistence expectations around the live runtime contracts.
3. Keep any `mutationPipeline.ts` edits narrowly coupled to the failing guardrail cluster rather than reopening a broad runtime wave.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/phase17_entitlement_routing_guardrail.test.ts src/tests/tradeMachine/phase5DraftPositions.test.ts src/tests/architect/phase55_trade_validation_separation_guardrails.test.ts src/tests/architect/phase61_persistence_contract_allowlist_guardrails.test.ts src/tests/architect/phase79_mutation_pipeline_totals_ssot_persist_reload_parity_guardrails.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the Architect/trade guardrail cluster.
- Do not widen into the remaining trade validator/unit tests except for minimal shared helper truth that this cluster directly requires.

**Done when:** The guardrail cluster is materially more truthful, any coupled `mutationPipeline.ts` fixups stay bounded, and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect trade guardrail truth cluster`.

---

## Step 30 — Harden the next trade validator / unit truth cluster (wave 8)

**Status:** DONE

Completed 2026-04-23: Hardened the planned validator/unit truth cluster across `validatorContractCleanup`, `validatorTrustFixes`, `consent_and_reacq`, and `extension_voidedByExtension`; kept root typecheck green, passed the bounded node pack at `21 / 21`, and reduced Architect strict from `1,336` to `1,212` without widening into the DARE/e2e backlog.

**Goal:** Tighten the remaining high-value trade validator/unit harnesses that still dominate the post-Step-28 backlog outside the Architect guardrail cluster.

**Instructions:**
Focus this wave on:

- `tests/trade/validatorContractCleanup.test.ts`
- `tests/trade/validatorTrustFixes.test.ts`
- `tests/trade/consent_and_reacq.test.ts`
- `tests/architect/extension_voidedByExtension.test.ts`
- any tiny shared trade-rule helper truth fixups that are directly required to keep this cluster honest

For the chosen cluster:

1. Remove broad bag/object assumptions and default `never[]` / implicit-any fixture traps.
2. Align validator and rule-envelope assertions with the live trade validation contracts.
3. Keep behavior unchanged unless a test was only passing because it depended on a dishonest shape.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/trade/validatorContractCleanup.test.ts tests/trade/validatorTrustFixes.test.ts tests/trade/consent_and_reacq.test.ts tests/architect/extension_voidedByExtension.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the validator/unit truth cluster.
- Do not widen into the larger DARE/e2e smoke surfaces unless a tiny helper truth fix is required to make these files honest.

**Done when:** The validator/unit cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden trade validator truth cluster`.

---

## Step 31 — Post-wave checkpoint: reassess final-review readiness again

**Status:** DONE

Completed 2026-04-23: Re-ran the root/shared/architect probes after Steps 29-30, confirmed root/shared remain green while Architect strict now sits at `1,212`, and extended the plan again into one bounded Architect DARE/trade-apply wave plus one bounded trade-rule/TPE unit wave instead of routing dishonestly to final review.

**Goal:** Re-run the mission-level measurements after Steps 29-30 and decide whether the plan is honestly ready for final review or still needs more numbered waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 28 checkpoint.
3. State whether the mission is honestly ready for final review or still needs more numbered waves.
4. Append additional numbered steps immediately after Step 31 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-guardrail hardening checkpoint`.

---

## Step 32 — Harden the next Architect DARE / trade-apply truth cluster (wave 9)

**Status:** DONE

Completed 2026-04-23: Hardened the planned Architect DARE / trade-apply cluster across `phaseD3_true_e2e_gate_guardrails`, `phaseD_e2e_trade_then_advance_smoke`, `signAndTrade`, `phase57_forbid_validateTrade_in_compute_guardrail`, and `phase49_tpe_exception_history_logging_guardrails`; kept root typecheck green, passed the bounded node pack at `83 / 83`, and reduced Architect strict from `1,212` to `1,079` without widening into the remaining trade-rule / TPE unit backlog.

**Goal:** Tighten the next highest-leverage Architect/test cluster now that the validator/unit wave is clear and the remaining backlog is led by DARE, sign-and-trade, and trade-apply guardrails.

**Instructions:**
Focus this wave on:

- `src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts`
- `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts`
- `src/tests/architect/signAndTrade.test.ts`
- `src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.ts`
- `src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts`
- any tiny `src/features/architect/utils/mutationPipeline.ts` fixups that are directly required to keep this cluster truthful

For the chosen cluster:

1. Remove stale trade-apply fixtures, raw optional validated-context reads, and any remaining legacy executeTrade assumptions.
2. Keep DARE/smoke and sign-and-trade assertions aligned with the live trade-apply and validated-trade-context contracts.
3. Keep `mutationPipeline.ts` edits tightly coupled to this cluster rather than reopening a broad runtime wave.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot src/tests/architect/dare/phaseD3_true_e2e_gate_guardrails.test.ts src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.ts src/tests/architect/signAndTrade.test.ts src/tests/architect/phase57_forbid_validateTrade_in_compute_guardrail.test.ts src/tests/architect/phase49_tpe_exception_history_logging_guardrails.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the Architect DARE / trade-apply cluster.
- Do not widen into the remaining trade-rule unit tests except for tiny shared truth fixups that this cluster directly requires.

**Done when:** The Architect DARE / trade-apply cluster is materially more truthful, any coupled runtime fixups stay bounded, and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden architect dare trade apply cluster`.

---

## Step 33 — Harden the next trade-rule / TPE unit cluster (wave 10)

**Status:** TODO

**Goal:** Tighten the next highest-value trade-rule / TPE unit cluster exposed by the Step 31 checkpoint after the Architect DARE/trade-apply wave is clear.

**Instructions:**
Focus this wave on:

- `tests/trade/tpe_creation_expiry_usage.test.ts`
- `tests/trade/secondApronBoundary.test.ts`
- `tests/trade/timingEnforcement_authoritative.test.ts`
- `tests/trade/reacquisition_bar.test.ts`
- `tests/trade/tpe_absorption_fail_closed.test.ts`
- `tests/trade/validation_caching.test.ts`
- any tiny shared trade-rule helper truth fixups that are directly required to keep this cluster honest

For the chosen cluster:

1. Remove implicit-any fixture builders, `never[]` defaults, and stale TPE/second-apron assumption bags.
2. Keep TPE lifecycle, timing, reacquisition, and second-apron assertions aligned with the live rule contracts.
3. Keep behavior unchanged unless a test only passed because it depended on a dishonest fixture shape.
4. Record the resulting Architect strict delta in the baseline doc.

Validation:

- `npm run typecheck`
- `npm run typecheck -- --project tsconfig.architect-strict.json`
- `npm run test:node -- --reporter=dot tests/trade/tpe_creation_expiry_usage.test.ts tests/trade/secondApronBoundary.test.ts tests/trade/timingEnforcement_authoritative.test.ts tests/trade/reacquisition_bar.test.ts tests/trade/tpe_absorption_fail_closed.test.ts tests/trade/validation_caching.test.ts`

**Constraints specific to this step:**

- Keep this wave bounded to the trade-rule / TPE unit cluster.
- Do not widen back into the Architect DARE/e2e cluster except for tiny shared rule truth that this cluster directly requires.

**Done when:** The trade-rule / TPE unit cluster is materially more truthful and the baseline records the resulting strict-probe delta plus what remains. Commit message: `test: harden trade rule tpe truth cluster`.

---

## Step 34 — Post-wave checkpoint: reassess final-review readiness again

**Status:** TODO

**Goal:** Re-run the mission-level measurements after Steps 32-33 and decide whether the plan is honestly ready for final review or still needs more numbered waves.

**Instructions:**
Append a new checkpoint section to `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`.

That section must:

1. Re-run:
   - `npm run typecheck`
   - `npm run typecheck -- --project tsconfig.shared-boundaries-strict.json`
   - `npm run typecheck -- --project tsconfig.architect-strict.json`
2. Compare the new results to:
   - the original baseline,
   - the Step 14 master-plan resume baseline,
   - the Step 22 master checkpoint,
   - the Step 31 checkpoint.
3. State whether the mission is honestly ready for final review or still needs more numbered waves.
4. Append additional numbered steps immediately after Step 34 if substantial mission-area backlog still remains.

**Constraints specific to this step:**

- This is a checkpoint step, not a cleanup wave.
- Do not route to final review/closeout unless the mission-level completion gates are actually satisfied.

**Done when:** The baseline doc contains the new checkpoint and the plan has been extended again if needed. Commit message: `docs: record post-dare hardening checkpoint`.

---

## Step 35 — Final review (only when the mission-level gates are truly satisfied)

**Status:** TODO

**Goal:** Recheck the full project as one system and produce a final review that truthfully supports mission completion.

**Instructions:**
Create or update `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md` only when the latest master checkpoint proves that no substantial mission-area backlog remains.

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

## Step 36 — Final closeout (only when the mission is actually done)

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
