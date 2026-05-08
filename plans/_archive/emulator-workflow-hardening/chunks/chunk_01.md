# Chunk 01 — Zero-hassle emulator workflow

## GOAL

Implement a robust emulator workflow that auto-frees ports, persists data, and seeds base data only when missing, with safety guards.

## INPUTS

- firebase.json
- package.json
- docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
- docs/templates/file_header.template.txt

## OUTPUTS

- New emulator scripts in scripts/emu
- Updated npm scripts, firebase emulator config, and gitignore
- Emulator data README
- Updated master plan and return package
- Validation logs from build and emulator runs

## TASKS

- [x] Create emulator runner and seed-if-missing scripts with safety checks
- [x] Add scripts README and emulator data README
- [x] Wire npm scripts and firebase.json ports; update .gitignore
- [x] Update PST master plan and return package documentation
- [x] Run build + emulator validation steps

## FILES_TO_TOUCH

**Permanent files** (will survive chunk completion):

- scripts/emu/runEmu.ts
- scripts/emu/seedIfMissing.ts
- scripts/emu/README.md
- package.json
- firebase.json
- .gitignore
- .emulator-data/README.md
- PROJECT_SCHEMA.md
- docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
- docs/team-scrape/return_packages/PST_EMULATOR_WORKFLOW_HARDENING_RETURN_PACKAGE.md

## TEST_PLAN

- [x] npm run build
- [x] npm run emu (verify ports, import/export, seed check)
- [x] Ctrl+C then npm run emu again (verify seed skipped)
- [x] npm run validate:project (fails due to pre-existing missing directories)

## DOCUMENTATION_UPDATES

**Required for significant changes only.** See `docs/workspace-rules/DOCUMENTATION_UPDATE_RULES.md` for when updates are needed.

**First, assess if documentation update is needed:**

- [x] **Significant changes?** (structure, schemas, features, APIs, scripts) → Update documentation
- [ ] **Minor changes only?** (bug fixes, refactoring, tweaks) → Skip documentation, note reason below

**If significant changes, update accordingly:**

- [x] **Structural changes** (directories, files, scripts) → Update `PROJECT_SCHEMA.md`
- [ ] **Schema changes** (`src/schemas/*.ts`) → Run `npm run schema:generate`
- [ ] **Component changes** (React components, features) → Run `npm run docs`, update `DEVELOPER_GUIDE.md`
- [ ] **Feature changes** → Update/create feature README (see `docs/workspace-rules/CREATING_PERMANENT_DOCS.md`)
- [x] **Script/tool changes** → Update `PROJECT_SCHEMA.md`, **CREATE/UPDATE** script README (always for new scripts)
- [ ] **Data module changes** → **CREATE** `data/<area>/README.md`
- [x] **New/significantly modified files** → Add file headers using `docs/templates/file_header.template.txt`
- [x] **Plan/chunk work** → Update plan file and chunk file (always)

**Verification (if documentation updated):**

- [x] Run `npm run validate:project` (if structure changed)
- [ ] Run `npm run schema:check` (if schemas changed)

**If skipped, note reason:** n/a

## STATE

status: completed

lastRun: 2026-01-28 11:45

lastResult: completed (validate:project failed due to pre-existing missing directories)

nextAction: none

## ERROR_LOG

- 2026-01-28: npm run validate:project failed due to missing directories: player-scrape/contracts/output, player-scrape/contracts/working, team-scrape/shared/firestore_staging/output/merged.

## WORKSPACE

If needed, use workspace: cursor_work/emulator-workflow-hardening/

## NOTES / DECISIONS

- Use TypeScript scripts executed via `npx tsx` to match existing tooling.
- Use macOS `lsof` + `kill` for port cleanup.
