# Return Package: Draft Picks → Team Draft Assets (Trade Machine-Ready)

**Status**: PENDING VALIDATION  
**Date**: 2026-01-14  
**Master Doc**: `docs/team-scrape/DRAFT_PICKS_PIPELINE.md`

---

## 1. Summary

This execution implements a canonical `draftAssets` derived view per team that the Trade Machine uses to display and select draft picks for trade packages.

**Goal Achieved**:

- Created `draftAssets` view with tradeable draft assets (outright, conditional, swap)
- Wired Trade Machine to consume `draftAssets.picks` as canonical source
- Added UI display for asset type and conditions
- Created validation audit for sanity checks

---

## 2. What Changed

- **NEW**: `buildDraftAssets.ts` - Derives canonical draftAssets from ledger views
- **NEW**: `audit_draft_assets_invariant.ts` - Validates UTA/DAL sanity checks + coverage
- **NEW**: `npm run draft-picks:verify:local` - Fast iteration without scraping
- **MODIFIED**: `stage_team.ts` - Loads and attaches draftAssets to team docs
- **MODIFIED**: `firebaseTeamPlanHelpers.js` - Populates draftAssets in hydrateBaseTeam
- **MODIFIED**: `useTradeMachine.js` - Reads from draftAssets.picks with fallback chain
- **MODIFIED**: `TradePickRow.jsx` - Displays asset type badge and conditions text
- **MODIFIED**: `package.json` - Added verify:local script, updated verify script
- **MODIFIED**: `DRAFT_PICKS_PIPELINE.md` - Documented draftAssets
- **MODIFIED**: `DRAFT_PICKS_COMMANDS.md` - Added new commands

---

## 3. Files Added/Modified

| File                                                              | Action   | Purpose                        |
| ----------------------------------------------------------------- | -------- | ------------------------------ |
| `team-scrape/shared/ledger/buildDraftAssets.ts`                   | Added    | Derive draftAssets from ledger |
| `team-scrape/draft-picks/scripts/audit_draft_assets_invariant.ts` | Added    | Validate invariants            |
| `team-scrape/shared/firestore_staging/scripts/stage_team.ts`      | Modified | Load/attach draftAssets        |
| `src/features/architect/utils/firebaseTeamPlanHelpers.js`         | Modified | Populate draftAssets           |
| `src/features/architect/hooks/useTradeMachine.js`                 | Modified | Read from draftAssets.picks    |
| `src/features/architect/tradeMachine/TradePickRow.jsx`            | Modified | Display asset type/conditions  |
| `package.json`                                                    | Modified | Add verify:local script        |
| `docs/team-scrape/DRAFT_PICKS_PIPELINE.md`                        | Modified | Document draftAssets           |
| `docs/commands/DRAFT_PICKS_COMMANDS.md`                           | Modified | Add new commands               |

---

## 4. Commands to Run

### Full Pipeline (with scrape)

```bash
npm run draft-picks:verify
```

### Local Verify (no scrape - fast iteration)

```bash
npm run draft-picks:verify:local
```

### Build Draft Assets Only

```bash
npx tsx team-scrape/shared/ledger/buildDraftAssets.ts
```

### Run Draft Assets Audit Only

```bash
npx tsx team-scrape/draft-picks/scripts/audit_draft_assets_invariant.ts
```

---

## 5. Audit Summaries

### Draft Assets Invariant Audit

**Report**: `team-scrape/draft-picks/_artifacts/audits/draft_assets_invariant_report.json`

**Expected Results**:

- Teams with assets files: 30/30
- UTA LAL_2027_1st check: PASS (conditional_right with protection)
- DAL LAL_2029_1st check: PASS (outright_pick)
- Coverage issues: 0 (or minimal non-critical)

**Run Command**:

```bash
npx tsx team-scrape/draft-picks/scripts/audit_draft_assets_invariant.ts
```

---

## 6. Proof Outputs

### UTA → LAL_2027_1st (Expected: conditional_right)

```bash
grep -A15 "LAL_2027_1st" team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/UTA.json
```

**Expected Output**:

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
  "protection": "Top-4 protected",
  "conditionsText": "Protected: Top-4 protected | ...",
  "tradeableNow": true
}
```

### DAL → LAL_2029_1st (Expected: outright_pick)

```bash
grep -A15 "LAL_2029_1st" team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/DAL.json
```

**Expected Output**:

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
  "tradeableNow": true
}
```

---

## 7. Known Limitations

1. **Swap Resolution Not Simulated**: Draft assets with `assetType: swap_right` represent the ability to swap, but the actual resolution (which pick is better) is not computed until trade execution.

2. **Protection Text Parsing**: Some protection text may not parse perfectly from RealGM. The `conditionsText` field provides human-readable fallback.

3. **Contested Picks**: Picks with `status: contested` are included in draftAssets but marked `tradeableNow: false`. These cannot be traded until the outcome is known.

4. **Schema Validation**: The `BaseTeamDocZ` schema does not yet include `draftAssets`. It is stripped during validation in `stage_team.ts`.

---

## 8. Trade Machine Integration

The Trade Machine now reads picks in this priority order:

```javascript
const rawPicks = data.draftAssets?.picks || data.draftPicks || data.picks || [];
```

The `TradePickRow` component displays:

- **Asset Type Badge**: Green (Outright), Amber (Conditional), Purple (Swap)
- **Conditions Text**: Truncated with full text in tooltip

---

## 9. Next Steps (Optional Enhancements)

1. Update `BaseTeamDocZ` schema to include `draftAssets` field
2. Add swap resolution simulation for pre-trade preview
3. Add pick conveyance tracking for multi-year conditions
4. Add "all picks" view that shows both owned and owed picks

---

## 10. Validation Checklist

- [ ] `npm run draft-picks:verify:local` passes
- [ ] All 30 teams have draftAssets files
- [ ] UTA has LAL_2027_1st as conditional_right
- [ ] DAL has LAL_2029_1st as outright_pick
- [ ] `audit_draft_assets_invariant` passes
- [ ] Trade Machine loads picks from draftAssets
- [ ] TradePickRow displays asset type badges
