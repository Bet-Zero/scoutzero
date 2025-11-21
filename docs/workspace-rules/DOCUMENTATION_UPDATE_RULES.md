# Documentation Update Rules

**CRITICAL**: Documentation updates are **mandatory** for significant changes - never leave documentation out of date.

## The Rule

**Chunk completion MUST update relevant documentation when changes are significant.** Documentation updates are not optional for structural, schema, or feature changes.

## When Documentation Updates Are Required

**Documentation updates are REQUIRED when:**

- ✅ **Structural changes** - Added/removed directories, new scripts, renamed files
- ✅ **Schema changes** - Modified Zod schemas, changed Firestore structure
- ✅ **Component/feature changes** - New features, new components, changed component relationships
- ✅ **API/contract changes** - Changed function signatures, data structures, Firestore paths
- ✅ **Script/tool changes** - New CLI tools, changed script interfaces
- ✅ **Plan/chunk work** - Always update plan and chunk files (tracking)

**Documentation updates can be SKIPPED for:**

- ❌ **Bug fixes** - Fixing typos, correcting logic errors, fixing CSS
- ❌ **Refactoring** - Code cleanup, renaming variables, improving readability (unless structure changes)
- ❌ **Minor tweaks** - Small UI adjustments, text changes, styling updates
- ❌ **Configuration** - Changing environment variables, updating dependencies (unless it affects structure)

**When in doubt, update documentation.** It's better to have slightly over-documented than under-documented.

## Documentation Update Checklist

When completing a chunk, check what changed and update accordingly:

### 1. Structural Changes (Directories, Files, Scripts)

**If you added/removed/renamed directories or scripts:**

- [ ] **Update `PROJECT_SCHEMA.md`**
  - Add new directories to "Repo Layout" section
  - Update "Key Subdirectories" if structure changed
  - Update "Naming Conventions" if patterns changed
  - Update "Script Interfaces" if scripts changed
  - Run `npm run validate:project` to verify schema is valid

**Example triggers:**

- New feature directory (`src/features/newFeature/`)
- New script directory (`scripts/newTool/`)
- New data directory (`data/newCollection/`)
- Renamed directories or files

### 2. Schema Changes (Zod Schemas, Firestore Structure)

**If you modified `src/schemas/*.ts` files:**

- [ ] **Run `npm run schema:generate`**
  - Auto-generates `docs/schema/*.md` files
  - Updates schema documentation from Zod sources
  - **DO NOT manually edit generated schema docs** - they are auto-generated

**Example triggers:**

- Added/modified Zod schemas in `src/schemas/`
- Changed Firestore document structure
- Added new fields to existing schemas

### 3. Component Changes (React Components, Features)

**If you added/modified React components or features:**

- [ ] **Run `npm run docs`**
  - Auto-generates component hierarchy docs in `docs/components/`
  - Updates component maps and relationships
  - **DO NOT manually edit generated component docs** - they are auto-generated

- [ ] **Update `DEVELOPER_GUIDE.md`** (if feature structure changed)
  - Add new features to "Folder Structure" section
  - Update "src/features/" descriptions
  - Document new hooks, utils, or patterns

**Example triggers:**

- New feature directory (`src/features/newFeature/`)
- New components in existing features
- New hooks or utilities
- Changed component relationships

### 4. Feature-Specific Documentation

**If you created/modified a feature:**

- [ ] **Create or update feature README** (if feature is substantial)
  - **Location**: `src/features/<feature>/README.md`
  - **When to create**: New major features, significant refactors, or features with complex logic
  - **What to include**:
    - Purpose and overview of the feature
    - Key components and their roles
    - Usage patterns and examples
    - Public APIs/hooks exported
    - Links to related documentation
  - **Example**: See `src/features/architect/ARCHITECT_FEATURE_README.md` for reference

- [ ] **Create API documentation** (if feature exposes public APIs)
  - **Location**: `docs/api/<feature>.md` or in feature README
  - **When to create**: Features with hooks, utilities, or functions used by other features
  - **What to include**: Function signatures, parameters, return values, examples

- [ ] **Create user guide** (if feature has user-facing functionality)
  - **Location**: `docs/guides/<feature>.md`
  - **When to create**: Features with complex user workflows or non-obvious functionality
  - **What to include**: Step-by-step usage instructions, examples, common workflows

**Example triggers:**

- New major feature → Create feature README
- Significant feature refactor → Update feature README
- New public APIs or hooks → Document in feature README or `docs/api/`
- Complex user workflows → Create user guide in `docs/guides/`

### 5. Plan Documentation

**Always (part of chunk completion):**

- [ ] **Update chunk file** (`plans/<planSlug>/chunks/chunk_XX.md`)
  - Mark tasks complete
  - Update STATE section
  - Document any decisions in NOTES

- [ ] **Update plan file** (`plans/<planSlug>/plan.md`)
  - Update CHUNK_INDEX status
  - Update CURRENT_STATE
  - Add to REVISION_LOG if significant

### 6. API/Contract Changes

**If you changed data contracts, APIs, or interfaces:**

- [ ] **Update relevant schema docs** (via `npm run schema:generate`)
- [ ] **Update `PROJECT_SCHEMA.md`** "Data Contracts" section
- [ ] **Update feature README** if API changed

**Example triggers:**

- Changed function signatures
- Changed data structures
- Changed Firestore paths or collections

### 7. Script/Tool Changes

**If you added/modified scripts or tools:**

- [ ] **Update `PROJECT_SCHEMA.md`** "Script Interfaces" section
- [ ] **Create/update script README** (`<scriptDir>/README.md`)
  - **Location**: `<scriptDir>/README.md` (e.g., `scripts/newTool/README.md`)
  - **When to create**: **ALL** new scripts/tools should have README
  - **What to include**:
    - Purpose and what the script does
    - Usage instructions with examples
    - Required parameters and options
    - Output format and location
    - Dependencies and prerequisites
    - Common use cases

**Example triggers:**

- New CLI scripts → **CREATE** script README
- Changed script interfaces → Update script README
- New tooling utilities → **CREATE** tool README

## Quick Reference: What Changed → What to Update/Create

| What Changed                 | Documentation to Update/Create                                      |
| ---------------------------- | ------------------------------------------------------------------- |
| Directory structure          | `PROJECT_SCHEMA.md`                                                 |
| Zod schemas (`src/schemas/`) | Run `npm run schema:generate`                                       |
| React components             | Run `npm run docs`, update `DEVELOPER_GUIDE.md`                     |
| New major feature            | `DEVELOPER_GUIDE.md`, **CREATE** `src/features/<feature>/README.md` (with PURPOSE, ENTRY POINTS, STRUCTURE), **ADD** file headers to all new files |
| Feature with public APIs     | Feature README + **CREATE** API docs if needed                      |
| Feature with user workflows  | Feature README + **CREATE** `docs/guides/<feature>.md` if needed    |
| Scripts/tools                | `PROJECT_SCHEMA.md`, **CREATE** `<scriptDir>/README.md` (with PURPOSE, ENTRY POINTS, STRUCTURE), **ADD** file headers to all new files |
| Data modules                 | `PROJECT_SCHEMA.md`, **CREATE** `data/<area>/README.md` (with PURPOSE, ENTRY POINTS, STRUCTURE), **ADD** file headers to all new files |
| Data contracts               | `PROJECT_SCHEMA.md`, schema docs                                    |
| Plan/chunk work              | Plan file, chunk file                                               |
| New/significantly modified files | **ADD** file headers using `docs/templates/file_header.template.txt` |

## Auto-Generated Documentation

**These are auto-generated - DO NOT manually edit:**

- `docs/schema/*.md` (generated by `npm run schema:generate`)
- `docs/components/*.md` (generated by `npm run docs`)

**These are manual - MUST update when relevant:**

- `PROJECT_SCHEMA.md` (structure, scripts, conventions)
- `DEVELOPER_GUIDE.md` (features, components, patterns)
- `AGENTS.md` (project rules - rarely changes)
- Feature READMEs (feature-specific docs)
- Plan files (`plans/<planSlug>/plan.md` and chunks)

## Verification Commands

After updating documentation:

```bash
# Verify PROJECT_SCHEMA.md is valid
npm run validate:project

# Verify schema docs are up to date
npm run schema:check

# Regenerate component docs (if components changed)
npm run docs
```

## Creating New Permanent Documentation

**CRITICAL**: When adding new features, scripts, or tools, you MUST create permanent documentation files.

**See `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` for detailed guidance on:**

- When to create feature READMEs
- When to create script READMEs
- When to create API docs or user guides
- What to include in each type of documentation

**Quick checklist:**

- New major feature → Create `src/features/<feature>/README.md`
- New script/tool → Create `<scriptDir>/README.md`
- Feature with public APIs → Document in feature README or `docs/api/`
- Feature with complex workflows → Create `docs/guides/<feature>.md`

## Integration with Chunk Completion

**Documentation updates are part of the chunk completion checklist:**

1. Complete all tasks
2. **Assess if documentation updates are needed** (see "When Documentation Updates Are Required" above)
3. **Create new permanent documentation** (if adding features/scripts - see `CREATING_PERMANENT_DOCS.md`)
4. **If significant changes**: Update existing documentation (this checklist)
5. Run verification commands (if documentation updated)
6. Mark chunk as completed
7. Update plan state

**For significant changes**: Never mark a chunk as "completed" without updating documentation.

**For new features/scripts**: Never mark a chunk as "completed" without creating permanent documentation files.

**For minor changes**: Document that documentation update was skipped and why (e.g., "Documentation: Skipped - bug fix only, no structural changes").

## Examples

### Example 1: Added New Feature

**What changed:** Created `src/features/newFeature/` with components

**Documentation updates:**

- [x] Run `npm run docs` (component hierarchies)
- [x] Update `DEVELOPER_GUIDE.md` (add feature to structure)
- [x] Create `src/features/newFeature/README.md` (feature docs)
- [x] Update plan/chunk files (mark complete)

### Example 2: Modified Schema

**What changed:** Added new field to `PlayerBioZ` in `src/schemas/players_v2.ts`

**Documentation updates:**

- [x] Run `npm run schema:generate` (update schema docs)
- [x] Update plan/chunk files (mark complete)

### Example 3: Added New Script

**What changed:** Created `scripts/newTool/process_data.ts`

**Documentation updates:**

- [x] Update `PROJECT_SCHEMA.md` (add script to structure)
- [x] Create `scripts/newTool/README.md` (usage docs)
- [x] Update plan/chunk files (mark complete)

---

**Remember**: Documentation is not "nice to have" - it's part of the work. If you changed something, document it.
