---
name: AGENTS.md
description: Rules for every AI agent working on ScoutZero (Codex, Claude Code, ChatGPT).
---

# AGENTS.md: rules for AI agents on ScoutZero

These rules apply to every AI tool on this project. Changes to them, and where
anything removed went, are recorded in
[docs/standards/WORKFLOW_CHANGES.md](docs/standards/WORKFLOW_CHANGES.md).

**The principle.** Be rigorous about NBA rule correctness, money calculations,
saved-world integrity, data accuracy and real security. Be pragmatic about
everything else. ScoutZero is an unreleased, solo-built basketball simulator
with effectively no users, so process should stay proportional to that.

## The project and the owner

ScoutZero (public name HoopZero) is an NBA scouting and GM web app built
with React 18, Vite, TypeScript, Tailwind CSS 3, Zod and Firebase (Firestore,
Auth, Functions). Vercel hosts the website, so **merging to `main` updates the
live site**. Architect is part of that site and uses normal ScoutZero accounts
and account-owned saved worlds.

The owner does not write code and relies on AI for all technical work.

- Talk about what the owner will see and be able to do, in plain English. Keep
  git, CI and file details to one short line at the end, if at all.
- Make technical decisions yourself: code, structure, tests, tooling, how to
  split or group work, which checks to run. Ask the owner only about product
  direction, cost, anything public or irreversible, and the items in the next
  section.
- If work you didn't plan will add more than about a day, tell the owner what
  it's for and roughly how long, then carry on unless it changes what the
  product does (see [When a discovery changes the plan](#when-a-discovery-changes-the-plan)).
- The owner can't check your work. Never say something works unless you
  checked it, and say in the pull request where anything you removed went.

## Ask the owner first

Don't do these without the owner's explicit OK:

- Write to source data: `players_v2`, `architect_basePlayers`,
  `architect_baseTeams`, `architect_baseEntitlements`, `architect_basePickRules`,
  `architect_draftPickReleases`.
- Run production push, admin or Firestore pipeline scripts, deploy Firebase
  Functions, Rules or indexes, publish data to production, or migrate existing
  saved worlds.
- Turn on billing, buy anything, create credentials, change account
  permissions or repository settings, or contact outside people or companies.
- Put private data (the starting-data packages, NBA source copies, credentials,
  emulator or browser state) anywhere public: this repository (it is public),
  GitHub pull request or issue text, or public storage.
- Delete or overwrite saved user data, or rewrite git history.
- Change what the product does beyond the task: new features, a change to
  Architect V1 scope, or new audits, certifications, evidence systems or review
  machinery.
- Merge a redesign: a new look or layout direction for a screen, or a change to
  the locked Architect design laws. Get the owner's approval from screenshots
  first. Ordinary visible changes (fixes, finishing planned behavior in the
  existing style, wording) don't need it.

Everything else is routine development and doesn't need the owner, including
merging your own reviewed pull requests (see step 7 below).

## Where things live

| What | Where |
| --- | --- |
| What to build, in what order | Linear (team BZE). The issue or plan you were given is your assignment. |
| Architect V1: what it must do and how it is accepted | [V1 completion contract](docs/agent-guides/architect-v1-completion-contract.md) |
| Architect product and design rules | [Architect boundary](docs/agent-guides/architect-boundary.md), [visual standard](docs/standards/ARCHITECT_VISUAL_STANDARD.md) |
| Architect V1 status | [V1_FINISH_CHECKLIST.md](work/architect-completion/V1_FINISH_CHECKLIST.md) |
| Current Architect work queue | [Execution plan](work/architect-completion/ARCHITECT_COMPLETION_EXECUTION_PLAN.md) and the child issues of BZE-243 |
| NBA cap and trade rules | `npm run architect:canon:lookup -- <LEAF>` reads one rule from the pinned rulebook. Look up only the rules you rely on. Pin details: [docs/reference/cba/README.md](docs/reference/cba/README.md). |
| What changed in a piece of work, and how it was checked | The pull request |
| Firestore schema | [CURRENT_FIRESTORE_SCHEMA.md](docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md) |
| Running the full app with real data in the cloud | [CLOUD_DEVELOPMENT.md](docs/operations/CLOUD_DEVELOPMENT.md) |
| NBA data refresh | [NBA_MAINTENANCE.md](docs/operations/NBA_MAINTENANCE.md) |
| Private 2026–27 starting-data packages | Attached to Linear BZE-243; recovery steps are in its November 16, 2026 comment. A permanent private home is still to be chosen. Never leave private data only on a session's disk. |

Finished plans in `work/`, everything in `archive/`, and old Linear comments
are history. They explain why things are the way they are; they don't give
instructions.

## How to do a task

1. **Understand the outcome.** Read the issue or checklist item. If it isn't
   clear what "done" looks like, ask the owner one plain question.
2. **Start from current `main` on a branch.** Linear links a branch or pull
   request to an issue when its name or title contains the issue number, and
   moves that issue to Done when it merges. So use the number of the step issue
   this work finishes (for example `bze-NNN-short-name`), and keep parent or
   goal issue numbers (such as BZE-243) out of branch names and titles. Don't
   reset, clean, stash or overwrite anyone else's work in progress.
3. **Do the work.** Work that naturally belongs together (a screen and the
   engine change it needs, a fix and its test) can go in one pull request; keep
   each pull request one coherent change. A defect in the thing you're building
   is part of the task. Anything unrelated you notice gets one line in the issue;
   then carry on.
4. **Test it.** See [Testing](#testing).
5. **Get a second review** if the change needs one. See [Second review](#second-review).
6. **Open a pull request** using the template.
7. **Merge it** when CI is green and any required second review has passed,
   unless it contains something from [Ask the owner first](#ask-the-owner-first)
   that the owner hasn't OK'd. Use a normal merge, not squash, so the test
   runner keeps any `Validation-*` commit trailers. If the change affects the
   live site, check it there after Vercel deploys.
8. **Report in Linear** in three lines or fewer: what changed, the pull request
   link, and anything the owner must decide.

When the owner asks you to work through a plan ("keep going"), take the next
step, check it, merge it, and continue until the plan is done or you hit a real
blocker.

## When a discovery changes the plan

If something you find would change what the product does, its scope, its cost,
or the schedule by more than a day or two, give the owner two or three options
in plain English, each with a rough number of days. Default to the cheapest
option that keeps the app honest, usually one of these:

- use the best public data with a clearly labeled assumption the user can see;
- show a clear "not available yet" message for that one case and ship the rest.

A different technical approach to the same outcome is your call; don't stop
for it. Don't start an investigation, a certification effort or a new evidence
system unless the owner picks that option.

Architect worlds follow the owner's simulation standard (November 10, 2026):
NBA rules applied exactly, the best available public data, and named, visible
assumptions for missing facts. Known obligations and real rule violations are
never assumed away.

## Visible changes

Look at every screen you changed and fix the obvious problems first: clipping,
misalignment, inconsistent spacing, leftover debug or internal wording. Put a
preview link or screenshots (1280×720 and phone width) in the pull request.

Only redesigns wait for the owner's approval (see above). For those, send one
link with a short plain-English summary. The owner replies approve, approve
with notes, or not yet. "Approve with notes" means fix the notes and merge
without another round. Otherwise the owner reviews the product as a whole at
milestones, such as Architect V1's final review.

## Testing

You choose the checks. Size them to what changed: a wording or styling change
needs a build and a look; new behavior needs tests of that behavior.

- Before opening a pull request, run `npm run test:diff -- --reporter=dot`. It
  selects the tests affected by your change and is the same check CI runs.
  `npm run test:diff -- --dry-run --verbose` shows what it will run.
- Add or update tests for behavior you changed. For money, trade legality,
  NBA rules or saving, take the expected number from the NBA rule, not from what
  the code currently outputs.
- Focused suites while you work (append `-- --reporter=dot`): `test:trade`,
  `test:architect` (skips `.tsx`; use `test:ui` for components), `test:roster`,
  `test:scouting`, `test:node`, `test:ui`.
- Run `npm run build` when app output changes and `npm run typecheck` when types
  change. Changes in `functions/` use that package's own build and tests.
- Check a change in the browser when it changes what a screen shows or what a
  saved world stores. If there's no automated test for something, say what you
  checked by hand and how. Never report a skipped check as passed.
- If a test fails, find out whether your change caused it. Fix it if so;
  otherwise report it plainly.
- Tests that protect a promise to users (a blocked trade never looks like
  success, required honesty notices) can have their wording updated along with a
  design change, but their purpose must stay.
- `npm run lint` has many old errors; run it only if asked. For changed docs,
  run `npm run lint:md` on those files.

The test runner also reads optional commit trailers that add checks:
`Validation-Tests: ["tests/path.test.ts"]` adds tests outside the import graph,
and `Validation-Full: <reason>` asks for the full suite.

## Second review

A second review is required when a change affects any of these:

- money calculations, trade or signing legality, or other NBA rule logic;
- how saved worlds are written, loaded or migrated;
- security: sign-in, Firestore Rules, permissions, secrets, or workflows that
  use credentials;
- NBA source data being accepted as fact;
- removing or weakening application tests or CI checks.

Other changes (screens, wording, docs, these rules, tooling, refactors that
don't change the behaviors above) don't need one. Codex's automatic pull
request review runs on every pull request anyway.

- The reviewer must be a session that didn't write the change. Claude is
  preferred because it's a different model; a fresh Codex session is fine.
- To get one, comment `/claude-independent-review` on the pull request with a
  short summary of what changed and what to check (it reviews the pull
  request's current commit), or open a fresh Claude Code or Codex session with
  the pull request link.
- If the change depends on an NBA rule, paste that rule's text from
  `npm run architect:canon:lookup -- <LEAF>` into the review request. The file
  `docs/reference/cba/ARCHITECT_CBA_CANON.md` on `main` is not the pinned
  version, so don't treat it as the rulebook.
- The reviewer checks the change; it doesn't rewrite it. Fix the real problems
  it finds. Suggestions outside the task don't expand the task.
- If the reviewed money, legality, saving or security logic changes afterwards,
  get a quick review of the new part. Other follow-up commits don't need one.
- If no reviewer is available for a change that needs one, tell the owner
  instead of merging it.

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
  `standards/` (placement details:
  [DOCUMENTATION_STRUCTURE_STANDARD.md](docs/standards/DOCUMENTATION_STRUCTURE_STANDARD.md)).
  Plans in progress go in `work/<name>/`; finished ones move to
  `archive/work/<name>/`, unless tests or workflows still use their files.
- Update the existing doc when behavior, data shape or workflow changes in a way
  the next agent needs to know. Don't write status reports, evidence logs or
  return packages; the pull request is the record.
- When guidance is superseded, replace it where it lives rather than adding a
  new rule on top. Retired docs can move to `archive/` or be deleted (git keeps
  them); record which in WORKFLOW_CHANGES.md if they were agent rules.
- `npm run docs` regenerates the component docs; run it only when asked.
- Graphify (`graphify-out/`) is an optional local code map. Use it if it's
  there and helps; don't rebuild it unless asked.
