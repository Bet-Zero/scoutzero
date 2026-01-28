# Emulator Workflow Hardening

## PLAN_INTENT

Deliver a zero-hassle local emulator workflow that auto-frees ports, persists data, and seeds only when missing, while keeping production Firebase safe.

## SCOPE

- In scope:
  - Add emulator runner and seed-if-missing scripts.
  - Wire npm scripts and emulator ports.
  - Ensure emulator data persistence and safety checks.
  - Update required documentation and return package.

- Out of scope:
  - Any changes to production Firebase data.
  - Broader emulator usage outside PST/Architect base data.
  - Refactoring unrelated scripts or tooling.

## IMPLEMENTATION_SCOPE

Implement `scripts/emu/runEmu.ts` and `scripts/emu/seedIfMissing.ts`, update `package.json`, `firebase.json`, `.gitignore`, add a local `.emulator-data` README, and document the workflow in PST master plan and return package.

## CONTEXT SNAPSHOT

- Systems involved
  - Firebase emulators (auth, firestore, functions, UI)
  - PST base entitlements seeding scripts

- Key folders and files
  - scripts/
  - firebase.json
  - package.json
  - docs/team-scrape/

- Relevant docs (paths under docs/ or elsewhere)
  - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
  - docs/workspace-rules/WORKFLOW_CHECKLIST.md
  - docs/workspace-rules/FILE_PLACEMENT_GUIDE.md
  - docs/workspace-rules/WHEN_TO_USE_PLAN_MODE.md

- Known constraints
  - Emulator workflow must auto-free ports and persist data.
  - Seeding must only run against emulators with safety checks.

- Questions asked and answered
  - None.

- Technical decisions made
  - Use TypeScript scripts executed via `npx tsx`.
  - Use `lsof` + `kill` for macOS port cleanup.

## CHUNK_INDEX

- chunk_01 — Zero-hassle emulator workflow — completed

## PROGRESS

**Status**: ✅ Complete

**Progress**: ⬛⬛⬛⬛⬛ 5/5 tasks completed

**Completed**:

- ✅ Create emulator runner and seed-if-missing scripts
- ✅ Update npm scripts, firebase.json, and gitignore
- ✅ Add emulator data README and script README
- ✅ Update PST master plan and return package
- ✅ Run required validations

**Next Steps**:

- None

**Blockers**: None

**Last Updated**: 2026-01-28 11:45

## PERMANENT_FILE_MAP

- Scripts: scripts/emu/runEmu.ts, scripts/emu/seedIfMissing.ts, scripts/emu/README.md
- Config: firebase.json, package.json, .gitignore
- Docs: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md, docs/team-scrape/return_packages/PST_EMULATOR_WORKFLOW_HARDENING_RETURN_PACKAGE.md
- Local data: .emulator-data/README.md

## REVISION_LOG

- 2026-01-28: Initial plan created for emulator workflow hardening.

## KNOWN_LIMITATIONS

- Emulator validation requires starting/stopping emulators in a terminal session.
