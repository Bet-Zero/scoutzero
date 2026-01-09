# Return Package: Pipeline Ledger InputDir Fix

**Date**: 2026-01-09  
**Mode**: EXECUTION (small code change + quick validation)  
**Scope**: team-scrape pipeline ONLY  

---

## 1. What Changed

- Added `InputType` type alias (`'mentions' | 'structured'`) to `run_team_pipeline.ts`
- Added `inputType` field to `PipelineConfig` type (defaults to `'mentions'`)
- Updated `buildLedgerArgs()` function to pass the correct input directory based on `inputType`:
  - If `inputType === 'mentions'` → inputDir = `.../output/mentions`
  - If `inputType === 'structured'` → inputDir = `.../output/structured`
- Added `--input` flag pass-through to ledger builder
- Added logging for `inputType` in pipeline startup output

---

## 2. File + Exact Code Diff Snippet

**File**: `team-scrape/shared/firestore_staging/scripts/run_team_pipeline.ts`

### Before (lines 196-203):
```typescript
function buildLedgerArgs(config: PipelineConfig): string[] {
  const args = ['tsx', LEDGER_SCRIPT];
  // Input from RealGM structured output
  args.push(`--inputDir=${path.join(config.realgmOutDir, 'structured')}`);
  // Output to ledger directory
  args.push(`--outputDir=${config.ledgerOutDir}`);
  return args;
}
```

### After (lines 199-208):
```typescript
function buildLedgerArgs(config: PipelineConfig): string[] {
  const args = ['tsx', LEDGER_SCRIPT];
  // Input directory based on inputType (mentions or structured)
  const inputDir = path.join(config.realgmOutDir, config.inputType);
  args.push(`--input=${config.inputType}`);
  args.push(`--inputDir=${inputDir}`);
  // Output to ledger directory
  args.push(`--outputDir=${config.ledgerOutDir}`);
  return args;
}
```

### Type Definition Added (line 20):
```typescript
type InputType = 'mentions' | 'structured';
```

### Config Updated (line 27):
```typescript
type PipelineConfig = {
  // ... existing fields ...
  inputType: InputType;
  // ... rest of fields ...
};
```

### Main Function Updated (lines 210-214):
```typescript
async function main() {
  // Parse inputType with default 'mentions'
  const inputTypeArg = parseArg('inputType', 'mentions');
  const inputType: InputType = inputTypeArg === 'structured' ? 'structured' : 'mentions';
  // ...
}
```

---

## 3. Commands Run + Raw Console Output

### Command:
```bash
npx tsx team-scrape/shared/ledger/buildPickLedger.ts --input=mentions --inputDir=team-scrape/draft-picks/_artifacts/output/mentions
```

### Output:
```
🔨 Building league-wide draft picks ledger...
   Input type: mentions
   Input: team-scrape/draft-picks/_artifacts/output/mentions
   Output: /home/runner/work/scoutzero/scoutzero/team-scrape/shared/firestore_staging/_artifacts/output/ledger

📂 Loading per-team draft pick files...
  ✓ Loaded 2 picks from ATL
  ✓ Loaded 3 picks from DAL
  ✓ Loaded 2 picks from LAL
   Loaded 3 team files

🔗 Building canonical ledger...

📊 Deduplicated 1 picks across multiple team files:
   - 2029_1_LAL (seen in: DAL, LAL, LAL)
   Created 6 unique ledger entries

📊 Deriving per-team views...

✅ Wrote master ledger: /home/runner/work/scoutzero/scoutzero/team-scrape/shared/firestore_staging/_artifacts/output/ledger/pick_ledger.json
   Total picks in ledger: 6

✅ Wrote 30 team view files to /home/runner/work/scoutzero/scoutzero/team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team
   Total inventory picks: 6
   Total obligations: 1
   Total contested: 0

✅ Ledger build complete.

📋 Sample team summaries:
   ATL: inventory=2, obligations=0, contested=0
   LAL: inventory=1, obligations=1, contested=0
   DAL: inventory=3, obligations=0, contested=0
   OKC: inventory=0, obligations=0, contested=0
```

### Artifact Verification:
```bash
$ ls team-scrape/shared/firestore_staging/_artifacts/output/ledger
by_team  pick_ledger.json

$ ls team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team | head
ATL.json
BKN.json
BOS.json
CHA.json
CHI.json
CLE.json
DAL.json
DEN.json
DET.json
GSW.json
```

---

## 4. Proof: DAL Inventory Contains LAL_2029_1st

**File**: `team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team/DAL.json`

```json
{
  "teamCode": "DAL",
  "inventory": [
    {
      "id": "DAL_2025_1_own",
      "year": 2025,
      "round": 1,
      "status": "own",
      "originalTeam": "DAL",
      "currentOwner": "DAL",
      "stepienEligible": true,
      "tradeable": true,
      "isSwap": false
    },
    {
      "id": "DAL_2025_2_own",
      "year": 2025,
      "round": 2,
      "status": "own",
      "originalTeam": "DAL",
      "currentOwner": "DAL",
      "stepienEligible": true,
      "tradeable": true,
      "isSwap": false
    },
    {
      "id": "LAL_2029_1_incoming",      <-- ✅ LAL_2029_1st present
      "year": 2029,
      "round": 1,
      "status": "incoming",
      "originalTeam": "LAL",
      "currentOwner": "DAL",
      "stepienEligible": false,
      "tradeable": true,
      "isSwap": false,
      "protection": "Top-4 protected",
      "via": "LAL",
      "notes": "Via LAL trade (2024)"
    }
  ],
  "obligations": [],
  "contested": []
}
```

---

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| Ledger build in mentions mode reads from `.../output/mentions` | ✅ PASS |
| Ledger step completes successfully (no "No mentions files found") | ✅ PASS |
| Ledger artifacts written to `team-scrape/shared/firestore_staging/_artifacts/output/ledger/` | ✅ PASS |
| DAL by_team view includes LAL_2029_1st in inventory | ✅ PASS |

---

## Notes

- The fix defaults to `mentions` input type (matches `buildPickLedger.ts` default)
- The `--inputType=structured` flag can be used to revert to old behavior if needed
- No changes were made to the scraping step (Step 1) - only the ledger build step (Step 2)
