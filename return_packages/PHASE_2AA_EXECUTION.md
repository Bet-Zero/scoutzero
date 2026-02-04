# Phase 2AA: OptionsByYear Persistence & Data Flow — Execution Return Package

**Executed**: 2026-02-03
**Status**: ✅ COMPLETE

---

## Summary

Implemented reliable persistence of `optionsByYear` across emulator runs and production pipeline, with project targeting guardrails to prevent accidental writes.

---

## Changes Made

### Task A — Staging Writer SSOT

**File**: [`stage_player.ts`](file:///Users/brenthibbitts/Desktop/ScoutZero/player-scrape/firestore_staging/scripts/stage_player.ts)

Added `optionsByYear` derivation from existing `seasonMap` (lines 701-712):

```typescript
// Phase 2AA: Build optionsByYear map from seasonMap
const optionsByYear: Record<string, string> = {};
for (const [seasonCode, entry] of seasonMap.entries()) {
  if (entry.optionType && ['PO', 'TO', 'ETO'].includes(entry.optionType)) {
    const yearKey = String(getSeasonStartYear(seasonCode));
    optionsByYear[yearKey] = entry.optionType;
  }
}
```

**Result**: All newly staged player documents now include `currentContractView.optionsByYear`.

---

### Task B — Emulator Safety Net

**File**: [`seedIfMissing.ts`](file:///Users/brenthibbitts/Desktop/ScoutZero/scripts/emu/seedIfMissing.ts)

Added `runOptionsByYearBackfillIfNeeded()` function that:
1. Runs migration in dry-run mode
2. Parses "Would update: N" from output
3. If N > 0, runs migration in write mode
4. Uses correct env: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082`

**Result**: `npm run emu` now auto-backfills optionsByYear after seeding players_v2.

---

### Task C — Project Guardrails

**File**: [`phase2y_backfill_optionsByYear.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/scripts/migrations/phase2y_backfill_optionsByYear.js)

| Feature | Implementation |
|---------|----------------|
| `--project=<id>` flag | Explicit project ID (overrides env vars) |
| `--prod --confirmProject=<id>` | Required for prod writes without env var |
| Startup banner | Shows Target (EMULATOR/PROD), Host, Project |
| Updated help text | Uses port 8082, documents new flags |
| Error on missing project | Exits if no project resolved for prod |

**Example output**:

```
┌─────────────────────────────────────────────────────────────┐
│ Target:  EMULATOR                                          │
│ Host:    127.0.0.1:8082                                    │
│ Project: scoutzero-bf1ae                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Verification Results

| Check | Result |
|-------|--------|
| Tests | ✅ 35/35 passed (`player_filters_wiring_contract.test.js`) |
| Build | ✅ Success (1m 12s) |
| Migration script | ✅ Prints correct banner with emulator env |

---

## Files Modified

| File | Type | Description |
|------|------|-------------|
| `player-scrape/firestore_staging/scripts/stage_player.ts` | MODIFY | Added optionsByYear derivation |
| `scripts/emu/seedIfMissing.ts` | MODIFY | Added backfill safety net |
| `scripts/migrations/phase2y_backfill_optionsByYear.js` | MODIFY | Added guardrails |
| `docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md` | MODIFY | Added Phase 2AA section |

---

## Usage

**Emulator (automatic)**:
```bash
npm run emu  # optionsByYear auto-backfilled if needed
```

**Production backfill (manual)**:
```bash
node scripts/migrations/phase2y_backfill_optionsByYear.js --write --prod --confirmProject=scoutzero-bf1ae
```

---

## Related Documents

- [Phase 2Y Execution](./PHASE_2Y_OPTION_TYPES_BACKFILL_EXECUTION.md)
- [Phase 2Z Preflight](./PHASE_2Z_PREFLIGHT_EMU_OPTIONSBYEAR_WIRING.md)
- [Master Audit](../docs/scouting/SCOUTING_PLAYER_TABLE_MASTER_AUDIT.md)
