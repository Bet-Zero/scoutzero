# Trade Machine Draft Picks Master Document

> **Version**: 2.0.0 (January 2026)  
> **Status**: PREFLIGHT AUDIT - Analysis Only  
> **Purpose**: Comprehensive audit of draft pick implementation in Trade Machine  
> **Author**: Automated Code Audit  

---

## Boundary Rules

- **CURRENT REALITY SPEC** (Section 4): Contains **only code-proven statements** about today's implementation. Claims must be backed by evidence in the Evidence Index or explicitly labeled `UNVERIFIED` or `ASSUMED`.
- **TARGET MODEL PROPOSAL** (Section 6): Contains **only recommended future design/spec**. All language is explicitly future tense. No claims about current behavior.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Evidence Index](#evidence-index)
3. [File Map](#file-map)
4. [Current Reality Spec](#current-reality-spec)
5. [Gap List](#gap-list)
6. [Target Model Proposal](#target-model-proposal)
7. [Stepien Evaluation Strategy](#stepien-evaluation-strategy)
8. [Swap Modeling Decision](#swap-modeling-decision)
9. [Draft Pick Data Flow](#draft-pick-data-flow)
10. [Single Source of Truth Rules](#single-source-of-truth-rules)
11. [Integration Plan](#integration-plan)
12. [Test Plan](#test-plan)
13. [Top 10 Highest-Risk Holes](#top-10-highest-risk-holes)

---

## Executive Summary

This document provides a **brutally honest audit** of draft pick implementation in the Trade Machine. The audit covers:
- Pick asset data model and schema
- Editing/authoring functionality
- Trade construction and validation
- UI display and receipt/export
- Stepien Rule and CBA compliance

### High-Level Assessment

| Area | Status | Risk Level |
|------|--------|------------|
| Pick Data Model | ⚠️ Partial | **MEDIUM** |
| Basic Trading | ✅ Implemented | Low |
| Protection Support | ⚠️ Basic/String-only | **HIGH** |
| Swap Rights | ⚠️ UI-only/Not Validated | **HIGH** |
| Stepien Validation | ✅ Basic Implementation | Medium |
| Conveyance/Rollover | ❌ Not Implemented | **HIGH** |
| Pick Swaps (Best-of) | ❌ Not Implemented | **HIGH** |
| Pick Chains | ❌ Not Implemented | **HIGH** |
| Multi-tier Protections | ❌ Not Implemented | **HIGH** |
| Receipt/Export Display | ✅ Basic Implementation | Low |

---

## Evidence Index

> **Rule:** Nothing can be marked "✅ Implemented" in Current Reality unless it has an Evidence Index entry. If a claim cannot be proven, it must be labeled `UNVERIFIED` or `ASSUMED`.

### E1: Stepien Validation is Called by tradeValidator

| Field | Value |
|-------|-------|
| **Claim** | `validateStepien()` is called by the main trade validator |
| **Evidence** | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js:11` |
| **Snippet** | `import { validateStepien } from '../rules/validateStepien.js';` |
| **Call Chain** | `useTradeMachine.validateCurrentTrade()` → `validateTrade()` (tradeValidator.js:77) → `validators.validateStepien(team, tradeCtx)` |
| **Input Shape** | `team.outgoingPicks[]` array with fields: `year`, `round`, `protection`, `isSwap`, `originalTeam` |
| **Output Effect** | Returns `{ passed: boolean, violations: string[], message: string }` |

### E2: isMeaningfulProtection in validateStepien (STRING format)

| Field | Value |
|-------|-------|
| **Claim** | `validateStepien.js` uses string-based protection checking |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:1, 52-53` |
| **Snippet** | `import { isMeaningfulProtection } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';` and `!isMeaningfulProtection(current.protection)` |
| **Call Chain** | `validateStepien()` → `isMeaningfulProtection(protection)` in tradeUtilities.js |
| **Input Shape** | `protection` is a **string** (e.g., "Top 3", "Lottery") |
| **Output Effect** | Returns `true` if string matches regex `/top\s*[1-9]\d*/i`, `/lottery/i`, or `/1-14/i` |

### E3: isMeaningfulProtection in basicRules.js (ARRAY format) - UNUSED

| Field | Value |
|-------|-------|
| **Claim** | `basicRules.js` has a different `isMeaningfulProtection()` expecting array format |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/basicRules.js:25-29` |
| **Snippet** | `return protection.some((p) => p.comparison === '<' && p.value >= 8);` |
| **Call Chain** | **NO CALL SITE FOUND** - This function is exported but not imported anywhere |
| **Input Shape** | `protection` expected as **array** of `{ comparison: string, value: number }` |
| **Output Effect** | **DEAD CODE** - Never called; format incompatible with current data |

### E4: Swap Rights UI Storage

| Field | Value |
|-------|-------|
| **Claim** | `isSwap` and `swapWithTeamId` are stored in UI state |
| **Evidence** | `src/features/architect/tradeMachine/TradePickRow.jsx:117-140` |
| **Snippet** | `<input type="checkbox" checked={!!pickObj.isSwap} onChange={(e) => onEdit(pick, 'isSwap', e.target.checked)} />` and `onEdit(pick, 'swapWithTeamId', e.target.value)` |
| **Call Chain** | `TradePickRow` → `onEdit(pick, field, value)` → `useTradeMachine.updatePickField()` → `teams[idx].picksOut[pickIdx][field] = value` |
| **Input Shape** | `pickObj.isSwap: boolean`, `pickObj.swapWithTeamId: string` |
| **Output Effect** | Values stored in `picksOut[]` array but **NOT used in validation** |

### E5: Swap Rights NOT Validated

| Field | Value |
|-------|-------|
| **Claim** | Swap rights (`isSwap`) are not evaluated in Stepien validation |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js` (entire file) |
| **Snippet** | No code reads `pick.isSwap` or `pick.swapWithTeamId` for validation |
| **Call Chain** | N/A - No validation occurs |
| **Input Shape** | N/A |
| **Output Effect** | Swaps bypass Stepien rule entirely; a swap right in 2026 and unprotected pick in 2027 would NOT trigger consecutive-year violation |

### E6: areSamePick() Comparison Logic

| Field | Value |
|-------|-------|
| **Claim** | Picks are compared by year/round/via (no stable ID) |
| **Evidence** | `src/features/architect/utils/tradeHelpers.js:288-291` |
| **Snippet** | `export const areSamePick = (a, b) => +a.year === +b.year && +a.round === +b.round && (a.via || '') === (b.via || '');` |
| **Call Chain** | `useTradeMachine.togglePick()` → `picksOut.findIndex((p) => areSamePick(p, pick))` |
| **Input Shape** | Two pick objects with `year`, `round`, `via` fields |
| **Output Effect** | Picks without `via` are compared only by year/round; **originalTeam is NOT used** |

### E7: Pick ID Generation in computeTradeDraftKey

| Field | Value |
|-------|-------|
| **Claim** | Pick cache keys use `originalTeam` but not a stable ID |
| **Evidence** | `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js:39-41` |
| **Snippet** | `.map(p => \`${p.year || '?'}-${p.round || '?'}-${p.originalTeam || p.team || '?'}\`)` |
| **Call Chain** | `useTradeMachine` → `computeTradeDraftKey({ yearKey, teams })` |
| **Input Shape** | `picksOut[]` array with `year`, `round`, `originalTeam` or `team` |
| **Output Effect** | Deterministic key but NOT a pick ID; picks without `originalTeam` fall back to `team` or `'?'` |

### E8: togglePick() Adds Pick to Trade

| Field | Value |
|-------|-------|
| **Claim** | `togglePick()` adds/removes picks from `picksOut[]` |
| **Evidence** | `src/features/architect/hooks/useTradeMachine.js:420-438` |
| **Snippet** | `newTeams[index].picksOut = [...newTeams[index].picksOut, { ...pick, fromTeamId: newTeams[index].team?.id }];` |
| **Call Chain** | `TradeTeamCard` → `onTogglePick(pick)` → `togglePick(idx, pick)` |
| **Input Shape** | `pick` object with properties from team's `picks[]` array |
| **Output Effect** | Adds `fromTeamId` to pick but does NOT generate a stable ID |

### E9: schemaAdapter Maps draftPicks to picks

| Field | Value |
|-------|-------|
| **Claim** | `schemaAdapter` creates both `draftPicks` and `picks` properties |
| **Evidence** | `src/features/architect/utils/schemaAdapter.js:94-95` |
| **Snippet** | `draftPicks: teamState.draftPicks || [], picks: teamState.draftPicks || [], // Some validators use 'picks'` |
| **Call Chain** | `tradeManager.executeTrade()` → `buildTradeTeamInput(teamState, teamTrade)` |
| **Input Shape** | `teamState.draftPicks[]` array |
| **Output Effect** | Creates **two aliases** for same array; potential for desync if one is mutated |

### E10: Three Duplicate Stepien Implementations

| Field | Value |
|-------|-------|
| **Claim** | There are three separate `hasStepienViolation()` implementations |
| **Evidence** | (1) `draftRules.js:15-31`, (2) `stepienUtils.js:50-76`, (3) `validateStepien.js` (whole function) |
| **Location 1** | `src/features/architect/utils/tradeMachine/rules/draftRules.js:15` |
| **Location 2** | `src/features/architect/utils/stepienUtils.js:50` |
| **Location 3** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:9` |
| **Which is Called** | **Only `validateStepien.js`** is called by tradeValidator. Others are exported but have **NO CALL SITES** in validation path. |

### E11: conveyance Schema Field Exists but Unused

| Field | Value |
|-------|-------|
| **Claim** | `conveyance` field exists in schema but is not used by validators |
| **Evidence** | `src/schemas/architect.ts:91-123` defines `DraftPickConveyanceZ` |
| **Snippet** | Schema includes `stepienImpact`, `conditions.protection`, `ifConveys`, `ifRolls`, `affects` |
| **Call Chain** | **NO CALL SITE** - grep for "conveyance" in validator files returns no results |
| **Input Shape** | N/A |
| **Output Effect** | Schema exists but **no code reads or processes conveyance logic** |

### E12: Protection Stored as String in UI

| Field | Value |
|-------|-------|
| **Claim** | Protection is stored and displayed as a string |
| **Evidence** | `src/features/architect/tradeMachine/TradePickRow.jsx:103-112` |
| **Snippet** | `<select ... value={pickObj.protection || ''} onChange={(e) => onEdit(pick, 'protection', e.target.value)}>` with options from `getPickOptions()` |
| **Call Chain** | `TradePickRow` → `onEdit(pick, 'protection', value)` → `updatePickField()` |
| **Input Shape** | `protection` is string: `""`, `"Top 3"`, `"Top 5"`, `"Lottery"`, etc. |
| **Output Effect** | String stored in `picksOut[].protection`; passed to `isMeaningfulProtection()` in validation |

---

## File Map

### A) Data Models / Types / Schemas

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/schemas/architect.ts` | **Canonical pick schema definition** | `DraftPickZ` - Zod schema with fields: id, year, round, pick (nullable - draft position when known), owner, originalTeam, status, isSwap, protection, stepienEligible, tradeable, via, recipient, route, notes, conveyance, metadata |
| `src/schemas/architect.ts` | **Conveyance sub-schema** | `DraftPickConveyanceZ` - id, description, originalYear, currentYear, finalYear, stepienImpact, conditions (protection, ifConveys, ifRolls), affects |
| `src/features/architect/utils/tradeMachine/constants/types.ts` | **TypeScript interfaces** | `NormalizedTeam.picksOut` - Array of picks with year, round; limited pick typing |

### B) State Management / Reducers / Hooks

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/hooks/useTradeMachine.js` | **Main trade state hook** | `togglePick()` - Add/remove pick from trade; `updatePickField()` - Edit pick properties; `picksOut[]` array per team |
| `src/features/architect/hooks/useTradeMachine.js:239-240` | **Pick data loading** | Maps `draftPicks` from team data to `picks` for trade machine compatibility |
| `src/features/architect/GMDashboard/hooks/useArchitectState.ts` | **Dashboard state** | `draftPicks?: unknown[]` - Generic pick array |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | **Dashboard actions** | `draftPicks?: unknown[]` - Generic pick array |

### C) Trade Machine UI Components

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/tradeMachine/TradePickRow.jsx` | **Individual pick row display** | Protection dropdown select, `isSwap` checkbox toggle, `swapWithTeamId` dropdown, team logo display |
| `src/features/architect/tradeMachine/OutgoingPicksList.jsx` | **Outgoing picks list** | Lists available + selected picks, uses `areSamePick()` for comparison |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx` | **Team card with picks tab** | Picks tab counter, routes to `OutgoingPicksList`, displays incoming picks with `formatPick()` |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | **Main trade editor** | Passes `togglePick`, `updatePickField` to team cards |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` | **Trade summary** | `getPickLabel()` helper displays year/round/via/protection/swap |
| `src/features/architect/tradeMachine/TradeExportCapture.jsx` | **Export/capture view** | Displays picks received per team with `formatPick()` |

### D) Validator / Rule Engine

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | **Stepien Rule validation** | Checks consecutive unprotected 1st rounders, 7-year limit, second apron frozen pick restriction |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.ts` | **TypeScript version** | `Pick` interface with year, round, teamId, isSwap, protection, originalTeam |
| `src/features/architect/utils/tradeMachine/rules/draftRules.js` | **Draft rules consolidated** | `hasStepienViolation()`, `validateDraftPicks()` - duplicate Stepien implementations |
| `src/features/architect/utils/tradeMachine/rules/basicRules.js` | **Protection utility** | `isMeaningfulProtection()` - checks if protection array has value >= 8 |
| `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` | **Trade utilities** | `isMeaningfulProtection()` - regex-based check for "top X", "lottery", "1-14" strings |
| `src/features/architect/utils/stepienUtils.js` | **Stepien calendar helpers** | `buildFirstRoundCalendar()`, `passesStepienRule()`, `hasStepienViolation()` |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | **Main validator** | Calls `validateStepien()`, passes `picksOut` to validation |

### E) Serialization / Firestore Read/Write

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/utils/firebaseTeamPlanHelpers.js` | **Team plan loading** | Loads `draftPicks` from Firebase baseDoc |
| `src/features/architect/utils/worldTeamData.ts` | **World team data** | `draftPicks?: unknown[]` interface |
| `src/features/architect/utils/schemaAdapter.js` | **Schema adapter** | Maps `draftPicks` to both `draftPicks` and `picks` properties |
| `src/features/architect/utils/tradeManager.js` | **Trade execution** | Updates `draftPicks` array when trade applied |
| `src/features/architect/utils/mutationPipeline.js` | **Mutation pipeline** | Filters `draftPicks` on trade execution |
| `src/features/architect/utils/seasonManager.js` | **Season transitions** | `updateDraftPicks()`, `updateDraftPicksWithStepien()` for advancing picks |

### F) Helper Functions

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/utils/tradeHelpers.js` | **Trade helpers** | `areSamePick()` - compares by year/round/via; `formatPick()` - display string with protection/swap icons |
| `src/features/architect/utils/draftPickUtils.js` | **Pick utilities** | Checks if pick is owned by team |
| `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js` | **Draft key generation** | Creates cache key from picks using `originalTeam` |

### G) Team Data Scraping (Reference Only)

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` | **RealGM scraper** | Parses `originalTeam`, `currentOwner`, `protection`, `status` |
| `team-scrape/team-data/config/team_scrape_schema.ts` | **Scrape schema** | `originalTeam`, `currentOwner`, `protection` fields |

---

## Current Reality Spec

> **Rule:** Claims must reference Evidence Index entries or be labeled UNVERIFIED/ASSUMED.

### What Picks Currently Support ✅

1. **Basic Pick Properties** [Evidence: E6, E7, E12]
   - `year` (number) - Draft year
   - `round` (number or string "1st"/"2nd")
   - `originalTeam` (string) - Team that originally owned the pick
   - `via` (string) - Team pick was acquired from (for display)
   - `protection` (string) - Protection level like "Top 3", "Lottery"

2. **Trading Picks** [Evidence: E8]
   - Add/remove picks from trade via `togglePick()` 
   - Edit pick properties via `updatePickField()`
   - Adds `fromTeamId` to track origin team
   - Display picks in team cards and summary panels

3. **Protection (Basic - String Only)** [Evidence: E2, E12]
   - String-based protection field (e.g., "Top 3", "Lottery", "Top 10")
   - UI dropdown with preset options: Unprotected, Top 3/5/8/10, Lottery, Top 20
   - `isMeaningfulProtection()` in `tradeUtilities.js` uses regex: `/top\s*[1-9]\d*/i`, `/lottery/i`, `/1-14/i`

4. **Swap Rights (UI Storage Only - NOT Validated)** [Evidence: E4, E5]
   - `isSwap` boolean toggle stored in UI state
   - `swapWithTeamId` dropdown stored but **NEVER READ by validator**
   - Displayed with 🔁 icon in `formatPick()`
   - **CRITICAL GAP**: Swaps bypass Stepien validation entirely

5. **Stepien Rule Validation** [Evidence: E1, E2]
   - Consecutive unprotected 1st round picks blocked
   - 7-year maximum future trading limit
   - Second apron teams blocked from trading 7-year-out own picks
   - Uses `isMeaningfulProtection()` (string regex) to allow protected consecutive picks

6. **Pick Comparison** [Evidence: E6]
   - `areSamePick()` compares year, round, and via (string-based)
   - **Does NOT use `originalTeam`** - potential for collisions
   - Numeric leniency (`+a.year === +b.year`)

### What Picks Do NOT Support ❌

1. **Multi-Tier Protections** [Evidence: E12]
   - Cannot define "Top 3 protected in 2026, Top 5 protected in 2027, unprotected in 2028"
   - No year-by-year protection breakdown
   - No conversion rules (e.g., "conveys to 2nd rounder if protection triggers")

2. **Conveyance / Rollover Logic** [Evidence: E11]
   - Schema has `conveyance` field but **NO CODE reads it** in Trade Machine
   - No logic to roll picks forward when protection triggers
   - No final conveyance year tracking
   - No "becomes unprotected in 20XX" logic

3. **Pick Swap Resolution** [Evidence: E4, E5]
   - `isSwap` flag exists but swap logic is **NEVER evaluated**
   - No "best of" or "worst of" swap resolution
   - No swap partner pick comparison
   - **Swaps don't block/reserve years for Stepien**

4. **Pick Chains / Provenance** [UNVERIFIED - needs runtime inspection]
   - Cannot track "PHI 2026 1st → via OKC → currently owned by HOU"
   - `route` field in schema exists but usage unclear
   - `via` is display-only, not used for validation

5. **Conditional Pick Structures** [Evidence: E11 - schema unused]
   - No "less favorable of" A or B logic
   - No "more favorable of" logic
   - No conditional triggers (e.g., "if team makes playoffs")
   - No pick deferral logic

6. **Stable Pick Identity** [Evidence: E6, E7, E8]
   - **Failure mode:** `areSamePick()` uses year/round/via but NOT originalTeam
   - Cache key uses `originalTeam` but falls back to `team` or `'?'`
   - `togglePick()` does NOT generate a stable ID on add
   - **Risk:** Duplicate picks or lost picks in complex multi-team trades

7. **Stepien Calendar Visualization** [ASSUMED - no UI call site found]
   - `buildFirstRoundCalendar()` exists in `stepienUtils.js` but not integrated with Trade Machine UI
   - No visual indicator of Stepien-blocked years
   - No pre-trade Stepien warning

### What is Partially Implemented / Stubbed ⚠️

1. **`conveyance` Schema Field** (Stubbed) [Evidence: E11]
   - File: `src/schemas/architect.ts:91-123`
   - Has `stepienImpact`, `conditions`, `affects` sub-fields
   - **NEVER read or used** by Trade Machine validators

2. **`isMeaningfulProtection()` Dual Implementation** (Inconsistent) [Evidence: E2, E3]
   - File 1: `basicRules.js:25-29` - Checks **array** with `p.comparison === '<' && p.value >= 8`
   - File 2: `tradeUtilities.js:74-80` - Regex on **string** `/top\s*[1-9]\d*/i`
   - **DEAD CODE:** basicRules.js version has NO CALL SITE - only tradeUtilities.js is used

3. **Stepien Rule - Three Implementations** (Duplicated) [Evidence: E10]
   - `validateStepien.js` - **PRIMARY, actually called by tradeValidator**
   - `draftRules.js:hasStepienViolation()` - Exported but **NEVER CALLED**
   - `stepienUtils.js:hasStepienViolation()` - Exported but **NEVER CALLED**
   - **Risk**: Bug fixes won't propagate to unused duplicates

4. **Pick Swap Partner** (UI-Only) [Evidence: E4, E5]
   - File: `TradePickRow.jsx:126-140`
   - `swapWithTeamId` stored but **never read by any validator**
   - No resolution of which team gets better/worse pick

---

## Gap List

### BLOCKER Level Gaps

| # | Gap Title | Severity | Location | User Impact | Done Criteria |
|---|-----------|----------|----------|-------------|---------------|
| G1 | **Swap Rights Not Validated** | BLOCKER | `validateStepien.js`, `tradeValidator.js` | Swaps bypass Stepien illegally; swap partner selection is meaningless | Swap rights properly reserve years for Stepien; swap resolution shows which team keeps which pick |
| G2 | **No Multi-Tier Protection Support** | BLOCKER | `DraftPickZ`, `TradePickRow.jsx` | Cannot represent real NBA protections (e.g., "Top 3 → Top 5 → Unprotected") | Protection is tiered array with year/condition/conversion; UI allows tier editing |
| G3 | **No Conveyance/Rollover Logic** | BLOCKER | N/A - Not implemented | Protected picks that trigger have no forward path; users can't model real pick obligations | Conveyance rules execute at season advance; picks roll to next tier/year automatically |
| G4 | **`isMeaningfulProtection()` Format Mismatch** | BLOCKER | `basicRules.js:25`, `tradeUtilities.js:74` | Stepien validation may incorrectly pass/fail based on protection format | Single canonical implementation; all callers use same format |

### MAJOR Level Gaps

| # | Gap Title | Severity | Location | User Impact | Done Criteria |
|---|-----------|----------|----------|-------------|---------------|
| G5 | **No Stable Pick ID Strategy** | MAJOR | `areSamePick()`, `computeTradeDraftKey.js` | Picks can be duplicated or lost in complex multi-team trades | Canonical ID format: `{originalTeam}_{year}_{round}` enforced everywhere |
| G6 | **Pick Swap Best/Worst-Of Logic Missing** | MAJOR | N/A - Not implemented | Cannot model "more favorable of Team A / Team B pick" | Swap resolution function compares projected picks and assigns correctly |
| G7 | **Stepien Calendar Not Shown in UI** | MAJOR | `stepienUtils.js`, `TradeEditor.jsx` | Users don't know which years are blocked before creating trade | Calendar visualization shows blocked/available years per team |
| G8 | **Three Duplicate Stepien Implementations** | MAJOR | See File Map section D | Bug fixes may not propagate; maintenance burden | Single `validateStepien.js` is canonical; others removed or delegated |
| G9 | **Second Apron Swap Year Blocking Missing** | MAJOR | `validateStepien.js:76-96` | Second apron swap restrictions not enforced | Swaps properly count toward Stepien restrictions for second apron teams |
| G10 | **Pick Chain / Provenance Tracking** | MAJOR | `DraftPickZ.route` field | Cannot show full pick history "PHI → OKC → HOU" | Route array populated and displayed; validation uses full chain |

### MINOR Level Gaps

| # | Gap Title | Severity | Location | User Impact | Done Criteria |
|---|-----------|----------|----------|-------------|---------------|
| G11 | **No Pick Cash Conversion** | MINOR | N/A | Cannot model "pick becomes cash if..." | Cash conversion as pick resolution option |
| G12 | **Second Round Picks Largely Ignored** | MINOR | Various validators | 2nd round swaps and protections not handled | 2nd round picks have parity with 1st round where applicable |
| G13 | **No Pick Deferral Logic** | MINOR | N/A | Cannot delay pick conveyance by team choice | Deferral option in pick structure |
| G14 | **Protection Dropdown Has "Swap (+/-)" Options** | MINOR | `tradeUtilities.js:93` | Confusing UX - swap is separate from protection | Remove swap options from protection dropdown |
| G15 | **`via` Field Display-Only** | MINOR | `areSamePick()`, `formatPick()` | Via doesn't affect validation, only display | Document or enhance `via` usage |

---

## Stepien Evaluation Strategy

### A) How Current Code Evaluates Stepien [Evidence: E1, E2, E10]

**Call Chain (Validated):**
```
useTradeMachine.validateCurrentTrade() 
  → validateTrade() [tradeValidator.js:77]
    → validators.validateStepien(team, tradeCtx)
      → validateStepien() [validateStepien.js:9]
        → isMeaningfulProtection(protection) [tradeUtilities.js:74]
```

**Current Logic (`validateStepien.js:35-58`):**
1. Filter `outgoingPicks` to first round picks (`round === '1st' || round === 1`)
2. Sort by year
3. For each consecutive pair, check:
   - `next.year === current.year + 1` (consecutive years)
   - `!isMeaningfulProtection(current.protection)` (current unprotected)
   - `!isMeaningfulProtection(next.protection)` (next unprotected)
4. If all conditions met → violation

**How `isMeaningfulProtection()` Works (String Regex):**
```javascript
// tradeUtilities.js:74-80
export const isMeaningfulProtection = (protection) => {
  if (!protection) return false;
  return (
    /top\s*[1-9]\d*/i.test(protection) ||  // "Top 3", "Top 10", etc.
    /lottery/i.test(protection) ||          // "Lottery"
    /1-14/i.test(protection)                // "1-14"
  );
};
```

### B) Why Current Approach is Insufficient

1. **Swaps are Invisible to Stepien**
   - Current code does NOT read `pick.isSwap` or `pick.swapWithTeamId`
   - A swap right should **reserve the year** for Stepien purposes
   - Example: Trading 2026 swap + 2027 outright should violate Stepien, but doesn't

2. **No Worst-Case Calendar**
   - Current code evaluates only "will this specific pick be protected?"
   - Real NBA: Teams must have a first available in every other year **in worst case**
   - Protections that *might* convey still reserve the year

3. **No Conveyance Simulation**
   - If a protected pick rolls, it still blocks Stepien in the new year
   - Current code doesn't track pick obligations across multiple years

4. **Meaningful Protection is Too Permissive**
   - "Top 3" might convey 70%+ of the time - is that "meaningful"?
   - No configurable threshold for what counts as meaningful

### C) Proposed Stepien Strategy: Worst-Case Obligation Calendar

**Worst-Case Calendar (for Legality):**
- For each year, compute the **worst case** - what if protections don't trigger?
- Swaps count as obligations because the team might get the worse pick
- A year is "blocked" if:
  - Team has an unprotected outgoing pick, OR
  - Team has a protected pick that *could* convey (protection < 100% trigger rate), OR
  - Team has a swap right where they might lose the better pick

**Best-Case Calendar (for Visibility Only):**
- Show what the roster could look like if all protections trigger
- Not used for validation, only for user planning

**Year Reservation Rules:**
| Scenario | Reserves Year for Stepien? |
|----------|---------------------------|
| Unprotected outgoing pick | ✅ Yes |
| Protected pick (could convey) | ✅ Yes (worst case) |
| Protected pick (will NOT convey, e.g., top 1-14 on lottery team) | ❌ No |
| Swap right (best_of) | ✅ Yes (might get worse) |
| Swap right (worst_of) | ❌ No (always get worse, opponent blocked) |

---

## Swap Modeling Decision

### Decision: **B) Swaps are a property on a DraftPick**

**Rationale:**
1. A swap right is inherently tied to a specific year/round - the 2026 1st round swap right
2. Swaps don't exist independently - they're modifications of an underlying pick
3. UI already stores `isSwap` and `swapWithTeamId` on pick objects [Evidence: E4]
4. Simpler state management - don't need to track separate asset collections

**Schema (Target Model):**
```typescript
interface DraftPick {
  // ... other fields ...
  isSwap: false | SwapRights;  // false = outright pick, SwapRights = swap
}

interface SwapRights {
  type: 'best_of' | 'worst_of' | 'choice';
  teams: TeamCode[];           // Teams whose picks are compared
  controller: TeamCode;        // Who makes selection (for 'choice')
}
```

**Impact on Components:**

| Component | Current | After |
|-----------|---------|-------|
| **UI State** (`picksOut[]`) | `isSwap: boolean`, `swapWithTeamId: string` | `isSwap: false \| SwapRights` |
| **Validator** (`validateStepien`) | Does not read `isSwap` | Must evaluate swap year reservation |
| **Persistence** (Firestore) | N/A | `draftPicks[].isSwap` stored as object or false |
| **Export/Receipt** | Shows 🔁 icon | Shows "Swap: Best of PHI/OKC" |

**Evidence of Current Swap Storage:**
- UI stores: `pickObj.isSwap` (boolean), `pickObj.swapWithTeamId` (string) [E4]
- Validator ignores: No code in `validateStepien.js` reads these fields [E5]

---

## Draft Pick Data Flow

### Complete Pipeline: Source → UI → Validator → Apply → Persistence → Reload

| Step | File(s) | Description |
|------|---------|-------------|
| **1. Firestore Base Data** | `architect_baseTeams/{teamCode}` | `draftPicks[]` array with schema-compliant pick objects |
| **2. Team Loader** | `src/features/architect/utils/teamLoader.js` | Loads team via `getTeam(worldId, teamCode)` |
| **3. Firebase Helper** | `src/features/architect/utils/firebaseTeamPlanHelpers.js` | Extracts `draftPicks` from baseDoc |
| **4. useTradeMachine Init** | `src/features/architect/hooks/useTradeMachine.js:239` | Maps `data.draftPicks` to `teamObj.picks` |
| **5. Schema Adapter** | `src/features/architect/utils/schemaAdapter.js:94-95` | Creates **TWO aliases**: `draftPicks` and `picks` (potential desync risk) |
| **6. UI State** | `useTradeMachine.teams[].picksOut[]` | Selected picks stored via `togglePick()` |
| **7. Pick Editing** | `TradePickRow.jsx` → `updatePickField()` | Protection/swap fields modified in state |
| **8. Validation** | `tradeValidator.js` → `validateStepien()` | Reads `team.outgoingPicks[]` (aliased from `picksOut`) |
| **9. Trade Application** | `tradeManager.js:78-80` | Updates `draftPicks` array on team snapshot |
| **10. Mutation Pipeline** | `mutationPipeline.js` | Filters `draftPicks`, writes to Firestore |
| **11. Persistence** | Firestore `architect_worlds/{worldId}/teams/{teamCode}` | Updated `draftPicks[]` saved |
| **12. Reload** | Steps 1-5 repeat | Picks loaded from world snapshot |

### Known Data Flow Issues

1. **Dual Alias Risk** [Evidence: E9]
   - `schemaAdapter.js` creates both `draftPicks` and `picks` pointing to same array
   - If one is mutated independently, desync can occur

2. **No ID Generation on Add** [Evidence: E8]
   - `togglePick()` adds `fromTeamId` but does NOT generate stable ID
   - Comparison uses `areSamePick()` which ignores `originalTeam`

3. **Picks vs DraftPicks Naming**
   - Some validators use `team.picks`, others use `team.draftPicks`
   - Inconsistent naming increases confusion risk

---

## Single Source of Truth Rules

### SSOT-1: Stepien Validator

**Rule:** There must be exactly ONE canonical Stepien validator.

**Current State (Violation):**
| Implementation | File | Called by tradeValidator? |
|----------------|------|--------------------------|
| `validateStepien()` | `rules/validateStepien.js` | ✅ **YES** (canonical) |
| `hasStepienViolation()` | `rules/draftRules.js:15` | ❌ NO (dead code) |
| `hasStepienViolation()` | `stepienUtils.js:50` | ❌ NO (dead code) |

**Required Action:** Delete `draftRules.js:hasStepienViolation` and `stepienUtils.js:hasStepienViolation`, or make them delegates to the canonical `validateStepien.js`.

### SSOT-2: Protection Parser

**Rule:** There must be exactly ONE canonical protection parser.

**Current State (Violation):**
| Implementation | File | Input Format | Called? |
|----------------|------|--------------|---------|
| `isMeaningfulProtection(str)` | `tradeUtilities.js:74` | String | ✅ **YES** (canonical) |
| `isMeaningfulProtection(arr)` | `basicRules.js:25` | Array | ❌ NO (dead code) |
| `isMeaningfulProtection(str)` | `tradeHelpers.js:302` | String | ⚠️ Unknown (duplicate) |

**Required Action:** 
1. Delete `basicRules.js:isMeaningfulProtection` (array format never used)
2. Consolidate `tradeHelpers.js` and `tradeUtilities.js` versions (same logic, duplicated)

### SSOT-3: Pick Comparison

**Rule:** Pick identity must be determined consistently.

**Current State (Inconsistent):**
| Location | Comparison Method |
|----------|-------------------|
| `areSamePick()` | `year + round + via` |
| `computeTradeDraftKey()` | `year + round + originalTeam` (or `team` or `'?'`) |
| UI rendering | No ID, relies on array index |

**Required Action:** Establish canonical ID format `{originalTeam}_{year}_{round}` and use it everywhere.

---

## Target Model Proposal

> **Note:** This section describes **future state only**. All language is explicitly future tense.

### 5.1 Canonical Pick Entity Schema

```typescript
interface DraftPick {
  // === IDENTITY (Stable, Never Changes) ===
  id: string;                    // Format: "{originalTeam}_{year}_{round}"
                                  // e.g., "PHI_2026_1", "LAL_2028_2"
                                  // Note: For edge cases with multiple trades, the ID
                                  // remains stable based on ORIGINAL team, not current owner
  
  // === CORE PROPERTIES ===
  year: number;                  // Draft year (e.g., 2026)
  round: 1 | 2;                  // Draft round
  originalTeam: TeamCode;        // Team that originally owned the pick
  
  // === OWNERSHIP ===
  currentOwner: TeamCode;        // Who currently controls the pick
  route: TeamCode[];             // Full trade history: ["PHI", "OKC", "HOU"]
  via?: TeamCode;                // Immediate previous owner (derived from route)
  
  // === STATUS ===
  status: 'future' | 'conveyed' | 'cancelled';
  tradeable: boolean;            // Can be traded (Stepien compliant)
  stepienEligible: boolean;      // Computed: does it count for Stepien?
  
  // === SWAP RIGHTS ===
  isSwap: false | SwapRights;    // false if outright pick, SwapRights if swap
  
  // === PROTECTIONS ===
  protections: ProtectionTier[]; // Ordered array of protection tiers
  conveyedAs?: 'first' | 'second' | 'cash' | null;  // What it became after conveyance
  
  // === METADATA ===
  notes?: string;
  sourceTradeId?: string;        // Which trade created this obligation
  createdAt: string;             // ISO timestamp
}

interface SwapRights {
  type: 'best_of' | 'worst_of' | 'choice';
  teams: TeamCode[];             // Teams involved in swap (2+ teams)
  controller: TeamCode;          // Who makes selection (for 'choice' type)
  conditionalOn?: string;        // Optional condition
}

interface ProtectionTier {
  year: number;                  // Which year this tier applies
  condition: ProtectionCondition;
  ifTriggered: ConveyanceAction;
}

interface ProtectionCondition {
  type: 'position' | 'lottery' | 'playoff' | 'always' | 'never';
  maxPosition?: number;          // e.g., maxPosition: 3 = "Top 3 protected" (positions 1-3)
                                  // maxPosition: 14 = "Lottery protected" (positions 1-14)
}

interface ConveyanceAction {
  action: 'roll' | 'convert' | 'cancel';
  toYear?: number;               // For 'roll': which year
  toRound?: 1 | 2;               // For 'convert': becomes 2nd rounder
  toCash?: number;               // For 'convert': becomes cash
}
```

### 5.2 Human-Readable Description Generator Spec

```typescript
function generatePickDescription(pick: DraftPick): string {
  // Examples of expected output:
  // "2026 1st Round Pick (PHI)" 
  // "2026 1st Round Pick (PHI via OKC)"
  // "2026 1st Round Pick (PHI) - Top 3 Protected, Top 5 in 2027, Unprotected in 2028"
  // "2026 1st Round Pick Swap Rights - Best of PHI/OKC/CLE"
  // "2026 1st Round Pick (PHI) - Lottery Protected → Converts to 2nd Round"
}
```

### 5.3 Ownership & Conditionality Resolution

```typescript
interface PickResolutionContext {
  currentSeason: string;         // "2025-26"
  draftLotteryResults?: Map<TeamCode, number>;  // Team → pick position
  playoffTeams?: TeamCode[];
}

function resolvePickOwnership(
  pick: DraftPick, 
  context: PickResolutionContext
): ResolvedPick {
  // 1. Check if pick year has arrived
  // 2. Evaluate current protection tier
  // 3. Check if protection triggered
  // 4. Execute conveyance action (roll/convert/cancel)
  // 5. For swaps: compare positions and assign
  // 6. Return resolved ownership
}
```

---

## Integration Plan

### Phase 0: Safety & Instrumentation (1-2 days)

**Tasks:**
- [ ] Add logging to all Stepien validation paths
- [ ] Create debug panel showing pick states during trade
- [ ] Add assertions for pick ID format consistency
- [ ] Create pick state dump for debugging
- [ ] **DATA AUDIT**: Query Firestore to document actual `draftPicks` data format in production (protection format, field usage)

**Acceptance Criteria:**
- Console logs show which Stepien function is called
- Pick IDs logged on every trade operation
- Debug panel renders pick state in Trade Machine
- **DATA AUDIT REPORT**: Document shows actual protection formats in production data

**Validation Steps:**
- Open Trade Machine, add picks to trade
- Verify console shows pick operations
- Verify debug panel renders pick state

---

### Phase 1: Data Model Stabilization + ID Migration (3-5 days)

> **CRITICAL:** This phase requires either a migration script OR a deterministic adapter. "No schema migration required" was incorrect in v1.0.

**Tasks:**

**1.1 Canonical Pick ID Implementation**
- [ ] Create `generatePickId(pick)` utility: returns `{originalTeam}_{year}_{round}`
- [ ] Update `areSamePick()` to use `generatePickId()` for comparison
- [ ] Update `computeTradeDraftKey()` to use `generatePickId()`

**1.2 ID Adapter Strategy (Recommended over Migration)**
- [ ] Create `ensurePickId(pick)` adapter that:
  - If `pick.id` exists and matches format → use it
  - Otherwise → derive ID via `generatePickId()` and attach to pick object
- [ ] Call `ensurePickId()` in:
  - `useTradeMachine` when loading team picks
  - `togglePick()` when adding pick to trade
  - `schemaAdapter.buildTradeTeamInput()` when building validator input
- [ ] On save: persist canonical ID to Firestore

**1.3 De-Duplicate Stepien Implementations (SSOT-1)**
- [ ] Delete `draftRules.js:hasStepienViolation()` or make it delegate
- [ ] Delete `stepienUtils.js:hasStepienViolation()` or make it delegate
- [ ] Remove re-exports from `validators/index.js` and `tradeMachine/index.js`

**1.4 De-Duplicate Protection Parser (SSOT-2)**
- [ ] Delete `basicRules.js:isMeaningfulProtection()` (unused array format)
- [ ] Consolidate `tradeHelpers.js:302` and `tradeUtilities.js:74` into single export
- [ ] Update all imports to use single source

**Evidence of Current ID Generation Issues:**
- `areSamePick()` at `tradeHelpers.js:288-291` uses `year + round + via` (NOT originalTeam)
- `computeTradeDraftKey()` at `computeTradeDraftKey.js:39-41` uses `originalTeam` but falls back to `team` or `'?'`
- `togglePick()` at `useTradeMachine.js:430` does NOT generate ID on add
- **Failure Mode:** Two picks with same year/round but different originalTeam will collide in `areSamePick()`

**Acceptance Criteria:**
- All picks have `{originalTeam}_{year}_{round}` format IDs
- `areSamePick()` uses ID comparison
- Only `validateStepien.js` contains Stepien logic (no duplicates)
- Only `tradeUtilities.js` contains `isMeaningfulProtection()` (no duplicates)
- ID adapter runs on load and save - no data loss

**Validation Steps:**
- Test: Two picks with same year/round but different originalTeam are NOT treated as same
- Test: Existing Stepien tests pass after de-dupe
- Test: Trade → Save → Reload preserves pick IDs

---

### Phase 2: Trade Engine Correctness (5-7 days)

**Tasks:**
- [ ] G1: Implement swap rights validation in Stepien
- [ ] G9: Add second apron swap year blocking
- [ ] Properly track pick movement during multi-team trades
- [ ] Ensure `route` array updated when picks change hands
- [ ] Implement pick-to-team assignment for N-way trades

**Acceptance Criteria:**
- Swaps count toward Stepien calculations
- Second apron teams blocked from swaps in restricted years
- 3+ team trades correctly assign picks
- Route array shows full provenance

**Validation Steps:**
- Test: Swap rights block consecutive Stepien years
- Test: Second apron team cannot trade swap in restricted year
- Test: 3-team trade moves pick A→B→C, route updated

---

### Phase 3: Validator Correctness (5-7 days)

**Tasks:**
- [ ] G2: Implement multi-tier protection schema
- [ ] G3: Implement conveyance/rollover logic
- [ ] G6: Implement best-of / worst-of swap resolution
- [ ] Add protection tier validation
- [ ] Add conveyance simulation for season advance

**Acceptance Criteria:**
- Protection tiers can be defined with year/condition/action
- Season advance evaluates protections and rolls picks
- Swap resolution compares positions and assigns correctly
- Validation prevents invalid protection configurations

**Validation Steps:**
- Test: Define "Top 3 → Top 5 → Unprotected" protection
- Test: Season advance with triggered protection rolls pick
- Test: Best-of swap assigns to team with better pick

---

### Phase 4: UI Parity & Editing Tools (5-7 days)

**Tasks:**
- [ ] G7: Add Stepien calendar visualization
- [ ] G14: Remove swap options from protection dropdown
- [ ] Build multi-tier protection editor
- [ ] Build swap rights configurator
- [ ] Show pick provenance in UI
- [ ] Add conveyance preview ("becomes X if Y")

**Acceptance Criteria:**
- Stepien calendar shows blocked/available years
- Protection editor allows tier definition
- Swap configurator allows team selection
- Pick cards show full route history
- Conveyance outcome previewed before trade

**Validation Steps:**
- UI shows which years are Stepien-blocked
- Create pick with 3 protection tiers via UI
- Configure swap with 2 teams via UI
- Pick card shows "via OKC via PHI"

---

### Phase 5: Tests & Regression Harness (3-5 days)

**Tasks:**
- [ ] Unit tests for pick ID generation
- [ ] Unit tests for protection tier logic
- [ ] Unit tests for swap resolution
- [ ] Integration tests for multi-team trades
- [ ] Create fixture set covering all edge cases
- [ ] Add regression test suite

**Acceptance Criteria:**
- 100% coverage of new pick logic
- Fixture set covers: simple trade, multi-tier protection, swaps, conveyance
- All existing tests continue passing
- New regression suite catches future breakage

**Validation Steps:**
- Run `npm run test tests/trade/` - all pass
- Run `npm run test tests/validators/stepien.test.js` - all pass
- New pick tests pass

---

## Test Plan

### 7.1 Unit Tests

**Pick ID Generation**
```javascript
describe('pick ID generation', () => {
  it('generates canonical ID from year/round/team', () => {
    expect(generatePickId({ year: 2026, round: 1, originalTeam: 'PHI' }))
      .toBe('PHI_2026_1');
  });
  
  it('handles 2nd round picks', () => {
    expect(generatePickId({ year: 2027, round: 2, originalTeam: 'LAL' }))
      .toBe('LAL_2027_2');
  });
});
```

**Protection Tier Logic**
```javascript
describe('protection evaluation', () => {
  it('triggers Top 3 protection at pick 2', () => {
    const result = evaluateProtection(
      { type: 'position', maxPosition: 3 },
      { pickPosition: 2 }
    );
    expect(result.triggered).toBe(true);
  });
  
  it('does not trigger Top 3 protection at pick 5', () => {
    const result = evaluateProtection(
      { type: 'position', maxPosition: 3 },
      { pickPosition: 5 }
    );
    expect(result.triggered).toBe(false);
  });
  
  it('executes roll action on trigger', () => {
    const tier = {
      condition: { type: 'position', maxPosition: 3 },
      ifTriggered: { action: 'roll', toYear: 2027 }
    };
    const result = executeConveyance(tier, { pickPosition: 2 });
    expect(result.rolledToYear).toBe(2027);
  });
});
```

**Swap Resolution**
```javascript
describe('swap resolution', () => {
  it('best_of assigns better pick to swap holder', () => {
    const swap = { type: 'best_of', teams: ['PHI', 'OKC'], controller: 'HOU' };
    const positions = { PHI: 12, OKC: 5 };
    expect(resolveSwap(swap, positions)).toBe('OKC'); // pick 5 is better
  });
  
  it('worst_of assigns worse pick to swap holder', () => {
    const swap = { type: 'worst_of', teams: ['PHI', 'OKC'], controller: 'HOU' };
    const positions = { PHI: 12, OKC: 5 };
    expect(resolveSwap(swap, positions)).toBe('PHI'); // pick 12 is worse
  });
});
```

### 7.2 Validator Tests

**Stepien with Swaps**
```javascript
describe('Stepien with swaps', () => {
  it('blocks consecutive years when swap counts', () => {
    const result = validateStepien({
      outgoingPicks: [
        { year: 2026, round: '1st' },
        { year: 2027, round: '1st', isSwap: { type: 'best_of', teams: ['A', 'B'] } }
      ]
    });
    expect(result.passed).toBe(false);
  });
  
  it('allows swaps to not count when properly protected', () => {
    // Swaps with meaningful protection should not block Stepien
  });
});
```

**Multi-Tier Protection**
```javascript
describe('multi-tier protection', () => {
  it('validates consistent tier years', () => {
    const result = validateProtectionTiers([
      { year: 2026, condition: { type: 'position', positions: [1, 3] } },
      { year: 2027, condition: { type: 'position', positions: [1, 5] } },
      { year: 2028, condition: { type: 'always' } } // unprotected
    ]);
    expect(result.valid).toBe(true);
  });
  
  it('rejects gaps in tier years', () => {
    const result = validateProtectionTiers([
      { year: 2026, condition: { type: 'position', positions: [1, 3] } },
      { year: 2028, condition: { type: 'always' } } // missing 2027
    ]);
    expect(result.valid).toBe(false);
  });
});
```

### 7.3 Integration Tests

**Trade Creation → Receipt → Reload**
```javascript
describe('pick trade lifecycle', () => {
  it('creates trade with picks, persists, reloads correctly', async () => {
    // 1. Create trade with PHI 2026 1st (Top 3 protected)
    // 2. Apply trade to plan
    // 3. Save plan
    // 4. Reload plan
    // 5. Verify pick ownership changed
    // 6. Verify protection preserved
  });
});
```

### 7.4 Minimum Fixture Set

| Fixture | Purpose | Covers |
|---------|---------|--------|
| `simple_pick_trade.json` | Basic pick trade between 2 teams | ID generation, ownership change |
| `protected_pick_trade.json` | Trade with single-tier protection | Protection parsing, Stepien bypass |
| `multi_tier_protection.json` | Trade with 3-year rolling protection | Tier evaluation, conveyance |
| `swap_rights_trade.json` | Trade of swap rights | Swap validation, Stepien counting |
| `three_team_pick_trade.json` | 3-team trade with picks | Multi-party routing, route tracking |
| `second_apron_frozen.json` | Second apron team trading picks | Frozen pick restrictions |
| `stepien_violation.json` | Invalid consecutive 1st trade | Stepien blocking |

---

## Top 10 Highest-Risk Holes

1. **G1: Swap Rights Not Validated** - `validateStepien.js` + `tradeValidator.js`
   - Swaps completely bypass Stepien; users can create illegal trades

2. **G4: `isMeaningfulProtection()` Format Mismatch** - `basicRules.js:25` vs `tradeUtilities.js:74`
   - Array vs string format causes unpredictable Stepien pass/fail

3. **G2: No Multi-Tier Protection** - `DraftPickZ` schema + `TradePickRow.jsx`
   - Cannot model real NBA pick protections; user expectation mismatch

4. **G3: No Conveyance Logic** - Not implemented anywhere
   - Protected picks have no resolution path; season advance doesn't work

5. **G5: Unstable Pick IDs** - `areSamePick()` + `computeTradeDraftKey.js`
   - Picks can be lost or duplicated in complex trades

6. **G8: Three Stepien Implementations** - `validateStepien.js`, `draftRules.js`, `stepienUtils.js`
   - Bug fixes may not propagate; maintenance nightmare

7. **G6: No Best/Worst-of Logic** - Not implemented
   - Swap rights selection is meaningless without resolution

8. **G9: Second Apron Swap Blocking Missing** - `validateStepien.js:76-96`
   - Second apron swap restrictions per CBA not enforced

9. **G7: No Stepien Calendar in UI** - `stepienUtils.js` exists but unused
   - Users must guess which years are tradeable

10. **G10: No Pick Chain Tracking** - `DraftPickZ.route` unused
    - Full pick provenance lost; can't trace "PHI → OKC → HOU"

---

## Recommended Phase 1 Scope (Revised)

> **Note:** Phase 1 now explicitly includes ID adapter strategy. "No schema migration required" is incorrect - either migration OR adapter is needed.

**Build first (highest ROI, addresses SSOT violations):**

### 1. Implement Canonical Pick ID with Adapter (G5) - ~10 hours

**Why first:** Prevents data loss, enables reliable pick comparison.

**Tasks:**
1. Create `generatePickId(pick)` → returns `{originalTeam}_{year}_{round}`
2. Create `ensurePickId(pick)` adapter → derives ID if missing, attaches to object
3. Update `areSamePick()` → use `generatePickId()` for comparison
4. Update `computeTradeDraftKey()` → use `generatePickId()`
5. Call adapter on:
   - Load: `useTradeMachine` when populating team picks
   - Add: `togglePick()` when selecting pick for trade
   - Save: `mutationPipeline` before Firestore write

**Evidence of Failure Mode:**
- `areSamePick()` compares `year + round + via` [E6]
- Two picks with same year/round from different teams would be treated as identical
- `togglePick()` does not generate ID on add [E8]

### 2. De-Duplicate `isMeaningfulProtection()` (G4, SSOT-2) - ~2 hours

**Why:** Dead code creates confusion; two formats (array vs string) exist.

**Tasks:**
1. Delete `basicRules.js:isMeaningfulProtection()` (array format, DEAD CODE [E3])
2. Keep `tradeUtilities.js:isMeaningfulProtection()` as canonical (string format [E2])
3. Delete or update `tradeHelpers.js:302` duplicate to import from canonical

### 3. De-Duplicate Stepien Implementations (G8, SSOT-1) - ~4 hours

**Why:** Three implementations create maintenance risk; only one is actually called.

**Tasks:**
1. Confirm `validateStepien.js` is canonical (already called by tradeValidator [E1])
2. Delete `draftRules.js:hasStepienViolation()` (DEAD CODE [E10])
3. Delete `stepienUtils.js:hasStepienViolation()` (DEAD CODE [E10])
4. Remove re-exports from barrel files (`validators/index.js`, `tradeMachine/index.js`)

**Which One is Actually Called (Evidence):**
- `tradeValidator.js:11` imports from `'../rules/validateStepien.js'`
- `validators/index.js:45` re-exports from `stepienUtils.js` but has NO CALLERS
- `draftRules.js` exports but has NO CALLERS

---

## Open Questions / Unverified Areas

### UNVERIFIED (Requires Runtime/Firestore Inspection)

1. **Production Firestore `draftPicks` Format**
   - Do production team documents have `draftPicks[]` arrays?
   - What protection format is used? (string? array? structured object?)
   - Are there existing IDs on picks?

2. **Route/Provenance Tracking in Production**
   - Is `pick.route[]` populated in any existing data?
   - How is `via` populated - manually or derived?

3. **Contested Pick Behavior**
   - Schema mentions "contested" status
   - No validation logic found - is this a planned feature or dead field?

### ASSUMED (No Call Site Found)

1. **`buildFirstRoundCalendar()` UI Integration**
   - Function exists in `stepienUtils.js`
   - No evidence of UI rendering the calendar
   - ASSUMED: Not integrated with Trade Machine UI

2. **`tradeHelpers.js:isMeaningfulProtection()` Usage**
   - Duplicate exists at line 302
   - Need to verify if any component imports this vs `tradeUtilities.js` version

---

*Document Version 2.0.0 - Updated with Evidence Index, SSOT rules, Stepien calendar strategy, Swap modeling decision, ID migration/adapter requirements.*
*This is analysis only - no code changes made.*
