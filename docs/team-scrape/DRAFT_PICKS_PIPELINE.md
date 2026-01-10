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

### Via Hygiene

- Do not set `via` if it equals `originalTeam`.
- UI should also suppress `(via X)` when `X === originalTeam`.

---

## Trade Machine Display Rules

- Logo: use `originalTeam`
- Label: `YYYY {round} Round`
- Via label: show only when `via` exists and `via !== originalTeam`
- Swap text: show partner using:
  1) `pick.swapDetails.swapWith[0]` (preferred)
  2) fallback inference from `swapId` if needed
- No emojis in swap display.
