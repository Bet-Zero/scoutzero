/\*\*

- FILE: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
- PURPOSE: Canonical reference for Cap Sheet mutation and validation architecture.
- OWNERSHIP: Feature: architect/cap-sheet validation
-
- HISTORY:
- - 2026-01-16: Created (initial master doc)
- - 2026-01-17: Added Phase 4 signing terms/raises wiring details (plan `plans/_archive/cap-sheet-contract-rules-phase-4-signing-terms-2026-01-17/plan.md`, chunk_n/a)
- - 2026-01-18: Phase 7.3 option invariants + canonical multiplier owner (plan `plans/cap-sheet-contract-rules-phase-7-3/plan.md`, chunk_n/a)
- - 2026-01-22: Phase 26 S&T Audit - fixed build errors, audited workflow, extended tests 2→20
- - 2026-01-21: Phase 27 Manual Exception Management - added setExceptions mutation, validateExceptions, ManageExceptionsModal
- - 2026-01-21: Phase 29 LeagueView SSOT Fix - replaced inline salary computation with `computeTeamCapTotals()`, added 8 regression tests
- - 2026-01-23: Phase 31 Max Salary Enforcement - added `max_salary_violation` hard block to prevent contracts exceeding YOS-based max (25%/30%/35% of cap), 16 new tests
- - 2026-01-23: Phase 32 S&T Incoming Aggregation - added Rule 1.6 to block receiving team from aggregating other players with S&T player, 9 new tests (P0-2 closure)
- - 2026-01-23: Phase 33 Hard Cap Test Drift Fix - test assertion moved to `rules.hardCap.violations` to avoid violation order dependency
- - 2026-01-23: Phase 34 Second Apron Threshold Boundary Bug (PREFLIGHT) - identified `>=` vs `>` comparator bug in 8 files; CBA Art VII Sec 2(f) specifies `>` for second apron team classification; execution pending
- - 2026-01-23: Phase 34 Second Apron Threshold Boundary Bug (EXECUTION) - fixed `>=` → `>` comparator in 7 files for second apron classification; added 5 boundary tests; teams at threshold no longer incorrectly treated as second apron
- - 2026-01-27: Phase 38 Architect Second Apron Semantics Unification (EXECUTION) - unified legacy `capUtils.js` and `tradeHelpers.js` to strictly use `>` for second apron classification, aligning with Trade Machine SSOT; fixed `capLegalityValidation.js` hard cap check to allow landing exactly on apron; added guardrail tests.
- - 2026-01-27: Phase 39 Second Apron Drift Scan (PREFLIGHT) - Confirmed partial drift in `capLegalityValidation.js` (uses `>=` for exception blocking) and `tradeHelpers.js`. Strict semantics (`>`) confirmed for hard cap status. Return package at `docs/architect/return_packages/PHASE_39_SECOND_APRON_DRIFT_SCAN_PREFLIGHT_RETURN_PACKAGE.md`.
- - 2026-01-27: Phase 39 Second Apron Drift Fix (EXECUTION) - Eliminated `>=` drift in `capLegalityValidation.js` (exception blocking) and `tradeHelpers.js`. Added strict boundary guardrail tests (`phase39_drift_guardrails.test.js`).
- - 2026-01-27: Phase 40 Second Apron Drift Scan (Architect-wide) (PREFLIGHT) - Preflight completed. Identified 3 logic drift locations and 1 interface drift. Return package: `docs/architect/return_packages/PHASE_40_SECOND_APRON_DRIFT_SCAN_PREFLIGHT_RETURN_PACKAGE.md`.
- - 2026-01-27: Phase 40 Second Apron Drift Fix (Architect-wide) (EXECUTION) - Eliminated remaining `>=` drift in `buildRuleContext.ts`, `capLegalityValidation.js` (Rule 1.8), and `faExceptionUtils.js`. Renamed `teamIsAtOrAboveSecondApron` to `teamIsSecondApron` in `draftPickUtils.js`. Added 9 strict boundary guardrail tests (`phase40_secondApron_drift_guardrails.test.js`).
- - 2026-01-28: Phase 41A Draft Pick Utils Back-Compat Removal Readiness (PREFLIGHT) - Confirmed safety of removing `teamIsAtOrAboveSecondApron` fallback in `draftPickUtils.js`. Only 1 production caller (`validateStepien.ts`) exists and uses the new key. Return package: `docs/architect/return_packages/PHASE_41A_DRAFT_PICK_BACKCOMPAT_PREFLIGHT_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 41B Draft Pick Utils Back-Compat Removal (EXECUTION) - Removed `teamIsAtOrAboveSecondApron` parameter support from `draftPickUtils.js`. Legacy key is now ignored. Updated `phase40_secondApron_drift_guardrails.test.js` to verify strictness.
- - 2026-01-28: Phase 42 Apron Derivation Consolidation (EXECUTION) - Consolidated apron derivation in `tradeHelpers.getApronStatus`, `usePlayerRulesProfiles.deriveApronStatus`, `buildRuleContext.deriveApronLevel`, and `faExceptionUtils.canUseFaException` to delegate to tradeMachine SSOT; fixed first apron boundary drift in `usePlayerRulesProfiles` (`>` → `>=`); added 19 guardrail tests; deferred `useCapValidation` (warning-only, low risk). Return package: `docs/architect/return_packages/PHASE_42_APRON_DERIVATION_CONSOLIDATION_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 43 Apron Drift Prevention Guardrails (EXECUTION) - Added ESLint rule blocking direct imports from `tradeMachine/utils/capUtils.js` outside tradeMachine folder; fixed `buildRuleContext.ts` and `tradeHelpers.js` to use canonical import path `@/features/architect/utils/capUtils`; updated deprecated `getAllowableIncomingMargin` to delegate to `isSecondApronTeam`; confirmed S&T eligibility check uses correct `>` semantics; added 5 guardrail tests. Return package: `docs/architect/return_packages/PHASE_43_APRON_DRIFT_PREVENTION_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md`.
- - 2026-01-28: Phase 44 Architect Status Snapshot (PREFLIGHT) - Produced current state map confirming Phases 35-43 complete; no blocking work remains; identified low-priority polish items (TPE usage pipeline, roster charge UI, doc cleanup). Return package: `docs/architect/return_packages/PHASE_44_ARCHITECT_STATUS_SNAPSHOT_PREFLIGHT_RETURN_PACKAGE.md`.
-
- LINKS:
- - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
- - Latest Chunk: n/a (no chunks used)
    \*/

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

| Tier         | Entry Point                                     | Persistence        | Use Case             |
| ------------ | ----------------------------------------------- | ------------------ | -------------------- |
| **Pipeline** | `applyWorldMutation()` in `mutationPipeline.js` | Firestore worlds   | Production mutations |
| **Local**    | `useCapSheetState.js`                           | Session state only | UI experimentation   |

### 2.2 Canonical Mutation Pipeline

**File:** `src/features/architect/utils/mutationPipeline.js`

The pipeline enforces a 5-phase flow:

```
READ → COMPUTE (PURE) → VALIDATE → PERSIST → POST-UPDATE
```

#### Supported Mutation Types

| MutationType        | Compute Function                   | Validation Function              |
| ------------------- | ---------------------------------- | -------------------------------- |
| `executeTrade`      | `computeTradeResult()`             | `validateTrade()`                |
| `signFreeAgent`     | `computeSigningResult()`           | `validateSigning()`              |
| `waivePlayer`       | `computeWaiveResult()`             | `validateWaive()`                |
| `extendPlayer`      | `computeExtensionResult()`         | `validateExtension()`            |
| `optionDecision`    | `computeOptionResult()`            | `validateOptionDecision()`       |
| `renounceRights`    | `computeRenounceResult()`          | `validateRenounceRights()`       |
| `storeOfferSheet`   | `computeStoreOfferSheetResult()`   | `validateStoreOnlyInvariants()`  |
| `matchOfferSheet`   | `computeMatchOfferSheetResult()`   | `validateOfferSheetResolution()` |
| `declineOfferSheet` | `computeDeclineOfferSheetResult()` | `validateOfferSheetResolution()` |

### 2.3 UI Action Handlers

**File:** `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`

| Handler                  | Calls Pipeline? | Notes                     |
| ------------------------ | --------------- | ------------------------- |
| `handleSignFreeAgent()`  | ✅ Yes          | Uses `applyWorldMutation` |
| `handleWaiveContract()`  | ✅ Yes          | Uses `applyWorldMutation` |
| `handleExtendContract()` | ✅ Yes          | Uses `applyWorldMutation` |
| `handleOptionDecision()` | ✅ Yes          | Uses `applyWorldMutation` |
| `handleRenounceRights()` | ✅ Yes          | Uses `applyWorldMutation` |
| `handleTradeActions()`   | ✅ Yes          | Trade flow uses pipeline  |

### 2.4 Local State Hook (Session Only)

**File:** `src/features/architect/hooks/useCapSheetState.js`

This hook provides session-only experimentation without Firestore persistence:

| Action                | Function           | Persists?    |
| --------------------- | ------------------ | ------------ |
| Option Accept/Decline | `exerciseOption()` | Session only |
| Extend                | `extendContract()` | Session only |
| Sign/Re-sign          | `signPlayer()`     | Session only |
| Waive/Stretch/Buyout  | `waivePlayer()`    | Session only |
| Renounce              | `renounceRights()` | Session only |

---

## 3. Mutations Inventory

### 3.1 Production Mutations (Pipeline)

| Mutation                | UI Surface                       | Handler                   | Data Written                                                                                      | Uses Pipeline? |
| ----------------------- | -------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- | -------------- |
| Sign Free Agent         | EditContractModal → GMDashboard  | `handleSignFreeAgent`     | `teams/{code}.players`, `teams/{code}.roster`, `teams/{code}.capHolds`, `teams/{code}.exceptions` | ✅ Yes         |
| Waive Player            | EditContractModal → GMDashboard  | `handleWaiveContract`     | `teams/{code}.players`, `teams/{code}.deadCap`, `teams/{code}.roster`                             | ✅ Yes         |
| Waive & Stretch         | EditContractModal → GMDashboard  | `handleWaiveContract`     | Same as waive + stretched `deadCap.amountByYear`                                                  | ✅ Yes         |
| Buyout                  | EditContractModal → GMDashboard  | `handleWaiveContract`     | Same as waive with reduced `deadCap.amount`                                                       | ✅ Yes         |
| Extend Contract         | EditContractModal → GMDashboard  | `handleExtendContract`    | `players/{id}.contract.salariesByYear`, `players/{id}.futureContract`                             | ✅ Yes         |
| Option Decision         | EditContractModal → GMDashboard  | `handleOptionDecision`    | `players/{id}.contract.salariesByYear[n].optionUsed`, `teams/{code}.capHolds`                     | ✅ Yes         |
| Renounce Rights         | EditContractModal → GMDashboard  | `handleRenounceRights`    | `teams/{code}.capHolds` (removal), `players/{id}.contract.birdRights`                             | ✅ Yes         |
| Store Offer Sheet       | EditContractModal → GMDashboard  | `handleStoreOfferSheet`   | `teams/{offering}.offerSheets`, `teams/{home}.incomingOfferSheets`                                | ✅ Yes         |
| Match Offer Sheet       | OfferSheetList                   | `handleMatchOfferSheet`   | `offerSheets[].status`, `incomingOfferSheets[].status`                                            | ✅ Yes         |
| Decline Offer Sheet     | OfferSheetList                   | `handleDeclineOfferSheet` | `offerSheets[].status`, `incomingOfferSheets[].status`                                            | ✅ Yes         |
| Execute Trade           | TradeMachine → TradeEditor       | Via `applyWorldMutation`  | Multiple team player arrays, roster, draft picks, exceptions                                      | ✅ Yes         |
| Sign-and-Trade          | EditContractModal → GMDashboard  | `handleSignAndTrade`      | Source: rights lost; Dest: player gained (signed)                                                 | ✅ Yes         |
| Set Dead Cap (Manual)   | ManageDeadMoneyModal → CapSheet  | `handleSetDeadCap`        | `teams/{code}.deadCap` (full replacement)                                                         | ✅ Yes         |
| Set Exceptions (Manual) | ManageExceptionsModal → CapSheet | `handleSetExceptions`     | `teams/{code}.exceptions` (full replacement)                                                      | ✅ Yes         |

### 3.2 Missing / Incomplete Mutations

| Mutation                         | Status                    | Gap Description                           |
| -------------------------------- | ------------------------- | ----------------------------------------- |
| Exception Create/Expire (Manual) | ✅ Implemented (Phase 27) | Manual exception management now available |
| TPE Usage Tracking               | Partial                   | TPEs tracked but no formal usage pipeline |
| Roster Spot Charges              | ❌ Not Implemented        | Incomplete roster charges not computed    |

---

## 4. Data Paths & Shapes

### 4.1 World Overlay Structure

**Collection:** `architect_worlds/{worldId}/teams/{teamCode}`

```typescript
{
  players: ArchitectPlayer[],      // Overlay player data
  roster: string[],                // Player IDs on roster
  capHolds: CapHold[],             // Active cap holds
  exceptions: TeamExceptions,      // Exception usage (Phase 27 schema)
  deadCap: DeadCapEntry[],         // Dead money (NEW schema)
  waivedContracts: LegacyWaive[],  // Dead money (LEGACY schema)
  stretchHistory: LegacyStretch[], // Dead money (LEGACY schema)
  source: { type, lastModifiedAt }
}
```

### 4.2 Exceptions Schema (Phase 27)

**Location:** `teams/{code}.exceptions`

```typescript
type TeamExceptions = {
  mle?: ExceptionUsage; // Mid-Level Exception
  tpmle?: ExceptionUsage; // Taxpayer Mid-Level Exception
  bae?: ExceptionUsage; // Bi-Annual Exception
  room?: ExceptionUsage; // Room Exception
  // Note: TPE is NOT managed in Phase 27; explicit future work
};

type ExceptionUsage = {
  enabled: boolean; // if false, treat as "unused/unavailable"
  totalAmount: number; // total exception size for the season (USD)
  usedAmount: number; // used so far (USD)
  seasonKey: string; // e.g. "2025-26"
  notes?: string; // optional user text
};
```

**Schema Rules (P0 Hard Blocks):**

- `team.exceptions` must be an object if present
- For each supported exception key (mle, tpmle, bae, room):
  - `enabled` is boolean
  - `totalAmount` and `usedAmount` are finite numbers ≥ 0
  - `usedAmount <= totalAmount`
  - `seasonKey` is non-empty string
- Unknown keys: hard-block (`exceptions_unknown_key`) to be audit-grade

### 4.3 DeadCap Schema (Canonical)

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
  season: string; // e.g., "2025-26"
  type: string; // "FA Cap Hold", "Draft Pick Hold", etc.
  active: boolean;
  isSigned: boolean;
  reason?: string;
}
```

---

## 5. Validation Architecture

### 5.1 Validation Entry Points

| Validator File             | Scope               | Used By                              |
| -------------------------- | ------------------- | ------------------------------------ |
| `capLegalityValidation.js` | Non-trade mutations | `mutationPipeline.js`                |
| `tradeValidator.js`        | Trade validation    | `mutationPipeline.js`, Trade Machine |
| `useCapValidation.js`      | Real-time UI hints  | `EditContractModal.jsx`              |

### 5.2 Validation Map

| Rule / Check                                  | Location                                                | Trigger     | Block Type     | Data Inputs                                                                        |
| --------------------------------------------- | ------------------------------------------------------- | ----------- | -------------- | ---------------------------------------------------------------------------------- |
| Roster Size (>15)                             | `capLegalityValidation.js:validateSigning`              | Pre-persist | Hard Block     | `team.players`                                                                     |
| Two-Way Limit (>3)                            | `capLegalityValidation.js:validateSigning`              | Pre-persist | Hard Block     | `team.players`                                                                     |
| Hard Cap Ceiling                              | `capLegalityValidation.js:validateSigning`              | Pre-persist | Hard Block     | `team.totals`, `capSettings`                                                       |
| **Exception Blocked**                         | `capLegalityValidation.js:validateExceptionEligibility` | Pre-persist | **Hard Block** | `team.totals`, `capSettings`, `signedUsing`                                        |
| **Min Salary Violation**                      | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `player` (YOS), `contract.salariesByYear[0]`, `capRulesProfile`                    |
| **Contract Years Invalid**                    | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.contractLength` OR `salariesByYear.length`, `signedUsing`                |
| **Signing Terms Invalid**                     | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.contractLength` OR `salariesByYear.length`, Salary Engine signing terms  |
| **Signing Raise Invalid**                     | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.salariesByYear[].salary`/`capHit`, Salary Engine raise percentage        |
| **First Year Max Invalid**                    | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.salariesByYear[0]`, `signedUsing`, `capRulesProfile.exceptions`          |
| **Signing First Year Engine Max Invalid**     | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.salariesByYear[0]`, Salary Engine `maxFirstYearSalary`, Bird rights type |
| **Second Apron Minimum Only**                 | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `team.totals`, `contract.salariesByYear[0]`, `player` (YOS), `capRulesProfile`     |
| Roster Minimum (<14)                          | `capLegalityValidation.js:validateWaive`                | Pre-persist | Warning        | `team.players`                                                                     |
| Dead Cap Creation                             | `capLegalityValidation.js:validateWaive`                | Pre-persist | Info           | `player.contract`                                                                  |
| Option Timing                                 | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | Hard Block     | `targetYear`, `currentYear`                                                        |
| No Contract to Extend                         | `capLegalityValidation.js:validateExtension`            | Pre-persist | Hard Block     | `player.contract`                                                                  |
| **Extension Ineligible**                      | `capLegalityValidation.js:validateExtension`            | Pre-persist | **Hard Block** | `player.contract.contractType`                                                     |
| **Extension Years Invalid**                   | `capLegalityValidation.js:validateExtension`            | Pre-persist | **Hard Block** | `extension.salariesByYear.length` OR `extension.contractLength`                    |
| **Extension First Year Max Invalid**          | `capLegalityValidation.js:validateExtension`            | Pre-persist | **Hard Block** | `player.contract.salariesByYear[-1].salary`, `extension.salariesByYear[0].salary`  |
| **Extension Raise Invalid**                   | `capLegalityValidation.js:validateExtension`            | Pre-persist | **Hard Block** | `extension.salariesByYear[].salary` (consecutive years)                            |
| **Contract Row Schema Invalid**               | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.salariesByYear[]` (negative salary/capHit, missing season)               |
| **Contract Guarantee Invalid**                | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `salariesByYear[].guaranteed`, `guaranteedAmount` (contradictory values)           |
| **Contract Option Invalid**                   | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `salariesByYear[].option` (invalid enum value)                                     |
| **Free Agency State Invalid**                 | `capLegalityValidation.js:validateSigning`              | Pre-persist | **Hard Block** | `contract.freeAgency` (string format or invalid year type)                         |
| **Cap Hold Transition Invalid**               | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | Enforces correct cap hold creation/removal and freeAgency state on option decline  |
| **Option Accept Player Not Rostered**         | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedTeam.roster`, `playerId`                                                   |
| **Option Accept Option Row Invalid**          | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedPlayer.contract.salariesByYear` (option row + optionUsed)                  |
| **Option Decline Player Still Rostered**      | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedTeam.roster`, `playerId`                                                   |
| **Option Decline Contract Row Still Present** | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedPlayer.contract.salariesByYear` (declined season row)                      |
| **Option Decline Free Agency Year Mismatch**  | `capLegalityValidation.js:validateOptionDecision`       | Pre-persist | **Hard Block** | `updatedPlayer.contract.freeAgency.year`, derived option year                      |
| First Apron Warning                           | `capLegalityValidation.js:validateSigning`              | Pre-persist | Warning        | `projectedCapHit`, `capSettings.firstApron`                                        |
| Second Apron Warning                          | `capLegalityValidation.js:validateSigning`              | Pre-persist | Warning        | `projectedCapHit`, `capSettings.secondApron`                                       |
| Cap Hold Info                                 | `capLegalityValidation.js:validateRenounceRights`       | Pre-persist | Info           | `team.capHolds`                                                                    |
| **World Time Defaulted**                      | `mutationPipeline.js:validateMutation`                  | Pre-persist | Warning        | `dateDefaulted`                                                                    |
| **Offer Sheet Window Expired**                | `capLegalityValidation.js:validateOfferSheetResolution` | Pre-persist | Warning        | `asOfDate`, `offerSheet.createdAt` (48h window)                                    |
| **Stretch Timing Suspicious**                 | `capLegalityValidation.js:validateWaive`                | Pre-persist | Warning        | `asOfDate`, Season Start Date (stretch after start)                                |
| **Stretch Timing Unknown**                    | `capLegalityValidation.js:validateWaive`                | Pre-persist | Warning        | `asOfDate`, Season Code (missing start date)                                       |
| **Dead Cap Schema Invalid**                   | `mutationPipeline.js:validateMutation`                  | Pre-persist | **Hard Block** | `deadCap` array structure, amounts, season keys                                    |
| **Exceptions Schema Invalid**                 | `mutationPipeline.js:validateMutation`                  | Pre-persist | **Hard Block** | `exceptions` object structure, amounts, seasonKey, enabled boolean                 |
| **Exceptions Unknown Key**                    | `mutationPipeline.js:validateMutation`                  | Pre-persist | **Hard Block** | Unknown exception keys (only mle, tpmle, bae, room allowed)                        |

**Note:** Signing guardrails (max years, raises, first-year max) now use Salary Engine signing terms when available. Phase 2/2.5 exception tables remain the fallback when engine terms are unavailable.

#### 5.2.1 Canonical Cap Hold Multipliers (Single Source)

- Canonical multiplier table: `src/features/architect/utils/capHolds.ts` (`CAP_HOLD_MULTIPLIERS`)
- All cap hold computations must import this table (option decline expectations, cap hold creation, Bird rights references)
- Duplicate multiplier tables are not allowed; references must defer to `capHolds.ts`

#### 5.2.2 Option Transition Invariants (Phase 7.3)

**Option Accept (Pipeline-Authoritative):**

- No cap hold created for the player
- `optionUsed === true` on the option year row
- Player remains on the team roster (no roster removal)
- `salariesByYear` remains coherent (option row present for target year)

**Option Decline (Pipeline-Authoritative):**

- Cap hold created when expected and amount matches canonical multipliers (Phase 7.2)
- Player is not rostered as a signed player for the declined option year
- `freeAgency` is canonical object and year matches derived option year
- Option year row removed (no contract entry for declined season)

### 5.3 Hard Block vs Override Rules

**Hard Block Rules (NEVER overridable):**

- `roster_size` - >15 players
- `hard_cap` - Over hard cap ceiling
- `two_way_limit` - >3 two-way contracts
- `option_timing` - Wrong season for option
- `no_contract` - Extension without contract
- `exception_blocked` - Exception usage blocked by apron status
- `unverified_cap_inputs` - Cap data is unknown OR projected in STRICT mode
- `min_salary_violation` - First-year salary/capHit below CBA minimum for player's YOS
- `contract_years_invalid` - Contract length outside allowed min/max for signing mechanism
- `signing_terms_invalid` - Salary Engine max years exceeded for signing mechanism
- `signing_raise_invalid` - Salary Engine raise percentage exceeded for signing
- `first_year_max_invalid` - First-year salary exceeds mechanism max OR MINIMUM contract above min salary
- `signing_first_year_engine_max_invalid` - First-year salary/capHit exceeds Salary Engine max (Bird rights/cap space)
- `second_apron_minimum_only` - Teams above second apron can only sign to minimum salary
- `extension_ineligible` - Two-way contracts cannot be extended (must convert first)
- `extension_years_invalid` - Extension length outside 1-4 years (baseline; designated vet allows 5)
- `extension_first_year_max_invalid` - Extension first-year salary exceeds 120% baseline (Salary Engine overrides when available)
- `extension_raise_invalid` - Extension year-over-year raises exceed 8%
- `contract_row_schema_invalid` - Salary row has negative salary/capHit or missing season
- `contract_guarantee_invalid` - Guarantee fields contradictory (e.g., `guaranteedAmount` > `salary`)
- `contract_option_invalid` - Option field has invalid enum value (must be "Team Option", "Player Option", or null)
- `free_agency_state_invalid` - freeAgency is legacy string format or has invalid year type
- `cap_hold_transition_invalid` - Cap hold creation/removal contradicts option decision (reserved)
- `option_accept_player_not_rostered` - Accepted option but player is missing from roster
- `option_accept_option_row_invalid` - Accepted option but option row missing or not marked used
- `option_decline_player_still_rostered` - Declined option but player remains on roster
- `option_decline_contract_row_still_present_for_declined_season` - Declined option but contract still includes declined season
- `option_decline_free_agency_year_mismatch` - Declined option freeAgency.year mismatch
- `rfa_state_invalid` - RFA freeAgency.year is not a plausible integer (2020-2040)
- `rfa_missing_qualifying_offer` - RFA freeAgency.type but qualifyingOffer not finite > 0
- `rfa_offer_sheet_not_supported` - Phase 10: Signing RFA player from non-home team (offer sheet matching not implemented)
- `rfa_team_identity_unverifiable` - Phase 10: RFA signing where team identity cannot be verified
- `resigning_ineligible` - Re-signing player without team eligibility (no Bird rights)
- `rfa_offer_sheet_resolution_required` - Phase 12/13: Offer sheet in PENDING_MATCH when finalizing
- `rfa_offer_sheet_invalid_terms` - Phase 12: Offer sheet years/raises outside bounds
- `rfa_offer_sheet_declined` - Phase 13: Offer sheet in DECLINED state (dead)
- `rfa_offer_sheet_store_only_invalid` - Phase 14: Store-only flag used with invalid shape (missing rfaOfferSheet or MATCHED status)
- `rfa_offer_sheet_matched_offering_team_cannot_finalize` - Phase 17: Offering team cannot finalize a MATCHED offer sheet
- `rfa_offer_sheet_declined_home_team_cannot_finalize` - Phase 18.1: Home team cannot finalize a DECLINED offer sheet
- `cap_hold_signing_violation` - Phase 19: Cap-space signing exceeds salary cap when cap holds are included
- `dead_cap_schema_invalid` - Phase 24: Dead cap entry has invalid schema (missing season, invalid amount, etc.)
- `exceptions_schema_invalid` - Phase 27: Exception entry has invalid schema (non-object, negative amounts, usedAmount > totalAmount, etc.)
- `exceptions_unknown_key` - Phase 27: Unknown exception key provided (audit-grade: hard-block unknown keys)

**Soft Warning Rules (Overridable in dev mode via `VITE_ENABLE_CBA_OVERRIDE=true`):**

- `roster_minimum`, `dead_cap`, `first_apron`, `second_apron`
- `rfa_qualifying_offer_suspicious` - Phase 10: QO > 3x last year salary (may indicate data issue)
- `rfa_offer_sheet_store_only_flag_in_use` - Phase 14: Store-only mode is active for offer sheet (info)

### 5.4 Exception Blocking Rules (G0-2 Implementation)

**Location:** `capLegalityValidation.js:validateExceptionEligibility`

| Team Position                       | MLE (Non-Taxpayer) | Taxpayer MLE | BAE        | TPE        |
| ----------------------------------- | ------------------ | ------------ | ---------- | ---------- |
| Below First Apron                   | ✅ Allowed         | ✅ Allowed   | ✅ Allowed | ✅ Allowed |
| Above First Apron (not hard-capped) | ❌ BLOCKED         | ✅ Allowed   | ❌ BLOCKED | ✅ Allowed |
| Hard-Capped at First Apron          | ✅ Allowed\*       | ✅ Allowed   | ❌ BLOCKED | ✅ Allowed |
| Above Second Apron                  | ❌ BLOCKED         | ❌ BLOCKED   | ❌ BLOCKED | ❌ BLOCKED |

\* Team is already hard-capped if they used NTMLE previously.

---

## 6. Trade Machine Comparison

### 6.1 Validator Reuse Status

| Component                  | Shared with Cap Sheet? | Notes                               |
| -------------------------- | ---------------------- | ----------------------------------- |
| `tradeValidator.js`        | ✅ Yes (for trades)    | Trade-specific; imports by pipeline |
| `validateSalaryMatching`   | ❌ Trades only         | Cap Sheet uses different patterns   |
| `enforceRosterWindow`      | ❌ Trades only         | Roster validation separate          |
| `validateFaExceptionUsage` | ❌ Trades only         | Exception usage tracked differently |
| `capSettingsProvider.js`   | ✅ Yes                 | Shared cap/apron values             |
| `computeTeamCapTotals.js`  | ✅ Yes (SSOT)          | Single source of truth              |

### 6.2 Architecture Differences

| Aspect            | Trade Machine                                      | Cap Sheet                                        |
| ----------------- | -------------------------------------------------- | ------------------------------------------------ |
| Validation Engine | Full rules engine with 10+ validators              | 5 basic validators in `capLegalityValidation.js` |
| Rule Context      | Builds rich `TradeContext` with player-level rules | No rule context; basic team-level checks         |
| Salary Matching   | BYC, poison pill, trade kicker adjustments         | N/A (no salary matching for signings)            |
| Override Support  | `forceTrade` flag                                  | `overrideUsed` flag                              |

---

## 7. Gap Analysis (Ranked)

### 7.1 P0 — Can Produce Incorrect Cap Totals / Silent Illegal States

| Gap  | Description                                         | Impact                                                              | Status                  |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------- | ----------------------- |
| G0-1 | ~~No incomplete roster charge validation~~          | Teams at <14 players now have cap charge                            | ✅ RESOLVED             |
| G0-2 | ~~Exception usage not enforced post-hard-cap~~      | Exceptions now hard-blocked when prohibited                         | ✅ RESOLVED             |
| G0-3 | TPE expiration not automated                        | TPEs may appear available past 1-year window                        | ✅ Phase 1 Implemented  |
| G0-4 | ~~Min salary by YOS not enforced in pipeline~~      | Under-minimum contracts now hard-blocked                            | ✅ RESOLVED (Phase 1)   |
| G0-5 | ~~First-year max by mechanism not enforced~~        | Over-exception contracts now hard-blocked                           | ✅ RESOLVED (Phase 2.5) |
| G0-6 | ~~Second apron minimum-only not enforced~~          | Above-minimum signings at second apron now blocked                  | ✅ RESOLVED (Phase 2.5) |
| G0-7 | ~~Extension terms/raises not enforced in pipeline~~ | Illegal extensions now hard-blocked (years, first-year max, raises) | ✅ RESOLVED (Phase 3)   |

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
- Upon season advance, any TPEs expiring _before or on_ the new season start date (July 1st) must be removed.
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

| Gap  | Description                                    | Impact                                                      |
| ---- | ---------------------------------------------- | ----------------------------------------------------------- |
| G1-1 | Stretch provision legality not fully validated | Stretch timing rules (e.g., only before season) not checked |
| G1-2 | Bird rights eligibility UI hints incomplete    | May show signing options that aren't CBA-compliant          |
| G1-3 | No cap hold validation for FA signings         | Can sign FA even if cap hold + contract > cap space         |

### 7.3 P2 — Feature Missing / Polish

| Gap  | Description                                         | Impact                                    |
| ---- | --------------------------------------------------- | ----------------------------------------- | --------------------- |
| G2-1 | Manual dead money entry UI missing                  | Users cannot correct data errors          |
| G2-2 | Exception create/expire UI missing                  | Must rely on automated tracking           |
| G2-3 | Roster spot charges not displayed                   | Incomplete roster penalty not shown       |
| G2-4 | ~~Contract years min/max not enforced in pipeline~~ | Contract years now validated by mechanism | ✅ RESOLVED (Phase 2) |

---

## 8. File Map (Top 10)

| File                                                                    | Purpose                               |
| ----------------------------------------------------------------------- | ------------------------------------- |
| `src/features/architect/utils/mutationPipeline.js`                      | Canonical mutation pipeline           |
| `src/features/architect/utils/capLegalityValidation.js`                 | Non-trade validation rules            |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`       | UI action handlers                    |
| `src/features/architect/hooks/useCapSheetState.js`                      | Local session state                   |
| `src/features/architect/hooks/useCapValidation.js`                      | Real-time UI hints                    |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js`        | SSOT computation                      |
| `src/features/architect/capSheet/CapSheet/CapSheet.jsx`                 | Main Cap Sheet component              |
| `src/shared/components/EditContractModal.jsx`                           | Contract action modal                 |
| `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx` | Exception display                     |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`    | Trade validation (reference)          |
| `src/features/architect/utils/contractNormalization.js`                 | Contract schema normalization helpers |

---

## 9. Canonical Contract Schema (World)

**Status:** Phase 0 Complete (2026-01-17)

This section defines the canonical contract schema that all world mutation writers must produce. Phase 0 standardized field names and types to enable Phase 1+ CBA rule enforcement.

### 9.1 salariesByYear[] Entry (Per Year)

| Field              | Type              | Required | Notes                                                                          |
| ------------------ | ----------------- | -------- | ------------------------------------------------------------------------------ |
| `season`           | `string`          | Yes      | Format: `"YYYY-YY"` (e.g., `"2025-26"`)                                        |
| `salary`           | `number`          | Yes      | Base salary in dollars                                                         |
| `capHit`           | `number`          | Yes      | Defaults to `salary` if not specified                                          |
| `guaranteed`       | `boolean`         | Yes      | Whether year is guaranteed                                                     |
| `guaranteedAmount` | `number`          | No       | Partial guarantee amount                                                       |
| `option`           | `string \| null`  | No       | `"Team Option"`, `"Player Option"`, or `null`                                  |
| `optionUsed`       | `boolean \| null` | No       | **CANONICAL: boolean** (`true`=accepted, `false`=declined, `null`=no decision) |
| `tradeBonus`       | `number \| null`  | No       | Trade bonus amount                                                             |

**IMPORTANT:** `optionUsed` must be a boolean, NOT a string. Legacy values (`'accepted'`, `'declined'`, `'exercised'`) are normalized to boolean by `contractNormalization.js`.

### 9.2 Contract Metadata

| Field            | Type      | Required | Notes                                                                         |
| ---------------- | --------- | -------- | ----------------------------------------------------------------------------- |
| `startSeason`    | `string`  | Yes      | Format: `"YYYY-YY"`                                                           |
| `endSeason`      | `string`  | Yes      | Format: `"YYYY-YY"`                                                           |
| `contractLength` | `number`  | Yes      | Total years                                                                   |
| `yearsRemaining` | `number`  | Yes      | Years left on contract                                                        |
| `signingDate`    | `string`  | No       | **CANONICAL field name** (ISO format). NOT `signedAt` or `extensionSignedAt`. |
| `isExtension`    | `boolean` | No       | **CANONICAL field name**. NOT `extension`.                                    |
| `signingTeam`    | `string`  | No       | Team code that signed the player                                              |

### 9.3 freeAgency Object

| Field             | Type             | Required | Notes                                  |
| ----------------- | ---------------- | -------- | -------------------------------------- |
| `type`            | `string \| null` | No       | `"UFA"`, `"RFA"`, `"TO"`, `"PO"`, etc. |
| `year`            | `number`         | No       | End year (e.g., `2026`)                |
| `capHold`         | `number`         | No       | Cap hold amount                        |
| `qualifyingOffer` | `number \| null` | No       | QO amount for RFAs                     |

**IMPORTANT:** `freeAgency` must be an object, NOT a string. Legacy string values (e.g., `"2027 (UFA)"`) are normalized to object format by `contractNormalization.js`.

### 9.4 Normalization Helpers

**File:** `src/features/architect/utils/contractNormalization.js`

| Function                              | Purpose                                             |
| ------------------------------------- | --------------------------------------------------- |
| `normalizeContractForWorld(contract)` | Normalize full contract object                      |
| `normalizeSalaryRow(row)`             | Normalize single salariesByYear entry               |
| `normalizeFreeAgency(freeAgency)`     | Normalize freeAgency to object                      |
| `normalizeOptionUsed(value)`          | Convert string optionUsed to boolean                |
| `isOptionAccepted(value)`             | Check if option was accepted (handles both formats) |
| `isOptionDeclined(value)`             | Check if option was declined (handles both formats) |

### 9.5 Backward Compatibility

- **Read path:** Normalization helpers accept both legacy and canonical formats
- **Write path:** Mutation writers always produce canonical format
- **Existing Worlds:** Continue to work; new mutations produce clean data

---

## 9.6 Signing Terms Shape (Phase 6)

This section defines the canonical shape for signing terms used in validation.

### Canonical SigningTerms Type

```typescript
type SigningTerms = {
  source: 'salary_engine' | 'baseline';
  mechanism:
    | 'FULL_MLE'
    | 'TPMLE'
    | 'ROOM_MLE'
    | 'BAE'
    | 'MINIMUM'
    | 'UNKNOWN'
    | string;
  rightsType?:
    | 'FULL_BIRD'
    | 'EARLY_BIRD'
    | 'NON_BIRD'
    | 'CAP_SPACE'
    | 'NONE'
    | null;
  maxYears?: number | null;
  minYears?: number | null;
  raisePercentage?: number | null;
  maxFirstYearSalary?: number | null;
  minFirstYearSalary?: number | null;
  notes?: string;
};
```

### Field Definitions

| Field                | Type                              | Description                                                                                                 |
| -------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `source`             | `'salary_engine'` \| `'baseline'` | Origin of terms data (engine-computed vs fallback)                                                          |
| `mechanism`          | `string`                          | **Exception bucket** (e.g., `FULL_MLE`, `TPMLE`, `ROOM_MLE`, `BAE`, `MINIMUM`, `UNKNOWN`). NOT Bird rights. |
| `rightsType`         | `string` \| `null`                | **Bird rights type** (e.g., `FULL_BIRD`, `EARLY_BIRD`, `NON_BIRD`, `CAP_SPACE`, `NONE`). NOT exception.     |
| `maxYears`           | `number` \| `null`                | Maximum contract length                                                                                     |
| `minYears`           | `number` \| `null`                | Minimum contract length                                                                                     |
| `raisePercentage`    | `number` \| `null`                | Max year-over-year raise (e.g., `0.05` for 5%, `0.08` for 8%)                                               |
| `maxFirstYearSalary` | `number` \| `null`                | Maximum first-year salary                                                                                   |
| `notes`              | `string`                          | Additional context                                                                                          |

### Backward Compatibility

**Location:** `capLegalityValidation.js:normalizeSigningTerms()`

The `normalizeSigningTerms(rawTerms, options)` adapter:

- Accepts any legacy terms object
- If `mechanism` contains Bird rights keywords (e.g., "Full Bird"), moves value to `rightsType`
- Sets `mechanism` to `options.fallbackMechanism` or `'UNKNOWN'` when recovering
- Normalizes raw `rightsType` strings to canonical enum values

**Example:**

```javascript
// Legacy (pre-Phase 6)
const legacy = { mechanism: 'Full Bird', maxYears: 4 };

// Canonical (Phase 6)
const canonical = normalizeSigningTerms(legacy, {
  fallbackMechanism: 'FULL_MLE',
});
// => { mechanism: 'FULL_MLE', rightsType: 'FULL_BIRD', maxYears: 4, ... }
```

---

## 9.7 Cap Hold Amount Rules (Phase 7.2)

- **Rights-based multipliers:** FULL_BIRD = 190%, EARLY_BIRD = 130%, NON_BIRD = 120%.
- **Fallback:** CAP_SPACE/NONE/UNKNOWN uses the legacy 150% multiplier **with explicit warning** (`cap_hold_transition_inputs_missing`).
- **Rounding:** Expected amount uses `Math.round(lastSalary * multiplier)`; validation enforces ≤ $1 tolerance.
- **FA year derivation:** From option season string (`"YYYY-YY"` → start year). Example: `"2025-26"` → `2025`.

## 9.8 World Time SSOT (Phase 20)

Phase 20 introduces a canonical "world time" (`asOfDate`) field for timing-based CBA rules.

### Field Location

**World metadata:** `architect_worlds/{worldId}.asOfDate`

### Resolution Precedence

| Priority | Source                    | Example                                |
| -------- | ------------------------- | -------------------------------------- |
| 1        | `payload.asOfDate`        | Mutation provides explicit date        |
| 2        | World metadata `asOfDate` | Date stored on world document          |
| 3        | System fallback           | `new Date().toISOString().slice(0,10)` |

### Helper Function

**File:** `src/features/architect/utils/mutationPipeline.js`

```javascript
resolveWorldAsOfDate({ payloadAsOfDate, worldAsOfDate });
// Returns: { asOfDate: string, defaulted: boolean }
```

### Persistence Policy

- **Only update** world metadata `asOfDate` when payload explicitly includes it
- **Never overwrite** silently (prevents accidental time advancement)
- Mutations can reference a date without advancing world time

### Warning Rule

| Rule ID                | Type    | Trigger                                                |
| ---------------------- | ------- | ------------------------------------------------------ |
| `world_time_defaulted` | Warning | Neither payload nor world metadata provided `asOfDate` |

### Phase 21 Enablement

Phase 20 provides the infrastructure for Phase 21 to implement:

- `stretch_timing_invalid` - Stretch provision timing enforcement
- 48-hour offer sheet window enforcement
- Other timing-based CBA rules

---

## 9.92 Phase 21: Timing Warnings

Phase 21 introduces soft warning enforcement for timing-critical CBA rules using the `asOfDate` SSOT.

### Philosophy: Warnings vs Blocks

Given the complexity of retroactive data entry (e.g., entering a July transaction in October), timing rules are enforced as **WARNINGS ONLY**. This preserves user agency while creating awareness of potential CBA violations.

### 48-Hour Offer Sheet Window

- **Rule:** An offer sheet can only be matched within 48 hours of receipt.
- **Validator:** `rfa_offer_sheet_window_expired`
- **Logic:** `asOfDate > offerSheet.createdAt + 48 hours`
- **Trigger:** Attempting `matchOfferSheet` mutation.

### Stretch Provision Timing

- **Rule:** A waive-and-stretch is generally only allowed before the season starts (for full current season relief). Stretches after season start have complex pro-ration rules often distinct from simple cap relief.
- **Validator:** `stretch_timing_suspicious`
- **Logic:** `asOfDate > getSeasonStartDate(seasonCode)`
- **Trigger:** Attempting `waivePlayer` with `stretch: true`.

### Season Boundaries (Phase 21 MVP)

Hardcoded helper `getSeasonStartDate(seasonCode)` provides boundaries for `stretch_timing_suspicious`:

- 2024-25: 2024-10-22
- 2025-26: 2025-10-21 (Estimated)
- 2026-27: 2026-10-20 (Estimated)
- Unknown: 2026-10-?? (Returns null -> `stretch_timing_not_enforced_missing_season_boundary`)

---

## 10. Change Log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-16 | Initial creation with mutations inventory and validation map                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-17 | **Phase A P0:** Implemented G0-1 (incomplete roster charge) and G0-2 (post-apron exception blocking). Added `exception_blocked` to HARD_BLOCK_RULES. Updated validation map.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-17 | **Phase 1 P0:** Implemented G0-3 (TPE Expiration) Phase 1 Core Logic. Added `processTradeExceptions` to season transition.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-01-17 | **Phase 2 P0:** Completed TPE Phase 2. Canonicalized `expiresOn`. Backfill in season advance. UI Drift eliminated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-01-17 | **Contract Schema Phase 0:** Standardized contract schema for world mutations. Created `contractNormalization.js`. Updated `computeSigningResult`, `computeExtensionResult`, `computeOptionResult` to use canonical field names/types (`signingDate`, `isExtension`, boolean `optionUsed`). Updated consumers (`useCapSheetState`, `useArchitectActions`, `seasonManager`). Added 52 unit tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-17 | **Contract Rules Phase 1:** Implemented G0-4 (Minimum Salary Enforcement). Added `min_salary_violation` to HARD_BLOCK_RULES. `validateSigning` now rejects contracts where first-year salary/capHit is below CBA minimum for player's YOS. Two-way contracts excluded. 8 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-01-17 | **Contract Rules Phase 2:** Implemented G2-4 (Contract Years Enforcement). Added `contract_years_invalid` to HARD_BLOCK_RULES. `validateSigning` now validates contract length against mechanism-specific limits (MINIMUM: 1-2yr, FULL_MLE: 1-4yr, TPMLE/ROOM_MLE/BAE: 1-2yr). Added `resolveSigningMechanism()`, `getSigningYearsLimits()` helpers. Two-way contracts excluded. 9 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-01-17 | **Contract Rules Phase 2.5:** Implemented G0-5 (First-Year Max by Mechanism) and G0-6 (Second Apron Minimum-Only). Added `first_year_max_invalid` and `second_apron_minimum_only` to HARD_BLOCK_RULES. `validateSigning` now enforces exception amount caps (FULL_MLE/TPMLE/ROOM_MLE/BAE) and MINIMUM exactness. Teams above second apron blocked from above-minimum signings. Added `getSigningFirstYearMax()` helper. Fixed UI TPMLE maxYears (3→2). Two-way contracts excluded. 14 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-01-17 | **Phase 2.5 Patch:** Fixed second apron projected cap hit calculation to use `capHit` (not `salary`) when the two differ. Ensures incentive-laden or deferred contracts are correctly evaluated against second apron threshold. 1 new test added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-01-17 | **Contract Rules Phase 3:** Implemented G0-7 (Extension Terms/Raises Enforcement). Added `extension_ineligible`, `extension_years_invalid`, `extension_first_year_max_invalid`, `extension_raise_invalid` to HARD_BLOCK_RULES. `validateExtension` now blocks: (1) two-way contract extensions, (2) extensions > 4 years, (3) first-year exceeds baseline max, (4) raises > 8%. Added helper functions: `getContractLastYearSalary()`, `getExtensionFirstYearSalary()`, `getExtensionYears()`, `validateExtensionTermsAndRaises()`. Added `EXTENSION_YEARS_LIMITS`, `EXTENSION_FIRST_YEAR_MAX_PERCENT`, `EXTENSION_MAX_RAISE_PERCENT` constants. 8 new tests added.                                                                                                                                                                                                                                                                                                                 |
| 2026-01-17 | **Contract Rules Phase 3.25:** Fixed extension first-year max baseline (140%→120%). Wired Salary Engine `extensionTerms` into `validateExtension`. Engine-computed terms now override baseline for type-specific rules (rookie/designated vet/veteran). Added `getExtensionTermsForPlayer()` helper. Updated tests (constant check, 125% blocking test, engine override test).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-01-17 | **Contract Rules Phase 4:** Wired Salary Engine signing terms into `validateSigning` for max years + raise caps. Added `signing_terms_invalid` and `signing_raise_invalid` to HARD_BLOCK_RULES. Salary Engine max first-year is now enforced as an additional cap when available. Added signing terms helper + raise validation helper, updated tests, and documented pipeline authority for signing guardrails.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-18 | **Contract Rules Phase 4.5:** Added distinct `signing_first_year_engine_max_invalid` rule for engine-derived first-year max violations. Separates Bird rights/cap space enforcement from fallback exception cap enforcement (`first_year_max_invalid`). Includes rights info in violation messages. 6 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-01-18 | **Contract Rules Phase 5:** Added contract row schema validation. 3 new HARD_BLOCK rules: `contract_row_schema_invalid` (negative salary/capHit, missing season), `contract_guarantee_invalid` (guaranteedAmount > salary, guaranteed=false + positive amount), `contract_option_invalid` (invalid option enum). Added `validateContractRows()` aggregator wired into `validateSigning`. Policy: normalize `optionUsed` to null when option is null; hard-block other violations. 14 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-01-18 | **Contract Rules Phase 6:** Separated `mechanism` (exception bucket) from `rightsType` (Bird rights type). Added canonical `SigningTerms` shape documentation. Created `normalizeSigningTerms()` backward-compat adapter. Updated `buildBaseSigningTerms()` and `buildExceptionSigningTerms()` to use proper field separation. Violation payloads now include both `mechanism` and `rightsType`. Re-signing (Bird rights) is now pipeline-authoritative. 13 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-18 | **Contract Rules Phase 7:** Added canonical freeAgency state validation. 2 new HARD_BLOCK rules: `free_agency_state_invalid` (blocks legacy string format, invalid year type), `cap_hold_transition_invalid` (reserved for option accept/decline contradictions). Created `validateFreeAgencyState()` in `contractNormalization.js`. Wired into `validateSigning()`. Warns on RFA missing QO and UFA with QO set. 10 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-01-18 | **Contract Rules Phase 7.1:** Enforced `cap_hold_transition_invalid`. `validateOptionDecision` now blocks option accept if cap hold created, and decline if missing hold. Created `capHoldTransitionHelpers.js`. Adopted simplified 150% cap hold model (superseded by Phase 7.2). Fixed `freeAgentYear` bug in pipeline. 5 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-18 | **Contract Rules Phase 7.2:** Added rights-based cap hold amounts (190/130/120), fallback warnings for missing rightsType, and season-derived FA year on option decline. Updated validation + option mutation paths. Added new tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-01-18 | **Contract Rules Phase 7.3:** Enforced option accept/decline state invariants (roster presence, option row coherence, declined season removal) and hard-blocked freeAgency year mismatch. Declared `capHolds.ts` as the canonical multiplier source and wired remaining references. Added new tests for invariants + canonical source usage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-01-18 | **Contract Rules Phase 8:** RFA/QO Correctness + Re-Signing (Bird Rights) Guardrails. Upgraded RFA missing QO from warning to hard-block (`rfa_missing_qualifying_offer`). Added year plausibility check for RFA/UFA (`rfa_state_invalid`). Blocked signing RFA players (`rfa_signing_not_supported`) until offer sheet matching is implemented. Added re-signing eligibility check (`resigning_ineligible`) that verifies player.teamId matches team and birdRights.status is valid. 13 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-01-18 | **Contract Rules Phase 9:** Eligibility ID Correctness + FA Plausibility Centralization. (1) Added `normalizeTeamRef()` and `normalizePlayerTeamRef()` helpers to handle format mismatches (e.g., "NBA:LAL" vs "LAL"). Re-signing eligibility now uses canonical normalization to avoid false-blocks. (2) Added `resigning_eligibility_unverifiable` warning rule for cases where team identity cannot be verified. (3) Centralized FA year plausibility policy via `isPlausibleFreeAgencyYear(year, contextYear)` replacing hardcoded 2020-2040 range. Policy: [contextYear - 5, contextYear + 10]. (4) Added explicit `rightsRenounced === true` check for ineligibility. 9 new tests added.                                                                                                                                                                                                                                                                                      |
| 2026-01-18 | **Contract Rules Phase 10:** RFA Workflow Guardrails (Home-Team vs Offer Sheet). Replaced blunt `rfa_signing_not_supported` block with differentiated logic: (1) `rfa_offer_sheet_not_supported` hard-blocks non-home team RFA signings (offer sheet matching required). (2) `rfa_team_identity_unverifiable` hard-blocks when team identity cannot be normalized. (3) Home-team RFA signings allowed through normal validation (QO still enforced). Added `rfa_qualifying_offer_suspicious` warning when QO > 3x last salary. Uses Phase 9 team normalizers for identity comparison. 15 new tests added.                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-01-18 | **Contract Rules Phase 11:** Year Coverage & Rookie Scale Enforcement. (1) Eliminated silent fallback to 2024-25 cap settings. Defined `REAL` (authoritative) vs `PROJECTED` (explicit warning) year policies. `getCapSettings()` now warns on projected years and hard-blocks invalid inputs (`invalid_year_input_fallback`). (2) Created canonical Rookie Scale table source (`rookieScale.ts`). (3) Added `rookie_scale_invalid` hard-block rule enforcing 80%-120% salary band for first-round picks (1-30). Only processes when pick metadata is present and authoritative scale data exists. 10 new tests added.                                                                                                                                                                                                                                                                                                                                                              |
| 2026-01-19 | **Contract Rules Phase 12:** RFA Offer Sheet Matching (Stub). (1) Replaced blanket `rfa_offer_sheet_not_supported` block with differentiated logic: offer sheets allowed if `contract.rfaOfferSheet === true`. (2) Added `rfa_offer_sheet_resolution_required` hard-block for PENDING_MATCH attempts (no resolution). (3) Added `rfa_offer_sheet_invalid_terms` hard-block for years/raises outside bounds (1-4 years, ≤8% raises). (4) Added `rfa_offer_sheet_stub_active` warning for UI awareness. (5) Created `validateOfferSheetTerms()` helper. (6) Phase 11 hygiene fixes applied. 14 new tests added.                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-01-19 | **Contract Rules Phase 13:** Offer Sheet Pending State + Finalization Gate. (1) Added `isFinalizingSigning()` helper for finalization detection via `contract.rfaOfferSheetOnly` flag. (2) Modified `rfa_offer_sheet_resolution_required` to only block when finalizing AND status !== MATCHED. (3) PENDING_MATCH now allowed when `rfaOfferSheetOnly === true` (storing only). (4) Added `rfa_offer_sheet_declined` hard-block for DECLINED status. (5) Updated stub warning with status/finalizing info. 13 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-01-19 | **Contract Rules Phase 14:** Offer Sheet Store-Only Invariants. (1) Added `rfa_offer_sheet_store_only_invalid` hard-block for invalid store-only configurations (missing `rfaOfferSheet` or MATCHED status). (2) Added `rfa_offer_sheet_store_only_flag_in_use` warning when store-only mode is active. (3) Created `validateStoreOnlyInvariants()` helper. (4) Store-only invariants checked before offer sheet validation to catch misuse. 16 new tests added.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-19 | **Contract Rules Phase 15 (Preflight):** Offer Sheet Persistence + Workflow Design. Designed persistence model for RFA offer sheets. Decision: store as `offerSheets[]` array on team overlay (`architect_worlds/{worldId}/teams/{teamCode}`). Defined canonical `OfferSheet` schema with required fields (`id`, `playerId`, `offeringTeamCode`, `homeTeamCode`, `status`, `salariesByYear`). Mapped workflow actions: Store (new `storeOfferSheet` mutation), Match/Decline (home team actions), Finalize (reuse `signFreeAgent` with MATCHED status). Identified UI surfaces: FreeAgencySection, FreeAgentPool, EditContractModal. Created Phase 16 execution checklist. No code changes (preflight only).                                                                                                                                                                                                                                                                        |
| 2026-01-19 | **Contract Rules Phase 18:** Audit-Grade Return Package + End-to-End Invariants. (1) Verified all offer sheet mutations (store/match/decline/finalizeMatched) use atomic Firestore batch writes. (2) Confirmed canonical storage paths: offering team `offerSheets[]`, home team `incomingOfferSheets[]`. (3) Validated mirroring and deduplication logic in compute functions. (4) Confirmed authority rules via `validateOfferSheetResolution()` with HARD_BLOCK rules. (5) All tests pass (6/6 offerSheetResolution, 204/204 capLegalityValidation). Build succeeds.                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-01-20 | **Contract Rules Phase 18.1:** Offer Sheet Audit-Grade Patch. (1) Added deterministic `dedupKey` for idempotency (`os:{worldId}:{offeringTeamCode}:{playerId}:{seasonKey}`). Dedup now checks both `id` and `dedupKey`. (2) Fixed DECLINED rule scope: added `rfa_offer_sheet_declined_home_team_cannot_finalize` to block home team. Offering team remains allowed. (3) Added `finalizeDeclinedOfferSheet` mutation with explicit cleanup (removes from both teams' arrays, signs player to offering team). (4) 19 new tests added. Build succeeds.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-01-20 | **Contract Rules Phase 18.2:** Offer Sheet Audit-Grade Lock. (1) Idempotency proof tests now execute `computeStoreOfferSheetResult` twice and verify no duplicate entries (store twice with different ID → 1 entry, store twice with no ID → 1 entry). (2) `worldId` now required for `storeOfferSheet` - missing worldId fails fast with error. (3) `computeFinalizeDeclinedOfferSheetResult` cleanup now removes by `id` OR `dedupKey`, fixing mirrored array divergence. (4) UI wiring: DECLINED finalization now calls `finalizeDeclinedOfferSheet` mutation instead of `signFreeAgent`, with `dedupKey` in payload. 13 new tests added. Build succeeds.                                                                                                                                                                                                                                                                                                                        |
| 2026-01-20 | **Contract Rules Phase 19:** Cap Hold / Cap Space Enforcement. (1) Added `cap_hold_signing_violation` HARD_BLOCK rule to prevent cap-space signings that exceed salary cap when cap holds are included. (2) Added `isCapSpaceSigning()` helper to detect signings without exception or Bird rights. (3) Cap hold replacement logic: re-signings replace player's existing cap hold. (4) Added `cap_hold_renounce_required` warning when specific holds block signing. (5) **DEFERRED:** `stretch_timing_invalid` - no canonical world date/season phase exists (stop condition). (6) 22 new tests added. Build succeeds.                                                                                                                                                                                                                                                                                                                                                            |
| 2026-01-20 | **Contract Rules Phase 20:** World Time SSOT. (1) Added `resolveWorldAsOfDate()` helper as single source of truth for world time. Resolution priority: payload `asOfDate` → world metadata `asOfDate` → system fallback. (2) Threaded `asOfDate` through mutation pipeline: `applyWorldMutation` → `computeWorldMutation` → `validateMutation` → `persistWorldMutation`. (3) Added `world_time_defaulted` warning rule (emitted when date is defaulted). (4) Persist policy: only write `asOfDate` to world metadata when payload explicitly includes it (no silent overwrites). (5) 14 new tests added. Build succeeds.                                                                                                                                                                                                                                                                                                                                                            |
| 2026-01-20 | **Contract Rules Phase 21:** Timing Warnings. (1) Added World Time Controls to GMDashboard (`WorldTimeControls.jsx`). (2) Implemented `offer_sheet_window_expired` warning: warns if matching >48 hours after creation relative to `asOfDate`. (3) Implemented `stretch_timing_suspicious` warning: warns if stretching after season start date relative to `asOfDate`. (4) Added `getSeasonStartDate` helper with MVP boundaries. (5) 10 new tests demonstrating warnings (non-blocking).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-01-22 | **Contract Rules Phase 23:** Sign & Trade Execution. (1) Implemented compound mutation `signAndTrade` in `mutationPipeline.js`. (2) Atomic persistence: single validation and write operation ensures both signing and trade succeed or fail together. (3) Validation: orchestrates `validateSigning` (for contract legality) followed by `validateTrade` (for trade rules). (4) Updates `EditContractModal` to support destination team selection. (5) Verified atomic updates: player moves to destination roster with new contract, source team gets no player but loses rights cleanly.                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-01-22 | **Contract Rules Phase 24:** Manual Dead Money Management. (1) Implemented `ManageDeadMoneyModal` for full CRUD on dead cap entries. (2) Created `setDeadCap` mutation for atomic array replacement. (3) Added `dead_cap_schema_invalid` validation rule to enforce canonical schema (seasonKey, positive amount). (4) Wired UI entry point in Cap Sheet footer. (5) Verified persistence and validation via new test suite `deadCapManagement.test.js` (5 tests).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-01-22 | **Contract Rules Phase 25:** Incomplete Roster Charge Visibility. (1) Added Cap Breakdown section to CapSheet footer with itemized display of: Player Salaries, Dead Money (when > 0), Cap Holds (when > 0), and Incomplete Roster Charge (when > 0). (2) Incomplete Roster Charge row shows amount and "(N open slots)" annotation from SSOT `_meta.incompleteRosterCharge`. (3) All breakdown values derived from `computeTeamCapTotals()` output (no re-computation). (4) Row conditionally hidden when charge is 0 to keep UI clean. (5) Added `rosterChargeDisplay.test.jsx` with 7 tests (RC1-RC6). Completes Group 1 cap sheet usability.                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-22 | **Contract Rules Phase 26:** Sign-and-Trade Legality Audit. (1) Fixed build-blocking parse errors in `mutationPipeline.js` (duplicate import + duplicate try/catch). (2) Audited S&T workflow: UI → EditContractModal → handleSignAndTrade → applyWorldMutation(signAndTrade) → validateSigning + validateTrade → persistWorldMutation. (3) Confirmed MVP constraints enforced: A) Signing validated first via validateSigning() B) Trade validated second via validateTrade() C) Atomic operation - both teams updated or neither D) Missing source/dest/player blocked at load phase. (4) Verified S&T-specific trade rules in `validateSignAndTrade.js`: 3-4 year minimum, first year guaranteed, hard cap trigger at first apron, taxpayer MLE restriction, offseason-only. (5) Extended test suite from 2 → 20 tests (SAT1-SAT15). (6) Documented constraints checklist: A-D enforced, BYC handled by trade validator's computeMatchingValues(), hard cap trigger implemented. |
| 2026-01-26 | **Phase 35 (Execution):** Second Apron SSOT + Emitter Consolidation. (1) Verified deletion of unused files (validateSecondApronRules.js, aggregationValidator.js, salaryMatching.js). (2) Confirmed strict `>` semantics for second apron classification in SSOT (`salaryMatchingRules.js`). (3) Verified consolidation of "Second apron team cannot receive more salary than sent" emitter to `validateSalaryMatching`. (4) All tests passed (14 validator, 5 boundary, 4 handcuffs). Build passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-01-26 | **Phase 36 (Execution):** Second Apron SSOT Guardrails. (1) Refactored 7 key validator files (`basicRules.js`, `hardCapValidation.js`, `validateAggregation.js`, `validateSalaryMatching.js`, `validateStepien.js`, `validateTradeExceptions.js`, `salaryMargin.js`) to use `isSecondApronTeam` SSOT helper from `capUtils.js`. (2) Cleaned up zombie references in `TRADE_MACHINE_AUDIT.md`. (3) Added `secondApron_SSOT_guardrail.test.js` ensuring strict `>` semantics and integration rule compliance. (4) Hardened `isSecondApronTeam` helper to robustly handle wrapped team objects. All 4 guardrail tests passed.                                                                                                                                                                                                                                                                                                                                                          |
| 2026-01-28 | **Phase 45 Docs Hygiene Sweep (EXECUTION):** Unified return package directory structure. Moved 36 files from `docs/architect/return-packages/` to `docs/architect/return_packages/`. Archived duplicate `Phase_35_Return_Package.md` to `_archive/` subfolder. Updated 18 internal path references. Zero `return-packages` references remain. Return package: `docs/architect/return_packages/PHASE_45_DOCS_HYGIENE_SWEEP_EXECUTION_RETURN_PACKAGE.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## 9.8 Team Identity for Re-Signing Eligibility (Phase 9)

Re-signing eligibility requires verifying that the player "belongs" to the signing team. Due to format inconsistencies across data sources, team identity is normalized before comparison.

### Normalization Helpers

**File:** `src/features/architect/utils/contractNormalization.js`

| Function                         | Purpose                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `normalizeTeamRef(teamOrCode)`   | Normalizes team object or string to canonical uppercase code (e.g., "NBA:LAL" → "LAL")                    |
| `normalizePlayerTeamRef(player)` | Extracts and normalizes player's team ref from `teamId`, `team_id`, `teamCode`, or `contract.signingTeam` |

### Format Handling

- Prefixed formats: `"NBA:LAL"` → `"LAL"`
- Case normalization: `"lal"` → `"LAL"`
- Object extraction: `{ teamCode: "LAL" }` → `"LAL"`

### Verification Policy

- If both sides normalize → compare for exact match
- If either side cannot normalize → produce `resigning_eligibility_unverifiable` warning (NOT hard-block)
- Explicit `rightsRenounced === true` → always ineligible (hard-block)

---

## 9.9 Free Agency Year Plausibility Policy (Phase 9)

FA year plausibility is enforced using a centralized policy function instead of hardcoded ranges.

### Policy Function

**File:** `src/features/architect/utils/contractNormalization.js`

```javascript
isPlausibleFreeAgencyYear(year, (contextYear = 2026));
// Returns: { plausible: boolean, minYear: number, maxYear: number }
```

### Range Calculation

- **minYear** = contextYear - 5 (e.g., 2026 → 2021)
- **maxYear** = contextYear + 10 (e.g., 2026 → 2036)

### Context Year Sources (Priority Order)

1. `context.year` passed to validator
2. `context.contextYear` passed to validator
3. `DEFAULT_CONTEXT_YEAR` constant (2026)

### Violation Payload

When year is implausible, the violation includes:

- `contextYear` - the reference year used
- `minYear` - computed minimum
- `maxYear` - computed maximum

---

## 9.10 Rookie Scale Enforcement (Phase 11)

Rookie Scale contracts are strictly regulated by the CBA (Article VIII).

### Canonical Data Source

**File:** `src/features/architect/data/rookieScale.ts`

- Contains 100% Scale amounts for known seasons (e.g., 2024-25).
- Amounts derived from authoritative sources (CBA / RealGM).
- **Policy:** Only enforce for seasons where we have explicit scale data.

### Validation Rule (`rookie_scale_invalid`)

- **Scope:** First Round Picks (1-30).
- **Band:** Salary must be between **80% and 120%** of the 100% scale amount.
- **Tolerance:** $1 tolerance for rounding differences.
- **Cap Usage:** First-year salary is used. If Cap Hit differs significantly (rare), it is also checked.
- **Trigger:** Contract or Player object contains valid `draftPick` metadata (`{ pick: number, year: number }`).

---

## 9.11 Year Coverage Policy (Phase 11)

To prevent silent errors, year-based cap settings lookups must be explicit about data confidence.

### Classification

1. **REAL:** Authoritative data exists (e.g., 2024-25 confirmed cap). use `isRealSeason(year)`.
2. **PROJECTED:** Valid future year, but data is estimated. `getCapSettings` returns explicit warning.
3. **INVALID:** Null, undefined, or malformed year input.

### Behavior Changes

- **Legacy:** Silently fell back to 2024-25 settings for any unknown year.
- **New (Phase 11):**
  - **Valid Future Year:** Returns settings with `source: 'projected'` and warning. (Does NOT silently use 2024 constants without flagging).
  - **Invalid Input:** Returns emergency fallback settings with `source: 'invalid_year_input_fallback'` and CRITICAL warning.
  - **Strict Mode:** Throws error on invalid/missing input.

---

## 9.12 RFA Offer Sheet Schema (Phase 12)

Phase 12 introduces a minimally-correct RFA offer sheet matching stub.

### Contract Fields

| Field                 | Type                                         | Description                            |
| --------------------- | -------------------------------------------- | -------------------------------------- |
| `rfaOfferSheet`       | `boolean`                                    | Signals this is an offer sheet attempt |
| `rfaOfferSheetStatus` | `'PENDING_MATCH' \| 'MATCHED' \| 'DECLINED'` | Resolution state                       |

### Status Values

- **PENDING_MATCH:** Default after offer sheet creation. Hard-blocked from finalization.
- **MATCHED:** Home team has matched. Signing proceeds normally (future: player stays with home team).
- **DECLINED:** Home team declined. (Future: player signs with offering team).

### Validation Rules

| Rule ID                               | Type       | Trigger                                                    |
| ------------------------------------- | ---------- | ---------------------------------------------------------- |
| `rfa_offer_sheet_not_supported`       | HARD_BLOCK | Non-home team RFA signing without `rfaOfferSheet === true` |
| `rfa_offer_sheet_resolution_required` | HARD_BLOCK | Offer sheet in PENDING_MATCH state (no resolution)         |
| `rfa_offer_sheet_invalid_terms`       | HARD_BLOCK | Years outside 1-4 OR raises exceed 8%                      |
| `rfa_offer_sheet_stub_active`         | WARNING    | Any processed offer sheet (UI informational)               |

### Term Bounds

- **Years:** 1-4 (per CBA offer sheet rules)
- **Raises:** ≤ 8% year-over-year

### Phase 12 Stub Behavior

Only `PENDING_MATCH` is naturally produced. Attempts to finalize without explicit `MATCHED` status trigger `rfa_offer_sheet_resolution_required`. Full match/decline workflow is NOT implemented in Phase 12.

### Phase 13 Finalization Gate (Updated)

Phase 13 introduces the distinction between "storing" an offer sheet and "finalizing" it:

| Action     | rfaOfferSheetOnly | Status          | Result                                   |
| ---------- | ----------------- | --------------- | ---------------------------------------- |
| Store only | `true`            | `PENDING_MATCH` | ✅ Allowed                               |
| Finalize   | `false`/missing   | `PENDING_MATCH` | ❌ `rfa_offer_sheet_resolution_required` |
| Any        | any               | `DECLINED`      | ❌ `rfa_offer_sheet_declined`            |
| Finalize   | any               | `MATCHED`       | ✅ Allowed                               |

**Finalization Detection:**

- Default: `signFreeAgent` mutation is a finalizing action (adds player to roster)
- Opt-out: `contract.rfaOfferSheetOnly === true` signals non-finalizing intent

**Helper:** `isFinalizingSigning({ contract })` - Returns `true` if finalizing, `false` if storing only.

### Phase 14 Store-Only Invariants (Updated)

Phase 14 hardens store-only mode to prevent misuse:

**Store-Only Invariants:**

When `rfaOfferSheetOnly === true`, the following must hold:

| Invariant | Requirement                                 | Violation Rule                       |
| --------- | ------------------------------------------- | ------------------------------------ |
| A         | `rfaOfferSheet === true`                    | `rfa_offer_sheet_store_only_invalid` |
| B         | Status must be `PENDING_MATCH` (or missing) | `rfa_offer_sheet_store_only_invalid` |
| C         | Status cannot be `MATCHED`                  | `rfa_offer_sheet_store_only_invalid` |

**Rationale:** MATCHED status indicates the finalization path—home team matched the offer. Using store-only mode with MATCHED is contradictory.

**Helper:** `validateStoreOnlyInvariants({ contract })` - Returns `{ valid, violations }`.

## Phase 16: Offer Sheet Persistence & Workflow

Phase 16 implements the MVP workflows for store-only RFA offer sheets.

### Offer Sheet Lifecycle

1. **Creation (Store-Only):**
   - **Mutation:** `storeOfferSheet`
   - **Trigger:** Offering team "signs" RFA with "Offer Sheet" intent.
   - **Effects:**
     - Creates `OfferSheet` object.
     - Persisted to Offering Team's `offerSheets` array.
     - Mirrored to Home Team's `incomingOfferSheets` array (for visibility).
   - **Validation:** Must pass `validateStoreOnlyInvariants` and `validateOfferSheetTerms`.

2. **Resolution (Home Team):**
   - **Mutations:** `matchOfferSheet` or `declineOfferSheet`.
   - **Trigger:** Home team reviews Incoming Offer Sheet.
   - **Effects:**
     - Updates status to `MATCHED` or `DECLINED` on both teams (via cleanup/mirroring update).

3. **Finalization (Offering Team):**
   - **Mutation:** `signFreeAgent` (via `handleFinalizeOfferSheet`).
   - **Trigger:** Offering team finalizes a `DECLINED` offer sheet.
   - **Effects:**
     - Executes signing logic (adds to roster, removes cap hold on home team).
     - **Constraint:** Can only finalize if `DECLINED` (or if system allows un-matched hostile signing).
     - **Constraint:** Attempts to finalize `MATCHED` offer sheets will stick with Home Team (logic TBD in future phases, currently blocked or results in home team retention).

### Logic Updates (Phase 16)

- **Mirroring:** Offer sheets are now dual-written (to offering team and home team overlay) to ensure immediate visibility without waiting for parent world propagation.
- **Declined Offers:** Policy update allows `DECLINED` status to pass `rfa_offer_sheet_declined` rule IF `isFinalizingSigning()` is true (acquisition by offering team).

## Phase 17: Offer Sheet Resolution Logic (Updated)

Phase 17 standardizes the workflow for resolving `MATCHED` and `DECLINED` offer sheets, enforcing strict separation of powers between the Home Team and the Offering Team.

### Resolution Invariants

| Status          | Actor     | Action        | Valid? | Logic                                                            |
| --------------- | --------- | ------------- | ------ | ---------------------------------------------------------------- |
| `PENDING_MATCH` | Home      | Match/Decline | ✅     | `matchOfferSheet` / `declineOfferSheet`                          |
| `PENDING_MATCH` | Any       | Finalize      | ❌     | Violated `rfa_offer_sheet_resolution_required`                   |
| `MATCHED`       | Home      | Finalize      | ✅     | `finalizeMatchedOfferSheet`                                      |
| `MATCHED`       | Offeering | Finalize      | ❌     | Violated `rfa_offer_sheet_matched_offering_team_cannot_finalize` |
| `DECLINED`      | Offfering | Finalize      | ✅     | `signFreeAgent` (Acquisition)                                    |

### New Rules (Phase 17)

| Rule ID                                                 | Type       | Trigger                                                  | Description                  |
| ------------------------------------------------------- | ---------- | -------------------------------------------------------- | ---------------------------- |
| `rfa_offer_sheet_matched_offering_team_cannot_finalize` | HARD_BLOCK | Offering team attempts cleanup/finalize on MATCHED offer | Player stays with home team. |
