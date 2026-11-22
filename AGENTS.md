---
name: AGENTS.md
description: Rules for every AI agent working on ScoutZero (Codex, Claude Code, ChatGPT).
---

# AGENTS.md: rules for AI agents on ScoutZero

These rules apply to every AI tool on this project. They replaced a much longer
rule set on November 22, 2026. What changed, and where the old documents are,
is recorded in [docs/standards/WORKFLOW_CHANGES.md](docs/standards/WORKFLOW_CHANGES.md).

## The project and the owner

ScoutZero (public name HoopZero) is a personal NBA scouting and GM web app built
with React 18, Vite, TypeScript, Tailwind CSS 3, Zod and Firebase (Firestore,
Auth, Functions). Vercel hosts the website, so **merging to `main` updates the
live site**.

The owner does not write code and relies on AI for all technical work.

- Talk about what the owner will see and be able to do, in plain English. Keep
  git, CI and file details to one short line at the end, if at all.
- Make technical decisions yourself. Ask the owner about product direction,
  cost, anything public or irreversible, and the items in the next section.
- Before starting anything that adds more than about a day of unplanned work,
  tell the owner what it's for and roughly how many days it will take.
- The owner can't check your work or notice what's missing. Never remove
  something without recording where it went, and never say something works
  unless you checked it.

## Never do these without the owner's explicit OK

- Write to source data: `players_v2`, `architect_basePlayers`,
  `architect_baseTeams`, `architect_baseEntitlements`, `architect_basePickRules`,
  `architect_draftPickReleases`.
- Run production push, admin or Firestore pipeline scripts, deploy Firebase
  Functions or Rules, publish data to production, or migrate existing saved
  worlds.
- Turn on billing, buy anything, create credentials, change account
  permissions, or contact outside people or companies.
- Put private data (the starting-data packages, NBA source copies, credentials,
  emulator or browser state) anywhere public: this repository (it is public),
  pull request or issue text, or public storage.
- Merge or push to `main`. A standing "merge when it's ready" from the owner for
  a piece of work counts as OK for that work.
- Merge a visible design or layout change before the owner has approved it from
  a preview or screenshots. A standing "merge when it's ready" doesn't cover
  this; a small fix the owner described exactly does.
- Delete or overwrite saved data, docs, plans or history. Move old material to
  `archive/` and say so. Removing dead code as part of a normal code change is
  fine.
- Add scope: new audits, certifications, evidence systems, review machinery, or
  features the task didn't ask for.

## Where things live

| What | Where |
| --- | --- |
| What to build, in what order | Linear (team BZE). The issue or plan you were given is your assignment. |
| Architect V1 plan and status | [V1_FINISH_CHECKLIST.md](work/architect-completion/V1_FINISH_CHECKLIST.md). Take the next unchecked item; finishing one is permission to start the next. |
| Architect scope and design laws | [V1 completion contract](docs/agent-guides/architect-v1-completion-contract.md), [Architect boundary](docs/agent-guides/architect-boundary.md) |
| NBA cap and trade rules | `npm run architect:canon:lookup -- <LEAF>` reads one rule from the pinned rulebook. Look up only the rules you rely on. |
| What changed in a piece of work, and how it was checked | The pull request |
| Firestore schema | [CURRENT_FIRESTORE_SCHEMA.md](docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md) |
| Running the full app with real data in the cloud | [CLOUD_DEVELOPMENT.md](docs/operations/CLOUD_DEVELOPMENT.md) |
| NBA data refresh | [NBA_MAINTENANCE.md](docs/operations/NBA_MAINTENANCE.md) |
| Private 2026–27 starting-data packages | Attached to Linear BZE-243; recovery steps are in its November 16, 2026 comment. A permanent private home is still to be chosen. Never leave private data only on a session's disk. |

`docs/agent-guides/phase3a-execution.md` and
`docs/agent-guides/independent-review-boundary.md` are retired for ordinary
work. They stay in place only because older tools, a test and the NBA
data-publication review workflows still read them. Don't follow them for new
work, except where one of those workflows tells its reviewer to read them.

## How to do a task

1. **Understand the outcome.** Read the issue or checklist item. If it isn't
   clear what "done" looks like, ask the owner one plain question.
2. **Start from current `main` on a branch.** Linear links a branch or pull
   request to an issue when its name or title contains the issue number, and
   moves that issue to Done when it merges. So use the number of the step issue
   this work finishes (for example `bze-350-trade-machine-live`), and keep
   parent or goal issue numbers (such as BZE-243) out of branch names and
   titles. Don't reset, clean, stash or overwrite anyone else's work in
   progress, and don't amend or squash existing commits.
3. **Do only what was asked.** A defect in the thing you're building is part of
   the task. Anything else you notice gets one line in the issue (or a note to
   the owner); then carry on.
4. **Test it.** See [Testing](#testing).
5. **Get a second review** when the change needs one. See [Second review](#second-review).
6. **Open a pull request** using the template: what changed, how to see it,
   checks run and skipped, anything the owner must decide.
7. **Report in Linear** in three lines or fewer: what changed, the pull request
   link, where to see it, and anything the owner must decide. Detailed evidence
   (commits, checks run) stays in the pull request.
8. **Merge** only with the owner's OK, green CI, and a passed second review when
   one was required. Use a normal merge, not squash, so the test runner keeps
   any `Validation-*` commit trailers.

When the owner asks you to work through a plan ("keep going"), take the next
step, check it, commit, and continue until the plan is done or you hit a real
blocker.

## When a discovery changes the plan

Stop and give the owner two or three options in plain English, each with a rough
number of days. Default to the cheapest option that keeps the app honest,
usually one of these:

- use the best public data with a clearly labeled assumption the user can see;
- show a clear "not available yet" message for that one case and ship the rest.

Don't start an investigation, a certification effort or a new evidence system
unless the owner picks that option.

Architect worlds follow the owner's simulation standard (November 10, 2026):
NBA rules applied exactly, the best available public data, and named, visible
assumptions for missing facts. Known obligations and real rule violations are
never assumed away.

## Showing the owner visible changes

Before asking for approval, look at every changed screen yourself and fix the
obvious problems: clipping, misalignment, inconsistent spacing, leftover debug
or internal wording. Then give the owner one link (a preview, or one page of
screenshots at 1280×720 and phone width) with a short plain-English summary.
The owner replies approve, approve with notes, or not yet. "Approve with notes"
means fix the notes and merge without another review round. If a note changes
the layout or look noticeably, post refreshed screenshots to the issue after
merging.

## Testing

You choose the checks. The owner never picks tests.

- Before opening a pull request, run `npm run test:diff -- --reporter=dot`. It
  selects the tests affected by your change and is the same check CI runs.
  `npm run test:diff -- --dry-run --verbose` shows what it will run.
- Add or update tests for behavior you changed. For money, trade legality or
  saving, take the expected number from the NBA rule, not from what the code
  currently outputs.
- Focused suites while you work (append `-- --reporter=dot`): `test:trade`,
  `test:architect` (skips `.tsx`; use `test:ui` for components), `test:roster`,
  `test:scouting`, `test:node`, `test:ui`.
- Run `npm run build` when app output changes and `npm run typecheck` when types
  change. Changes in `functions/` use that package's own build and tests.
- If there's no automated test for something, say what you checked by hand and
  how. Never report a skipped check as passed.
- If a test fails, find out whether your change caused it. Fix it if so;
  otherwise report it plainly.
- Tests that protect a promise to users (a blocked trade never looks like
  success, required honesty notices) can have their wording updated along with a
  design change, but their purpose must stay.
- `npm run lint` has many old errors; run it only if asked. For changed docs,
  run `npm run lint:md` on those files.

The test runner also reads optional commit trailers:
`Validation-Tests: ["tests/path.test.ts"]` adds tests outside the import graph,
`Validation-Review: required` records that you decided a second review is
needed, and `Validation-Full: <reason>` asks for the full suite. Trailers can
only add checks, never remove them.

## Second review

Required when a change affects any of these:

- money calculations, or trade or signing legality;
- saved data, shared state, permissions or security;
- NBA source data being accepted as fact;
- the checks themselves: CI, the test runner, the review workflow, or these
  rules.

Also required whenever `npm run test:diff` prints `review: required`. Optional
otherwise.

- The reviewer must be a fresh session that didn't write the change. Claude is
  preferred because it's a different model; a fresh Codex session is fine.
- To get one, either comment on the pull request with a first line of exactly
  `/claude-independent-review <head-sha> <base-sha>` (full 40-character SHAs:
  the pull request's current head and its base) followed by a short summary of
  what changed and what to check, which runs Claude through GitHub; or open a
  fresh Claude Code or Codex session with the pull request link.
- If the change depends on an NBA rule, paste that rule's text from
  `npm run architect:canon:lookup -- <LEAF>` into the review request. The file
  `docs/reference/cba/ARCHITECT_CBA_CANON.md` on `main` is not the pinned
  version, so don't treat it as the rulebook.
- The reviewer checks the change; it doesn't rewrite it. Fix the real problems
  it finds. Suggestions outside the task don't expand the task.
- If the reviewed logic changes afterwards, get a quick review of the new part.
- If no reviewer is available, tell the owner instead of merging.

## Linear

Linear is the owner's progress board, written for a person.

- One issue is one thing the owner would notice in the app, in plain English,
  with a short "done when" list. A big goal is a project or parent issue, and
  its steps are issues in order. Don't create projects for small tasks.
- Search before creating an issue; add to an existing one instead of
  duplicating it.
- Done means merged to `main` and working. Use the priority field only for
  Urgent (the live site is broken).
- In a pull request, write `Fixes BZE-xx` only for the issue that pull request
  finishes. For a parent or goal issue, mention it in plain words without its
  number in the branch name or title. `Refs BZE-xx` also changes an issue's
  status, so don't use it for parent issues either. Commit messages alone don't
  link to Linear.
- Agents post through the owner's Linear account, so never write anything that
  reads as the owner's own decision. Record decisions as
  "Owner said in chat (date): …".
- Keep comments short: no hashes, evidence ledgers or file attachments, except
  private data the owner asked you to store.

## Code rules

- New files are `.ts` / `.tsx`. Use the `@/` import alias for `src/`. Use named
  exports; default exports only for top-level page views.
- Zod schemas in `src/schemas/` are the source of truth for data shapes. Don't
  declare duplicate `Player*` or `Contract*` interfaces elsewhere.
- Import Firestore collection names from `src/constants/collections.ts` and
  path helpers from `src/data/firestorePaths.ts`. Don't hardcode collection
  strings.
- Read `players_v2` hierarchically (contracts are a subcollection); don't
  flatten it. Check `src/shared/hooks/useSimplePlayerData.ts` before changing
  Firestore read logic.
- User data collections (read-write): `architect_worlds`, `lists`, `tierLists`,
  `rosterProjects`, `rankerSessions`, `freeAgents`, `playerProfileEvaluations`.
- When refactoring, keep existing behavior and layout. Don't leave scratch
  files in `src/`, `data/` or `tests/`.
- About 200 lines per component is a guideline, not a rule. Don't refactor
  unrelated code during a small change.

## Docs

- Permanent docs go in `docs/` under `reference/`, `guides/`, `operations/` or
  `standards/`. Plans in progress go in `work/<name>/`; finished ones move to
  `archive/work/<name>/`, unless tests or workflows still use their files.
- Update docs when behavior, data shape or workflow changes in a way the next
  agent needs to know. Don't write status reports or evidence logs into docs.
- `npm run docs` regenerates the component docs; run it only when asked.
- Graphify (`graphify-out/`) is an optional local code map. Use it if it's
  there and helps; don't rebuild it unless asked.
