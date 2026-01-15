# Return Package: Draft Assets Conditional Pick Beneficiary Fix

## Date: 2026-01-15

## Summary

Fixed the draft assets builder to correctly assign conditional/protected picks to the **beneficiary team** (the team that will RECEIVE the pick if conditions are met) rather than the **owner team** (the team that retains the pick if protection triggers).

### Problem

`npm run draft-picks:verify:local` was failing with:

- `❌ UTA LAL_2027_1st not found in UTA draftAssets`
- LAL incorrectly showed LAL_2027_1st as `conditional_right`

The Lakers' 2027 1st round pick is top-4 protected to Utah. Utah should hold this as a tradeable conditional_right asset, not the Lakers.

### Solution

Updated `buildDraftAssets.ts` with three key changes:

1. **Added `extractBeneficiaryTeam()` helper** - Extracts the beneficiary from:
   - `obligationId` suffix (e.g., `LAL_2027_1st_obligation_UTA` → UTA)
   - `recipient` field
   - `conveyanceObligation.conditions.ifConveys` text
   - `conveyanceObligation.description`

2. **Updated `classifyAssetType()`** - Conditional_right is now assigned to the beneficiary team, not the owner

3. **Added cross-team scanning** - Two-pass approach loads all ledgers, then scans for conditional picks where the current team is the beneficiary in OTHER teams' ledgers

## Files Modified

| File | Change |
|------|--------|
| [`buildDraftAssets.ts`](file:///Users/brenthibbitts/Desktop/ScoutZero/team-scrape/shared/ledger/buildDraftAssets.ts) | Added `normalizeTeamCode()`, `extractBeneficiaryTeam()`, updated `classifyAssetType()`, added cross-team scanning in `buildDraftAssets()` |

## Proof Snippets

### UTA has LAL_2027_1st as conditional_right

From [`UTA.json`](file:///Users/brenthibbitts/Desktop/ScoutZero/team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/UTA.json):

```json
{
  "assetId": "LAL_2027_1st_conditional_right_UTA",
  "pickId": "LAL_2027_1st",
  "year": 2027,
  "round": 1,
  "team": "UTA",
  "originalTeam": "LAL",
  "assetType": "conditional_right",
  "certainty": "conditional",
  "protection": "top-4 protected",
  "conditionsText": "Protected: top-4 protected",
  "isSwap": false,
  "tradeableNow": false
}
```

### DAL has LAL_2029_1st as outright_pick

From [`DAL.json`](file:///Users/brenthibbitts/Desktop/ScoutZero/team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/DAL.json):

```json
{
  "assetId": "LAL_2029_1st_outright_pick_DAL",
  "pickId": "LAL_2029_1st",
  "year": 2029,
  "round": 1,
  "team": "DAL",
  "originalTeam": "LAL",
  "assetType": "outright_pick",
  "certainty": "certain",
  "protection": null,
  "isSwap": false,
  "tradeableNow": false
}
```

### LAL no longer incorrectly owns conditional_right

From [`LAL.json`](file:///Users/brenthibbitts/Desktop/ScoutZero/team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/LAL.json) - LAL_2027_1st is NOT present. LAL only has 7 assets: LAL_2026_1st, LAL_2028_1st, WAS_2028_2nd (swap), LAL_2030_1st, LAL_2031_1st, LAL_2032_1st, LAL_2032_2nd.

## Verification Output

```text
npm run draft-picks:verify:local

🔍 Running sanity checks...
   ✅ UTA has LAL_2027_1st as conditional_right with protection
   ✅ DAL has LAL_2029_1st as outright_pick

⚠️  AUDIT PASSED WITH WARNINGS: 10 non-critical issues
Exit code: 0
```

## beneficiaryTeam Resolution Rules

The `extractBeneficiaryTeam()` function determines who receives a conditional pick through this priority order:

1. **Explicit `recipient` field** - If present and is a valid 3-letter team code
2. **`obligationId` suffix** - Pattern: `*_obligation_XXX` (e.g., `LAL_2027_1st_obligation_UTA` → UTA)
3. **`conveyanceObligation.conditions.ifConveys`** - Extracts "to TEAM" patterns or team names like "Utah"
4. **`conveyanceObligation.description`** - Fallback extraction from description text

Team code normalization is applied: UTH→UTA, PHO→PHX, BRK→BKN, SAN→SAS, GOS→GSW
