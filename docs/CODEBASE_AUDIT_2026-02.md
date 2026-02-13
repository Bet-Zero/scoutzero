# ScoutZero Codebase Audit - February 2026

**Date**: February 12, 2026
**Type**: High-Level Structural & Organizational Review
**Focus**: Big-picture improvements for maintainability, developer experience, and AI agent compatibility

---

## Executive Summary

This audit identifies 10 straightforward structural and organizational improvements for the ScoutZero/HoopZero project. These improvements focus on documentation, configuration, file organization, and developer experience rather than code implementation details.

**Key Findings:**

- Documentation is fragmented across 416 files in 35 subdirectories with no clear navigation
- Configuration files lack organization and have duplicates
- Root directory contains clutter (debug scripts, Firebase exports)
- Missing standard GitHub project files (CONTRIBUTING.md)
- npm scripts list is unwieldy (115+ scripts)
- Monorepo structure lacks documentation

---

## 🎯 Top 10 High-Level Improvements

### 1. Duplicate ESLint Configurations ⚠️

**Severity**: Medium
**Effort**: Low
**Impact**: Removes confusion about enforced rules

**Problem:**

- Two ESLint config files exist at root:
  - `.eslintrc.cjs` (136 lines, comprehensive)
  - `.eslintrc.json`
- ESLint will use one and ignore the other

**Impact:**

- Developers don't know which rules are actually enforced
- Inconsistent linting behavior possible
- Maintenance confusion

**Recommendation:**

- Delete `.eslintrc.json`
- Keep only `.eslintrc.cjs` (has proper TypeScript/React setup)
- Verify ESLint runs correctly after removal

---

### 2. Debug Scripts Cluttering Root Directory 🗑️

**Severity**: Low
**Effort**: Low
**Impact**: Visual cleanup, reduced noise

**Problem:**
Multiple orphaned debug scripts in project root:

- `debug_atl_2028.js`
- `debug_atl_own.js`
- `debug_atl_own_brief.js`
- `debug_bos_2028_source.js`
- `debug_bos_own.js`
- `debug_id_mismatch.js`
- `debug_manual_scan.js`
- `debug_pick.js`
- `debug_pick_brief.js`
- `debug_swaps.js`

**Impact:**

- Clutters root directory
- Creates noise for developers
- Unclear if these are still needed
- Committed to git unnecessarily

**Recommendation:**

- Create `.debugScripts/` folder at root
- Move all `debug_*.js` files there
- Add `.debugScripts/` to `.gitignore` if scripts are temporary
- OR delete entirely if no longer needed
- Document purpose if keeping them

---

### 3. Mysterious `--help` Directory ❓

**Severity**: Low
**Effort**: Low
**Impact**: Removes mystery and confusion

**Problem:**

- A directory literally named `--help/` exists at root level
- Unclear purpose or origin
- Odd naming convention (looks like command flag)

**Impact:**

- Creates confusion
- Likely accidental creation

**Recommendation:**

- Investigate contents
- Document purpose if intentional
- Remove if accidental or unused

---

### 4. Fragmented Documentation 📚

**Severity**: HIGH
**Effort**: Medium
**Impact**: Significantly improves onboarding and navigation

**Problem:**

- 9 critical markdown files at root level:
  - `DEVELOPER_GUIDE.md`
  - `PROJECT_SCHEMA.md`
  - `AGENTS.md`
  - `SIMPLE_USER_GUIDE.md`
  - `TRADE_MACHINE_AUDIT.md`
  - `TRADE_MACHINE_FIX_PLAN.md`
  - `ARCHITECT_SCHEMA_MIGRATION_REVIEW.md`
  - Plus more
- 3,042+ total lines of markdown across 416 files
- 35 subdirectories in `/docs` folder
- No clear index or navigation
- No "start here" guide

**Impact:**

- New developers don't know where to start
- Documentation is hard to discover
- Knowledge scattered and duplicated
- AI agents struggle to find relevant context

**Recommendation:**

**Short-term (Quick Win):**

1. Create `/docs/INDEX.md` as single entry point with:
   - Table of contents by category
   - Links to all major docs
   - "Start Here" section by role (developer, contributor, user)

**Medium-term:**
2. Organize docs into clear categories:

- `/docs/guides/` - User and developer guides
- `/docs/architecture/` - System design and schemas
- `/docs/operations/` - Deployment, maintenance, troubleshooting
- `/docs/audits/` - Historical audits and reviews
- `/docs/compliance/` - CBA rules and regulations
1. Move appropriate root-level docs into these folders
2. Keep only `README.md`, `CONTRIBUTING.md`, and `LICENSE` at root
3. Add clear navigation in main README

---

### 5. Inconsistent Config File Organization ⚙️

**Severity**: Medium
**Effort**: Medium
**Impact**: Easier project setup and understanding

**Problem:**
Multiple config files scattered at root with no clear pattern:

- `vite.config.js`
- `vitest.config.js`
- `vitest.emulator.config.js` (TWO vitest configs!)
- `tailwind.config.js`
- `postcss.config.js`
- `.prettierrc`
- `.markdownlint.json`
- `.firebaserc`
- Plus more

**Impact:**

- Config files aren't grouped
- Unclear why there are TWO vitest configs
- Hard to understand build setup
- No documentation of config relationships

**Recommendation:**

**Option A: Keep at Root (Simpler)**

- Keep all configs at root (conventional for many projects)
- Create `/docs/CONFIGURATION.md` documenting:
  - Purpose of each config file
  - Why two vitest configs exist (jsdom vs emulator)
  - How configs interact
  - Common configuration tasks

**Option B: Organize in Folder**

- Create `config/` directory at root
- Move build/dev configs: `config/vite.js`, `config/tailwind.js`, `config/postcss.js`
- Update references in code
- Keep test configs at root (invoked by npm scripts)

**Recommended: Option A** (less breaking, more conventional)

---

### 6. Massive npm Scripts List (115+ Scripts!) 📜

**Severity**: Medium
**Effort**: Medium
**Impact**: Improved developer experience and command discoverability

**Problem:**
`package.json` contains 115+ npm scripts in a single flat list:

- Player scraping scripts (11+)
- Team scraping scripts (20+)
- Draft picks scripts (15+)
- PST (Projected Salary Trade?) scripts (20+)
- Emulator scripts (8+)
- CI/verification scripts (5+)
- Development scripts
- Build scripts

**Impact:**

- Overwhelming to browse
- Hard to find relevant commands
- New developers don't know what to run
- No grouping by purpose or module
- Unclear which scripts are essential

**Recommendation:**

1. **Create `/docs/SCRIPTS.md`** documenting:

   ```markdown
   # npm Scripts Reference

   ## Essential Commands (Daily Use)
   - `npm run dev` - Start development server
   - `npm run build` - Build for production
   - `npm test` - Run all tests
   - `npm run lint` - Lint code

   ## Data Pipeline Scripts
   ### Player Scraping
   - `npm run player:espn` - Scrape player data from ESPN
   - ...

   ### Team Scraping
   - `npm run team:salaryswish` - Scrape team salary data
   - ...

   ## Testing Scripts
   - `npm run test:unit` - Run unit tests
   - `npm run test:emulator` - Run emulator tests
   - ...

   ## CI/Verification Scripts
   - `npm run verify` - Run full verification suite
   - ...
   ```

2. **Add script categories as comments in package.json**:

   ```json
   "scripts": {
     "// Development": "",
     "dev": "vite",
     "build": "vite build",

     "// Testing": "",
     "test": "vitest",
     "test:emulator": "vitest --config vitest.emulator.config.js",

     "// Player Scraping": "",
     "player:espn": "...",
     ...
   }
   ```

3. **Consider npm workspaces** for future organization of scraping tools

---

### 7. Missing CONTRIBUTING.md 📋

**Severity**: HIGH
**Effort**: Low
**Impact**: Enables external contribution and improves onboarding

**Problem:**

- No `CONTRIBUTING.md` guide (standard for GitHub projects)
- No documented contribution guidelines
- No setup instructions for new developers
- Unclear testing requirements before PR
- No code style guide

**Impact:**

- External contributors don't know how to help
- Inconsistent contribution quality
- Hard onboarding experience
- No reference for AI agents on project conventions

**Recommendation:**

Create `/docs/CONTRIBUTING.md` with:

1. **Development Setup**
   - Prerequisites (Node version, npm, Firebase CLI)
   - Installation steps
   - Environment variables needed
   - How to start local development

2. **Project Structure Overview**
   - Frontend, data pipelines, cloud functions
   - Key directories and their purposes

3. **Development Workflow**
   - Branch naming conventions
   - Commit message format
   - How to run tests
   - How to run linter

4. **Testing Requirements**
   - Which tests must pass before PR
   - How to add new tests
   - Test organization

5. **Code Style Guide**
   - ESLint configuration
   - Prettier settings
   - TypeScript conventions
   - React patterns used

6. **Pull Request Process**
   - What to include in PR description
   - Review process
   - Deployment after merge

---

### 8. Unclear Monorepo Structure 🏗️

**Severity**: Medium
**Effort**: Medium
**Impact**: Clarifies architecture and module boundaries

**Problem:**
Project has multiple distinct subsystems but no clear documentation:

**Subsystems Identified:**

1. **Frontend** (`src/`) - React application
2. **Data Pipelines** (`player-scrape/`, `team-scrape/`) - TypeScript CLI tools
3. **Cloud Functions** (`functions/`) - Separate npm project
4. **Scripts** (`scripts/`) - Miscellaneous utilities

**Impact:**

- Unclear which parts are interdependent
- Hard to understand module boundaries
- No workspace-level documentation
- Difficult to onboard to specific subsystems
- AI agents can't navigate architecture

**Recommendation:**

**Option 1: Documentation-Only (Quick Win)**

Create root-level `/MONOREPO.md`:

```markdown
# ScoutZero Monorepo Structure

## Overview
This project contains multiple subsystems that work together...

## Subsystems

### 1. Frontend Application (`src/`)
- **Purpose**: React web application for GM dashboard
- **Entry point**: `npm run dev`
- **Tech stack**: React, Vite, Tailwind, Zustand
- **Deployment**: Firebase Hosting

### 2. Data Pipelines (`player-scrape/`, `team-scrape/`)
- **Purpose**: Scrape and normalize NBA data from external sources
- **Entry points**: See `/docs/SCRIPTS.md`
- **Tech stack**: TypeScript, Node.js
- **Output**: Firestore database

### 3. Cloud Functions (`functions/`)
- **Purpose**: Backend API and scheduled tasks
- **Entry point**: `cd functions && npm run dev`
- **Tech stack**: Node.js, Express, Firebase Functions
- **Deployment**: Firebase Functions

### 4. Utilities (`scripts/`)
- **Purpose**: One-off scripts and utilities
- **Tech stack**: JavaScript/TypeScript

## Data Flow
Firestore serves as SSOT (Single Source of Truth):
- Data Pipelines → Firestore
- Frontend ← Firestore
- Cloud Functions ↔ Firestore

## Development Workflow
[How to work across subsystems...]
```

**Option 2: Migrate to npm Workspaces (Future)**

- Proper monorepo with workspace dependencies
- Shared dev dependencies
- Better encapsulation

**Recommended: Option 1** (documentation first, migration later if needed)

---

### 9. Firebase Export Directories Cluttering Root 💾

**Severity**: Low
**Effort**: Low
**Impact**: Disk space cleanup, visual organization

**Problem:**
10+ Firebase export directories with cryptic names at root:

- `firebase-export-1768995981213TIHkgO/`
- `firebase-export-1768997871053c9nJ8m/`
- `firebase-export-1768998066354rDUqfn/`
- Each ~6-16MB
- Total: 100MB+

**Impact:**

- Clutters root directory
- Wasted disk space if committed to git
- Unclear which exports are current/valid
- Likely developer dumps from testing

**Recommendation:**

1. **Immediate:**
   - Add `firebase-export-*/` to `.gitignore`
   - Delete old exports from working directory

2. **Organization:**
   - Create `firebase-exports/` directory structure:

     ```
     firebase-exports/
       ├── .gitignore (ignore everything except README)
       ├── README.md (explains export purpose)
       └── archive/ (local-only exports)
     ```

3. **Documentation:**
   - Document in README when/why to create exports
   - Add to CONTRIBUTING.md how to use local emulator

---

### 10. No Testing Strategy Documentation 🧪

**Severity**: Medium
**Effort**: Low
**Impact**: Clarifies testing approach and requirements

**Problem:**

- Three different test configurations:
  - `vitest.config.js`
  - `vitest.emulator.config.js`
  - Test files in both `src/tests/` AND `tests/`
- No README explaining test organization
- Unclear which tests to run when
- No documentation of test types

**Impact:**

- Developers don't know which tests to run
- Unclear where new test files should go
- Confusion about emulator vs. non-emulator tests
- No testing requirements documented

**Recommendation:**

Create `/docs/TESTING.md`:

```markdown
# Testing Strategy

## Test Organization

### Unit Tests (`tests/`)
- **Purpose**: Test individual functions and utilities in isolation
- **Location**: `/tests`
- **Config**: `vitest.config.js`
- **Run**: `npm test`
- **Environment**: jsdom (browser simulation)

### Integration Tests (`src/tests/`)
- **Purpose**: Test React components and UI integration
- **Location**: `/src/tests`
- **Config**: `vitest.config.js`
- **Run**: `npm test` (included in main suite)
- **Environment**: jsdom

### Emulator Tests
- **Purpose**: Test Firebase interactions with local emulator
- **Location**: TBD
- **Config**: `vitest.emulator.config.js`
- **Run**: `npm run test:emulator`
- **Environment**: Firebase emulator suite
- **Prerequisites**: Firebase emulator must be running

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test File

```bash
npm test -- path/to/test.test.js
```

### Emulator Tests Only

```bash
npm run emulators:exec -- "npm run test:emulator"
```

### Watch Mode

```bash
npm test -- --watch
```

## Writing Tests

### Where to Put Tests

- **Pure function tests**: `/tests/unit/`
- **Component tests**: `/src/tests/components/`
- **Integration tests**: `/src/tests/integration/`
- **Emulator tests**: `/tests/emulator/`

### Test Requirements Before Commit

- All existing tests must pass
- New features require tests
- Bug fixes should include regression tests

## CI/CD

Tests run automatically on:

- Every push to any branch
- Every pull request
- Before deployment

See `.github/workflows/` for CI configuration.

```

---

## 🚀 Quick Wins (Prioritized Action Plan)

These are low-effort, high-impact improvements to tackle first:

### Phase 1: Immediate (< 1 hour)
1. ✅ **Delete `.eslintrc.json`** - Keep only `.eslintrc.cjs`
2. ✅ **Move debug scripts** - Create `.debugScripts/` and move all `debug_*.js` files
3. ✅ **Add Firebase exports to `.gitignore`** - Pattern: `firebase-export-*/`

### Phase 2: Documentation Foundation (2-3 hours)
4. ✅ **Create `/docs/INDEX.md`** - Navigation hub for all documentation
5. ✅ **Create `/docs/CONTRIBUTING.md`** - Contribution guidelines
6. ✅ **Create `/docs/TESTING.md`** - Testing strategy and organization
7. ✅ **Add monorepo overview to README** - High-level architecture section

### Phase 3: Organization (2-4 hours)
8. ✅ **Create `/docs/SCRIPTS.md`** - Document all npm scripts by category
9. ✅ **Create `/MONOREPO.md`** - Document subsystem structure
10. ✅ **Organize docs into categories** - Create `/docs/guides/`, `/docs/architecture/`, etc.

---

## 📊 Impact Assessment

| Category | Before | After | Benefit |
|----------|--------|-------|---------|
| **Documentation** | Fragmented, hard to navigate | Organized, indexed | Easy onboarding |
| **Root Directory** | 25+ files, cluttered | Clean, organized | Professional appearance |
| **Developer Experience** | Confusion, trial & error | Clear guidance | Faster development |
| **Contribution** | No guidelines | Clear process | External contributions |
| **Testing** | Unclear strategy | Documented approach | Test coverage |
| **AI Agent Compatibility** | Struggles to find context | Clear navigation | Better assistance |

---

## 💡 Future Considerations (Beyond Quick Wins)

These are more involved improvements to consider later:

1. **Migrate to npm workspaces** - True monorepo structure
2. **Consolidate test directories** - Single `/tests` directory
3. **Move configs to `/config` folder** - Cleaner root (if desired)
4. **Extract script definitions** - Separate JSON files by category
5. **Add architecture diagrams** - Visual documentation
6. **Set up automated documentation** - TypeDoc, Storybook, etc.
7. **Review and archive old audit documents** - Keep history organized
8. **Dependency audit** - Check for outdated or unused packages
9. **Performance budget documentation** - Build size, bundle analysis
10. **Security documentation** - Authentication, authorization patterns

---

## 📝 Notes

- This audit focuses on **structure and organization**, not code implementation
- All recommendations are **non-breaking** or easy to reverse
- Priority is on **developer experience** and **maintainability**
- Changes support **AI agent compatibility** by improving navigation
- Focus on **quick wins** first, then iterate

---

## 🔗 Related Documents

- [Developer Guide](../DEVELOPER_GUIDE.md)
- [Project Schema](../PROJECT_SCHEMA.md)
- [Agents Documentation](../AGENTS.md)
- [Trade Machine Audit](../TRADE_MACHINE_AUDIT.md)

---

**Last Updated**: February 12, 2026
**Next Review**: Q3 2026 or after major structural changes
