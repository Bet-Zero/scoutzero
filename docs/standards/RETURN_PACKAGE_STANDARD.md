# Return Package Standard

This standard defines the canonical location, naming, and minimum content requirements for ScoutZero return packages.

Use `WORKSPACE_GUARDRAILS.md` for the short checklist and validation commands that reinforce this standard in day-to-day work.

## Canonical Rule

Return packages live in `work/<initiative>/` alongside the plan and preflight docs for that initiative.

When an initiative is complete, the entire `work/<initiative>/` folder (including its return packages) moves to `archive/work/<initiative>/`.

## File Naming

- Use uppercase filenames with underscores.
- End all return-package filenames with `_RETURN_PACKAGE.md`.
- Use `_PREFLIGHT_RETURN_PACKAGE.md` for preflight evidence.
- Add a date suffix only when it improves disambiguation within the same initiative.

Examples:

- `work/trade-machine-fixes/TRADE_MACHINE_RETURN_PACKAGE.md`
- `work/scouting-profile/PREFLIGHT_RETURN_PACKAGE.md`
- `work/roster-builder/ROSTER_BUILDER_RETURN_PACKAGE_2026-05-08.md`

## Initiative Folder Structure

```text
work/<initiative>/
  plan.md                   # What we're doing and why
  preflight.md              # Pre-execution audit (optional)
  RETURN_PACKAGE.md         # Delivery record
  notes/                    # Scratch notes (optional)
```

Only create files that are needed — a small initiative may only need plan.md and a return package.

## Required Contents

Every return package must include, at minimum:

- clear title and scope
- files created and files updated
- commands run, with actual results
- commands skipped, with reasons
- validation performed and outcome
- acceptance criteria check when the phase/request defines one
- follow-up work or next recommended phase

When applicable, also include:

- canonical decisions recorded during the phase
- blockers or stop conditions encountered
- notes on any failures outside the touched files

## Return Packages Are Execution Evidence

Return packages are not permanent docs and not working docs. They are a record of what was done. Once an initiative closes and the folder moves to `archive/`, return packages go with it and are not expected to be consulted in normal development.

## Relationship To Other Standards

- Use `DOCUMENTATION_STRUCTURE_STANDARD.md` for the overall document-placement model.
- Use `AGENTS.md` for the repo-wide workflow rules governing `work/` and `archive/`.
