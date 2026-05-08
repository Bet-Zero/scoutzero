# Creating Permanent Documentation

**CRITICAL**: When adding new features, scripts, or tools, you MUST create permanent documentation files. Temporary docs go in workspace, but permanent docs belong in `docs/`, feature directories, or script directories.

## When to Create Permanent Documentation

### Always Create Documentation For

1. **New Major Features** → `src/features/<feature>/README.md`
2. **New Scripts/Tools** → `<scriptDir>/README.md`
3. **New Public APIs** → Feature README or `docs/api/<feature>.md`
4. **Complex User Workflows** → `docs/guides/<feature>.md`

### Documentation Types

## 1. Feature README (`src/features/<feature>/README.md`)

**When to create:**

- **ALL** new feature directories (mandatory)
- New major feature directory
- Significant feature refactor that changes architecture
- Feature with complex logic or multiple components

**Path rules:**

- For features: `src/features/<featureSlug>/README.md`
- For Architect-specific features: `src/architect/<featureSlug>/README.md` (if using separate architect folder)

**What to include:**

```markdown
# Feature Name

## Purpose
What this folder is responsible for and why it exists.

## Entry Points
Main components or scripts that serve as entry points:
- `index.tsx` - Main component export
- `FeatureView.tsx` - Primary view component
- `hooks/useFeature.ts` - Main hook

## Structure
Subfolders and what they contain:
- `components/` - UI components specific to this feature
- `hooks/` - Custom hooks for this feature
- `utils/` - Utility functions
- `types.ts` - TypeScript types/interfaces

## Key Components
- ComponentName - What it does
- AnotherComponent - What it does

## Usage
How to use this feature in the app.

## Public APIs
If the feature exports hooks, utilities, or functions:
- `useFeatureHook()` - Description
- `featureUtility()` - Description

## Related Documentation
- Links to relevant plan and chunk files: `plans/<planSlug>/plan.md`
- Links to docs under `docs/`
- Links to related schemas or guides
```

**Example**: See `src/features/architect/ARCHITECT_FEATURE_README.md`

## 2. Script/Tool README (`<scriptDir>/README.md`)

**When to create:**

- **ALL** new scripts or tools (mandatory)
- Even simple scripts should have basic README

**Path rules:**

- For tools: `tools/<toolSlug>/README.md`
- For scripts: `<scriptDir>/README.md` (e.g., `player-scrape/contracts/README.md`)

**What to include:**

```markdown
# Script/Tool Name

## Purpose
What this folder is responsible for and what the script/tool does.

## Entry Points
Main scripts that serve as entry points:
- `scripts/main.ts` - Primary CLI script
- `scripts/helper.ts` - Supporting script

## Structure
Subfolders and what they contain:
- `scripts/` - Executable scripts
- `output/` - Generated output files
- `docs/` - Script-specific documentation

## Usage
```bash
npm run script-name [options]
# or
npx tsx scripts/main.ts [options]
```

## Parameters

- `--param` - Description
- `--flag` - Description

## Output

Where output goes and what format it's in.

## Examples

```bash
# Example 1
npm run script-name --param value

# Example 2
npm run script-name --flag
```

## Related Documentation

- Links to relevant plan and chunk files: `plans/<planSlug>/plan.md`
- Links to docs under `docs/`

## 3. API Documentation (`docs/api/<feature>.md` or in feature README)

**When to create:**

- Feature exports hooks, utilities, or functions used by other features
- Complex APIs that need detailed documentation
- Public APIs that other developers will use

**What to include:**

- Function signatures
- Parameter descriptions
- Return value descriptions
- Usage examples
- Error handling

## 4. User Guides (`docs/guides/<feature>.md`)

**When to create:**

- Features with complex user workflows
- Features with non-obvious functionality
- Features that need step-by-step instructions

**What to include:**

- Step-by-step usage instructions
- Common workflows
- Examples and use cases
- Troubleshooting tips

## 3. Data Module README (`data/<area>/README.md`)

**When to create:**

- **ALL** new data modules (mandatory)
- New data processing areas
- Data modules with complex structure

**Path rules:**

- For data modules: `data/<area>/README.md`

**What to include:**

```markdown
# Data Module Name

## Purpose
What this folder is responsible for and what data it manages.

## Entry Points
Main scripts or utilities:
- `scripts/process.ts` - Data processing script
- `utils/transform.ts` - Data transformation utilities

## Structure
Subfolders and what they contain:
- `scripts/` - Data processing scripts
- `output/` - Processed data files
- `schemas/` - Data schemas/validators

## Data Format
Description of data structure and format.

## Related Documentation
- Links to relevant plan and chunk files: `plans/<planSlug>/plan.md`
- Links to schemas under `src/schemas/`
```

## 6. Index-Based Structure for Composed Components

**CRITICAL**: When creating a folder that owns subcomponents (feature root or complex component), you MUST:

1. **Create an index file** in that folder (`index.ts`, `index.tsx`, or `index.jsx`) that exports the main component
2. **Place subcomponents** in subfolders or sibling files as appropriate
3. **Keep hierarchy consistent** with visual/logic composition (parent components live above their children in folder depth)

**Example structure:**

```text
src/architect/tradeMachine/autoSuggest/
├── index.tsx                    # Exports main AutoSuggest entry
├── AutoSuggestModal/
│   ├── index.tsx               # Modal root component
│   ├── AutoSuggestPlayerRow.tsx
│   └── AutoSuggestFit.tsx
├── hooks/
│   └── useAutoSuggest.ts
└── utils/
    └── autoSuggestFilters.ts
```

**Rules:**

- Parent components export from `index.tsx` at their level
- Child components live in subfolders with their own `index.tsx`
- Keep folder depth aligned with component hierarchy

## 7. File Headers for New/Modified Files

**CRITICAL**: For all new or significantly modified files in `src/`, `data/`, and `tools/`, you MUST:

1. **Insert the standard file header** using `docs/templates/file_header.template.txt`
2. **Fill in all required fields:**
    - `FILE`: Relative path from repo root (e.g., `src/features/tradeMachine/AutoSuggest.tsx`)
    - `PURPOSE`: Short description of what this file does
    - `OWNERSHIP`: Feature or domain (e.g., `Feature: architect/tradeMachine` or `Tool: player-scrape/contracts`)
    - `HISTORY`: At least one entry referencing the plan and chunk
    - `LINKS`: Paths to the plan and latest chunk

**When to add headers:**

- ✅ **All new files** in `src/`, `data/`, `tools/`
- ✅ **Significantly modified files** (architecture changes, major refactors)
- ❌ **Minor changes** (bug fixes, small tweaks) - update HISTORY only if header exists

**If unsure about PURPOSE or OWNERSHIP:**

- **ASK the user** instead of guessing
- See `docs/standards/COMMUNICATION_RULES.md` for when to ask vs. decide

**Template location**: `docs/templates/file_header.template.txt`

## File Placement Rules

### Permanent Documentation Locations

- **Feature docs**: `src/features/<feature>/README.md` or `src/architect/<feature>/README.md`
- **Script docs**: `<scriptDir>/README.md` (e.g., `tools/<toolSlug>/README.md`)
- **Data module docs**: `data/<area>/README.md`
- **API docs**: `docs/api/<feature>.md` or in feature README
- **User guides**: `docs/guides/<feature>.md`
- **Schema docs**: Auto-generated via `npm run schema:generate` → `docs/reference/schema/`
- **Component docs**: Auto-generated via `npm run docs` → `docs/components/`

### Temporary Documentation (Workspace)

- **Interim notes**: `cursor_work/<slug>/temp/docs/`
- **Process notes**: `cursor_work/<slug>/temp/docs/`
- **"How I updated X"**: `cursor_work/<slug>/temp/docs/`

**Key difference**: Permanent docs are for users/developers to reference long-term. Temporary docs are for your own notes during development.

## Checklist for New Features

When creating a new feature, ensure you:

- [ ] **Create feature README** (`src/features/<feature>/README.md` or `src/architect/<feature>/README.md`)
  - Document PURPOSE (what folder is responsible for)
  - Document ENTRY POINTS (main components/scripts)
  - Document STRUCTURE (subfolders and contents)
  - Document key components, usage, public APIs
  - Link to relevant plan/chunk files and docs

- [ ] **Use index-based structure** (if feature has composed components)
  - Create `index.tsx` at feature root that exports main component
  - Place subcomponents in subfolders with their own `index.tsx`
  - Keep hierarchy consistent with visual/logic composition

- [ ] **Add file headers** to all new files
  - Use `docs/templates/file_header.template.txt`
  - Fill in FILE, PURPOSE, OWNERSHIP, HISTORY, LINKS
  - Ask user if unsure about PURPOSE or OWNERSHIP

- [ ] **Update `DEVELOPER_GUIDE.md`**
  - Add feature to folder structure
  - Document key patterns

- [ ] **Create API docs** (if feature has public APIs)
  - Either in feature README or `docs/api/<feature>.md`

- [ ] **Create user guide** (if feature has complex workflows)
  - `docs/guides/<feature>.md`

- [ ] **Run `npm run docs`** (for component hierarchies)

## Checklist for New Scripts/Tools

When creating a new script or tool:

- [ ] **Create script README** (`tools/<toolSlug>/README.md` or `<scriptDir>/README.md`)
  - Document PURPOSE (what folder is responsible for)
  - Document ENTRY POINTS (main scripts)
  - Document STRUCTURE (subfolders and contents)
  - Document usage, parameters, examples, output format
  - Link to relevant plan/chunk files and docs

- [ ] **Add file headers** to all new files
  - Use `docs/templates/file_header.template.txt`
  - Fill in FILE, PURPOSE, OWNERSHIP, HISTORY, LINKS
  - Ask user if unsure about PURPOSE or OWNERSHIP

- [ ] **Update `PROJECT_SCHEMA.md`**
  - Add script to "Script Interfaces" section

## Feature and Script Examples

### Example 1: New Feature

**What**: Created `src/features/tradeMachine/` with multiple components

**Documentation created:**

- ✅ `src/features/tradeMachine/README.md` (feature overview, components, APIs)
- ✅ Updated `DEVELOPER_GUIDE.md` (added to folder structure)
- ✅ `docs/guides/tradeMachine.md` (user guide for complex workflows)
- ✅ Ran `npm run docs` (component hierarchies)

**Temporary docs** (in workspace):

- ❌ `cursor_work/trade-machine/temp/docs/implementation_notes.md` (deleted when done)

### Example 2: New Script

**What**: Created `scripts/data-processor/process_players.ts`

**Documentation created:**

- ✅ `scripts/data-processor/README.md` (usage, parameters, examples)
- ✅ Updated `PROJECT_SCHEMA.md` (added to script interfaces)

**Temporary docs** (in workspace):

- ❌ `cursor_work/data-processor/temp/docs/test_results.md` (deleted when done)

## Checklist for New Data Modules

When creating a new data module:

- [ ] **Create data module README** (`data/<area>/README.md`)
  - Document PURPOSE (what folder is responsible for)
  - Document ENTRY POINTS (main scripts/utilities)
  - Document STRUCTURE (subfolders and contents)
  - Document data format and structure
  - Link to relevant plan/chunk files and schemas

- [ ] **Add file headers** to all new files
  - Use `docs/templates/file_header.template.txt`
  - Fill in FILE, PURPOSE, OWNERSHIP, HISTORY, LINKS
  - Ask user if unsure about PURPOSE or OWNERSHIP

- [ ] **Update `PROJECT_SCHEMA.md`**
  - Add data module to structure documentation

## Summary

**Permanent documentation** = Files that users/developers will reference long-term

- Feature READMEs (with PURPOSE, ENTRY POINTS, STRUCTURE)
- Script/Tool READMEs (with PURPOSE, ENTRY POINTS, STRUCTURE)
- Data module READMEs (with PURPOSE, ENTRY POINTS, STRUCTURE)
- API docs
- User guides
- File headers (for all new/significantly modified files)

**Temporary documentation** = Files for your own notes during development

- Implementation notes
- Process notes
- Test results

**Structure requirements:**

- Index-based structure for composed components
- Folder-level READMEs for all features, tools, and data modules
- File headers for all new files in `src/`, `data/`, `tools/`

**Rule**: If someone else (or future you) will need to reference it, it's permanent. If it's just notes for yourself during development, it's temporary.

### Before creating any file, ask: "Is this permanent or temporary?"

```text
Is this file meant to be permanent?
├─ YES → Is it production-ready?
│   ├─ YES → Save to permanent location (src/, data/, docs/, tools/, tests/)
│   └─ NO → Save to workspace drafts/ (will be moved or deleted)
└─ NO → Save to workspace temp/ (will be deleted)
```

### Design Principle: Design for Cleanup
