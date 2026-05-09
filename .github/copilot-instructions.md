````instructions
# HoopZero/ScoutZero Copilot Instructions

Always reference these instructions first. If anything here conflicts with current repository files, trust the repository and update this document.

## Project Overview

HoopZero/ScoutZero is a React + Vite + Firebase NBA scouting and GM toolkit. It includes public scouting views plus Architect/GM workflows (trade machine, roster/cap tooling) and uses Firestore collections with strict read/write boundaries.

## Environment and Setup

### System Requirements

- **Node.js**: `>=18.17` (from `package.json` engines)
- **npm**: bundled with Node
- **OS**: macOS, Linux, Windows

### Bootstrap

- Install dependencies: `npm install`
- Start app: `npm run dev` (Vite dev server at `http://localhost:5173/`)
- Production build: `npm run build`
- Preview build: `npm run preview`

### Environment Variables

Create `.env` in project root:

```
VITE_FIREBASE_API_KEY=<your key>
VITE_FIREBASE_AUTH_DOMAIN=<your domain>
VITE_FIREBASE_PROJECT_ID=<project id>
VITE_FIREBASE_STORAGE_BUCKET=<bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender id>
VITE_FIREBASE_APP_ID=<app id>
```

Notes:
- `npm run dev` uses `VITE_USE_FIREBASE_EMULATORS=true` via script config.
- `serviceAccountKey.json` is used by admin/script tooling where required.

## Command Policy (Current)

Use approved npm scripts from `package.json` and `AGENTS.md`.

### Core Commands

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run validate:project` (required after structural file/export changes)
- `npm run docs`
- `npm run lint` (only when requested; repo has substantial pre-existing lint debt)
- `npm run lint:md` (for markdown-heavy edits)

### Testing Commands

Default to **targeted** test runs and append `--reporter=dot`:

- `npm run test:diff -- --reporter=dot` (**default**)
- `npm run test:fast -- --reporter=dot`
- `npm run test:trade -- --reporter=dot`
- `npm run test:architect -- --reporter=dot`
- `npm run test:roster -- --reporter=dot`
- `npm run test:scouting -- --reporter=dot`
- `npm run test:node -- --reporter=dot`
- `npm run test:ui -- --reporter=dot`

**Full suite rule:** only run `npm run test:full` (or equivalent full test commands) when the user explicitly includes: `RUN FULL SUITE`.

## Validation Workflow

After code changes, run the smallest valid check first:

1. Relevant scoped tests (or `npm run test:diff -- --reporter=dot`)
2. `npm run build` for meaningful UI/route/component changes
3. `npm run typecheck` for TS/TSX or logic changes
4. `npm run validate:project` for structural changes

If a test run exceeds ~4 minutes, stop and switch to a cheaper scoped command.

## Project Structure (Current)

Key folders:

```
src/
├── components/     # Diagnostic tools; legacy shared UI moved to shared/
├── config/         # Feature flags and runtime config
├── constants/      # Enums + Firestore collection constants
├── core/           # Site-wide layout
├── data/           # Firestore path helpers
├── features/       # Domain modules (architect, filters, lists, profile, roster, table, etc.)
├── firebase/       # Firestore read/write helpers
├── hooks/          # Legacy hooks
├── pages/          # Route views
├── schemas/        # Canonical Zod schemas
├── shared/         # Shared hooks, utils, and reusable components
├── tests/          # Co-located tests
└── types/          # TS declarations
```

Important references:

- `src/shared/hooks/useSimplePlayerData.ts` (primary player list hook)
- `src/shared/hooks/usePlayerData.ts` (diagnostics wrapper)
- `src/shared/utils/filtering/playerFilterUtils.js`
- `src/constants/collections.ts`
- `src/data/firestorePaths.js`
- `docs/guides/DEVELOPER_GUIDE.md`

## Firestore Rules of Engagement

### Source Data (read-only)

- `players_v2`
- `architect_basePlayers`
- `architect_baseTeams`
- `architect_baseEntitlements`
- `architect_basePickRules`

### User Content (read-write in app flows)

- `architect_worlds`
- `lists`
- `tierLists`
- `rosterProjects`
- `freeAgents`

Always import collection names from `src/constants/collections.ts` and avoid hardcoded collection strings.

## Trade/CBA Guidance

For GM/CBA logic work:

- Use reference materials in `cba/guides/` for reasoning and article citations.
- Do not edit guide files unless explicitly requested.
- Prefer current trade validation layers under `src/features/architect/utils/tradeMachine/` (`engine/`, `rules/`, `utils/`, `constants/`, `cache/`) and avoid deprecated compatibility imports when possible.

## Working Norms

- Use `@/` alias for imports from `src/`.
- Prefer `.ts/.tsx` for new files; existing `.js/.jsx` remains in legacy areas.
- Use named exports by default; default exports for top-level page views only.
- Keep changes scoped; do not create new branches unless asked.
- Keep docs in sync for significant architecture changes.

## Quick Help References

- `AGENTS.md`
- `docs/standards/COMMUNICATION_RULES.md`
- `docs/standards/CREATING_PERMANENT_DOCS.md`
- `docs/standards/DOCUMENTATION_UPDATE_RULES.md`
- `docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md`

````
