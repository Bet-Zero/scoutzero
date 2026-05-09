# Chunk XX — <TITLE>

## GOAL

Short paragraph describing what this chunk must accomplish.

## INPUTS

What this chunk depends on:

- Existing files

- Data artifacts

- Prior chunks

- Assumed project state

## OUTPUTS

What should exist or be true when this chunk is complete:

- New files

- Updated files

- Updated docs

- Generated data

## TASKS

- [ ] Step 1

- [ ] Step 2

- [ ] Step 3

## FILES_TO_TOUCH

**CRITICAL**: Only list files that will be PERMANENT in the repo. Temporary files go in workspace `temp/`.

**Permanent files** (will survive chunk completion):

- src/... (final code only)
- data/... (final data only)
- scripts/... (final scripts only)
- docs/... (final documentation only)

**Temporary files** (will be deleted when chunk completes):

- Test scripts → `work/<initiative>/temp/scripts/`
- One-time use scripts → `work/<initiative>/temp/scripts/`
- Interim documentation → `work/<initiative>/temp/docs/`
- Test outputs/results → `work/<initiative>/temp/output/`
- Experiments/prototypes → `work/<initiative>/drafts/`

## TEST_PLAN

How to verify this chunk is correct:

- [ ] Run command X

- [ ] Manually check Y page or behavior

- [ ] Confirm Z file contents or data shape

## DOCUMENTATION_UPDATES

**Required for significant changes only.** See `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` for when updates are needed.

**First, assess if documentation update is needed:**

- [ ] **Significant changes?** (structure, schemas, features, APIs, scripts) → Update documentation
- [ ] **Minor changes only?** (bug fixes, refactoring, tweaks) → Skip documentation, note reason below

**If significant changes, update accordingly:**

- [ ] **Structural changes** (directories, files, scripts) → Update `PROJECT_SCHEMA.md`
- [ ] **Schema changes** (`src/schemas/*.ts`) → Run `npm run schema:generate`
- [ ] **Component changes** (React components, features) → Run `npm run docs`, update `DEVELOPER_GUIDE.md`
- [ ] **Feature changes** → Update/create feature README (see `docs/workspace-rules/CREATING_PERMANENT_DOCS.md`)
- [ ] **New features** → **CREATE** `src/features/<feature>/README.md` (always for major features)
  - Include PURPOSE, ENTRY POINTS, STRUCTURE sections
  - Use index-based structure for composed components
  - Add file headers to all new files
- [ ] **Script/tool changes** → Update `PROJECT_SCHEMA.md`, **CREATE/UPDATE** script README (always for new scripts)
  - Include PURPOSE, ENTRY POINTS, STRUCTURE sections
  - Add file headers to all new files
- [ ] **Data module changes** → **CREATE** `data/<area>/README.md` (always for new data modules)
  - Include PURPOSE, ENTRY POINTS, STRUCTURE sections
  - Add file headers to all new files
- [ ] **New/significantly modified files** → Add file headers using `docs/templates/file_header.template.txt`
  - Fill in FILE, PURPOSE, OWNERSHIP, HISTORY, LINKS
  - Ask user if unsure about PURPOSE or OWNERSHIP
- [ ] **Plan/chunk work** → Update plan file and chunk file (always)

**Verification (if documentation updated):**

- [ ] Run `npm run validate:project` (if structure changed)
- [ ] Run `npm run schema:check` (if schemas changed)

**If skipped, note reason:** [e.g., "Bug fix only - no structural changes"]

## STATE

status: not_started | in_progress | blocked | completed

lastRun: never

lastResult: n/a

nextAction: Describe the next action for this chunk in one short sentence.

## ERROR_LOG

(Only add entries here if a build/run failed.)

- <date>: <what failed, error summary, suspected cause, decision taken>

## WORKSPACE

**Design for cleanup**: When creating files, ask:

- Is this file meant to be permanent? → Save to `src/`, `data/`, `docs/`, `scripts/`, or `tests/`
- Is this temporary (test script, one-time use, interim doc)? → Save to `work/<initiative>/temp/`
- Is this an experiment? → Save to `work/<initiative>/drafts/`

Only files in permanent locations will survive chunk completion. Everything in workspace `temp/` and `drafts/` will be deleted.

If needed, use workspace: `cursor_work/<chunk-slug>/`

## NOTES / DECISIONS

Important choices made during this chunk that future work should know about.
