# HoopZero

[![NBA Trade Audit: PASS](https://img.shields.io/badge/NBA%20Trade%20Audit-PASS-brightgreen)](docs/compliance/AUDIT_CERT.md)

HoopZero is a public-facing NBA scouting platform focused on clear data presentation and role-based player analysis. It mirrors the internal **ScoutZero** grading tool but exposes a read-only interface backed entirely by Firebase. All player evaluations, roles, grades and contract details are fetched from Firestore, allowing fans and analysts to explore a flattened set of scouting data.

## Tech Stack

- **React** with **Vite** for fast development
- **Tailwind CSS** for styling
- **Firebase** (Firestore) as the data store
- Small helper scripts in **Python** to upload data using Firebase Admin

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

   ```
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

```
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
  styles/           Additional style sheets
  firebaseConfig.js Firebase client initialization
  firebaseHelpers.js Helper functions for Firestore writes
  firebase_helpers.py Python Firebase Admin helper
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

- `/players` — master player records, stats, grades, roles, and bio info
- `/teams` — team rosters and `contract_clean` used for GM/cap tools

📄 See [`docs/architecture/DATA_SOURCE_MAP.md`](./docs/architecture/DATA_SOURCE_MAP.md) for full usage rules  
📄 See [`docs/architecture/FIRESTORE_SCHEMA.md`](./docs/architecture/FIRESTORE_SCHEMA.md) for detailed field breakdowns

## Related Projects

- **ScoutZero** – internal evaluation suite used to create player grades and roles. HoopZero presents this data in a read‑only form.
- **HoopZero Architect** – forthcoming team‑building and GM toolkit that will integrate with the same player database.

## Compliance

- [Audit Certification](docs/compliance/AUDIT_CERT.md)
- [Deep Audit](docs/compliance/AUDIT_DEEP.md)
- [Compliance Matrix](docs/compliance/COMPLIANCE_MATRIX.csv)

## Developer Guide

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for deeper notes on data structure, component architecture and coding conventions.

## Documentation

The `docs/` folder contains organized reference documentation:

### Architecture & Technical References

- [Project Context](docs/architecture/PROJECT_CONTEXT.md) – project overview and goals
- [Firestore Schema](docs/architecture/FIRESTORE_SCHEMA.md) – detailed field breakdowns
- [Data Source Map](docs/architecture/DATA_SOURCE_MAP.md) – collection usage rules

### User & Development Guides

- [Collection Naming Guide](docs/guides/COLLECTION_NAMING_AND_FRONTEND_GUIDE.md)
- [Data Population Guide](docs/guides/DATA_POPULATION_GUIDE.md)
- [Diagnostic Prompts](docs/guides/DATA_PIPELINE_DIAGNOSTIC_PROMPT.md)

### Generated API Documentation

- [Component Hierarchies](docs/api/) – auto-generated component structure maps
