# Post-TypeScript Doc Stabilization Plan

## Purpose

TypeScript migration, TypeScript hardening, and zero-exception hardening are complete in this repository. The remaining task is to stabilize the documentation surface so future agents treat TypeScript as a maintenance gate, not as an active repo-wide campaign.

This plan is intentionally bounded.

## Execution Status

- Status: COMPLETE - 2026-05-02
- Return package: `docs/return_packages/docs/POST_TYPESCRIPT_DOC_STABILIZATION_2026-05-02.md`
- Commit: recorded in git metadata after the documentation-only commit

- In scope: documentation wording, documentation routing, historical/completed labels, one docs return package, the requested validation commands, and one commit.
- Out of scope: runtime source edits, new TypeScript audits, architecture review, code cleanup, or deleting historical evidence.

## Ground Truth To Preserve

- `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md` already records `TYPESCRIPT HARDENING COMPLETE`.
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md` already records `DONE - ZERO-EXCEPTION HARDENING COMPLETE`.
- `docs/typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md` should remain available, but as a maintenance and regression gate, not as a signal that the repo is still in an open-ended hardening campaign.
- Historical TypeScript campaign docs must remain in the repo as evidence. They should be labeled and routed correctly, not deleted.

## Bounded Success Criteria

- Agent-facing entry docs stop implying that TypeScript migration is still in progress.
- The current developer docs explicitly state that TypeScript work is complete and guarded by maintenance gates.
- The docs tree has one clear TypeScript status/index page that distinguishes current references from historical campaign records.
- Historical campaign docs are marked `historical` or `completed` and point readers back to the current index.
- Future agents are told not to reopen TypeScript hardening unless a documented gate regresses.
- A docs return package exists under `docs/return_packages/docs/`.
- `npm run validate:project`, `npm run lint:md`, and `git diff --check` pass.
- The work lands in one documentation-only commit.

## Stale Or Misrouting Surfaces To Fix

| Surface                                                               | Current issue                                                                                            | Required correction                                                                                                                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                           | Says existing `.js` / `.jsx` files are legacy from an ongoing migration.                                 | Replace with language that TypeScript migration is complete, new files default to TypeScript, and remaining JS-like files are intentional or separately documented legacy surfaces. |
| `README.md`                                                           | Does not plainly state the TypeScript campaign is complete and now maintained by gates.                  | Add a short repo-status note that the TypeScript migration/hardening campaign is complete and link to the current TypeScript docs index.                                            |
| `docs/guides/DEVELOPER_GUIDE.md`                                      | Serves as a main developer entry point but does not give a current TypeScript status or routing rule.    | Add a concise maintenance-status note and link to the TypeScript docs index.                                                                                                        |
| `docs/INDEX.md`                                                       | Has no current-vs-historical TypeScript routing section.                                                 | Add a `TypeScript Status` section and link to a dedicated TypeScript index.                                                                                                         |
| `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`                             | Still presents itself as a living master plan with active execution language even though it is complete. | Mark as historical/completed and route agents to the current TypeScript index.                                                                                                      |
| `docs/typescript/TYPESCRIPT_CONTINUOUS_EXECUTION_PROTOCOL.md`         | Still reads like an active execution protocol.                                                           | Mark as historical campaign procedure and state that it should only matter if a future regression requires a new plan.                                                              |
| `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`              | Still has active control-panel language despite completed status.                                        | Add a completed/historical banner and regression-only reopen rule.                                                                                                                  |
| `docs/TS_CONVERSION_NEXT_STEPS.md` and `docs/TS_CONVERSION_PILE_*.md` | Older living-plan wording still tells agents to keep executing conversion work.                          | Mark as historical/completed campaign records and route readers to the current TypeScript index.                                                                                    |

## Current Versus Historical Doc Classification

### Current references after stabilization

- `AGENTS.md`
- `README.md`
- `docs/guides/DEVELOPER_GUIDE.md`
- `docs/INDEX.md`
- `docs/typescript/README.md` to be created as the authoritative TypeScript documentation router
- `docs/typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md` retained as the maintenance gate and regression checklist

### Historical or completed campaign records after stabilization

- `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`
- `docs/typescript/TYPESCRIPT_CONTINUOUS_EXECUTION_PROTOCOL.md`
- `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`
- `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md`
- `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md`
- `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md`
- `docs/typescript/TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md`
- `docs/TS_CONVERSION_NEXT_STEPS.md`
- `docs/TS_CONVERSION_PILE_A_AUDIT.md`
- `docs/TS_CONVERSION_PILE_B_AUDIT.md`
- `docs/TS_CONVERSION_PILE_C_PLAN.md`
- `docs/TS_CONVERSION_PILE_D_TESTS_PLAN.md`

Historical docs stay in place as evidence. They get a consistent top-of-file banner instead of being moved or deleted.

## Standard Historical Banner

Use one short, uniform banner near the top of each completed campaign document:

```md
> Historical status: completed TypeScript campaign record.
> Current status: TypeScript migration and hardening are complete in this repo.
> Reopen only if a TypeScript maintenance gate regresses.
> Current entry point: `docs/typescript/README.md`
```

For the completion contract, use a different opening note:

```md
> Current status: this document is the maintenance gate for future regressions.
> Do not reopen the TypeScript campaign unless one of these gates fails again.
> For routing and document status, start at `docs/typescript/README.md`.
```

## Execution Plan

### 1. Identify and freeze stale wording

Files:

- `AGENTS.md`
- `README.md`
- `docs/guides/DEVELOPER_GUIDE.md`
- `docs/INDEX.md`
- `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`
- `docs/typescript/TYPESCRIPT_CONTINUOUS_EXECUTION_PROTOCOL.md`
- `docs/TS_CONVERSION_NEXT_STEPS.md`
- `docs/TS_CONVERSION_PILE_A_AUDIT.md`
- `docs/TS_CONVERSION_PILE_B_AUDIT.md`
- `docs/TS_CONVERSION_PILE_C_PLAN.md`
- `docs/TS_CONVERSION_PILE_D_TESTS_PLAN.md`

Work:

- Replace any wording that implies TypeScript migration or hardening is still an open repo-wide mission.
- Preserve factual completion evidence and dates.
- Do not rewrite technical content that is still historically accurate.

Done when:

- No agent-facing entry doc says or implies that TypeScript migration is still ongoing.

### 2. Update the main developer entry docs

Files:

- `AGENTS.md`
- `README.md`
- `docs/guides/DEVELOPER_GUIDE.md`

Work:

- Add one concise TypeScript status note to each file.
- State that TypeScript migration and hardening are complete.
- State that TypeScript is now enforced as a maintenance gate.
- Direct agents and developers to `docs/typescript/README.md` for current status and historical routing.

Done when:

- The three main entry docs present the same current-state message and point to the same TypeScript index.

### 3. Create a TypeScript documentation status index

Files:

- Create `docs/typescript/README.md`
- Update `docs/INDEX.md`

Work:

- Create a dedicated TypeScript index with two sections: `Current references` and `Historical campaign records`.
- Make `docs/typescript/README.md` the only place that explains which TypeScript docs are current and which are evidence-only.
- Add a short `TypeScript Status` section in `docs/INDEX.md` that links to this index.

Done when:

- An agent can land on one page and immediately see where to start and which docs are only historical evidence.

### 4. Mark completed TypeScript campaign docs as historical without deleting evidence

Files:

- `docs/TYPESCRIPT_HARDENING_NEXT_STEPS.md`
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`
- `docs/typescript/TYPESCRIPT_CONTINUOUS_EXECUTION_PROTOCOL.md`
- `docs/typescript/TYPESCRIPT_HARDENING_BASELINE.md`
- `docs/typescript/TYPESCRIPT_HARDENING_EXECUTION_MAP.md`
- `docs/typescript/TYPESCRIPT_HARDENING_FINAL_REVIEW.md`
- `docs/typescript/TYPESCRIPT_GATE_003_BOUNDARY_SCHEMA_CLASSIFICATION.md`
- `docs/typescript/TYPESCRIPT_GATE_005_TEST_MOCK_CLASSIFICATION.md`
- `docs/TS_CONVERSION_NEXT_STEPS.md`
- `docs/TS_CONVERSION_PILE_A_AUDIT.md`
- `docs/TS_CONVERSION_PILE_B_AUDIT.md`
- `docs/TS_CONVERSION_PILE_C_PLAN.md`
- `docs/TS_CONVERSION_PILE_D_TESTS_PLAN.md`

Work:

- Add the standard historical banner near the top of each completed plan or audit doc.
- Keep existing completion logs, validation ledgers, and return-package references intact.
- Do not rename the documents in this stabilization pass.

Done when:

- Every completed TypeScript campaign file is clearly labeled as historical or completed before the reader reaches old execution instructions.

### 5. Encode the regression-only reopen rule

Files:

- `AGENTS.md`
- `docs/typescript/README.md`
- `docs/typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md`
- `docs/typescript/TYPESCRIPT_ZERO_EXCEPTION_HARDENING.md`

Work:

- Add explicit wording that future agents must not reopen TypeScript migration or hardening work unless a documented gate regresses.
- Point regression checks to `docs/typescript/TYPESCRIPT_HARDENING_COMPLETION_CONTRACT.md` and the completed zero-exception record.
- Keep the message short and operational, not essay-like.

Done when:

- Future agents have one unambiguous instruction: do not restart the campaign unless the maintenance gate fails.

### 6. Write the return package

Files:

- Create `docs/return_packages/docs/POST_TYPESCRIPT_DOC_STABILIZATION_2026-05-02.md`

Work:

- Summarize the stale wording removed.
- List all docs changed.
- Record which docs are current references versus historical campaign records.
- Record the validation commands actually run.
- Record any intentionally skipped commands and why they were out of scope.
- Record the final commit hash.

Done when:

- The return package fully explains the stabilization pass without requiring a reader to reconstruct the diff.

### 7. Run required validation

Commands:

- `npm run validate:project`
- `npm run lint:md`
- `git diff --check`

Rules:

- Run all three after the documentation edits and return package are complete.
- If one fails because of the current diff, fix it before committing.
- Do not expand into build, typecheck, or test suites unless the documentation edit unexpectedly changes project structure or the validation tools require it.

Done when:

- All three commands pass and their outcomes are recorded in the return package.

### 8. Commit the documentation-only stabilization work

Commit message:

- `docs: stabilize post-TypeScript documentation status`

Rules:

- Commit only the documentation stabilization files and the docs return package.
- Do not mix runtime source changes into this commit.
- Ensure the plan file itself is not left as an open-ended living plan after the work is complete.

Done when:

- The repo has one documentation-only commit containing the stabilized docs and return package.

## Explicit Non-Goals

- Do not reopen TypeScript migration.
- Do not reopen zero-exception hardening.
- Do not launch a new architecture audit.
- Do not clean up unrelated stale docs outside the TypeScript routing problem.
- Do not modify runtime source code.

## Final Definition Of Done

This stabilization pass is complete only when:

- The entry docs reflect that TypeScript work is complete.
- There is one clear TypeScript docs index.
- Historical campaign docs are visibly marked as completed or historical.
- Future agents are told not to reopen TypeScript work unless a gate regresses.
- The docs return package exists under `docs/return_packages/docs/`.
- `npm run validate:project`, `npm run lint:md`, and `git diff --check` pass.
- The changes are committed with the documentation-only commit message above.
