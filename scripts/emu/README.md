# Emulator Workflow Scripts

## Daily Workflow

1. `npm run emu`
2. In another terminal: `npm run dev`
3. Ctrl+C emulator terminal when done (auto-saves)

That's it! The emulator will:

- Auto-kill any processes using emulator ports
- Import existing data from `.emulator-data/`
- Seed base data if missing (first run only)
- Export data on exit automatically

## Troubleshooting

- **If ports are stuck**: Just run `npm run emu` again (it auto-kills)
- **If emulator data corrupted**: `npm run emu:clear` then `npm run emu`
- **If rosters are empty / teams look broken**: Run `npm run emu:repair:teams` to restore baseTeams from staged JSON and re-patch entitlements
- **To use a different Emulator UI port**: `SCOUTZERO_EMU_UI_PORT=4002 npm run emu`
- **To manually save**: `npm run emu:save` (rarely needed, auto-saves on Ctrl+C)

## Entry Points

| Command                           | Description                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run emu`                     | Start emulators with auto-heal, import, seed, and export-on-exit                                        |
| `npm run emu:save`                | Manually export emulator data (backup)                                                                  |
| `npm run emu:clear`               | Delete emulator data and start fresh                                                                    |
| `npm run emu:seed:base-players`   | Seed `architect_basePlayers` from staged JSON (skips if data already exists)                            |
| `npm run emu:seed:players-v2`     | Seed `players_v2` docs + subcollections from staged JSON (skips if data already exists)                 |
| `npm run emu:reseed:entitlements` | **Force-refresh** entitlements: deletes and re-seeds `architect_baseEntitlements` + team entitlementIds |
| `npm run emu:reseed:baseTeams`    | **Restore** `architect_baseTeams` from staged JSON (full doc replacement)                               |
| `npm run emu:repair:teams`        | **Fix broken teams**: restores baseTeams then patches entitlementIds                                    |
| `npm run architect:review:world`  | Seed a realistic review **world** for an anon uid (BOS/LAL/MIA/MIN/PHX hydrated) — see below            |

### architect:review:world (review-world seeder, BZE-218)

Seeds an `architect_worlds/<worldId>` doc plus 30 team snapshots into the
running Firestore emulator so world-scoped rooms (Compare, Team History,
Trade Machine) can be reviewed in non-empty states. BOS/LAL/MIA/MIN/PHX are
hydrated from the `review_seed` fixtures (real names, contracts, caps,
entitlementIds); other teams get generic depth rosters. Review/test-only:
refuses to run without `FIRESTORE_EMULATOR_HOST`.

```
npm run architect:review:up                     # harness on :5173
# load http://localhost:5173/gm/MIA once so the anon uid exists
npm run architect:review:world -- --uid <uid>   # prints the worldId
# paste the printed localStorage snippet into the browser console + reload
```

## When to Use Force-Reseed

Use `npm run emu:reseed:entitlements` when:

- You've regenerated `data/pst/pst_entitlement_assets_2026_2033.json`
- Entitlement counts or structure have changed
- You want to verify the push scripts work from scratch

This command:

1. Deletes all docs in `architect_baseEntitlements`
2. Clears `entitlementIds` from all `architect_baseTeams`
3. Runs `pst:push:base-entitlements` and `pst:patch:base-teams-entitlements`
4. Verifies final counts match expected values

**Note:** This does NOT touch `architect_basePlayers` or `players_v2`.

## How It Works

### runEmu.ts

1. Kills any processes listening on ports 8082, 9099, 5001, 4001 (or `SCOUTZERO_EMU_UI_PORT`)
2. Starts Firebase emulators with `--import` and `--export-on-exit`
3. Waits for Firestore emulator to be ready
4. Runs `seedIfMissing.ts` to populate base data if needed
5. On Ctrl+C: lets Firebase export and exits cleanly

### seedIfMissing.ts

1. Verifies emulator env vars are set (safety check)
2. Checks `architect_baseEntitlements` count (need 525)
3. Checks `architect_baseTeams` have `entitlementIds` (need 30)
4. Checks `architect_basePickRules` count (need ≥100 docs with encumbrances)
5. Checks `architect_basePlayers` exists and has docs
6. Checks `players_v2` exists and has docs
7. If entitlements/teams missing: runs PST seeding scripts
8. If base pick rules missing: runs `npm run pst:push:base-pick-rules`
9. If base players missing: runs `npm run emu:seed:base-players`
10. If `players_v2` missing: runs `npm run emu:seed:players-v2`
11. Verifies all collections after seeding

### Guaranteed Seeded Base Collections

The following collections are automatically seeded on first run and persist across restarts:

| Collection                   | Source Data                                      | Threshold Check          |
| ---------------------------- | ------------------------------------------------ | ------------------------ |
| `architect_baseEntitlements` | `data/pst/pst_entitlement_assets_2026_2033.json` | Exact count match        |
| `architect_baseTeams`        | Staged JSON + entitlement patching               | 30 teams w/ entitlements |
| `architect_basePickRules`    | `data/pst/pst_pick_ledger_final_2026_2033.json`  | ≥100 docs                |
| `architect_basePlayers`      | Staged player JSON                               | >0 docs                  |
| `players_v2`                 | Staged player JSON + subcollections              | >0 docs                  |

## Links

- PST master plan: [docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md](../../docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md)
