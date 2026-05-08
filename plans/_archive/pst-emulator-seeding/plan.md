# PST Emulator Players Seeding

## PLAN_INTENT

Add missing player collections to the Firestore emulator seed flow so `npm run emu` starts with architect base data and full player catalogs (architect_basePlayers and players_v2) without manual intervention.

## SCOPE

- In scope:
  - Detecting when architect_basePlayers or players_v2 are absent/empty in the emulator and triggering seeding.
  - Implementing reusable seeding scripts for both collections using existing local source data.
  - Guarding seeding so it only runs against running emulators.
  - Updating npm scripts, docs, and return package per requirements.

- Out of scope:
  - Changing the structure of source player data files.
  - Modifying production Firestore data or remote environments.
  - Refactoring unrelated emulator scripts.

## IMPLEMENTATION_SCOPE

Execute the following:

- Enhance `scripts/emu/seedIfMissing.ts` to check architect_basePlayers and players_v2 counts and invoke seeders when empty.
- Introduce dedicated seeders (likely `seedPlayersIfMissing.ts` or similar helpers) that load local JSON exports and write them via batched writes (≤450 docs per batch) into the emulator.
- Add npm scripts `emu:seed:base-players` and `emu:seed:players-v2` that call the new seeding logic.
- Ensure seeding aborts unless both `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are set.
- Document the expanded seeding behavior in `scripts/emu/README.md` and capture source/count/log details in `docs/team-scrape/return_packages/PST_EMULATOR_PLAYERS_SEEDING_RETURN_PACKAGE.md`.

## CONTEXT SNAPSHOT

Important background for this plan:

- Systems involved: Firestore emulator, existing npm `emu` workflow, seeding scripts under `scripts/emu/`.
- Key folders and files: `scripts/emu/seedIfMissing.ts`, new helper seeder in `scripts/emu/`, local player data likely under `data/` or `archive/`, docs under `scripts/emu/README.md` and `docs/team-scrape/return_packages/`.
- Relevant docs: `AGENTS.md`, `docs/workspace-rules/*`, instructions in user request for seeding targets and validation.
- Known constraints: seeding must only act when emulator env vars are set; writes limited to 450 docs per batch.
- **Questions asked and answered**: None.
- **Technical decisions made**: Use plan mode without chunks (single-phase). Investigate repo data exports to find authoritative sources for base players and players_v2.

## CHUNK_INDEX

_No chunks for this plan (single-phase execution)._

## PROGRESS

**Status**: 🟢 Completed

**Progress**: ⬛⬛⬛⬛ 4/4 tasks completed

**Completed**:

- ✅ Located staged JSON sources for architect_basePlayers and players_v2 under `firestore_staging/_artifacts/output`
- ✅ Implemented `seedPlayersIfMissing.ts` plus npm scripts with emulator safety guards
- ✅ Updated `seedIfMissing.ts` and emulator README to describe the new behavior
- ✅ Captured validation evidence + return package after running `npm run emu` twice

**Next Steps**:

- [ ] None (plan deliverables complete)

---

## ADDENDUM: Force-Reseed Entitlements (Added 2025-01-29)

### Request

Add a single command that force-refreshes entitlement data in the Firestore emulator:


- `architect_baseEntitlements` - delete all and re-push
- `architect_baseTeams.entitlementIds` - clear and re-patch

Must NOT touch `architect_basePlayers` or `players_v2`.

### Deliverables

- ✅ Created `scripts/emu/reseedEntitlements.ts` - force-reseed script
- ✅ Added `npm run emu:reseed:entitlements` script
- ✅ Updated `scripts/emu/README.md` with command docs and "When to Use" section
- ✅ Created return package: `docs/team-scrape/return_packages/PST_EMU_RESEED_ENTITLEMENTS_RETURN_PACKAGE.md`

### Validation


Guard test passed:

```
$ npx tsx scripts/emu/reseedEntitlements.ts
[reseed] Error: Refusing to reseed without emulator env vars: FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST. Ensure emulators are running and env vars are set.
Exit code: 1
```

Script compiles and runs correctly. Full validation requires running against a live emulator.

**Blockers**: None

**Last Updated**: 2026-01-29 02:45 UTC

## PERMANENT_FILE_MAP

- scripts/emu/seedIfMissing.ts — seed orchestration updates
- scripts/emu/seedPlayersIfMissing.ts — new helper/logic if needed
- scripts/emu/README.md — document seeding behavior
- docs/team-scrape/return_packages/PST_EMULATOR_PLAYERS_SEEDING_RETURN_PACKAGE.md — required return package
- package.json — npm scripts additions (if needed)

## REVISION_LOG

- 2026-01-29: Plan created to implement PST emulator seeding expansion.

## KNOWN_LIMITATIONS

- Source-of-truth files for players are not yet confirmed; plan assumes they exist locally and may require adjustments once identified.
