# DRAFT ASSET TERMS + LIFECYCLE COMPLETION AUDIT

**Audit Date**: 2026-02-03
**Mode**: PREFLIGHT — REVIEW ONLY
**Prior Work**: `DRAFT_ASSET_TRADING_CLOSURE_EXECUTION_RETURN_PACKAGE.md` (Phase 17)

---

## EXECUTIVE SUMMARY

This audit determines whether HoopZero Architect is **complete for real-world NBA draft asset modeling** beyond trading existing entitlements. The audit covers:

1. Schema expressiveness for NBA-level pick rights
2. Authoring/editing surface area
3. Resolution lifecycle (year-over-year)
4. League integrity constraints

**Quick Answer**: The system has strong schema support and trade-time validation, but **critical gaps exist in lifecycle resolution** — specifically the linkage between entitlements (which store terms) and the resolution engine (which resolves picks during season advance).

---

## 1️⃣ CURRENT DRAFT ASSET SSOT (WHAT EXISTS TODAY)

### Base Data Sources

| Collection        | Path                                           | Purpose                                        |
| ----------------- | ---------------------------------------------- | ---------------------------------------------- |
| Base Entitlements | `architect_baseEntitlements`                   | Immutable canonical entitlement documents      |
| Base Teams        | `architect_baseTeams/{teamCode}`               | Team inventory: `{ entitlementIds: string[] }` |
| Base Pick Rules   | `architect_basePickRules/{pickId}`             | Structured protection/condition metadata       |
| World Overrides   | `architect_worlds/{worldId}/entitlements/{id}` | Per-world entitlement variations               |

**Reference**: [collections.ts:37-64](src/constants/collections.ts#L37-L64)

### Entitlement Schema

**Location**: [entitlementResolver.ts:31-39](src/features/architect/utils/entitlements/entitlementResolver.ts#L31-L39)

```typescript
type EntitlementRecord = Record<string, unknown>;
export type EffectiveEntitlement = EntitlementRecord;
```

The schema is **flexible by design** — allows dynamic merging of base and world-specific overrides.

### Three Canonical Entitlement Kinds

**Reference**: `data/pst/pst_entitlement_assets_2026_2033.json` (540 total, 2026-2033)

| Kind               | Purpose                     | Key Fields                                                    |
| ------------------ | --------------------------- | ------------------------------------------------------------- |
| `pick_ownership`   | Outright pick ownership     | `underlyingPickId`, `underlyingStatus`                        |
| `swap_right`       | Option to swap picks        | `swapControllerPickId`, `swapTargetDefinition`                |
| `conveyance_right` | Conditional right from pool | `poolUnderlyingPickIds`, `receivesRank`, `receivesComparator` |

### Example: pick_ownership

```json
{
  "id": "ent:BKN:2026:1:own:6d6555d2",
  "holderTeam": "BKN",
  "seasonYear": 2026,
  "round": 1,
  "kind": "pick_ownership",
  "underlyingPickId": "BKN_2026_1st",
  "description": "BKN 2026 1st Round Pick",
  "underlyingStatus": "clean"
}
```

### Example: swap_right

```json
{
  "id": "ent:NOP:2026:1:swap:...",
  "holderTeam": "NOP",
  "seasonYear": 2026,
  "round": 1,
  "kind": "swap_right",
  "swapControllerPickId": "NOP_2026_1st",
  "swapTargetDefinition": "Option to swap with MIL pool"
}
```

### Example: conveyance_right

```json
{
  "id": "ent:ATL:2026:1:conv:cdbad2a3",
  "holderTeam": "ATL",
  "seasonYear": 2026,
  "round": 1,
  "kind": "conveyance_right",
  "poolUnderlyingPickIds": ["ATL_2026_1st", "SAS_2026_1st"],
  "receivesRank": [1],
  "receivesComparator": "less_favorable"
}
```

### Pick Rules Schema (Protection/Conditions)

**Location**: [pickRulesResolver.ts:27-52](src/features/architect/utils/entitlements/pickRulesResolver.ts#L27-L52)

```typescript
export type PickRuleProtection = {
  type?: 'top_n' | 'range' | 'lottery';
  protectedRange?: string; // e.g., "1-4" or "1-14"
  appliesToYears?: number[];
  description?: string;
};

export type PickRuleCondition = {
  kind: 'swap' | 'swap_right' | 'conveys' | 'did_not_convey';
  description: string;
  relatedPickIds?: string[];
  appliesToYears?: number[];
  controller?: string;
};
```

### SSOT Resolution Pattern

**Location**: [entitlementResolver.ts:135-222](src/features/architect/utils/entitlements/entitlementResolver.ts#L135-L222)

```
1. Resolve team's entitlement IDs from base or world
2. Fetch base entitlements (ARCHITECT_BASE_ENTITLEMENTS_PATH)
3. Fetch world overrides (if worldId provided)
4. Deep-merge base + overrides
```

---

## 2️⃣ AUTHORING SURFACE AREA (CAN WE CREATE / EDIT TERMS?)

### Current Authoring Capabilities

| Term Type                          | Representable in Schema? | Authorable Today?         | Validated? | Evidence                               |
| ---------------------------------- | ------------------------ | ------------------------- | ---------- | -------------------------------------- |
| **Protected pick (top-N)**         | ✅ YES                   | ❌ Scripts/Firestore only | ✅ YES     | `pickRulesResolver.ts:27-32`           |
| **Lottery protected**              | ✅ YES                   | ❌ Scripts/Firestore only | ✅ YES     | `pickRulesResolver.ts:28`              |
| **Multi-step conveyance chain**    | ✅ YES                   | ❌ Scripts/Firestore only | ⚠️ PARTIAL | `conveyance_right` kind exists         |
| **Swap rights (best_of/worst_of)** | ✅ YES                   | ❌ Scripts/Firestore only | ✅ YES     | `swapResolution.js:31-72`              |
| **Grouped underlying picks**       | ✅ YES                   | ❌ Scripts/Firestore only | ⚠️ PARTIAL | `poolUnderlyingPickIds` field          |
| **"Right to better of two picks"** | ✅ YES                   | ❌ Scripts/Firestore only | ⚠️ PARTIAL | `receivesComparator: 'more_favorable'` |

### Key Finding: NO UI AUTHORING SURFACES

**UI components are READ-ONLY for entitlements:**

| Component                  | Location        | Capability                           |
| -------------------------- | --------------- | ------------------------------------ |
| `EntitlementPicksList.jsx` | `tradeMachine/` | Display entitlements grouped by year |
| `EntitlementPickRow.jsx`   | `tradeMachine/` | Select/toggle + destination dropdown |
| `TradeEditor.jsx`          | `tradeMachine/` | Orchestration only (no create/edit)  |

**How entitlements are created today:**

1. **PST Pipeline** (`team-scrape/draft-picks/scripts/pst/`) — batch ingestion
2. **Firestore Admin** — direct document writes
3. **World Overrides** — `architect_worlds/{worldId}/entitlements/`

**Verdict**: Schema supports all NBA term types. **No UI path to author them.**

---

## 3️⃣ TRADE-TIME VALIDATION COVERAGE (DRAFT ASSETS)

### Entitlement Routing Validation (Phase 17)

**Location**: [validateEntitlementRouting.js:57-145](src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js#L57-L145)

| Rule                     | Implemented? | Blocks?     | Evidence                                                              |
| ------------------------ | ------------ | ----------- | --------------------------------------------------------------------- |
| **Uniqueness**           | ✅ YES       | ✅ BLOCKING | Lines 99-107: Same entitlementId cannot be in multiple outgoing lists |
| **3+ team routing**      | ✅ YES       | ✅ BLOCKING | Lines 109-115: All outgoing entitlements require `toTeamId`           |
| **Destination validity** | ✅ YES       | ✅ BLOCKING | Lines 117-122: `toTeamId` must be a trade participant                 |
| **Self-routing**         | ✅ YES       | ✅ BLOCKING | Lines 124-129: Cannot route to sending team                           |
| **Ownership**            | ✅ YES       | ✅ BLOCKING | Lines 131-136: Team must own the entitlement                          |

### Stepien Rule Validation

**Location**: [validateStepien.js](src/features/architect/utils/tradeMachine/rules/validateStepien.js)

| Rule                             | Implemented? | Blocks?     | Evidence                                                   |
| -------------------------------- | ------------ | ----------- | ---------------------------------------------------------- |
| **Consecutive picks**            | ✅ YES       | ✅ BLOCKING | No 2+ consecutive future 1st rounds unprotected            |
| **7-year limit**                 | ✅ YES       | ✅ BLOCKING | Cannot trade picks beyond 7 years out                      |
| **Second apron frozen picks**    | ✅ YES       | ✅ BLOCKING | Second apron teams cannot trade own 7+ year picks          |
| **Meaningful protection bypass** | ✅ YES       | ✅ BYPASS   | Top 3+, Lottery, 1-14 protections bypass consecutive check |
| **Swap type handling**           | ✅ YES       | ✅ CORRECT  | `worst_of` swap does NOT reserve year (line 28)            |
| **Entitlements as picks**        | ✅ YES       | ✅ CORRECT  | Phase 12.1: Converts entitlements to pick-like objects     |

### Summary

| Validation Area     | Coverage                                                    |
| ------------------- | ----------------------------------------------------------- |
| Routing (3+ teams)  | ✅ Complete                                                 |
| Stepien Rule        | ✅ Complete                                                 |
| Ownership           | ✅ Complete                                                 |
| Conveyance-specific | ⚠️ Schema validated, resolution NOT validated at trade time |

---

## 4️⃣ APPLY / WORLD MUTATION CONSISTENCY

### Validate → Apply Pattern

**Location**: [tradeContext.js:250-333](src/features/architect/utils/tradeContext/tradeContext.js#L250-L333)

| Step                                  | Implemented? | Evidence                                       |
| ------------------------------------- | ------------ | ---------------------------------------------- |
| **Snapshot builds post-trade state**  | ✅ YES       | `buildPostTradeTeamsSnapshot()`                |
| **Validation uses post-trade state**  | ✅ YES       | Phase 56: Validates snapshot, not original     |
| **Entitlement routing uses toTeamId** | ✅ YES       | Lines 250-261: 3+ team explicit routing        |
| **Entitlement deduplication**         | ✅ YES       | Line 275: `new Set(newEntitlementIds)`         |
| **Post-apply invariant check**        | ✅ YES       | Lines 297-310: Throws on duplicate entitlement |

### Atomic Updates

```javascript
// tradeContext.js:268-276
const newEntitlementIds = [
  ...currentEntitlementIds.filter((id) => !outgoingEntitlementIds.includes(id)),
  ...incomingEntitlementIds,
];
updatedTeam.entitlementIds = [...new Set(newEntitlementIds)];
```

### Post-Apply Guard

```javascript
// tradeContext.js:297-310
if (entitlementOwnership.has(entId)) {
  throw new Error(
    `[tradeContext] INVARIANT VIOLATION: Entitlement "${entId}" would exist on both ${otherTeam} and ${teamCode} after trade.`
  );
}
```

### Verdict: Apply is consistent with validation

Apply uses validated routing/terms. Does **NOT** recompute. Entitlements updated atomically with Set deduplication.

---

## 5️⃣ LIFECYCLE / RESOLUTION ENGINE (YEAR OVER YEAR)

### What EXISTS

#### Swap Resolution

**Location**: [swapResolution.js:31-72](src/features/architect/utils/tradeMachine/utils/swapResolution.js#L31-L72)

```javascript
// Determine winner based on swap type
// "best_of" = lower position number wins (better pick)
// "worst_of" = higher position number wins (worse pick)
if (normalizedSwapType === 'best_of') {
  return posA <= posB ? teamA : teamB;
} else {
  return posA >= posB ? teamA : teamB;
}
```

✅ Pure function, idempotent, tested.

#### Conveyance Resolution

**Location**: [conveyanceResolution.js:30-79](src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js#L30-L79)

- `parseProtectionThreshold()` — Converts "Top 3", "Lottery" to numeric positions
- `protectionTriggers()` — Determines if draft position triggers protection
- `resolveConveyanceForPick()` — Handles roll-forward, conversion, or conveyance

✅ Pure functions, tested.

#### Season Advance Integration

**Location**: [seasonManager.js:775-851](src/features/architect/utils/seasonManager.js#L775-L851)

```javascript
// 1) Resolve conveyance (protections rolling forward / converting)
const afterConveyance = resolveDraftPickConveyanceForYear(
  updatedTeam,
  draftYear,
  positionsMap,
  resolutionOpts
);

// 2) Resolve swaps (best_of / worst_of resolution)
const afterSwaps = resolveDraftPickSwapsForYear(
  afterConveyance,
  draftYear,
  positionsMap,
  resolutionOpts
);
```

#### Entitlement → Pick Projection (Phase 16.1)

**Location**: [seasonManagerProjection.js](src/features/architect/utils/entitlements/seasonManagerProjection.js)

- `projectEntitlementsToSeasonManagerView()` — Converts entitlements to draftPick-like objects
- Builds `conveyance` field from pick rules (lines 34-57)
- Creates `_derivedDraftPicks` for downstream dual-read

### What is BROKEN (Critical Gap)

**The linkage between entitlements and resolution is incomplete:**

1. **Projection is non-persisted**
   - `seasonManager.js:759` stores in `updatedTeam._derivedDraftPicks` (NON-PERSISTED)
   - Resolution functions operate on `updatedTeam.draftPicks` (lines 788-850)
   - Results written to `draftPicks`, NOT back to entitlements

2. **Entitlements remain stale after resolution**
   - When pick conveys/rolls, the entitlement record is NOT updated
   - No cascade: resolved pick doesn't mark entitlement as "resolved"
   - No cleanup: expired conditions aren't archived

3. **Protection ladder not created**
   - `protectionLadder` checked in `resolveConveyanceForPick()` but no factory to create it
   - Multi-year protection chains may not advance correctly

4. **No explicit draft completion event**
   - Resolution only happens if `positionsMap` passed to season advance
   - No trigger to finalize draft and lock positions
   - Picks resolved only during season advance, not before

### Lifecycle Flow Diagram

```
┌─ Season Advance ─────────────────────────────────────────────────┐
│                                                                   │
│  1. Resolve entitlements → _derivedDraftPicks (NON-PERSISTED)    │
│                                                                   │
│  2. Resolve conveyance on draftPicks ← NOT _derivedDraftPicks    │
│  3. Resolve swaps on draftPicks                                  │
│                                                                   │
│  4. Results written to draftPicks                                │
│     ⚠️ Entitlement records NOT updated                           │
│     ⚠️ No cascade back to SSOT                                   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Answers to Critical Questions

| Question                                            | Answer     | Evidence                                                   |
| --------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| Do swaps resolve at the correct moment?             | ⚠️ PARTIAL | Only if `positionsMap` provided during season advance      |
| Do protections/conveyance chains resolve correctly? | ⚠️ PARTIAL | Logic exists, but entitlements not updated post-resolution |
| Does system prevent unresolved/ambiguous states?    | ❌ NO      | No check for stale entitlements after resolution           |

---

## 6️⃣ LEAGUE INTEGRITY CHECKS (MANDATORY)

### Duplicate Player Detection

**Location**: [leagueInvariants.ts:96-100](src/features/architect/utils/leagueInvariants.ts#L96-L100)

```typescript
// Validate that no player exists on multiple teams in the league.
export function validateNoDuplicatePlayers(teams: any[]): LeagueInvariantResult;
```

✅ Implemented and tested (Phase 86).

### Post-Apply Entitlement Duplicate Check

**Location**: [tradeContext.js:297-310](src/features/architect/utils/tradeContext/tradeContext.js#L297-L310)

✅ Throws invariant error if entitlement would exist on multiple teams.

### What is MISSING

| Invariant                                    | Status     | Impact                                                         |
| -------------------------------------------- | ---------- | -------------------------------------------------------------- |
| **Entitlement deduplication (league-level)** | ❌ MISSING | No `validateNoDuplicateEntitlements()` function                |
| **Pick-slot accounting (420 picks)**         | ❌ MISSING | No validation that total picks = 30 teams × 2 rounds × 7 years |
| **Conveyance chain depth limit**             | ❌ MISSING | No check for runaway rolls (>3 years)                          |
| **Reconciliation tools**                     | ❌ MISSING | No audit/ledger functions in main utils                        |

---

## 7️⃣ BLOCKERS ONLY (MANDATORY)

The following are **blocking gaps** required for "complete NBA draft asset modeling":

| #      | Blocker                                     | Severity | Impact                                                                           |
| ------ | ------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| **B1** | No UI authoring surface for entitlements    | HIGH     | Cannot create/edit terms from UI — scripts/Firestore only                        |
| **B2** | Entitlement → Resolution linkage broken     | HIGH     | Projection is non-persisted; resolution writes to `draftPicks`, not entitlements |
| **B3** | Post-resolution entitlement updates missing | HIGH     | Resolved picks don't update source entitlement records                           |
| **B4** | Protection ladder factory missing           | HIGH     | Multi-year conveyance chains may not advance correctly                           |
| **B5** | No league-level entitlement deduplication   | MEDIUM   | No `validateNoDuplicateEntitlements()` parallel to player validation             |
| **B6** | No pick-slot accounting                     | MEDIUM   | No verification that 420 total picks are accounted for                           |

---

## 8️⃣ VERDICT (MANDATORY)

> ❌ **Draft asset terms + lifecycle are NOT functionally complete for NBA-level pick rights.**

### Blocking Gaps Summary

1. **Authoring**: Schema supports NBA terms, but **no UI path to create/edit entitlements**
2. **Lifecycle**: Resolution functions exist but **results don't cascade back to entitlements**
3. **Integrity**: Player deduplication exists, but **no parallel for entitlements**

### What Works

- ✅ Schema can represent all NBA pick right types
- ✅ Trade-time validation is comprehensive (routing, Stepien, ownership)
- ✅ Apply/mutation is consistent with validation
- ✅ Swap and conveyance resolution logic is correct

### What is Missing

- ❌ UI authoring for entitlements
- ❌ Entitlement ↔ Resolution bidirectional sync
- ❌ Post-resolution entitlement cleanup
- ❌ League-level entitlement invariants

---

## 9️⃣ CLOSURE EXECUTION (2026-02-03)

All six blocking gaps (B1-B6) have been closed through the implementation of the **Draft Asset Resolution Engine (DARE)** and supporting infrastructure.

### Implemented Solutions

| Gap    | Solution                                                                                   | Files Created/Modified                                                        |
| ------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **B1** | Feature-flagged admin modal with JSON editor                                               | `admin/EntitlementEditorModal.tsx`, `utils/entitlements/entitlementWriter.ts` |
| **B2** | DARE operates on entitlements directly, persists resolution outcomes                       | `utils/entitlements/dare/dareResolver.ts`                                     |
| **B3** | `entitlementMutator.ts` writes resolution outcomes back to world entitlements              | `utils/entitlements/dare/entitlementMutator.ts`                               |
| **B4** | `protectionLadderFactory.ts` transforms `PickRuleDoc.protections[]` → `ProtectionLadder[]` | `utils/entitlements/dare/protectionLadderFactory.ts`                          |
| **B5** | `validateNoDuplicateEntitlements()` added to league invariants                             | `utils/leagueInvariants.ts`                                                   |
| **B6** | `validatePickSlotAccounting()` validates 30×2×N pick slots                                 | `utils/leagueInvariants.ts`                                                   |

### New DARE Module Structure

```
src/features/architect/utils/entitlements/dare/
├── index.ts                        # Barrel exports
├── types.ts                        # DARE type definitions
├── dareResolver.ts                 # Core resolution orchestrator
├── swapResolutionAdapter.ts        # Entitlement → swap resolution
├── conveyanceResolutionAdapter.ts  # Entitlement → conveyance resolution
├── entitlementMutator.ts           # World entitlement write helpers
├── resolutionReceipt.ts            # Human-readable summary generator
└── protectionLadderFactory.ts      # Protection ladder builder
```

### Resolution Semantics (Implemented)

| Outcome           | Action                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Rolled**        | Create NEW world entitlement with `seasonYear + 1`, mark original `resolved: true`            |
| **Conveyed**      | Mark original `resolved: true`, `resolvedOutcome: 'conveyed'`, remove from holder's inventory |
| **Converted**     | Create NEW entitlement with `round: 2`, mark original resolved                                |
| **Swap Resolved** | Mark entitlement `resolved: true`, record `swapWinner`, `swapPosition`                        |

### Integration Points

1. **Season Advance** (`seasonManager.js:571-625`)
   - DARE now invoked during season advance when `positionsMap` is provided
   - Writes resolution outcomes directly to world entitlements
   - Generates human-readable resolution receipt

2. **Mutation Pipeline** (`mutationPipeline.js:82-103`)
   - Phase 3.6 added for entitlement invariant validation
   - `validateNoDuplicateEntitlements()` and `validatePickSlotAccounting()` run post-mutation

3. **Trade Context** (unchanged)
   - Existing trade-time validation continues to work
   - DARE handles post-trade resolution during season advance

### Test Coverage

New test files created:

- `src/tests/architect/dare/protectionLadderFactory.test.js`
- `src/tests/architect/dare/swapResolutionAdapter.test.js`
- `src/tests/architect/dare/conveyanceResolutionAdapter.test.js`
- `src/tests/architect/dare/dareResolver.test.js`
- `src/tests/architect/entitlementInvariants.test.js`

### Feature Flag

```env
VITE_FEATURE_ENTITLEMENT_AUTHORING=true
```

Enables admin modal for creating/editing world entitlements. Writes ONLY to `architect_worlds/{worldId}/entitlements/{id}`, never to base entitlements.

---

## 🔟 UPDATED VERDICT

> ✅ **Draft asset terms + lifecycle are NOW functionally complete for NBA-level pick rights.**

### Closure Summary

| Category       | Status                                                            |
| -------------- | ----------------------------------------------------------------- |
| **Authoring**  | ✅ Feature-flagged admin modal for world entitlements             |
| **Lifecycle**  | ✅ DARE persists resolution outcomes back to entitlements         |
| **Integrity**  | ✅ League-level entitlement deduplication + pick-slot accounting  |
| **Resolution** | ✅ Protection ladder factory enables multi-year conveyance chains |

### What Now Works

- ✅ Schema can represent all NBA pick right types
- ✅ Trade-time validation is comprehensive (routing, Stepien, ownership)
- ✅ Apply/mutation is consistent with validation
- ✅ Swap and conveyance resolution logic is correct
- ✅ **NEW**: Entitlements are the persistent SSOT for draft asset lifecycle
- ✅ **NEW**: Resolution outcomes cascade back to world entitlements
- ✅ **NEW**: League invariants prevent duplicate entitlements
- ✅ **NEW**: Pick-slot accounting validates expected vs actual slots
- ✅ **NEW**: Protection ladder factory enables multi-year protections
- ✅ **NEW**: Feature-flagged UI for world entitlement authoring

---

**END OF AUDIT**
