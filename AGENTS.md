# AGENTS.md – HoopZero/ScoutZero AI Instructions

# CRITICAL NON-NEGOTIABLE RULES (READ FIRST)

For EVERY non-trivial task, you MUST follow these rules:

1. **TEMPORARY WORK ALWAYS GOES IN `plans/<slug>/temp/`**:
   - All scratch, experiments, drafts, and temporary scripts/files MUST be created under `plans/<slug>/temp/`.
   - NEVER leave temp files in `src/`, `data/`, `tools/`, or `tests/`.
   - When plan is completed, delete entire `plans/<slug>/temp/` directory.
   - **📖 See `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md` for complete decision tree**

2. **PLAN RULES (single vs multi-step vs large)**:
   - Single-step tasks → no plan mode.
   - Multi-step tasks → use plan mode with `plan.md` (no chunks unless the work is large).
   - Large/multi-phase work (cross-feature refactors, migrations, multi-day efforts) → plan mode **with** chunks.
   - Default to plan mode if unsure; add chunks only when scope clearly meets “large.”
   - **📖 See `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md` for thresholds**
   - **📖 See `docs/workspace-rules/WORKFLOW_CHECKLIST.md` for execution steps**

3. **ASK BEFORE GUESSING STRUCTURE**:
   - If you are unsure where new files should live, ASK the user.
   - Do NOT invent new top-level folders without explicit confirmation.
   - See `docs/workspace-rules/COMMUNICATION_RULES.md` for when to ask vs. decide.

4. **UPDATE STATE AFTER EXECUTION (WHEN USING PLAN MODE)**:
   - If plan mode is used:
     - Update chunk `STATE`/`ERROR_LOG` (if chunks exist)
     - Update plan `CURRENT_STATE` and `CHUNK_INDEX`
   - Always update documentation for significant changes - see `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md`.

5. **ARCHIVE COMPLETED PLANS**:
   - When a plan is complete and temp/drafts are deleted, move the entire plan folder to `plans/_archive/<slug>/` (keep templates in `_templates/`).
   - Plans remain tracked in git; only temp/draft folders are removed.

---

## WHEN USING CURSOR'S PLAN MODE

Use plan mode for any multi-step task; skip it for single-step work. Add chunks only when the plan is large/multi-phase (cross-feature refactors, migrations, multi-day efforts).

When you are operating in **Cursor's Plan Mode**, you MUST:

1. **FIRST, read these workflow documents at the start**:
   - `docs/workspace-rules/WORKFLOW_CHECKLIST.md` - Complete step-by-step execution process
   - `docs/workspace-rules/FILE_PLACEMENT_GUIDE.md` - Decision tree for file placement
   - `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md` - When to use plans vs simple edits

2. **Then follow the workflow exactly as specified in `WORKFLOW_CHECKLIST.md`**
   - The checklist is your single source of truth for execution steps
   - Update progress in `plan.md` as you complete each step
   - Follow the file placement rules from `FILE_PLACEMENT_GUIDE.md`

3. **The user expects you to execute the plan, not just discuss it**
   - Plan Mode means: read the instructions, execute them, track progress
   - If something is unclear about project direction/requirements, ask
   - If it's a technical decision, make it independently and document it

---

## 0.1 PRE-EXECUTION SELF-CHECK

Before you start planning or editing for any non-trivial request, you MUST:

1. **Explicitly answer these questions in your own words**:
   - Is this single-step (no plan) or multi-step (plan mode)? If multi-step, what is the plan slug?
   - Is it “large” (cross-feature refactor/migration/multi-day)? If yes, chunks are required.
   - Where should I put temporary/scratch files for this task? → `plans/<slug>/temp/`
   - Which permanent folders (`src/`, `data/`, `tools/`, `docs/`, `tests/`) will be affected?

2. **If you cannot answer any of these clearly, you MUST**:
   - Open `AGENTS.md` and re-read the NON-NEGOTIABLES section
   - Check `docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md` to determine if plan mode is needed
   - Ask the user for clarification if still unclear

**Rule of thumb**: Large = cross-feature refactors, schema migrations, or multi-day execution. Multi-step but not large = plan without chunks. Single-step = no plan.

**This self-check ensures you follow the workspace, plan, and file placement rules before starting work.**

---

## Project Overview

HoopZero is a public-facing NBA scouting platform. It displays player bios, stats, roles, contracts, and grades using a clean layout. All player data is loaded from Firebase Firestore using a **hierarchical player structure with subcollections** (not flattened documents).

This is the read-only counterpart to **ScoutZero**, an internal grading tool used to assign player attributes and evaluations.  
Agents should **never write to Firestore** or attempt to save data — only read.

---

## Coding Conventions

- Framework: **React + Vite + Firebase**
- Backend: **Firestore** (hierarchical player documents in `players_v2` collection)
- Style: **Tailwind CSS** with utility classes
- Imports: Use alias paths (e.g., `@/components/...`)
- File Format: **Named exports** preferred; default exports only for top-level views
- **TypeScript vs JavaScript**:
  - **New files should use TypeScript** (`.ts` for utilities, `.tsx` for React components)
  - The project is migrating from JavaScript to TypeScript - existing `.js`/`.jsx` files are legacy
  - When creating new files, prefer `.ts`/`.tsx` unless there's a specific reason to use JavaScript
  - When modifying existing `.js`/`.jsx` files, consider migrating to TypeScript if making significant changes

---

## File Structure

Project follows a **feature-first structure** with scoped utility and component folders:

```
src/
components/     Shared UI + wrappers
features/      Domain features (table, profile, roster, lists, filters, tierMaker)
hooks/         Custom React hooks for Firebase + filtering
pages/         Route-level views
utils/         Helpers for filtering, formatting, roster logic
constants/     Role lists, badge sets, etc.
firebase/      Firestore helpers + config
schemas/       Canonical Zod schemas for Firestore collections
styles/        Tailwind and additional styles
```

- New code should be grouped by **feature** where possible
- Reusable UI or logic goes in `shared/`, `hooks/`, or `utils/`

### Per-Feature Structure and Documentation Requirements

**CRITICAL**: When creating a NEW feature, tool, or data module, you MUST:

1. **CREATE A FOLDER-LEVEL README**:
   - For features: `src/features/<featureSlug>/README.md` (or `src/architect/<featureSlug>/README.md` for Architect-specific)
   - For tools: `tools/<toolSlug>/README.md`
   - For data modules: `data/<area>/README.md`
   - Each README must document: PURPOSE, ENTRY POINTS, STRUCTURE, and LINKS to relevant plans/docs

2. **USE INDEX-BASED STRUCTURE FOR COMPOSED COMPONENTS**:
   - Create `index.tsx` (or `index.ts`/`index.jsx`) at feature root that exports main component
   - Place subcomponents in subfolders with their own `index.tsx`
   - Keep hierarchy consistent with visual/logic composition (parent components above children in folder depth)

3. **ALWAYS ADD FILE HEADERS FOR NEW OR SIGNIFICANTLY MODIFIED FILES**:
   - For all new files in `src/`, `data/`, and `tools/`
   - Use `docs/templates/file_header.template.txt`
   - Fill in: FILE, PURPOSE, OWNERSHIP, HISTORY, LINKS
   - **If unsure about PURPOSE or OWNERSHIP, ASK the user** instead of guessing

📄 See `docs/workspace-rules/CREATING_PERMANENT_DOCS.md` for detailed guidance on folder-level READMEs, index-based structure, and file headers.

---

## Communication and Decision-Making Rules

**CRITICAL: Ask Questions, Don't Assume**

- **Project Direction & Requirements**: Ask clarifying questions rather than assume intent
  - User does not have coding experience - they cannot make technical decisions
  - User expects many questions to clarify project direction and exact requirements
  - Build plans with extreme detail before execution - confidence that it will build exactly what's wanted
  - If something is unclear about what they want, ask rather than guess
- **Technical Decisions**: Make these independently
  - Code patterns, types, frameworks, architecture choices
  - File structure, naming conventions, implementation details
  - User has no opinion on technical matters - these are agent decisions

**Plan Mode Philosophy**: Build plans with so much detail and clarity that execution is straightforward and results match expectations exactly.

## Task Rules for Agents

- ✅ Refactors should preserve **visual layout and logic**
- ✅ Break large components (>200 lines) into **clean subcomponents**
- ✅ Keep **logic and layout separated** where appropriate
- ✅ Use **smart, readable file naming** (`TraitGradesBlock.jsx`, `AddPlayerDrawer.jsx`, etc.)
- ✅ Preserve modals, filters, blurbs, and Firestore reads
- ✅ Leave the worktree **clean** (`git status` should show no changes)
- ✅ **Update documentation automatically** - See `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` for mandatory documentation updates
  - **Keep PROJECT_SCHEMA.md in sync** when adding directories, scripts, or changing artifact paths
  - **Run `npm run schema:generate`** when modifying Zod schemas in `src/schemas/`
  - **Run `npm run docs`** when adding/modifying React components
  - **Update DEVELOPER_GUIDE.md** when feature structure changes
  - Documentation updates are **mandatory** - never leave docs out of date
- ✅ Run `npm run validate:project` to verify structural changes don't break schema
- ❌ Never create new branches
- ❌ Never amend or squash existing commits

---

## Firestore Data Source Rules

This project uses **two main Firestore collections** for player/team data:

| Collection    | Used For                                                           | Structure                        |
| ------------- | ------------------------------------------------------------------ | -------------------------------- |
| `/players_v2` | Player bio, contracts, seasons, evaluations                        | Hierarchical with subcollections |
| `/teams`      | Team rosters, cap sheets (currently in migration to `/architect/`) | Flattened structure              |

### Current Data Access Patterns

**For `/players_v2` (hierarchical structure):**

```javascript
// Access player bio data
const player = await getDoc(doc(db, 'players_v2', playerId));
const displayName = player.data().bio.displayName;
const age = player.data().bio.age;
const position = player.data().bio.position;

// Access contract subcollection
const contracts = await getDocs(
  collection(doc(db, 'players_v2', playerId), 'contracts')
);

// Access season stats subcollection
const seasons = await getDocs(
  collection(doc(db, 'players_v2', playerId), 'seasons')
);
```

**For `/teams` (current structure during migration):**

```javascript
// Access team roster data
const team = await getDoc(doc(db, 'teams', teamId));
const players = team.data().capSheet.players; // Array of flattened player objects
```

### Migration Context

- **`/players_v2`**: Migration complete - use hierarchical access patterns
- **`/teams`**: Currently migrating to `/architect/` collections - see `docs/schema/architect.md` for target schema
- **Legacy `/players`**: Preserved for rollback, do not use for new code

📄 Reference `docs/schema/CURRENT_FIRESTORE_SCHEMA.md` for current schema status  
📄 See `docs/schema/architect.md` for architect collection schema  
📄 See `docs/ARCHITECT_PLAN_INDEX.md` for complete Architect feature documentation

---

## Firebase Rules

- All data is **read-only from Firestore**
- Main collections:
  - `players_v2`: hierarchical player docs with bio, contracts, seasons, evaluations subcollections
  - `teams`: team rosters + `capSheet.players[]` with `contract_clean` (migrating to `/architect/`)

⚠️ Do not modify Firestore read logic without validating against `src/shared/hooks/useSimplePlayerData.ts` (primary list hook), `src/shared/hooks/usePlayerDetail.js` (full player doc + subcollections), and Firebase helpers (`src/data/firestorePaths.js`). `usePlayerData.ts` is a diagnostics wrapper over `useSimplePlayerData`—prefer the base hook unless diagnostics are required.

---

## Schema Rules

- Canonical source: `src/schemas/` (Zod-based code-first schemas)
- Generated docs: `docs/schema/` (auto-generated from schemas)
- Do not declare duplicate `Player*` or `Contract*` interfaces outside `src/schemas/`

📄 See `docs/schema/players_v2.md` for players_v2 structure  
📄 See `docs/schema/architect.md` for architect collections

---

## PR Guidelines

- Start PR titles with a **clear summary** (e.g., `refactor: split PlayerProfileView`)
- Include a **bullet summary** of changes
- Cite file paths using `【F:path†L#】` format
- Skip descriptions for unchanged UI unless relevant

---

## Documentation References

This project includes **generated docs** for navigation:

- **Component hierarchies**: `docs/ArchitectHierarchy.md`, `docs/FiltersHierarchy.md`, etc.
- **Schema documentation**: `docs/schema/` for all Firestore collections
- **Current schema**: `docs/schema/CURRENT_FIRESTORE_SCHEMA.md` for active collections

### Refresh Documentation

```bash
npm run docs          # Generate component hierarchies
npm run schema:generate  # Generate schema docs from Zod sources
```

---

## Custom Cursor Commands

This project includes custom Cursor commands for structured code review, explanation, and cleanup workflows.

### Command Overview

The commands are located in `.cursor/commands/` and reference detailed prompt instructions in `docs/cursor-prompts/`:

| Command           | Purpose                                                          | Prompt File                                  |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| `/explain`        | Explain selected code in plain English without changing anything | `docs/cursor-prompts/ExplainPrompt.md`       |
| `/audit`          | Run the Apex Audit on selected files, folders, or full codebase  | `docs/cursor-prompts/ApexAuditPrompt.md`     |
| `/audit-review`   | Review an existing audit and build a structured Fix Plan         | `docs/cursor-prompts/AuditReviewPrompt.md`   |
| `/apply-critical` | Apply Critical SAFE_AUTO fixes from a Fix Plan                   | `docs/cursor-prompts/ApplyCriticalPrompt.md` |
| `/fix-all`        | Apply all appropriate fixes from a Fix Plan                      | `docs/cursor-prompts/FixAllPrompt.md`        |
| `/doc-sync`       | Update docs and comments to match current code behavior          | `docs/cursor-prompts/DocSyncPrompt.md`       |
| `/cleanup`        | Safely clean up and refactor code without changing behavior      | `docs/cursor-prompts/CleanupPrompt.md`       |

### Typical Workflow

1. **`/explain`** → Understand code before making changes
2. **`/audit`** → Identify issues in code
3. **`/audit-review`** → Review audit findings and create a Fix Plan
4. **`/apply-critical`** or **`/fix-all`** → Apply fixes from the Fix Plan
5. **`/doc-sync`** → Keep documentation in sync with code changes
6. **`/cleanup`** → Safe refactoring and hygiene improvements

### Command Structure

Each command file in `.cursor/commands/` contains:

- Command metadata (name, description)
- High-level instructions
- Reference to the detailed prompt in `docs/cursor-prompts/`

The detailed prompt files in `docs/cursor-prompts/` contain the complete instructions that agents should follow when executing the command.

---

## Other Notes

- `DEVELOPER_GUIDE.md` → detailed file structure, key files, and component logic
- `README.md` → setup instructions
- `docs/schema/architect.md` → architect collection schema
- Use `/features/profile/` and `/features/lists/` as **structural examples**
