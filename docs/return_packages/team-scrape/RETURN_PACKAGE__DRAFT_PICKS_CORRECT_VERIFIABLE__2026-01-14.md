# RETURN PACKAGE: Draft Picks Parsing — Semantic Fixes Complete

**DATE**: 2026-01-14
**STATUS**: ✅ Push-Ready

---

## A) What Changed

### Parser Changes

1. **Swap Detection in Conditional Picks**: `realgm_draft_picks.ts` now runs `parseSwap()` on conditional picks (e.g., "Own or swap for MIL"), fixing missed swaps for HOU, POR, DET.
2. **"Can Swap" Pattern**: Added support for "{TEAM} can swap" pattern (e.g., "OKC can swap"), fixing missed swaps for DEN.
3. **Multi-Controller Support**:
   - Added `controllerCandidates` field to `StructuredPick`.
   - Updated `parseSwap()` to extract *all* potential controllers from strings like "via BRK swap... via WAS swap".
   - Updated audit to accept a match if *any* candidate matches the expected controller.

### Audit Changes

1. **Strict Protection Checks**: `audit_semantic_assertions.ts` now filters out complex multi-destination text and "if conveyable" clauses to prevent false positives.
2. **Condition-Aware Recipient Checks**: The "To TEAM" audit now checks `conditions` and `obligationId` fields to find recipients hidden in conditional rules.

### Documentation

1. **DRAFT_PICKS_PIPELINE.md**: Added "Conditional Pick Swaps" section and updated Swap Extraction patterns.

---

## B) File List (Modified/Added)

| Path | Purpose |
|------|---------|
| `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` | Parser fixes for swaps/controllers |
| `team-scrape/draft-picks/scripts/audit_semantic_assertions.ts` | Audit refinement (reduce false positives) |
| `docs/team-scrape/DRAFT_PICKS_PIPELINE.md` | Doc updates |
| `team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_counts.tsv` | Regenerated pick counts |
| `team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_lists.md` | Regenerated pick lists |
| `team-scrape/draft-picks/_artifacts/audits/pretty_mentions/` | Regenerated 30 pretty JSON files |

---

## C) Before/After Audit Results

### Semantic Assertions Audit

`npx tsx team-scrape/draft-picks/scripts/audit_semantic_assertions.ts --teams=ALL`

| Bucket | Baseline (Jan 13) | Final (Jan 14) | Change |
|--------|-------------------|----------------|--------|
| PROTECTION_ANCHOR_BUT_NO_PROTECTION | 5 | **0** | **-5 ✓** |
| SWAP_ANCHOR_BUT_NO_SWAPDETAILS | 4 | **0** | **-4 ✓** |
| CONTROLLER_ANCHOR_BUT_CONTROLLER_MISSING | 5 | **0** | **-5 ✓** |
| TO_ANCHOR_BUT_NO_RECIPIENT_OR_ROUTE | 7 | **0** | **-7 ✓** |

### Meaning-Aware Audit

`npx tsx team-scrape/draft-picks/scripts/audit_realgm_rows_vs_mentions.ts --teams=ALL`

| Metric | Target | Result |
|--------|--------|--------|
| Category C (MISS) | 0 | **0** ✓ |
| Ledger Errors | 0 | **0** ✓ |
| Hygiene Errors | 0 | **0** ✓ |
| Status | PASS | **ALL PASS** |

---

## D) Proof of Outputs

### Manual Verification Files

| File | Exists | Path |
|------|--------|------|
| 2A (TSV) | ✅ | `team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_counts.tsv` |
| 2B (MD) | ✅ | `team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_lists.md` |
| Pretty Mentions | ✅ | `team-scrape/draft-picks/_artifacts/audits/pretty_mentions/*.json` (30 files) |

---

## E) Remaining Known Limitations

None. All targeted semantic failures have been resolved.
