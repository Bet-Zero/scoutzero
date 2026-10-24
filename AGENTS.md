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
- Keep validation proportionate to actual impact. The agent selects checks and
  reviewers; the owner does not choose tests or supply a full-suite password.
- Preserve existing behavior and visual layout when refactoring.
- Finish with this task committed and delivered; preserve unrelated active work.
- Ask the user about product direction and requirements; decide technical
  implementation details independently.

## Project Context

HoopZero is a public-facing NBA scouting platform built with React 18, Vite,
TypeScript, Tailwind CSS 3, Zod, Firebase, and Firestore.

Player data is loaded from Firestore. Source data is read-only; user-created
content is read-write.

Inspect changed behavior and affected consumers before selecting validation.
Use focused source/import inspection for small changes. Consult the existing
knowledge graph when it helps resolve cross-cutting dependencies; check freshness
before relying on it. Graph generation is not a prerequisite for cosmetic work.

## Approved Commands

Use these project commands unless the user explicitly asks for something else.

For isolated presentation proof, an existing component render or focused harness
is sufficient; do not start emulators or import data that it does not need.
When the assignment needs the full app and its data environment, use the reusable
[cloud development workflow](docs/operations/CLOUD_DEVELOPMENT.md):
`npm run cloud:setup`, `npm run cloud:data:import -- <private-source-directory>`,
`npm run cloud:dev`, and `npm run cloud:check -- --resume` for saved-session
recovery. Keep source copies and emulator/browser state private. Do not replace
this with a draft-pick publisher, a production writer or the tiny synthetic seed.
For NBA maintenance use `cloud:data:refresh`, `cloud:data:status`, `cloud:source`
and `cloud:pipeline`. A core capture is separate from full sync; database recovery
does not qualify source facts or authorize publication. Retain baseline versions
and their separate test sessions; follow the runbook's explicit scope/recovery path.

| Command                                    | Use                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `npm run dev`                              | Start the dev server at `http://localhost:5173` for UI/manual checks      |
| `npm run build`                            | Build when application output changes or delivery requires it         |
| `npm run typecheck`                        | Type-check when executable types/contracts change                   |
| `npm run validate:project`                 | Validate structure when repository layout/contracts change              |
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

The agent independently selects one of three execution levels from the complete
diff, actual behavior, dependencies and affected consumers. Labels, filenames,
line counts and calling work "cosmetic" do not establish isolation. Uncertainty
requires inspection and conservative protection until resolved. This section
controls proportional scope over older generic checklists; it does not waive
owner approvals or protected production/source boundaries.

1. **Isolated cosmetic/content:** establish that only local presentation or
   ordinary displayed copy changes. Inspect its consumers, responsive layout,
   accessibility and functional meaning; use only the necessary focused static,
   component or visual check. No routine independent Claude review, unrelated
   specialist suites, browser installation, emulator startup, full application
   suite, graph rebuild or elaborate evidence package. Shared tokens, contrast,
   accessible names, functional promises or uncertain isolation require broader
   relevant proof.
2. **Ordinary behavior:** test changed behavior and affected consumers, including
   failure cases where meaningful. Choose independent review when consequences,
   complexity or uncertainty justify it, and briefly record why. No automatic
   full-project or unrelated specialist review requirement.
3. **Consequential/cross-cutting:** financial calculations, trade legality,
   persistence, shared state, authorization, data integrity, source qualification
   and validation/review mechanisms require strong relevant checks and independent
   exact-candidate review. Retain applicable Canon, integration, emulator and
   source gates. Full suites are appropriate for genuinely broad or unresolved
   dependencies, not every consequential change.

Normal path: understand the authorized outcome, inspect the affected code and
consumers, implement, verify, deliver, and stop. No new issue, plan, README,
header, graph refresh, emulator or browser installation is implied by starting a
task. Use existing infrastructure and evidence where applicable.

`npm run test:diff -- --dry-run --verbose` shows the complete comparison and
selected commands. `npm run test:diff -- --reporter=dot` executes that same path
locally, in PR CI and after merge. The runner compares all commits and local
layers; CI requires explicit base/head and fails on incomplete history. It
recognizes presentation-only syntax across application areas, including Architect
and Ranker, while preserving imports, conditions, handlers, ARIA, visibility and
calculations. This is not proof that a color or phrase is semantically harmless:
the agent must inspect status/error meaning, accessibility, consumers and shared
styles and record the relevant visual/content proof in the PR. A small change
may still need a build to validate or deliver the result.

For executable changes, Vitest's existing import graph selects affected node,
UI, native and emulator test consumers. Adding regressions or related files does
not force full-project validation. Native/browser/emulator prerequisites run
only when the selected tests need them. No related test means missing automated
coverage, not a pass: choose meaningful manual/static/visual verification for the
actual risk and record it in the PR. Do not invent a ceremonial test to qualify
for a lighter route. Dynamic and file-read dependencies need agent inspection.

When inspection identifies checks outside that graph, record them in the normal
commit message using an additive `Validation-Tests: ["tests/path.test.ts"]`
trailer. `Validation-Review: required` records an elevated review decision;
`Validation-Full: <concrete broad-risk reason>` requests full application checks.
These are agent-owned execution notes, not an owner form or approval layer.
They can only add checks/review, never remove automatic safeguards, alter the
comparison or waive independent acceptance. Local selection reads committed
trailers; use the scoped npm command while iterating before commit. PR and push
selection read all commits in the complete range. Preserve these messages during
normal merge; do not squash away declared checks. The PR remains the detailed
record of inspection, proof, limitations and review decisions.

Full-project checks require broad build/test-environment impact or a recorded
broad-risk reason. Unknown impact calls for dependency inspection and relevant
subsystem proof, not every specialist by default. Independent review remains
required for consequential work, including changed validation/review mechanisms;
for ordinary work the agent judges consequences, complexity and uncertainty.
Optional reviewer suggestions are triaged: relevant defects get repaired;
unrelated improvements do not expand scope or create indefinite waits.

Nightly CI retains full integration health checks. PR and push use one execution
path without repeating the same applicable command. A successful build is not a
unit-test pass, and unselected or unavailable checks are never reported as
executed. Respect platform-enforced requirements and existing owner approvals.
After repairs, rerun affected proof; reuse unaffected evidence with its actual
scope, dependencies and date. Stop when the authorized outcome and applicable
checks are complete and no material concern remains.

When the worktree contains active work, preserve it. Use an isolated branch or
worktree when necessary; do not reset, clean, stash or repair unrelated changes.
Local scoped commands are iteration evidence, not permission to hide paths from
CI's complete comparison.

| Command                           | Use                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `npm run test:diff`               | Preferred default when unsure; selects scope from git diff |
| `npm run test:fast`               | Smoke behavior actually affected by the change            |
| `npm run test:cap-sheet-boundary` | Cap Sheet action-layer or mutation-boundary changes        |
| `npm run test:trade`              | Trade Machine changes                                      |
| `npm run test:architect`          | Changes affecting the broader Architect subsystem          |
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

Use existing npm scripts for iteration and the selected runner for delivery.
The runner may invoke configured native/emulator tools directly. The agent may select
`npm run test:full` when broad dependencies or nightly health justify it; no
owner test-selection decision is required. Prefer focused suites first. Treat
four minutes as an investigation checkpoint: stop an unproductive run, diagnose
and narrow when truthful; never silently drop a necessary gate to meet a budget.

Keep changed files, executed commands, results and justified skips in the PR.
The owner response is a concise outcome and limitation summary with one evidence
link; an existing issue needs only a status pointer, not a duplicate narrative.

## Code Rules

- Use `.ts` / `.tsx` for new files. Existing `.js` / `.jsx` files are legacy or
  tooling surfaces, not migration backlog.
- TypeScript migration, root strict mode, and zero-exception hardening are
  maintenance standards. Do not reopen hardening unless a documented gate
  regresses.
- Use the `@/` import alias for `src/`.
- Use named exports. Default exports are allowed only for top-level page views.
- Around 200 lines is component-design guidance, not a mandatory split. Do not
  refactor an unrelated component to satisfy size during a small change.
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
`rosterProjects`, `rankerSessions`, and `freeAgents`.

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
- For changed documentation, lint the changed files and run routing guardrails
  when routing or standards change; do not relint unrelated historical failures.
- Use `npm run validate:project` when repository layout/contracts change, not
  merely because an existing component or its regression test was edited.

Do not create return packages by default. Keep detailed evidence in the PR,
with a concise link in the final response and an existing issue when applicable. Create a return package only when the user
explicitly asks for one, an active long-running plan requires one, multiple
agents/sessions need durable coordination, or the work involves production data,
release operations, or audit/fix-plan evidence.

Full rules: `docs/standards/DOCUMENTATION_STRUCTURE_STANDARD.md`,
`docs/standards/DOCUMENTATION_UPDATE_RULES.md`,
`docs/standards/CREATING_PERMANENT_DOCS.md`, and
`docs/standards/WORKSPACE_GUARDRAILS.md`.

## Agent Workflow

- For consequential Phase 3A Canon-correctness and execution-tooling lanes, follow
  `docs/agent-guides/phase3a-execution.md` as the standing maker/checker
  execution profile.
- Do not create new git branches unless the user explicitly asks.
- Do not amend or squash existing commits.
- Do not create PRs or merge anything unless explicitly asked.
- For long-running plan execution requested by the user: follow the active plan,
  continue to the next executable step, validate after each source-change
  checkpoint, commit at safe checkpoints, and stop only for a real blocker.
- Batch authorized author work, scoped checks, and in-scope repairs into one
  coherent assignment. Keep required independent-review invocation, candidate
  freeze, owner-decision, permission, and merge stops explicit; routine work
  within that authorization needs no additional owner checkpoint.
- When required independent Claude review is available through
  `.github/workflows/claude-independent-review.yml`, the author invokes it
  directly from the exact frozen PR using
  `docs/agent-guides/independent-review-boundary.md`. Do not ask the owner to
  relay routine reviewer prompts or verdicts. Only a green exact-candidate
  `ACCEPT` satisfies that gate; `REVISE` or workflow failure returns to
  author-side repair unless a genuine owner-reserved decision remains.
- Keep one lead per shared change. Already-authorized independent work may
  proceed only after checking file/contract dependencies, with isolated working
  state and separate validation. Do not create another product assignment or
  change priorities merely to increase parallelism.
- If validation fails, first determine whether the current change caused it.
  Fix in-scope failures; document pre-existing or unrelated failures.

## Completion And Next Assignment

At a meaningful assignment boundary, state the agreed user outcome, what is
usable and accepted within its actual boundary, what required behavior remains
unavailable or unverified, and the concrete blocker or next authorized outcome.
Distinguish implementation, integration/verification, factual-evidence, and owner
acceptance requirements. An accepted intermediate milestone or evidence-accounting
total is not product completion or a completion percentage.

Classify newly discovered work before extending an assignment:

- required work to finish the agreed outcome;
- a confirmed defect or necessary dependency, with its affected outcome and proof;
- a useful additional capability that can wait, outside the current assignment.

Resolve required in-scope work; record a genuine blocker precisely. Do not
automatically turn optional refinements into follow-up issues or keep deepening
a completed task. "Continue" or "what's next?" selects the next authorized,
unfinished product outcome using current owner decisions, value, risk, and
dependencies. Preserve explicit owner priority changes. Do not invent a
whole-ScoutZero finish line or a priority order between independent objectives.

For a changed user workflow, plan the existing completion proof before
implementation: affected entry points, consumers, saved state/reload and
agreement between screens/teams where relevant, plus honest blocked/error states.
Expose integration gaps before declaring the outcome complete. Keep this scoped
to the affected journey; reuse valid evidence and do not audit the entire app for
a small change. Agents own technical decisions and proportionate verification;
this rule creates no additional owner approval step.

Keep one current status home per objective:

- Architect: [BZE-243](https://linear.app/bzero/issue/BZE-243) for accepted
  capability boundaries, remaining requirements and the next authorized outcome;
  the [V1 completion contract](docs/agent-guides/architect-v1-completion-contract.md)
  remains scope authority. Children retain their specific blockers.
- Non-Architect: the
  [existing project summary](https://linear.app/bzero/project/scoutzero-non-architect-stabilization-a97cde4908e0)
  routes current owner-authorized work to its existing issues/PRs.
- Repository docs retain durable contracts and operating knowledge; PRs retain
  detailed implementation/review evidence. Older plans keep historical evidence
  and link to the current status home rather than copying its changing summary.

Use existing records when they preserve intent, authorization, status and
continuity. A small owner-requested change with an adequate PR record does not
need a new Linear issue merely for bookkeeping. Existing issue-backed lanes,
applicable tracking requirements and issue closure gates still apply.

## Linear And Git Workflow

At entry, inspect the current worktree and the relevant live base. Preserve
active work and explain divergence that affects this task. Use an isolated
worktree when needed rather than demanding that unrelated work be cleaned up.
Reuse a relevant hosted green-main receipt; a local baseline run is justified
only by a concrete affected risk or missing evidence. An unrelated existing
failure must be reported honestly, but does not authorize repair or block an
isolated task unless it prevents trustworthy implementation, verification or
landing. Read history, issues and governing sources only as needed for the
current outcome and its protected boundaries; do not reconstruct the project.

Work awaiting owner review does not block separately authorized independent
work. Preserve the owner-review and production gates below.

## Owner Review Model (owner-set, 2026-07-08)

The wave/artifact requirements below apply to owner-directed subjective design
waves and existing approval-bound work. They do not impose an evidence package
on an isolated requested cosmetic correction. Existing owner approval boundaries
remain intact; this policy does not grant permission to land an unapproved wave.

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
- Priority: `Urgent` = an affected defect prevents trustworthy implementation or landing.
  Unrelated failures are reported, not automatically repaired by this assignment.
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

- For issue-backed work, BZE issue numbers appear in branch names
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
- For issue-backed direct-to-main work (no PR), comment on the existing issue
  with the commit hash, validation actually run, and merged-to-main status.

## Communication

The user does not have coding experience and should not be asked to make
technical implementation decisions.

Ask the user about product direction, requirements, what should be built, and
ambiguous product-facing behavior.

Decide technical implementation details independently: file structure, naming,
code patterns, architecture, library/API usage within the existing stack, and
validation scope.

Use a plan only when coordination or complexity needs one; a small task needs
no planning document. Resolve technical details independently. Ask only for a
material unresolved product decision or an owner-reserved approval.

Lead with what was built, researched, checked, or blocked, its practical effect,
and the recommended next move. Distinguish reusable tooling, established facts,
complete requirements, and remaining blockers; link technical records instead
of repeating them. Use plain language and explain tradeoffs that need a decision.

For ordinary explanations of already-verified facts in the same conversation,
reuse that evidence without claiming a new live check. Refresh live state at
fresh-session, changed-evidence, implementation, handoff, review/landing, and
authority-dependent decisions only for the identities and governing sources
material to the current task. Do not reconstruct unrelated history. Conversation
memory cannot replace a controlling source when its identity matters.

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

- Use graphify query/path/explain when dependency uncertainty warrants it and
  the tool is available. Verify freshness; focused source inspection is valid.
- Update the graph only when changed module topology makes a relevant retained
  dependency claim stale, not after every source/text/style edit.
