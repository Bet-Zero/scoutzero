/\*\*

- FILE: docs/team-scrape/PST_PHASE_5_1_ROUND_GATING_HOTFIX_RETURN_PACKAGE.md
- PURPOSE: Return package documenting Phase 5.1 round gating hotfix outputs and validation.
- OWNERSHIP: team-scrape/pst
-
- HISTORY:
- - 2026-01-17: Created return package for round/year gating hotfix (plan `plans/_archive/pst-phase-5-1-round-gating-hotfix/plan.md`)
-
- LINKS:
- - Plan: plans/\_archive/pst-phase-5-1-round-gating-hotfix/plan.md
- - Latest Chunk: n/a
    \*/

# PST Phase 5.1 Round Gating Hotfix Return Package

## 1) Summary

Added clause-level round/year gating so protections, swaps, conveyance, and selection specs only attach when the clause matches the pick's year+round. Rebuilt Phase 4/5 outputs and manual views; MIL_2026_2nd no longer carries first-round protections/swaps.

## 2) Files Changed

- team-scrape/draft-picks/scripts/pst/pst_pick_rule_parser.ts
- data/pst/pst_pick_rule_profiles_2026_2033.json
- data/pst/pst_needs_review_queue.json
- data/pst/pst_phase_4_report.json
- data/pst/pst_pick_overrides.json
- data/pst/pst_pick_rule_profiles_final_2026_2033.json
- data/pst/pst_pick_ledger_final_2026_2033.json
- data/pst/pst_phase_5_final_validation_report.json
- data/pst/manual_check_views.txt
- data/pst/manual_check_views_summary.json
- data/pst/manual_check_views/
- docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md
- docs/team-scrape/PST_PHASE_5_1_ROUND_GATING_HOTFIX_RETURN_PACKAGE.md
- plans/\_archive/pst-phase-5-1-round-gating-hotfix/plan.md

## 3) Commands Run

- npm run pst:phase-4
- npm run pst:phase-5
- npm run pst:manual-views

## 4) MIL_2026_2nd Before/After Encumbrances

**Before** (from data/pst/pst_pick_ledger_final_2026_2033.json):

```json
{
  "encumbrances": {
    "conveyance": [],
    "didNotConvey": [
      {
        "evidenceRowRefs": ["r2"],
        "reason": "unknown"
      }
    ],
    "protections": [
      {
        "appliesToYears": [
          2020, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2031
        ],
        "description": "protected top 4",
        "evidenceRowRefs": ["r2"],
        "protectedRange": {
          "end": 4,
          "start": 1
        },
        "type": "top_n"
      }
    ],
    "selectionSpecs": [
      {
        "controller": "ORL",
        "description": "ck (?-?) on 2020-11-18 | Traded \u2022 Magic option to swap 2026 first round picks wi",
        "evidenceRowRefs": ["r2"],
        "kind": "swap",
        "order": "least",
        "pool": ["MIL", "ORL"],
        "rank": 1,
        "round": 2,
        "year": 2026
      }
    ],
    "swaps": [
      {
        "controller": "ORL",
        "description": "ck (?-?) on 2020-11-18 | Traded \u2022 Magic option to swap 2026 first round picks with Suns (?-?) to Magic f",
        "direction": "swap_right",
        "evidenceRowRefs": ["r2"],
        "mostLeast": "least_favorable",
        "pool": ["MIL"],
        "round": 2,
        "year": 2026
      }
    ]
  },
  "evidenceRowRefs": ["r3", "r2", "r5", "r7"],
  "originalTeam": "MIL",
  "owner": "BOS",
  "ownershipSource": "PST_DISPLAY",
  "pickId": "MIL_2026_2nd",
  "round": 2,
  "year": 2026
}
```

**After** (from data/pst/pst_pick_ledger_final_2026_2033.json):

```json
{
  "encumbrances": {
    "conveyance": [],
    "didNotConvey": [
      {
        "evidenceRowRefs": ["r2"],
        "reason": "unknown"
      }
    ],
    "protections": [],
    "selectionSpecs": [],
    "swaps": []
  },
  "evidenceRowRefs": ["r3", "r2", "r5", "r7"],
  "originalTeam": "MIL",
  "owner": "BOS",
  "ownershipSource": "PST_DISPLAY",
  "pickId": "MIL_2026_2nd",
  "round": 2,
  "year": 2026
}
```

## 5) Final Validation

- Profiles: 480
- Ledger picks: 480
- needs_review: 0

## 6) Phase Status

COMPLETE
