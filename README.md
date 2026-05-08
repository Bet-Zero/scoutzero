# HoopZero

HoopZero is a public-facing NBA scouting platform focused on clear data presentation and role-based player analysis. It mirrors the internal **ScoutZero** grading tool but exposes a read-only interface backed entirely by Firebase. All player evaluations, roles, grades and contract details are fetched from Firestore, allowing fans and analysts to explore a flattened set of scouting data.

## TypeScript Status

TypeScript migration is complete, and root strict mode plus zero-exception hardening are now maintenance standards in this repository. Treat TypeScript as a maintenance gate, not as an active repo-wide campaign. Do not reopen TypeScript hardening unless a documented gate regresses.

## Tech Stack

- **React** with **Vite** for fast development
- **Tailwind CSS** for styling
- **Firebase** (Firestore) as the data store
- Small helper scripts in **Python** to upload data using Firebase Admin

## 🏗️ Monorepo Structure

This project is organized as a **monorepo** containing multiple subsystems that work together:

### 1. Frontend Application (`/src`)

- **Purpose**: React web application for player scouting and GM dashboard
- **Entry point**: `npm run dev`
- **Tech stack**: React, Vite, Tailwind, Zustand, Firebase
- **Deployment**: Firebase Hosting

### 2. Data Pipelines (`/player-scrape`, `/team-scrape`)

- **Purpose**: Scrape and normalize NBA data from external sources
- **Entry points**: See npm scripts (e.g., `npm run team:salaryswish`, `npm run contracts:run`)
- **Tech stack**: TypeScript, Node.js
- **Output**: Firestore database

### 3. Cloud Functions (`/functions`)

- **Purpose**: Backend API and scheduled tasks
- **Entry point**: `cd functions && npm run dev`
- **Tech stack**: Node.js, Express, Firebase Functions
- **Deployment**: `firebase deploy --only functions`

### 4. Scripts & Utilities (`/scripts`)

- **Purpose**: One-off development and validation scripts
- **Tech stack**: TypeScript, Node.js

### Data Flow

```text
External Sources → Data Pipelines → Firestore (SSOT) → Frontend
                                         ↕
                                   Cloud Functions
```

**Key principle**: Firestore serves as the Single Source of Truth (SSOT). Data pipelines write to Firestore, and the frontend reads from it. Cloud Functions provide backend logic and scheduled data updates.

📄 For contribution guidelines and detailed development setup, see [docs/guides/CONTRIBUTING.md](docs/guides/CONTRIBUTING.md)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

   This command installs both production and development packages, including
   ESLint plugins used by `npm run lint`.

   If the linter complains that `eslint-plugin-react` is missing, make sure
   dev dependencies were installed. You can rerun the install with:

   ```bash
   npm install --include=dev
   ```

2. Configure Firebase by creating a `.env` file in the project root with the following keys:

   ```text
   VITE_FIREBASE_API_KEY=<your key>
   VITE_FIREBASE_AUTH_DOMAIN=<your domain>
   VITE_FIREBASE_PROJECT_ID=<project id>
   VITE_FIREBASE_STORAGE_BUCKET=<bucket>
   VITE_FIREBASE_MESSAGING_SENDER_ID=<sender id>
   VITE_FIREBASE_APP_ID=<app id>
   ```

   For running the Python upload helpers, place your `serviceAccountKey.json` file inside `src/`.

3. Start the development server:

   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173` by default.

## Folder Structure

```text
public/             Static assets and exported player JSON
  assets/           Team logos & headshots
  fonts/            Web fonts
src/
  components/       Layout wrapper and shared UI pieces
  features/         Domain features (table, profile, roster, lists, filters, tierMaker)
  hooks/            Custom React hooks for Firebase data and filtering
  pages/            Route-level pages
  utils/            Helper utilities for filtering, formatting and roster logic
  constants/        Shared constants (role lists, badges)
  firebase/         Firestore helper modules
  schemas/          Canonical Zod schemas for players_v2 and architect collections
  styles/           Additional style sheets
  firebaseConfig.js Firebase client initialization
  firebaseHelpers.js Helper functions for Firestore writes
  index.css         Global styles
  main.jsx          App entry point
```

Additional raw datasets live under `data/` for development and import scripts.

## Key Features

- **Advanced Filtering** – filter players by team, position, physical metrics, contracts, roles, subroles and statistics.
- **Player Profiles** – view trait grades, role assignments, and editable blurbs for each player.
- **Roster Tools** – build hypothetical lineups and evaluate depth with drag‑and‑drop sections and an add‑player drawer.
- **Contract Display** – parse and present full contract breakdowns including yearly salary, options and free agency status.
- **Role/Subrole Logic** – assign both primary roles and granular subroles to better capture on‑court responsibility.
- **Future GM Expansion** – groundwork laid for additional team building tools under the "HoopZero Architect" project.

## 🔁 Firestore Collections

This project uses multiple Firestore collections to separate global player data from team/contract logic.

- `/players_v2` — player records, stats, grades, roles, bio info, and contracts
- `architect_worlds` / `architect_base*` — GM dashboard and trade machine data

📄 See [`docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md`](./docs/reference/schema/CURRENT_FIRESTORE_SCHEMA.md) for canonical collection and field reference  
📄 See [`docs/reference/PROJECT_SCHEMA.md`](./docs/reference/PROJECT_SCHEMA.md) for repo structure and validation rules

## Related Projects

- **ScoutZero** – internal evaluation suite used to create player grades and roles. HoopZero presents this data in a read‑only form.
- **HoopZero Architect** – team‑building and GM toolkit integrated with the same player database.

## Developer Guide

See [DEVELOPER_GUIDE.md](docs/guides/DEVELOPER_GUIDE.md) for deeper notes on data structure, component architecture and coding conventions.

## Documentation

The `docs/` folder is organized into four permanent pillars:

- **[`docs/reference/`](docs/reference/)** – how the system works (architect, schema, repo structure)
- **[`docs/guides/`](docs/guides/)** – how to work with and build the system
- **[`docs/operations/`](docs/operations/)** – how to run and maintain the system (runbooks)
- **[`docs/standards/`](docs/standards/)** – rules governing the project

Start with [`docs/INDEX.md`](docs/INDEX.md) for a full map.
