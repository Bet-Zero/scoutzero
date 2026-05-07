# Trade Machine Draft Picks Master Document

> **Version**: 2.5.0 (January 2026)  
> **Status**: Carried-forward mixed audit/master doc; not the primary current router  
> **Purpose**: Comprehensive audit of draft pick implementation in Trade Machine  
> **Author**: Automated Code Audit  
> **Last Audit**: 2026-01-15  

## Routing Note

Use this document as historical audit context, not as the first-stop current
reference.

- Current trade-machine routing lives in [README.md](README.md).
- Current Architect Trade Machine runtime routing lives in
  [../architect/trade-machine/README.md](../architect/trade-machine/README.md).
- Current pick-entitlement trading behavior is tracked in
  [../architect/trade-machine/TRADE_MACHINE_PICK_TRADING_MASTER.md](../architect/trade-machine/TRADE_MACHINE_PICK_TRADING_MASTER.md).

This file is still carried forward because it contains useful audit detail, but
it also preserves older execution-history and return-package references that do
not all have clean canonical replacements in the current workspace.

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
| Pick Data Model | ✅ Stable IDs Implemented | Low |
| Basic Trading | ✅ Implemented | Low |
| Protection Support | ⚠️ Basic/String-only (UI limitation) | **MEDIUM** |
| Swap Rights | ✅ Resolution Implemented | Low |
| Stepien Validation | ✅ Obligations Wiring Complete | Low |
| Conveyance/Rollover | ✅ **IMPLEMENTED** (2026-01-15) | Low |
| Pick Swaps (Best-of) | ✅ **IMPLEMENTED** (2026-01-15) | Low |
| Pick Chains | ⚠️ Schema exists, UI incomplete | **MEDIUM** |
| Multi-tier Protections | ⚠️ Schema exists, UI incomplete | **MEDIUM** |
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
| **Snippet** | `export const areSamePick = (a, b) => +a.year === +b.year && +a.round === +b.round && (a.via \|\| '') === (b.via \|\| '');` |
| **Call Chain** | `useTradeMachine.togglePick()` → `picksOut.findIndex((p) => areSamePick(p, pick))` |
| **Input Shape** | Two pick objects with `year`, `round`, `via` fields |
| **Output Effect** | Picks without `via` are compared only by year/round; **originalTeam is NOT used** |

### E7: Pick ID Generation in computeTradeDraftKey

| Field | Value |
|-------|-------|
| **Claim** | Pick cache keys use `originalTeam` but not a stable ID |
| **Evidence** | `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js:39-41` |
| **Snippet** | `.map(p => \`${p.year \|\| '?'}-${p.round \|\| '?'}-${p.originalTeam \|\| p.team \|\| '?'}\`)` |
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
| **Snippet** | `draftPicks: teamState.draftPicks \|\| [], picks: teamState.draftPicks \|\| [], // Some validators use 'picks'` |
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
| **Snippet** | `<select ... value={pickObj.protection \|\| ''} onChange={(e) => onEdit(pick, 'protection', e.target.value)}>` with options from `getPickOptions()` |
| **Call Chain** | `TradePickRow` → `onEdit(pick, 'protection', value)` → `updatePickField()` |
| **Input Shape** | `protection` is string: `""`, `"Top 3"`, `"Top 5"`, `"Lottery"`, etc. |
| **Output Effect** | String stored in `picksOut[].protection`; passed to `isMeaningfulProtection()` in validation |

### E13: 7-Year Limit Check in validateStepien

| Field | Value |
|-------|-------|
| **Claim** | `validateStepien.js` enforces 7-year maximum pick trading limit |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:61-67` |
| **Snippet** | `const farthestYear = Math.max(...picks.map((p) => p.year \|\| currentYear)); if (farthestYear - currentYear > 7) { violations.push("Cannot trade picks beyond 7 years out...") }` |
| **Call Chain** | `validateStepien()` → check farthest pick year against currentYear |
| **Input Shape** | `picks[]` array with `year` field; `currentYear` from context |
| **Output Effect** | Adds violation message if any pick is more than 7 years out |

### E14: Second Apron Frozen Pick Restriction

| Field | Value |
|-------|-------|
| **Claim** | `validateStepien.js` blocks second apron teams from trading own 7-year-out picks |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:69-96` |
| **Snippet** | `if (isAtOrAboveSecondApron) { const isFrozenPick = yearsOut >= 7; if (hasOwnFrozenPick) { violations.push("Second apron team cannot trade...") } }` |
| **Call Chain** | `validateStepien()` → check `isAtOrAboveSecondApron` → check picks for own frozen picks |
| **Input Shape** | `team.postTradeStatus?.isAtOrAboveSecondApron`, `pick.originalTeam`, `pick.year` |
| **Output Effect** | Adds violation if second apron team tries to trade own pick 7+ years out |

### E15: Swap Resolution Implemented (G6 RESOLVED - 2026-01-15)

| Field | Value |
|-------|-------|
| **Claim** | `swapResolution.js` provides swap resolution logic |
| **Evidence** | `src/features/architect/utils/tradeMachine/utils/swapResolution.js:112-178` |
| **Snippet** | `export function resolvePickSwap(pick, positionsMap, options = {}) { ... const winner = resolveSwapWinner({ teamA, teamB, swapType }, positionsMap); }` |
| **Call Chain** | `seasonManager.advanceSeasonYear()` → `resolvePickSwap(pick, positionsMap)` at line 1143 |
| **Input Shape** | `pick` with `isSwap: true`, `swapWithTeamId`, `swapType`; `positionsMap` with team → position mapping |
| **Output Effect** | Returns pick with `resolved: true`, `resolvedOwner`, `resolvedPosition` fields |

### E16: Conveyance Resolution Implemented (G3 RESOLVED - 2026-01-15)

| Field | Value |
|-------|-------|
| **Claim** | `conveyanceResolution.js` provides protection trigger and rollover logic |
| **Evidence** | `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js:105-183` |
| **Snippet** | `export function resolveConveyanceForPick(pick, positionsMap, opts = {}) { ... if (protectionTriggers(protection, position)) { return resolveProtectionTrigger(pick, position, opts); } }` |
| **Call Chain** | `seasonManager.advanceSeasonYear()` → `resolveConveyanceForPick(pick, positionsMap)` at line 1222 |
| **Input Shape** | `pick` with `protection` string and/or `conveyance` object; `positionsMap` with team → position mapping |
| **Output Effect** | Returns pick with `conveyanceResult: { outcome: 'rolled' \| 'conveyed' \| 'converted', position, ... }` |

### E17: Pick ID Utilities Implemented (G5 RESOLVED - 2026-01-15)

| Field | Value |
|-------|-------|
| **Claim** | `pickIdUtils.js` provides stable pick ID generation and comparison |
| **Evidence** | `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js:63-75` |
| **Snippet** | `export function generatePickId(pick) { const team = pick.originalTeam \|\| 'UNK'; const year = pick.year \|\| '????'; const round = normalizeRound(pick.round); return \`${team}_${year}_${round}\`; }` |
| **Call Chain** | `ensurePickId(pick)` → `generatePickId(pick)` |
| **Input Shape** | `pick` with `originalTeam`, `year`, `round` (string or number) |
| **Output Effect** | Returns canonical ID format `{originalTeam}_{year}_{round}` (e.g., `"PHI_2026_1"`) |

### E18: Stepien Obligations Wiring (G1 PARTIALLY FIXED - 2026-01-15)

| Field | Value |
|-------|-------|
| **Claim** | `validateStepien.js` now reads existing obligations and considers swap types |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:14-24, 116` |
| **Snippet** | `function reservesYearForStepien(pick) { if (!pick.isSwap) return true; const swapType = pick.swapType \|\| 'best_of'; return swapType !== 'worst_of'; }` and `const existingObligations = team.draftPicksObligations \|\| team.team?.draftPicksObligations \|\| [];` |
| **Call Chain** | `validateStepien(team, tradeCtx)` → `reservesYearForStepien(pick)` → `obligationReservesYear(ob, teamCode)` |
| **Input Shape** | `team.draftPicksObligations[]` array with pick obligations; `pick.isSwap`, `pick.swapType` |
| **Output Effect** | `worst_of` swaps do NOT reserve year for Stepien; `best_of` swaps DO reserve year |

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

### F2) Pick Resolution Utilities (IMPLEMENTED 2026-01-15)

> **Note:** These utilities resolve G3 (Conveyance), G5 (Pick IDs), and G6 (Swap Resolution).

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js` | **Stable Pick IDs (G5)** | `generatePickId()` - Format: `{originalTeam}_{year}_{round}`; `ensurePickId()` - adapter; `areSamePickById()` - comparison |
| `src/features/architect/utils/tradeMachine/utils/swapResolution.js` | **Swap Resolution (G6)** | `resolvePickSwap()` - resolves single swap; `resolveSwapWinner()` - best_of/worst_of logic; `resolveTeamSwaps()` - batch resolution |
| `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js` | **Conveyance/Rollover (G3)** | `resolveConveyanceForPick()` - protection trigger logic; `protectionTriggers()` - position check; `normalizeProtection()` - format adapter |

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

5. **Stepien Rule Validation** [Evidence: E1, E2, E13, E14]
   - Consecutive unprotected 1st round picks blocked [Evidence: E1, E2]
   - 7-year maximum future trading limit [Evidence: E13]
   - Second apron teams blocked from trading 7-year-out own picks [Evidence: E14]
   - Uses `isMeaningfulProtection()` (string regex) to allow protected consecutive picks [Evidence: E2]

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
| G1 | ~~Swap Rights Not Validated~~ | ✅ PARTIALLY FIXED | `validateStepien.js:14-24` | ~~Swaps bypass Stepien~~ → Swap types now considered via `reservesYearForStepien()` | ✅ `worst_of` swaps don't reserve year; `best_of` swaps do reserve year |
| G2 | **No Multi-Tier Protection Support** | BLOCKER | `DraftPickZ`, `TradePickRow.jsx` | Cannot represent real NBA protections (e.g., "Top 3 → Top 5 → Unprotected") | Protection is tiered array with year/condition/conversion; UI allows tier editing |
| G3 | ~~No Conveyance/Rollover Logic~~ | ✅ **RESOLVED** | `conveyanceResolution.js` | ~~No forward path~~ → `resolveConveyanceForPick()` handles roll/convert/cancel | ✅ Conveyance executes at season advance via `seasonManager.js` |
| G4 | **`isMeaningfulProtection()` Format Mismatch** | BLOCKER | `basicRules.js:25`, `tradeUtilities.js:74` | Stepien validation may incorrectly pass/fail based on protection format | Single canonical implementation; all callers use same format |

### MAJOR Level Gaps

| # | Gap Title | Severity | Location | User Impact | Done Criteria |
|---|-----------|----------|----------|-------------|---------------|
| G5 | ~~No Stable Pick ID Strategy~~ | ✅ **RESOLVED** | `pickIdUtils.js` | ~~Picks duplicated/lost~~ → `generatePickId()`, `ensurePickId()`, `areSamePickById()` | ✅ Canonical ID format `{originalTeam}_{year}_{round}` implemented |
| G6 | ~~Pick Swap Best/Worst-Of Logic Missing~~ | ✅ **RESOLVED** | `swapResolution.js` | ~~Cannot model swap~~ → `resolvePickSwap()`, `resolveSwapWinner()` | ✅ Swap resolution compares positions and assigns correctly |
| G7 | **Stepien Calendar Not Shown in UI** | MAJOR | `stepienUtils.js`, `TradeEditor.jsx` | Users don't know which years are blocked before creating trade | Calendar visualization shows blocked/available years per team |
| G8 | ~~Three Duplicate Stepien Implementations~~ | ✅ DELEGATED | `stepienUtils.js:101-109` | ~~Bug fixes may not propagate~~ → `hasStepienViolation()` now delegates to canonical | ✅ `stepienUtils.js` calls `validateStepien.js` internally |
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

```text
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

> **⚠️ DESIGN DECISION REQUIRED:** The rules below are **proposed product behavior**, not verified NBA rules or existing code. The actual reservation logic must be chosen during implementation.

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

**Year Reservation Rules - DESIGN OPTIONS:**

> The following table represents **design options to be decided**, not factual NBA requirements. Choose one approach:

| Scenario | Option A: Reserve All | Option B: Reserve Most | Option C: Reserve Minimum |
|----------|----------------------|------------------------|--------------------------|
| Unprotected outgoing pick | ✅ Yes | ✅ Yes | ✅ Yes |
| Protected pick (could convey) | ✅ Yes (worst case) | ✅ Yes (worst case) | ❌ No (assume protection holds) |
| Swap right (best_of) | ✅ Yes (might get worse) | ✅ Yes (might get worse) | ❌ No |
| Swap right (worst_of) | ✅ Yes (still an obligation) | ❌ No (always get worse) | ❌ No |

**Tradeoffs:**

- **Option A (Reserve All):** Most restrictive; safest for CBA compliance but may be overly conservative
- **Option B (Reserve Most):** Balanced; matches common NBA interpretation for swaps
- **Option C (Reserve Minimum):** Least restrictive; may allow trades that could violate Stepien in edge cases

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
| **1. Firestore Base Data** | `architect_baseTeams/{teamCode}` | `draftPicks[]` array containing draft pick objects. **Status: UNVERIFIED** - field presence, format, and schema compliance require data audit confirmation before schema enforcement |
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
| `hasStepienViolation()` | `rules/draftRules.js:15` | ❌ NO - LIKELY DEAD CODE (requires repo-wide verification) |
| `hasStepienViolation()` | `stepienUtils.js:50` | ❌ NO - LIKELY DEAD CODE (requires repo-wide verification) |

**Required Action:** Delete `draftRules.js:hasStepienViolation` and `stepienUtils.js:hasStepienViolation`, or make them delegates to the canonical `validateStepien.js`.

### SSOT-2: Protection Parser

**Rule:** There must be exactly ONE canonical protection parser.

**Current State (Violation):**

| Implementation | File | Input Format | Called? |
|----------------|------|--------------|---------|
| `isMeaningfulProtection(str)` | `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js:74` | String | ✅ **YES** (canonical, imported by validateStepien.js and draftRules.js) |
| `isMeaningfulProtection(arr)` | `src/features/architect/utils/tradeMachine/rules/basicRules.js:25` | Array | ❌ NO - LIKELY DEAD CODE (requires repo-wide verification) |
| `isMeaningfulProtection(str)` | `src/features/architect/utils/tradeHelpers.js:302` | String | ❌ NO - LIKELY DEAD CODE (requires repo-wide verification) |

**Required Action:**

1. Delete `basicRules.js:isMeaningfulProtection` (array format never used)
2. Delete `tradeHelpers.js:302` duplicate (same logic as tradeUtilities, no callers)

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

> **CRITICAL:** This phase requires either a migration script OR a deterministic adapter. The original v1.0 document incorrectly stated "no schema migration required" in the Phase 1 "Why these first" section.

**Tasks:**

**1.1 Canonical Pick ID Implementation**

- [ ] Create `generatePickId(pick)` utility: returns `{originalTeam}_{year}_{round}`
- [ ] Update `areSamePick()` to use `generatePickId()` for comparison
- [ ] Update `computeTradeDraftKey()` to use `generatePickId()`

**1.2 Round Normalization (Required for Stable IDs)**

- [ ] Create `normalizeRound(round)` utility that:
  - Accepts inputs: `1`, `2`, `"1st"`, `"2nd"`, `"first"`, `"second"`, `"First"`, `"Second"`
  - Returns canonical output: `1` or `2` (number)
- [ ] Use `normalizeRound()` inside:
  - `generatePickId()` - ensure ID uses normalized round
  - `ensurePickId()` - normalize before ID generation
- [ ] **Acceptance Criterion:** IDs must be identical regardless of round input format
  - `generatePickId({ year: 2026, round: "1st", originalTeam: "PHI" })` === `"PHI_2026_1"`
  - `generatePickId({ year: 2026, round: 1, originalTeam: "PHI" })` === `"PHI_2026_1"`
  - `generatePickId({ year: 2026, round: "first", originalTeam: "PHI" })` === `"PHI_2026_1"`

**1.3 ID Adapter Strategy (Recommended over Migration)**

- [ ] Create `ensurePickId(pick)` adapter that:
  - If `pick.id` exists and matches format → use it
  - Otherwise → derive ID via `generatePickId()` and attach to pick object
- [ ] Call `ensurePickId()` in:
  - `useTradeMachine` when loading team picks
  - `togglePick()` when adding pick to trade
  - `schemaAdapter.buildTradeTeamInput()` when building validator input
- [ ] On save: persist canonical ID to Firestore

**1.4 De-Duplicate Stepien Implementations (SSOT-1)**

- [ ] Delete `draftRules.js:hasStepienViolation()` or make it delegate
- [ ] Delete `stepienUtils.js:hasStepienViolation()` or make it delegate
- [ ] Remove re-exports from `validators/index.js` and `tradeMachine/index.js`

**1.5 De-Duplicate Protection Parser (SSOT-2)**

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
- IDs are identical regardless of round input format (via `normalizeRound()`)
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

> **Note:** Phase 1 now explicitly includes ID adapter strategy. The original v1.0 incorrectly stated "no schema migration required" - either migration OR adapter IS needed.
>
> **Gap ID Clarification:** G-numbers (G4, G5, G8) refer to Gap List IDs, not priority order. Phase 1 reorders them by implementation dependency.

**Build first (highest ROI, addresses SSOT violations):**

### 1. Implement Canonical Pick ID with Adapter (G5) - ~10 hours

**Why first:** Prevents data loss, enables reliable pick comparison.

**Tasks:**

1. Create `normalizeRound(round)` → returns canonical `1` or `2` from any input format
2. Create `generatePickId(pick)` → returns `{originalTeam}_{year}_{normalizedRound}`
3. Create `ensurePickId(pick)` adapter → derives ID if missing, attaches to object
4. Update `areSamePick()` → use `generatePickId()` for comparison
5. Update `computeTradeDraftKey()` → use `generatePickId()`
6. Call adapter on:
   - Load: `useTradeMachine` when populating team picks
   - Add: `togglePick()` when selecting pick for trade
   - Save: `mutationPipeline` before Firestore write

**Evidence of Failure Mode:**

- `areSamePick()` compares `year + round + via` [E6]
- Two picks with same year/round from different teams would be treated as identical
- `togglePick()` does not generate ID on add [E8]

### 2. De-Duplicate `isMeaningfulProtection()` (G4, SSOT-2) - ~2 hours

**Why:** LIKELY DEAD CODE creates confusion; two formats (array vs string) exist.

**Tasks:**

1. Delete `basicRules.js:isMeaningfulProtection()` (array format, LIKELY DEAD CODE - requires repo-wide verification [E3])
2. Keep `tradeUtilities.js:isMeaningfulProtection()` as canonical (string format [E2])
3. Delete or update `tradeHelpers.js:302` duplicate (LIKELY DEAD CODE - requires repo-wide verification)

### 3. De-Duplicate Stepien Implementations (G8, SSOT-1) - ~4 hours

**Why:** Three implementations create maintenance risk; only one is actually called.

**Tasks:**

1. Confirm `validateStepien.js` is canonical (already called by tradeValidator [E1])
2. Delete `draftRules.js:hasStepienViolation()` (LIKELY DEAD CODE - requires repo-wide verification [E10])
3. Delete `stepienUtils.js:hasStepienViolation()` (LIKELY DEAD CODE - requires repo-wide verification [E10])
4. Remove re-exports from barrel files (`validators/index.js`, `tradeMachine/index.js`)

**Which One is Actually Called (Evidence):**

- `tradeValidator.js:11` imports from `'../rules/validateStepien.js'`
- `validators/index.js:45` re-exports from `stepienUtils.js` - LIKELY DEAD CODE (requires repo-wide verification)
- `draftRules.js` exports - LIKELY DEAD CODE (requires repo-wide verification)

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

*Document Version 2.0.1 - Patches applied per PREFLIGHT DOC PATCH request:*

- *Added Evidence Index entries E13 (7-year limit) and E14 (second apron frozen picks)*
- *Year Reservation Rules table marked as DESIGN DECISION REQUIRED with options*
- *Firestore data format marked as UNVERIFIED*
- *Round normalization requirement added to Phase 1*
- *SSOT dead code labels changed to "LIKELY DEAD CODE (needs repo-wide confirm)"*
*This is analysis only - no code changes made.*

---

## Phase 1 Completion Log (January 2026)

### What Changed

**O1) Canonical Pick ID + Round Normalization (Phase 1.1 + 1.2) ✅**

- Created `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js` with:
  - `normalizeRound(input)` - Accepts 1, 2, "1st", "2nd", "first", "second" (case-insensitive) → returns canonical `1` or `2`
  - `generatePickId(pick)` - Returns `{originalTeam}_{year}_{round}` format (e.g., "PHI_2026_1")
  - `ensurePickId(pick)` - If valid ID exists, preserves it; otherwise generates ID and adds `pickIdWarning` for missing fields
  - `areSamePickById(a, b)` - Compares two picks by their canonical IDs

**O2) Wire ID adapter into ALL relevant paths (Phase 1.2) ✅**

- Updated `useTradeMachine.js`:
  - Team initialization now maps picks through `ensurePickId()` on load
  - `selectTeam()` now ensures all picks have IDs
  - `togglePick()` now ensures picks have IDs before adding to `picksOut`
- Updated `areSamePick()` in `tradeHelpers.js` to delegate to `areSamePickById()` (ID-based comparison)
- Updated `computeTradeDraftKey.js` to use `generatePickId()` for pick tokens

**O3) SSOT-2: De-duplicate `isMeaningfulProtection()` ✅**

- Removed duplicate array-based implementation from `basicRules.js` (confirmed DEAD CODE - no imports)
- Updated `tradeHelpers.js` to re-export canonical `isMeaningfulProtection` from `tradeUtilities.js`
- Canonical implementation remains in `tradeUtilities.js` (string/regex based)

**O4) SSOT-1: De-duplicate Stepien implementations ✅**

- Canonical implementation: `rules/validateStepien.js` (unchanged, called by tradeValidator)
- Converted `draftRules.js:hasStepienViolation()` to delegate to canonical `validateStepien()`
- Converted `stepienUtils.js:hasStepienViolation()` to delegate to canonical `validateStepien()`
- Updated `validateStepien.js` to skip `isSwap` picks (backward compatibility - swap validation is Phase 2)

**O5) Tests ✅**

- Created `tests/tradeMachine/pickIdUtils.test.js` with 34 tests covering:
  - `normalizeRound()` - all input formats, edge cases
  - `generatePickId()` - canonical ID generation, missing fields
  - `ensurePickId()` - ID preservation, fallback generation, warnings
  - `areSamePickById()` - ID-based comparison
  - Integration test: same year/round, different originalTeam

### Files Changed/Added

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js` | **Created** | Canonical pick ID utilities |
| `tests/tradeMachine/pickIdUtils.test.js` | **Created** | Unit tests for pickIdUtils |
| `src/features/architect/hooks/useTradeMachine.js` | Modified | Wire ensurePickId into load + toggle |
| `src/features/architect/utils/tradeHelpers.js` | Modified | areSamePick → ID-based; re-export isMeaningfulProtection |
| `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js` | Modified | Use generatePickId for pick tokens |
| `src/features/architect/utils/tradeMachine/rules/basicRules.js` | Modified | Removed duplicate isMeaningfulProtection |
| `src/features/architect/utils/tradeMachine/rules/draftRules.js` | Modified | Delegate hasStepienViolation to canonical |
| `src/features/architect/utils/stepienUtils.js` | Modified | Delegate hasStepienViolation to canonical |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | Modified | Skip isSwap picks for backward compat |
| `src/features/architect/utils/tradeMachine/index.js` | Modified | Export pickIdUtils functions |

### Validation Steps Run

1. **Unit Tests**: `npm run test -- tests/tradeMachine/pickIdUtils.test.js --run` ✅ 34/34 passed
2. **Stepien Tests**: `npm run test -- tests/hasStepienViolation.test.js --run` ✅ 4/4 passed
3. **Trade Helpers Tests**: `npm run test -- tests/tradeHelpers.test.js --run` ✅ 5/5 passed
4. **Cap Utils Tests**: `npm run test -- tests/capUtils.test.js --run` ✅ 12/12 passed
5. **Build**: `npm run build` ✅ Completed successfully

### Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Two picks with same year/round but different originalTeam never collide | ✅ `areSamePickById` compares by full canonical ID |
| 2 | `areSamePick()` is ID-based | ✅ Delegates to `areSamePickById()` |
| 3 | `computeTradeDraftKey()` is ID-based | ✅ Uses `generatePickId()` for pick tokens |
| 4 | `togglePick()` always inserts picks into `picksOut` with `id` | ✅ Calls `ensurePickId()` before insert |
| 5 | Only one canonical `isMeaningfulProtection()` exists | ✅ `tradeUtilities.js`; others removed/re-export |
| 6 | Only one canonical Stepien logic implementation exists | ✅ `validateStepien.js`; others delegate |
| 7 | Tests added and passing | ✅ 34 new tests, all pass |
| 8 | App builds without runtime errors | ✅ Build successful |

### Known Risks / Edge Cases

1. **Missing `originalTeam` in base data**: Picks without `originalTeam` produce IDs like `UNK_2026_1`. These will:
   - Work correctly (picks can still be selected/removed)
   - Show `pickIdWarning` in console during development
   - Require data migration/audit to populate `originalTeam` in Firestore for full stability

2. **Swap validation still bypassed**: `isSwap` picks are excluded from Stepien checks (maintained for backward compatibility). This is a known Phase 2 item (Gap G1).

3. **Pre-existing test failure**: `tradeValidator.test.js` has 1 failing test about hard cap violation message wording - this is unrelated to Phase 1 changes (confirmed by running tests on base branch).

---

### v2.0.2 - Phase 1 Tightening Fixes (January 2026)

**Summary**: Correctness fixes and repo convention alignment per Phase 1 review notes.

#### T1) Test Location Convention Fix ✅

- **Problem**: Test file was in root `tests/tradeMachine/` instead of repo convention `src/tests/`
- **Solution**: Moved `tests/tradeMachine/pickIdUtils.test.js` → `src/tests/tradeMachine/pickIdUtils.test.js`
- **Files Changed**:
  - `src/tests/tradeMachine/pickIdUtils.test.js` (moved from `tests/tradeMachine/`)
- **Verification**: `npm test -- src/tests/tradeMachine/pickIdUtils.test.js --run` ✅ 34/34 passed

#### T2) Stepien Delegate Wrappers Already Correct ✅

- **Assessment**: Both `hasStepienViolation()` wrappers in `draftRules.js` and `stepienUtils.js` were already returning boolean correctly via `return !result.passed`
- **No Changes Needed**: Wrappers preserve original signature and return boolean as expected

#### T3) Removed isSwap Skip Behavior in validateStepien ✅

- **Problem**: `validateStepien.js` line 37 had `&& !pick.isSwap` that skipped swap picks from Stepien checks
- **Solution**: Removed the `!pick.isSwap` exclusion so swaps are treated the same as outright picks
- **Rationale**: Phase 1 should not introduce permanent swap bypass behavior; proper swap modeling is Phase 2
- **Files Changed**:
  - `src/features/architect/utils/tradeMachine/rules/validateStepien.js` - Removed `&& !pick.isSwap` filter
  - `tests/hasStepienViolation.test.js` - Updated test expectation from "ignores swap years" → "treats swap years the same as outright picks for Stepien"
- **Verification**:
  - `npm test -- tests/hasStepienViolation.test.js --run` ✅ 4/4 passed
  - `npm test -- tests/validators/stepien.test.js --run` ✅ 7/7 passed

#### T4) Stabilized computeTradeDraftKey with ensurePickId ✅

- **Problem**: `computeTradeDraftKey` used `generatePickId(p)` directly, which could produce unstable tokens for picks with missing fields
- **Solution**: Changed to use `ensurePickId(p).id` which:
  - Preserves existing valid IDs
  - Generates stable fallback IDs with warnings for missing fields
- **Files Changed**:
  - `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js` - Import `ensurePickId` instead of `generatePickId`; use `ensurePickId(p).id` for pick tokens
- **Verification**: Build successful, no test failures

#### Commands Run

```bash
# T1 - Test location
npm test -- src/tests/tradeMachine/pickIdUtils.test.js --run  # 34/34 ✅

# T3 - Stepien tests
npm test -- tests/hasStepienViolation.test.js --run           # 4/4 ✅
npm test -- tests/validators/stepien.test.js --run            # 7/7 ✅

# Related tests
npm test -- tests/tradeHelpers.test.js --run                   # 5/5 ✅
npm test -- tests/capUtils.test.js --run                       # 12/12 ✅

# Build
npm run build                                                  # ✅ Success
```

#### Key Behavioral Change

**`validateStepien` no longer explicitly skips `isSwap` picks.**

Before (v2.0.1):

```javascript
const firstRoundPicks = picks.filter(
  (pick) => (pick.round === '1st' || pick.round === 1 || pick.round === 'first') && !pick.isSwap
);
```

After (v2.0.2):

```javascript
const firstRoundPicks = picks.filter(
  (pick) => pick.round === '1st' || pick.round === 1 || pick.round === 'first'
);
```

Swap picks are now included in Stepien consecutive-year checks. Proper swap modeling (swap resolution, best-of logic) remains Phase 2 work.

---

## Phase 2 PREFLIGHT Findings (January 2026)

> **Status**: PREFLIGHT COMPLETE  
> **Mode**: Minimal behavioral changes, DEV-only instrumentation gated  
> **Purpose**: Produce repo-proven answers for Phase 2 implementation readiness

### Task A: Runtime Pick Shapes (Authoritative)

#### Pick Shape Matrix

| Pipeline Stage | Source Location | Example Keys Present | Format Variants | Notes |
|---------------|-----------------|---------------------|-----------------|-------|
| **1. Firestore Base** | `architect_baseTeams/{teamCode}.draftPicks[]` | `year`, `round`, `originalTeam`, `currentOwner`, `protection`, `status` | `round: 1` or `"1st"`; `protection: string \| null` | UNVERIFIED in production - needs data audit |
| **2. Team Loader** | `firebaseTeamPlanHelpers.hydrateBaseTeam()` → `draftPicks` | Same as Firestore | Passed through unchanged | E15 |
| **3. useTradeMachine Init** | `useTradeMachine.js:237-245` | `id` (generated), `year`, `round`, `originalTeam`, `protection`, `pickIdWarning` (if missing fields) | `ensurePickId()` normalizes and adds `id` | E16 |
| **4. UI State (picksOut)** | `teams[idx].picksOut[]` | `id`, `year`, `round`, `originalTeam`, `protection`, `isSwap`, `swapWithTeamId`, `fromTeamId`, `toTeamId` | `isSwap: boolean`; `swapWithTeamId: string \| null` | E17 |
| **5. Validator Input** | `tradeValidator.js` → `validateStepien(team, ctx)` | `team.outgoingPicks[]` or `team.picksOut[]` | Uses `outgoingPicks` if present, else `picksOut` | E18 |
| **6. Stepien Evaluation** | `validateStepien.js:37-61` | `year`, `round`, `protection` | Reads `isSwap` but treats same as outright (Phase 1 behavior) | E19 |

#### Evidence Index Additions (E15+)

##### E15: Firestore → Team Loader Pass-Through

| Field | Value |
|-------|-------|
| **Claim** | `draftPicks` array passes unchanged from Firestore through `hydrateBaseTeam()` |
| **Evidence** | `src/features/architect/utils/firebaseTeamPlanHelpers.js:163` |
| **Snippet** | `draftPicks: baseDoc.draftPicks \|\| [],` |

##### E16: useTradeMachine ID Normalization

| Field | Value |
|-------|-------|
| **Claim** | All picks are normalized via `ensurePickId()` on load |
| **Evidence** | `src/features/architect/hooks/useTradeMachine.js:237-239` |
| **Snippet** | `const rawPicks = data.draftPicks \|\| data.picks \|\| []; const picksWithIds = rawPicks.map(p => ensurePickId(p));` |
| **Call Chain** | `init()` / `selectTeam()` → `ensurePickId()` for each pick |

##### E17: picksOut UI State Shape

| Field | Value |
|-------|-------|
| **Claim** | `picksOut` contains selected picks with swap fields |
| **Evidence** | `src/features/architect/hooks/useTradeMachine.js:438-441` |
| **Snippet** | `newTeams[index].picksOut = [...newTeams[index].picksOut, { ...pickWithId, fromTeamId: newTeams[index].team?.id }];` |
| **Fields Added** | `fromTeamId`, `toTeamId`, `isSwap`, `swapWithTeamId` (via UI editing) |

##### E18: Validator Uses outgoingPicks or picksOut

| Field | Value |
|-------|-------|
| **Claim** | `validateStepien` accepts picks from `outgoingPicks` or `picksOut` |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:15, 22` |
| **Snippet** | `const { picksOut = [], outgoingPicks = [] } = team;` and `const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;` |

##### E19: Stepien Reads isSwap But Treats As Outright

| Field | Value |
|-------|-------|
| **Claim** | `isSwap` picks are included in Stepien checks but not specially handled |
| **Evidence** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:37-39` |
| **Snippet** | `const firstRoundPicks = picks.filter((pick) => pick.round === '1st' \|\| pick.round === 1 \|\| pick.round === 'first');` |
| **Note** | Phase 1 v2.0.2 removed `!pick.isSwap` exclusion - swaps now included |

##### E20: swapWithTeamId Has Zero Validator Call Sites

| Field | Value |
|-------|-------|
| **Claim** | `swapWithTeamId` field is stored in UI but never read by any validator, rule, or engine file |
| **Evidence** | Repository-wide search confirms no reads in validation layer |
| **Search Command** | `grep -r "swapWithTeamId" src/features/architect/utils/tradeMachine/` |
| **Search Result** | No matches found in validator/rules/engine directories |
| **Write Locations** | `TradePickRow.jsx:131` - UI dropdown writes value via `updatePickField()` |
| **Read Locations** | `TradePickRow.jsx:130` - UI display only (reads own stored value for form control) |
| **Summary** | Field is UI-only; swap partner selection is stored but meaningless for validation |
| **Files Where Field Appears** | (1) `TradePickRow.jsx` - UI write/read for display<br/>(2) Test fixtures - `swapOnly.json`, `swapPlusAdjacentPick.json`, `secondApronFrozenSwap.json` |
| **Validator/Rules/Engine Reads** | **ZERO** - No validator, rule, or engine file reads this field |

---

### Task B: Validator Input Pipeline (Call Graph)

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PICK DATA FLOW (Validated)                            │
└─────────────────────────────────────────────────────────────────────────────────┘

1. USER SELECTS PICK
   └─► TradePickRow.jsx onToggle(pick)
       └─► useTradeMachine.togglePick(idx, pick)
           └─► ensurePickId(pick)                    // Generate/preserve canonical ID
               └─► newTeams[idx].picksOut.push({...pick, fromTeamId})

2. USER EDITS PICK
   └─► TradePickRow.jsx onEdit(pick, 'isSwap', true)
       └─► useTradeMachine.updatePickField(idx, pick, 'isSwap', true)
           └─► picksOut[pickIdx].isSwap = value      // Boolean stored
   └─► TradePickRow.jsx onEdit(pick, 'swapWithTeamId', 'OKC')
       └─► useTradeMachine.updatePickField(idx, pick, 'swapWithTeamId', 'OKC')
           └─► picksOut[pickIdx].swapWithTeamId = value

3. VALIDATION TRIGGERED
   └─► useTradeMachine.handleValidate()
       └─► validateCurrentTrade()
           └─► validateTrade({teams: [...], capProjections, currentYear})
               │
               ├─► BUILD teamsWithAssets[] for each team:
               │   ├─► team.salaryOut = computed
               │   ├─► team.salaryIn = computed
               │   └─► team.picksOut preserved from input
               │
               └─► RUN validators for each team:
                   └─► validators.validateStepien(team, context)
                       │
                       │  [validateStepien.js:15]
                       ├─► Extract: const { picksOut = [], outgoingPicks = [] } = team;
                       │
                       │  [validateStepien.js:22]
                       ├─► const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;
                       │
                       │  [validateStepien.js:37-39]
                       ├─► const firstRoundPicks = picks.filter(round === '1st' || 1 || 'first')
                       │   NOTE: isSwap picks INCLUDED (Phase 1 v2.0.2)
                       │
                       │  [validateStepien.js:46-60]
                       ├─► Check consecutive unprotected years
                       │   └─► isMeaningfulProtection(current.protection) [tradeUtilities.js:74]
                       │
                       │  [validateStepien.js:64-68]
                       ├─► Check 7-year limit
                       │
                       │  [validateStepien.js:78-97]
                       └─► Check second apron frozen pick restriction
```

#### Definitive "Truth Object" for Stepien

The validator uses:

- **`team.outgoingPicks[]`** (if present and length > 0) OR
- **`team.picksOut[]`** (fallback)

Fields actually read by Stepien:

- `pick.year` - Draft year (number)
- `pick.round` - Draft round (1, "1st", or "first" for first round)
- `pick.protection` - Protection string (passed to `isMeaningfulProtection()`)
- `pick.originalTeam` - For second apron frozen pick check

Fields **NOT currently used** by Stepien:

- `pick.isSwap` - Present but not read (Phase 2 Gap G1)
- `pick.swapWithTeamId` - Present but not read (Phase 2 Gap G1)
- `pick.id` - Not used in validation logic

#### Other Validators Reading Pick Fields

| Validator | File | Pick Fields Read |
|-----------|------|------------------|
| `validateStepien` | `rules/validateStepien.js` | year, round, protection, originalTeam |
| `draftRules.validateDraftPicks` | `rules/draftRules.js` | year, round, isSwap, protection |
| None others | - | No other validators currently read pick fields |

---

### Task C: Swap Reality Check

#### All Swap-Related Fields

| Field | Type | Written In | Read In | Current Behavior |
|-------|------|------------|---------|------------------|
| `isSwap` | `boolean` | `TradePickRow.jsx:120` via `updatePickField()` | `formatPick()` display, `TradeSummaryPanel.jsx:23` | UI display only; included in Stepien filter but not specially handled |
| `swapWithTeamId` | `string \| null` | `TradePickRow.jsx:131` via `updatePickField()` | Nowhere | **NEVER READ** - stored but ignored |

#### Swap Field Write Locations (Exhaustive)

1. **TradePickRow.jsx:119-121** - UI checkbox toggle

   ```jsx
   <input type="checkbox" checked={!!pickObj.isSwap}
     onChange={(e) => onEdit(pick, 'isSwap', e.target.checked)} />
   ```

2. **TradePickRow.jsx:129-131** - UI dropdown select

   ```jsx
   value={pickObj.swapWithTeamId || ''}
   onChange={(e) => onEdit(pick, 'swapWithTeamId', e.target.value)}
   ```

#### Swap Field Read Locations (Exhaustive)

1. **formatPick()** - `tradeHelpers.js:304`

   ```js
   if (p.isSwap) str += ' 🔁 Swap';
   ```

2. **TradeSummaryPanel.jsx:23**

   ```jsx
   if (p.isSwap) label += ` 🔄 Swap`;
   ```

3. **validateStepien.ts:48, 59** (TypeScript version, not JS)

   ```ts
   isSwap: p.isSwap === true,
   ```

4. **draftRules.js:40** (in `validateDraftPicks`, NOT called by tradeValidator)

   ```js
   !p.isSwap && // excludes swaps from Stepien check
   ```

**CONFIRMED: `swapWithTeamId` has ZERO read call sites.**

#### 5 Swap Scenarios for Phase 2

| # | Scenario | Expected Behavior | Current Gap |
|---|----------|------------------|-------------|
| S1 | Swap-only trade (no outright pick) | Swap year should count for Stepien reservation | No special handling |
| S2 | Swap + adjacent year outright pick | Should FAIL Stepien (consecutive obligation) | May incorrectly pass |
| S3 | Best-of swap resolution (draft lottery results) | Controller selects better pick position | No resolution logic |
| S4 | Swap partner identification in UI | Show "Swap: Best of PHI/OKC" | `swapWithTeamId` ignored |
| S5 | Second apron frozen swap year | Should block 7-year-out swaps | Not implemented |

---

### Task D: Stepien "Year Reservation" Decision Package

> **⚠️ DESIGN DECISION REQUIRED**

#### Decision Options

| Option | Behavior | Swaps Reserve Year? | Protected Picks Reserve? | Tradeoffs |
|--------|----------|--------------------|-----------------------|-----------|
| **A: Reserve All** | Most restrictive (worst-case) | ✅ Yes | ✅ Yes (could convey) | Safest CBA compliance; may block valid trades |
| **B: Reserve Most** | Balanced | ✅ Yes | ✅ Yes (could convey) | Matches common NBA interpretation |
| **C: Reserve Minimum** | Least restrictive | ❌ No | ❌ No | May allow invalid trades; poor UX |

#### Recommendation: **Option B (Reserve Most)**

**Justification:**

1. **CBA Intent**: Stepien rule exists to ensure teams always have a first-round pick available. Swaps represent a real obligation that could result in the team losing their pick.

2. **Repo Reality**:
   - `isSwap` is already stored in pick objects (E4, E-F3)
   - Phase 1 v2.0.2 removed swap exclusion, so swaps are now evaluated
   - Adding year reservation is additive, not disruptive

3. **UX Expectations**: Users expect swaps to "count" toward Stepien. Trading a 2026 swap + 2027 outright should feel like trading consecutive picks.

4. **Exception for worst_of**: A "worst of" swap doesn't reserve the year because the team is guaranteed to keep the better pick.

**Implementation Impact:**

- Modify `validateStepien.js` to check `isSwap` field
- For `isSwap === true`: Reserve the year (treat as obligation)
- For `isSwap === false`: Normal outright pick handling
- Future: Add `swapType: 'best_of' | 'worst_of'` to distinguish

---

### Task E: Fixtures & Tests

#### Fixtures Created

| Fixture | Path | Purpose |
|---------|------|---------|
| `swapOnly.json` | `src/tests/fixtures/tradeMachinePicks/` | Single swap, no consecutive issue |
| `swapPlusAdjacentPick.json` | `src/tests/fixtures/tradeMachinePicks/` | Swap + adjacent unprotected 1st |
| `protectionStringPresent.json` | `src/tests/fixtures/tradeMachinePicks/` | Protected pick bypasses Stepien |
| `missingOriginalTeam.json` | `src/tests/fixtures/tradeMachinePicks/` | Tests UNK fallback in ID generation |
| `multiTeamTrade.json` | `src/tests/fixtures/tradeMachinePicks/` | 3-team trade with picks |
| `secondApronFrozenSwap.json` | `src/tests/fixtures/tradeMachinePicks/` | Second apron 7-year swap attempt |

#### Test File

| File | Path | Status |
|------|------|--------|
| `draftPicksPreflight.test.js` | `src/tests/tradeMachine/` | 16 passing, 2 skipped (Phase 2) |

**Skipped Tests:**

- `swapPlusAdjacentPick fixture (Phase 2 Gap G1)` - Requires swap year reservation
- `Second Apron Frozen Pick Restriction (Phase 2)` - Requires swap + frozen pick logic

---

### DEV-Only Instrumentation

No additional DEV-only instrumentation was added in Phase 2 PREFLIGHT. The existing `console.warn` in `pickIdUtils.js:139` (gated by `import.meta?.env?.MODE !== 'production'`) is sufficient for tracking missing pick fields.

---

### Validation Commands Run

```bash
# Tests
npm run test -- src/tests/tradeMachine/draftPicksPreflight.test.js --run
# Result: 16 passed, 2 skipped (18)

npm run test -- src/tests/tradeMachine/pickIdUtils.test.js --run
# Result: 34 passed (34)

# Build
npm run build
# Result: ✓ built in 9.92s (no errors)
```

---

### Files Changed/Added in Phase 2 PREFLIGHT

| File | Action | Description |
|------|--------|-------------|
| `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` | Updated | Added Phase 2 PREFLIGHT Findings section |
| `docs/return-packages/trade-machine-draft-picks__phase-2-preflight__2026-01-04.md` | Created | Return Package document |
| `src/tests/fixtures/tradeMachinePicks/swapOnly.json` | Created | Swap-only fixture |
| `src/tests/fixtures/tradeMachinePicks/swapPlusAdjacentPick.json` | Created | Swap + adjacent pick fixture |
| `src/tests/fixtures/tradeMachinePicks/protectionStringPresent.json` | Created | Protection string fixture |
| `src/tests/fixtures/tradeMachinePicks/missingOriginalTeam.json` | Created | Missing originalTeam fixture |
| `src/tests/fixtures/tradeMachinePicks/multiTeamTrade.json` | Created | Multi-team trade fixture |
| `src/tests/fixtures/tradeMachinePicks/secondApronFrozenSwap.json` | Created | Second apron frozen swap fixture |
| `src/tests/tradeMachine/draftPicksPreflight.test.js` | Created | Phase 2 preflight test skeleton |

---

## Phase 2 EXECUTION Completion Log (January 2026)

> **Status**: PHASE 2 COMPLETE  
> **Date**: 2026-01-04  
> **Version**: 2.1.0

### What Changed

#### O1) Stepien Year Reservation Logic (Option B: "Reserve Most") ✅

- Implemented `reservesYearForStepien()` helper function in `validateStepien.js`
- **Rule**: Outright picks always reserve year for Stepien
- **Rule**: Swap picks (`isSwap === true`) reserve year unless `swapType === 'worst_of'`
- **Rule**: Missing `swapType` is treated as `'best_of'` for backward compatibility
- Built Stepien-relevant calendar from picks that reserve years only

#### O2) Second Apron Frozen Pick Restriction Includes Swaps ✅

- Updated second apron frozen pick check to apply to all first-round assets
- Restriction applies to both outright picks AND swap assets
- No exceptions for `swapType` - even `worst_of` swaps are blocked at 7+ years out

#### O3) Added `swapType` to UI State + Editing ✅

- Updated `TradePickRow.jsx` with new swap type control:
  - Added `swapType` dropdown (`best_of` / `worst_of`) when `isSwap` is enabled
  - Automatically set `swapType` to `'best_of'` when `isSwap` is turned on
  - Clear both `swapWithTeamId` and `swapType` when `isSwap` is turned off

#### O4) Wired swapWithTeamId + swapType into Display Strings ✅

- Updated `formatPick()` in `tradeHelpers.js`:
  - Shows swap type: "Swap (Best of)" or "Swap (Worst of)"
  - Shows swap partner if present: "vs OKC"
  - Missing swapType defaults to "Best of"

- Updated `getPickLabel()` in `TradeSummaryPanel.jsx`:
  - Same display logic as `formatPick()`
  - Consistent swap rendering across summary and export views

#### O5) Tests Added/Updated ✅

- **`tests/validators/stepien.test.js`**: Added 7 new swap-specific tests
  - `best_of swap + adjacent unprotected 1st fails Stepien`
  - `worst_of swap + adjacent unprotected 1st passes Stepien`
  - `missing swapType defaults to best_of (backward compat)`
  - `swap-only trade does NOT automatically fail Stepien`
  - `two non-consecutive swaps pass Stepien`
  - `blocks second apron teams trading own 7-year-out swap`
  - `blocks second apron teams trading own 7-year-out worst_of swap`

- **`src/tests/tradeMachine/draftPicksPreflight.test.js`**: Unskipped and updated Phase 2 tests
  - All previously skipped tests now run and pass
  - Added additional test cases for backward compatibility

### Files Changed/Added

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | Modified | Added `reservesYearForStepien()` helper; updated Stepien calendar to use year reservation |
| `src/features/architect/tradeMachine/TradePickRow.jsx` | Modified | Added `swapType` dropdown control; updated swap toggle behavior |
| `src/features/architect/utils/tradeHelpers.js` | Modified | Updated `formatPick()` to show swap type and partner |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` | Modified | Updated `getPickLabel()` to show swap type and partner |
| `tests/validators/stepien.test.js` | Modified | Added 7 new swap-specific test cases |
| `src/tests/tradeMachine/draftPicksPreflight.test.js` | Modified | Unskipped Phase 2 tests; added new test cases |
| `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` | Modified | Added Phase 2 Completion Log |
| `docs/return-packages/trade-machine-draft-picks__phase-2-execution__2026-01-04.md` | Created | Phase 2 Return Package |

### Validation Commands Run

```bash
# Tests - Stepien
npm run test -- tests/validators/stepien.test.js --run
# Result: 14 passed (14)

# Tests - Draft Picks Preflight
npm run test -- src/tests/tradeMachine/draftPicksPreflight.test.js --run
# Result: 23 passed (23)

# Build
npm run build
# Result: ✓ built in 9.56s (no errors, only expected chunk size warnings)
```

### Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | validateStepien enforces swap year reservation per Option B | ✅ `reservesYearForStepien()` implemented |
| 2 | best_of swap counts toward Stepien, worst_of doesn't | ✅ Tested with 4 swap-specific tests |
| 3 | missing swapType treated as best_of | ✅ Backward compatibility test passes |
| 4 | second apron frozen restriction blocks own 7-year-out swap assets | ✅ Applies to all swap types |
| 5 | UI supports editing swapType when isSwap enabled | ✅ `TradePickRow.jsx` updated |
| 6 | swap partner/type appears in summary/export labels | ✅ `formatPick()` and `getPickLabel()` updated |
| 7 | All relevant tests pass | ✅ 37 tests total (14 + 23) |
| 8 | App builds without errors | ✅ Build successful |

### What Remains (Phase 3+)

1. **Swap Resolution Logic**: Actual best-of/worst-of pick assignment based on lottery results (not implemented)
2. **Conveyance/Rollover**: Multi-tier protection and pick rolling (not implemented)
3. **Schema Migration**: No Firestore schema changes made; adapter-only approach used
4. **Stepien Calendar Visualization**: UI indicator of blocked years (future enhancement)

### Behavioral Notes

1. **`swapType` defaults**: When `isSwap` is enabled in UI, `swapType` automatically defaults to `'best_of'`
2. **Backward compatibility**: Legacy picks with `isSwap: true` but no `swapType` are treated as `'best_of'`
3. **worst_of exception**: Only affects Stepien year reservation, NOT second apron frozen restriction
4. **Display format**: Picks show "🔁 Swap (Best of) vs OKC" when swap info is present

---

## Phase 3 PREFLIGHT Findings (January 2026)

> **Status**: PREFLIGHT COMPLETE  
> **Mode**: DOCS + tests-only (no runtime behavior changes)  
> **Purpose**: Produce no-surprises implementation plan for swap resolution and conveyance

### Key Findings Summary

1. **Pick Consumers Identified (8 total)**:
   - `updateDraftPicks()` - Season advance status update
   - `updateDraftPicksWithStepien()` - Stepien recalculation
   - `tradeManager.executeTrade()` - Trade execution pick routing
   - `mutationPipeline.computeTradeResult()` - Alternate trade pipeline
   - `validateStepien()` - Stepien validation
   - `validateDraftPicks()` - 7-year limit check
   - `buildFirstRoundCalendar()` - Calendar visualization
   - `computeTradeDraftKey()` - Cache key generation

2. **Resolution Timing Decision**:
   - **Current State**: NO resolution logic exists anywhere
   - **Recommended**: Resolution should occur during `advanceSeasonInWorld()` when advancing past a draft year
   - **Required Inputs**: Draft lottery results (`Map<TeamCode, number>`)

3. **Resolved-Pick Schema (Recommended: Minimal Extension)**:

   ```typescript
   interface DraftPick {
     // ... existing fields unchanged ...
     
     // NEW resolution fields
     resolved: boolean;              // False until resolution event
     resolvedOwner?: TeamCode;       // Who got pick after swap resolution
     resolvedPosition?: number;      // Draft position 1-60
     resolutionMeta?: {
       resolvedAt: string;
       method: 'lottery' | 'manual';
       positions?: Record<TeamCode, number>;
     };
   }
   ```

4. **Conveyance/Rollover Current State**:
   - Protection stored as **string only** ("Top 3", "Lottery", etc.)
   - `DraftPickConveyanceZ` schema exists but **NEVER USED** by any runtime code
   - No rollover logic implemented in `seasonManager.js`
   - **Phase 3 Scope**: Document gap only; full conveyance is separate effort

5. **Label Formatting Duplication**:
   - `formatPick()` in `tradeHelpers.js` - Shared utility
   - `getPickLabel()` in `TradeSummaryPanel.jsx` - Local duplicate
   - **Difference**: Swap emoji (🔁 vs 🔄)
   - **Recommendation**: Unify to single configurable formatter

6. **CRITICAL: No Execution Target**:
   - No draft lottery simulation exists
   - No world-advancing sim needs resolved picks
   - **Phase 3 is infrastructure** for future features

### Evidence Index Additions (E21+)

#### E21: Pick Consumers Beyond Display

| Field | Value |
|-------|-------|
| **Claim** | 8 code locations consume picks beyond display |
| **Evidence** | See Pick Consumers Table in Return Package |
| **Key Finding** | ALL consumers work with unresolved picks; none require swap resolution |

#### E22: No Resolution Logic Exists

| Field | Value |
|-------|-------|
| **Claim** | There is no swap resolution implementation in the repo |
| **Search** | `grep -r "resolveSwap\|resolutionMeta\|resolvedOwner" src/` returns no results |
| **Impact** | Phase 3 must build resolution from scratch |

#### E23: Conveyance Schema vs Implementation Gap

| Field | Value |
|-------|-------|
| **Claim** | `DraftPickConveyanceZ` schema is defined but unused |
| **Evidence** | `src/schemas/architect.ts:91-123` |
| **Search** | `grep -r "conveyance\|ifConveys\|ifRolls" src/features/` only finds schema |
| **Impact** | Conveyance is documentation-only; no runtime support |

#### E24: Duplicate Label Formatters

| Field | Value |
|-------|-------|
| **Claim** | Two pick label formatters exist with minor differences |
| **Locations** | `tradeHelpers.js:338` (`formatPick`), `TradeSummaryPanel.jsx:22` (`getPickLabel`) |
| **Difference** | Swap emoji: 🔁 vs 🔄; note field inclusion |
| **Recommendation** | Unify into single configurable `formatPick()` |

### Swap Resolution Definition

**What "resolution" means in this repo:**

For a swap pick (e.g., "best of PHI/OKC 2026 1st"):

- **Unresolved state**: Pick has `isSwap: true`, `swapType: 'best_of'`, `swapWithTeamId: 'OKC'`, `resolved: false`
- **Resolution event**: When 2026 draft lottery results are known (or simulated)
- **Resolved state**: Pick has `resolved: true`, `resolvedOwner: 'OKC'` (the team whose pick was selected)

**"Higher pick" definition:**

- Lower number = better/higher pick (pick #1 is best, #60 is worst)
- `best_of` → Controller gets pick with **lower** position number
- `worst_of` → Controller gets pick with **higher** position number

### Files Changed in Phase 3 PREFLIGHT

| File | Action | Description |
|------|--------|-------------|
| `docs/return-packages/trade-machine-draft-picks__phase-3-preflight__2026-01-04.md` | Created | Full Return Package with findings |
| `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` | Updated | Added Phase 3 PREFLIGHT Findings section |

### Phase 3 EXECUTION Scope

Based on PREFLIGHT findings, Phase 3 EXECUTION should:

1. **Create `resolveSwap()` utility function** with tests
2. **Add resolution fields** to pick object (non-breaking extension)
3. **Optionally unify label formatters** (low priority)
4. **NOT implement full conveyance/rollover** (separate future phase)
5. **NOT wire into production flow** until draft sim exists

---

## Phase 3 EXECUTION Completion Log (January 2026)

> **Status**: PHASE 3 COMPLETE  
> **Date**: 2026-01-04  
> **Version**: 2.2.0

### What Changed

#### T1) Swap Resolution Utility (Pure) ✅

Created `src/features/architect/utils/tradeMachine/utils/swapResolution.js` with:

- **`resolveSwapWinner({ teamA, teamB, swapType }, positionsMap)`** - Returns winning team code
  - `best_of` = lower pick number wins (5 beats 12)
  - `worst_of` = higher pick number wins
  - Tie behavior: teamA wins (deterministic)
  - Throws on missing position data

- **`resolvePickSwap(pick, positionsMap, { nowIso, method })`** - Resolves a single pick swap
  - If `pick.isSwap !== true` → returns unchanged
  - If missing `swapWithTeamId` → returns unchanged
  - If `pick.resolved === true` → returns unchanged (idempotent)
  - Returns new pick object with Schema A fields

- **`resolveTeamSwaps(draftPicks, positionsMap, options)`** - Batch resolution

#### T2) Season-Advance Resolution Hook ✅

Added `resolveDraftPickSwapsForYear(team, draftYear, positionsMap, opts)` to `seasonManager.js`:

- **NO-OP without lottery results**: Returns team unchanged when `positionsMap` is null/undefined/empty
- Only resolves first-round swaps (`round === 1`)
- Only resolves matching year (`pick.year === draftYear`)
- Leaves picks unresolved when partner or positions missing (no throw)

**Integration Pattern**: Available as exported utility, not wired into existing flow.

#### T3) Schema A Fields (Additive Only) ✅

Picks can now carry resolution fields:

- `resolved: boolean`
- `resolvedOwner: TeamCode`
- `resolvedPosition: number`
- `resolutionMeta: { resolvedAt, method, positions }`

Verified: `ensurePickId()` preserves all fields via spread operator.

#### T4) Unified Label Formatting ✅

- Replaced local `getPickLabel()` in `TradeSummaryPanel.jsx` with shared `formatPick()` from `tradeHelpers.js`
- Standardized swap emoji to 🔁 everywhere

#### T5) Resolved Swap Display ✅

Extended `formatSwapInfo(pick)` to show resolved outcome:

- Unresolved: `"Swap (Best of) vs OKC"`
- Resolved: `"Swap (Best of) vs OKC → Won by OKC"`

### Files Changed/Added

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/tradeMachine/utils/swapResolution.js` | **Created** | Swap resolution utilities |
| `src/features/architect/utils/seasonManager.js` | Modified | Added `resolveDraftPickSwapsForYear()` |
| `src/features/architect/utils/tradeHelpers.js` | Modified | Extended `formatSwapInfo()` and `formatPick()` |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` | Modified | Unified label formatting |
| `src/features/architect/utils/tradeMachine/index.js` | Modified | Export swap resolution utilities |
| `src/tests/tradeMachine/swapResolution.test.js` | Modified | Real tests for resolution logic |
| `src/tests/tradeMachine/seasonSwapResolution.test.js` | **Created** | Season-advance integration tests |
| `docs/return-packages/trade-machine-draft-picks__phase-3-execution__2026-01-04.md` | **Created** | Phase 3 Return Package |

### Validation Commands Run

```bash
npm run test -- src/tests/tradeMachine/swapResolution.test.js --run      # 30 passed
npm run test -- src/tests/tradeMachine/seasonSwapResolution.test.js --run # 13 passed
npm run test -- src/tests/tradeMachine/draftPicksPreflight.test.js --run  # 23 passed
npm run build                                                             # ✓ Success
```

### Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Pure swap resolution utilities exist and are fully tested | ✅ |
| 2 | Season advance integration is NO-OP without lottery results | ✅ |
| 3 | Picks can carry Schema A fields without breaking flows | ✅ |
| 4 | SummaryPanel uses shared formatter | ✅ |
| 5 | Resolved swaps display outcome consistently | ✅ |
| 6 | All tests pass; build passes | ✅ |

### What Remains (Phase 4+)

1. **Draft Lottery Simulator** - No simulation exists
2. **Lottery Results Ingestion** - No data pipeline
3. **Conveyance/Rollover Logic** - Protection rollover not implemented
4. **Multi-Team Swaps** - 3+ team swaps not supported
5. **Second-Round Swap Resolution** - Only first-round implemented

---

## Phase 4 PREFLIGHT Findings (January 2026)

> **Status**: PREFLIGHT COMPLETE (DOC PATCH APPLIED 2026-01-04)  
> **Mode**: Discovery + docs + tests/fixtures only (NO runtime behavior changes)  
> **Purpose**: Produce no-surprises implementation plan for conveyance and protection normalization  
> **Return Package**: `docs/return-packages/trade-machine-draft-picks__phase-4-preflight__2026-01-04.md`  
> **Doc Patch**: `docs/return-packages/trade-machine-draft-picks__phase-4-preflight-doc-patch__2026-01-04.md`
>
> **Terminology Note**: "Conveyance" refers to the NBA draft pick mechanism where a protected pick either:
>
> - **Conveys** (transfers to the receiving team) when protection doesn't trigger, OR
> - **Rolls forward** to the next year's draft when protection triggers (e.g., pick lands in Top 3 protected range)
> - May eventually **convert** to a different asset (e.g., 1st becomes 2nd round pick) after multiple rolls

### Key Findings

#### F1: Protection Storage is String-Only

**Current State**: Protection is stored as a string everywhere (`"Top 3"`, `"Lottery"`, etc.)

| Location | Field | Format |
|----------|-------|--------|
| UI Dropdown | `pickObj.protection` | String from `getPickOptions()` |
| Validators | `pick.protection` | String passed to `isMeaningfulProtection()` |
| Firestore | `draftPicks[].protection` | String |

**Implication**: Structured protection (multi-tier ladders, conversion rules) cannot be represented.

#### F2: DraftPickConveyanceZ Schema is NEVER USED

**Evidence**:

- Schema defined at `src/schemas/architect.ts:91-123`
- **ZERO** runtime code reads `conveyance`, `ifConveys`, `ifRolls`, or `finalYear`
- Search: `grep -r "ifConveys\|ifRolls\|finalYear" src/features/` returns no matches

**Implication**: Phase 4 execution can start using the existing schema without migration concerns.

#### F3: "Swap (+)/Swap (-)" in Protection Dropdown is CONFUSING

**Where Defined**: `tradeUtilities.js:92-93`

```javascript
{ label: 'Swap (+)', value: 'Swap (+)' },
{ label: 'Swap (-)', value: 'Swap (-)' },
```

**Risk Analysis** (verified via grep):

- `isMeaningfulProtection('Swap (+)')` returns `false` - NOT treated as protection
- Users may think selecting "Swap (+)" makes pick a swap - IT DOESN'T
- grep found values ONLY in `getPickOptions()` dropdown and test fixtures; no team data contains these values

**Recommendation**: **REMOVE** in Phase 4 execution. Swap is properly modeled with `isSwap`, `swapType`, `swapWithTeamId`.

#### F4: Conveyance Execution Target

**Primary Target**: Season advance (`updateDraftPicksWithStepien()` at `seasonManager.js:819`)

**Required Inputs**:

- Pick with `conveyance.conditions`
- Lottery results: `Map<TeamCode, number>`
- Current season for determining which year to evaluate

**What Repo Lacks**:

- Draft lottery simulation
- Lottery results ingestion
- Manual entry UI for lottery positions

### Structured Model Proposal

**Option A (Recommended for Phase 4)**: Keep `protection` as string, add `protectionMeta` alongside

```typescript
interface DraftPick {
  protection: string | null;       // "Top 3" - unchanged
  protectionMeta?: {               // NEW - structured metadata
    type: 'position' | 'lottery' | 'playoff' | 'always' | 'never';
    maxPosition?: number;
    conversionTarget?: { action: 'roll' | 'convert' | 'cancel'; toYear?: number; toRound?: 1 | 2; };
  };
}
```

**Option B (Future)**: Replace string with structured object (higher migration effort)

### Deliverables Created

> **⚠️ Fixture Model Clarification**: Fixtures contain two different structures:
>
> - `conveyance.*` fields match existing `DraftPickConveyanceZ` schema (unused at runtime)
> - `protectionLadder[]` is a **PROPOSED** Phase 4 model — does NOT exist in runtime schema

| File | Description |
|------|-------------|
| `docs/return-packages/trade-machine-draft-picks__phase-4-preflight__2026-01-04.md` | Full return package with truth map, inventory, proposals |
| `src/tests/tradeMachine/conveyancePreflight.test.js` | Phase 4 preflight tests (22 pass, 7 skipped) |
| `src/tests/fixtures/tradeMachinePicks/conveyance_rolls_forward.json` | Roll-forward protection fixture (uses existing schema) |
| `src/tests/fixtures/tradeMachinePicks/conveyance_converts_to_2nd.json` | Conversion to 2nd round fixture (uses existing schema) |
| `src/tests/fixtures/tradeMachinePicks/conveyance_multi_year_ladder.json` | Multi-tier ladder fixture (**PROPOSED** `protectionLadder[]` model) |
| `src/tests/fixtures/tradeMachinePicks/protection_swap_plus_minus_strings.json` | Swap (+/-) documentation |

### Phase 4 EXECUTION Implied Plan

1. **Priority 1**: Remove "Swap (+/-)" from `getPickOptions()` (~15 min, low risk)
2. **Priority 2**: Add `protectionMeta` schema (Option A) (~2-4 hours, low risk)
3. **Priority 3**: Implement `resolveConveyance()` function (~4-8 hours, medium risk)
4. **Priority 4**: Wire conveyance into season advance (~2-4 hours, medium risk)

### Stop Conditions - All CLEAR

| Condition | Status | Verification |
|-----------|--------|--------------|
| Protection strings persisted widely | ❌ NOT FOUND | Format consistent across fixtures |
| Stepien treats "Swap (+/-)" as meaningful | ❌ NOT FOUND | `isMeaningfulProtection('Swap (+)')` returns `false` — verified in tests |
| Existing conveyance implementation | ❌ NOT FOUND | Schema only; grep found zero runtime reads |

---

## Phase 4 EXECUTION Completion Log (January 2026)

> **Status**: PHASE 4 COMPLETE  
> **Date**: 2026-01-04  
> **Version**: 2.3.0

### What Changed

#### T1) Removed "Swap (+/-)" from getPickOptions() ✅

- Removed misleading `{ label: 'Swap (+)', value: 'Swap (+)' }` and `{ label: 'Swap (-)', value: 'Swap (-)' }` entries
- Added `normalizeProtectionValue()` for defensive normalization of legacy values
- `getPickOptions()` now returns 7 options (down from 9)

#### T2) Added ProtectionMetaZ Schema (Option A) ✅

- Added `ProtectionMetaZ` to `src/schemas/architect.ts` with types: `position`, `lottery`, `playoff`, `always`, `never`
- Added `protectionMeta` field to `DraftPickZ` schema
- **Type definitions**:
  - `always` = "always conveys" (no protection; pick transfers regardless of position)
  - `never` = "never conveys" (unconditional obligation; pick is owed but may have other resolution rules)
  - `position` = position-based protection (e.g., Top 3, Top 5)
  - `lottery` = lottery-range protection (positions 1-14)
  - `playoff` = playoff-team protection (non-lottery; positions 15-30)
- Enhanced `isMeaningfulProtection()` to support protectionMeta:
  - Returns `true` for types: `position` (with maxPosition > 0), `lottery`, `playoff`
  - Returns `false` for types: `always`, `never` (neither provides "meaningful protection" for Stepien; `always` = unprotected, `never` = unconditional)
  - Falls back to string regex for legacy picks

#### T3) Implemented Conveyance Resolution Utilities ✅

- Created `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js` with:
  - `parseProtectionThreshold(protectionString)` - Parses protection strings to numeric thresholds
  - `protectionTriggers(protection, position)` - Checks if protection triggers at given position
  - `resolveConveyanceForPick(pick, positionsMap, opts)` - Resolves single pick conveyance
  - `resolveTeamConveyanceForYear(draftPicks, draftYear, positionsMap, opts)` - Batch resolution
  - `getProtectionLabel(protectionMeta)` - Generates display label from structured protection
  - `normalizeProtection(protectionOrPick)` - Returns canonical protection descriptor
- **Multi-year ladder support implemented**: Runtime reads `protectionLadder[]` array on pick objects to determine per-year protection. When a pick rolls, `conveyance.currentYear` and `conveyance.conditions.protection` are updated so resolution can be chained across years. (Previously "proposed-only" in Phase 4 PREFLIGHT; now runtime-supported.)

#### T4) Added Season Manager Conveyance Hook ✅

- Added `resolveDraftPickConveyanceForYear(team, draftYear, positionsMap, opts)` to `seasonManager.js`
- Mirrors Phase 3's `resolveDraftPickSwapsForYear()` pattern
- NO-OP guarantees when positionsMap is missing or empty
- Safe for integration (catches errors, no mutations)

#### T5) Updated Label/Formatters for protectionMeta ✅

- Updated `formatPick()` in `tradeHelpers.js` to prefer protectionMeta for display
- Updated `buildFirstRoundCalendar()` in `stepienUtils.js` to use `isMeaningfulProtection()`
- Added `getProtectionDisplayLabel()` helper for consistent display logic

#### T6) Unskipped Phase 4 Tests ✅

- All 38 tests in `src/tests/tradeMachine/conveyancePreflight.test.js` now passing
- Tests cover:
  - Conveyance resolution (roll, convey, convert outcomes)
  - NO-OP guarantees (empty/missing positionsMap)
  - Multi-year ladder resolution (runtime chaining via `protectionLadder[]`; test verifies 2026 → 2027 → 2028 roll chain)
  - protectionMeta support
  - "Swap (+/-)" removal verification

### Doc Clarifications

- **`always`/`never` semantics**: `always` = "always conveys" (unprotected); `never` = "never conveys" (unconditional obligation). Both return `false` from `isMeaningfulProtection()` because neither provides "meaningful protection" for Stepien purposes.
- **Multi-year ladder status**: Implemented in Phase 4 runtime. The conveyance resolver reads `protectionLadder[]` from pick objects and chains resolution across years. This was "proposed-only" in Phase 4 PREFLIGHT but is now runtime-supported (no UI for editing ladders yet—see Phase 5+).

### Files Changed/Added

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` | Modified | Removed Swap +/-, added normalizers |
| `src/schemas/architect.ts` | Modified | Added ProtectionMetaZ schema |
| `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js` | **Created** | Conveyance resolution utilities |
| `src/features/architect/utils/seasonManager.js` | Modified | Added conveyance hook |
| `src/features/architect/utils/tradeHelpers.js` | Modified | Updated formatPick() |
| `src/features/architect/utils/stepienUtils.js` | Modified | Updated calendar builder |
| `src/features/architect/utils/tradeMachine/index.js` | Modified | Exported new utilities |
| `src/tests/tradeMachine/conveyancePreflight.test.js` | Modified | Unskipped tests |
| `docs/return-packages/trade-machine-draft-picks__phase-4-execution__2026-01-04.md` | **Created** | Return Package |

### Validation Commands Run

```bash
# Phase 4 Tests
npm run test -- src/tests/tradeMachine/conveyancePreflight.test.js --run  # 38 passed

# All Trade Machine Tests
npm run test -- src/tests/tradeMachine/ --run                              # 142 passed

# Stepien Tests
npm run test -- tests/validators/stepien.test.js tests/hasStepienViolation.test.js --run  # 18 passed

# Build
npm run build                                                               # ✓ Success
```

### Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Swap (+/-)" removed from getPickOptions | ✅ |
| 2 | Legacy saved "Swap (+/-)" protections normalize to unprotected | ✅ |
| 3 | protectionMeta Option A exists in schema + supported | ✅ |
| 4 | Conveyance resolution utilities exist + tested | ✅ |
| 5 | Season manager hook exists and is NO-OP without positions | ✅ |
| 6 | All Phase 4 tests unskipped and passing | ✅ |
| 7 | No Stepien regression for legacy protection | ✅ |
| 8 | Master Doc updated + Execution Return Package created | ✅ |

---

## Roadmap / What Remains (Next Phases)

### Phase 6+ (Not Yet Implemented)

1. **Draft Lottery Simulator** — No simulation exists to auto-generate `positionsMap`. Manual entry only.
2. **Multi-Team Swaps** — 3+ team swaps not supported.
3. **Second-Round Conveyance** — Only first-round conveyance implemented.
4. **Stepien Calendar Visualization** — UI indicator of blocked years not implemented.
5. **Full protectionLadder UI** — No UI for editing multi-tier ladders (paste-only JSON).
6. **Scraping/API Integration** — No automatic import from external draft results sources.

---

## Phase 5 EXECUTION Completion Log (January 2026)

> **Status**: PHASE 5 COMPLETE  
> **Date**: 2026-01-07  
> **Version**: 2.4.0

### What Changed

#### T0) PREFLIGHT DISCOVERY ✅

**Findings:**

- World state stored in Firestore at `architect_worlds/{worldId}` with metadata
- Season advance triggered via `advanceSeasonInWorld()` in `seasonManager.js`
- `resolveDraftPickSwapsForYear()` and `resolveDraftPickConveyanceForYear()` exist (Phase 3-4)
- Both functions are NO-OP when positionsMap is null/empty
- **No existing draft-results storage** — new field needed

#### T1) DATA MODEL: Store Draft Positions By Year ✅

Added `draftPositionsByYear` storage to world metadata in `worldManager.js`:

**Schema:**

```javascript
world.draftPositionsByYear: {
  [year: number]: {
    positionsMap: { [teamCode: string]: number },  // e.g., { PHI: 5, OKC: 12 }
    method: 'manual',                                // How positions were entered
    updatedAtIso: string                             // ISO timestamp
  }
}
```

**New Functions:**

- `getDraftPositions(worldId, draftYear)` - Get full position data for a year
- `getDraftPositionsMap(worldId, draftYear)` - Convenience helper returning just positionsMap
- `validateDraftPositionsMap(positionsMap)` - Validate structure before save
- `saveDraftPositions(worldId, draftYear, positionsMap, opts)` - Persist positions
- `clearDraftPositions(worldId, draftYear)` - Clear positions for a year

**Validation Rules:**

- Team codes must be 3 uppercase letters (ATL, BOS, etc.)
- Positions must be integers 1-60 (two rounds)
- No duplicate positions allowed
- Empty maps rejected

#### T2) UI: Minimal "Enter Draft Positions" Tool ✅

Created `DraftPositionsInput` component at `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`:

**Features:**

- Year selector (current year to +7 years)
- Textarea for JSON input with template
- "Validate" action with detailed error messages
- "Save" action with success/error feedback
- "Reset to Template" button
- Shows last-saved timestamp and method
- Loads existing positions when year changes

**Placement:** Added to `OffseasonSection.jsx` in the GM Dashboard, alongside the Season Advance button.

#### T3) RUNTIME WIRING: Auto-resolve during Season Advance ✅

Modified `advanceSeasonInWorld()` and `processTeamSeasonTransitionWithOptions()` in `seasonManager.js`:

**Flow:**

1. When advancing from season X to X+1, loads `positionsMap` for draft year X
2. For each team, applies in order:
   - `afterConveyance = resolveDraftPickConveyanceForYear(updatedTeam, ...)` — rolls/conveys protected picks
   - `afterSwaps = resolveDraftPickSwapsForYear(afterConveyance, ...)` — resolves swap winners using post-conveyance state
3. Tracks resolutions in summary:
   - `summary.conveyanceResolutions[]` — picks that rolled/conveyed
   - `summary.swapResolutions[]` — swaps that were resolved
4. Returns `draftResolutionInfo` with resolution counts

**Variable Chain (Critical):**

```javascript
// 1) Conveyance first — input is updatedTeam
const afterConveyance = resolveDraftPickConveyanceForYear(updatedTeam, draftYear, positionsMap, opts);
// 2) Swaps second — input is afterConveyance (NOT updatedTeam)
const afterSwaps = resolveDraftPickSwapsForYear(afterConveyance, draftYear, positionsMap, opts);
```

This ensures swaps see rolled/conveyed picks from the conveyance step.

**NO-OP Guarantee Preserved:**

- If `positionsMap` is null/undefined/empty → no resolution occurs
- Individual picks without position data left unchanged
- Error catching prevents single pick failures from breaking entire advance

#### T4) TESTS ✅

Created `src/tests/tradeMachine/phase5DraftPositions.test.js` with 32 tests:

**Test Categories:**

- `validateDraftPositionsMap()` validation (valid/invalid inputs)
- NO-OP guarantees (null/undefined/empty positionsMap)
- Resolution WITH positionsMap (swaps and conveyance)
- Mixed resolution (multiple picks of different types)
- Edge cases (empty picks, missing partners, idempotency)

**Commands:**

```bash
npm run test -- src/tests/tradeMachine/phase5DraftPositions.test.js --run  # 32 passed
npm run test -- src/tests/tradeMachine/ --run                              # 170 passed
npm run build                                                              # ✓ Success
```

#### T5) DOCS ✅

- Updated Master Doc with Phase 5 completion log
- Updated Roadmap section (Phase 5 complete, Phase 6+ remaining)
- Created Return Package at `docs/return-packages/trade-machine-draft-picks__phase-5-execution__2026-01-07.md`

### Files Changed/Added

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/worldManager.js` | Modified | Added draftPositionsByYear storage functions |
| `src/features/architect/utils/seasonManager.js` | Modified | Added auto-resolution wiring during season advance |
| `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx` | **Created** | Draft positions input UI |
| `src/features/architect/GMDashboard/components/index.js` | Modified | Export DraftPositionsInput |
| `src/features/architect/GMDashboard/sections/OffseasonSection.jsx` | Modified | Added DraftPositionsInput to UI |
| `src/tests/tradeMachine/phase5DraftPositions.test.js` | **Created** | Phase 5 unit tests |
| `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` | Modified | Phase 5 completion log |
| `docs/return-packages/trade-machine-draft-picks__phase-5-execution__2026-01-07.md` | **Created** | Return Package |

### Validation Summary

| Check | Result | Details |
|-------|--------|---------|
| Phase 5 Tests | ✅ 32/32 passed | `npm run test -- src/tests/tradeMachine/phase5DraftPositions.test.js --run` |
| All TM Tests | ✅ 170/174 passed | 170 passed, 1 skipped, 3 todo |
| Build | ✅ Success | `npm run build` |
| NO-OP guarantee | ✅ Verified | Tests confirm no changes when positionsMap missing |
| Storage schema | ✅ Validated | `validateDraftPositionsMap()` tested with 15 cases |
| Swap resolution | ✅ Tested | best_of and worst_of both work |
| Conveyance resolution | ✅ Tested | Roll and convey outcomes work |

### Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Place to store draft positions by year | ✅ `draftPositionsByYear` in world metadata |
| 2 | Minimal UI to enter/import draft positions | ✅ `DraftPositionsInput` component |
| 3 | Season-advance auto-resolves when positionsMap exists | ✅ Wired in `advanceSeasonInWorld()` |
| 4 | NO-OP without positionsMap | ✅ Tested and verified |
| 5 | Tests prove NO-OP and resolution behavior | ✅ 32 tests covering all cases |
| 6 | Does NOT break existing Stepien behavior | ✅ All existing tests pass |

### How to Use

1. **Navigate to GM Dashboard → Offseason tab**
2. **In the "Draft Positions Input" panel:**
   - Select the draft year (e.g., 2026)
   - Paste or edit JSON with team positions: `{ "PHI": 5, "OKC": 12, ... }`
   - Click "Validate" to check for errors
   - Click "Save" to store positions
3. **When you click "Advance Season":**
   - If draft positions exist for the current year, swaps and protected picks auto-resolve
   - Summary shows which picks were resolved
   - If no positions saved, picks remain unchanged (NO-OP)

### Phase 5 PATCH: Season Advance Desync Fix (January 2026)

> **Date**: 2026-01-07  
> **Version**: 2.4.1

**Issue**: UI could show 2025-26 while Firestore `worldMeta.currentSeason` was already 2026-27 (or vice versa), causing "skips a year" perception and draft position year misalignment.

**Fix Summary**:

1. `SeasonAdvanceModal` no longer passes `fromSeason`/`toSeason` — `advanceSeasonInWorld()` uses `worldMeta.currentSeason` as single source of truth
2. `OffseasonSection` displays "World Season: X" label (fetched from worldMeta)
3. `DraftPositionsInput` defaults to `worldDraftYear` (derived from world season), not UI view year
4. `seasonManager.js` rejects calls with conflicting `fromSeason`/`toSeason` to prevent future regressions

**Return Package**: `docs/return-packages/trade-machine-draft-picks__phase-5-season-advance-desync-fix__2026-01-07.md`

---

## Present-Day Stepien Obligations Wiring (January 2026)

> **Status**: COMPLETE  
> **Date**: 2026-01-08  
> **Version**: 2.5.0  
> **Scope**: Present-day Trade Machine validation ONLY (NOT worlds/seasons/season advance)

### What Changed

#### T1) Schema Updated (architect.ts)

Added three new optional fields to `BaseTeamDocZ`:

- `draftPicksInventory`: Picks the team currently owns (same as `draftPicks` for backward compat)
- `draftPicksObligations`: Picks the team owes / has traded away (used for Stepien validation)
- `draftPicksContested`: Swaps and conditional picks involving the team

All fields are `z.array(DraftPickZ).optional().default([])` for safe backward compatibility.

#### T2) Loader Updated (firebaseTeamPlanHelpers.js)

`hydrateBaseTeam()` now returns the new ledger fields:

```javascript
draftPicksInventory: baseDoc.draftPicksInventory || baseDoc.draftPicks || [],
draftPicksObligations: baseDoc.draftPicksObligations || [],
draftPicksContested: baseDoc.draftPicksContested || [],
```

Safe fallbacks ensure no breakage when fields are absent.

#### T3) Stepien Validation Updated (validateStepien.js)

**Core Fix**: `validateStepien()` now considers existing obligations from `team.draftPicksObligations`.

**Data Contract** (fields read by Stepien):

| Field | Source | Purpose |
|-------|--------|---------|
| `picksOut` / `outgoingPicks` | Current trade | Picks being traded in this transaction |
| `draftPicksObligations` | Team ledger | Existing obligations (previously traded picks) |

**Stepien Algorithm**:

1. Extract first-round picks from current trade (`picksOut`/`outgoingPicks`)
2. Extract first-round obligations from `draftPicksObligations` that reserve years
3. Merge both sets into `allStepienRelevant`
4. Sort by year, check for consecutive unprotected years
5. If consecutive unprotected years found → violation

**Obligation Year Reservation Rules**:

An obligation reserves a year for Stepien if:

- `round === 1` (first round), AND one of:
  - `status` in `['outgoing', 'conditional']`
  - `currentOwner !== originalTeam`
  - `tradeable === false`
  - `stepienEligible === false`

**Swap Handling** (same as Phase 2):

- `swapType === 'worst_of'` does NOT reserve year
- `swapType === 'best_of'` (or missing) DOES reserve year

**Meaningful Protection Bypass**:

- If either pick in a consecutive pair has meaningful protection (Top 3, Lottery, etc.), the consecutive violation is bypassed

#### T4) Tests Added

Created `src/tests/tradeMachine/stepienObligations.test.js` with 15 tests covering:

1. **Obligation causes Stepien failure**: Team with 2027 obligation trading 2028 1st → violation
2. **Conditional/protected obligation reserves year**: `tradeable: false` or `stepienEligible: false` → reserves year
3. **Swap worst_of does not reserve**: Obligation with `swapType: 'worst_of'` → does NOT reserve year
4. **Edge cases**: Empty obligations, missing field, second-round ignored, fallback path

### Stepien Rule Summary (Plain English)

> **Present-day Stepien validation now prevents illegal consecutive first-round pick trades by considering BOTH:**
>
> 1. Picks being traded in the current transaction
> 2. Existing obligations (picks already owed from prior trades)

**Example**: Team owes 2027 1st (in obligations); trading 2028 1st → **FAILS** Stepien (consecutive years blocked)

**Example**: Team owes 2027 1st with `swapType: 'worst_of'`; trading 2028 1st → **PASSES** (worst_of doesn't reserve)

**Example**: Team owes 2027 1st; trading 2029 1st → **PASSES** (not consecutive)

### Files Changed/Added

| File | Action | Description |
|------|--------|-------------|
| `src/schemas/architect.ts` | Modified | Added `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` fields |
| `src/features/architect/utils/firebaseTeamPlanHelpers.js` | Modified | `hydrateBaseTeam()` returns new ledger fields |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | Modified | Added obligations awareness + `obligationReservesYear()` helper |
| `src/tests/tradeMachine/stepienObligations.test.js` | **Created** | 15 tests for obligations wiring |
| `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` | Modified | This section |
| `docs/return-packages/TRADE_MACHINE_STEPIEN_OBLIGATIONS_WIRING__EXECUTION__2026-01-08.md` | **Created** | Return Package |

### Validation Commands Run

```bash
# Stepien obligations tests
npm run test -- src/tests/tradeMachine/stepienObligations.test.js --run
# Result: 15 passed (15)

# All trade machine tests
npm run test -- src/tests/tradeMachine/ --run
# Result: 185 passed | 1 skipped | 3 todo (189)

# All Stepien tests
npm run test -- tests/validators/stepien.test.js tests/hasStepienViolation.test.js --run
# Result: 18 passed (18)

# Build
npm run build
# Result: ✓ built in 9.95s (success)
```

### Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Present-day Stepien considers existing obligations | ✅ |
| 2 | Schema accepts new ledger fields | ✅ |
| 3 | Loader returns new ledger fields with safe defaults | ✅ |
| 4 | Test 1: Obligation-based consecutive failure | ✅ |
| 5 | Test 2: Conditional/protected obligation reserves year | ✅ |
| 6 | Test 3: worst_of swap does not reserve year | ✅ |
| 7 | Master Doc updated | ✅ |
| 8 | No changes to worlds/seasons/season advance | ✅ |

### What Remains

1. **Data Population**: Firestore `architect_baseTeams` documents need to be populated with `draftPicksObligations` arrays by the pipeline (see `PIPELINE_DRAFT_PICKS_LEDGER__EXECUTION__2026-01-08.md`)
2. **World Snapshots**: When worlds are created/advanced, obligations need to be carried forward

**Return Package**: `docs/return-packages/TRADE_MACHINE_STEPIEN_OBLIGATIONS_WIRING__EXECUTION__2026-01-08.md`

---
