# TypeScript Continuous Execution Protocol

> Historical status: completed TypeScript campaign record.
> Current status: TypeScript migration and hardening are complete in this repo.
> Reopen only if a TypeScript maintenance gate regresses.
> Current entry point: [docs/typescript/README.md](README.md)

This document governs continuous agent execution for TypeScript hardening work.

Use this when the user says:

```text
keep working in [doc path].md
```

The purpose is to make the living plan document self-resuming. An agent must be able to open the plan, know exactly where the previous agent stopped, know what to do next, update its own progress, and avoid falsely declaring the full mission complete.

This protocol works together with:

```text
docs/typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md
```

The completion contract controls what counts as TypeScript hardening complete. This protocol controls how agents continue work across repeated execution sessions.

## Non-Negotiable Rule

The living plan document is the source of truth for progress.

Agents must update the living plan document during every execution session unless the task is discovery-only and the prompt explicitly forbids edits.

If the living plan does not contain the required sections below, the agent's first task is to add them before continuing implementation.

## Required Living Plan Sections

Every continuous TypeScript hardening plan must contain these sections, in this order near the top of the file:

```md
# [Plan Title]

## Control Panel

## Current Cursor

## Mission Completion Status

## Active Work Queue

## Completed Work Log

## Validation Ledger

## Known Blockers / Deferred Debt

## Return Package Index
```

Additional planning, findings, implementation notes, and historical sections may appear below these required sections.

## Section Contract

### Control Panel

The Control Panel gives the agent the rules before it starts work.

Required format:

```md
## Control Panel

- Mode: CONTINUOUS EXECUTION
- Governing completion contract: `docs/typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md`
- Execution rule: Start at `Current Cursor`, complete the next unchecked item in `Active Work Queue`, update this document, write a return package, then stop.
- Completion rule: Do not declare `TYPESCRIPT HARDENING COMPLETE` unless every gate in the governing completion contract passes.
- If any hard-stop gate fails, final verdict must be `PHASE COMPLETE — HARDENING STILL INCOMPLETE` or `TASK INCOMPLETE — HARDENING NOT FINISHED`.
- Do not skip ahead unless the cursor item is blocked and the blocker is recorded in `Known Blockers / Deferred Debt`.
```

### Current Cursor

The Current Cursor tells the next agent exactly where to resume.

Required format:

```md
## Current Cursor

- Cursor ID: TS-HARDENING-[number-or-slug]
- Status: NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE
- Current objective: [one precise objective]
- Current files / areas: [paths or glob families]
- Next action: [first concrete action the next agent must take]
- Stop condition: [what evidence allows this cursor item to be marked complete]
- Last updated: YYYY-MM-DD by [agent label]
```

Rules:

- There must be exactly one active cursor.
- The cursor must point to one item in `Active Work Queue`.
- If the active item is completed, the agent must advance the cursor to the next unchecked work-queue item before ending.
- If no next item exists, the cursor must say `NO ACTIVE CURSOR — RUN COMPLETION GATES`.

### Mission Completion Status

This section prevents phase completion from being mistaken for mission completion.

Required format:

```md
## Mission Completion Status

| Gate                               | Status            | Last Evidence  | Notes   |
| ---------------------------------- | ----------------- | -------------- | ------- |
| Gate 1 — Root strict mode          | PASS/FAIL/UNKNOWN | [command/path] | [notes] |
| Gate 2 — Runtime type escape audit | PASS/FAIL/UNKNOWN | [command/path] | [notes] |
| Gate 3 — Declaration/shim honesty  | PASS/FAIL/UNKNOWN | [command/path] | [notes] |
| Gate 4 — Runtime boundary honesty  | PASS/FAIL/UNKNOWN | [command/path] | [notes] |
| Gate 5 — Test/mock type integrity  | PASS/FAIL/UNKNOWN | [command/path] | [notes] |
| Gate 6 — JS/CJS/MJS classification | PASS/FAIL/UNKNOWN | [command/path] | [notes] |
| Gate 7 — Schema escape audit       | PASS/FAIL/UNKNOWN | [command/path] | [notes] |
| Gate 8 — Evidence package          | PASS/FAIL/UNKNOWN | [command/path] | [notes] |

Current mission verdict: PHASE COMPLETE — HARDENING STILL INCOMPLETE | TASK INCOMPLETE — HARDENING NOT FINISHED | TYPESCRIPT HARDENING COMPLETE
```

Rules:

- Any FAIL or UNKNOWN gate prevents `TYPESCRIPT HARDENING COMPLETE`.
- The table must be updated when validation evidence changes.
- The current mission verdict must match the gate table.

### Active Work Queue

The work queue is the ordered backlog.

Required format:

```md
## Active Work Queue

| ID               | Status                                   | Scope   | Objective   | Required validation | Return package       |
| ---------------- | ---------------------------------------- | ------- | ----------- | ------------------- | -------------------- |
| TS-HARDENING-001 | NOT_STARTED/IN_PROGRESS/BLOCKED/COMPLETE | [paths] | [objective] | [commands]          | [path when complete] |
```

Rules:

- Agents work on the first item with status `NOT_STARTED` or the item identified by `Current Cursor`.
- Agents may mark an item `COMPLETE` only when its required validation is run or a skipped validation is explicitly justified.
- If an item is blocked, it must be marked `BLOCKED` and explained in `Known Blockers / Deferred Debt`.
- Every completed item must link to a return package.

### Completed Work Log

This records durable history.

Required format:

```md
## Completed Work Log

| Date       | ID               | Summary   | Files changed | Validation         | Return package                          |
| ---------- | ---------------- | --------- | ------------- | ------------------ | --------------------------------------- |
| YYYY-MM-DD | TS-HARDENING-001 | [summary] | [paths]       | [commands/results] | `docs/return_packages/typescript/...md` |
```

Rules:

- Add one row at the end of every execution session that changes code or docs.
- If no files changed, add a status-audit row only if the prompt asked for a status audit.

### Validation Ledger

This prevents agents from claiming validation without evidence.

Required format:

```md
## Validation Ledger

| Date       | Command             | Result            | Evidence / notes                         |
| ---------- | ------------------- | ----------------- | ---------------------------------------- |
| YYYY-MM-DD | `npm run typecheck` | PASS/FAIL/SKIPPED | [short output summary or reason skipped] |
```

Rules:

- Every command listed in a return package must also appear here.
- If tests/build are skipped, the reason must be recorded.
- Validation should be scoped to the current item unless the item requires full gates.

### Known Blockers / Deferred Debt

This prevents hidden debt from disappearing.

Required format:

```md
## Known Blockers / Deferred Debt

| ID          | Severity                | Area   | Description   | Why deferred/blocking | Resume trigger    |
| ----------- | ----------------------- | ------ | ------------- | --------------------- | ----------------- |
| TS-DEBT-001 | LOW/MEDIUM/HIGH/BLOCKER | [area] | [description] | [reason]              | [when to revisit] |
```

Rules:

- Any skipped hardening concern must be recorded here.
- Any failed completion gate must have at least one matching blocker/debt row unless the failure is fully resolved in the current session.

### Return Package Index

This lets the next agent find prior evidence without scanning the whole repo.

Required format:

```md
## Return Package Index

| Date       | Work ID          | Return package                          | Purpose   |
| ---------- | ---------------- | --------------------------------------- | --------- |
| YYYY-MM-DD | TS-HARDENING-001 | `docs/return_packages/typescript/...md` | [purpose] |
```

Rules:

- Every completed work queue item must have a return package.
- The return package path must also be present in `Completed Work Log`.

## Execution Algorithm

When an agent receives `keep working in [doc path].md`, it must follow this algorithm:

1. Open the specified living plan document.
2. Open `docs/typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md`.
3. Open this protocol document.
4. Confirm the living plan has all required sections.
5. If required sections are missing, add them first and create/update the cursor.
6. Read `Current Cursor`.
7. Find the matching item in `Active Work Queue`.
8. If the cursor item is `COMPLETE`, advance to the next `NOT_STARTED` queue item.
9. If the cursor item is `BLOCKED`, either unblock it or move to the next queue item and record why.
10. Execute exactly one coherent work item unless the prompt explicitly authorizes multiple queue items.
11. Run the required validation for that item.
12. Update all relevant sections of the living plan:
    - `Current Cursor`
    - `Mission Completion Status` if evidence changed
    - `Active Work Queue`
    - `Completed Work Log`
    - `Validation Ledger`
    - `Known Blockers / Deferred Debt` if needed
    - `Return Package Index`
13. Write a return package under `docs/return_packages/typescript/`.
14. End with one of the allowed verdicts from the completion contract.

## Return Package Requirements for Continuous Execution

Every continuous execution return package must include:

```md
# [Work ID] — [Short Title]

## Summary

## Files Changed

## Current Cursor Before

## Work Completed

## Validation

## Living Plan Updates

## Current Cursor After

## Remaining Gates / Debt

## Final Verdict
```

The `Current Cursor After` section must tell the next agent exactly where to resume.

Required final verdict values:

- `PHASE COMPLETE — HARDENING STILL INCOMPLETE`
- `TASK INCOMPLETE — HARDENING NOT FINISHED`
- `TYPESCRIPT HARDENING COMPLETE`

## Anti-Drift Rules

Agents must not:

- declare mission completion from a scoped strict probe
- declare mission completion from `npm run typecheck` while root `strict` is false
- skip updating the living plan
- leave the cursor pointing at completed work
- create return packages only in chat without writing them to the repo
- bury blockers in prose without adding them to `Known Blockers / Deferred Debt`
- start a new unrelated area while the cursor has an unblocked incomplete item
- use `PASS WITH DEBT` as a final verdict unless the exact scope is named and the mission status still says hardening incomplete

## Recommended Prompt Text

Use this prompt shape for continuous execution:

```md
Keep working in `[PATH_TO_LIVING_PLAN].md`.

Follow:

- `docs/typescript/TYPESCRIPT_CONTINUOUS_EXECUTION_PROTOCOL.md`
- `docs/typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md`

Start from `Current Cursor` in the living plan. Execute the next unblocked work-queue item only. Update the living plan sections required by the protocol. Write a return package under `docs/return_packages/typescript/`. Do not declare TypeScript hardening complete unless every hard-stop gate in the completion contract passes.
```

## If the Living Plan Is Missing Required Sections

The first execution session must add the required control sections, then stop or continue only if the prompt explicitly asks the agent to continue after restructuring.

The restructuring return package must use this verdict:

```md
PHASE COMPLETE — HARDENING STILL INCOMPLETE
```

## If the Queue Is Empty

If `Active Work Queue` has no remaining incomplete items, the agent must not declare completion automatically.

It must set:

```md
Current Cursor: NO ACTIVE CURSOR — RUN COMPLETION GATES
```

Then it must run or schedule the completion gates from the completion contract.

If any gate fails, the verdict remains:

```md
PHASE COMPLETE — HARDENING STILL INCOMPLETE
```
