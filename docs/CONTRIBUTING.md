# Contributing to ScoutZero/HoopZero

Thank you for your interest in contributing to ScoutZero/HoopZero! This guide will help you get started with development and understand our contribution process.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)
- [Getting Help](#getting-help)

---

## Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Node.js** version 18+ (check with `node --version`)
- **npm** version 9+ (check with `npm --version`)
- **Git** for version control
- **Firebase CLI** (optional, for emulator testing): `npm install -g firebase-tools`

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ScoutZero
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   This installs both production and development packages. If you encounter ESLint plugin errors, ensure dev dependencies were installed:

   ```bash
   npm install --include=dev
   ```

3. **Set up Firebase configuration**

   Create a `.env` file in the project root:

   ```bash
   VITE_FIREBASE_API_KEY=<your-api-key>
   VITE_FIREBASE_AUTH_DOMAIN=<your-auth-domain>
   VITE_FIREBASE_PROJECT_ID=<your-project-id>
   VITE_FIREBASE_STORAGE_BUCKET=<your-storage-bucket>
   VITE_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
   VITE_FIREBASE_APP_ID=<your-app-id>
   ```

   **Note**: For development, you can use the Firebase emulator instead of live credentials.

4. **Start the development server**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

### Verify Your Setup

Run these commands to ensure everything is working:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Tests
npm test

# Project schema validation
npm run validate:project
```

---

## Project Structure

ScoutZero is organized as a **monorepo** with multiple subsystems:

### 1. Frontend Application (`/src`)

The main React web application.

**Key directories:**

- `src/components/` - Shared UI components
- `src/features/` - Feature modules (table, profile, roster, lists, trade machine)
- `src/hooks/` - Custom React hooks
- `src/pages/` - Route-level page components
- `src/utils/` - Helper utilities
- `src/schemas/` - Zod schemas for data validation
- `src/firebase/` - Firebase/Firestore helpers

**Tech stack:** React, Vite, Tailwind CSS, Zustand, Firebase

### 2. Data Pipelines (`/player-scrape`, `/team-scrape`)

TypeScript CLI tools for scraping and normalizing NBA data from external sources.

**Player Scrape:**

- `player-scrape/contracts/` - Contract data scraping
- `player-scrape/stats/` - Stats data scraping
- `player-scrape/shared/` - Shared utilities

**Team Scrape:**

- `team-scrape/team-data/` - Team salary data
- `team-scrape/draft-picks/` - Draft pick data
- `team-scrape/shared/` - Shared utilities

### 3. Cloud Functions (`/functions`)

Firebase Cloud Functions for backend API and scheduled tasks.

- Separate npm project with its own `package.json`
- Deploy with `firebase deploy --only functions`

### 4. Scripts & Utilities (`/scripts`)

One-off scripts and development utilities.

### 5. Documentation (`/docs`)

Comprehensive project documentation. See [docs/INDEX.md](INDEX.md) for full navigation.

---

## Development Workflow

### Branch Naming

Use descriptive branch names that indicate the type of change:

- `feat/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions or fixes

**Examples:**

- `feat/add-player-comparison`
- `fix/trade-machine-tpe-calculation`
- `docs/update-contributing-guide`

### Commit Messages

Write clear, concise commit messages:

```
type: brief description

Longer explanation if needed. Describe what changed and why.

Co-Authored-By: Name <email>
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `test` - Test changes
- `docs` - Documentation changes
- `chore` - Maintenance tasks

**Example:**

```
feat: add trade exception tracking to Trade Machine

Implements TPE generation and consumption logic according to CBA rules.
Adds validation for incoming/outgoing salary thresholds and prior-year TPE restrictions.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Making Changes

1. **Create a branch**

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code patterns
   - Add tests for new functionality
   - Update documentation if needed

3. **Run quality checks**

   ```bash
   npm run typecheck  # TypeScript type checking
   npm run lint       # ESLint
   npm test           # Tests
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: your descriptive message"
   ```

5. **Push to your fork**

   ```bash
   git push origin feat/your-feature-name
   ```

---

## Testing

### Test Organization

ScoutZero uses **Vitest** for testing with two configurations:

1. **Unit & Integration Tests** (`vitest.config.js`)
   - Location: `/tests` and `/src/tests`
   - Environment: jsdom (browser simulation)
   - Run with: `npm test`

2. **Emulator Tests** (`vitest.emulator.config.js`)
   - Tests Firebase interactions with local emulator
   - Run with: `npm run test:emulator`
   - Requires Firebase emulator running

### Running Tests

**All tests:**

```bash
npm test
```

**Specific test file:**

```bash
npm test -- path/to/test.test.js
```

**Watch mode:**

```bash
npm test -- --watch
```

**Emulator tests:**

```bash
npm run emulators:exec -- "npm run test:emulator"
```

### Writing Tests

Tests live in two directories with distinct purposes:

- **`/tests/`** — Pure business logic, CBA rules, validators, contract parsing
- **`/src/tests/`** — Feature integration, React components, phase-numbered guardrails, emulator E2E

**Rule of thumb:** If it tests an isolated function with no React or feature wiring, it goes in `/tests/`. Everything else goes in `/src/tests/`.

**Test requirements before PR:**

- All existing tests must pass
- New features require tests
- Bug fixes should include regression tests

See [TESTING.md](TESTING.md) for detailed placement rules and decision tree.

---

## Code Style

### TypeScript/JavaScript

- **ESLint** enforces code style (`.eslintrc.cjs`)
- **Prettier** formats code (`.prettierrc`)
- Use TypeScript for new files when possible
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Destructure props and imports

### React Conventions

- **Functional components** with hooks (no class components)
- **Custom hooks** for shared logic
- **Zustand** for global state management
- **Component structure**:

  ```jsx
  import statements
  type definitions
  component function
  helper functions (if local)
  export statement
  ```

### File Naming

**Code files:**

- **Components**: `PascalCase.jsx` or `PascalCase.tsx`
- **Utilities**: `camelCase.js` or `camelCase.ts`
- **Tests**: `*.test.js` or `*.test.ts`
- **Schemas**: `camelCaseSchema.js`

**Markdown / documentation files:**

- **Major reference docs**: `SCREAMING_SNAKE_CASE.md` (e.g., `DEVELOPER_GUIDE.md`, `PROJECT_SCHEMA.md`)
- **Runbooks & operational docs**: `kebab-case.md` (e.g., `data-scrape.md`, `cutover-cleanup.md`)
- **Return packages**: `SCREAMING_SNAKE_CASE` with optional date suffix (e.g., `PHASE_2AA_EXECUTION.md`, `DRAFT_PICKS_FIX__EXECUTION__2026-01-10.md`)
- **Cursor prompts**: `PascalCase.md` to mirror command names (e.g., `ApplyCriticalPrompt.md`)
- **Component hierarchy docs**: `PascalCase.md` to mirror component names (e.g., `ArchitectHierarchy.md`)
- **Never use `camelCase`** for markdown files (e.g., ~~`capSettingsProvider.md`~~)

**Directory naming:**

- Use `snake_case` for directories containing deliverables (e.g., `return_packages/`)
- Use `kebab-case` for all other directories (e.g., `cursor-prompts/`, `team-scrape/`)

### Data Conventions

- **Player IDs**: `snake_case` (e.g., `lebron_james`)
- **Team codes**: 3-letter uppercase (e.g., `LAL`, `BOS`)
- **Years**: 4-digit (e.g., `2025`)

See [PROJECT_SCHEMA.md](architecture/PROJECT_SCHEMA.md) for comprehensive naming conventions.

---

## Pull Request Process

### Before Submitting

1. ✅ **All tests pass**: `npm test`
2. ✅ **No TypeScript errors**: `npm run typecheck`
3. ✅ **No linting errors**: `npm run lint`
4. ✅ **Schema validation passes**: `npm run validate:project`
5. ✅ **Documentation updated** (if applicable)
6. ✅ **Branch is up to date** with main

### PR Template

When creating a pull request, include:

```markdown
## Summary
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Changes Made
- Bullet point list of specific changes
- Include file paths for major changes

## Testing
- [ ] All tests pass
- [ ] Added tests for new functionality
- [ ] Manually tested in browser

## Related Issues
Closes #123
Related to #456

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No console warnings or errors
```

### Review Process

1. **Automated checks** run on every PR (CI)
2. **Code review** by maintainers
3. **Address feedback** and update PR
4. **Approval** and merge by maintainers

---

## Documentation

### When to Update Documentation

Update documentation when you:

- Add new features
- Change existing behavior
- Fix bugs that affect usage
- Add or modify data schemas
- Change build or deployment processes

### Documentation Locations

- **User guides**: `/docs/guides/`
- **Architecture docs**: `/docs/architecture/` or `docs/architecture/PROJECT_SCHEMA.md`
- **Runbooks**: `/docs/runbooks/`
- **API documentation**: Auto-generated with `npm run docs`
- **Component docs**: Inline JSDoc comments

### Documentation Style

- Use **Markdown** for all documentation
- Include **code examples** where applicable
- Add **diagrams** for complex concepts
- Keep **line length** under 100 characters
- Use **links** to reference related docs

---

## Getting Help

### Resources

- [Documentation Index](INDEX.md) - Full documentation navigation
- [Developer Guide](guides/DEVELOPER_GUIDE.md) - Deep dive into architecture
- [Project Schema](architecture/PROJECT_SCHEMA.md) - Data structures and conventions
- [Project Schema](architecture/PROJECT_SCHEMA.md) - Data structures and conventions

### Common Issues

**ESLint plugin missing:**

```bash
npm install --include=dev
```

**TypeScript errors:**

```bash
npm run typecheck
```

**Firebase connection issues:**

- Check `.env` file configuration
- Use Firebase emulator for local development
- Verify service account credentials (if using Admin SDK)

**Tests failing:**

```bash
# Clear test cache
npm test -- --clearCache

# Run specific test file
npm test -- path/to/test.test.js
```

### Communication

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Pull Requests**: Tag reviewers and provide context

---

## Project-Specific Notes

### CBA Compliance

When working on Trade Machine or salary cap features:

- Follow NBA Collective Bargaining Agreement rules (see `/docs/compliance/`)
- Reference [Trade Machine Audit](tradeMachine/TRADE_MACHINE_AUDIT.md) for validation patterns
- Test edge cases (apron restrictions, Stepien Rule, sign-and-trade, etc.)

### Mutation Pipeline

All data mutations follow this pattern:

```
UI hook → persistMutation(type, payload) → getStateForMutation →
computeXxxResult → validateMutation → persistWorldMutation
```

See [Developer Guide](guides/DEVELOPER_GUIDE.md) for detailed mutation flow.

### Data Sources

- **Firestore** is the Single Source of Truth (SSOT)
- Data pipelines scrape external sources → write to Firestore
- Frontend reads from Firestore (never modifies scrape results)

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing to ScoutZero/HoopZero!** 🏀

If you have questions or suggestions for improving this guide, please open an issue or submit a PR.

---

**Last Updated**: February 12, 2026
