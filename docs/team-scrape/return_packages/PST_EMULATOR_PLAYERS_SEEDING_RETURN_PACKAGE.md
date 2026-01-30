# PST Emulator Players Seeding — Return Package

<!--
FILE: docs/team-scrape/return_packages/PST_EMULATOR_PLAYERS_SEEDING_RETURN_PACKAGE.md
PURPOSE: Capture validation evidence for adding architect_basePlayers and players_v2 seeds to the PST emulator workflow.
OWNERSHIP: Team Scrape — PST pick ledger

HISTORY:
- 2026-01-29: Created by plan `plans/pst-emulator-seeding/plan.md`

LINKS:
- Plan: plans/pst-emulator-seeding/plan.md
-->

## Summary

Expanded the emulator seed workflow so `npm run emu` now ensures both `architect_basePlayers` and `players_v2` exist before the dev server starts. Added a dedicated `seedPlayersIfMissing.ts` helper plus npm scripts, guarded by emulator env vars, and verified the flow with one seeded run (creates data) and one skip run (no-op when data persists).

## Source of Truth Inputs

| Collection              | Local Data Source                                        |
| ----------------------- | -------------------------------------------------------- |
| `architect_basePlayers` | `firestore_staging/_artifacts/output/basePlayers/*.json` |
| `players_v2`            | `firestore_staging/_artifacts/output/players_v2/*.json`  |

## Seed Output Summary

- `architect_basePlayers`: 660 player docs written (2 batches, 660 writes)
- `players_v2`: 660 player roots + subcollections written (6 batches, 2,496 writes)

## Validation Logs

### First Run — `npm run emu` (seeding executed)

```
[seed] architect_basePlayers missing — seeding required
[seed] players_v2 missing — seeding required
[seed] seeding architect_basePlayers from staged data...
[seed] writing 660 architect_basePlayers docs from .../firestore_staging/_artifacts/output/basePlayers
[seed] committed batch 1 (450 writes)
[seed] committed batch 2 (210 writes)
[seed] architect_basePlayers: 660 players (660 writes across 2 batches).
[seed] seeding players_v2 from staged data...
[seed] writing 660 players_v2 docs (main + subcollections) from .../firestore_staging/_artifacts/output/players_v2
[seed] committed batch 1 (450 writes)
[seed] committed batch 2 (450 writes)
[seed] committed batch 3 (450 writes)
[seed] committed batch 4 (450 writes)
[seed] committed batch 5 (450 writes)
[seed] committed batch 6 (246 writes)
[seed] players_v2: 660 players (2496 writes across 6 batches).
[seed] base data verified after seeding (entitlements, baseTeams, basePlayers, players_v2).
```

### Second Run — `npm run emu` (seed skipped when data present)

```
[seed] base entitlements present (540) — skipping
[seed] base teams entitlementIds present (30/30) — skipping
[seed] architect_basePlayers present — skipping seed
[seed] players_v2 present — skipping seed
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
└─────────────────────────────────────────────────────────────┘
```

## Notes

- Both manual seed commands (`npm run emu:seed:base-players`, `npm run emu:seed:players-v2`) guard against missing emulator env vars and skip automatically if the target collection already has documents.
- Emulator exports under `.emulator-data/` now include all four collections (base entitlements, base teams, base players, players_v2).
