# Preflight: Swap Parsing Gaps Analysis

**Date**: 2026-01-10  
**Master Doc**: [`docs/team-scrape/DRAFT_PICKS_PIPELINE.md`](../DRAFT_PICKS_PIPELINE.md)  
**Status**: PREFLIGHT (Documentation Only - No Code Changes)

---

## 1. Executive Summary

### What's Broken

Swap picks are missing swap counterparty/controller fields in some cases, causing the UI to fail to display swap partners reliably. Specifically:

1. **DAL 2028 1st Round**: "Own or OKC (via OKC swap for DAL)" pattern fails to extract `swapDetails.swapWith = ["OKC"]` and `swapDetails.controller = "OKC"` consistently
2. **DAL 2029 1st Round**: "Two most favorable of DAL, HOU and PHX to HOU then other to BRK" multiway pool pattern may not correctly encode pool teams and allocation rules
3. **Via Hygiene**: Some swap picks incorrectly show `via` values (e.g., "(via DAL)" on DAL's own pick) when `via` should be suppressed for swap-control wording

### Why It's Broken

**Root Cause A (Parser Logic Gap)**: The parser extracts swap partners from multiple patterns but has edge cases:

- "Own or OKC (via OKC swap for DAL)" pattern: The `viaIsSwapControl` detection correctly suppresses `via`, but the `swapForControllerMatch` regex may not capture the controller when the pattern appears in parentheses
- Controller extraction happens BEFORE filtering `swapWith`, so if the page team is incorrectly included, controller may point to wrong team

**Root Cause B (Downstream Normalization)**: The staging/ledger code applies via hygiene but may not preserve `swapDetails.controller` if it's missing from the canonical pick structure

**Root Cause C (Data Model Gap)**: The canonical contract includes `swapDetails.controller` but validation doesn't enforce it, and the UI fallback chain doesn't account for controller when swapWith is missing

---

## 2. Evidence

### 2.1 Parser Function: `parseSwap()`

**File**: `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`  
**Lines**: 509-643

**Current Behavior**:

```typescript
export function parseSwap(text: string, MAP: Record<string, string>) {
  // ... swap detection logic ...

  // Pattern 1: "Own or {TEAM}"
  const ownOrMatch = text.match(
    /Own\s+or\s+([A-Za-z0-9 .']+?)(?:\s*[,;|()]|$)/i
  );
  if (ownOrMatch) {
    const code = teamCodeFromName(ownOrMatch[1].trim(), MAP);
    if (code && !counterparts.includes(code)) counterparts.push(code);
  }

  // Pattern 2: Controller extraction from "X swap for Y"
  let controller: string | undefined;
  const swapForControllerMatch = text.match(
    /(?:via\s+)?([A-Za-z0-9 .']+?)\s+swap\s+for\s+[A-Za-z0-9 .']+/i
  );
  if (swapForControllerMatch) {
    controller = teamCodeFromName(swapForControllerMatch[1].trim(), MAP);
  }

  // Pattern 3: Multiway pool allocation
  const poolAllocationMatch = text.match(
    /(\w+)\s+most\s+favorable\s+of\s+([A-Za-z0-9, .']+?)\s+to\s+([A-Za-z0-9 .']+?)\s+then\s+(?:other|remaining)\s+to\s+([A-Za-z0-9 .']+)/i
  );

  return {
    isSwap: true,
    details: {
      swapType,
      swapWith: counterparts.length ? counterparts : undefined,
      favorable: favorableTag,
      controller, // ✅ Extracted but may be undefined if pattern doesn't match
      poolTeams, // ✅ Extracted for multiway pools
      allocation, // ✅ Extracted for multiway pools
    },
  };
}
```

**Gap Identified**:

- The `swapForControllerMatch` regex requires "swap for" to appear AFTER the controller team name
- For "Own or OKC (via OKC swap for DAL)", the pattern "via OKC swap for DAL" should match, but if parentheses interfere with regex matching, controller may be undefined
- The `ownOrMatch` adds OKC to `counterparts`, but controller extraction happens independently - if controller extraction fails, we lose the "who controls" information

### 2.2 Pick Construction: `toStructured()`

**File**: `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`  
**Lines**: 1206-1347

**Current Behavior**:

```typescript
// Line 1206-1215: "Own" prefix detection
const startsWithOwn = /^Own\b/i.test(part);
if (startsWithOwn) {
  status = 'own';  // ✅ Correctly sets status to "own"
}

// Line 1258-1260: Via swap-control detection
const viaIsSwapControl = /via\s+[A-Za-z0-9 .']+\s+swap\s+for/i.test(part);

// Line 1273-1279: Via suppression logic
via: (startsWithOwn && viaIsSwapControl)
  ? undefined  // ✅ Correctly suppresses via when it's swap-control wording
  : via && via !== originalTeam && via !== owner
    ? via
    : undefined,

// Line 1283-1300: SwapDetails filtering
swapDetails: swap.details
  ? (() => {
      // Filter out page team from swapWith
      const filteredSwapWith = swap.details.swapWith?.filter(
        (t) => t !== row.teamCode
      );
      // Ensure bilateral swap type for "Own or TEAM"
      const finalSwapType =
        startsWithOwn && filteredSwapWith?.length === 1
          ? 'bilateral'
          : swap.details.swapType;
      return {
        ...swap.details,
        swapWith: filteredSwapWith?.length ? filteredSwapWith : undefined,
        swapType: finalSwapType,
        // ⚠️ controller is preserved IF it exists in swap.details
      };
    })()
  : undefined,
```

**Gap Identified**:

- Controller is preserved in the spread (`...swap.details`), but if `parseSwap()` didn't extract it, it won't be present
- The filtering logic removes page team from `swapWith`, but doesn't validate that controller is still valid after filtering

### 2.3 Downstream Normalization: `normalizeDraftPick()`

**File**: `team-scrape/shared/firestore_staging/scripts/stage_team.ts`  
**Lines**: 581-662

**Current Behavior**:

```typescript
function normalizeDraftPick(
  teamCode: string,
  pick: RawDraftPick
): NormalizedDraftPick {
  // ... normalization logic ...

  // Via hygiene: only set via if it's meaningful
  if (pick.via && pick.via !== normalized.originalTeam && pick.via !== owner) {
    normalized.via = pick.via; // ✅ Correctly applies via hygiene
  }

  // ⚠️ No explicit handling of swapDetails.controller
  // swapDetails is passed through as-is if present
}
```

**Gap Identified**:

- `swapDetails` is preserved but not validated or normalized
- If `controller` is missing from the incoming pick, it won't be added downstream

### 2.4 Expected Artifact Structure (DAL Mentions)

**Expected File**: `team-scrape/draft-picks/_artifacts/output/mentions/draft_picks_mentions_DAL.json`

**Expected Fields for DAL 2028 Swap Pick**:

```json
{
  "id": "DAL_2028_1st",
  "year": 2028,
  "round": 1,
  "status": "own",
  "originalTeam": "DAL",
  "owner": "DAL",
  "isSwap": true,
  "swapDetails": {
    "swapType": "bilateral",
    "swapWith": ["OKC"], // ⚠️ May be missing
    "controller": "OKC", // ⚠️ May be missing
    "favorable": null
  },
  "via": undefined, // ✅ Should be undefined (suppressed)
  "metadata": {
    "realgmRawText": "Own or OKC (via OKC swap for DAL)", // ✅ Should be present
    "realgmTeamPage": "DAL"
  }
}
```

**Expected Fields for DAL 2029 Multiway Pool**:

```json
{
  "id": "DAL_2029_1st",
  "year": 2029,
  "round": 1,
  "status": "contested", // ✅ Correctly marked as contested
  "originalTeam": "DAL",
  "owner": "DAL", // ⚠️ May be incorrect - outcome is unknown
  "isSwap": true,
  "swapDetails": {
    "swapType": "multiway",
    "poolTeams": ["DAL", "HOU", "PHX"], // ⚠️ May be missing
    "allocation": {
      "topN": 2,
      "topNTo": "HOU",
      "remainderTo": "BRK"
    },
    "favorable": "most"
  },
  "metadata": {
    "realgmRawText": "Two most favorable of DAL, HOU and PHX to HOU then other to BRK",
    "realgmTeamPage": "DAL"
  }
}
```

**Note**: Artifacts were not found on disk during preflight. Analysis is based on code logic and expected behavior.

---

## 3. Root Cause Analysis

### 3.1 DAL 2028: "Own or OKC (via OKC swap for DAL)"

**Raw Text**: `"Own or OKC (via OKC swap for DAL)"`  
**Expected Output**:

- `swapDetails.swapWith = ["OKC"]`
- `swapDetails.controller = "OKC"`
- `via = undefined`

**Parser Flow**:

1. **`parseSwap()` called with text**:
   - `ownOrMatch` matches "Own or OKC" → adds "OKC" to `counterparts` ✅
   - `swapForControllerMatch` should match "(via OKC swap for DAL)" → extracts "OKC" as controller ✅
   - BUT: Regex `/(?:via\s+)?([A-Za-z0-9 .']+?)\s+swap\s+for\s+[A-Za-z0-9 .']+/i` may not match text inside parentheses if the parentheses are part of the match boundary

2. **`toStructured()` processes the pick**:
   - `startsWithOwn = true` → `status = "own"` ✅
   - `viaIsSwapControl = true` → `via = undefined` ✅
   - `filteredSwapWith = ["OKC"]` (page team DAL filtered out) ✅
   - `controller` preserved from `swap.details.controller` IF it was extracted ✅

**Root Cause**:

- **Parser regex may fail on parenthesized text**: The `swapForControllerMatch` regex doesn't account for parentheses around the "via X swap for Y" pattern
- **No fallback**: If controller extraction fails, there's no fallback to infer controller from `swapWith[0]` when pattern is "Own or X (via X swap for Y)"

**Evidence from Code**:

- Line 589-594: Controller extraction regex doesn't handle parentheses
- Line 535-541: `ownOrMatch` stops at punctuation `(?:\s*[,;|()]|$)`, so "OKC" is extracted before the parentheses
- Line 1286-1288: Page team filtering happens AFTER controller extraction, so if controller = page team, it's not filtered

### 3.2 DAL 2029: "Two most favorable of DAL, HOU and PHX to HOU then other to BRK"

**Raw Text**: `"Two most favorable of DAL, HOU and PHX to HOU then other to BRK"`  
**Expected Output**:

- `swapDetails.poolTeams = ["DAL", "HOU", "PHX"]`
- `swapDetails.allocation = { topN: 2, topNTo: "HOU", remainderTo: "BRK" }`
- `status = "contested"` (outcome unknown)
- `owner` should reflect uncertainty (currently may be incorrectly set to "DAL")

**Parser Flow**:

1. **`parseSwap()` called with text**:
   - `poolAllocationMatch` matches pattern → extracts pool teams and allocation ✅
   - `swapType = "multiway"` (because `poolTeams` exists) ✅

2. **`toStructured()` processes the pick**:
   - Line 1332-1343: Multiway pool swap handling sets `status = "contested"` ✅
   - Sets `stepienEligible = false` ✅
   - Sets `tradeable = false` ✅
   - BUT: `owner` remains `row.teamCode` ("DAL") ⚠️

**Root Cause**:

- **Owner field doesn't reflect uncertainty**: For multiway pools, the final owner is unknown until the draft, but `owner` is set to the page team
- **Model gap**: There's no field to indicate "owner is uncertain" vs "owner is definitely DAL"

**Evidence from Code**:

- Line 1332-1343: Multiway pool handling correctly marks as contested but doesn't adjust `owner`
- Line 1217-1230: Owner assignment logic doesn't account for multiway pool uncertainty

---

## 4. Canonical Swap Contract

### 4.1 Bilateral Swaps

**Required Fields**:

```typescript
{
  isSwap: true,
  swapDetails: {
    swapType: "bilateral",
    swapWith: [string],        // REQUIRED: Partner team code
    controller?: string,        // REQUIRED for "X swap for Y": Team that controls swap
    favorable?: "most" | "least" | null
  }
}
```

**Validation Rules**:

- `swapWith.length === 1` (exactly one partner)
- If `controller` exists, `controller` must be in `swapWith` OR be the page team (for "Own or X (via X swap for Y)")
- `via` must be `undefined` if it's only swap-control wording

**Examples**:

| Raw Text                            | swapWith  | controller  | via         |
| ----------------------------------- | --------- | ----------- | ----------- |
| "Own or OKC"                        | `["OKC"]` | `undefined` | `undefined` |
| "Own or OKC (via OKC swap for DAL)" | `["OKC"]` | `"OKC"`     | `undefined` |
| "via OKC swap"                      | `["OKC"]` | `undefined` | `undefined` |

### 4.2 Multiway/Favorable Pools

**Required Fields**:

```typescript
{
  isSwap: true,
  status: "contested",  // REQUIRED: Outcome is unknown
  swapDetails: {
    swapType: "multiway" | "favorable",
    poolTeams?: [string],  // REQUIRED for pools: Teams in the pool
    allocation?: {         // REQUIRED for pools: How picks are allocated
      topN: number,
      topNTo: string,
      remainderTo?: string
    },
    favorable?: "most" | "least"
  },
  owner: string,  // ⚠️ Current owner (may be uncertain for pools)
  stepienEligible: false,  // REQUIRED: Can't guarantee ownership
  tradeable: false  // REQUIRED: Outcome unknown
}
```

**Validation Rules**:

- `poolTeams.length >= 2` (multiway requires multiple teams)
- `allocation.topNTo` must be in `poolTeams`
- `allocation.remainderTo` must be in `poolTeams` OR be a different team
- `owner` should reflect current best guess, but `status = "contested"` indicates uncertainty

**Examples**:

| Raw Text                                                          | poolTeams               | allocation                                       | owner               |
| ----------------------------------------------------------------- | ----------------------- | ------------------------------------------------ | ------------------- |
| "Two most favorable of DAL, HOU and PHX to HOU then other to BRK" | `["DAL", "HOU", "PHX"]` | `{ topN: 2, topNTo: "HOU", remainderTo: "BRK" }` | `"DAL"` (uncertain) |
| "Most favorable of DAL and HOU"                                   | `["DAL", "HOU"]`        | `undefined`                                      | `"DAL"` (uncertain) |

### 4.3 Via Hygiene Rules

**Rule**: `via` should only be set when it represents trade-chain origin, NOT swap-control wording.

**Suppress `via` when**:

1. `via === originalTeam`
2. `via === owner`
3. Pattern is "via X swap for Y" AND text starts with "Own" (swap-control wording)

**Examples**:

| Raw Text                            | originalTeam | owner   | via (before) | via (after)    |
| ----------------------------------- | ------------ | ------- | ------------ | -------------- |
| "Own or OKC (via OKC swap for DAL)" | `"DAL"`      | `"DAL"` | `"OKC"`      | `undefined` ✅ |
| "via DAL" (on DAL's page)           | `"DAL"`      | `"DAL"` | `"DAL"`      | `undefined` ✅ |
| "via LAL" (on DAL's page)           | `"DAL"`      | `"DAL"` | `"LAL"`      | `"LAL"` ✅     |

---

## 5. Minimal Implementation Plan

### 5.1 Parser Fixes (`realgm_draft_picks.ts`)

#### Fix 1: Improve Controller Extraction for Parenthesized Patterns

**Location**: `parseSwap()` function, lines 586-594

**Change**:

```typescript
// BEFORE:
const swapForControllerMatch = text.match(
  /(?:via\s+)?([A-Za-z0-9 .']+?)\s+swap\s+for\s+[A-Za-z0-9 .']+/i
);

// AFTER:
// Try both with and without parentheses context
let controller: string | undefined;
const swapForControllerMatch = text.match(
  /(?:via\s+)?([A-Za-z0-9 .']+?)\s+swap\s+for\s+[A-Za-z0-9 .']+/i
);
if (!swapForControllerMatch) {
  // Fallback: Try matching inside parentheses
  const parenMatch = text.match(
    /\(via\s+([A-Za-z0-9 .']+?)\s+swap\s+for\s+[A-Za-z0-9 .']+\)/i
  );
  if (parenMatch) {
    controller = teamCodeFromName(parenMatch[1].trim(), MAP);
  }
} else {
  controller = teamCodeFromName(swapForControllerMatch[1].trim(), MAP);
}
```

**Rationale**: Handles cases where "via X swap for Y" appears inside parentheses.

#### Fix 2: Fallback Controller Inference for "Own or X" Patterns

**Location**: `parseSwap()` function, after line 594

**Change**:

```typescript
// After controller extraction, if "Own or X" pattern exists and controller is missing:
if (!controller && ownOrMatch) {
  const ownOrTeam = teamCodeFromName(ownOrMatch[1].trim(), MAP);
  // If "Own or X (via X swap for Y)" pattern, controller = X
  const viaSwapForMatch = text.match(
    /\(via\s+([A-Za-z0-9 .']+?)\s+swap\s+for/i
  );
  if (viaSwapForMatch) {
    const viaTeam = teamCodeFromName(viaSwapForMatch[1].trim(), MAP);
    if (viaTeam === ownOrTeam) {
      controller = viaTeam; // Controller is the team in "Own or X"
    }
  }
}
```

**Rationale**: When "Own or OKC (via OKC swap for DAL)" pattern exists, infer controller from the "Own or X" match if controller extraction failed.

#### Fix 3: Validate Controller After Filtering swapWith

**Location**: `toStructured()` function, lines 1283-1300

**Change**:

```typescript
swapDetails: swap.details
  ? (() => {
      const filteredSwapWith = swap.details.swapWith?.filter(
        (t) => t !== row.teamCode
      );
      const finalSwapType =
        startsWithOwn && filteredSwapWith?.length === 1
          ? 'bilateral'
          : swap.details.swapType;

      // Validate controller after filtering
      let finalController = swap.details.controller;
      if (finalController && filteredSwapWith) {
        // Controller must be in swapWith OR be the page team (for "Own or X" swaps)
        if (!filteredSwapWith.includes(finalController) && finalController !== row.teamCode) {
          // Controller is invalid after filtering - clear it
          finalController = undefined;
        }
      }

      return {
        ...swap.details,
        swapWith: filteredSwapWith?.length ? filteredSwapWith : undefined,
        swapType: finalSwapType,
        controller: finalController,  // Use validated controller
      };
    })()
  : undefined,
```

**Rationale**: Ensures controller remains valid after filtering out the page team from swapWith.

### 5.2 Ledger/Staging Normalization (`stage_team.ts`)

#### Fix 4: Preserve swapDetails.controller in Normalization

**Location**: `normalizeDraftPick()` function, after line 613

**Change**:

```typescript
// Ensure swapDetails.controller is preserved
if (pick.swapDetails) {
  normalized.swapDetails = {
    ...pick.swapDetails,
    // Explicitly preserve controller if present
    controller: pick.swapDetails.controller,
  };
}
```

**Rationale**: Explicitly preserves controller field during normalization (currently preserved via spread but not guaranteed).

### 5.3 Validation Additions (`validateLedgerPicks.ts`)

#### Fix 5: Add Swap Partner Validation

**Location**: `validateSwapPartners()` function (already exists, lines 96-198)

**Enhancement**: Add validation for `controller` field:

```typescript
// In validateSwapPartners(), after checking swapWith:
if (pick.swapDetails?.controller) {
  const controller = pick.swapDetails.controller;
  // Controller should be in swapWith OR be the page team
  if (
    pick.swapDetails.swapWith &&
    !pick.swapDetails.swapWith.includes(controller)
  ) {
    if (controller !== pick.originalTeam) {
      console.warn(
        `⚠️  Controller "${controller}" not in swapWith for ${pick.id}`
      );
    }
  }
}
```

**Rationale**: Validates that controller is logically consistent with swapWith.

#### Fix 6: Add Multiway Pool Validation

**New Function**: `validateMultiwayPools()`

```typescript
async function validateMultiwayPools(): Promise<{
  success: boolean;
  poolPicks: Array<{
    id: string;
    year: number;
    round: number;
    hasPoolTeams: boolean;
    hasAllocation: boolean;
    status: string;
  }>;
}> {
  // Load DAL mentions
  const dalPicks = await loadJson<CanonicalPick[]>(dalMentionsPath);
  const poolPicks = dalPicks.filter(
    (p) => p.swapDetails?.poolTeams && p.swapDetails.poolTeams.length > 1
  );

  for (const pick of poolPicks) {
    // Validate poolTeams
    if (!pick.swapDetails.poolTeams || pick.swapDetails.poolTeams.length < 2) {
      console.warn(`⚠️  Pool pick ${pick.id} missing poolTeams`);
    }
    // Validate allocation
    if (!pick.swapDetails.allocation) {
      console.warn(`⚠️  Pool pick ${pick.id} missing allocation`);
    }
    // Validate status = contested
    if (pick.status !== 'contested') {
      console.warn(
        `⚠️  Pool pick ${pick.id} should be contested, got ${pick.status}`
      );
    }
  }

  return { success: true, poolPicks: [] };
}
```

**Rationale**: Ensures multiway pools are correctly represented with all required fields.

---

## 6. Risks / Unknown Formats

### 6.1 Known Edge Cases

1. **Nested Parentheses**: "Own or OKC (via OKC swap for DAL (from LAL))"
   - **Risk**: Regex may match wrong "swap for" pattern
   - **Mitigation**: Use non-greedy matching and validate controller against swapWith

2. **Multiple "via" Clauses**: "Own or OKC via LAL (via OKC swap for DAL)"
   - **Risk**: May extract wrong "via" as controller
   - **Mitigation**: Prioritize "swap for" pattern over generic "via" patterns

3. **Team Name Variations**: "Own or Oklahoma City" vs "Own or OKC"
   - **Risk**: `teamCodeFromName()` may fail on full team names
   - **Mitigation**: Current code handles this via `teamCodeFromName()` normalization

### 6.2 Unknown Formats (Future-Proofing)

1. **"X can swap with Y or Z"**: Multi-option swaps
   - **Current**: Not handled
   - **Recommendation**: Add pattern `/([A-Za-z0-9 .']+?)\s+can\s+swap\s+with\s+([A-Za-z0-9, .']+)/i`

2. **"Best of X, Y, Z"**: Alternative phrasing for "most favorable"
   - **Current**: Not explicitly handled (may match "most favorable")
   - **Recommendation**: Add pattern `/best\s+of\s+([A-Za-z0-9, .']+)/i` as alias for "most favorable"

3. **"Swap rights with X, Y"**: Explicit "rights" wording
   - **Current**: Handled via `swapTeamCodeMatch` pattern
   - **Status**: ✅ Already covered

### 6.3 Validation Gaps

1. **No Cross-Team Validation**: If DAL's page says "Own or OKC" and OKC's page says "Own or DAL", should validate consistency
   - **Recommendation**: Add ledger-level validation that checks swap pairs are consistent

2. **No Controller Validation**: Controller field is optional but should be validated when present
   - **Recommendation**: Add validation that `controller` is in `swapWith` OR is the page team (for "Own or X" swaps)

3. **No Allocation Validation**: Multiway pool allocation should validate that recipients are in poolTeams
   - **Recommendation**: Add validation that `allocation.topNTo` and `allocation.remainderTo` are logical given `poolTeams`

---

## 7. Next Execution Steps

### Immediate Actions (Parser Fixes)

1. **Update `parseSwap()`**:
   - Add parenthesized pattern matching for controller extraction
   - Add fallback controller inference for "Own or X" patterns
   - Test with DAL 2028 raw text: `"Own or OKC (via OKC swap for DAL)"`

2. **Update `toStructured()`**:
   - Add controller validation after filtering swapWith
   - Ensure controller is preserved in swapDetails

3. **Re-run Scraper**:
   - Scrape DAL page to generate fresh mentions file
   - Validate DAL 2028 pick has `swapDetails.swapWith = ["OKC"]` and `swapDetails.controller = "OKC"`

### Validation Actions

1. **Enhance `validateSwapPartners()`**:
   - Add controller validation logic
   - Check that controller is in swapWith OR is page team

2. **Add `validateMultiwayPools()`**:
   - Validate poolTeams and allocation fields
   - Check that status = "contested" for pool picks

### Documentation Actions

1. **Update Master Doc**:
   - Add controller field to canonical contract
   - Document via hygiene rules for swap-control wording
   - Add examples for multiway pools

---

## 8. Appendix: Code References

### Key Files

- **Parser**: `team-scrape/draft-picks/scripts/realgm_draft_picks.ts`
  - `parseSwap()`: Lines 509-643
  - `toStructured()`: Lines 1206-1347
  - `generateDerivedIds()`: Lines 829-859

- **Staging**: `team-scrape/shared/firestore_staging/scripts/stage_team.ts`
  - `normalizeDraftPick()`: Lines 581-662

- **Validation**: `team-scrape/shared/ledger/validateLedgerPicks.ts`
  - `validateSwapPartners()`: Lines 96-198

- **Master Doc**: `docs/team-scrape/DRAFT_PICKS_PIPELINE.md`
  - Swap contract: Lines 32-37
  - Via hygiene: Lines 96-99

### Expected Artifact Paths

- **Mentions**: `team-scrape/draft-picks/_artifacts/output/mentions/draft_picks_mentions_DAL.json`
- **Structured**: `team-scrape/draft-picks/_artifacts/output/structured/draft_picks_DAL.json`
- **Ledger**: `team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team/DAL.json`

---

**END OF PREFLIGHT ANALYSIS**
