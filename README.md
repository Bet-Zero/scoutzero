# HoopZero

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

4. (Optional) run the PNG export server for high quality roster downloads:

   ```bash
   npm run server
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

## Related Projects

- **ScoutZero** – internal evaluation suite used to create player grades and roles. HoopZero presents this data in a read‑only form.
- **HoopZero Architect** – forthcoming team‑building and GM toolkit that will integrate with the same player database.

## Developer Guide

See the upcoming [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for deeper notes on data structure, component architecture and coding conventions.

## Further Docs

The `docs/` folder contains reference maps of the codebase:

- [FILE_MAP.md](docs/FILE_MAP.md) – high level project layout
- [FiltersHierarchy.md](docs/FiltersHierarchy.md)
- [ListsHierarchy.md](docs/ListsHierarchy.md)
- [ProfileHierarchy.md](docs/ProfileHierarchy.md)
- [RosterHierarchy.md](docs/RosterHierarchy.md)
- [TableHierarchy.md](docs/TableHierarchy.md)
- [TierMakerHierarchy.md](docs/TierMakerHierarchy.md)
