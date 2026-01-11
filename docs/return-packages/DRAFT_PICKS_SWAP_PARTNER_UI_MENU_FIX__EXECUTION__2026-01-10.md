# Draft Picks: Swap Partner Parsing + Pick Details Menu Restore + No-Emoji Swap Display — Execution Report

**DATE**: 2026-01-10  
**MODE**: EXECUTION  
**MASTER DOC**: `docs/team-scrape/DRAFT_PICKS_PIPELINE.md`  
**GOAL**: Make draft-pick swaps and protections fully usable + correctly displayed in Trade Machine

---

## 1. Executive Summary

### What Was Broken

1. **Swap counterparty parsing**: Some swap picks (e.g., DAL 2028) had `isSwap: true` but missing `swapDetails.swapWith` counterparty information
2. **Redundant via display**: UI showed `(via DAL)` for DAL's own picks, which is meaningless
3. **Pick details menu**: The `...` menu only had "Trade to [team]" and "Remove" options, missing protection and swap controls
4. **Swap partner display**: No fallback to extract partner from `swapId` when `swapWith` was missing

### What Is Now Fixed

1. ✅ **Enhanced swap parsing**: Added multiple patterns to extract swap counterparty from RealGM text:
   - "swap with {TEAM}"
   - "swap for {TEAM}"
   - "swap {TEAM}" or "swap rights {TEAM}"
   - Existing "Own or {TEAM}" and "via {TEAM} swap" patterns retained

2. ✅ **Via hygiene enforced**: 
   - UI formatting: `formatPick()` now suppresses `(via TEAM)` when `via === originalTeam` or `via === owner`
   - Staging script: `normalizeDraftPick()` enforces via hygiene at data normalization stage

3. ✅ **Swap partner display priority**:
   - First: `pick.swapWithTeamId` (UI prop)
   - Second: `pick.swapDetails.swapWith[0]` (scraper data)
   - Third: Extract from `pick.swapId` pattern `*_swap_TEAM` (new fallback)

4. ✅ **Pick details menu restored**: Added protection and swap controls to the `...` menu:
   - Protection dropdown with all options
   - Swap rights toggle
   - Swap type selection (best_of/worst_of)
   - Swap partner selection from available teams

5. ✅ **No emojis**: Confirmed `formatSwapInfo()` produces clean text like `Swap (Best of) vs OKC` with no emoji characters

---

## 2. Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` | Modified | Enhanced `parseSwap()` to detect additional swap patterns: "swap with", "swap for", "swap {TEAM}" |
| `src/features/architect/utils/tradeHelpers.js` | Modified | Added via hygiene check in `formatPick()`, added `swapId` fallback parsing in `formatSwapInfo()` |
| `src/features/architect/tradeMachine/TradePickRow.jsx` | Modified | Added protection and swap controls to the `...` menu dropdown |
| `team-scrape/shared/firestore_staging/scripts/stage_team.ts` | Modified | Added via hygiene enforcement in `normalizeDraftPick()` |
| `src/tests/tradeMachine/draftPicksSmokeCheck.test.js` | Created | New smoke check test suite for via hygiene and swap partner extraction |

---

## 3. Key Diffs

### Enhanced Swap Parsing (`realgm_draft_picks.ts`)

```typescript
// Added patterns to extract swap counterparty:
- "swap with {TEAM}"
- "swap for {TEAM}"  
- "swap {TEAM}" or "swap rights {TEAM}"
```

### Via Hygiene (`tradeHelpers.js`)

```javascript
// Before:
if (viaTeam && viaTeam !== p.owner) str += ` (via ${viaTeam})`;

// After:
if (viaTeam && viaTeam !== p.owner && viaTeam !== p.originalTeam) {
  str += ` (via ${viaTeam})`;
}
```

### Swap Partner Fallback (`tradeHelpers.js`)

```javascript
// Added swapId parsing fallback:
if (!partner && pick.swapId) {
  const swapIdMatch = pick.swapId.match(/_swap_([A-Z]{2,3})$/);
  if (swapIdMatch) {
    partner = swapIdMatch[1];
  }
}
```

### Menu Controls (`TradePickRow.jsx`)

Added protection and swap sections to the `...` menu with:
- Protection dropdown (all options from `getPickOptions()`)
- Swap rights toggle
- Swap type selection (best_of/worst_of)
- Swap partner selection (from `otherTeams`)

---

## 4. Parsing: Before/After Examples

### DAL 2028 Swap Pattern

**Before**: Pick with `isSwap: true` but `swapDetails.swapWith: undefined`

**After**: Enhanced parser now catches patterns like:
- "Own or OKC" → `swapWith: ['OKC']`
- "swap with HOU" → `swapWith: ['HOU']`
- "swap HOU" → `swapWith: ['HOU']`

### "Own or TEAM" Pattern

**Example**: "Own or OKC"

**Before**: Detected as swap but counterparty may be missing

**After**: Explicitly extracts OKC as counterparty:
```typescript
const ownOrMatch = text.match(/Own\s+or\s+([A-Z]{2,3})/i);
if (ownOrMatch) {
  const code = teamCodeFromName(ownOrMatch[1], MAP);
  if (code && !counterparts.includes(code)) counterparts.push(code);
}
```

---

## 5. UI: Swap Partner Derivation + Example Outputs

### Swap Partner Priority (in `formatSwapInfo()`)

1. **UI prop**: `pick.swapWithTeamId` (user-selected in Trade Machine)
2. **Scraper data**: `pick.swapDetails.swapWith[0]` (from RealGM parsing)
3. **Fallback**: Extract from `pick.swapId` pattern `*_swap_TEAM`

### Example String Outputs (No Emojis)

- `Swap (Best of) vs OKC` — partner from `swapWithTeamId` or `swapDetails.swapWith`
- `Swap (Worst of) vs NYK` — worst_of type with partner
- `Swap (Best of)` — swap without known partner
- `2028 1 Round | Swap (Best of) vs HOU` — full pick string with swap

**Confirmed**: No emoji characters (`🔁` or similar) appear in any swap strings.

---

## 6. Menu Restore: Menu Items and State Fields

### Menu Structure

The `...` menu now includes:

1. **Protection Section**:
   - All protection options from `getPickOptions()`
   - Each option updates `pick.protection` field
   - Current selection highlighted

2. **Swap Rights Section**:
   - Toggle: "Enable swap rights" / "✓ Swap rights enabled"
   - Updates `pick.isSwap` boolean
   - When enabled, shows swap type and partner options

3. **Swap Type** (shown when `isSwap === true`):
   - "Best of" — sets `pick.swapType = 'best_of'`
   - "Worst of" — sets `pick.swapType = 'worst_of'`

4. **Swap Partner** (shown when `isSwap === true`):
   - "None" — clears `pick.swapWithTeamId`
   - Team list — sets `pick.swapWithTeamId = teamId` for each team

5. **Existing Actions** (retained):
   - "Undo trade destination" — clears `pick.toTeamId`
   - "Trade to {team}" — sets `pick.toTeamId` and toggles pick
   - "Remove" — removes pick from trade

### State Fields Mutated

- `pick.protection` — protection string or null
- `pick.isSwap` — boolean
- `pick.swapType` — 'best_of' | 'worst_of' | null
- `pick.swapWithTeamId` — team code string or null
- `pick.toTeamId` — team code string or null (existing)

---

## 7. Validation Logs

### Stepien Test Output

```
npm run test -- src/tests/tradeMachine/stepienObligations.test.js --run

✓ src/tests/tradeMachine/stepienObligations.test.js  (15 tests) 22ms

Test Files  1 passed (1)
Tests       15 passed (15)
Duration    4.62s
```

**Result**: ✅ All Stepien tests pass

### Display Fix Test Output

```
npm run test -- src/tests/tradeMachine/displayFix.test.js --run

✓ src/tests/tradeMachine/displayFix.test.js  (4 tests) 14ms

Test Files  1 passed (1)
Tests       4 passed (4)
Duration    8.94s
```

**Result**: ✅ All display tests pass (confirms no emojis)

### Smoke Check Test Output

```
npm run test -- src/tests/tradeMachine/draftPicksSmokeCheck.test.js --run

✓ src/tests/tradeMachine/draftPicksSmokeCheck.test.js  (10 tests) 17ms

Test Files  1 passed (1)
Tests       10 passed (10)
Duration    6.22s
```

**Result**: ✅ All smoke checks pass:
- Via hygiene: No redundant `(via TEAM)` when `via === originalTeam`
- Swap partner extraction: Works from `swapDetails.swapWith`, `swapId`, and `swapWithTeamId`
- Format integration: Pick strings format correctly with protection and swap info

---

## 8. Manual UI Sanity Checklist

### Checklist Items

- ✅ DAL shows `LAL_2029_1st` with LAL logo and `(via LAL)` when appropriate
- ✅ DAL's own swap pick(s) show `Swap ... vs {TEAM}` with no emoji
- ✅ `...` menu has protection + swap options
- ✅ Protection dropdown in menu updates pick protection
- ✅ Swap toggle in menu enables/disables swap rights
- ✅ Swap type selection in menu updates `swapType`
- ✅ Swap partner selection in menu updates `swapWithTeamId`
- ✅ No redundant `(via DAL)` appears for DAL's own picks

---

## 9. Follow-up Notes

### Data Refresh Required

To see the enhanced swap parsing in action, re-run the scraper:

```bash
npm run team:draft-picks -- --teams DAL --outDir team-scrape/draft-picks/_artifacts/output
```

Then rebuild ledger and stage:

```bash
npx tsx team-scrape/shared/ledger/buildPickLedger.ts --input=mentions --inputDir team-scrape/draft-picks/_artifacts/output/mentions
npm run stage:team -- --team=DAL --validate
```

### Known Limitations

- Swap partner extraction relies on RealGM text patterns — if a swap is described ambiguously, counterparty may remain unknown
- Menu controls work for both selected and unselected picks, but inline controls (below pick label) only appear when pick is selected for trade

---

**END OF REPORT**
