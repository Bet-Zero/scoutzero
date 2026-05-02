---
name: AGENTS.md
description: >
  Shared AI-agent instructions for HoopZero/ScoutZero.
  Read by Claude Code, Cursor, GitHub Copilot, and OpenAI Codex.
---

# AGENTS.md — HoopZero/ScoutZero

Shared, repo-wide rules for any AI agent operating in this codebase.  
**These instructions are binding.**

---

## Commands (Approved Menu)

Use only these commands unless the user explicitly requests something else.

| Command                    | What it does                                   | When to use                                              |
| -------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `npm run dev`              | Start dev server (`http://localhost:5173`)     | When doing UI work / manual verification                 |
| `npm run build`            | Production build                               | After meaningful UI/route/component changes              |
| `npm run typecheck`        | TypeScript typecheck (`tsc --noEmit`)          | After TS/TSX changes, hooks/util changes                 |
| `npm run validate:project` | Validate project structure against schema      | After **structural** changes (new folders/files/exports) |
| `npm run lint`             | ESLint                                         | Only if asked; repo has many pre-existing errors         |
| `npm run lint:md`          | Markdown lint                                  | Only if editing docs heavily                             |
| `npm run schema:generate`  | Regenerate Zod schema docs from `src/schemas/` | Only if schemas change                                   |
| `npm run schema:check`     | Ensure generated schema docs are up to date    | When schemas are modified                                |
| `npm run docs`             | Generate component hierarchy docs              | Only if asked / doc-sync workflows                       |

### Testing (Use the right scope)

**Default: targeted tests only.** Full suite is never the default.

| Command                           | What it does                                                        | When to use                                               |
| --------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| `npm run test:diff`               | Auto-select the narrowest safe test scope from the current git diff | **Preferred default** when unsure what to run             |
| `npm run test:fast`               | Fast smoke tests only (`tests/smoke`)                               | Very small changes / quick sanity                         |
| `npm run test:cap-sheet-boundary` | Focused Cap Sheet mutation-boundary guardrails                      | Narrow Cap Sheet action-layer / mutation-boundary changes |
| `npm run test:trade`              | Trade-only tests (`tests/trade`)                                    | Trade Machine changes                                     |
| `npm run test:architect`          | Architect + tradeMachine scoped tests                               | Architect feature changes                                 |
| `npm run test:roster`             | Roster tests (`src/tests/roster`)                                   | Roster Builder changes                                    |
| `npm run test:scouting`           | Scouting tests (`src/tests/scouting`)                               | Scouting/Profile changes                                  |
| `npm run test:node`               | Node-config test run                                                | Logic-heavy / non-UI changes                              |
| `npm run test:ui`                 | UI-config test run                                                  | UI-heavy changes that need broader UI coverage            |
| `npm run test:profile`            | Analyze slow tests                                                  | Only when diagnosing test slowness                        |

**Reporter flag:** Always append `--reporter=dot` to test commands. This reduces output to one character per test (faster runs, fewer tokens consumed). Failures still print in full.

```bash
# Example
npm run test:architect -- --reporter=dot
npm run test:diff -- --reporter=dot
```

**Full suite (guarded):**

| Command             | What it does           | When to use                                     |
| ------------------- | ---------------------- | ----------------------------------------------- |
| `npm run test:full` | FULL suite (node + ui) | **Only when prompt contains: `RUN FULL SUITE`** |

> **Do not treat any timing estimates as reliable.** Test runtime varies widely by machine and scope.

---

## Validation Policy (MANDATORY)

### Default behavior

**Default validation command:** `npm run test:diff`

`test:diff` now prefers this order:

- inferred targeted `test:node` / `test:ui` file runs for narrow, well-matched changes
- explicit scoped suites when a known slice is mapped
- broader feature suites when inference is weak
- full suite only for shared/config/script triggers

After changes, run **one** of the following by default:

- `npm run test:diff` (preferred if uncertain), OR
- the most relevant scoped suite (`npm run test:cap-sheet-boundary`, `npm run test:trade`, `npm run test:architect`, `npm run test:roster`, `npm run test:scouting`), OR
- `npm run test:fast` for tiny/local changes.

### Hard rule: Full suite requires explicit permission

Do **not** run any of the following unless the user prompt contains the exact phrase:

RUN FULL SUITE

Blocked unless explicitly allowed:

- `npm run test`
- `npm test`
- `vitest`
- `vitest run`
- `npm run test:full`

Agents must use only the `npm run test:*` scripts listed in AGENTS.md. Do not run raw `vitest` commands directly and do not invent new test commands.

If you believe full suite is necessary, **stop and ask first** with a 1–2 sentence justification.

### Time budget

If a test run exceeds **4 minutes**, stop it and switch to a cheaper option:

- `npm run test:diff` or a scoped suite.

### Return Package requirement

Every Return Package must include:

- Files changed
- Validation commands actually run
- Any commands intentionally skipped (and why)

---

## Continuous-Run Execution Mode (MANDATORY when the user wants a plan to keep running)

When the user explicitly wants a long-running plan to keep moving without waiting for new instructions, agents must treat the active plan doc as an execution loop rather than a one-step-only workflow.

### Continuous-run rules

1. **Keep going by default.** If the active plan doc says the next numbered step is executable, do it. Do not stop merely because one step finished.
2. **Commit at safe checkpoints.** After a completed source-change step (or a tightly-coupled same-session batch explicitly allowed by the plan), commit the work, update the plan status, and continue to the next executable step in the same session unless a blocking condition below applies.
3. **Doc-only steps do not force a stop.** If a doc-only checkpoint/review step is complete and the next numbered step is executable, continue immediately.
4. **Validation gates before continuing.** After each source-change checkpoint, run the plan-required validation. If validation fails, fix the failure or narrow the scope until the step is truthful before moving on.
5. **Stop only for real blockers.** Valid blockers are:
   - the plan says a user/product decision is required;
   - validation exposes a true ambiguous direction that the docs do not answer;
   - the next safe step would violate AGENTS.md or the active plan;
   - the environment/tooling prevents further safe execution.
6. **Do not treat phase completion as mission completion.** If the plan is a self-extending master plan, checkpoint findings must extend the plan rather than end the run.

### Commit cadence for long-running plan execution

- **Required:** commit after each completed source-change step unless the plan explicitly allows a same-session tightly-coupled batch.
- **Allowed:** multiple doc-only steps may be committed together if they are part of the same evidence/review checkpoint.
- **Never:** leave large unrelated piles of changes uncommitted while moving across multiple plan phases.

### PR / merge behavior

- Do **not** create branches unless the user explicitly asks. Repo rule remains: agents must not create new git branches.
- Do **not** create PRs by default. PR creation is optional workflow overhead, not a required checkpoint for continuous local execution.
- Do **not** merge anything automatically unless the user explicitly asked for an agent workflow that includes PR creation/merge.
- In the normal local/connected-repo workflow, commit to the active branch after each safe checkpoint and continue.

### If validation fails during a long run

Agents must handle failure in this order:

1. inspect whether the failure is directly caused by the current changes;
2. fix the failure if it is in-scope for the current plan step;
3. if the failure is pre-existing or belongs to a different mission area, document it and keep the step narrow;
4. only stop if the failure prevents truthful completion of the current step and the next move requires user direction.

### Concurrency rules

Concurrent agents are allowed only when their work is split by **non-overlapping surfaces**. Safe concurrency requires all of the following:

1. different files or clearly isolated file groups;
2. no shared contract-owner file being edited by more than one agent at a time;
3. no shared plan step being executed by multiple agents unless the step explicitly says so;
4. each agent has its own explicit validation scope.

Unsafe concurrency examples:

- two agents editing `mutationPipeline.ts` and its primary consumers at the same time;
- two agents both changing central Architect test harnesses that share fixtures;
- one agent changing a contract owner while another changes many consumers of that same contract blindly.

Safe concurrency examples:

- one agent on a runtime contract-owner cluster, another on a fully separate low-coupling test fixture cluster;
- one agent on docs/baseline review while another waits; or two agents on separate features that do not share central files.

When in doubt, prefer one continuous agent over risky concurrency.

---

## Project

HoopZero is a public-facing NBA scouting platform built with React + Vite + Firebase. Player data is loaded from Firestore.

**Data access model:**

- **Source data** (`players_v2`, architect base collections) is **read-only** — agents must never write to these.
- **User-created content** (`lists`, `tierLists`, `rosterProjects`, `architect_worlds`) is **read-write** — the app creates, updates, and deletes documents in these collections as part of normal operation.

---

## Boundaries

### ✅ Always

- Use `.ts` / `.tsx` for new files. Existing `.js` / `.jsx` files are retained legacy or tooling surfaces, not evidence of an active TypeScript migration backlog.
- TypeScript migration, root strict mode, and zero-exception hardening are complete maintenance standards. Use `docs/typescript/README.md` for current required docs, and do not reopen TypeScript hardening unless a documented gate regresses.
- Use the `@/` import alias (maps to `src/`).
- Use named exports. Default exports only for top-level page views.
- Preserve visual layout and logic when refactoring.
- Keep components under 200 lines; split into subcomponents when larger.
- Leave the git worktree clean after completing work.
- Update docs for significant changes — see `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md`.
- Run `npm run validate:project` after any structural changes.

### ⚠️ Ask first

- Where new files should live when unsure — do not invent new top-level folders.
- Anything ambiguous about what the user wants built.
- File purpose or ownership when creating a new feature.

### 🚫 Never

- Write to or modify Firestore **source data** (`players_v2`, `architect_base*` collections).
- Create new git branches.
- Amend or squash existing commits.
- Declare duplicate `Player*` or `Contract*` interfaces outside `src/schemas/`.
- Leave temporary or scratch files in `src/`, `data/`, or `tests/`.

---

## Communication

The user does not have coding experience. They cannot and should not make technical decisions.

- **Ask about**: project direction, requirements, what the user wants built, anything product-facing.
- **Decide independently**: code patterns, file structure, naming conventions, architecture, library choices.

Build plans with enough detail that execution matches expectations exactly. If a requirement is unclear, ask — do not guess.

---

## Conventions & Structure

- **Stack**: React 18 + Vite + TypeScript + Tailwind CSS 3 + Zod + Firebase / Firestore
- **Schemas**: Zod (code-first) in `src/schemas/`; generated docs in `docs/schema/`. No duplicate `Player*` or `Contract*` interfaces anywhere else.

```text
src/
├── components/     Diagnostic tools (legacy shared UI moved to shared/)
├── config/         Feature flags (validationFlags.js)
├── constants/      Enums, team/role lists, Firestore collection constants (collections.ts)
├── core/           Site-wide layout (SiteLayout.jsx)
├── data/           Centralized Firestore path helpers (firestorePaths.js)
├── features/       Domain modules (architect, filters, lists, profile, ranker, roster, table, tierMaker)
├── firebase/       Firestore read/write helpers
├── fonts/          Embedded font assets
├── hooks/          Legacy hooks (most moved to shared/hooks/)
├── pages/          Route-level views
├── schemas/        Canonical Zod schemas (players_v2, architect, common)
├── shared/         Shared hooks, utils, and UI components
│   ├── hooks/      useSimplePlayerData, usePlayerData, useFirebaseQuery, useAuth, etc.
│   ├── utils/      Filtering, roster, cap utilities grouped by domain
│   └── components/ Reusable UI widgets (TeamLogo, PlayerHeadshot, etc.)
├── styles/         Additional stylesheets
├── tests/          Co-located test files
└── types/          TypeScript type declarations (player.d.ts)
```

New features need folder-level READMEs and index-based exports — see `docs/workspace-rules/CREATING_PERMANENT_DOCS.md`.

---

## Firestore

Collection names are defined as constants in `src/constants/collections.ts`. Always import from there — never hardcode collection strings. Path helpers live in `src/data/firestorePaths.js`.

### Source Data (read-only — agents must not write)

| Collection                   | Purpose                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `players_v2`                 | Player bio, contracts, seasons, evaluations — hierarchical subcollections |
| `architect_basePlayers`      | Canonical player snapshots used as starting data for Architect worlds     |
| `architect_baseTeams`        | Canonical team snapshots (rosters, cap sheets) for Architect worlds       |
| `architect_baseEntitlements` | Cap entitlements (Bird rights, exceptions) per team — base layer          |
| `architect_basePickRules`    | Structured draft pick protection and condition rules                      |

### User / Architect Content (read-write)

| Collection         | Purpose                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `architect_worlds` | User-created worlds with subcollections: `teams/{teamCode}`, `entitlements/` |
| `lists`            | User-created ranked player lists                                             |
| `tierLists`        | User-created tier lists                                                      |
| `rosterProjects`   | User-created roster building projects                                        |
| `freeAgents`       | Free agent pool data used by Architect team plan helpers                     |

### Access Patterns

Access pattern for `players_v2` is hierarchical — do not flatten:

```javascript
import { PLAYERS_COLLECTION } from '@/constants/collections';

const player = await getDoc(doc(db, PLAYERS_COLLECTION, playerId));
const displayName = player.data().bio.displayName;

const contracts = await getDocs(
  collection(doc(db, PLAYERS_COLLECTION, playerId), 'contracts')
);
```

Do not modify Firestore read logic without validating against `src/shared/hooks/useSimplePlayerData.ts` (the primary list hook). `src/shared/hooks/usePlayerData.ts` is a diagnostics wrapper over it — prefer the base hook unless diagnostics are required.

Full schema: `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`

---

## Slash Commands

Agent-universal workflow commands. The prompt files in `docs/cursor-prompts/` contain the full instructions — any agent can follow them regardless of tool.

| Command           | What it does                                        | Prompt file                                  |
| ----------------- | --------------------------------------------------- | -------------------------------------------- |
| `/explain`        | Explain selected code without changing anything     | `docs/cursor-prompts/ExplainPrompt.md`       |
| `/audit`          | Deep technical audit → produces audit report        | `docs/cursor-prompts/ApexAuditPrompt.md`     |
| `/audit-review`   | Review an audit file → produces a Fix Plan          | `docs/cursor-prompts/AuditReviewPrompt.md`   |
| `/apply-critical` | Apply only Critical SAFE_AUTO fixes from a Fix Plan | `docs/cursor-prompts/ApplyCriticalPrompt.md` |
| `/fix-all`        | Apply all appropriate fixes from a Fix Plan         | `docs/cursor-prompts/FixAllPrompt.md`        |
| `/doc-sync`       | Update docs and comments to match current code      | `docs/cursor-prompts/DocSyncPrompt.md`       |
| `/cleanup`        | Safe, behavior-preserving code cleanup              | `docs/cursor-prompts/CleanupPrompt.md`       |
| `/review`         | Broad quality audit → produces preflight report     | `docs/cursor-prompts/ReviewPrompt.md`        |

**Typical workflow**: `/explain` → `/audit` → `/audit-review` → `/apply-critical` or `/fix-all` → `/doc-sync` → `/cleanup`

**Dependency chain**: `/audit` must run before `/audit-review`. `/audit-review` must produce a Fix Plan before `/apply-critical` or `/fix-all` can run.

---

## PR Guidelines

- Title: clear summary (e.g., `refactor: split PlayerProfileView`).
- Body: bullet summary of changes with file paths.
- Skip descriptions for UI that did not change.

---

## Reference Links

| Doc                                                  | What it covers                                             |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `docs/guides/DEVELOPER_GUIDE.md`                     | Detailed file structure, components, hooks, utilities      |
| `copilot-instructions.md`                            | Environment setup, testing workflows, validation scenarios |
| `docs/workspace-rules/COMMUNICATION_RULES.md`        | Ask-vs-decide examples                                     |
| `docs/workspace-rules/CREATING_PERMANENT_DOCS.md`    | Feature READMEs, index structure, file headers             |
| `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` | When and how to update docs                                |
| `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`            | Authoritative Firestore schema                             |
| `docs/cursor-prompts/cursor-commands-overview.md`    | Full slash command reference with workflows                |
