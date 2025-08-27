# HoopZero/ScoutZero Copilot Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Project Overview

HoopZero is a React + Vite + Firebase NBA scouting platform that provides a public-facing view of player data. It displays player bios, stats, roles, contracts, and grades using a clean layout. All player data is loaded from Firebase Firestore using a flattened player structure.

## Working Effectively

### System Requirements

- **Node.js**: Version 18+ (as specified in `.github/workflows/audit.yml`)
- **npm**: Comes with Node.js (npm ci or npm install both work)
- **Operating System**: Cross-platform (Windows, macOS, Linux supported)

### Bootstrap and Dependencies

- Install dependencies: `npm install` -- takes 41 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
- Check linting: `npm run lint` -- Shows 1888 errors (technical debt). Takes 8 seconds. Do not attempt to fix all unless specifically tasked.

### Testing

- Run all tests: `npm run test -- --run` -- takes 14 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- Run specific test file: `npm run test tests/capUtils.test.js -- --run` -- takes 1.5 seconds for individual files
- **CURRENT STATE**: 199 tests PASSING, 0 failures across 44 test files (199 total)
- **WORKING TESTS**: `tests/capUtils.test.js` passes all 12 tests and can be used for validation
- Test runner uses Vitest with jsdom environment
- Test files are in `tests/` directory

### Building (WORKING)

- Build command: `npm run build` -- takes 7.3 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- Creates production build in `dist/` directory
- Build includes chunking warnings for large files (>500KB) which is normal

### Development Server (WORKING)

- Dev server command: `npm run dev` -- starts in 230ms
- Available at `http://localhost:5173/` when running
- Use Ctrl+C to stop the server

### Other Commands

- Generate basic docs: `npm run docs` -- takes <1 second. Creates component hierarchy docs in `docs/` folder
- **BROKEN COMMANDS** (missing files):
  - `npm run zen` -- toggleView.cjs missing
  - `npm run update-stats` -- updateStats.js missing
  - `npm run docs:all` -- scripts/ directory missing
- **WORKING DOC COMMANDS**:
  - `npm run docs:api` -- requires `atlas-docs/` directory, generates API documentation

### Environment Setup

- Create `.env` file in project root with Firebase configuration:

```

VITE_FIREBASE_API_KEY=<your key>
VITE_FIREBASE_AUTH_DOMAIN=<your domain>
VITE_FIREBASE_PROJECT_ID=<project id>
VITE_FIREBASE_STORAGE_BUCKET=<bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender id>
VITE_FIREBASE_APP_ID=<app id>

```

- Firebase credentials are required for the app to function properly with real data
- For Python upload helpers, place `serviceAccountKey.json` in `src/` directory

## Validation Scenarios

### Component Validation

- **Build Testing**: Always run `npm run build` to verify changes don't break production build
- **Unit Testing**: Run specific test files for components you modify: `npm run test tests/filename.test.js`
- **Static Analysis**: Use ESLint to validate syntax: `npm run lint -- --ext .jsx src/path/to/file.jsx`

### Manual UI Validation

- **Complete Workflow**: Always test these user scenarios after making changes:
  1. Start dev server: `npm run dev`
  2. Navigate to `http://localhost:5173/`
  3. Test navigation: Click "Player Profiles", "Players", "Tools" dropdown
  4. Test Tools features: "Roster Builder", "Tier Maker", "GM Tools"
  5. Test roster builder: Select team (e.g., "Boston Celtics"), verify interface updates
  6. Test search and filter functionality when players load

### Test-Driven Validation

- Run specific test suites: `npm run test tests/capUtils.test.js` (all 12 tests pass)
- Use test files to understand expected behavior
- Write new tests for new functionality before implementing

## Project Structure and Navigation

### Key Directories

```

src/
├── components/ # Layout and shared UI components
│ ├── layout/ # Site-wide layout (SiteLayout.jsx)
│ └── shared/ # Reusable UI widgets
├── features/ # Feature-specific components
│ ├── filters/ # Player filtering UI
│ ├── lists/ # Ranked list components
│ ├── profile/ # Player profile editor
│ ├── roster/ # Roster building tools
│ ├── table/ # Player table view
│ └── tierMaker/ # Tier list creation
├── hooks/ # Custom React hooks
├── utils/ # Helper functions and data transforms
├── firebase/ # Firestore helper modules
├── pages/ # Top-level route views
└── constants/ # Data lists and enums

```

### Important Files

- `src/firebaseConfig.js` - Firebase initialization and Firestore connection
- `src/hooks/usePlayerData.js` - Main player data fetching hook
- `src/utils/filtering/playerFilterUtils.js` - Player filtering logic
- `DEVELOPER_GUIDE.md` - Detailed architectural documentation
- `docs/` - Additional project documentation and hierarchies

### Frequently Modified Areas

- **Player filtering**: `src/features/filters/` and `src/utils/filtering/`
- **Player profile**: `src/features/profile/` for player detail views
- **Data fetching**: `src/hooks/` for Firebase queries and data normalization
- **Trade validation**: `src/utils/architect/tradeMachine/` (complex validation system)

### Trade Validation Architecture

The trade validation system has been reorganized into a layered architecture:

- `engine/` - Main orchestration layer with `validateTrade()` function and debugging
- `rules/` - Pure validation functions (salary matching, hard cap, etc.)
- `utils/` - Utility functions for computations and input normalization
- `constants/` - Shared constants and configuration
- `cache/` - Performance caching for expensive validations
- `validators/` - **DEPRECATED** compatibility layer for old imports

**Important**: Always import from the new structure (`engine/`, `rules/`, `utils/`) rather than the deprecated `validators/` compatibility layer.

## Data Architecture

### Firestore Collections

- `/players` - Master player records with stats, grades, roles, and bio info (READ-ONLY)
- `/teams` - Team rosters and `contract_clean` used for GM/cap tools

### Key Data Patterns

- Import paths use `@/` alias pointing to `src/` (configured in `jsconfig.json`)
- Components are organized by feature; shared UI lives under `src/components/shared`
- Player data is normalized using `normalizePlayerData` from `src/utils/roster/`
- Filtering uses `filterPlayers` and `sortPlayers` from `src/utils/filtering/playerFilterUtils.js`

## Common Tasks

### Adding New Features

1. Create components in appropriate `src/features/` subdirectory
2. Add shared utilities to `src/utils/` with feature grouping
3. Update filtering defaults in `src/utils/filtering/playerFilterDefaults.js` if needed
4. Add tests in `tests/` directory following existing patterns

### Debugging Issues

1. Check imports/exports consistency first
2. Run specific test files to isolate issues
3. Use ESLint to catch syntax issues: `npm run lint -- path/to/file.jsx`
4. Review Firebase console logs if data-related issues

### Code Quality

- Run linting before committing: `npm run lint` (expect ~1888 existing errors)
- Follow existing patterns in `src/features/table/` for component structure
- Keep components under 200 lines; split into subcomponents when larger
- Use named exports for components; default exports only for top-level views

## Technology Stack

- **Frontend**: React 18.2.0 with Vite 4.4.0
- **Styling**: Tailwind CSS with utility classes
- **Backend**: Firebase Firestore (no authentication required)
- **Testing**: Vitest with jsdom environment
- **Linting**: ESLint with React and accessibility plugins
- **Build**: Vite with React plugin and path aliases

## CRITICAL Reminders

- **NEVER CANCEL** any npm install command - takes ~41 seconds, set 120+ second timeout
- **NEVER CANCEL** any test runs - set 60+ second timeouts
- **NEVER CANCEL** any builds - takes ~8 seconds, set 60+ second timeout
- **ALWAYS** test complete user workflows after making changes
- **NEVER** modify Firestore data - this is a read-only application
- **ALWAYS** use `@/` import alias for src paths
- **ALWAYS** run `npm run build` before committing to ensure production compatibility

## Getting Help

When the instructions are incomplete or incorrect:

1. Check `DEVELOPER_GUIDE.md` for detailed architectural information
2. Examine existing test files to understand expected behavior
3. Review Firebase queries in `src/hooks/useFirebaseQuery.js`
4. Look at component patterns in `src/features/table/` for examples
5. Check documentation in `docs/` directory for specific feature hierarchies

---

## CBA Expert Reference Mode

When handling **GM/CBA logic** (contracts, trades, cap rules, free agency, extensions):

- **Knowledge Pack**: Use `/cba/guides/**` rule cards, articles, and exhibits. These are **educational reference only**, not runtime code.
- **Purpose**: Always consult these files to understand rules, cite articles/sections, and explain decisions.
- **Outputs**:
  - Cite Article/Section IDs from the guides in comments or rationale.
  - Explain “why/why not” based on the reference material.
  - Suggest missing coverage if you see gaps in the guides.

**Conversation Style**:

- Start with a plain-English mini-plan (≤3 bullets).
- Proceed step-by-step — don’t dump everything at once.
- If “it depends,” ask up to 2 clarifying questions.
- Include advisory notes if you see pitfalls or better alternatives.

**Scope Discipline**:

- Only touch files relevant to the current GM/CBA task.
- Do not alter the `/cba/guides/` reference material unless specifically asked.
- If unsure which rule card applies, ask me directly.

```

```
