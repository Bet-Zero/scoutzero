# ARCHITECT CHAT WORKFLOW CONTINUATION GUIDE

## Purpose

This file is the carry-forward workflow guide for continuing Architect review / execution work in a new chat without losing process consistency.

It captures:

- how Chat and the repo-access agent should divide responsibilities
- the order each feature review should follow
- how working docs should be created and updated
- how prompts should be written
- how return packages should be evaluated
- when to do unblock passes, rereviews, and whole-feature closeout

This is the workflow to continue using unless intentionally replaced.

---

# 1. Core Workflow Rule

Every major feature area should follow this order:

1. **Layer / section decomposition first**
2. **Step prompts second**
3. **Step review execution**
4. **Working-doc creation and tracking**
5. **Slice-by-slice fixes / hardening**
6. **Whole-feature closeout review**
7. **Unblock execution if needed**
8. **Whole-feature rereview**
9. **Mark feature closed and move on**

Do **not** jump straight to a Step 1 prompt without first decomposing the feature into the correct review layers.

---

# 2. Roles

## ChatGPT role

ChatGPT should:

- inspect the live code / repo-connected files directly when asked to review a step or decompose a feature
- decide the correct layer structure before prompts are written
- write:
  - step prompts
  - review records
  - action breakdowns
  - bootstrap prompts
  - unblock prompts
  - whole-feature review prompts
- evaluate return packages critically
- decide whether a step is really closed
- decide whether a whole-feature PASS is real or if a blocker still exists
- recommend the next best section after a feature closes

## Repo-access agent role

The repo-access agent should:

- execute the step prompt
- inspect live code directly
- make code/doc/test changes when requested
- update tracker + issue log
- run the required validation
- produce the return package in the requested repo path

---

# 3. Required Sequence for a New Feature Area

Whenever starting a brand-new feature area, use this exact sequence.

## Phase A — Decomposition first

Before any step prompt is written:

1. Chat reviews the feature at a high level
2. Chat identifies the real sections/layers/responsibility seams
3. Chat defines the full step list for that feature area

Important rule:

- Steps should represent **real responsibility seams**, not arbitrary UI widgets or generic buckets
- The decomposition should reflect how the code actually works

Only after that should the step prompts be written.

## Phase B — Step prompt set

Once decomposition is done, Chat writes the full prompt set for the feature:

- Step 1 prompt
n- Step 2 prompt
- Step 3 prompt
- ...
- whole-feature closeout review prompt

## Phase C — Live review + working docs

For each step, the process is:

1. User gives Chat the current Step prompt as a task
2. Chat reviews live code and returns the review result
3. Chat writes the **Review Record** into the repo
4. Chat writes the **Action Breakdown** into the repo
5. Chat writes the **Bootstrap prompt**
6. Agent executes bootstrap
7. User sends bootstrap return package
8. Chat writes the first execution prompt

---

# 4. Standard Step Structure

Each step should usually follow this internal pattern.

## Review Record

The review record should include:

- scope
- purpose of the step
- executive verdict (`PASS`, `RISK`, or `FAIL`)
- exact system map for that step
- analysis of what is coherent vs what is weak
- duplicate / fallback / legacy / alternate path analysis
- final conclusion
- reviewed files

Review records belong in:

- `docs/_working/architect/<feature-folder>/ARCHITECT_<FEATURE>_STEPX_REVIEW_RECORD.md`

## Action Breakdown

The action breakdown should:

- convert the review findings into execution substeps
- define each substep as a real structural problem to solve
- explain why each substep matters
- define success criteria
- optionally group substeps into efficient execution batches

Action breakdowns belong in:

- `docs/_working/architect/<feature-folder>/ARCHITECT_<FEATURE>_STEPX_ACTION_BREAKDOWN.md`

## Bootstrap

Bootstrap should:

- verify prior step status is correct
- create or update the Review Tracker
- create or update the Issue Log
- add the new step section
- create problem-level issues derived from the review record and action breakdown

Bootstrap return packages belong in:

- `return_packages/architect/ARCHITECT_<FEATURE>_STEPX_BOOTSTRAP_RETURN_PACKAGE.md`

---

# 5. Tracker vs Issue Log Rules

These two documents must stay meaningfully different.

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

- Do not force one issue per substep
- Use merged issues when multiple substeps share one root cause
- Issue descriptions should describe the underlying system problem, not just restate the substep title

---

# 6. Standard Execution Flow Inside a Step

Most steps should follow this pattern:

1. **Bootstrap**
2. **First execution batch**
3. **Second execution batch if needed**
4. **Step closeout**

Typical execution batching style:

- `A + B` together if they live in the same code seam
- `C + D` together if they live in the same protection / reload / guardrail seam

Chat should decide batching based on the real seam, not just evenly splitting work.

---

# 7. Prompt-Writing Rules

When Chat writes prompts, keep these rules.

## Always require

- live code review
- no reliance on prior docs as truth
- exact scope
- clear objective
- explicit constraints
- likely files to modify
- validation commands
- tracker/issue-log updates when relevant
- canonical return package path
- exact required final line

## Prompts should clearly distinguish

- review prompts
- bootstrap prompts
- execution prompts
- unblock prompts
- whole-feature closeout review prompts
- rereview prompts

## Execution prompts should usually include

- why substeps are batched
- phase-by-phase task instructions
- scope limits
- validation requirements
- return package schema

---

# 8. How Chat Should Judge Return Packages

Chat should not treat a return package as automatically correct.

For every return package, Chat should decide:

1. **Did the execution actually solve the intended seam?**
2. **Did the implementation stay within scope?**
3. **Did validation actually prove the intended claim?**
4. **Is the step really closed, or only partially improved?**
5. **What is the next correct prompt?**

If the package solved the seam, Chat should say the substep batch is closed and write the next prompt.
If it did not, Chat should write a follow-up execution prompt instead of pretending the step is done.

---

# 9. Whole-Feature Closeout Rules

A feature is not closed just because all slices were reviewed.

After slice-by-slice review is complete, Chat should write a:

- **whole-feature closeout review prompt**

That review must check:

- how all slices connect together
- whether the feature is clean as one system
- whether there are still cross-surface or cross-flow truth gaps
- whether the overall verdict should be `PASS`, `RISK`, or `FAIL`

## Important rule

Whole-feature review is a real verdict gate.

If it comes back `RISK` or `FAIL`, Chat should:

- identify whether the blocker is a real feature bug or just a validation blocker
- write an unblock execution prompt if needed
- then request a rereview

Only after the rereview comes back clean should the feature be considered closed.

---

# 10. Unblock Pattern

If whole-feature closeout is blocked by one narrow seam:

1. Chat writes a **closeout-unblock execution prompt**
2. Agent fixes only that seam
3. Validation is rerun
4. Chat writes or instructs a **whole-feature rereview**
5. If rereview returns `PASS`, the feature closes

Important rule:

- Unblock prompts should be **narrow**
- They should not reopen broad cleanup unless the blocker truly requires it

---

# 11. Final Polish Pattern

If a feature is effectively clean but still has 1–2 non-blocking soft seams:

1. Chat may recommend a **small final-polish execution pass**
2. That pass should be narrow and durability-focused
3. Then run the whole-feature agent review or rereview on the final state

Use this only when it improves efficiency.
Do not turn every feature into endless polish.

---

# 12. Recommended Naming Conventions

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

# 13. What to Put in a New Chat Kickoff

When starting a new chat, paste a short kickoff like this:

## New Chat Kickoff Template

- We are continuing the Architect repo-first workflow.
- Follow `docs/_working/architect/ARCHITECT_CHAT_WORKFLOW_CONTINUATION_GUIDE.md` as the process guide.
- We do feature decomposition first, then step prompts, then repo-first review records/action breakdowns/bootstrap/execution.
- Do not skip straight to Step 1 prompts without first decomposing the feature into real code-level sections/layers.
- Treat tracker and issue log as distinct documents.
- Treat whole-feature closeout as a real verdict gate.

Then specify the next feature or current step.

---

# 14. Current Status Snapshot (at time this file was written)

At this point in the project workflow:

- **Free Agency**: whole-feature closeout complete
- **Offseason**: whole-feature closeout complete
- **League / World Time / As-Of**: in progress
  - Step 1 complete
  - Step 2 review record and action breakdown completed
  - Step 2 bootstrap prompt written

If this file is reused later, the user/chat should update this section as needed.

---

# 15. Practical Rules to Preserve Across Chats

1. **Decompose first. Do not skip this.**
2. **Repo-first docs are part of the workflow, not optional extras.**
3. **Review Record comes before Action Breakdown.**
4. **Bootstrap comes before execution.**
5. **Tracker and Issue Log must stay meaningfully different.**
6. **Execution batches should match real seams, not arbitrary symmetry.**
7. **Whole-feature closeout is mandatory before calling a feature done.**
8. **If whole-feature closeout is blocked, do a narrow unblock + rereview.**
9. **Do not confuse validation blockers with real feature blockers.**
10. **Once a feature closes cleanly, move on. Do not linger.**

---

# 16. Short Version

If a new chat needs the fast version:

- review feature structure first
- define all step layers first
- write step prompts second
- for each step: review -> review record -> action breakdown -> bootstrap -> execution -> return package evaluation
- maintain tracker + issue log in repo
- after all steps: whole-feature closeout review
- if blocked: unblock execution -> rereview
- only mark the feature closed after whole-feature PASS

---

## End of Workflow Guide
