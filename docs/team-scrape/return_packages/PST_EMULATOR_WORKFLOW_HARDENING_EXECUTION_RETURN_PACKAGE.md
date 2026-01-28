# PST Emulator Workflow Hardening — Execution Return Package

## Summary

Successfully validated and hardened the emulator workflow for a zero-hassle two-command user experience.

## Files Changed

1. **package.json** - Fixed `emu:save` project ID and added `emu:clear`
2. **scripts/emu/README.md** - Updated with simplified workflow documentation

## Final package.json Scripts

```json
"emu": "npx tsx scripts/emu/runEmu.ts",
"emu:save": "firebase emulators:export --project scoutzero-bf1ae ./.emulator-data --force",
"emu:clear": "rm -rf ./.emulator-data && mkdir -p ./.emulator-data",
```

## Final firebase.json Emulator Section

```json
"emulators": {
  "auth": { "host": "127.0.0.1", "port": 9099 },
  "functions": { "host": "127.0.0.1", "port": 5001 },
  "firestore": { "host": "127.0.0.1", "port": 8082 },
  "ui": { "enabled": true, "host": "127.0.0.1", "port": 4000 },
  "singleProjectMode": true
}
```

## Validation Results

### First `npm run emu` (with existing data)

```
> npx tsx scripts/emu/runEmu.ts

[emu] starting firebase emulators...
i  emulators: Starting emulators: auth, functions, firestore, extensions
i  firestore: Importing data from .emulator-data/firestore_export/...
i  firestore: Firestore Emulator logging to firestore-debug.log
[emu] firestore emulator ready, checking seed state...
✔  firestore: Firestore Emulator UI websocket is running on 9150.
[seed] base entitlements present (525) — skipping
[seed] base teams entitlementIds present (30/30) — skipping
i  auth: Importing config from .emulator-data/auth_export/config.json
i  auth: Importing accounts from .emulator-data/auth_export/accounts.json
✔  functions: Loaded functions definitions from source: purgeArchitectWorld.
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://127.0.0.1:4000/               │
└─────────────────────────────────────────────────────────────┘
```

### Second `npm run emu` (port auto-clean + skip seeding)

```
> npx tsx scripts/emu/runEmu.ts

[emu] freed port 8082 (killed pid 29815)
[emu] starting firebase emulators...
i  emulators: Starting emulators: auth, functions, firestore, extensions
i  firestore: Importing data from .emulator-data/firestore_export/...
[emu] firestore emulator ready, checking seed state...
[seed] base entitlements present (525) — skipping
[seed] base teams entitlementIds present (30/30) — skipping
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://127.0.0.1:4000/               │
└─────────────────────────────────────────────────────────────┘
```

### Emulator UI Data Verification

- **architect_baseEntitlements**: 525 documents ✅
- **architect_baseTeams/PHI**: `entitlementIds.length > 0` ✅

### Export on Exit

```
i  emulators: Received SIGINT (Ctrl-C) for the first time. Starting a clean shutdown.
i  Automatically exporting data using --export-on-exit ".emulator-data"...
i  Exporting data to: /Users/brenthibbitts/Desktop/ScoutZero/.emulator-data
```

## Confirmed Workflow

1. `npm run emu` — starts emulators, auto-kills stray ports, imports data, checks/seeds if needed
2. `npm run dev` — starts Vite dev server
3. `Ctrl+C` on emulator terminal — auto-exports data and shuts down cleanly

## Troubleshooting Commands

- **Ports stuck**: Just run `npm run emu` again (auto-kills)
- **Data corrupted**: `npm run emu:clear` then `npm run emu`
- **Manual save**: `npm run emu:save`

## All Validation Criteria Met

| Criteria                                 | Status |
| ---------------------------------------- | ------ |
| Port auto-kill works                     | ✅     |
| Data imports on start                    | ✅     |
| Seed skips when data present             | ✅     |
| Export on Ctrl+C works                   | ✅     |
| Emulator UI accessible at 127.0.0.1:4000 | ✅     |
| baseEntitlements count = 525             | ✅     |
| baseTeams have entitlementIds            | ✅     |
