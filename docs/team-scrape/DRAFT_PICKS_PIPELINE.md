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

**Swaps**

- `isSwap: true` when swap rights exist
- `swapDetails.swapWith?: string[]` (canonical partner list)
- `swapDetails.swapType?: string` (e.g., `bilateral`, `favorable`)
- `swapDetails.favorable?: 'most' | 'least' | null`
- `swapId` may exist and can be used as a fallback to infer partner if `swapWith` is missing.

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
4. **"via {TEAM} swap"** - e.g., "via OKC swap"
5. **"swap {TEAM}"** or **"swap rights {TEAM}"** - e.g., "swap OKC" or "swap rights Oklahoma City"
6. **"{TEAM} has the right to swap"** - e.g., "Oklahoma City has the right to swap"

All patterns use `teamCodeFromName()` to resolve both abbreviations (e.g., "OKC") and full team names (e.g., "Oklahoma City" or "Oklahoma City Thunder") to standard 2-3 letter team codes.

### Swap Controller Extraction

When parsing "X swap for Y" patterns (e.g., "via OKC swap for DAL"):

- `swapDetails.controller` = X (team that controls the swap and gets favorable choice)
- `swapDetails.swapWith` = [X] (swap partner)
- `status` stays `"own"` (not `"contested"`) when pattern appears with "Own or X"
- Do NOT set `via` when the only "via" in the text is part of swap-control wording ("via X swap for Y")

Example: "Own or OKC (via OKC swap for DAL)" on DAL's page:

- `originalTeam: "DAL"`, `owner: "DAL"`, `status: "own"`
- `swapDetails.controller: "OKC"`, `swapDetails.swapWith: ["OKC"]`
- `via` is undefined (not "OKC")

### Via Hygiene

- Do not set `via` if it equals `originalTeam`.
- UI should also suppress `(via X)` when `X === originalTeam`.

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
