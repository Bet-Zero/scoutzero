# PHASE 2AC — EMULATOR PERSISTENCE SSOT

**DATE**: 2026-02-04  
**MODE**: PREFLIGHT (Discovery only)  
**STATUS**: ✅ COMPLETE

---

## 1. EXECUTIVE SUMMARY

The **single source of truth (SSOT)** for `npm run emu` persistence is:

```
/Users/brenthibbitts/Desktop/ScoutZero/.emulator-data
```

This is the **only** folder used for import/export. The 31 `firebase-export-*` folders in the project root are **orphaned/unused** — they are not referenced by any script.

---

## 2. DATA_DIR DEFINITION (Task A)

### Source File

[scripts/emu/runEmu.ts](../scripts/emu/runEmu.ts#L35)

### Exact Code Snippet

```typescript
// scripts/emu/runEmu.ts, lines 35-36
const DATA_DIR = path.resolve('.emulator-data');
const DATA_README = path.join(DATA_DIR, 'README.md');
```

### Environment Override

**None**. `DATA_DIR` is hardcoded — it cannot be overridden by environment variables.

### Resolved Absolute Path

```
/Users/brenthibbitts/Desktop/ScoutZero/.emulator-data
```

Verified via:

```bash
node -e "console.log(require('path').resolve('.emulator-data'))"
# Output: /Users/brenthibbitts/Desktop/ScoutZero/.emulator-data
```

---

## 3. EMULATOR START ARGS

### Exact Args Snippet

```typescript
// scripts/emu/runEmu.ts, lines 237-241
const emulatorArgs = [
  'emulators:start',
  `--project=${PROJECT_ID}`,
  `--import=${DATA_DIR}`,
  `--export-on-exit=${DATA_DIR}`,
];
```

Resolved at runtime to:

```bash
firebase emulators:start \
  --project=scoutzero-bf1ae \
  --import=/Users/brenthibbitts/Desktop/ScoutZero/.emulator-data \
  --export-on-exit=/Users/brenthibbitts/Desktop/ScoutZero/.emulator-data
```

---

## 4. PERSISTENCE FOLDER CONTENTS (Task B)

### Folder Structure

```
.emulator-data/
├── README.md                           # "Safe to delete to reset local state"
├── firebase-export-metadata.json       # Emulator export manifest
├── auth_export/                        # Auth emulator data
└── firestore_export/                   # Firestore emulator data
    ├── all_namespaces/                 # Collection data
    └── firestore_export.overall_export_metadata
```

### Metadata File

```json
{
  "version": "15.1.0",
  "firestore": {
    "version": "1.20.2",
    "path": "firestore_export",
    "metadata_file": "firestore_export/firestore_export.overall_export_metadata"
  },
  "auth": {
    "version": "15.1.0",
    "path": "auth_export"
  }
}
```

### Folder Existence

✅ Exists and contains valid export structure (last modified: 2026-02-03 03:17).

---

## 5. FIREBASE-EXPORT-* FOLDERS STATUS (Task C)

### Count

**31 folders** at project root matching pattern `firebase-export-*`

### Are They Referenced?

| Search Pattern | Script References Found |
|----------------|------------------------|
| `firebase-export-\d` (in `.ts`, `.js`, `.sh`) | **0** |
| `firebase-export-*` (in code) | **0** (only doc references) |
| `--import=firebase-export` | **0** |

### Verdict

❌ **NOT USED** — These are orphaned exports from old manual `firebase emulators:export` runs.

The only reference to `firebase-export-*` in code is:

- [runEmu.ts#L71](../scripts/emu/runEmu.ts#L71): Checks for `firebase-export-metadata.json` file existence (inside `.emulator-data`, not the root folders)

### Git Status

- `.emulator-data/` is in `.gitignore` ✅
- `firebase-export-*` folders are **NOT** in `.gitignore` — they appear to have been created locally and never cleaned up

### Recommendation

These 31 folders can be safely deleted:

```bash
rm -rf firebase-export-*
```

---

## 6. WHAT PERSISTS VS WHAT DOESN'T (Task D)

### ✅ What Persists Automatically Across Emulator Runs

Any Firestore writes made while the emulator is running are saved when the emulator exits (via `--export-on-exit`). This includes:

1. **Base data from seed scripts** — Collections seeded by `seedIfMissing.ts`:
   - `architect_baseTeams`
   - `architect_basePlayers`
   - `architect_basePickRules`
   - `architect_entitlements`
   - `players_v2` (subset)

2. **Any manual edits** made through:
   - The UI while connected to emulator
   - Ad-hoc scripts run against `FIRESTORE_EMULATOR_HOST=127.0.0.1:8082`
   - Firebase console (emulator UI at `localhost:4000`)

### ❌ What Does NOT Persist (Emu-Only Patching)

Changes **do NOT survive** if:

1. **You run `npm run emu:clear`** — Deletes `.emulator-data` entirely
2. **Someone else clones the repo** — `.emulator-data` is gitignored
3. **The change wasn't upstreamed to the staging pipeline**

### The General Rule

> **If it's only written into the emulator but not upstreamed into the staging writer or a prod migration, it won't appear in real Firestore automatically.**

| Change Type | Emulator | Production |
|-------------|----------|------------|
| Seeded base data (from JSON artifacts) | ✅ | ✅ (via `team:push`, `contracts:push`) |
| Manual emulator edits | ✅ | ❌ |
| Migration script (emu mode) | ✅ | ❌ (until run with `--prod`) |
| Staging pipeline output | ✅ (via seed) | ✅ (via push) |

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Scrape Scripts]                                                   │
│        │                                                            │
│        ▼                                                            │
│  [JSON Artifacts]  ◄── SSOT for base data                          │
│   (data/, team-scrape/, player-scrape/)                            │
│        │                                                            │
│        ├────────────────────────────┐                              │
│        ▼                            ▼                              │
│  [Staging Writers]            [Seed Scripts]                       │
│  (stage_player.ts)            (seedIfMissing.ts)                   │
│        │                            │                              │
│        ▼                            ▼                              │
│  [Production Firestore]       [.emulator-data]                     │
│  (via team:push, contracts:push)    │                              │
│        ▲                            │                              │
│        │                            ▼                              │
│        │                      [Emulator Runtime]                   │
│        │                            │                              │
│        │                            ▼                              │
│        │                      [Manual Edits]                       │
│        │                      (UI, ad-hoc scripts)                 │
│        │                            │                              │
│        └────────────────────────────┘                              │
│                    (via migration --prod --write)                  │
│                                                                     │
│  ⚠️  Manual emulator edits NEVER auto-sync to prod                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. VALIDATION COMMANDS USED

All read-only:

```bash
# Resolve DATA_DIR path
node -e "console.log(require('path').resolve('.emulator-data'))"

# Check folder contents
ls -la .emulator-data/
cat .emulator-data/firebase-export-metadata.json

# Count firebase-export-* folders
ls -1d firebase-export-* | wc -l

# Search for references
grep -r "firebase-export-" --include="*.ts" --include="*.js"
grep -n "--import=" scripts/emu/runEmu.ts
```

---

## 8. SUMMARY TABLE

| Question | Answer |
|----------|--------|
| What is DATA_DIR? | `/Users/brenthibbitts/Desktop/ScoutZero/.emulator-data` |
| Is it configurable? | No — hardcoded in `runEmu.ts` |
| What files are in it? | `firebase-export-metadata.json`, `firestore_export/`, `auth_export/` |
| Are `firebase-export-*` folders used? | **No** — orphaned, can be deleted |
| What persists across `npm run emu`? | All emulator writes (via `--export-on-exit`) |
| What doesn't persist if `.emulator-data` is cleared? | Everything — emulator restarts fresh |
| How to get changes into prod? | Must run staging writer or migration with `--prod --write` |

---

## 9. RECOMMENDATIONS

1. **Delete orphaned folders**: `rm -rf firebase-export-*` (31 folders, ~GB of unused data)
2. **Add to .gitignore** (optional): `firebase-export-*` pattern to prevent future orphans
3. **Document the rule**: Emulator edits are local-only; pipeline/prod changes require explicit push commands
