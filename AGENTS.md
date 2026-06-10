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

## Approved Commands

Use these project commands unless the user explicitly asks for something else.

| Command | Use |
| --- | --- |
| `npm run dev` | Start the dev server at `http://localhost:5173` for UI/manual checks |
| `npm run build` | Production build after meaningful UI, route, or component changes |
| `npm run typecheck` | TypeScript check after TS/TSX, hook, or utility changes |
| `npm run validate:project` | Project-structure validation after new folders/files/exports |
| `npm run lint` | ESLint only if asked; repo has many pre-existing errors |
| `npm run lint:md` | Markdown lint for heavy docs edits or docs-routing changes |
| `npm run docs:guardrails` | Workspace/docs routing guardrails after docs-routing or standards changes |
| `npm run schema:generate` | Regenerate schema docs only when schemas change |
| `npm run schema:check` | Verify generated schema docs only when schemas change |
| `npm run docs` | Generate component hierarchy docs only if asked/doc-sync requires it |

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

| Command | Use |
| --- | --- |
| `npm run test:diff` | Preferred default when unsure; selects scope from git diff |
| `npm run test:fast` | Tiny/local changes or quick smoke validation |
| `npm run test:cap-sheet-boundary` | Cap Sheet action-layer or mutation-boundary changes |
| `npm run test:trade` | Trade Machine changes |
| `npm run test:architect` | Architect feature changes |
| `npm run test:roster` | Roster Builder changes |
| `npm run test:scouting` | Scouting/Profile changes |
| `npm run test:node` | Logic-heavy or non-UI changes |
| `npm run test:ui` | UI-heavy changes needing broader UI coverage |
| `npm run test:profile` | Only when diagnosing test slowness |

Always append `-- --reporter=dot` to test commands:

```bash
npm run test:diff -- --reporter=dot
```

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

## Reference Docs

| Doc | Use |
| --- | --- |
| `docs/guides/DEVELOPER_GUIDE.md` | File structure, components, hooks, utilities |
| `docs/reference/PROJECT_SCHEMA.md` | Repo structure, naming, and data contracts |
| `docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md` | Firestore schema |
| `docs/standards/COMMUNICATION_RULES.md` | Ask-vs-decide examples |
| `docs/standards/DOCUMENTATION_STRUCTURE_STANDARD.md` | Permanent docs vs work/archive placement |
| `archive/docs/cursor-prompts/cursor-commands-overview.md` | Archived slash-command reference |
