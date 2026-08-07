# Architect CBA Canon v2.0 — Phase 2 Independent Cross-Model Audit (Stage A)

**Auditor:** Claude (Opus 5), independent cross-model verification for BZE-266.
**Stage:** A — blind independent audit. Frozen before any inspection of the Codex Phase 2 artifacts.
**Branch:** `architect/bze-266-phase2-claude-independent-audit`, created at Phase 1/R9 tip
`5aeaaf1d0e4a197cbf1aa22ecda5c0c62a333012`.

## Pinned inputs, as verified

| Pin | Stated | Verified |
|---|---|---|
| Application baseline | `69f8f6b6c6f8ea58f1a24eba7949f8ed09744288` | exists; `git diff 69f8f6b6 5aeaaf1d -- src/ tests/ scripts/ package.json` is **empty**, so auditing at the Phase 1 tip audits the pinned baseline byte-for-byte |
| Accepted Canon candidate | `6cf8aaf358c158a88e630e8a7336f7e9c3febc17` | exists; Canon file identical between `6cf8aaf3` and `5aeaaf1d` |
| Accepted Canon SHA-256 | `23fe883f…7ff76` | **matches** `docs/reference/cba/ARCHITECT_CBA_CANON.md` at the Phase 1 tip |
| Phase 1/R9 tip | quoted as `5aeaaf1da0e4…` | the repository commit is `5aeaaf1d0e4a197cbf1aa22ecda5c0c62a333012`. The quoted string carries one extra character; the short prefix resolves unambiguously to the intended commit. Transcription artifact, not a wrong repository state. |
| Codex Phase 2 candidate | `f63452d5c57ad3b9ef927de5dfedaf49272eaa9a` | exists; adds exactly three files, none read during Stage A |

Blindness control: the Stage A branch is rooted at `5aeaaf1d`, where none of
`ARCHITECT_CBA_CANON_V2_PHASE2_AUDIT_SUMMARY.md`,
`ARCHITECT_CBA_CANON_V2_PHASE2_IMPLEMENTATION_GAPS.json` or
`cba_canon_v2_phase2_integrity.py` exists on disk.

## Universe

The active audit universe is the v2 registry at §15.10 — **61 GROUPs, 815 active
LEAFs**, confirmed by independent parse of both the main table (§15.10.2, 815 rows)
and the detail table (§15.10.3, 815 rows). No historical `CBA-…` identity carries a
verdict. Families: A 151, C 417, R 118, L 102, S 27.

Every leaf carries an independently derived verdict across implementation state,
representation, calculation, enforcement, explanation/UI, lifecycle/persistence,
runtime-input availability, evidence strength, severity, product exclusion, and
shared root cause. 32 leaves received individually verified overrides where the
family profile would have misstated them; the rest inherit a family profile that
was itself derived from reading that family's implementation root.

## Headline counts

| Implementation state | Leaves |
|---|---:|
| correct | 5 |
| partial | 521 |
| incorrect | 15 |
| absent | 274 |
| not applicable | 0 |

| Severity | Leaves |
|---|---:|
| high | 330 |
| medium | 291 |
| low | 194 |

| Runtime input | Leaves |
|---|---:|
| available | 86 |
| partial | 498 |
| unavailable | 231 |

| Evidence strength | Leaves |
|---|---:|
| strong | 433 |
| moderate | 361 |
| weak | 21 |

**Intentional product exclusions: 0.** This is a finding, not an oversight. The five
owner-approved V1 exclusions in `architect-v1-completion-contract.md` (draft-night
experience, real-life franchise history, JSON/raw-data entry, the Offseason room,
entitlement and pick authoring controls) are *product surfaces*. None of them is a
CBA rule, and none of the 815 Canon leaves is discharged by them. W10 keeps
draft-asset rules explicitly in scope even while the draft-night room is excluded.

## Root-cause clusters

Ranked by leaves touched. These are the Phase 3 foundations; most individual leaves
cannot be repaired before their cluster is.

| Cluster | Leaves | Evidence |
|---|---:|---|
| RC8 — no performance/signing bonus model | 89 | `performanceBonus`/`signingBonus` return zero hits in `src/features/architect`; only a scalar `tradeBonus` exists |
| RC7 — rules unenforced for missing runtime input | 56 | `timingValidation.ts:66-68,259-260` retires the aggregation bar "until the live payload carries a reliable acquisition-date field" |
| RC12 — no Active/Inactive/Two-Way list model | 51 | roster is a flat array with a standard/two-way split; no lists, day clocks or game counts |
| RC9 — no waiver claim lifecycle | 51 | `waiverClaim`/`claimPriority`/`clearWaivers` return zero hits; waive is modelled as immediate release |
| RC10 — duplicate governed-value sources | 46 | `CBA_THRESHOLDS` vs `capProjections`; `capHolds.ts` scales vs `minimumSalaryRules` |
| RC2 — no Apron Team Salary ledger | 42 | all apron tests read Team Salary |
| RC11 — no external-determination model | 41 | no medical/expert/grievance/approval record with provenance |
| RC6 — stale hardcoded season parameters | 33 | `EXPANDED_TPE = 9_096_000`; `SEASONAL_CASH_LIMIT = 5_800_000`; 2024-25 rookie scale in `capHolds.ts` |
| RC4 — pathless salary matching | 27 | one band ceiling instead of five named TPE paths |
| RC1 — single-ledger substitution | 23 | `computeTeamCapTotals.ts:274-286` + `:342-355` |
| RC5 — 3 of 11 transaction-restriction rows | 17 | `hardCapUtils.ts:38-49` |
| RC3 — no tax engine | 15 | `taxBill`/`taxRate` are optional passthrough schema fields |

### RC1 in detail — the foundation finding

`computeTeamCapTotals` derives one quantity,
`totalCapAllocations = players + deadMoney + capHolds + incompleteCharges`
(`computeTeamCapTotals.ts:274-279`). `createCanonicalTeamTotalsSnapshot` then assigns
that same number to `teamSalary`, `totalSalary`, `capHit`, `currentCapHit` and
**`taxablePayroll`**, and derives `isFirstApron`, `isSecondApron` and `isOverTax`
from it (`:342-355`).

`CBA2-A01.1` — the first leaf of the register — requires exactly the opposite: Team
Salary, Apron Team Salary, Tax-related Team Salary, player Compensation and per-team
trade-salary values are distinct quantities and "no ledger's value may be substituted
for another's." The verdict is **incorrect**, not absent: the quantity exists and is
computed, it is simply the wrong one for four of the five ledgers.

This single substitution is why C07 (11 leaves), C08 (8), A02.12, A05.1/A05.2 and
A12.4/A12.5 cannot be individually repaired. Splitting the ledger is a Phase 3
prerequisite, not one item among many.

## What is genuinely right

Calling this out matters as much as the gaps, because it bounds Phase 3.

- **Expanded TPE arithmetic is correct.** The three-band piecewise function in
  `salaryMatchingRules.ts:156-217` is algebraically identical to the Canon's
  `max(min(200%·O+K, 100%·O+A), 125%·O+K)`. It resembles the discredited five-tier
  formula but is not it. Only the input `A` is defective (a literal, ~$290 above the
  Canon-derived value, and unchanged in every other season).
- **Two-way cap treatment is correct.** `contractUtils.ts:447-449` zeroes the cap hit;
  the three-contract bound is a hard block.
- **Cash never enters Team Salary** (`CBA2-A08.5`), verified by the closed input list.
- **`validateStepien.ts`** is a 524-line all-branch evaluator — the strongest single
  rule implementation in the codebase.
- **`capRulesProfile`** is a real season-aware facade with `real`/`reported`/
  `projected` provenance tags, a STRICT gate, and a rookie-minimum genuinely derived
  from published cap growth. It is the correct pattern the stale constants should adopt.
- **Offer sheets** are a developed lifecycle (PENDING_MATCH/MATCHED/DECLINED,
  finalization gates, the 48-hour match window) — thicker than the Canon's L04 credit
  would suggest from a symbol search alone.
- **Rows A, B and C** of the Transaction Restrictions Table are correctly implemented.

## Specific defects worth naming

| Leaf | Verdict | Exact conflict |
|---|---|---|
| `CBA2-C03.2` | incorrect | Incomplete-roster charge fires below **14** (`rules.roster.minStandard`) rather than 12, and in every season phase; the rule is confined to July 1 through the day before the Regular Season. Silently inflates in-season Team Salary for any short-rostered team. |
| `CBA2-C01.4` | incorrect | `capHolds.ts:137-143` encodes 190/130/120 only. The EAPS-conditional 150% branch and the entire 300%/250% rookie-scale-fourth-year branch are missing, understating holds for post-rookie stars. |
| `CBA2-A08.1` | incorrect | Flat `$5,800,000` where the rule is 5.15% of the cap = `$8,495,491` at the 2026-27 cap. ~$2.7M too tight, not season-scaled. |
| `CBA2-A04.1` | incorrect | `computeMatchingValues:334` contains `enhancedKicker = effectiveKicker * 2` — a doubling with no CBA basis. |
| `CBA2-L03.1` | incorrect | `timingValidation.ts:117-122` builds December 15 from the trade date's own calendar year, so any January-June trade of an offseason-signed player is false-blocked. |
| `CBA2-A02.11` | incorrect | A below-cap team is routed unconditionally to `outgoing + capSpace` and can never elect the (iii)/(iv) paths, false-blocking a legal below-cap Expanded-path trade. |
| `CBA2-A02.12` | incorrect | The $250k allowance is zeroed only as a side effect of the pre-trade first-apron branch; the rule needs post-assignment Apron Team Salary. |
| `CBA2-A05.1` | incorrect | Apron test uses Team Salary, and first apron uses `>=` where the rule is strictly exceeds. |
| `CBA2-A03.5` | partial | The poison-pill average is computed correctly but fires on any `isRookieScale` player rather than a signed, unstarted §7(b) Extension, and is applied to both sides rather than only the acquiring team's Room test. |
| `CBA2-A06.1/.2` | absent | Deliberately retired pending an acquisition-date field — a data-ingest gap, not a logic defect. Phase 3 should treat it as foundation work, not a rule fix. |

## Method notes and self-imposed limits

- A located symbol was never treated as proof. `DPE`, `stretch`, `birdRights` and
  `conveyance` all return hits that do not discharge their leaves; each was read.
- Green tests were never treated as proof of Canon correctness, and missing tests
  never converted a working implementation into a failure. `CBA2-R03` is marked
  *partial with weak evidence* precisely because the code satisfies the rule by
  construction while nothing states or tests it.
- Absence was asserted only after a negative search across the plausible vocabulary.
  Two early absence calls (C02 unsigned first-round holds, C20 two-way treatment) were
  **withdrawn** on wider search and re-scored partial/correct.
- Missing UI never implied a calculation failure; explanation/UI is scored separately.
- Externally adjudicated rules (EXT authority, 12 leaves) are scored on whether the
  determination can be *supplied with provenance*, never on whether the app decides them.
- Exhaustive CBA depth was not treated as an approved product requirement. Where a
  leaf is fully absent but no V1 workflow depends on it, severity is Low —
  `CBA2-C09` (tax brackets, 7 leaves) is the clearest case: total absence, low severity.

## Bottom line for Phase 3

815 leaves, 279 of them fully absent or incorrect and 521 partial, but the work does
not decompose into 815 tasks. Twelve root-cause clusters account for the great
majority, and four of them — the single-ledger substitution, the absent apron ledger,
the missing bonus model, and the missing runtime inputs — gate most of the rest. Phase
3 should be sized and ordered by cluster, foundations first, not by leaf count.
