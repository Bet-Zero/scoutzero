/**

* FILE: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
* PURPOSE: Canonical reference for Cap Sheet mutation and validation architecture.
* OWNERSHIP: Feature: architect/cap-sheet validation
*
* HISTORY:
* * 2026-01-16: Created (initial master doc)
* * 2026-01-17: Added Phase 4 signing terms/raises wiring details (plan `plans/_archive/cap-sheet-contract-rules-phase-4-signing-terms-2026-01-17/plan.md`, chunk_n/a)
* * 2026-01-18: Phase 7.3 option invariants + canonical multiplier owner (plan `plans/cap-sheet-contract-rules-phase-7-3/plan.md`, chunk_n/a)
*
* LINKS:
* * Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
* * Latest Chunk: n/a (no chunks used)
 */

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

* **Base:** Firestore `teams/`, `players/` collections (real-world contracts, salaries)
* **Worlds:** `architect_worlds/{worldId}/teams/` overlay (user modifications)
* **Computed:** Runtime totals via `computeTeamCapTotals()` and validation results

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
| **Min Salary Violation** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `player` (YOS), `contract.salariesByYear[0]`, `capRulesProfile` |
| **Contract Years Invalid** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `contract.contractLength` OR `salariesByYear.length`, `signedUsing` |
| **Signing Terms Invalid** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `contract.contractLength` OR `salariesByYear.length`, Salary Engine signing terms |
| **Signing Raise Invalid** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `contract.salariesByYear[].salary`/`capHit`, Salary Engine raise percentage |
| **First Year Max Invalid** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `contract.salariesByYear[0]`, `signedUsing`, `capRulesProfile.exceptions` |
| **Signing First Year Engine Max Invalid** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `contract.salariesByYear[0]`, Salary Engine `maxFirstYearSalary`, Bird rights type |
| **Second Apron Minimum Only** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `team.totals`, `contract.salariesByYear[0]`, `player` (YOS), `capRulesProfile` |
| Roster Minimum (<14) | `capLegalityValidation.js:validateWaive` | Pre-persist | Warning | `team.players` |
| Dead Cap Creation | `capLegalityValidation.js:validateWaive` | Pre-persist | Info | `player.contract` |
| Option Timing | `capLegalityValidation.js:validateOptionDecision` | Pre-persist | Hard Block | `targetYear`, `currentYear` |
| No Contract to Extend | `capLegalityValidation.js:validateExtension` | Pre-persist | Hard Block | `player.contract` |
| **Extension Ineligible** | `capLegalityValidation.js:validateExtension` | Pre-persist | **Hard Block** | `player.contract.contractType` |
| **Extension Years Invalid** | `capLegalityValidation.js:validateExtension` | Pre-persist | **Hard Block** | `extension.salariesByYear.length` OR `extension.contractLength` |
| **Extension First Year Max Invalid** | `capLegalityValidation.js:validateExtension` | Pre-persist | **Hard Block** | `player.contract.salariesByYear[-1].salary`, `extension.salariesByYear[0].salary` |
| **Extension Raise Invalid** | `capLegalityValidation.js:validateExtension` | Pre-persist | **Hard Block** | `extension.salariesByYear[].salary` (consecutive years) |
| **Contract Row Schema Invalid** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `contract.salariesByYear[]` (negative salary/capHit, missing season) |
| **Contract Guarantee Invalid** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `salariesByYear[].guaranteed`, `guaranteedAmount` (contradictory values) |
| **Contract Option Invalid** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `salariesByYear[].option` (invalid enum value) |
| **Free Agency State Invalid** | `capLegalityValidation.js:validateSigning` | Pre-persist | **Hard Block** | `contract.freeAgency` (string format or invalid year type) |
| **Cap Hold Transition Invalid** | `capLegalityValidation.js:validateOptionDecision` | Pre-persist | **Hard Block** | Enforces correct cap hold creation/removal and freeAgency state on option decline |
| **Option Accept Player Not Rostered** | `capLegalityValidation.js:validateOptionDecision` | Pre-persist | **Hard Block** | `updatedTeam.roster`, `playerId` |
| **Option Accept Option Row Invalid** | `capLegalityValidation.js:validateOptionDecision` | Pre-persist | **Hard Block** | `updatedPlayer.contract.salariesByYear` (option row + optionUsed) |
| **Option Decline Player Still Rostered** | `capLegalityValidation.js:validateOptionDecision` | Pre-persist | **Hard Block** | `updatedTeam.roster`, `playerId` |
| **Option Decline Contract Row Still Present** | `capLegalityValidation.js:validateOptionDecision` | Pre-persist | **Hard Block** | `updatedPlayer.contract.salariesByYear` (declined season row) |
| **Option Decline Free Agency Year Mismatch** | `capLegalityValidation.js:validateOptionDecision` | Pre-persist | **Hard Block** | `updatedPlayer.contract.freeAgency.year`, derived option year |
| First Apron Warning | `capLegalityValidation.js:validateSigning` | Pre-persist | Warning | `projectedCapHit`, `capSettings.firstApron` |
| Second Apron Warning | `capLegalityValidation.js:validateSigning` | Pre-persist | Warning | `projectedCapHit`, `capSettings.secondApron` |
| Cap Hold Info | `capLegalityValidation.js:validateRenounceRights` | Pre-persist | Info | `team.capHolds` |

**Note:** Signing guardrails (max years, raises, first-year max) now use Salary Engine signing terms when available. Phase 2/2.5 exception tables remain the fallback when engine terms are unavailable.

#### 5.2.1 Canonical Cap Hold Multipliers (Single Source)

* Canonical multiplier table: `src/features/architect/utils/capHolds.ts` (`CAP_HOLD_MULTIPLIERS`)
* All cap hold computations must import this table (option decline expectations, cap hold creation, Bird rights references)
* Duplicate multiplier tables are not allowed; references must defer to `capHolds.ts`

#### 5.2.2 Option Transition Invariants (Phase 7.3)

**Option Accept (Pipeline-Authoritative):**
* No cap hold created for the player
* `optionUsed === true` on the option year row
* Player remains on the team roster (no roster removal)
* `salariesByYear` remains coherent (option row present for target year)

**Option Decline (Pipeline-Authoritative):**
* Cap hold created when expected and amount matches canonical multipliers (Phase 7.2)
* Player is not rostered as a signed player for the declined option year
* `freeAgency` is canonical object and year matches derived option year
* Option year row removed (no contract entry for declined season)

### 5.3 Hard Block vs Override Rules

**Hard Block Rules (NEVER overridable):**

* `roster_size` - >15 players
* `hard_cap` - Over hard cap ceiling
* `two_way_limit` - >3 two-way contracts
* `option_timing` - Wrong season for option
* `no_contract` - Extension without contract
* `exception_blocked` - Exception usage blocked by apron status
* `unverified_cap_inputs` - Cap data is unknown OR projected in STRICT mode
* `min_salary_violation` - First-year salary/capHit below CBA minimum for player's YOS
* `contract_years_invalid` - Contract length outside allowed min/max for signing mechanism
* `signing_terms_invalid` - Salary Engine max years exceeded for signing mechanism
* `signing_raise_invalid` - Salary Engine raise percentage exceeded for signing
* `first_year_max_invalid` - First-year salary exceeds mechanism max OR MINIMUM contract above min salary
* `signing_first_year_engine_max_invalid` - First-year salary/capHit exceeds Salary Engine max (Bird rights/cap space)
* `second_apron_minimum_only` - Teams above second apron can only sign to minimum salary
* `extension_ineligible` - Two-way contracts cannot be extended (must convert first)
* `extension_years_invalid` - Extension length outside 1-4 years (baseline; designated vet allows 5)
* `extension_first_year_max_invalid` - Extension first-year salary exceeds 120% baseline (Salary Engine overrides when available)
* `extension_raise_invalid` - Extension year-over-year raises exceed 8%
* `contract_row_schema_invalid` - Salary row has negative salary/capHit or missing season
* `contract_guarantee_invalid` - Guarantee fields contradictory (e.g., `guaranteedAmount` > `salary`)
* `contract_option_invalid` - Option field has invalid enum value (must be "Team Option", "Player Option", or null)
* `free_agency_state_invalid` - freeAgency is legacy string format or has invalid year type
* `cap_hold_transition_invalid` - Cap hold creation/removal contradicts option decision (reserved)
* `option_accept_player_not_rostered` - Accepted option but player is missing from roster
* `option_accept_option_row_invalid` - Accepted option but option row missing or not marked used
* `option_decline_player_still_rostered` - Declined option but player remains on roster
* `option_decline_contract_row_still_present_for_declined_season` - Declined option but contract still includes declined season
* `option_decline_free_agency_year_mismatch` - Declined option freeAgency.year mismatch

**Soft Warning Rules (Overridable in dev mode via `VITE_ENABLE_CBA_OVERRIDE=true`):**

* `roster_minimum`, `dead_cap`, `first_apron`, `second_apron`

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
| G0-4 | ~~Min salary by YOS not enforced in pipeline~~ | Under-minimum contracts now hard-blocked | ✅ RESOLVED (Phase 1) |
| G0-5 | ~~First-year max by mechanism not enforced~~ | Over-exception contracts now hard-blocked | ✅ RESOLVED (Phase 2.5) |
| G0-6 | ~~Second apron minimum-only not enforced~~ | Above-minimum signings at second apron now blocked | ✅ RESOLVED (Phase 2.5) |
| G0-7 | ~~Extension terms/raises not enforced in pipeline~~ | Illegal extensions now hard-blocked (years, first-year max, raises) | ✅ RESOLVED (Phase 3) |

### 7.1.1 Incomplete Roster Charge (G0-1 Resolution)

**Location:** `computeTeamCapTotals.js`

**Rule:** Teams must have at least 14 standard roster players. For each missing slot, the team is charged MIN_SALARY_ROOKIE (currently $1,119,563 for 2024-25).

**Implementation:**

* `countStandardRoster()` - Counts non-two-way players
* `getMinSalaryForYear()` - Gets minimum salary from `CBA_THRESHOLDS`
* Charge = `max(0, 14 - standardRosterCount) * MIN_SALARY_ROOKIE`
* Included in `TeamCapTotals.incompleteChargesTotal` and `totalCapAllocations`
* NOT stored in Firestore - computed at runtime

**Tests:** `src/tests/architect/capTotals/incompleteRosterCharge.test.js` (9 tests)

### 7.1.2 TPE Expiration Automation (G0-3 Resolution)

**Strategy:** Option 1 (On-Advance Cleanup)

**Location:** `seasonManager.js` -> `advanceSeasonInWorld()`

**Rule:**

* TPEs have a 1-year lifespan (typically expiring `createdSeason + 1`).
* Upon season advance, any TPEs expiring *before or on* the new season start date (July 1st) must be removed.
* **Strictness:** Removed TPEs are physically deleted from `team.tradeExceptions` array in the World overlay.
* **Lifecycle:** TPEs are cleaned during season advance; no on-read filtering required for correctness.

**Schema:**

* Canonical: `expiresOn` (ISO string)
* Implementation: `expiryISO` (ISO string)
* Logic checks both during migration phase.

**Implementation (Phase 2):**

* **Backfill:** `expiresOn` is backfilled from `expiryISO` during season transition if missing.
* **UI Alignment:** `SeasonAdvanceModal` uses shared `processTradeExceptions` logic for preview.
* **Canonicalization:** `tpeLifecycle.js` provides `getTpeExpiryISO` helper for consistent reads.

**Tests:**

* Unit: `seasonManager.tpe.test.js` (advance season, check TPE removal, check backfill)
* Integration: UI Preview matches backend removal logic.

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
| G2-4 | ~~Contract years min/max not enforced in pipeline~~ | Contract years now validated by mechanism | ✅ RESOLVED (Phase 2) |

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

* **Read path:** Normalization helpers accept both legacy and canonical formats
* **Write path:** Mutation writers always produce canonical format
* **Existing Worlds:** Continue to work; new mutations produce clean data

---

## 9.6 Signing Terms Shape (Phase 6)

This section defines the canonical shape for signing terms used in validation.

### Canonical SigningTerms Type

```typescript
type SigningTerms = {
  source: 'salary_engine' | 'baseline';
  mechanism: 'FULL_MLE' | 'TPMLE' | 'ROOM_MLE' | 'BAE' | 'MINIMUM' | 'UNKNOWN' | string;
  rightsType?: 'FULL_BIRD' | 'EARLY_BIRD' | 'NON_BIRD' | 'CAP_SPACE' | 'NONE' | null;
  maxYears?: number | null;
  minYears?: number | null;
  raisePercentage?: number | null;
  maxFirstYearSalary?: number | null;
  minFirstYearSalary?: number | null;
  notes?: string;
};
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `source` | `'salary_engine'` \| `'baseline'` | Origin of terms data (engine-computed vs fallback) |
| `mechanism` | `string` | **Exception bucket** (e.g., `FULL_MLE`, `TPMLE`, `ROOM_MLE`, `BAE`, `MINIMUM`, `UNKNOWN`). NOT Bird rights. |
| `rightsType` | `string` \| `null` | **Bird rights type** (e.g., `FULL_BIRD`, `EARLY_BIRD`, `NON_BIRD`, `CAP_SPACE`, `NONE`). NOT exception. |
| `maxYears` | `number` \| `null` | Maximum contract length |
| `minYears` | `number` \| `null` | Minimum contract length |
| `raisePercentage` | `number` \| `null` | Max year-over-year raise (e.g., `0.05` for 5%, `0.08` for 8%) |
| `maxFirstYearSalary` | `number` \| `null` | Maximum first-year salary |
| `notes` | `string` | Additional context |

### Backward Compatibility

**Location:** `capLegalityValidation.js:normalizeSigningTerms()`

The `normalizeSigningTerms(rawTerms, options)` adapter:

* Accepts any legacy terms object
* If `mechanism` contains Bird rights keywords (e.g., "Full Bird"), moves value to `rightsType`
* Sets `mechanism` to `options.fallbackMechanism` or `'UNKNOWN'` when recovering
* Normalizes raw `rightsType` strings to canonical enum values

**Example:**

```javascript
// Legacy (pre-Phase 6)
const legacy = { mechanism: 'Full Bird', maxYears: 4 };

// Canonical (Phase 6)
const canonical = normalizeSigningTerms(legacy, { fallbackMechanism: 'FULL_MLE' });
// => { mechanism: 'FULL_MLE', rightsType: 'FULL_BIRD', maxYears: 4, ... }
```

---

## 9.7 Cap Hold Amount Rules (Phase 7.2)

* **Rights-based multipliers:** FULL_BIRD = 190%, EARLY_BIRD = 130%, NON_BIRD = 120%.
* **Fallback:** CAP_SPACE/NONE/UNKNOWN uses the legacy 150% multiplier **with explicit warning** (`cap_hold_transition_inputs_missing`).
* **Rounding:** Expected amount uses `Math.round(lastSalary * multiplier)`; validation enforces ≤ $1 tolerance.
* **FA year derivation:** From option season string (`"YYYY-YY"` → start year). Example: `"2025-26"` → `2025`.

## 10. Change Log

| Date | Change |
|------|--------|
| 2026-01-16 | Initial creation with mutations inventory and validation map |
| 2026-01-17 | **Phase A P0:** Implemented G0-1 (incomplete roster charge) and G0-2 (post-apron exception blocking). Added `exception_blocked` to HARD_BLOCK_RULES. Updated validation map. |
| 2026-01-17 | **Phase 1 P0:** Implemented G0-3 (TPE Expiration) Phase 1 Core Logic. Added `processTradeExceptions` to season transition. |
| 2026-01-17 | **Phase 2 P0:** Completed TPE Phase 2. Canonicalized `expiresOn`. Backfill in season advance. UI Drift eliminated. |
| 2026-01-17 | **Contract Schema Phase 0:** Standardized contract schema for world mutations. Created `contractNormalization.js`. Updated `computeSigningResult`, `computeExtensionResult`, `computeOptionResult` to use canonical field names/types (`signingDate`, `isExtension`, boolean `optionUsed`). Updated consumers (`useCapSheetState`, `useArchitectActions`, `seasonManager`). Added 52 unit tests. |
| 2026-01-17 | **Contract Rules Phase 1:** Implemented G0-4 (Minimum Salary Enforcement). Added `min_salary_violation` to HARD_BLOCK_RULES. `validateSigning` now rejects contracts where first-year salary/capHit is below CBA minimum for player's YOS. Two-way contracts excluded. 8 new tests added. |
| 2026-01-17 | **Contract Rules Phase 2:** Implemented G2-4 (Contract Years Enforcement). Added `contract_years_invalid` to HARD_BLOCK_RULES. `validateSigning` now validates contract length against mechanism-specific limits (MINIMUM: 1-2yr, FULL_MLE: 1-4yr, TPMLE/ROOM_MLE/BAE: 1-2yr). Added `resolveSigningMechanism()`, `getSigningYearsLimits()` helpers. Two-way contracts excluded. 9 new tests added. |
| 2026-01-17 | **Contract Rules Phase 2.5:** Implemented G0-5 (First-Year Max by Mechanism) and G0-6 (Second Apron Minimum-Only). Added `first_year_max_invalid` and `second_apron_minimum_only` to HARD_BLOCK_RULES. `validateSigning` now enforces exception amount caps (FULL_MLE/TPMLE/ROOM_MLE/BAE) and MINIMUM exactness. Teams above second apron blocked from above-minimum signings. Added `getSigningFirstYearMax()` helper. Fixed UI TPMLE maxYears (3→2). Two-way contracts excluded. 14 new tests added. |
| 2026-01-17 | **Phase 2.5 Patch:** Fixed second apron projected cap hit calculation to use `capHit` (not `salary`) when the two differ. Ensures incentive-laden or deferred contracts are correctly evaluated against second apron threshold. 1 new test added. |
| 2026-01-17 | **Contract Rules Phase 3:** Implemented G0-7 (Extension Terms/Raises Enforcement). Added `extension_ineligible`, `extension_years_invalid`, `extension_first_year_max_invalid`, `extension_raise_invalid` to HARD_BLOCK_RULES. `validateExtension` now blocks: (1) two-way contract extensions, (2) extensions > 4 years, (3) first-year exceeds baseline max, (4) raises > 8%. Added helper functions: `getContractLastYearSalary()`, `getExtensionFirstYearSalary()`, `getExtensionYears()`, `validateExtensionTermsAndRaises()`. Added `EXTENSION_YEARS_LIMITS`, `EXTENSION_FIRST_YEAR_MAX_PERCENT`, `EXTENSION_MAX_RAISE_PERCENT` constants. 8 new tests added. |
| 2026-01-17 | **Contract Rules Phase 3.25:** Fixed extension first-year max baseline (140%→120%). Wired Salary Engine `extensionTerms` into `validateExtension`. Engine-computed terms now override baseline for type-specific rules (rookie/designated vet/veteran). Added `getExtensionTermsForPlayer()` helper. Updated tests (constant check, 125% blocking test, engine override test). |
| 2026-01-17 | **Contract Rules Phase 4:** Wired Salary Engine signing terms into `validateSigning` for max years + raise caps. Added `signing_terms_invalid` and `signing_raise_invalid` to HARD_BLOCK_RULES. Salary Engine max first-year is now enforced as an additional cap when available. Added signing terms helper + raise validation helper, updated tests, and documented pipeline authority for signing guardrails. |
| 2026-01-18 | **Contract Rules Phase 4.5:** Added distinct `signing_first_year_engine_max_invalid` rule for engine-derived first-year max violations. Separates Bird rights/cap space enforcement from fallback exception cap enforcement (`first_year_max_invalid`). Includes rights info in violation messages. 6 new tests added. |
| 2026-01-18 | **Contract Rules Phase 5:** Added contract row schema validation. 3 new HARD_BLOCK rules: `contract_row_schema_invalid` (negative salary/capHit, missing season), `contract_guarantee_invalid` (guaranteedAmount > salary, guaranteed=false + positive amount), `contract_option_invalid` (invalid option enum). Added `validateContractRows()` aggregator wired into `validateSigning`. Policy: normalize `optionUsed` to null when option is null; hard-block other violations. 14 new tests added. |
| 2026-01-18 | **Contract Rules Phase 6:** Separated `mechanism` (exception bucket) from `rightsType` (Bird rights type). Added canonical `SigningTerms` shape documentation. Created `normalizeSigningTerms()` backward-compat adapter. Updated `buildBaseSigningTerms()` and `buildExceptionSigningTerms()` to use proper field separation. Violation payloads now include both `mechanism` and `rightsType`. Re-signing (Bird rights) is now pipeline-authoritative. 13 new tests added. |
| 2026-01-18 | **Contract Rules Phase 7:** Added canonical freeAgency state validation. 2 new HARD_BLOCK rules: `free_agency_state_invalid` (blocks legacy string format, invalid year type), `cap_hold_transition_invalid` (reserved for option accept/decline contradictions). Created `validateFreeAgencyState()` in `contractNormalization.js`. Wired into `validateSigning()`. Warns on RFA missing QO and UFA with QO set. 10 new tests added. |
| 2026-01-18 | **Contract Rules Phase 7.1:** Enforced `cap_hold_transition_invalid`. `validateOptionDecision` now blocks option accept if cap hold created, and decline if missing hold. Created `capHoldTransitionHelpers.js`. Adopted simplified 150% cap hold model (superseded by Phase 7.2). Fixed `freeAgentYear` bug in pipeline. 5 new tests added. |
| 2026-01-18 | **Contract Rules Phase 7.2:** Added rights-based cap hold amounts (190/130/120), fallback warnings for missing rightsType, and season-derived FA year on option decline. Updated validation + option mutation paths. Added new tests. |
| 2026-01-18 | **Contract Rules Phase 7.3:** Enforced option accept/decline state invariants (roster presence, option row coherence, declined season removal) and hard-blocked freeAgency year mismatch. Declared `capHolds.ts` as the canonical multiplier source and wired remaining references. Added new tests for invariants + canonical source usage. |
