# HoopZero/ScoutZero Copilot Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Project Overview

HoopZero is a React + Vite + Firebase NBA scouting platform that provides a public-facing view of player data. It displays player bios, stats, roles, contracts, and grades using a clean layout. All player data is loaded from Firebase Firestore using a flattened player structure.

**CRITICAL CURRENT STATE**: The project has existing build and import issues that prevent the application from building or running the dev server. These are known issues documented below.

## Working Effectively

### System Requirements
- **Node.js**: Version 18+ (as specified in `.github/workflows/audit.yml`)
- **npm**: Comes with Node.js (npm ci or npm install both work)
- **Operating System**: Cross-platform (Windows, macOS, Linux supported)

### Bootstrap and Dependencies
- Install dependencies: `npm install` -- takes 2 minutes. NEVER CANCEL. Set timeout to 5+ minutes.
- Check linting: `npm run lint` -- Shows 1453+ existing errors (technical debt). Do not attempt to fix all unless specifically tasked.

### Testing 
- Run all tests: `npm run test -- --run` -- takes 15 seconds. NEVER CANCEL. Set timeout to 30+ minutes.
- Run specific test file: `npm run test tests/capUtils.test.js -- --run` -- takes <1 second for individual files
- **CURRENT STATE**: Tests have 73 failed, 126 passed due to missing `tradeDebug` import. This is expected.
- **WORKING TESTS**: `tests/capUtils.test.js` passes all 12 tests and can be used for validation
- Test runner uses Vitest with jsdom environment
- Test files are in `tests/` directory

### Building (CURRENTLY BROKEN)
- Build command: `npm run build` -- **FAILS** due to missing `tradeDebug` export from `src/utils/architect/tradeMachine/tradeValidator.js`
- Error: `"tradeDebug" is not exported by "src/utils/architect/tradeMachine/tradeValidator.js"`
- **DO NOT** expect builds to work until this import issue is resolved

### Development Server (CURRENTLY BROKEN)
- Dev server command: `npm run dev` -- **FAILS** due to same import issues as build
- Expected to run on `http://localhost:5173/` when working
- **DO NOT** expect dev server to start until import issues are resolved

### Other Commands
- Generate documentation: `npm run docs` -- takes <1 second. Creates component hierarchy docs in `docs/` folder
- Code formatting: `npm run zen` -- Toggles view states (quick utility command)
- Update stats: `npm run update-stats` -- Updates player statistics (requires Node.js script)
- Create `.env` file in project root with Firebase configuration:
```
VITE_FIREBASE_API_KEY=<your key>
VITE_FIREBASE_AUTH_DOMAIN=<your domain>
VITE_FIREBASE_PROJECT_ID=<project id>
VITE_FIREBASE_STORAGE_BUCKET=<bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender id>
VITE_FIREBASE_APP_ID=<app id>
```
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
- Firebase credentials are required for the app to function properly
- For Python upload helpers, place `serviceAccountKey.json` in `src/` directory
- For Python upload helpers, place `serviceAccountKey.json` in `src/` directory

## Known Issues and Workarounds

### Import Issues (Blocking Build/Dev)
1. **Missing `tradeDebug` export**: `src/features/architect/tradeMachine/TradeDebugPanel.jsx` imports `tradeDebug` but it's not exported from `tradeValidator.js`
2. **Missing `debug` export**: Multiple files import `debug` from `debug.js` but proper export structure is incomplete
3. **Cache function issues**: Tests fail due to missing cache functions like `validationCache.cacheRosterValidation`

### Working Around Build Issues
- Focus on file-level changes rather than full application testing
- Use individual test files to validate specific functionality: `npm run test tests/specific-test.test.js`
- Examine components in isolation rather than running the full application
- Use linting for syntax validation: `npm run lint -- --ext .jsx src/path/to/file.jsx`

## Validation Scenarios

Since the application cannot currently run, use these validation approaches:

### Component Validation
- **Static Analysis**: Use ESLint to validate syntax and imports
- **Unit Testing**: Run specific test files for components you modify
- **Code Review**: Examine imports, exports, and React component structure

### Test-Driven Validation
- Run specific test suites: `npm run test tests/capUtils.test.js` (this one passes)
- Use test files to understand expected behavior
- Write new tests for new functionality before implementing

### Manual Code Inspection
- Check import/export consistency across files
- Validate React component structure and prop types
- Ensure Firestore queries follow existing patterns in `src/hooks/useFirebaseQuery.js`

## Project Structure and Navigation

### Key Directories
```
src/
├── components/          # Layout and shared UI components
│   ├── layout/          # Site-wide layout (SiteLayout.jsx)
│   └── shared/          # Reusable UI widgets
├── features/            # Feature-specific components
│   ├── filters/         # Player filtering UI
│   ├── lists/           # Ranked list components  
│   ├── profile/         # Player profile editor
│   ├── roster/          # Roster building tools
│   ├── table/           # Player table view
│   └── tierMaker/       # Tier list creation
├── hooks/               # Custom React hooks
├── utils/               # Helper functions and data transforms
├── firebase/            # Firestore helper modules
├── pages/               # Top-level route views
└── constants/           # Data lists and enums
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
- **Trade validation**: `src/utils/architect/tradeMachine/` (currently has import issues)

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
- Run linting before committing: `npm run lint` (expect many existing errors)
- Follow existing patterns in `src/features/table/` for component structure
- Keep components under 200 lines; split into subcomponents when larger
- Use named exports for components; default exports only for top-level views

## Technology Stack

- **Frontend**: React 18.2.0 with Vite 4.5.14
- **Styling**: Tailwind CSS with utility classes  
- **Backend**: Firebase Firestore (no authentication required)
- **Testing**: Vitest with jsdom environment
- **Linting**: ESLint with React and accessibility plugins
- **Build**: Vite with React plugin and path aliases

## CRITICAL Reminders

- **NEVER CANCEL** any npm install command - takes 2+ minutes
- **NEVER CANCEL** any test runs - set 30+ minute timeouts
- **DO NOT** expect builds or dev server to work until import issues are resolved
- **ALWAYS** validate changes through individual test files rather than full application
- **NEVER** modify Firestore data - this is a read-only application
- **ALWAYS** use `@/` import alias for src paths
- **ALWAYS** check existing tests before making changes to understand expected behavior

## Getting Help

When the instructions are incomplete or incorrect:
1. Check `DEVELOPER_GUIDE.md` for detailed architectural information
2. Examine existing test files to understand expected behavior
3. Review Firebase queries in `src/hooks/useFirebaseQuery.js`
4. Look at component patterns in `src/features/table/` for examples
5. Check documentation in `docs/` directory for specific feature hierarchies