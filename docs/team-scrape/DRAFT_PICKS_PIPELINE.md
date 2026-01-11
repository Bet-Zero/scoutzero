# DRAFT PICKS PIPELINE

## Overview

Scrape and process NBA draft picks from RealGM into a canonical, UI-ready format for the Trade Machine.

## Goals

- Accurate extraction of draft picks from RealGM.
- Correct handling of swaps, protections, and traded picks (“via”).
- Canonical data contract that the Trade Machine can render without special cases.

---

## Canonical Pick Contract (Source of Truth)

**ID**

- `id`: `{ORIGINAL}_{YEAR}_{1st|2nd}` (e.g., `LAL_2029_1st`) — stable forever

**Teams**

- `originalTeam`: origin of the draft slot (logo MUST use this)
- `owner`: current owner (who controls/trades the asset)

**Via**

- `via` is optional display metadata only.
- Hygiene: omit `via` when `via === originalTeam`.
- Suppress `via` when it's only swap-control wording (e.g., "via OKC swap for DAL").

**Swaps**

- `isSwap: true` when swap rights exist
- `swapDetails.swapWith?: string[]` (canonical partner list)
- `swapDetails.swapType?: string` (e.g., `bilateral`, `favorable`, `multiway`)
- `swapDetails.favorable?: 'most' | 'least' | null`
- `swapDetails.controller?: string` — Team that controls the swap (gets favorable choice)
- `swapId` may exist and can be used as a fallback to infer partner if `swapWith` is missing.

**Multiway Pools** (contested allocation, e.g., "Two most favorable of DAL, HOU and PHX to HOU")

- `swapDetails.poolTeams?: string[]` — Teams in the pool
- `swapDetails.allocation?: { topN: number, topNTo: string, remainderTo?: string }`
- `status: "contested"` — Outcome is unknown
- `tradeable: false` — Cannot be traded as a concrete pick
- `stepienEligible: false` — Doesn't count for Stepien rule

**Metadata (Debugging)**

- `metadata.realgmRawText?: string` - The exact text parsed from RealGM for this pick row
- `metadata.realgmTeamPage?: string` - Team code whose page was scraped
- Used for debugging parsing issues and supporting future RealGM format variants

---

## Completed Tasks

- [x] Fix swap counterparty extraction for "Own or TEAM" format.
- [x] Fix swap counterparty extraction for "(via A swap for B)" format.
- [x] Remove meaningless "via" when via == originalTeam.
- [x] Update Trade Machine UI to show swap partners without emojis.
- [x] Extract swap controller from "X swap for Y" patterns.
- [x] Handle multiway pool allocations with poolTeams/allocation.
- [x] Exclude contested/non-tradeable picks from inventory view.

---

## Parsing Rules (Updated)

### Swap Detection

Mark `isSwap = true` when any apply:

1) Text contains “swap”
2) Text contains “most favorable” / “least favorable”
3) Pattern: `Own or {TEAM}` → `swapDetails.swapWith = ['{TEAM}']`
4) Pattern: `(via {A} swap for {B})`
   - set `swapDetails.swapWith` to the “other team” relative to the current team context:
     - if current team is `{B}`, partner is `{A}`
     - otherwise partner is `{B}` (fallback)

### Swap Partner Extraction Patterns

The scraper extracts swap partners from RealGM text using these patterns (case-insensitive, supports both team codes and full team names):

1. **"Own or {TEAM}"** - e.g., "Own or OKC" or "Own or Oklahoma City"
2. **"swap with {TEAM}"** - e.g., "swap with HOU" or "swap with Houston Rockets"
3. **"swap for {TEAM}"** - e.g., "via SAC swap for ATL"
4. **"via {TEAM}"** - e.g., "via OKC"
5. **"swap {TEAM}"** or **"swap rights {TEAM}"** - e.g., "swap OKC" or "swap rights Oklahoma City"
6. **"{TEAM} has the right to swap"** - e.g., "Oklahoma City has the right to swap"

All patterns use `teamCodeFromName()` to resolve both abbreviations (e.g., "OKC") and full team names (e.g., "Oklahoma City" or "Oklahoma City Thunder") to standard 2-3 letter team codes.

### Swap Controller Extraction

When parsing "X swap for Y" patterns (e.g., "via OKC swap for DAL"):

- `swapDetails.controller` = X (team that controls the swap and gets favorable choice)
- `swapDetails.swapWith` = [X] (swap partner)
- `status` stays `"own"` (not `"contested"`) when pattern appears with "Own or X"
- Do NOT set `via` when the only "via" in the text is part of swap-control wording ("via X swap for Y")

**Fallback extraction** for parenthesized patterns:

1. Try primary regex: `/(?:via\s+)?([A-Za-z0-9 .']+?)\s+swap\s+for\s+/`
2. If no match, try parenthesized: `/\(via\s+([A-Za-z0-9 .']+?)\s+swap\s+for\s+/`
3. If "Own or X" exists, infer controller from matching "via X swap for" pattern

Example: "Own or OKC (via OKC swap for DAL)" on DAL's page:

- `originalTeam: "DAL"`, `owner: "DAL"`, `status: "own"`
- `swapDetails.controller: "OKC"`, `swapDetails.swapWith: ["OKC"]`
- `via` is undefined (not "OKC")

### Multiway Pool Allocation

For patterns like "Two most favorable of DAL, HOU and PHX to HOU then other to BRK":

- `swapDetails.poolTeams` = ["DAL", "HOU", "PHO"] (PHX normalized to PHO)
- `swapDetails.allocation` = { topN: 2, topNTo: "HOU", remainderTo: "BRK" }
- `swapDetails.swapType` = "favorable" or "multiway"
- `status` = "contested" (outcome is unknown)
- `tradeable` = false (cannot trade until outcome known)
- `stepienEligible` = false

### Pool Teams Parsing Rules

The regex captures team lists in these formats:

- `A, B and C` (standard)
- `A, B, and C` (Oxford comma)
- `A and B` (two teams)
- `A, B, C` (comma only)

Team codes are resolved via `teamCodeFromName()` with variant normalization:

| RealGM Code | Canonical Code |
|-------------|----------------|
| PHI | PHI |
| PHX | PHX | Phoenix: Canonical code is **PHX**. PHO is deprecated and normalized to PHX on input. |
| SAN | SAS |
| NOR, NO | NOP |
| BRO | BKN |
| GS | GSW |
| SA | SAS |
| NY | NYK |

### Via Hygiene

- Do not set `via` if it equals `originalTeam`.
- Suppress `via` when text starts with "Own" AND "via X swap for Y" is only swap-control wording.
- UI should also suppress `(via X)` when `X === originalTeam`.

---

## Ledger View Rules

### Inventory

Picks where:

- `owner === teamCode`
- AND `status !== "contested"`
- AND `tradeable !== false`

**Rationale**: Contested/non-tradeable picks don't represent guaranteed ownership.

### Obligations

Picks where:

- `originalTeam === teamCode`
- AND (`status === "outgoing"` OR `status === "conditional"` OR `owner !== teamCode`)

### Contested

Picks where:

- `status === "contested"`, OR
- `isSwap === true`, OR
- `swapDetails` exists, OR
- `contendingTeams` includes team, OR
- `recipient` === team, OR
- `route` contains team

### Dedupe Rule

Each by_team list (inventory, obligations, contested) is deduplicated by `id` field.

**Preference order** when duplicates exist:

1. Entries with `metadata.realgmRawText` present
2. Entries with richer `swapDetails` (poolTeams/allocation/controller)
3. First stable occurrence

> [!NOTE]
> The same pick ID may appear in multiple buckets (e.g., both obligations AND contested) if it qualifies for both classification rules. This is expected behavior.

---

## Trade Machine Display Rules

- Logo: use `originalTeam`
- Label: `YYYY {round} Round`
- Via label: show only when `via` exists and `via !== originalTeam`
- Swap text: show partner using priority order:
  1) `pick.swapWithTeamId` (UI override field)
  2) `pick.swapDetails.swapWith[0]` (scraper data)
  3) Parse from `pick.swapId` pattern `*_swap_TEAM` (fallback)
- Display format: `Swap (Best of) vs OKC` or `Swap (Worst of) vs HOU`
- **No emojis** in swap display strings

---

## League-wide Correctness Audit

The correctness of the draft picks pipeline is verified by a "Meaning-Aware" audit script that compares live RealGM data against local artifacts.

### Matching Logic (Fuzzy / Token-Based)

Instead of exact string matching, the audit uses a token overlap score to handle:

- Minor formatting differences (punctuation, whitespace).
- Split rows (one RealGM row becoming multiple pick objects).
- Team code variations (BKN vs BRK in text).

### Comparison Classifications

When a RealGM row does not find a "Strong Match" (Score >= 0.60), it is classified:

**A) METADATA MISMATCH (Low Risk)**

- **Condition**: Partial match found (Score >= 0.35).
- **Implication**: The pick exists but text differs slightly (e.g. "To BRK" vs "To Brooklyn").

**B) EXTRACTION GAP (Medium Risk)**

- **Condition**: No text match, BUT mention artifacts exist for that Team/Year/Round bucket.
- **Implication**: The row was likely split or significantly transformed during parsing.

**C) MISSING (Real Bug - High Risk)**

- **Condition**: No text match AND No mentions in that Team/Year/Round bucket.
- **Implication**: The scraper failed to extract this pick entirely.

### Hygiene Rules

- **Team Codes**: The audit normalizes `BRK` -> `BKN`, `PHO` -> `PHX`, `UTH` -> `UTA` to prevent false "Ledger Invariant" failures.
- **Ledger Invariants**: Validates that all inventory/obligation/contested picks use canonical team codes.
