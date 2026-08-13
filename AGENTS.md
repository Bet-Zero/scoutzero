---
name: AGENTS.md
description: Shared AI-agent instructions for HoopZero/ScoutZero.
---

# AGENTS.md - HoopZero/ScoutZero

Repo-wide rules for AI agents working in this codebase. These instructions are
binding. This file is the quick operating contract; detailed standards live in
the linked docs.

## Core Priorities

- Protect source data. Never write to Firestore source collections.
- Do not run production push/admin/Firestore pipeline scripts unless the user
  explicitly requests that operation.
- Keep validation scoped. Prefer targeted tests and never run the full suite
  unless the prompt contains the exact phrase `RUN FULL SUITE`.
- Preserve existing behavior and visual layout when refactoring.
- Keep the worktree clean when finishing.
- Ask the user about product direction and requirements; decide technical
  implementation details independently.

## Project Context

HoopZero is a public-facing NBA scouting platform built with React 18, Vite,
TypeScript, Tailwind CSS 3, Zod, Firebase, and Firestore.

Player data is loaded from Firestore. Source data is read-only; user-created
content is read-write.

For code changes, audits, dependency-sensitive work, and architecture questions,
parse `graphify-out/graph.json` before editing so module dependencies are clear.
Check `built_at_commit` against `git rev-parse HEAD` when freshness matters, and
do not assume the graph includes uncommitted edits. Use
`graphify-out/GRAPH_REPORT.md` as the human-readable summary.

## Approved Commands

Use these project commands unless the user explicitly asks for something else.

| Command                                    | Use                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `npm run dev`                              | Start the dev server at `http://localhost:5173` for UI/manual checks      |
| `npm run build`                            | Production build after meaningful UI, route, or component changes         |
| `npm run typecheck`                        | TypeScript check after TS/TSX, hook, or utility changes                   |
| `npm run validate:project`                 | Project-structure validation after new folders/files/exports              |
| `npm run lint`                             | ESLint only if asked; repo has many pre-existing errors                   |
| `npm run lint:md`                          | Markdown lint for heavy docs edits or docs-routing changes                |
| `npm run docs:guardrails`                  | Workspace/docs routing guardrails after docs-routing or standards changes |
| `npm run schema:generate`                  | Regenerate schema docs only when schemas change                           |
| `npm run schema:check`                     | Verify generated schema docs only when schemas change                     |
| `npm run docs`                             | Generate component hierarchy docs only if asked/doc-sync requires it      |
| `npm run architect:canon:lookup -- <LEAF>` | Read one leaf from the pinned accepted Canon authority                    |
| `npm run review:probe -- ...`              | Run an independent temporary probe against an exact candidate             |
| `npm run architect:proof:trade-receipt`    | Retain the exact-head 1280×720 Trade Receipt proof                        |

## Testing And Validation

Default to the narrowest truthful validation.

For docs-only changes, run docs validation (`npm run lint:md` when applicable
and `npm run docs:guardrails` for docs-routing/standards changes). Do not run
app tests unless the docs change affects commands, schemas, generated outputs,
or code behavior.

When the branch has existing unrelated diffs, validate the current task scope
rather than the whole branch. Prefer the most specific suite, or pass explicit
files to the diff runner:

```bash
npm run test:diff -- --files AGENTS.md --reporter=dot
```

| Command                           | Use                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `npm run test:diff`               | Preferred default when unsure; selects scope from git diff |
| `npm run test:fast`               | Tiny/local changes or quick smoke validation               |
| `npm run test:cap-sheet-boundary` | Cap Sheet action-layer or mutation-boundary changes        |
| `npm run test:trade`              | Trade Machine changes                                      |
| `npm run test:architect`          | Architect feature changes                                  |
| `npm run test:roster`             | Roster Builder changes                                     |
| `npm run test:scouting`           | Scouting/Profile changes                                   |
| `npm run test:node`               | Logic-heavy or non-UI changes                              |
| `npm run test:ui`                 | UI-heavy changes needing broader UI coverage               |
| `npm run test:profile`            | Only when diagnosing test slowness                         |
| `npm run test:phase3a-workflow`   | Phase 3A authority/reviewer workflow tooling changes       |

Always append `-- --reporter=dot` to test commands:

```bash
npm run test:diff -- --reporter=dot
```

Exception: `npm run test:phase3a-workflow` uses Node's built-in test runner and
already selects its dot reporter; run it without an appended Vitest reporter.

Do not run these unless the user prompt contains `RUN FULL SUITE`:

- `npm run test`
- `npm test`
- `vitest`
- `vitest run`
- `npm run test:full`

Do not invent test commands or run raw `vitest` directly. If `npm run test:diff`
auto-selects a broad/full tier, that is still the approved diff runner; respect
the 4-minute budget and report what happened.

If any test run exceeds 4 minutes, stop it and switch to `npm run test:diff` or
the closest scoped suite.

Every final handoff must list files changed, validation commands actually run,
and commands intentionally skipped with the reason.

## Code Rules

- Use `.ts` / `.tsx` for new files. Existing `.js` / `.jsx` files are legacy or
  tooling surfaces, not migration backlog.
- TypeScript migration, root strict mode, and zero-exception hardening are
  maintenance standards. Do not reopen hardening unless a documented gate
  regresses.
- Use the `@/` import alias for `src/`.
- Use named exports. Default exports are allowed only for top-level page views.
- Keep components under 200 lines; split larger components.
- Use Zod schemas in `src/schemas/` as canonical contracts. Do not declare
  duplicate `Player*` or `Contract*` interfaces outside `src/schemas/`.
- Do not leave temporary or scratch files in `src/`, `data/`, or `tests/`.

## Firestore Rules

Collection names live in `src/constants/collections.ts`; import constants from
there instead of hardcoding collection strings. Path helpers live in
`src/data/firestorePaths.js`.

Read-only source collections: `players_v2`, `architect_basePlayers`,
`architect_baseTeams`, `architect_baseEntitlements`, and
`architect_basePickRules`.

Read-write user/app collections: `architect_worlds`, `lists`, `tierLists`,
`rosterProjects`, and `freeAgents`.

Access `players_v2` hierarchically; do not flatten it:

```ts
import { PLAYERS_COLLECTION } from '@/constants/collections';

const player = await getDoc(doc(db, PLAYERS_COLLECTION, playerId));
const contracts = await getDocs(
  collection(doc(db, PLAYERS_COLLECTION, playerId), 'contracts')
);
```

Do not modify Firestore read logic without checking
`src/shared/hooks/useSimplePlayerData.ts`. `src/shared/hooks/usePlayerData.ts`
is a diagnostics wrapper; prefer the base hook unless diagnostics are required.

Canonical schema reference:
`docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md`.

## Docs And Workspace

- Permanent docs belong in `docs/` under `reference/`, `guides/`,
  `operations/`, or `standards/`.
- Active plans, preflights, and notes belong in `work/<initiative>/`.
- Completed initiatives move as a whole to `archive/work/<initiative>/`.
- Update docs for significant behavior, structure, schema, or workflow changes.
- For docs-routing or standards changes, run `npm run lint:md` and
  `npm run docs:guardrails`.
- Run `npm run validate:project` after structural changes.

Do not create return packages by default. Use the final response plus the git
commit as the normal evidence trail. Create a return package only when the user
explicitly asks for one, an active long-running plan requires one, multiple
agents/sessions need durable coordination, or the work involves production data,
release operations, or audit/fix-plan evidence.

Full rules: `docs/standards/DOCUMENTATION_STRUCTURE_STANDARD.md`,
`docs/standards/DOCUMENTATION_UPDATE_RULES.md`,
`docs/standards/CREATING_PERMANENT_DOCS.md`, and
`docs/standards/WORKSPACE_GUARDRAILS.md`.

## Agent Workflow

- For Phase 3A Canon-correctness and execution-tooling lanes, follow
  `docs/agent-guides/phase3a-execution.md` as the standing maker/checker
  execution profile.
- Do not create new git branches unless the user explicitly asks.
- Do not amend or squash existing commits.
- Do not create PRs or merge anything unless explicitly asked.
- For long-running plan execution requested by the user: follow the active plan,
  continue to the next executable step, validate after each source-change
  checkpoint, commit at safe checkpoints, and stop only for a real blocker.
- Concurrent agents may work only on clearly non-overlapping files/contracts,
  with separate validation scopes.
- If validation fails, first determine whether the current change caused it.
  Fix in-scope failures; document pre-existing or unrelated failures.

## Linear And Git Workflow

Session-start checks, in order:

1. Is main green (`npm run test:diff -- --reporter=dot` on main scope)? If not,
   fixing main is the task. Start no new branch-mode UI work while main is red.
2. Work awaiting owner review does NOT block starting the next wave. Start it
   on its own branch and batch review requests so the owner can review several
   waves in one sitting.

## Owner Review Model (owner-set, 2026-07-08)

- Work in **waves as big as coherently reviewable** — a whole page/room per
  wave by default, larger when coherent. Do not slice subjective UI work into
  micro-tasks that each demand an owner touchpoint.
- **Finished waves queue for review without limit** and batch into one owner
  sitting. Build each wave from current main and independent of unreviewed
  waves where possible; when a wave visually depends on an unreviewed wave,
  say so in its review link in product terms.
- The review package is **one hosted artifact link**: screenshots of every
  changed state at 1280×720 plus a short plain-language summary. No export
  folders, no PDF/HTML bundles, no duplicated long-form status comments. The
  Linear comment is the link, the status, and a one-line validation note.
- **Quality bar is "finished," not "renders".** Before requesting review, do an
  adversarial design self-review: render every state, judge it as a design
  critic, and iterate until there is nothing an owner would obviously demand
  fixed (clipping, misalignment, inconsistent spacing, leftover debug/internal
  vocabulary, unpolished defaults). Defects like these reaching the owner mean
  the self-review failed.
- **Test-pinned copy or layout is not a design constraint, but guardrail
  intent survives.** If a better design changes a pinned string or structure,
  change the test with the work — never ship a worse design around a pin and
  list it as a "known weakness". Tests that pin product promises (a blocked
  state can never read as success, required honesty disclosures, no implied
  guarantees) get their wording updated, never their intent removed, unless
  the owner explicitly changes the promise.
- **Owner communication is product language only.** Git mechanics (branches,
  PRs, merges, commit hashes, CI) are agent-internal; at most one receipts line
  at the end of a report. Full evidence (PR link, validation run, merge,
  issue closure) still lands on Linear/GitHub — invisible to the owner, not
  absent. The owner's entire role: open the link, reply approve /
  approve-with-notes / reject. "Approve with notes" means land the work and
  fix the notes without another review round; if a note materially changes
  layout, visual direction, or status treatment, land it and post refreshed
  screenshots to the record — the owner may object but is not required to
  re-approve.

Issue rules:

- Before filing a bug, search Linear for the failing test name, file path, or
  error string. If a match exists, comment there instead of filing a new issue.
- Priority: `Urgent` = main broken / validation untrustworthy (stop the line).
  `High` = the one active lane. Everything else = no priority.
- New lanes are issues (or a parent issue with sub-issues), not new Linear
  projects. Projects are reserved for durable product areas or real
  multi-week phases.
- Durable Architect boundary rules live in
  `docs/agent-guides/architect-boundary.md`. Reference it plus one short local
  scope line per issue; do not re-paste boundary text into issues or projects.

Done rules:

- Code issues: `Done` only when the change is merged to main and the closing
  comment lists branch, commit hash or PR link, and validation actually run.
  Work on an unmerged branch caps out at `In Review`.
- No-code issues (planning, triage, capture, discovery): `Done` when the
  output/decision exists and downstream issues or closure notes are linked.
- Branch-mode UI work stays off main until explicit owner approval.

Git↔Linear linking (verified against the live integration on 2026-07-07):

- BZE issue numbers must appear in branch names for code work
  (e.g. `feature/bze-224-trade-machine-visual-pass`; a slug without the number
  does not link).
- PR descriptions are the source of truth for Linear automation.
- Use `Fixes BZE-XXX` in the PR description when the PR should close the
  issue on merge.
- Use `Refs BZE-XXX` only for a still-active issue whose status should
  participate in the PR lifecycle. Linear advances non-closing references when
  a PR opens, so link completed foundations descriptively without a magic word,
  issue ID in the branch/title, or a second PR attachment. Full convention:
  `docs/agent-guides/phase3a-execution.md`.
- Do not rely on commit messages alone for Linear linking/closing —
  commit-only linking did not fire in the integration test.
- For any direct-to-main work (no PR), manually comment on the Linear issue
  with the commit hash, validation actually run, and merged-to-main status.

## Communication

The user does not have coding experience and should not be asked to make
technical implementation decisions.

Ask the user about product direction, requirements, what should be built, and
ambiguous product-facing behavior.

Decide technical implementation details independently: file structure, naming,
code patterns, architecture, library/API usage within the existing stack, and
validation scope.

Build plans with enough detail that execution can match expectations exactly.
If a requirement is unclear, ask before guessing.

When you do need to explain or check something, use plain language — skip the jargon or define it in a word, and lead with the why and the tradeoff, not the code.

## Reference Docs

| Doc                                                       | Use                                          |
| --------------------------------------------------------- | -------------------------------------------- |
| `docs/guides/DEVELOPER_GUIDE.md`                          | File structure, components, hooks, utilities |
| `docs/reference/PROJECT_SCHEMA.md`                        | Repo structure, naming, and data contracts   |
| `docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md`       | Firestore schema                             |
| `docs/standards/COMMUNICATION_RULES.md`                   | Ask-vs-decide examples                       |
| `docs/standards/DOCUMENTATION_STRUCTURE_STANDARD.md`      | Permanent docs vs work/archive placement     |
| `archive/docs/cursor-prompts/cursor-commands-overview.md` | Archived slash-command reference             |

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
