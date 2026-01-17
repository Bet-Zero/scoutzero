# Cap Sheet Mutations & Validation Master Doc

**Created:** 2026-01-16  
**Purpose:** Canonical reference for Cap Sheet mutation and validation architecture  
**Scope:** Cap Sheet / Cap Table only (excludes Trade Machine implementation details)

---

## 1. Purpose & Scope

This document maps the complete Cap Sheet mutation and validation architecture to ensure:

1. All mutations flow through doctrine-compliant pipelines
2. CBA enforcement is applied consistently  
3. Gaps between current implementation and required behavior are tracked

### Data Doctrine Alignment

```
BASE (Read-Only) → WORLDS (Writable Overlay) → COMPUTED (Ephemeral)
```

- **Base:** Firestore `teams/`, `players/` collections (real-world contracts, salaries)
- **Worlds:** `architect_worlds/{worldId}/teams/` overlay (user modifications)
- **Computed:** Runtime totals via `computeTeamCapTotals()` and validation results

> **Critical Violation:** Any direct write to base collections is a doctrine violation.

---

## 2. Mutation Architecture

### 2.1 Entry Points (Two Tiers)

| Tier | Entry Point | Persistence | Use Case |
|------|-------------|-------------|----------|
| **Pipeline** | `applyWorldMutation()` in `mutationPipeline.js` | Firestore worlds | Production mutations |
| **Local** | `useCapSheetState.js` | Session state only | UI experimentation |

### 2.2 Canonical Mutation Pipeline

**File:** `src/features/architect/utils/mutationPipeline.js`

The pipeline enforces a 5-phase flow:

```
READ → COMPUTE (PURE) → VALIDATE → PERSIST → POST-UPDATE
```

#### Supported Mutation Types

| MutationType | Compute Function | Validation Function |
|--------------|------------------|---------------------|
| `executeTrade` | `computeTradeResult()` | `validateTrade()` |
| `signFreeAgent` | `computeSigningResult()` | `validateSigning()` |
| `waivePlayer` | `computeWaiveResult()` | `validateWaive()` |
| `extendPlayer` | `computeExtensionResult()` | `validateExtension()` |
| `optionDecision` | `computeOptionResult()` | `validateOptionDecision()` |
| `renounceRights` | `computeRenounceResult()` | `validateRenounceRights()` |

### 2.3 UI Action Handlers

**File:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

| Handler | Calls Pipeline? | Notes |
|---------|-----------------|-------|
| `handleSignFreeAgent()` | ✅ Yes | Uses `applyWorldMutation` |
| `handleWaiveContract()` | ✅ Yes | Uses `applyWorldMutation` |
| `handleExtendContract()` | ✅ Yes | Uses `applyWorldMutation` |
| `handleOptionDecision()` | ✅ Yes | Uses `applyWorldMutation` |
| `handleRenounceRights()` | ✅ Yes | Uses `applyWorldMutation` |
| `handleTradeActions()` | ✅ Yes | Trade flow uses pipeline |

### 2.4 Local State Hook (Session Only)

**File:** `src/features/architect/hooks/useCapSheetState.js`

This hook provides session-only experimentation without Firestore persistence:

| Action | Function | Persists? |
|--------|----------|-----------|
| Option Accept/Decline | `exerciseOption()` | Session only |
| Extend | `extendContract()` | Session only |
| Sign/Re-sign | `signPlayer()` | Session only |
| Waive/Stretch/Buyout | `waivePlayer()` | Session only |
| Renounce | `renounceRights()` | Session only |

---

## 3. Mutations Inventory

### 3.1 Production Mutations (Pipeline)

| Mutation | UI Surface | Handler | Data Written | Uses Pipeline? |
|----------|------------|---------|--------------|----------------|
| Sign Free Agent | EditContractModal → GMDashboard | `handleSignFreeAgent` | `teams/{code}.players`, `teams/{code}.roster`, `teams/{code}.capHolds`, `teams/{code}.exceptions` | ✅ Yes |
| Waive Player | EditContractModal → GMDashboard | `handleWaiveContract` | `teams/{code}.players`, `teams/{code}.deadCap`, `teams/{code}.roster` | ✅ Yes |
| Waive & Stretch | EditContractModal → GMDashboard | `handleWaiveContract` | Same as waive + stretched `deadCap.amountByYear` | ✅ Yes |
| Buyout | EditContractModal → GMDashboard | `handleWaiveContract` | Same as waive with reduced `deadCap.amount` | ✅ Yes |
| Extend Contract | EditContractModal → GMDashboard | `handleExtendContract` | `players/{id}.contract.salariesByYear`, `players/{id}.futureContract` | ✅ Yes |
| Option Decision | EditContractModal → GMDashboard | `handleOptionDecision` | `players/{id}.contract.salariesByYear[n].optionUsed`, `teams/{code}.capHolds` | ✅ Yes |
| Renounce Rights | EditContractModal → GMDashboard | `handleRenounceRights` | `teams/{code}.capHolds` (removal), `players/{id}.contract.birdRights` | ✅ Yes |
| Execute Trade | TradeMachine → TradeEditor | Via `applyWorldMutation` | Multiple team player arrays, roster, draft picks, exceptions | ✅ Yes |

### 3.2 Missing / Incomplete Mutations

| Mutation | Status | Gap Description |
|----------|--------|-----------------|
| Add Dead Money Entry (Manual) | ❌ Not Implemented | No UI to manually add dead money entries |
| Remove Dead Money Entry | ❌ Not Implemented | No UI to clear erroneous dead money |
| Exception Create/Expire (Manual) | Partial | Exception tracking is display-only |
| TPE Usage Tracking | Partial | TPEs tracked but no formal usage pipeline |
| Roster Spot Charges | ❌ Not Implemented | Incomplete roster charges not computed |

---

## 4. Data Paths & Shapes

### 4.1 World Overlay Structure

**Collection:** `architect_worlds/{worldId}/teams/{teamCode}`

```typescript
{
  players: ArchitectPlayer[],      // Overlay player data
  roster: string[],                // Player IDs on roster
  capHolds: CapHold[],             // Active cap holds
  exceptions: {                    // Exception usage
    mle?: { amount, usedAmount, remainingAmount, type },
    bae?: { amount, usedAmount, remainingAmount },
    tpmle?: { amount, usedAmount, remainingAmount }
  },
  deadCap: DeadCapEntry[],         // Dead money (NEW schema)
  waivedContracts: LegacyWaive[],  // Dead money (LEGACY schema)
  stretchHistory: LegacyStretch[], // Dead money (LEGACY schema)
  source: { type, lastModifiedAt }
}
```

### 4.2 DeadCap Schema (Canonical)

**Location:** `teams/{code}.deadCap`

```typescript
// NEW SCHEMA (canonical when present)
interface DeadCapEntry {
  playerId: string;
  playerName: string;
  amountByYear: { [yearKey: string]: { amount: number } };
  stretched: boolean;
  buyout: boolean;
  reason?: string;
}

// LEGACY SCHEMA (fallback)
interface LegacyWaivedContract {
  playerId: string;
  playerName: string;
  amountByYear: { [year: string]: number };
  isStretched?: boolean;
}
```

**Precedence Rule:** `deadCap` array takes precedence if non-empty for the requested year; otherwise fallback to `waivedContracts`/`stretchHistory`.

### 4.3 Cap Holds Schema

```typescript
interface CapHold {
  playerId: string;
  playerName: string;
  amount: number;
  season: string;        // e.g., "2025-26"
  type: string;          // "FA Cap Hold", "Draft Pick Hold", etc.
  active: boolean;
  isSigned: boolean;
  reason?: string;
}
```

---

## 5. Validation Architecture

### 5.1 Validation Entry Points

| Validator File | Scope | Used By |
|----------------|-------|---------|
| `capLegalityValidation.js` | Non-trade mutations | `mutationPipeline.js` |
| `tradeValidator.js` | Trade validation | `mutationPipeline.js`, Trade Machine |
| `useCapValidation.js` | Real-time UI hints | `EditContractModal.jsx` |

### 5.2 Validation Map

| Rule / Check | Location | Trigger | Block Type | Data Inputs |
|--------------|----------|---------|------------|-------------|
| Roster Size (>15) | `capLegalityValidation.js:validateSigning` | Pre-persist | Hard Block | `team.players` |
| Two-Way Limit (>3) | `capLegalityValidation.js:validateSigning` | Pre-persist | Hard Block | `team.players` |
| Hard Cap Ceiling | `capLegalityValidation.js:validateSigning` | Pre-persist | Hard Block | `team.totals`, `capSettings` |
| **Exception Blocked** | `capLegalityValidation.js:validateExceptionEligibility` | Pre-persist | **Hard Block** | `team.totals`, `capSettings`, `signedUsing` |
| Roster Minimum (<14) | `capLegalityValidation.js:validateWaive` | Pre-persist | Warning | `team.players` |
| Dead Cap Creation | `capLegalityValidation.js:validateWaive` | Pre-persist | Info | `player.contract` |
| Option Timing | `capLegalityValidation.js:validateOptionDecision` | Pre-persist | Hard Block | `targetYear`, `currentYear` |
| No Contract to Extend | `capLegalityValidation.js:validateExtension` | Pre-persist | Hard Block | `player.contract` |
| First Apron Warning | `capLegalityValidation.js:validateSigning` | Pre-persist | Warning | `projectedCapHit`, `capSettings.firstApron` |
| Second Apron Warning | `capLegalityValidation.js:validateSigning` | Pre-persist | Warning | `projectedCapHit`, `capSettings.secondApron` |
| Cap Hold Info | `capLegalityValidation.js:validateRenounceRights` | Pre-persist | Info | `team.capHolds` |

### 5.3 Hard Block vs Override Rules

**Hard Block Rules (NEVER overridable):**

- `roster_size` - >15 players
- `hard_cap` - Over hard cap ceiling
- `two_way_limit` - >3 two-way contracts
- `option_timing` - Wrong season for option
- `no_contract` - Extension without contract
- `exception_blocked` - Exception usage blocked by apron status (NEW)
- `unverified_cap_inputs` - Cap data is unknown OR projected in STRICT mode (NEW)

**Soft Warning Rules (Overridable in dev mode via `VITE_ENABLE_CBA_OVERRIDE=true`):**

- `roster_minimum`, `dead_cap`, `first_apron`, `second_apron`

### 5.4 Exception Blocking Rules (G0-2 Implementation)

**Location:** `capLegalityValidation.js:validateExceptionEligibility`

| Team Position | MLE (Non-Taxpayer) | Taxpayer MLE | BAE | TPE |
|---------------|-------------------|--------------|-----|-----|
| Below First Apron | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| Above First Apron (not hard-capped) | ❌ BLOCKED | ✅ Allowed | ❌ BLOCKED | ✅ Allowed |
| Hard-Capped at First Apron | ✅ Allowed* | ✅ Allowed | ❌ BLOCKED | ✅ Allowed |
| Above Second Apron | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED |

\* Team is already hard-capped if they used NTMLE previously.

---

## 6. Trade Machine Comparison

### 6.1 Validator Reuse Status

| Component | Shared with Cap Sheet? | Notes |
|-----------|------------------------|-------|
| `tradeValidator.js` | ✅ Yes (for trades) | Trade-specific; imports by pipeline |
| `validateSalaryMatching` | ❌ Trades only | Cap Sheet uses different patterns |
| `enforceRosterWindow` | ❌ Trades only | Roster validation separate |
| `validateFaExceptionUsage` | ❌ Trades only | Exception usage tracked differently |
| `capSettingsProvider.js` | ✅ Yes | Shared cap/apron values |
| `computeTeamCapTotals.js` | ✅ Yes (SSOT) | Single source of truth |

### 6.2 Architecture Differences

| Aspect | Trade Machine | Cap Sheet |
|--------|---------------|-----------|
| Validation Engine | Full rules engine with 10+ validators | 5 basic validators in `capLegalityValidation.js` |
| Rule Context | Builds rich `TradeContext` with player-level rules | No rule context; basic team-level checks |
| Salary Matching | BYC, poison pill, trade kicker adjustments | N/A (no salary matching for signings) |
| Override Support | `forceTrade` flag | `overrideUsed` flag |

---

## 7. Gap Analysis (Ranked)

### 7.1 P0 — Can Produce Incorrect Cap Totals / Silent Illegal States

| Gap | Description | Impact | Status |
|-----|-------------|--------|--------|
| G0-1 | ~~No incomplete roster charge validation~~ | Teams at <14 players now have cap charge | ✅ RESOLVED |
| G0-2 | ~~Exception usage not enforced post-hard-cap~~ | Exceptions now hard-blocked when prohibited | ✅ RESOLVED |
| G0-3 | TPE expiration not automated | TPEs may appear available past 1-year window | ✅ Phase 1 Implemented |

### 7.1.1 Incomplete Roster Charge (G0-1 Resolution)

**Location:** `computeTeamCapTotals.js`

**Rule:** Teams must have at least 14 standard roster players. For each missing slot, the team is charged MIN_SALARY_ROOKIE (currently $1,119,563 for 2024-25).

**Implementation:**

- `countStandardRoster()` - Counts non-two-way players
- `getMinSalaryForYear()` - Gets minimum salary from `CBA_THRESHOLDS`
- Charge = `max(0, 14 - standardRosterCount) * MIN_SALARY_ROOKIE`
- Included in `TeamCapTotals.incompleteChargesTotal` and `totalCapAllocations`
- NOT stored in Firestore - computed at runtime

**Tests:** `src/tests/architect/capTotals/incompleteRosterCharge.test.js` (9 tests)

### 7.1.2 TPE Expiration Automation (G0-3 Resolution)

**Strategy:** Option 1 (On-Advance Cleanup)

**Location:** `seasonManager.js` -> `advanceSeasonInWorld()`

**Rule:**

- TPEs have a 1-year lifespan (typically expiring `createdSeason + 1`).
- Upon season advance, any TPEs expiring *before or on* the new season start date (July 1st) must be removed.
- **Strictness:** Removed TPEs are physically deleted from `team.tradeExceptions` array in the World overlay.
- **Lifecycle:** TPEs are cleaned during season advance; no on-read filtering required for correctness.

**Schema:**

- Canonical: `expiresOn` (ISO string)
- Implementation: `expiryISO` (ISO string)
- Logic checks both during migration phase.

**Implementation (Phase 2):**

- **Backfill:** `expiresOn` is backfilled from `expiryISO` during season transition if missing.
- **UI Alignment:** `SeasonAdvanceModal` uses shared `processTradeExceptions` logic for preview.
- **Canonicalization:** `tpeLifecycle.js` provides `getTpeExpiryISO` helper for consistent reads.

**Tests:**

- Unit: `seasonManager.tpe.test.js` (advance season, check TPE removal, check backfill)
- Integration: UI Preview matches backend removal logic.

### 7.2 P1 — Allows Illegal Action but Visible/Warned

| Gap | Description | Impact |
|-----|-------------|--------|
| G1-1 | Stretch provision legality not fully validated | Stretch timing rules (e.g., only before season) not checked |
| G1-2 | Bird rights eligibility UI hints incomplete | May show signing options that aren't CBA-compliant |
| G1-3 | No cap hold validation for FA signings | Can sign FA even if cap hold + contract > cap space |

### 7.3 P2 — Feature Missing / Polish

| Gap | Description | Impact |
|-----|-------------|--------|
| G2-1 | Manual dead money entry UI missing | Users cannot correct data errors |
| G2-2 | Exception create/expire UI missing | Must rely on automated tracking |
| G2-3 | Roster spot charges not displayed | Incomplete roster penalty not shown |
| G2-4 | Contract min/max rules not enforced | Can create invalid contract lengths |

---

## 8. File Map (Top 10)

| File | Purpose |
|------|---------|
| `src/features/architect/utils/mutationPipeline.js` | Canonical mutation pipeline |
| `src/features/architect/utils/capLegalityValidation.js` | Non-trade validation rules |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | UI action handlers |
| `src/features/architect/hooks/useCapSheetState.js` | Local session state |
| `src/features/architect/hooks/useCapValidation.js` | Real-time UI hints |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js` | SSOT computation |
| `src/features/architect/capSheet/CapSheet/CapSheet.jsx` | Main Cap Sheet component |
| `src/shared/components/EditContractModal.jsx` | Contract action modal |
| `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx` | Exception display |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Trade validation (reference) |
| `src/features/architect/utils/contractNormalization.js` | Contract schema normalization helpers |

---

## 9. Canonical Contract Schema (World)

**Status:** Phase 0 Complete (2026-01-17)

This section defines the canonical contract schema that all world mutation writers must produce. Phase 0 standardized field names and types to enable Phase 1+ CBA rule enforcement.

### 9.1 salariesByYear[] Entry (Per Year)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `season` | `string` | Yes | Format: `"YYYY-YY"` (e.g., `"2025-26"`) |
| `salary` | `number` | Yes | Base salary in dollars |
| `capHit` | `number` | Yes | Defaults to `salary` if not specified |
| `guaranteed` | `boolean` | Yes | Whether year is guaranteed |
| `guaranteedAmount` | `number` | No | Partial guarantee amount |
| `option` | `string \| null` | No | `"Team Option"`, `"Player Option"`, or `null` |
| `optionUsed` | `boolean \| null` | No | **CANONICAL: boolean** (`true`=accepted, `false`=declined, `null`=no decision) |
| `tradeBonus` | `number \| null` | No | Trade bonus amount |

**IMPORTANT:** `optionUsed` must be a boolean, NOT a string. Legacy values (`'accepted'`, `'declined'`, `'exercised'`) are normalized to boolean by `contractNormalization.js`.

### 9.2 Contract Metadata

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `startSeason` | `string` | Yes | Format: `"YYYY-YY"` |
| `endSeason` | `string` | Yes | Format: `"YYYY-YY"` |
| `contractLength` | `number` | Yes | Total years |
| `yearsRemaining` | `number` | Yes | Years left on contract |
| `signingDate` | `string` | No | **CANONICAL field name** (ISO format). NOT `signedAt` or `extensionSignedAt`. |
| `isExtension` | `boolean` | No | **CANONICAL field name**. NOT `extension`. |
| `signingTeam` | `string` | No | Team code that signed the player |

### 9.3 freeAgency Object

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `string \| null` | No | `"UFA"`, `"RFA"`, `"TO"`, `"PO"`, etc. |
| `year` | `number` | No | End year (e.g., `2026`) |
| `capHold` | `number` | No | Cap hold amount |
| `qualifyingOffer` | `number \| null` | No | QO amount for RFAs |

**IMPORTANT:** `freeAgency` must be an object, NOT a string. Legacy string values (e.g., `"2027 (UFA)"`) are normalized to object format by `contractNormalization.js`.

### 9.4 Normalization Helpers

**File:** `src/features/architect/utils/contractNormalization.js`

| Function | Purpose |
|----------|---------|
| `normalizeContractForWorld(contract)` | Normalize full contract object |
| `normalizeSalaryRow(row)` | Normalize single salariesByYear entry |
| `normalizeFreeAgency(freeAgency)` | Normalize freeAgency to object |
| `normalizeOptionUsed(value)` | Convert string optionUsed to boolean |
| `isOptionAccepted(value)` | Check if option was accepted (handles both formats) |
| `isOptionDeclined(value)` | Check if option was declined (handles both formats) |

### 9.5 Backward Compatibility

- **Read path:** Normalization helpers accept both legacy and canonical formats
- **Write path:** Mutation writers always produce canonical format
- **Existing Worlds:** Continue to work; new mutations produce clean data

---

## 10. Change Log

| Date | Change |
|------|--------|
| 2026-01-16 | Initial creation with mutations inventory and validation map |
| 2026-01-17 | **Phase A P0:** Implemented G0-1 (incomplete roster charge) and G0-2 (post-apron exception blocking). Added `exception_blocked` to HARD_BLOCK_RULES. Updated validation map. |
| 2026-01-17 | **Phase 1 P0:** Implemented G0-3 (TPE Expiration) Phase 1 Core Logic. Added `processTradeExceptions` to season transition. |
| 2026-01-17 | **Phase 2 P0:** Completed TPE Phase 2. Canonicalized `expiresOn`. Backfill in season advance. UI Drift eliminated. |
| 2026-01-17 | **Contract Schema Phase 0:** Standardized contract schema for world mutations. Created `contractNormalization.js`. Updated `computeSigningResult`, `computeExtensionResult`, `computeOptionResult` to use canonical field names/types (`signingDate`, `isExtension`, boolean `optionUsed`). Updated consumers (`useCapSheetState`, `useArchitectActions`, `seasonManager`). Added 52 unit tests. |
