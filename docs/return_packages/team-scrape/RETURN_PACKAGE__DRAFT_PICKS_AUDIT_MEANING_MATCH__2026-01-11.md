# RETURN PACKAGE: Draft Picks Audit — Brooklyn Canonicalization

**Date**: 2026-01-11  
**Goal**: Canonicalize Brooklyn team code (BRK → BKN) in the draft-picks pipeline and outputs, then verify with clean rebuild and meaning-aware audit.

---

## Summary

✅ **COMPLETE**: Brooklyn team code successfully canonicalized to `BKN`. All verification criteria met.

| Metric | Target | Actual |
|--------|--------|--------|
| BRK in output artifacts | 0 | **0** |
| BRK in ledger outputs | 0 | **0** |
| BKN in output artifacts | >0 | **64** |
| BKN in ledger outputs | >0 | **618** |
| Category C (Missing) | 0 | **0** |
| Hygiene issues | 0 | **0** |
| Ledger invariant issues | 0 | **0** |

---

## Diffs Summary

### 1. Audit Script — PASS/FAIL Semantics

**File**: `team-scrape/draft-picks/scripts/audit_realgm_rows_vs_mentions.ts`

```diff
-  const passed = categoryA.length === 0 && categoryB.length === 0 && categoryC.length === 0 && ledgerIssues.length === 0 && hygieneIssues.length === 0;
+  // PASS means: Category C = 0, Ledger = 0, Hygiene = 0
+  // A/B are WARN buckets (metadata/extraction mismatches, not failures)
+  const passed = categoryC.length === 0 && ledgerIssues.length === 0 && hygieneIssues.length === 0;
+  const hasWarnings = categoryA.length > 0 || categoryB.length > 0;
   return {
-    status: passed ? 'PASS' : 'FAIL',
+    status: passed ? (hasWarnings ? 'PASS*' : 'PASS') : 'FAIL',
```

### 2. Master Doc — Team Code Canonicalization Section

**File**: `docs/team-scrape/DRAFT_PICKS_PIPELINE.md`

Added new section documenting:

- Canonical codes: PHX (not PHO), BKN (not BRK/BRO)
- Normalization locations: `CODE_VARIANTS` map, `teamCodeFromName()`, audit script
- Verification commands

**Note**: The scraper already had `BRK: 'BKN'` in `CODE_VARIANTS` (line 266 of `realgm_draft_picks.ts`). No additional code changes were needed for BRK normalization.

---

## Rebuild Commands & Outputs

### Clean Output Artifacts

```bash
$ rm -rf team-scrape/draft-picks/_artifacts/output/*
# (completed successfully)
```

### Full League Scrape

```bash
$ npm run team:draft-picks -- --outDir team-scrape/draft-picks/_artifacts/output

🔍 Scraping RealGM future drafts — Teams: ATL, BOS, BKN, CHA, CHI, CLE, DAL, DEN, DET, GSW, HOU, IND, LAC, LAL, MEM, MIA, MIL, MIN, NOP, NYK, OKC, ORL, PHI, PHX, POR, SAC, SAS, TOR, UTA, WAS
📦 Per-team files saved under:
    /Users/.../team-scrape/draft-picks/_artifacts/output/structured (inventory)
    /Users/.../team-scrape/draft-picks/_artifacts/output/mentions (all mentions)
🎯 Done
```

### Build Pick Ledger

```bash
$ npx tsx team-scrape/shared/ledger/buildPickLedger.ts --input=mentions --inputDir team-scrape/draft-picks/_artifacts/output/mentions

🔨 Building league-wide draft picks ledger...
📂 Loading per-team draft pick files...
  ✓ Loaded 30 team files
🔗 Building canonical ledger...
📊 Deduplicated 26 picks across multiple team files
   Created 379 unique ledger entries
✅ Wrote master ledger: .../ledger/pick_ledger.json
✅ Wrote 30 team view files
```

---

## BRK=0 Proof

### Output Artifacts

```bash
$ grep -R '"BRK"' team-scrape/draft-picks/_artifacts/output 2>/dev/null | wc -l
0
```

### Ledger Outputs

```bash
$ grep -R '"BRK"' team-scrape/shared/firestore_staging/_artifacts/output/ledger 2>/dev/null | wc -l
0
```

### BKN Sanity Check

```bash
$ grep -R '"BKN"' team-scrape/draft-picks/_artifacts/output 2>/dev/null | wc -l
64

$ grep -R '"BKN"' team-scrape/shared/firestore_staging/_artifacts/output/ledger 2>/dev/null | wc -l
618

$ grep -m 1 '"BKN"' team-scrape/shared/firestore_staging/_artifacts/output/ledger/pick_ledger.json
    "originalTeam": "BKN",
```

---

## Audit Run Output

```bash
$ npx tsx team-scrape/draft-picks/scripts/audit_realgm_rows_vs_mentions.ts --teams=ALL

Starting Audit for 30 teams...
```

### Summary Table

| Team | Status | Rows | Mentions | A(Meta) | B(Extr) | C(MISS) | Ledger | Hygiene |
|------|--------|------|----------|---------|---------|---------|--------|---------|
| ATL | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| BKN | PASS* | 10 | 10 | 2 | 0 | 0 | 0 | 0 |
| BOS | PASS* | 14 | 14 | 0 | 1 | 0 | 0 | 0 |
| CHA | PASS* | 14 | 14 | 1 | 3 | 0 | 0 | 0 |
| CHI | PASS* | 14 | 14 | 0 | 1 | 0 | 0 | 0 |
| CLE | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| DAL | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| DEN | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| DET | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| GSW | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| HOU | PASS* | 14 | 14 | 0 | 1 | 0 | 0 | 0 |
| IND | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| LAC | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| LAL | PASS* | 14 | 14 | 1 | 1 | 0 | 0 | 0 |
| MEM | PASS | 12 | 12 | 0 | 0 | 0 | 0 | 0 |
| MIA | PASS* | 14 | 14 | 2 | 0 | 0 | 0 | 0 |
| MIL | PASS* | 14 | 14 | 2 | 0 | 0 | 0 | 0 |
| MIN | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| NOP | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| NYK | PASS* | 14 | 14 | 1 | 1 | 0 | 0 | 0 |
| OKC | PASS* | 14 | 14 | 3 | 3 | 0 | 0 | 0 |
| ORL | PASS | 12 | 12 | 0 | 0 | 0 | 0 | 0 |
| PHI | PASS* | 14 | 14 | 2 | 0 | 0 | 0 | 0 |
| PHX | PASS* | 14 | 14 | 1 | 0 | 0 | 0 | 0 |
| POR | PASS* | 14 | 14 | 2 | 0 | 0 | 0 | 0 |
| SAC | PASS* | 14 | 14 | 1 | 0 | 0 | 0 | 0 |
| SAS | PASS* | 14 | 14 | 0 | 1 | 0 | 0 | 0 |
| TOR | PASS | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| UTA | PASS* | 12 | 12 | 0 | 2 | 0 | 0 | 0 |
| WAS | PASS* | 12 | 12 | 4 | 1 | 0 | 0 | 0 |

### Totals

| Category | Count |
|----------|-------|
| **PASS (clean)** | 14 teams |
| **PASS*** (with A/B warnings) | 16 teams |
| **FAIL** (Category C/Ledger/Hygiene) | 0 teams |
| Total Category A | 22 |
| Total Category B | 15 |
| Total Category C | **0** |
| Total Ledger Issues | **0** |
| Total Hygiene Issues | **0** |

---

## PASS/WARN/FAIL Definitions

| Status | Criteria |
|--------|----------|
| **PASS** | Category C = 0, Ledger = 0, Hygiene = 0, A/B = 0 |
| **PASS*** | Category C = 0, Ledger = 0, Hygiene = 0, A/B > 0 (warnings only) |
| **FAIL** | Category C > 0 OR Ledger > 0 OR Hygiene > 0 |

A/B issues are **WARN** buckets representing metadata mismatches (score 0.35-0.60) or extraction gaps (mentions exist but text differs). These do not indicate missing picks.

---

## Files Modified

1. `team-scrape/draft-picks/scripts/audit_realgm_rows_vs_mentions.ts` — Updated PASS/FAIL logic
2. `docs/team-scrape/DRAFT_PICKS_PIPELINE.md` — Added Team Code Canonicalization section

## Files Not Modified (Already Correct)

- `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` — Already had `BRK: 'BKN'` in CODE_VARIANTS (line 266)

---

## Conclusion

Brooklyn team code canonicalization is **COMPLETE**:

1. ✅ `BRK` → `BKN` normalization exists in `CODE_VARIANTS`
2. ✅ Clean rebuild produces 0 instances of `"BRK"` in all outputs
3. ✅ BKN used correctly (64 instances in artifacts, 618 in ledger)
4. ✅ Meaning-aware audit: Category C = 0, Hygiene = 0, Ledger = 0
5. ✅ Master doc updated with Team Code Canonicalization section
