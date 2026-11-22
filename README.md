# HoopZero

HoopZero is a public-facing NBA scouting platform focused on clear data presentation and role-based player analysis. It mirrors the internal **ScoutZero** grading tool and also includes **Architect**, a GM toolkit for building rosters and making trades under the salary cap. Player evaluations, roles, grades and contract details come from Firestore.

AI agents working on this repository: start with [AGENTS.md](AGENTS.md).

## Tech Stack

- **React 18** with **Vite** and **TypeScript** (strict mode)
- **Tailwind CSS 3** for styling
- **Zod** schemas in `src/schemas/` as the data contracts
- **Firebase**: Firestore (data), Auth (sign-in) and Cloud Functions (trusted server work)
- **Vercel** hosts the website; merging to `main` updates the live site
- **Vitest** and **Playwright** for tests

## Repository Structure

### 1. Frontend application (`/src`)

- React web app for player scouting, lists, tier lists, the player ranker and the Architect GM dashboard
- Entry points: `src/main.tsx` and `src/App.tsx`; Firebase setup in `src/firebaseConfig.ts`

### 2. Data pipelines (`/player-scrape`, `/team-scrape`)

- Scrape and normalize NBA data from external sources (TypeScript, Node.js)
- Run through npm scripts; see [docs/guides/SCRIPTS.md](docs/guides/SCRIPTS.md) and [docs/operations/NBA_MAINTENANCE.md](docs/operations/NBA_MAINTENANCE.md)
- Output: Firestore

### 3. Server code (`/functions`, `/server`, `/api`)

- Firebase Cloud Functions and server-side handlers for trusted Architect work such as creating saved worlds
- Functions have their own `package.json`; build and test them from `functions/`

### 4. Scripts and utilities (`/scripts`)

- Development, validation, review and data-maintenance scripts (TypeScript, Node.js)

### Data flow

```text
External Sources → Data Pipelines → Firestore (source of truth) → Frontend
                                         ↕
                                  Functions / server
```

Firestore is the single source of truth. Source collections such as `players_v2` are read-only for the app; user-created content (lists, tier lists, rosters, saved Architect worlds) is read-write.

For contribution guidelines, see [docs/guides/CONTRIBUTING.md](docs/guides/CONTRIBUTING.md).

## Setup

1. Install dependencies (Node.js 24.5 or newer):

   ```bash
   npm install
   ```

2. Configure Firebase by creating a `.env` file in the project root:

   ```text
   VITE_FIREBASE_API_KEY=<your key>
   VITE_FIREBASE_AUTH_DOMAIN=<your domain>
   VITE_FIREBASE_PROJECT_ID=<project id>
   VITE_FIREBASE_STORAGE_BUCKET=<bucket>
   VITE_FIREBASE_MESSAGING_SENDER_ID=<sender id>
   VITE_FIREBASE_APP_ID=<app id>
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   This runs against the local Firebase emulators (`VITE_USE_FIREBASE_EMULATORS=true`). The app is at `http://localhost:5173`. To run the full app with real data in a cloud session, follow [docs/operations/CLOUD_DEVELOPMENT.md](docs/operations/CLOUD_DEVELOPMENT.md).

## Folder Structure

```text
public/             Static assets (team logos, headshots, fonts)
src/
  components/       Diagnostic tools
  config/           Feature flags and runtime config
  constants/        Shared constants, including Firestore collection names
  core/             Site-wide layout
  data/             Firestore path helpers
  features/         Feature modules (architect, filters, lists, profile, ranker, roster, tierMaker, ...)
  firebase/         Firestore read/write helpers
  fonts/            Embedded font data for image exports
  pages/            Route-level pages
  schemas/          Canonical Zod schemas
  shared/           Shared components, hooks and utilities
  styles/           Additional style sheets
  tests/            Co-located tests
  types/            TypeScript declarations
  App.tsx           App routes
  main.tsx          App entry point
  firebaseConfig.ts Firebase client initialization
tests/              Test suites (unit, integration, emulator, end-to-end)
docs/               Permanent documentation (see docs/INDEX.md)
work/               Plans in progress
archive/            Finished or retired plans and documents
```

## Key Features

- **Player Database** – filter players by team, position, physical metrics, contracts, roles, subroles and statistics.
- **Player Profiles** – trait grades, role assignments and editable blurbs for each player.
- **Lists, Tier Maker and Player Ranker** – build and export your own player lists, tiers and rankings.
- **Roster Tools** – build hypothetical lineups with drag-and-drop sections and an add-player drawer.
- **Architect** – run a team in a saved world: cap sheet, free agency, contracts and options, waivers and buyouts, and a Trade Machine that checks NBA trade rules.

## Firestore Collections

- `players_v2` – player records, stats, grades, roles, bio info and contracts (read-only source data)
- `architect_base*` – Architect source data (read-only)
- `architect_worlds`, `lists`, `tierLists`, `rosterProjects`, `rankerSessions`, `freeAgents` – user-created content

See [docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md](docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md) for the full schema and [docs/reference/PROJECT_SCHEMA.md](docs/reference/PROJECT_SCHEMA.md) for repository structure and validation rules.

## Documentation

The `docs/` folder is organized into four permanent pillars:

- **[`docs/reference/`](docs/reference/)** – how the system works (architect, schema, repo structure)
- **[`docs/guides/`](docs/guides/)** – how to work with and build the system
- **[`docs/operations/`](docs/operations/)** – how to run and maintain the system (runbooks)
- **[`docs/standards/`](docs/standards/)** – rules governing the project

Start with [`docs/INDEX.md`](docs/INDEX.md) for a full map. See [DEVELOPER_GUIDE.md](docs/guides/DEVELOPER_GUIDE.md) for data structure, component architecture and coding conventions.
