# PST Phase 3 Return Package: Text Normalization

## 1. Summary

Phase 3 successfully implemented a normalization and feature extraction layer for PST raw rows.

- **Normalized Text**: Standardized whitespace, cleaned bullets, and stripped non-breaking spaces.
- **Feature Extraction**: Deterministically identified Team Codes, Years, Rounds, and specific Pick References ("Team YYYY Round") from the text.
- **Flags**: Computed boolean flags for key trade concepts (swap, protection, rights, etc.).
- **No Interpretation**: Strictly adhered to the rule of avoiding legal interpretation (e.g., who "gets" the pick).

## 2. Files Created/Modified

- `team-scrape/draft-picks/scripts/pst/pst_text_features.ts` (New: Feature extraction library)
- `team-scrape/draft-picks/scripts/pst/pst_phase_3_normalize_text.ts` (New: Runner script)
- `data/pst/pst_phase_3_normalized_rows.json` (New: Output dataset)
- `data/pst/pst_phase_3_report.json` (New: Summary stats)
- `package.json` (Updated: Added `pst:phase-3` script)
- `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` (Updated status)

## 3. How to Run

```bash
npm run pst:phase-3
```

## 4. Key Metrics (Years 2026-2033)

- **Total Rows Processed**: 992
- **Row Kinds**:
  - Own: 262
  - Transaction: 588
  - Condition Not Met: 142
- **Flags Detected**:
  - Swaps: 322
  - Protections: 365
  - Least/Most Favorable: 514
  - Cash: 314
- **Pick References Found**: 580 rows had at least one explicit pick reference.

## 5. Example Rows

### Transaction Row (Complex Swap Option)

Note: Correctly identifies teams and flags, but correctly avoids guessing a pick ID for the swap option itself because it involves multiple teams.

```json
{
  "pickId": "CLE_2026_1st",
  "year": 2026,
  "round": 1,
  "originalTeam": "CLE",
  "displayOwner": "ATL",
  "rowKind": "transaction",
  "normalizedText": "Traded • De'Andre Hunter • Hawks option to swap 2026 first round picks (less favorable of Hawks, Spurs picks) with Cavaliers (?-?) • Hawks option to swap 2028 first round picks with Cavaliers (less favorable of Cavaliers, Jazz picks) (?-?) to Cavaliers for • Caris LeVert • Georges Niang • Hawks option to swap 2026 first round picks (less favorable of Hawks, Spurs picks) with Cavaliers (?-?) ...",
  "detectedTeamCodes": ["ATL", "CLE", "SAS", "UTA"],
  "detectedYears": [2025, 2026, 2027, 2028, 2029, 2031],
  "detectedPickRefs": [],
  "flags": {
    "mentionsSwap": true,
    "mentionsProtection": false,
    "mentionsLeastMostFavorable": true
  }
}
```

### Condition Not Met Row (Multiple Components)

Note: Successfully extracts referenced picks (`MIL_2025_1st`, etc.) where they are explicitly named in standard format.

```json
{
  "pickId": "MIL_2026_1st",
  "year": 2026,
  "round": 1,
  "originalTeam": "MIL",
  "displayOwner": "ATL",
  "rowKind": "condition_not_met",
  "normalizedText": "Traded • Jrue Holiday ... 2025 first round pick (from Bucks) (#19-Nolan Traoré) • Pelicans option to swap 2026 first round picks with Bucks (?-?) • 2027 first round pick (from Bucks) (?-?) ...",
  "detectedTeamCodes": ["DEN", "MIL", "NOP", "OKC"],
  "detectedPickRefs": ["MIL_2025_1st", "MIL_2026_1st", "MIL_2027_1st"],
  "flags": {
    "mentionsSwap": true,
    "mentionsProtection": false
  }
}
```

### Own Row (Empty Text)

Note: Correctly processed as empty text with no features.

```json
{
  "pickId": "TOR_2026_1st",
  "year": 2026,
  "round": 1,
  "originalTeam": "TOR",
  "displayOwner": "TOR",
  "rowKind": "own",
  "normalizedText": "",
  "detectedTeamCodes": [],
  "detectedPickRefs": [],
  "flags": {
    "mentionsSwap": false
  }
}
```

## 6. Known Limitations / Handoff to Phase 4

- **Conservative Pick Extraction**: The `detectedPickRefs` logic intentionally skips ambiguous references (e.g. "most favorable of Bucks, Pelicans picks") to avoid hallucinating a single owner for a multi-team clause. Phase 4 must parse these complex "swap/favorable" structures using specific grammar rules.
- **Reference Only**: The `detectedPickRefs` are *references found in text*, not necessarily the *asset represented by the row*. Phase 4 must determine the relationship (e.g. is this row *controlling* that pick, or just *mentioning* it?).
- **Anomalies**: Zero anomalies found in the 2026-2033 window (all rows had text unless they were "own" rows).

## 7. Phase Status

Phase 3 COMPLETE
