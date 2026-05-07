# ARCHITECT CHAT WORKFLOW CONTINUATION GUIDE — V3

## Status

This is the **official active workflow guide** for continuing Architect work across new chats.

It **supersedes earlier continuation guides** when there is any conflict.

Use this guide as the process source of truth for:

- the user
- ChatGPT
- repo-access agents such as Codex

---

# 1. Core Principle

We are **keeping the same repo-first review system**, but we are now in a more efficient operating mode.

## Official rule

**Heavy setup at feature start. Lighter execution inside the feature once the seam structure is already established.**

That means:

- we do **not** abandon the review structure
- we do **not** abandon repo docs
- we do **not** abandon whole-feature closeout
- but we **do** reduce repeated setup ceremony once a feature area is already underway and the seams are already known

---

# 2. What Stays the Same

These are still mandatory:

1. **Decompose the feature first** into real code-level sections/layers before writing Step prompts
2. **Workspace code is source of truth**
3. **Do not rely on prior docs as truth** unless explicitly intended
4. **Review Record comes before Action Breakdown**
5. **Bootstrap comes before execution**
6. **Tracker and Issue Log remain distinct documents**
7. **Whole-feature closeout review is mandatory**
8. **If closeout is blocked, do narrow unblock + rereview**
9. **Prefer the smallest structural change that clarifies the seam**
10. **No unrelated cleanup**

These are the workflow skeleton and are not optional.

---

# 3. What Changes in V3

V3 makes the execution process lighter **after the feature structure is already established**.

## New efficiency defaults

1. **Prefer direct execution prompts over planning prompts** once the seam is known
2. **Batch adjacent substeps** when they share the same live seam, files, or validation surface
3. **Keep execution prompts shorter and more operational**
4. **Use tiered validation by default**
5. **Reuse known validation surfaces** instead of rediscovering them every time
6. **Reduce repeated process overhead inside an active feature**
7. **Allow milestone-level tracker/log updates for tiny related follow-ups when appropriate**
8. **Keep whole-feature closeout and unblock discipline unchanged**

---

# 4. The Practical Operating Model

## A. Feature start = full setup

At the start of a brand-new feature area, still do the full setup:

1. feature decomposition
2. full step list
3. Review Record
4. Action Breakdown
5. Bootstrap

Reason:

At the start of a feature, we still need to define the seams correctly.

## B. Inside the feature = lighter execution mode

Once a feature is already in progress and the seam structure is known:

- use shorter prompts
- batch seam-adjacent work
- use targeted validation by default
- reuse known validation maps
- avoid repeating long setup language unless something materially changed
- update tracker/issue log when status meaningfully changes, not for every microscopic note

## C. Feature end = full rigor again

At feature closeout, return to full rigor:

- whole-feature closeout review
- unblock execution if needed
- rereview if needed
- only then mark the feature closed

---

# 5. Roles

## User role

The user:

- decides priorities
- starts new chats when needed
- provides the active workflow guide and roadmap
- sends prompts to the repo-access agent
- sends return packages back to ChatGPT for evaluation

## ChatGPT role

ChatGPT should:

- inspect live repo/code directly when asked to review a step or decompose a feature
- determine the real feature layers/seams before writing prompts
- write:
  - step prompts
  - review records
  - action breakdowns
  - bootstrap prompts
  - execution prompts
  - unblock prompts
  - whole-feature closeout prompts
  - rereview prompts
- evaluate return packages critically
- decide whether a seam is actually closed
- decide whether a whole-feature PASS is real
- keep prompts shorter and more operational once the seam is already understood

## Repo-access agent role

The repo-access agent should:

- execute the prompt
- inspect live code directly
- make code/doc/test changes when requested
- update tracker + issue log when the prompt requires it
- run required validation
- write the requested return package into the canonical repo path

---

# 6. Required Sequence for a New Feature Area

Whenever starting a new feature area, use this exact order.

## Phase A — Decomposition first

Before any Step prompt is written:

1. Chat reviews the feature at a high level
2. Chat identifies the real sections/layers/responsibility seams
3. Chat defines the full step list for that feature area

Important rule:

- Steps should represent **real code-level responsibility seams**
- not arbitrary widget buckets
- not generic cleanup categories

## Phase B — Step prompt set

Once decomposition is done, Chat writes the full prompt set:

- Step 1 prompt
- Step 2 prompt
- Step 3 prompt
- ...
- whole-feature closeout review prompt

## Phase C — Repo-first working docs

For each new step, still do:

1. live review
2. Review Record
3. Action Breakdown
4. Bootstrap
5. execution

This does **not** change.

---

# 7. Standard Step Structure

Each step still usually follows this pattern.

## Review Record

The review record should include:

- scope
- purpose of the step
- executive verdict (`PASS`, `RISK`, or `FAIL`)
- exact system map for that step
- what is coherent vs weak
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

Path:

- `return_packages/architect/ARCHITECT_<FEATURE>_STEPX_BOOTSTRAP_RETURN_PACKAGE.md`

---

# 8. Tracker vs Issue Log Rules

These must remain meaningfully different.

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

# 9. Prompt-Writing Rules in V3

## 9.1 Decompose first, then prompt

Do not skip decomposition.

Once the seam is known, V3 prefers **direct execution prompts** instead of extra planning prompts.

## 9.2 Prefer direct execution prompts when the seam is already known

Default:

- go straight to execution when the seam is already understood

Only use a planning prompt first if:

- the seam is genuinely ambiguous
- the task spans multiple unrelated systems
- product-direction or scope decisions are still unresolved

## 9.3 Batch by real seam

Default:

- batch `A + B` if they touch the same hook/component family/persistence seam
- batch `C + D` if they share the same reload/guardrail/durability seam

Do **not** split work just for symmetry.

## 9.4 Keep prompts shorter by default

Default execution prompt structure should usually be:

- Objective
- Live seam / scope
- Required implementation changes
- Files likely to change
- Validation
- Tracking/doc updates only if needed
- Return package requirements

Include longer rationale only when it materially changes implementation behavior.

---

# 10. Validation Rules in V3

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
- the seam changed materially
- the user explicitly asks for broader validation

## Reuse known validation surfaces

If prior related executions already identified the right test files for a seam, reuse them.

Do **not** rediscover the validation map in every new prompt unless the seam changed materially.

---

# 11. Documentation Cadence in V3

V3 keeps the same repo docs, but reduces unnecessary repetition.

## Still required at the start of each new step

For a **new step**, still do:

1. Review Record
2. Action Breakdown
3. Bootstrap

That does **not** change.

## For tiny related follow-up fixes inside the same active milestone

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

So V3 allows **less repeated ceremony**, but not loss of repo memory.

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
If not, Chat should write a follow-up execution prompt instead of pretending the step is done.

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

Whole-feature review remains a real verdict gate.

If it returns `RISK` or `FAIL`, Chat should:

- determine whether the blocker is a real feature bug or only a validation blocker
- write a narrow unblock prompt if needed
- then request a rereview

Only after the rereview comes back clean should the feature be considered closed.

---

# 14. Unblock Pattern

If whole-feature closeout is blocked by one narrow seam:

1. Chat writes a **closeout-unblock execution prompt**
2. Agent fixes only that seam
3. validation is rerun
4. Chat writes or requests a **whole-feature rereview**
5. if rereview returns `PASS`, the feature closes

Important rule:

- unblock prompts should stay **narrow**
- do not reopen broad cleanup unless the blocker truly requires it

---

# 15. Final Polish Pattern

If a feature is effectively clean but still has 1–2 non-blocking soft seams:

1. Chat may recommend a **small final-polish execution pass**
2. that pass should be narrow and durability-focused
3. then run the whole-feature agent review or rereview on the final state

Use this only when it improves efficiency.
Do not turn every feature into endless polish.

---

# 16. Canonical Naming Conventions

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

# 17. New Chat Kickoff Rule

When starting a new chat, say clearly:

1. this guide is the active workflow source of truth
2. the roadmap file is the active review roadmap
3. which feature is active
4. what step/stage is active
5. that V3 efficiency defaults are active

Recommended wording:

- We are continuing the Architect repo-first workflow.
- Follow `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE_V3.md` as the active process guide.
- Follow `docs/_working/architect/ARCHITECT_REMAINING_REVIEW_ROADMAP.md` as the active roadmap.
- Use the same review skeleton, but use lighter V3 execution inside already-established feature areas.
- Heavy setup at feature start, lighter execution inside the feature once seams are established.

---

# 18. Current Status Snapshot (at time this file was written)

At this point in the workflow:

- **Free Agency**: whole-feature closeout complete
- **Offseason**: whole-feature closeout complete
- **League / World Time / As-Of**: in progress
  - Step 1 complete
  - Step 2 review record complete
  - Step 2 action breakdown complete
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

## End of Workflow Guide V3
