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
- **To manually save**: `npm run emu:save` (rarely needed, auto-saves on Ctrl+C)

## Entry Points

| Command             | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `npm run emu`       | Start emulators with auto-heal, import, seed, and export-on-exit |
| `npm run emu:save`  | Manually export emulator data (backup)                           |
| `npm run emu:clear` | Delete emulator data and start fresh                             |

## How It Works

### runEmu.ts

1. Kills any processes listening on ports 8082, 9099, 5001, 4000
2. Starts Firebase emulators with `--import` and `--export-on-exit`
3. Waits for Firestore emulator to be ready
4. Runs `seedIfMissing.ts` to populate base data if needed
5. On Ctrl+C: lets Firebase export and exits cleanly

### seedIfMissing.ts

1. Verifies emulator env vars are set (safety check)
2. Checks `architect_baseEntitlements` count (need 525)
3. Checks `architect_baseTeams` have `entitlementIds` (need 30)
4. If missing: runs PST seeding scripts
5. Verifies data after seeding

## Links

- PST master plan: [docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md](../../docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md)
