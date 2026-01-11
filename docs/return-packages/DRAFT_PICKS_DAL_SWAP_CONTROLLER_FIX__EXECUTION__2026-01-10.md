# Return Package: DAL Swap Controller Fix Execution

**Date**: 2026-01-10  
**Task**: Fix DAL "Own or OKC (via OKC swap for DAL)" parsing to correctly identify controller and suppress erroneous via

---

## 1. Files Changed

- `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`
- `docs/team-scrape/DRAFT_PICKS_PIPELINE.md`

---

## 2. Key Diffs

### 2.1 Add controller to swapDetails type

**File**: `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` (line ~364)

**Before**:
```typescript
swapDetails?: {
  swapType?: 'bilateral' | 'multiway' | 'favorable' | 'unknown';
  swapWith?: string[];
  favorable?: 'most' | 'least' | null;
};
```

**After**:
```typescript
swapDetails?: {
  swapType?: 'bilateral' | 'multiway' | 'favorable' | 'unknown';
  swapWith?: string[];
  favorable?: 'most' | 'least' | null;
  controller?: string; // Team that controls the swap (gets favorable choice)
};
```

### 2.2 Fix status to 'own' for "Own or TEAM" swaps

**File**: `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` (line ~1213)

**Before**:
```typescript
if (startsWithOwn) {
  // "Own or TEAM" means the page team owns their pick (with swap rights)
  // Override "incoming" status that might be detected from "via" clause
  status = swap.isSwap ? 'contested' : 'own';
}
```

**After**:
```typescript
if (startsWithOwn) {
  // "Own or TEAM" means the page team owns their pick slot (with swap rights)
  // Status must be "own" - this is DAL's own pick slot, not contested
  status = 'own';
}
```

### 2.3 Suppress via for swap-control wording

**File**: `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` (line ~1256-1272)

**Before**:
```typescript
via:
  via && via !== originalTeam && via !== owner
    ? via
    : (teamCodePrefix && status === 'incoming' ? teamCodePrefix : undefined),
```

**After**:
```typescript
// Detect if "via" is only swap-control wording (e.g., "via OKC swap for DAL")
// When startsWithOwn is true, this pattern describes swap control, not trade-chain origin
const viaIsSwapControl = /via\s+[A-Za-z0-9 .']+\s+swap\s+for/i.test(part);

via:
  // Suppress via if it's only swap-control wording when startsWithOwn is true
  (startsWithOwn && viaIsSwapControl)
    ? undefined
    : via && via !== originalTeam && via !== owner
      ? via
      : (teamCodePrefix && status === 'incoming' ? teamCodePrefix : undefined),
```

---

## 3. Proof JSON Object (DAL_2028_1st)

From `team-scrape/draft-picks/_artifacts/output/mentions/draft_picks_mentions_DAL.json`:

```json
{
  "id": "DAL_2028_1st",
  "year": 2028,
  "round": 1,
  "status": "own",
  "originalTeam": "DAL",
  "owner": "DAL",
  "stepienEligible": true,
  "tradeable": true,
  "protection": null,
  "isSwap": true,
  "pickNumber": null,
  "detailUrl": "https://basketball.realgm.com/nba/teams/Dallas-Mavericks/6/draft-picks",
  "swapDetails": {
    "swapType": "bilateral",
    "swapWith": [
      "OKC"
    ],
    "favorable": null,
    "controller": "OKC"
  },
  "swapId": "DAL_2028_1st_swap_OKC",
  "metadata": {
    "realgmRawText": "Own or OKC (via OKC swap for DAL)",
    "realgmTeamPage": "DAL"
  }
}
```

**Validation**:
- ✅ `id === "DAL_2028_1st"`
- ✅ `originalTeam === "DAL"`
- ✅ `owner === "DAL"`
- ✅ `status === "own"` (not "contested")
- ✅ `isSwap === true`
- ✅ `swapDetails.swapType === "bilateral"`
- ✅ `swapDetails.swapWith` includes `"OKC"`
- ✅ `swapDetails.controller === "OKC"`
- ✅ `via` is missing (undefined, NOT "OKC")

---

## 4. Command Outputs

### 4.1 DAL-only scrape

```bash
npm run team:draft-picks -- --teams DAL --outDir team-scrape/draft-picks/_artifacts/output
```

**Output** (trimmed):
```
🔍 Scraping RealGM future drafts — Teams: DAL
🌐 Fetching Dallas Mavericks (DAL) → https://basketball.realgm.com/nba/teams/Dallas-Mavericks/6/draft-picks
   • Parsed 7 season rows
   • Wrote 14 picks to mentions file
   • Wrote 10 picks to inventory file
📦 Per-team files saved under:
    /Users/brenthibbitts/Desktop/ScoutZero/team-scrape/draft-picks/_artifacts/output/structured (inventory)
    /Users/brenthibbitts/Desktop/ScoutZero/team-scrape/draft-picks/_artifacts/output/mentions (all mentions)
🎯 Done
```

### 4.2 Ledger build

```bash
npx tsx team-scrape/shared/ledger/buildPickLedger.ts --input=mentions --inputDir team-scrape/draft-picks/_artifacts/output/mentions
```

**Output** (trimmed):
```
🔨 Building league-wide draft picks ledger...
   Input type: mentions
   Input: team-scrape/draft-picks/_artifacts/output/mentions
📂 Loading per-team draft pick files...
  ✓ Loaded 14 picks from DAL
   Loaded 30 team files
🔗 Building canonical ledger...
   Created 382 unique ledger entries
📊 Deriving per-team views...
✅ Wrote master ledger: .../ledger/pick_ledger.json
   Total picks in ledger: 382
✅ Wrote 30 team view files to .../ledger/by_team
   Total inventory picks: 368
   Total obligations: 134
   Total contested: 2455
✅ Ledger build complete.
📋 Sample team summaries:
   DAL: inventory=12, obligations=7, contested=81
```

### 4.3 Staging validation

```bash
npm run stage:team -- --team=DAL --validate
```

**Output** (trimmed):
```
📦 Staging baseTeam document for DAL
  ✓ Loaded ledger views for DAL: inventory=12, obligations=7, contested=81
✅ baseTeams document staged successfully.
   → team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/DAL.json
   📊 Ledger views:
      - draftPicksInventory: 12 picks
      - draftPicksObligations: 7 picks
      - draftPicksContested: 81 picks
```

**Verification**: Staged output confirms `controller: "OKC"` is preserved in `metadata.swapDetails` for DAL_2028_1st pick.

---

## 5. Stepien Test Output

```bash
npm run test -- src/tests/tradeMachine/stepienObligations.test.js --run
```

**Output**:
```
 RUN  v1.6.1 /Users/brenthibbitts/Desktop/ScoutZero

 ✓ src/tests/tradeMachine/stepienObligations.test.js  (15 tests) 16ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  07:38:26
   Duration  7.91s
```

**Result**: ✅ All 15 Stepien tests pass. No regressions introduced.

---

## 6. Documentation Update

**File**: `docs/team-scrape/DRAFT_PICKS_PIPELINE.md`

Added new section "Swap Controller Extraction" after "Swap Partner Extraction Patterns" and before "Via Hygiene":

```markdown
### Swap Controller Extraction

When parsing "X swap for Y" patterns (e.g., "via OKC swap for DAL"):
- `swapDetails.controller` = X (team that controls the swap and gets favorable choice)
- `swapDetails.swapWith` = [X] (swap partner)
- `status` stays `"own"` (not `"contested"`) when pattern appears with "Own or X"
- Do NOT set `via` when the only "via" in the text is part of swap-control wording ("via X swap for Y")

Example: "Own or OKC (via OKC swap for DAL)" on DAL's page:
- `originalTeam: "DAL"`, `owner: "DAL"`, `status: "own"`
- `swapDetails.controller: "OKC"`, `swapDetails.swapWith: ["OKC"]`
- `via` is undefined (not "OKC")
```

---

## Summary

All requirements met:
1. ✅ DAL 2028 pick correctly parsed as `status: "own"` (not "contested")
2. ✅ `swapDetails.controller: "OKC"` extracted and preserved
3. ✅ `via` field suppressed for swap-control wording
4. ✅ All validation commands pass
5. ✅ Stepien tests pass (no regressions)
6. ✅ Documentation updated with controller extraction rules
