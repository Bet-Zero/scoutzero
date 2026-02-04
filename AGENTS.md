---
name: AGENTS.md
description: >
  Shared AI-agent instructions for HoopZero/ScoutZero.
  Read by Claude Code, Cursor, GitHub Copilot, and OpenAI Codex.
---

# AGENTS.md — HoopZero/ScoutZero

## Commands

Put these in early — they are the first thing any agent needs.

| Command | What it does | Timing |
| --- | --- | --- |
| `npm run dev` | Start dev server (`http://localhost:5173`) | instant |
| `npm run build` | Production build | ~7s — do not cancel |
| `npm run test -- --run` | Run all tests (Vitest) | ~14s — do not cancel |
| `npm run lint` | ESLint | ~8s — ~1888 pre-existing errors, do **not** fix all |
| `npm run validate:project` | Validate project structure against schema | — |
| `npm run schema:generate` | Regenerate Zod schema docs from `src/schemas/` | — |
| `npm run docs` | Generate component hierarchy docs | — |

---

## Project

HoopZero is a public-facing NBA scouting platform built with React + Vite + Firebase. Player data is loaded from Firestore. This is a **read-only** application — agents must never write to Firestore or attempt to save data.

---

## Boundaries

### ✅ Always

- Use `.ts` / `.tsx` for new files. Existing `.js` / `.jsx` is legacy from an ongoing migration.
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

- Write to or modify Firestore data.
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

- **Stack**: React 18 + Vite + Tailwind CSS + Firebase / Firestore
- **Schemas**: Zod (code-first) in `src/schemas/`; generated docs in `docs/schema/`. No duplicate `Player*` or `Contract*` interfaces anywhere else.

```text
src/
├── components/     Shared UI + layout wrappers
├── features/       Domain modules (architect, filters, lists, profile, roster, table, tierMaker)
├── pages/          Route-level views
├── hooks/          Custom React hooks
├── utils/          Helpers grouped by domain
├── constants/      Role lists, badge sets
├── firebase/       Firestore helpers
├── schemas/        Canonical Zod schemas
└── styles/         Additional stylesheets
```

New features need folder-level READMEs and index-based exports — see `docs/workspace-rules/CREATING_PERMANENT_DOCS.md`.

---

## Firestore

| Collection | Purpose |
| --- | --- |
| `/players_v2` | Player bio, contracts, seasons, evaluations — hierarchical subcollections |
| `/teams` | Team rosters and cap sheets (migrating to `/architect/`) |

Access pattern for `/players_v2` is hierarchical — do not flatten:

```javascript
const player = await getDoc(doc(db, 'players_v2', playerId));
const displayName = player.data().bio.displayName;

const contracts = await getDocs(
  collection(doc(db, 'players_v2', playerId), 'contracts')
);
```

Do not modify Firestore read logic without validating against `useSimplePlayerData.ts` (the primary list hook). `usePlayerData.ts` is a diagnostics wrapper over it — prefer the base hook unless diagnostics are required.

Full schema: `docs/schema/CURRENT_FIRESTORE_SCHEMA.md`

---

## Slash Commands

Agent-universal workflow commands. The prompt files in `docs/cursor-prompts/` contain the full instructions — any agent can follow them regardless of tool.

| Command | What it does | Prompt file |
| --- | --- | --- |
| `/explain` | Explain selected code without changing anything | `docs/cursor-prompts/ExplainPrompt.md` |
| `/audit` | Deep technical audit → produces audit report | `docs/cursor-prompts/ApexAuditPrompt.md` |
| `/audit-review` | Review an audit file → produces a Fix Plan | `docs/cursor-prompts/AuditReviewPrompt.md` |
| `/apply-critical` | Apply only Critical SAFE\_AUTO fixes from a Fix Plan | `docs/cursor-prompts/ApplyCriticalPrompt.md` |
| `/fix-all` | Apply all appropriate fixes from a Fix Plan | `docs/cursor-prompts/FixAllPrompt.md` |
| `/doc-sync` | Update docs and comments to match current code | `docs/cursor-prompts/DocSyncPrompt.md` |
| `/cleanup` | Safe, behavior-preserving code cleanup | `docs/cursor-prompts/CleanupPrompt.md` |

**Typical workflow**: `/explain` → `/audit` → `/audit-review` → `/apply-critical` or `/fix-all` → `/doc-sync` → `/cleanup`

**Dependency chain**: `/audit` must run before `/audit-review`. `/audit-review` must produce a Fix Plan before `/apply-critical` or `/fix-all` can run.

---

## PR Guidelines

- Title: clear summary (e.g., `refactor: split PlayerProfileView`).
- Body: bullet summary of changes with file paths.
- Skip descriptions for UI that did not change.

---

## Reference Links

| Doc | What it covers |
| --- | --- |
| `DEVELOPER_GUIDE.md` | Detailed file structure, components, hooks, utilities |
| `copilot-instructions.md` | Environment setup, testing workflows, validation scenarios |
| `docs/workspace-rules/COMMUNICATION_RULES.md` | Ask-vs-decide examples |
| `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` | Feature READMEs, index structure, file headers |
| `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` | When and how to update docs |
| `docs/schema/CURRENT_FIRESTORE_SCHEMA.md` | Authoritative Firestore schema |
| `docs/cursor-prompts/cursor-commands-overview.md` | Full slash command reference with workflows |
