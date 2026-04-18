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

1. Text contains “swap”
2. Text contains “most favorable” / “least favorable”
3. Pattern: `Own or {TEAM}` → `swapDetails.swapWith = ['{TEAM}']`
4. Pattern: `(via {A} swap for {B})`
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
7. **"{TEAM} can swap"** - e.g., "OKC can swap"

All patterns use `teamCodeFromName()` to resolve both abbreviations (e.g., "OKC") and full team names (e.g., "Oklahoma City" or "Oklahoma City Thunder") to standard 2-3 letter team codes.

### Swap Controller Extraction

When parsing "X swap for Y" patterns (e.g., "via OKC swap for DAL"):

- `swapDetails.controller` = X (team that controls the swap and gets favorable choice)
- `swapDetails.controllerCandidates` = [X, ...] (list of all potential controllers found in text)
- `swapDetails.swapWith` = [X] (swap partner)
- `status` stays `"own"` (not `"contested"`) when pattern appears with "Own or X"
- Do NOT set `via` when the only "via" in the text is part of swap-control wording ("via X swap for Y")

**Multi-Controller Support:**
For complex text like "via BRK swap for PHX; via WAS swap for PHX", the parser identifies all candidates in `controllerCandidates`. The semantic audit accepts a match if the expected controller is present in either the primary `controller` field or the `controllerCandidates` list.

**Fallback extraction** for parenthesized patterns:

1. Try primary regex: `/(?:via\s+)?([A-Za-z0-9 .']+?)\s+swap\s+for\s+/`
2. If no match, try parenthesized: `/\(via\s+([A-Za-z0-9 .']+?)\s+swap\s+for\s+/`
3. If "Own or X" exists, infer controller from matching "via X swap for" pattern
4. If "{TEAM} can swap" exists, infer controller from that pattern (e.g., "OKC can swap")

Example: "Own or OKC (via OKC swap for DAL)" on DAL's page:

- `originalTeam: "DAL"`, `owner: "DAL"`, `status: "own"`
- `swapDetails.controller: "OKC"`, `swapDetails.swapWith: ["OKC"]`
- `via` is undefined (not "OKC")

### Conditional Pick Swaps

Conditional picks (patterns like "X-Y Own; Z-W to TEAM" or "Own or TEAM") are handled specially but also checked for swap semantics:

- Parser runs standard swap detection on the full text of conditional picks
- Allows catching swaps like: "1-14 Own or swap for MIL; 15-30 to CHI"
- Conditional picks with swaps will have both `status="conditional"` and `isSwap=true`

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

| RealGM Code | Canonical Code | Notes                                                                                  |
| ----------- | -------------- | -------------------------------------------------------------------------------------- |
| PHI         | PHI            |                                                                                        |
| PHX         | PHX            | Phoenix: Canonical code is **PHX**. PHO is deprecated and normalized to PHX on input.  |
| BKN         | BKN            | Brooklyn: Canonical code is **BKN**. BRK is deprecated and normalized to BKN on input. |
| SAN         | SAS            |                                                                                        |
| NOR, NO     | NOP            |                                                                                        |
| BRO, BRK    | BKN            | Legacy variants normalized to canonical BKN                                            |
| GS          | GSW            |                                                                                        |
| SA          | SAS            |                                                                                        |
| NY          | NYK            |                                                                                        |

### Via Hygiene

- Do not set `via` if it equals `originalTeam`.
- Suppress `via` when text starts with "Own" AND "via X swap for Y" is only swap-control wording.
- UI should also suppress `(via X)` when `X === originalTeam`.

---

## Ledger View Rules

## Source of Truth for App / Firestore

- **Source of truth (push-ready):** `team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team/*.json`
- **Mentions are raw scrape artifacts:** `team-scrape/draft-picks/_artifacts/output/mentions/` and must **never** be pushed directly to `baseTeams`.

The Firestore staging step (`team-scrape/shared/firestore_staging/scripts/stage_team.ts`) loads ledger-derived views and uses `inventory` as the canonical `draftPicks` list (with optional `draftPicksInventory` / `draftPicksObligations` / `draftPicksContested` fields).
This prevents “outgoing from source page” artifacts (e.g., `To DAL` shown on LAL page) from disappearing from the recipient team’s owned inventory.

### Inventory

Picks where:

- `owner === teamCode`
- AND `status !== "contested"`

**Rationale**: Outgoing picks parsed from other team pages are often marked `tradeable:false`.
Those are still owned assets for the recipient and must appear in inventory for audit/validation.

### Obligations

Picks where:

- `originalTeam === teamCode`
- AND (`status === "outgoing"` OR `status === "conditional"` OR `owner !== teamCode`)

### Contested

Picks where:

- `status === "contested"`, OR
- `isSwap === true`, OR
- `swapDetails` exists, OR
- `contendingTeams` includes team

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
  1. `pick.swapWithTeamId` (UI override field)
  2. `pick.swapDetails.swapWith[0]` (scraper data)
  3. Parse from `pick.swapId` pattern `*_swap_TEAM` (fallback)
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

---

## Team Code Canonicalization

The pipeline enforces canonical team codes to ensure consistency across all outputs.

### Canonical Codes

| Team          | Canonical | Deprecated/Variant | Notes                              |
| ------------- | --------- | ------------------ | ---------------------------------- |
| Phoenix Suns  | **PHX**   | PHO                | PHO normalized to PHX on input     |
| Brooklyn Nets | **BKN**   | BRK, BRO           | BRK/BRO normalized to BKN on input |

### Where Normalization Occurs

1. **`CODE_VARIANTS` map** in `realgm_draft_picks.ts` (line ~262):

   ```typescript
   const CODE_VARIANTS: Record<string, string> = {
     PHO: 'PHX',
     BRK: 'BKN',
     BRO: 'BKN',
     // ... other variants
   };
   ```

2. **`teamCodeFromName()` function**: All team name/code lookups pass through this normalizer first.

3. **Audit script**: The `normalizeTeamCode()` function ensures comparison logic handles legacy codes gracefully.

### Verification

Run `grep -R '"BRK"' team-scrape/draft-picks/_artifacts/output` and `grep -R '"PHO"' team-scrape/draft-picks/_artifacts/output` after any rebuild. Both must return **0 matches**.

---

## Command Map

| Step           | npm Script               | Description                                    |
| -------------- | ------------------------ | ---------------------------------------------- |
| **Scrape**     | `draft-picks:scrape`     | Scrape RealGM draft picks for all 30 teams     |
| **Build**      | `draft-picks:build`      | Build ledger + draft assets from mentions      |
| **Reports**    | `draft-picks:reports`    | Generate TSV/MD manual verification outputs    |
| **Manual Check** | `draft-picks:assets-manual-check` | Generate clean one-line-per-pick output |
| **Audits**     | `draft-picks:audits`     | Run semantic, inventory, and assets invariants |
| **Verify**     | `draft-picks:verify`     | Build + Reports + Audits (no scrape)           |
| **Full E2E**   | `draft-picks:scrape-verify` | Scrape + verify (full end-to-end)           |
| **Stage**      | `stage:team`             | Stage team data for Firestore                  |
| **Push**       | `team:push`              | Push staged data to Firestore                  |
| **Publish**    | `team:publish`           | Stage + Push in one command                    |

> [!IMPORTANT]
> Verify commands (`draft-picks:verify`, `draft-picks:scrape-verify`) do NOT push to Firestore.

---

## Push-Ready Verification Checklist

### Quick Commands

```bash
# Fast local verification (no scrape, uses existing mentions)
npm run draft-picks:verify

# Full end-to-end verification (includes scrape)
npm run draft-picks:scrape-verify

# Individual steps for debugging
npm run draft-picks:build
npm run draft-picks:reports
npm run draft-picks:audits
```

### Definition of Push-Ready

A build is "push-ready" when **audits pass**:

| Audit                        | Criteria                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| Year Coverage                | All teams have 1st round picks through REQUIRED_MAX_YEAR (2032)   |
| Semantic Assertions          | All categories = 0                                                |
| Recipient Inventory Invariant | Failures = 0                                                     |
| Draft Assets Invariant       | PASS (UTA LAL_2027_1st + DAL LAL_2029_1st sanity checks)          |

### Manual Verification Outputs

These files support human cross-checking against external sources (e.g., Fanspo):

| File            | Location                                                                | Purpose                                        |
| --------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| Pick counts TSV | `team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_counts.tsv` | Per-team inventory/obligation/contested counts |
| Pick lists MD   | `team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_lists.md`   | Detailed pick breakdown by team                |
| **Draft Assets MD** | `team-scrape/draft-picks/_artifacts/audits/draft_assets_team_lists.md` | **Clean Trade Machine asset review (recommended)** |
| **Manual Check MD** | `team-scrape/draft-picks/_artifacts/audits/draft_assets_manual_check.md` | **One-line-per-pick for external site cross-referencing** |
| Pretty mentions | `team-scrape/draft-picks/_artifacts/audits/pretty_mentions/`            | Human-readable JSON (2-space indent)           |

> [!TIP]
> For manual Trade Machine asset verification, use `draft_assets_team_lists.md`. It provides a clean, scroll-proof view with one table per team, sorted by year, with clear team separators.
>
> For fast cross-referencing against external sources (Fanspo, RealGM, etc.), use `draft_assets_manual_check.md`. It provides a compact one-line-per-pick view optimized for visual scanning. Format: `YEAR | ROUND | ORIGIN | CONDITIONS`

---

## Draft Assets (Trade Machine Source)

### Overview

The `draftAssets` view is the **canonical source** for the Trade Machine and team page pick displays. It represents tradeable draft assets that can be included in trade packages.

While the ledger views (inventory/obligations/contested) are debugging-oriented buckets, `draftAssets` is the consumer-facing derived view.

### Data Flow

```text
RealGM Scrape → Mentions → Ledger Builder → Ledger Views (by_team)
                                               ↓
                                      Draft Assets Builder
                                               ↓
                                      draft_assets/{TEAM}.json
                                               ↓
                                      stage_team.ts (staging)
                                               ↓
                                      baseTeams/{TEAM}.json (draftAssets field)
                                               ↓
                                      Trade Machine / Team Page
```

### Asset Types

| Type                | Description                                         | Certainty   |
| ------------------- | --------------------------------------------------- | ----------- |
| `outright_pick`     | Team owns the pick unconditionally                  | certain     |
| `conditional_right` | Team has rights depending on protections/conditions | conditional |
| `swap_right`        | Team can exercise swap rights with another team     | conditional |

### Draft Asset Schema

```typescript
interface DraftAsset {
  assetId: string; // Stable ID: {pickId}_{assetType}_{team}
  pickId: string; // e.g., LAL_2027_1st
  year: number;
  round: number;
  team: string; // Beneficiary team (who can trade it)
  originalTeam: string; // Source of the draft slot
  assetType: 'outright_pick' | 'conditional_right' | 'swap_right';
  certainty: 'certain' | 'conditional';
  protection?: string | null;
  conditionsText?: string; // Human-readable conditions
  isSwap?: boolean;
  swapDetails?: object;
  source: {
    srcTeamPage?: string;
    rawText?: string;
    obligationId?: string;
  };
  tradeableNow: boolean; // Trade Machine-ready (see below)
  // Stepien/other restrictions tracked via: stepienEligible, tradeable fields
}
```

### Building Draft Assets

```bash
# Build draft assets from ledger views
npx tsx team-scrape/shared/ledger/buildDraftAssets.ts
```

Output: `team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/{TEAM}.json`

### Validation Invariants

The draft assets audit (`audit_draft_assets_invariant.ts`) verifies:

1. **UTA must have LAL_2027_1st** as `conditional_right` with protection/conditionsText AND `tradeableNow: true`
2. **DAL must have LAL_2029_1st** as `outright_pick` AND `tradeableNow: true`
3. All 30 teams must have a draftAssets file
4. Conditional/protected ledger picks must have corresponding draftAssets entries

### tradeableNow Semantics (Trade Machine-Ready)

**Definition**: `tradeableNow` answers the question: *"Can this asset be selected and included in a trade package UI today?"*

| Value | Meaning |
|-------|---------|
| `true` | Asset can be selected in Trade Machine |
| `false` | Asset is literally non-transferable (extremely rare) |

**Trade Machine Rule**: ALL valid asset types (`outright_pick`, `conditional_right`, `swap_right`) have `tradeableNow: true` by default.

**What tradeableNow does NOT encode**:

- **Stepien rule blocking** → Use `stepienEligible` field
- **Contested status** → Asset still tradeable as a conditional right
- **Trade restrictions** → Use `tradeable` field or `blockedReason` for complex cases

> [!IMPORTANT]
> The previous incorrect behavior set `tradeableNow: false` for contested picks and Stepien-blocked years. This is WRONG for Trade Machine semantics. Those constraints are informational restrictions that do NOT prevent UI selection.

### Conditional Pick Beneficiary Resolution

For conditional/protected picks, the **beneficiary team** (who receives the conditional_right asset) is determined by `extractBeneficiaryTeam()` in priority order:

1. **Explicit `recipient` field** - If present and is a valid 3-letter team code
2. **`obligationId` suffix** - Pattern: `*_obligation_XXX` (e.g., `LAL_2027_1st_obligation_UTA` → UTA)
3. **`conveyanceObligation.conditions.ifConveys`** - Extracts "to TEAM" patterns or team names like "Utah"
4. **`conveyanceObligation.description`** - Fallback extraction from description text (e.g., "top-4 protected to Utah")

**Team code normalization** is applied: `UTH→UTA`, `PHO→PHX`, `BRK→BKN`, `SAN→SAS`, `GOS→GSW`

> [!IMPORTANT]
> The conditional_right asset is assigned to the **beneficiary** (recipient), NOT the owner. The owner retains the pick conditionally if protection triggers, but this is not a tradeable asset - only the recipient's conditional_right can be traded.

### Trade Machine Integration

The Trade Machine reads picks in this priority order:

1. `team.draftAssets.picks` (canonical source)
2. `team.draftPicks` (fallback)
3. `team.picks` (legacy fallback)

The `TradePickRow` component displays:

- Asset type badge (Outright/Conditional/Swap)
- Conditions text (truncated with tooltip)
- Protection selector for trade customization

---

---

## Year Coverage Configuration

The scraper and audits enforce year coverage through a configurable horizon:

```typescript
// TODO: Derive NEXT_DRAFT_YEAR from config or current date logic
const NEXT_DRAFT_YEAR = 2026;
const REQUIRED_MAX_YEAR = NEXT_DRAFT_YEAR + 6; // 2032
```

### Scraper Behavior

1. **Smart Wait Logic**: `fetchTeamHtml()` waits for:
   - "Future 1st Round Picks" header to appear
   - Year 2032 to be present in page content
   - "Loading, please wait" text to disappear

2. **Retry on Incomplete**: `scrapeTeamPage()` validates:
   - Computes `maxYear` from parsed picks
   - If `maxYear < REQUIRED_MAX_YEAR`, retries once with a fresh browser session
   - Throws `INCOMPLETE_SCRAPE` error if still incomplete after retry

### Audit Guard

The `audit_mentions_year_coverage.ts` script:

- Loads each team's mentions file
- Computes `maxYear` for 1st round picks
- Asserts `maxYear >= REQUIRED_MAX_YEAR`
- Exits non-zero if any team fails

This audit runs as the **first step** in `draft-picks:audits` to fail fast on incomplete scrapes.

---

## Why Both Ledger Views and Draft Assets Exist

| View         | Purpose                                 | Consumer                 |
| ------------ | --------------------------------------- | ------------------------ |
| Ledger Views | Debugging, auditing, Stepien validation | Pipeline scripts, audits |
| Draft Assets | Trade Machine picks, team page display  | Application UI           |

The ledger views preserve the full complexity of pick ownership (inventory, obligations, contested). Draft Assets simplifies this into a single "what can this team trade" list.
