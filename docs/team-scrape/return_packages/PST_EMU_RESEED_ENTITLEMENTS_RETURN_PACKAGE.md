# Return Package: PST Emulator Force-Reseed Entitlements

## Summary

Added a single command `npm run emu:reseed:entitlements` that force-refreshes entitlement data in the Firestore emulator without touching player collections.

## Deliverables

### New Files

| File                                | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `scripts/emu/reseedEntitlements.ts` | Force-reseed script for entitlements only |

### Modified Files

| File                    | Change                                                             |
| ----------------------- | ------------------------------------------------------------------ |
| `package.json`          | Added `emu:reseed:entitlements` npm script                         |
| `scripts/emu/README.md` | Added command documentation and "When to Use Force-Reseed" section |

## Command Reference

```bash
# Force-refresh entitlements while emulator is running
# (in a separate terminal with env vars set)
npm run emu:reseed:entitlements
```

Or with explicit env vars:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
npm run emu:reseed:entitlements
```

## What the Script Does

1. **Safety Check**: Refuses to run without emulator env vars set
2. **Delete Entitlements**: Deletes all docs from `architect_baseEntitlements` (batched at 450/batch)
3. **Clear Team entitlementIds**: Removes `entitlementIds` field from all `architect_baseTeams`
4. **Re-seed Entitlements**: Runs `npm run pst:push:base-entitlements`
5. **Re-patch Teams**: Runs `npm run pst:patch:base-teams-entitlements`
6. **Verify**: Confirms final counts match expected values (540 entitlements, 30/30 teams)

## What This Does NOT Touch

- ❌ `architect_basePlayers` - unchanged
- ❌ `players_v2` - unchanged
- ❌ Production Firestore - script has hard guard against running without emulator env vars

## Validation

### Guard Test (No Emulator)

```
$ npx tsx scripts/emu/reseedEntitlements.ts
[reseed] Error: Refusing to reseed without emulator env vars: FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST. Ensure emulators are running and env vars are set.
Exit code: 1
```

### Typical Workflow

1. Start emulator: `npm run emu`
2. In another terminal with env vars:

   ```bash
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 \
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
   npm run emu:reseed:entitlements
   ```

3. Expected output:

   ```
   [reseed] expected entitlement count: 540 (from data/pst/pst_entitlement_assets_2026_2033.json)
   [reseed] deleting all architect_baseEntitlements...
   [reseed] deleted batch 1 (450 docs) from architect_baseEntitlements
   [reseed] deleted batch 2 (90 docs) from architect_baseEntitlements
   [reseed] deleted 540 entitlement docs
   [reseed] clearing entitlementIds from architect_baseTeams...
   [reseed] cleared entitlementIds from 30 teams
   [reseed] running pst:push:base-entitlements...
   [reseed] running pst:patch:base-teams-entitlements...

   === RESEED COMPLETE ===
   architect_baseEntitlements: 540 (expected: 540)
   architect_baseTeams with entitlementIds: 30/30
   [reseed] ✅ all checks passed
   ```

## When to Use

Use this command when:

- You've regenerated `data/pst/pst_entitlement_assets_2026_2033.json`
- Entitlement counts or structure have changed
- You want to verify the push scripts work from scratch

## Related Return Packages

- [PST_EMULATOR_PLAYERS_SEEDING_RETURN_PACKAGE.md](PST_EMULATOR_PLAYERS_SEEDING_RETURN_PACKAGE.md) - Player seeding expansion
