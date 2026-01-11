# Execution Return Package: DAL Multiway Pool Fix + Dedupe

**Date**: 2026-01-11  
**Master Doc**: [DRAFT_PICKS_PIPELINE.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/team-scrape/DRAFT_PICKS_PIPELINE.md)  
**Status**: COMPLETE

---

## 1. Executive Summary

### What Was Wrong

1. **poolTeams missing PHX**: The multiway pool regex captured "DAL, HOU" but missed "PHX" because:
   - The regex used a greedy capture that stopped too early
   - `teamCodeFromName()` didn't normalize PHX→PHO (RealGM uses "PHX", internal code uses "PHO")

2. **Contested list duplicates**: DAL_2029_1st appeared 3 times in the contested list (now correctly appears once per bucket thanks to dedupe)

### What Changed

1. **Fixed poolTeams regex** using lazy match `(.+?)` to capture all teams in "A, B and C" patterns
2. **Added CODE_VARIANTS map** to normalize PHX→PHO, PHL→PHI, and other RealGM code variants
3. **Added dedupeById helper** to `buildPickLedger.ts` with preference rules
4. **Updated master doc** with Pool Teams Parsing Rules and Dedupe Rule sections

---

## 2. Files Changed

| File | Changes |
|------|---------|
| [realgm_draft_picks.ts](file:///Users/brenthibbitts/Desktop/ScoutZero/team-scrape/draft-picks/scripts/realgm_draft_picks.ts) | Fixed poolTeams regex (.+?), added CODE_VARIANTS map, improved team list splitting |
| [buildPickLedger.ts](file:///Users/brenthibbitts/Desktop/ScoutZero/team-scrape/shared/ledger/buildPickLedger.ts) | Added `dedupeById()`, `shouldReplacePick()`, `getSwapRichness()` helpers, applied dedupe to views |
| [DRAFT_PICKS_PIPELINE.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/team-scrape/DRAFT_PICKS_PIPELINE.md) | Added Pool Teams Parsing Rules and Dedupe Rule sections |

---

## 3. Code Diff Snippets

### Fix 1: poolTeams Regex (realgm_draft_picks.ts)

```diff
-  // Use greedy capture for team list, but require explicit "then" to stop
+  // Fixed regex: Use non-greedy capture (.+?) that stops at " to " boundary.
   const poolAllocationMatch = text.match(
-    /(\w+)\s+most\s+favorable\s+of\s+([A-Za-z0-9, .']+(?:\s+and\s+[A-Za-z0-9 .']+)?)\s+to\s+...
+    /(\w+)\s+most\s+favorable\s+of\s+(.+?)\s+to\s+([A-Za-z0-9 .']+?)\s+then\s+...
```

### Fix 2: CODE_VARIANTS Map (realgm_draft_picks.ts)

```typescript
const CODE_VARIANTS: Record<string, string> = {
  PHX: 'PHO', // Phoenix: RealGM uses PHX, we use PHO
  NOR: 'NOP', // New Orleans
  BRO: 'BKN', // Brooklyn
  SAN: 'SAS', // San Antonio
  GS: 'GSW',  // Golden State
  NY: 'NYK',  // New York
  NO: 'NOP',  // New Orleans
  SA: 'SAS',  // San Antonio
  PHL: 'PHI', // Philadelphia
};
```

### Fix 3: dedupeById Helper (buildPickLedger.ts)

```typescript
function dedupeById(picks: CanonicalPick[]): CanonicalPick[] {
  const byId = new Map<string, CanonicalPick>();
  for (const pick of picks) {
    const existing = byId.get(pick.id);
    if (!existing) {
      byId.set(pick.id, pick);
    } else if (shouldReplacePick(existing, pick)) {
      byId.set(pick.id, pick);
    }
  }
  return Array.from(byId.values());
}
```

**Applied in deriveTeamPickViews:**

```diff
   for (const views of viewsByTeam.values()) {
-    views.inventory = sortPicks(views.inventory);
+    views.inventory = sortPicks(dedupeById(views.inventory));
     // ... same for obligations and contested
```

---

## 4. Proof Objects

### DAL_2029_1st from draft_picks_mentions_DAL.json

```json
{
  "id": "DAL_2029_1st",
  "year": 2029,
  "round": 1,
  "status": "contested",
  "originalTeam": "DAL",
  "owner": "DAL",
  "stepienEligible": false,
  "tradeable": false,
  "isSwap": true,
  "recipient": "HOU",
  "swapDetails": {
    "swapType": "favorable",
    "swapWith": ["HOU"],
    "favorable": "most",
    "poolTeams": ["DAL", "HOU", "PHO"],
    "allocation": {
      "topN": 2,
      "topNTo": "HOU",
      "remainderTo": "BRK"
    }
  },
  "metadata": {
    "realgmRawText": "Two most favorable of DAL, HOU and PHX to HOU then other to BRK...",
    "realgmTeamPage": "DAL"
  }
}
```

**Verified**: `poolTeams` includes `["DAL", "HOU", "PHO"]` ✅

### DAL by_team Dedupe Verification

```javascript
// Run: Checked for duplicates within each bucket
Contested dupes: []      // ✅ No duplicates
Obligations dupes: []    // ✅ No duplicates
Inventory dupes: []      // ✅ No duplicates

DAL_2029_1st in contested: 1   // ✅ Exactly once
DAL_2029_1st in obligations: 1 // ✅ Exactly once (different bucket)
```

---

## 5. Command Outputs

### DAL Scrape

```bash
npm run team:draft-picks -- --teams DAL --outDir team-scrape/draft-picks/_artifacts/output
```

```
Year 2029: "Two most favorable of DAL, HOU and PHX to HOU then other to BRK..."
• First round picks: 5
• Second round picks: 7
• Wrote 14 picks to mentions file
• Wrote 10 picks to inventory file
```

### Ledger Build

```bash
npx tsx team-scrape/shared/ledger/buildPickLedger.ts --input=mentions --inputDir team-scrape/draft-picks/_artifacts/output/mentions
```

```
📊 Deduplicated 24 picks across multiple team files
   Created 382 unique ledger entries
✅ Wrote 30 team view files
   Total inventory picks: 202
   Total obligations: 126
   Total contested: 2124
   DAL: inventory=7, obligations=6, contested=70
```

### Stage Team

```bash
npm run stage:team -- --team=DAL --validate
```

```
✅ baseTeams document staged successfully.
   📊 Ledger views:
      - draftPicksInventory: 7 picks
      - draftPicksObligations: 6 picks
      - draftPicksContested: 70 picks
```

### Stepien Tests

```bash
npm run test -- src/tests/tradeMachine/stepienObligations.test.js --run
```

```
 ✓ validateStepien - Obligations Wiring (15)
   ✓ Test 1: Existing obligation causes Stepien failure (3)
   ✓ Test 2: Conditional/protected obligation reserves year (4)
   ✓ Test 3: Swap worst_of does not reserve year (3)
   ✓ Edge cases (5)

 Test Files  1 passed (1)
      Tests  15 passed (15) ✅
```

---

## 6. Master Doc Updates

Added to [DRAFT_PICKS_PIPELINE.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/team-scrape/DRAFT_PICKS_PIPELINE.md):

1. **Pool Teams Parsing Rules** - Documents supported list formats (A, B and C / A, B, and C / A and B / A, B, C) and code variant normalization table

2. **Dedupe Rule** - Documents "dedupe by id per bucket" with preference order:
   - Prefer entries with `metadata.realgmRawText`
   - Prefer richer `swapDetails` (poolTeams/allocation/controller)
   - First stable occurrence

---

## 7. Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| DAL_2029_1st has poolTeams including PHO (was PHX) | ✅ PASS |
| DAL_2029_1st NOT in inventory | ✅ PASS (in contested) |
| DAL_2029_1st in contested exactly once | ✅ PASS |
| No duplicate IDs in DAL by_team lists | ✅ PASS |
| Stepien tests pass | ✅ 15/15 PASS |
| Master doc updated | ✅ PASS |

---

**END OF RETURN PACKAGE**
