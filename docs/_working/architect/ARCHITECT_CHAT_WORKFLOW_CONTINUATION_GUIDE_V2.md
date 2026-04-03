# ARCHITECT CHAT WORKFLOW CONTINUATION GUIDE — V2

## Purpose

This is the V2 continuation guide for carrying the Architect review / execution workflow into a new chat while keeping the same repo-first rigor and improving execution efficiency.

V2 keeps the existing workflow skeleton:

- decompose first
- repo-first working docs
- review record → action breakdown → bootstrap → execution
- tracker and issue log remain distinct
- whole-feature closeout remains a real verdict gate
- unblock + rereview remains the standard closeout pattern when needed

V2 also adds efficiency defaults:

- shorter prompts by default
- direct execution prompts once the seam is known
- tiered validation by default
- reuse of known validation surfaces
- milestone-level process updates for tiny related fixes when appropriate

This guide should be treated as the active workflow unless intentionally replaced.

---

# 1. Core Workflow Rule

Every major Architect feature area should still follow this order:

1. **Layer / section decomposition first**
2. **Step prompt set second**
3. **Step review execution**
4. **Working-doc creation and tracking**
5. **Slice-by-slice fixes / hardening**
6. **Whole-feature closeout review**
7. **Unblock execution if needed**
8. **Whole-feature rereview**
9. **Mark feature closed and move on**

This does **not** change in V2.

Important rule:

Do **not** jump straight to a Step 1 prompt without first decomposing the feature into the correct code-level sections/layers/responsibility seams.

---

# 2. What V2 Changes

V2 is not a new workflow. It is the same workflow with better efficiency defaults.

## V2 default upgrades

1. **Prefer direct execution prompts over planning prompts** once the seam is known
2. **Batch adjacent substeps** when they share the same live seam, files, or validation surface
3. **Keep audits code-first and lightweight** once the seam is already understood
4. **Use tiered validation by default**
5. **Reuse known validation surfaces** instead of rediscovering them each time
6. **Keep prompts shorter and more operational** by default
7. **Allow milestone-level tracker/log updates for tiny related fixes when appropriate**
8. **Preserve all repo-first and closeout discipline**

---

# 3. Non-Negotiables (Still Required in V2)

These remain mandatory:

1. **Decompose the feature first**
2. **Workspace code is source of truth**
3. **Do not rely on prior docs as truth** unless explicitly intended
4. **Review Record comes before Action Breakdown**
5. **Bootstrap comes before execution**
6. **Tracker and Issue Log stay meaningfully different**
7. **Whole-feature closeout review is mandatory**
8. **If closeout is blocked, do narrow unblock + rereview**
9. **Prefer the smallest structural change that clarifies the seam**
10. **No unrelated cleanup**

V2 is meant to reduce drag, not reduce standards.

---

# 4. Roles

## ChatGPT role

ChatGPT should:

- inspect the live repo/code directly when asked to review a step or decompose a feature
- determine the real layers/seams before prompts are written
- write:
  - step prompts
  - review records
  - action breakdowns
  - bootstrap prompts
  - execution prompts
  - unblock prompts
  - whole-feature closeout review prompts
  - rereview prompts
- evaluate return packages critically
- decide whether a step is actually closed
- decide whether a whole-feature PASS is real
- recommend the next best section after a feature closes
- keep prompts operational and efficient when the seam is already understood

## Repo-access agent role

The repo-access agent should:

- execute the prompt
- inspect live code directly
- make code/doc/test changes when requested
- update tracker + issue log when the prompt requires it
- run the required validation
- write the requested return package into the canonical repo path

---

# 5. Required Sequence for a New Feature Area

Whenever starting a new feature area, use this exact order.

## Phase A — Decomposition first

Before any step prompt is written:

1. Chat reviews the feature at a high level
2. Chat identifies the real sections/layers/responsibility seams
3. Chat defines the full step list for that feature area

Important rule:

- steps should represent **real code-level responsibility seams**
- not arbitrary widget buckets
- not generic “cleanup” buckets

Only after that should the step prompts be written.

## Phase B — Step prompt set

Once decomposition is done, Chat writes the full prompt set:

- Step 1 prompt
- Step 2 prompt
- Step 3 prompt
- ...
- whole-feature closeout review prompt

## Phase C — Live review + working docs

For each step, the standard process is still:

1. User gives Chat the current Step prompt as a task
2. Chat reviews live code and returns the review result
3. Chat writes the **Review Record** into the repo
4. Chat writes the **Action Breakdown** into the repo
5. Chat writes the **Bootstrap prompt**
6. Agent executes bootstrap
7. User sends bootstrap return package
8. Chat writes the first execution prompt

---

# 6. Standard Step Structure

Each step still normally follows this pattern.

## Review Record

The review record should include:

- scope
- purpose of the step
- executive verdict (`PASS`, `RISK`, or `FAIL`)
- exact system map for that step
- analysis of what is coherent vs what is weak
- duplicate / fallback / legacy / alternate path analysis
- final conclusion
- files reviewed

Path:

- `docs/_working/architect/<feature-folder>/ARCHITECT_<FEATURE>_STEPX_REVIEW_RECORD.md`

## Action Breakdown

The action breakdown should:

- convert the review findings into execution substeps
- define each substep as a real structural problem to solve
- explain why each substep matters
- define success criteria
- optionally group substeps into efficient execution batches

Path:

- `docs/_working/architect/<feature-folder>/ARCHITECT_<FEATURE>_STEPX_ACTION_BREAKDOWN.md`

## Bootstrap

Bootstrap should:

- verify prior step status is correct
- create or update the Review Tracker
- create or update the Issue Log
- add the new step section
- create problem-level issues derived from the review record and action breakdown

Return package path:

- `return_packages/architect/ARCHITECT_<FEATURE>_STEPX_BOOTSTRAP_RETURN_PACKAGE.md`

---

# 7. Tracker vs Issue Log Rules

These must stay meaningfully different.

## Review Tracker

The tracker is:

- execution checklist only
- step/substep status only
- no deep problem analysis
- one row per execution substep

Typical path:

- `docs/_working/architect/<feature-folder>/ARCHITECT_<FEATURE>_REVIEW_TRACKER.md`

## Issue Log

The issue log is:

- root-problem backlog
- not a mirror of the tracker
- allowed to merge multiple substeps into one issue
- focused on underlying structural problems

Typical path:

- `docs/_working/architect/<feature-folder>/ARCHITECT_<FEATURE>_ISSUE_LOG.md`

Important rules:

- do not force one issue per substep
- merge when multiple substeps share one root cause
- issue descriptions should describe the underlying system problem, not just restate the substep title

---

# 8. V2 Prompt Strategy

## 8.1 Decompose first, then prompt

Do not skip decomposition.

Once the real seam is known, V2 prefers **direct execution prompts** instead of extra planning prompts.

## 8.2 Prefer direct execution prompts when the seam is already known

Default:

- go straight to execution when the seam is already understood

Only use a planning prompt first if:

- the seam is genuinely ambiguous
- the task spans multiple unrelated systems
- product-direction or scope decisions are still unresolved

## 8.3 Batch adjacent substeps when they share a seam

Default:

- batch `A + B` if they touch the same hook/component family/persistence seam
- batch `C + D` if they share the same reload/guardrail/durability seam

Do **not** split work just for symmetry.
Split by **real seam**, not by letter count.

## 8.4 Keep prompts shorter by default

Default execution prompt structure should usually be:

- Objective
- Why these are batched (if batched)
- Live seam / scope
- Required implementation changes
- Files likely to change
- Validation
- Tracking/doc updates only if needed
- Return package requirements

Long rationale sections should only be included when they materially change implementation behavior.

---

# 9. V2 Validation Strategy

## Default rule: tiered validation

Unless explicitly required otherwise:

### For intermediate seam work

Use:

- targeted tests
- `npm run typecheck`

### For milestone / step closeout work

Use:

- `npm run test:diff -- --reporter=dot`
- `npm run build`

### For whole-feature closeout

Run the validation set required by the closeout prompt.

## Important rule

Do **not** require broad expensive validation after every tiny seam change unless:

- the risk clearly justifies it
- the task materially changes the validation surface
- the user explicitly asks for broader validation

## Reuse known validation surfaces

If prior related executions already identified the right test files for a seam, reuse them.

Do **not** rediscover the validation map in every new prompt unless the seam changed materially.

---

# 10. V2 Documentation Cadence

V2 keeps the same docs, but reduces unnecessary repetition.

## Still required at the start of a new step

For a **new step**, still do:

1. Review Record
2. Action Breakdown
3. Bootstrap

That does not change.

## For tiny related follow-up fixes within the same already-open milestone

You may reduce overhead when all of the following are true:

- the seam is already known
- the task is technically small
- it belongs to the same active milestone/batch
- it does not materially change the feature map
- it does not require a new step definition

In those cases, prefer:

- one shorter execution prompt
- one return package
- tracker/log updates at the milestone level if appropriate

## Important limitation

Do **not** skip tracker/log updates when:

- a step changes status
- an issue meaningfully changes state
- a whole-feature blocker is resolved
- a closeout/unblock/rereview stage is happening

So V2 allows **less repeated ceremony**, but not loss of repo memory.

---

# 11. Standard Execution Flow Inside a Step

Most steps should still follow this structure:

1. **Bootstrap**
2. **First execution batch**
3. **Second execution batch if needed**
4. **Step closeout**

Typical batching style:

- `A + B` together if they live in the same implementation seam
- `C + D` together if they live in the same protection/reload/guardrail seam

Chat should decide batching from the real seam, not from symmetry.

---

# 12. Return Package Evaluation Rules

Chat should not treat a return package as automatically correct.

For every return package, Chat should decide:

1. Did the execution actually solve the intended seam?
2. Did it stay within scope?
3. Did validation actually prove the intended claim?
4. Is the step really closed, or only partially improved?
5. What is the next correct prompt?

If the package solved the seam, Chat should mark the batch closed and write the next prompt.
If not, Chat should write a follow-up prompt instead of pretending the step is done.

---

# 13. Whole-Feature Closeout Rules

A feature is not closed just because all slices were reviewed.

After slice-by-slice review is complete, Chat should write a:

- **whole-feature closeout review prompt**

That review must check:

- how all slices connect together
- whether the feature is clean as one system
- whether there are still cross-surface or cross-flow truth gaps
- whether the overall verdict should be `PASS`, `RISK`, or `FAIL`

## Important rule

Whole-feature review is still a real verdict gate.

If it returns `RISK` or `FAIL`, Chat should:

- determine whether the blocker is a real feature bug or only a validation blocker
- write a narrow unblock prompt if needed
- then request a rereview

Only after the rereview comes back clean should the feature be considered closed.

---

# 14. Unblock Pattern (Still Standard)

If whole-feature closeout is blocked by one narrow seam:

1. Chat writes a **closeout-unblock execution prompt**
2. Agent fixes only that seam
3. Validation is rerun
4. Chat writes or requests a **whole-feature rereview**
5. If rereview returns `PASS`, the feature closes

Important rule:

- unblock prompts should stay **narrow**
- do not reopen broad cleanup unless the blocker truly requires it

---

# 15. Final Polish Pattern (Optional, Use Sparingly)

If a feature is effectively clean but still has 1–2 non-blocking soft seams:

1. Chat may recommend a **small final-polish execution pass**
2. that pass should be narrow and durability-focused
3. then run the whole-feature agent review or rereview on the final state

Use this only when it improves efficiency.
Do not turn every feature into endless polish.

---

# 16. Recommended Naming Conventions

## Working-doc folders

Use:

- `docs/_working/architect/<feature-folder>/`

Examples:

- `docs/_working/architect/free-agency/`
- `docs/_working/architect/offseason/`
- `docs/_working/architect/world-time/`

## Standard filenames

- `ARCHITECT_<FEATURE>_REVIEW_TRACKER.md`
- `ARCHITECT_<FEATURE>_ISSUE_LOG.md`
- `ARCHITECT_<FEATURE>_STEP1_REVIEW_RECORD.md`
- `ARCHITECT_<FEATURE>_STEP1_ACTION_BREAKDOWN.md`
- etc.

## Return package path

Use:

- `return_packages/architect/`

Examples:

- `ARCHITECT_<FEATURE>_STEP1_BOOTSTRAP_RETURN_PACKAGE.md`
- `ARCHITECT_<FEATURE>_1A_1B_EXECUTION_RETURN_PACKAGE.md`
- `ARCHITECT_<FEATURE>_WHOLE_FEATURE_CLOSEOUT_REVIEW_RETURN_PACKAGE.md`
- `ARCHITECT_<FEATURE>_WHOLE_FEATURE_CLOSEOUT_UNBLOCK_EXECUTION_RETURN_PACKAGE.md`
- `ARCHITECT_<FEATURE>_WHOLE_FEATURE_CLOSEOUT_REREVIEW_RETURN_PACKAGE.md`

---

# 17. New Chat Kickoff Template

When starting a new chat, paste a short kickoff like this:

- We are continuing the Architect repo-first workflow.
- Follow `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V2.md` as the active process guide.
- Decompose each feature first into real code-level sections/layers before writing Step prompts.
- Keep tracker and issue log distinct.
- Keep whole-feature closeout as a real verdict gate.
- Use the V2 efficiency defaults: shorter execution prompts, tiered validation, reuse known validation surfaces, and milestone-level process updates for tiny related fixes when appropriate.

Then specify the next feature or current step.

---

# 18. Current Status Snapshot (at time this file was written)

At this point in the workflow:

- **Free Agency**: whole-feature closeout complete
- **Offseason**: whole-feature closeout complete
- **League / World Time / As-Of**: in progress
  - Step 1 complete
  - Step 2 review record and action breakdown completed
  - Step 2 bootstrap prompt written

If this file is reused later, the user/chat should update this section as needed.

---

# 19. Practical Rules to Preserve Across Chats

1. **Decompose first. Do not skip this.**
2. **Repo-first docs are part of the workflow, not optional extras.**
3. **Review Record comes before Action Breakdown.**
4. **Bootstrap comes before execution.**
5. **Tracker and Issue Log must stay meaningfully different.**
6. **Execution batches should match real seams, not arbitrary symmetry.**
7. **Use targeted validation by default; broaden only when needed.**
8. **Reuse known validation surfaces when the seam is unchanged.**
9. **Whole-feature closeout is mandatory before calling a feature done.**
10. **If whole-feature closeout is blocked, do a narrow unblock + rereview.**
11. **Do not confuse validation blockers with real feature blockers.**
12. **Once a feature closes cleanly, move on. Do not linger.**

---

# 20. Fast Version

If a new chat needs the short version:

- decompose feature structure first
- define all step layers first
- write step prompts second
- for each step: review → review record → action breakdown → bootstrap → execution → return package evaluation
- keep tracker + issue log in repo
- use shorter execution prompts by default
- use targeted validation by default
- reuse known validation maps
- allow milestone-level process updates for tiny related fixes when appropriate
- after all steps: whole-feature closeout review
- if blocked: narrow unblock execution → rereview
- only mark the feature closed after whole-feature PASS

---

## End of Workflow Guide V2
