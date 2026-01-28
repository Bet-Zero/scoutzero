/\*\*

- FILE: docs/team-scrape/return_packages/PST_EMULATOR_WORKFLOW_HARDENING_RETURN_PACKAGE.md
- PURPOSE: Return package for emulator workflow hardening execution.
- OWNERSHIP: Team Scrape: PST pick ledger
-
- HISTORY:
- - 2026-01-28: Created by plan `plans/_archive/emulator-workflow-hardening/plan.md`, chunk_01
-
- LINKS:
- - Plan: plans/\_archive/emulator-workflow-hardening/plan.md
- - Latest Chunk: plans/\_archive/emulator-workflow-hardening/chunks/chunk_01.md
    \*/

# PST Emulator Workflow Hardening — Return Package

## Summary

Implemented a zero-hassle emulator workflow that auto-frees ports, persists emulator data on exit, and seeds PST base data only when missing. Added safety guards to prevent any seeding without emulator environment variables.

## Files Changed/Created

- scripts/emu/runEmu.ts
- scripts/emu/seedIfMissing.ts
- scripts/emu/README.md
- package.json
- firebase.json
- .gitignore
- .emulator-data/README.md
- PROJECT_SCHEMA.md
- docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md

## New User Workflow (2 Commands)

1. `npm run emu`
2. `npm run dev`

## Validation Results

- `npm run build`: ✅ (see logs below)
- `npm run emu` (first run): ✅ ports freed, emulators started with import/export, seed check executed
- `npm run emu` (second run): ✅ seed skipped (data present)
- `npm run validate:project`: ❌ (existing missing directories: player-scrape/contracts/output, player-scrape/contracts/working, team-scrape/shared/firestore_staging/output/merged)

### Log Excerpts

```
[emu] freed port 8082 (killed pid 91722)
[emu] starting firebase emulators...
[emu] firestore emulator ready, checking seed state...
[seed] base data missing — running PST seeding scripts...
🎉 Base entitlement push complete.
🎉 Base teams patch complete.
[seed] base data verified after seeding.
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
└─────────────────────────────────────────────────────────────┘

[seed] base entitlements present (525) — skipping
[seed] base teams entitlementIds present (30/30) — skipping

[emu] received SIGINT, stopping emulators...
i  emulators: Received export request. Exporting data to /Users/brenthibbitts/Desktop/ScoutZero/.emulator-data.
```

## Known Limitations

- `npm run validate:project` currently fails due to pre-existing missing directories (see Validation Results)./\*\*
