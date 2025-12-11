# Architect Timing Model Plan

## PLAN_INTENT

Design and implement a season-first timing model for the Architect feature (Cap Manager, GM tools, Trade Machine) that eliminates timing-related bugs where operations use wrong season's cap numbers, missing prior salary defaults to zero, or extension/UFA rules are confused.

**Goal**: Every cap/contract rule receives a standardized `RuleContext` object with explicit `operationSeasonId`, `referenceSeasonId`, and `capSeasonId` values—no more implicit derivation from global state or JS `Date.now()`.

## SCOPE

### In Scope
- Define canonical `SeasonId` type and helper API
- Design `RuleContext` shape for all cap/contract operations
- Plan `buildRuleContext` builder function implementation
- Identify all files that need timing model updates
- Phased refactoring plan

### Out of Scope
- Firestore schema changes
- UI redesign (only internal data flow changes)
- New features (focus on fixing existing timing bugs)

## IMPLEMENTATION_SCOPE

**Planning Only** — This document is the deliverable. Implementation will follow in a subsequent task.

---

## 1. CURRENT STATE MAP

### 1.1 Season Representation Locations

| File | Type/Enum/Helper | Format | Notes |
|------|------------------|--------|-------|
| `src/features/architect/utils/seasonFormat.js` | `toSeasonCode`, `toEndYear`, `parseSeason` | `"YYYY-YY"` ↔ `number` | **Canonical helpers** for season codes |
| `src/features/architect/utils/seasonUtils.js` | `toSeasonKey`, `parseSeasonEndYear`, `getDefaultSeasonEndYear` | `"YYYY-YY"` ↔ `number` | Duplicates seasonFormat; uses end-year convention |
| `src/features/architect/utils/tradeMachine/utils/seasonUtils.js` | `seasonToYear`, `yearToSeason`, `normalizeYearInput` | `"YYYY-YY"` ↔ `number` | Trade-specific; imports from shared `seasonNormalizer` |
| `src/shared/utils/contracts/seasonNormalizer.js` | `normalizeSeason`, `seasonStartYear`, `compareSeason` | `"YYYY-YY"` | Uses **start-year** convention (not end-year) |
| `src/features/architect/utils/capProjections.js` | keyed object | `"YYYY-YY"` keys | E.g., `"2024-25": { cap: 141000000, ... }` |
| `src/features/architect/utils/cbaConstants.js` | `CBA_BY_YEAR` | `number` keys (`2025`) | Uses **end-year** convention; inconsistent with capProjections |
| `src/features/architect/utils/tradeMachine/constants/cbaConstants.js` | `CBA_THRESHOLDS` | `"YYYY-YY"` keys | E.g., `"2024-25": { SALARY_CAP: 140588000 }` |

### 1.2 Where `currentSeason`, `currentYear`, or Hard-coded Defaults Are Used

| File | Pattern | Issue |
|------|---------|-------|
| `playerRulesProfile/types.js` | `LeagueContext.currentSeason` / `currentYear` | Well-defined, but callers must construct it |
| `playerRulesProfile/computeProfile.js` | `getCurrentSeasonYear(date)` derives from JS Date | Good fallback, but dangerous in simulation mode |
| `playerRulesProfile/minimumSalaryRules.js` | `|| '2024-25'` fallback | **Hard-coded default** if leagueContext missing |
| `playerRulesProfile/rfaRules.js` | `|| '2024-25'` fallback | **Hard-coded default** |
| `playerRulesProfile/maxSalaryRules.js` | `|| 140_588_000` (2024-25 cap) | **Hard-coded salary cap fallback** |
| `tradeMachine/rules/validateSignAndTrade.js` | `tradeCtx.currentYear` or `2025` fallback | **Hard-coded 2025 fallback** |
| `tradeMachine/rules/miscRules.js` | `currentYear = 2025` default | **Hard-coded default** |
| `seasonManager.js` | `worldMeta.currentSeason` or `'2025-26'` fallback | **Hard-coded fallback for world metadata** |
| `hooks/usePlayerRulesProfiles.js` | Derives `leagueContext.currentYear` from props | Good pattern—uses `buildLeagueContext()` |
| `GMDashboard.jsx` | `getDefaultSeasonEndYear()` | Derives from JS Date; could drift in simulation |

### 1.3 Worst Timing Smells (Prioritized)

1. **`minimumSalaryRules.js` line 91**: Falls back to `'2024-25'` if `leagueContext.currentSeason` is missing—creates silent wrong-year calculations.

2. **`maxSalaryRules.js` line 55**: Hard-coded `140_588_000` cap fallback (2024-25)—wrong max salary for 2025-26+.

3. **`validateSignAndTrade.js` line 91**: Constructs season key from `tradeCtx.currentYear || 2025`—silent fallback to 2025.

4. **`miscRules.js` line 22**: `currentYear = 2025` default parameter—will be wrong once we're in 2025-26 season.

5. **`seasonNormalizer.js` vs `seasonUtils.js`**: Uses `seasonStartYear()` (returns start year), while most Architect code expects end-year. Inconsistent convention causes off-by-one-year bugs.

6. **Multiple toSeasonKey implementations**: `seasonFormat.js`, `seasonUtils.js`, and `tradeMachine/utils/capUtils.js` all implement the same helper differently.

7. **105%/140% extension logic in `extensionRules.js`**: Gets `currentSalary` from `getCurrentSalary(contract, currentYear)` which falls back to first available salary if current not found—could use wrong salary for Bird math.

8. **`getLastSalary()` in `contractUtils.js`**: Always returns most recent salary regardless of which season we're evaluating—should accept `referenceSeasonId`.

---

## 2. SEASON MODEL DESIGN

### 2.1 Canonical `SeasonId` Type

```typescript
/**
 * Canonical season identifier in "YYYY-YY" format.
 * Examples: "2024-25", "2025-26", "2026-27"
 * 
 * Convention:
 * - The first four digits are the START year of the NBA season
 * - The last two digits are the END year
 * - E.g., "2024-25" is the season that starts October 2024 and ends June 2025
 */
type SeasonId = `${number}-${number}`;
```

### 2.2 Minimal Helper API

All season helpers should be consolidated into **one canonical file**: `src/features/architect/utils/seasonHelpers.ts` (new TypeScript file).

```typescript
// src/features/architect/utils/seasonHelpers.ts

/**
 * Parse a SeasonId into its component years
 * @param seasonId - e.g., "2024-25"
 * @returns { startYear: 2024, endYear: 2025 }
 */
export function parseSeasonId(seasonId: SeasonId): { startYear: number; endYear: number };

/**
 * Create a SeasonId from the season's start year
 * @param startYear - e.g., 2024
 * @returns "2024-25"
 */
export function makeSeasonIdFromStartYear(startYear: number): SeasonId;

/**
 * Create a SeasonId from the season's end year
 * @param endYear - e.g., 2025
 * @returns "2024-25"
 */
export function makeSeasonIdFromEndYear(endYear: number): SeasonId;

/**
 * Get the previous season
 * @param seasonId - e.g., "2025-26"
 * @returns "2024-25"
 */
export function prevSeason(seasonId: SeasonId): SeasonId;

/**
 * Get the next season
 * @param seasonId - e.g., "2024-25"
 * @returns "2025-26"
 */
export function nextSeason(seasonId: SeasonId): SeasonId;

/**
 * Add/subtract seasons (delta can be negative)
 * @param seasonId - e.g., "2024-25"
 * @param delta - e.g., 2
 * @returns "2026-27"
 */
export function addSeasons(seasonId: SeasonId, delta: number): SeasonId;

/**
 * Compare two seasons (-1 if a < b, 0 if equal, 1 if a > b)
 */
export function compareSeasons(a: SeasonId, b: SeasonId): -1 | 0 | 1;

/**
 * Get current NBA season based on a date (July 1 rule)
 * 
 * The NBA league year begins on July 1. This function determines which season
 * a given date falls into:
 * 
 * - If date is between July 1 and December 31 of year Y:
 *   Returns season "Y-(Y+1 last 2 digits)" (e.g., Aug 15, 2024 → "2024-25")
 * 
 * - If date is between January 1 and June 30 of year Y:
 *   Returns season "(Y-1)-(Y last 2 digits)" (e.g., Mar 10, 2025 → "2024-25")
 * 
 * Edge Cases:
 * - Seasons beyond 2031-32: Function will still compute correctly, but cap data
 *   may not be available in capProjections.js
 * - Pre-2014 seasons: Function computes correctly, but historical cap data
 *   is not guaranteed to be available
 * - Exactly July 1 at midnight: Treated as start of new season
 * 
 * @param date - Date to evaluate (defaults to now)
 * @returns Current SeasonId (e.g., if date is Aug 2024, returns "2024-25")
 * 
 * @example
 * getCurrentSeasonId(new Date('2024-08-15')) // → "2024-25"
 * getCurrentSeasonId(new Date('2025-03-10')) // → "2024-25"
 * getCurrentSeasonId(new Date('2025-07-01')) // → "2025-26"
 */
export function getCurrentSeasonId(date?: Date): SeasonId;

/**
 * Validate that a string is a valid SeasonId
 */
export function isValidSeasonId(value: string): value is SeasonId;

/**
 * Normalize various season formats to canonical SeasonId
 * Handles: "2024-25", "2025", 2025, "2024-2025"
 * 
 * @returns SeasonId if valid, null if input cannot be parsed
 * @note Callers should validate the result is not null before using
 * 
 * Valid Inputs:
 * - "2024-25" → "2024-25" (already canonical)
 * - "2025" → "2024-25" (interpreted as end year)
 * - 2025 → "2024-25" (numeric end year)
 * - "2024-2025" → "2024-25" (full year format)
 * 
 * Invalid Inputs (returns null):
 * - "" (empty string)
 * - "invalid"
 * - "20-25" (malformed)
 * - "2024-2026" (non-consecutive years)
 * - NaN, Infinity, negative numbers
 */
export function normalizeToSeasonId(input: string | number): SeasonId | null;
```

### 2.3 Cap Data Lookup Helpers

```typescript
// src/features/architect/utils/capHelpers.ts

import type { SeasonId } from './seasonHelpers';

/**
 * Get cap settings for a specific season
 * @param seasonId - Which season's cap to retrieve
 * @returns Cap settings or null if not found
 */
export function getCapForSeason(seasonId: SeasonId): CapSettings | null;

/**
 * Get tax/apron lines for a specific season
 */
export function getTaxLinesForSeason(seasonId: SeasonId): TaxLines | null;

/**
 * Get minimum salary scale for a specific season
 */
export function getMinimumSalaryScale(seasonId: SeasonId): MinimumSalaryScale;
```

### 2.4 File Location Decision

- **New file**: `src/features/architect/utils/seasonHelpers.ts` (TypeScript)
- **Deprecate**: Keep `seasonFormat.js`, `seasonUtils.js` as thin wrappers that import from new file (for backward compatibility during migration)
- **Update imports**: All new code should import from `seasonHelpers.ts`

---

## 3. RULECONTEXT DESIGN

### 3.1 RuleContext Type Definition

```typescript
// src/features/architect/types/ruleContext.ts

import type { SeasonId } from '../utils/seasonHelpers';

/**
 * Timing context for cap/contract rule evaluation
 */
export interface TimingContext {
  /** The season this move will actually apply to (when salaries begin) */
  operationSeasonId: SeasonId;
  
  /** The season to pull "prior salary" from for 105%/140% calculations */
  referenceSeasonId: SeasonId;
  
  /** Which season's cap table to use for max %, apron thresholds, etc. */
  capSeasonId: SeasonId;
  
  /**
   * Current league phase for timing rules
   * 
   * Phase-sensitive rules:
   * - 'moratorium': No signings allowed (July 1-6), only verbal agreements
   * - 'offseason': Free agency signings, extensions, trades allowed
   * - 'regular': In-season trades, 10-day contracts, hardship exceptions
   * - 'playoffs': Trade deadline has passed, limited signings
   * - 'preseason': Training camp signings, roster finalization
   * 
   * Derivation:
   * - Computed by builder from operationDate + NBA league calendar
   * - NOT a separate input; derived automatically
   * - Calendar dates: Moratorium (Jul 1-6), Offseason (Jul 7 - Oct ~15),
   *   Preseason (Oct ~15 - Oct ~22), Regular (Oct ~22 - Apr), Playoffs (Apr - Jun)
   * 
   * Simulation Note:
   * - When simulating across phase boundaries, phase is recalculated
   * - Phase is immutable within a single RuleContext evaluation
   */
  phase: LeaguePhase;
  
  /** Date/time of the operation (for timing restrictions like 30-day rules) */
  operationDate: Date;
}

/**
 * League phase enum for timing context
 */
export type LeaguePhase = 'preseason' | 'regular' | 'playoffs' | 'offseason' | 'moratorium';

/**
 * Player-specific inputs for rule calculations
 */
export interface PlayerContext {
  playerId: string;
  displayName: string;
  
  /**
   * Years of NBA service at time of operation (not draft year!)
   * 
   * @source COMPUTED by builder
   * @derivation Calculated from player.bio.draftYear and player.contract.yearsAcquired
   *             relative to operationSeasonId. Formula:
   *             yearsOfService = operationSeasonId.startYear - draftYear
   *             (adjusted for seasons actually played)
   */
  yearsOfServiceAtOperation: number;
  
  /**
   * Bird type player will have when operation executes
   * 
   * @source COMPUTED by builder
   * @derivation Calculated from player.contract.birdRights.status and
   *             player's continuous tenure with team. Bird rights accrue
   *             based on years with team without being waived/renounced.
   */
  birdTypeAtOperation: BirdType;
  
  /**
   * Salary from referenceSeasonId (null if no prior contract)
   * 
   * @source LOADED from player.contract.salariesByYear[]
   * @derivation Looks up salary entry where entry.season === referenceSeasonId
   *             from TimingContext. If no entry exists, returns null.
   *             Used for 105%/140% calculations in extensions and Bird signings.
   */
  priorSeasonSalary: number | null;
  
  /**
   * Current season salary (if under contract)
   * 
   * @source LOADED from player.contract.salariesByYear[]
   * @derivation Looks up salary entry where entry.season === operationSeasonId
   */
  currentSeasonSalary: number | null;
  
  /**
   * Max salary percentage bucket (25%, 30%, 35%)
   * 
   * @source COMPUTED by builder
   * @derivation Based on yearsOfServiceAtOperation:
   *             0-6 years → 0.25 (25%)
   *             7-9 years → 0.30 (30%)
   *             10+ years → 0.35 (35%)
   */
  maxPercentBucket: 0.25 | 0.30 | 0.35;
  
  /** Contract end season if currently under contract */
  contractEndSeasonId: SeasonId | null;
  
  /** Whether player is on a rookie scale contract */
  isRookieScale: boolean;
  
  /** Draft information for rookie extension calculations */
  draftInfo: {
    year: number;
    round: number;
    pick: number;
  } | null;
}

/**
 * Bird rights type for player context
 */
export type BirdType = 'None' | 'Non-Bird' | 'Early Bird' | 'Full Bird';

/**
 * Team-specific inputs for rule calculations
 */
export interface TeamContext {
  teamId: string;
  teamCode: string;
  
  /**
   * Team's total salary commitments for operationSeasonId
   * 
   * @source COMPUTED by builder
   * @derivation Sum of all player cap hits for operationSeasonId from
   *             team.players[].contract.salariesByYear[] where season matches.
   *             Includes: guaranteed salaries, cap holds for Bird rights players,
   *             dead money from waived players, incomplete roster charges.
   *             Excludes: two-way contract salaries (don't count against cap).
   */
  teamSalaryAtOperation: number;
  
  /**
   * Team's apron status for operationSeasonId
   * 
   * @source COMPUTED by builder
   * @derivation Calculated by comparing teamSalaryAtOperation against cap thresholds
   *             from capSeasonId in CapContext:
   *             
   *             if (teamSalary >= cap.secondApron) → 'SECOND_APRON'
   *             else if (teamSalary >= cap.firstApron) → 'FIRST_APRON'  
   *             else if (teamSalary >= cap.salaryCap) → 'OVER_CAP'
   *             else → 'UNDER_CAP'
   *             
   * @note This calculation does NOT account for:
   *       - Pending trade exceptions (TPEs don't affect cap until used)
   *       - Repeater tax penalties (tracked separately, not a cap threshold)
   *       - Cash sent in trades (one-time, not salary commitment)
   *       
   *       It DOES include:
   *       - Cap holds for unsigned free agents with Bird rights
   *       - Guaranteed money on waived players (dead cap)
   *       - Incomplete roster charges (minimum team salary floor)
   */
  apronLevelAtOperation: ApronLevel;
  
  /**
   * Available cap space (0 if over cap)
   * 
   * @source COMPUTED by builder
   * @derivation cap.salaryCap - teamSalaryAtOperation, floored at 0
   */
  capSpaceAtOperation: number;
  
  /** Whether team is hard-capped and at which level */
  hardCapStatus: {
    isHardCapped: boolean;
    trigger: 'SIGN_AND_TRADE' | 'MLE' | 'BAE' | null;
    ceiling: number;
  };
  
  /** Available signing exceptions */
  exceptionsAvailable: {
    fullMLE: { available: boolean; remaining: number };
    taxpayerMLE: { available: boolean; remaining: number };
    roomMLE: { available: boolean; remaining: number };
    bae: { available: boolean; remaining: number };
    tradeExceptions: Array<{ id: string; amount: number; expiresSeasonId: SeasonId }>;
  };
}

/**
 * Apron level enum for team context
 */
export type ApronLevel = 'UNDER_CAP' | 'OVER_CAP' | 'FIRST_APRON' | 'SECOND_APRON';

/**
 * Operation-specific inputs
 */
export interface OperationContext {
  /** Type of operation being evaluated */
  operationType: 
    | 'UFA_SIGNING'
    | 'RFA_SIGNING'
    | 'VETERAN_EXTENSION'
    | 'ROOKIE_EXTENSION'
    | 'DESIGNATED_VETERAN_EXTENSION'
    | 'TRADE'
    | 'SIGN_AND_TRADE'
    | 'MINIMUM_SIGNING'
    | 'EXCEPTION_SIGNING'
    | 'QUALIFYING_OFFER'
    | 'TWO_WAY_SIGNING';
  
  /** Proposed contract details (if signing/extension) */
  proposedContract?: {
    years: number;
    startingSeasonId: SeasonId;
    firstYearSalary: number;
    raisePercentage: number;
    includesPlayerOption?: boolean;
    includesTeamOption?: boolean;
  };
  
  /** For trades: teams involved and assets moving */
  tradeDetails?: {
    teams: string[];
    playerMovements: Array<{ playerId: string; fromTeamId: string; toTeamId: string }>;
    cashMovements: Array<{ fromTeamId: string; toTeamId: string; amount: number }>;
    pickMovements: any[];
  };
  
  /** Which exception is being used (if any) */
  exceptionUsed?: 'FULL_MLE' | 'TAXPAYER_MLE' | 'ROOM_MLE' | 'BAE' | 'TPE' | null;
}

/**
 * Cap settings for the capSeasonId
 */
export interface CapContext {
  salaryCap: number;
  taxLine: number;
  firstApron: number;
  secondApron: number;
  minimumTeamSalary: number;
  fullMLE: number;
  taxpayerMLE: number;
  roomMLE: number;
  bae: number;
  averagePlayerSalary: number;
}

/**
 * Complete RuleContext that all cap/contract rules should accept
 */
export interface RuleContext {
  timing: TimingContext;
  player: PlayerContext;
  team: TeamContext;
  operation: OperationContext;
  cap: CapContext;
}
```

### 3.2 File Location

- **New file**: `src/features/architect/types/ruleContext.ts`
- Export all types from an `index.ts` barrel file

---

## 4. RULECONTEXT BUILDER PLAN

### 4.1 Builder Function Location

**New file**: `src/features/architect/utils/buildRuleContext.ts`

### 4.2 Primary Builder Function

```typescript
/**
 * Build a complete RuleContext for evaluating a player move
 * 
 * @param planState - Current team plan state (roster, cap, exceptions)
 * @param playerId - Player being evaluated
 * @param operationType - Type of operation
 * @param options - Additional operation-specific options
 * @returns Complete RuleContext for rule evaluation
 */
export function buildRuleContextForPlayerMove(
  planState: TeamPlanState,
  playerId: string,
  operationType: OperationType,
  options?: BuilderOptions
): RuleContext;
```

### 4.3 Season Derivation by Operation Type

| Operation Type | operationSeasonId | referenceSeasonId | capSeasonId |
|----------------|-------------------|-------------------|-------------|
| **UFA Signing** | First contract year (usually next season) | Most recent completed season | Same as operationSeasonId |
| **RFA Signing** | First contract year | Most recent completed season | Same as operationSeasonId |
| **Veteran Extension** | First extension year (after current contract ends) | Last year of current contract | Same as operationSeasonId |
| **Rookie Extension** | 5th year (first extension year) | 4th year (final rookie scale year) | operationSeasonId or current season for max calc |
| **Designated Veteran Extension** | First extension year (after current contract ends) | Last year of current contract | Same as operationSeasonId (uses 35% max tier) |
| **Trade** | Current season | Current season | Current season |
| **Sign-and-Trade** | First contract year | Most recent completed season | First contract year |
| **Minimum Signing** | Current or next season | N/A (not used for min signings) | Same as operationSeasonId |
| **Exception Signing** | Current or next season | Current season (for exception caps) | Same as operationSeasonId |
| **Qualifying Offer** | Next season (following contract expiration) | Final year of expiring contract | Same as operationSeasonId (QO salary = 125-150% of prior year) |
| **Two-Way Signing** | Current or next season | N/A (two-way contracts have fixed terms) | Same as operationSeasonId (two-way salary is fixed per CBA) |

### 4.4 Handling Missing Data

#### Error Types and Handling Strategy

```typescript
/**
 * Error thrown when RuleContext cannot be built due to missing/invalid data
 */
export class RuleContextValidationError extends Error {
  constructor(
    public code: RuleContextErrorCode,
    public details: string,
    public userFacingMessage: string
  ) {
    super(`RuleContext validation failed: ${code} - ${details}`);
    this.name = 'RuleContextValidationError';
  }
}

/**
 * Error codes for RuleContext validation failures
 */
export type RuleContextErrorCode =
  | 'MISSING_CAP_DATA'        // capProjections doesn't have the requested season
  | 'MISSING_PRIOR_SALARY'    // No salary data for referenceSeasonId (when required)
  | 'MISSING_PLAYER_DATA'     // Player object lacks required fields
  | 'MISSING_TEAM_DATA'       // Team state incomplete
  | 'INVALID_SEASON_ID'       // Season format invalid or out of range
  | 'INVALID_OPERATION_TYPE'  // Unknown operation type
  | 'SEASON_OUT_OF_RANGE';    // Season beyond supported cap projection range
```

#### Error Handling by Data Type

**Prior Salary**:
- If player has no contract in `referenceSeasonId`, set `priorSeasonSalary = null`
- Rules must handle `null` explicitly (not treat as `0`)
- For 105%/140% calculations, `null` means "use average player salary" per CBA
- **Not an error** — `null` is a valid state for free agents without prior contracts

**Missing Cap Data**:
- If `capProjections` doesn't have the `capSeasonId`, throw `RuleContextValidationError`:
  ```typescript
  import { getSupportedSeasonRange } from './capHelpers';
  
  const { earliest, latest } = getSupportedSeasonRange(); // e.g., { earliest: "2024-25", latest: "2031-32" }
  throw new RuleContextValidationError(
    'MISSING_CAP_DATA',
    `No cap projections available for season ${capSeasonId}`,
    `Cannot evaluate move: cap data for ${capSeasonId} is not available. Supported seasons: ${earliest} through ${latest}.`
  );
  ```
- Don't silently fall back to another season
- **User-facing**: Display the `userFacingMessage` in UI; internal logging uses `details`

**Missing Player Data**:
- Return validation error with clear message
- Don't proceed with incomplete context
  ```typescript
  throw new RuleContextValidationError(
    'MISSING_PLAYER_DATA',
    `Player ${playerId} missing required field: contract.salariesByYear`,
    `Cannot evaluate move: player contract data is incomplete.`
  );
  ```

#### RuleContext Validation Function

```typescript
/**
 * Validate that a RuleContext is complete before use
 * Call this before passing RuleContext to any rule function
 * 
 * @throws RuleContextValidationError if context is incomplete
 */
export function validateRuleContext(ctx: RuleContext): void {
  // Timing validation
  if (!ctx.timing.operationSeasonId) {
    throw new RuleContextValidationError(
      'INVALID_SEASON_ID',
      'operationSeasonId is required',
      'Cannot evaluate move: operation season not specified.'
    );
  }
  
  // Cap validation
  if (!ctx.cap.salaryCap || ctx.cap.salaryCap <= 0) {
    throw new RuleContextValidationError(
      'MISSING_CAP_DATA',
      `Invalid salary cap: ${ctx.cap.salaryCap}`,
      `Cannot evaluate move: cap data is missing or invalid.`
    );
  }
  
  // Player validation (when player context is required)
  if (ctx.operation.operationType !== 'TRADE' && !ctx.player.playerId) {
    throw new RuleContextValidationError(
      'MISSING_PLAYER_DATA',
      'playerId is required for non-trade operations',
      'Cannot evaluate move: player not specified.'
    );
  }
  
  // Add additional validations as needed...
}
```

#### Distinguishing Error Types in Callers

```typescript
try {
  const ctx = buildRuleContextForPlayerMove(planState, playerId, 'UFA_SIGNING');
  validateRuleContext(ctx);
  const result = computeMaxSalary(ctx);
} catch (error) {
  if (error instanceof RuleContextValidationError) {
    switch (error.code) {
      case 'MISSING_CAP_DATA':
        // Show UI warning about unsupported season
        showWarning(error.userFacingMessage);
        break;
      case 'MISSING_PLAYER_DATA':
        // Log and show generic error
        console.error(error.details);
        showError('Player data incomplete');
        break;
      default:
        showError('An error occurred evaluating this move');
    }
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

### 4.5 State Sources

The builder pulls from:

1. **Team Plan State** (from Firestore or local state):
   - `roster`: Current player IDs
   - `players`: Player contract details  
   - `totals`: Salary totals by season
   - `exceptions`: Available signing exceptions
   - `hardCapStatus`: Hard cap trigger and ceiling

2. **Cap Projections** (from `capProjections.js`):
   - Cap, tax, apron values by season
   - Exception amounts by season

3. **Player Contract** (from player object):
   - `salariesByYear[]`: Historical and current salaries
   - `birdRights`: Bird status
   - `freeAgency`: FA year and type

4. **CBA Constants** (from `cbaConstants.js`):
   - Matching bands, roster limits, etc.

---

## 5. REFACTOR PLAN (STEP-BY-STEP)

### Phase 1: Foundation (Estimated: 2-3 hours)

**1.1** Create `src/features/architect/utils/seasonHelpers.ts`
- Implement all helper functions from Section 2.2
- Add comprehensive unit tests
- Export canonical `SeasonId` type

**1.2** Create `src/features/architect/types/ruleContext.ts`
- Implement all interfaces from Section 3.1
- Add JSDoc comments for each field
- Create barrel export in `src/features/architect/types/index.ts`

**1.3** Update `seasonFormat.js` and `seasonUtils.js`
- Add deprecation comments
- Re-export from `seasonHelpers.ts` for backward compatibility

### Phase 2: Builder Implementation (Estimated: 3-4 hours)

**2.1** Create `src/features/architect/utils/buildRuleContext.ts`
- Implement `buildRuleContextForPlayerMove()`
- Implement helper builders: `buildTimingContext()`, `buildPlayerContext()`, `buildTeamContext()`, `buildOperationContext()`, `buildCapContext()`
- Add unit tests with specific scenarios (see Phase 5)

**2.2** Create `src/features/architect/utils/capHelpers.ts`
- Move cap lookup logic from scattered files
- Implement `getCapForSeason()`, `getTaxLinesForSeason()`, `getMinimumSalaryScale()`

### Phase 3: Core Rule Updates (Estimated: 4-6 hours)

**3.1** Update `playerRulesProfile/computeProfile.js`
- Accept optional `RuleContext` parameter
- If provided, use timing from context instead of deriving from Date
- Remove hard-coded fallbacks

**3.2** Update `playerRulesProfile/maxSalaryRules.js`
- Change `computeMaxSalary(player, leagueContext)` signature to accept `RuleContext`
- Use `ctx.cap.salaryCap` instead of hard-coded fallback
- Use `ctx.player.yearsOfServiceAtOperation` instead of computing

**3.3** Update `playerRulesProfile/minimumSalaryRules.js`
- Remove `|| '2024-25'` fallback
- Accept `RuleContext` and use `ctx.timing.capSeasonId`

**3.4** Update `playerRulesProfile/extensionRules.js`
- Use `ctx.timing.referenceSeasonId` for 105%/140% calculations
- Use `ctx.player.priorSeasonSalary` (handle `null` case)

**3.5** Update `playerRulesProfile/birdRightsRules.js`
- Use `ctx.timing.operationSeasonId` for when Bird rights apply
- Use `ctx.player.birdTypeAtOperation` instead of computing

### Phase 4: Cap Manager / Cap Sheet Updates (Estimated: 2-3 hours)

**4.1** Update `hooks/usePlayerRulesProfiles.js`
- Build `RuleContext` objects in `buildLeagueContext()`
- Pass to `computePlayerRulesProfile()`

**4.2** Update `CapSheet.jsx` and `CapSheetFull.jsx`
- Pass `operationSeasonId` (the `selectedYear`) explicitly
- Don't rely on hook to derive from current date

**4.3** Update `useCapSheetState.js`
- When exercising options, extending, signing: build full `RuleContext`
- Pass to rule functions

### Phase 5: Trade Machine Updates (Estimated: 3-4 hours)

**5.1** Update `tradeMachine/rules/validateSignAndTrade.js`
- Remove `currentYear || 2025` fallback
- Require `RuleContext` in validation

**5.2** Update `tradeMachine/rules/miscRules.js`
- Remove default `currentYear = 2025`
- Require explicit timing context

**5.3** Update `tradeMachine/engine/tradeValidator.js`
- Build `RuleContext` before calling rule functions
- Pass timing explicitly to all validators

**5.4** Update `hooks/useTradeMachine.js`
- Build timing context from `yearKey` prop
- Pass to validation layer

### Phase 6: Remove Hard-coded Defaults (Estimated: 1-2 hours)

**6.1** Search and remove all instances of:
- `|| '2024-25'`
- `|| 2025`
- `|| 140_588_000` (hard-coded cap)
- `currentYear = 2025` default params

**6.2** Replace with explicit errors if context is missing:
```typescript
if (!ctx.timing.operationSeasonId) {
  throw new Error('RuleContext.timing.operationSeasonId is required');
}
```

### Phase 7: Testing & Validation (Estimated: 2-3 hours)

**7.1** Add test fixtures in `tests/`:
- `ruleContext.test.ts`: Builder function tests
- `seasonHelpers.test.ts`: Season helper tests
- `timingScenarios.test.ts`: End-to-end timing scenarios

**7.2** Specific test scenarios:
- **LeBron 2026 UFA with Full Bird**: Verify correct cap season (2026-27), reference season (2025-26), max salary calculation
- **Rookie Extension in 4th year**: Verify extension eligible, correct first extension year
- **Trade during season**: Verify current season salaries used
- **Mid-season signing**: Verify correct cap and timing

**7.3** Manual testing:
- Use GM Dashboard with different `selectedYear` values
- Verify calculations change appropriately
- Test extension eligibility display

### Migration Timeline & Backward Compatibility

#### Timeline Overview

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Phase 1-2 | Week 1-2 | Foundation complete, new helpers available |
| Phase 3-4 | Week 3-4 | Core rules updated, dual support active |
| Phase 5 | Week 5 | Trade Machine updated |
| Phase 6 | Week 6 | Hard-coded defaults removed, deprecation warnings active |
| Phase 7 | Week 7 | Testing complete, ready for release |
| Deprecation Period | +6 weeks (2 release cycles) | Old signatures still work with warnings |
| Removal | Week 13+ | Old signatures removed (post-deprecation cleanup) |

#### Deprecation Warning Timeline

1. **Phase 1.3** (Week 1-2): Add deprecation comments to `seasonFormat.js` and `seasonUtils.js`
   - Re-exports with `@deprecated` JSDoc tags
   - Console warnings in development mode only
   - Warnings should include migration path: "Use `seasonHelpers.ts` instead"

2. **Phase 3-5** (Week 3-5): Old function signatures still work
   - Add `@deprecated` JSDoc to old signatures
   - Log warning on first call per session (not every call)
   - Example: `console.warn('[DEPRECATED] computeMaxSalary(player, leagueContext) - use computeMaxSalary(ruleContext) instead')`

3. **Phase 6** (Week 6): Escalate warnings
   - Warnings appear in production (not just dev)
   - Documentation updated to show new patterns only

4. **Removal** (Week 13+): Old signatures removed
   - Breaking change documented in release notes
   - Migration guide published

#### Backward Compatibility Adapter

To support gradual migration, provide adapter functions that construct `RuleContext` from old signatures:

```typescript
// src/features/architect/utils/legacyAdapters.ts

import type { RuleContext } from '../types/ruleContext';
import { buildRuleContextForPlayerMove } from './buildRuleContext';

/**
 * @deprecated Use computeMaxSalary(ruleContext) instead.
 * This adapter will be removed in version X.Y.Z.
 * 
 * Legacy wrapper that constructs RuleContext from old signature.
 * Provided for backward compatibility during migration period.
 */
export function computeMaxSalaryLegacy(
  player: Player,
  leagueContext: LegacyLeagueContext
): MaxSalaryResult {
  // Log deprecation warning (once per session)
  warnOnce(
    'computeMaxSalaryLegacy',
    'computeMaxSalary(player, leagueContext) is deprecated. ' +
    'Use computeMaxSalary(ruleContext) instead. ' +
    'See migration guide: docs/architect/timing-migration.md'
  );
  
  // Construct RuleContext from legacy inputs
  const ruleContext = buildRuleContextFromLegacy(player, leagueContext, 'UFA_SIGNING');
  
  // Call new implementation
  return computeMaxSalary(ruleContext);
}

/**
 * Build RuleContext from legacy function parameters
 * Used by adapter functions during migration period
 */
function buildRuleContextFromLegacy(
  player: Player,
  leagueContext: LegacyLeagueContext,
  operationType: OperationType
): RuleContext {
  // Derive timing from legacy leagueContext
  const operationSeasonId = leagueContext.currentSeason;
  const referenceSeasonId = prevSeason(operationSeasonId);
  
  // Build minimal RuleContext
  return {
    timing: {
      operationSeasonId,
      referenceSeasonId,
      capSeasonId: operationSeasonId,
      phase: leagueContext.leaguePhase || 'regular',
      operationDate: leagueContext.simulationDate || new Date(),
    },
    player: buildPlayerContextFromLegacy(player, operationSeasonId, referenceSeasonId),
    team: buildMinimalTeamContext(), // Minimal context for max salary calc
    operation: { operationType },
    cap: buildCapContextFromSettings(leagueContext.capSettings),
  };
}

// Helper to only warn once per function
const warnedFunctions = new Set<string>();
function warnOnce(fnName: string, message: string): void {
  if (warnedFunctions.has(fnName)) return;
  warnedFunctions.add(fnName);
  console.warn(`[DEPRECATED] ${message}`);
}
```

#### Phase 1.3 Re-exports with Deprecation

```typescript
// src/features/architect/utils/seasonFormat.js (updated)

/**
 * @deprecated Import from 'seasonHelpers.ts' instead.
 * This file will be removed in version X.Y.Z.
 * 
 * Migration:
 *   Before: import { toSeasonCode } from './seasonFormat';
 *   After:  import { makeSeasonIdFromEndYear } from './seasonHelpers';
 */

import {
  makeSeasonIdFromEndYear as toSeasonCode,
  parseSeasonId,
  normalizeToSeasonId as parseSeason,
} from './seasonHelpers';

// Re-export with original names for backward compatibility
export { toSeasonCode, parseSeason };

// toEndYear maps to parseSeasonId().endYear
export function toEndYear(seasonCode) {
  const parsed = parseSeasonId(seasonCode);
  return parsed?.endYear ?? null;
}
```

---

## 6. RISKS & OPEN QUESTIONS

### Risks

1. **Import Path Updates**: Many files import from `seasonFormat.js` / `seasonUtils.js`. Need thorough search-and-replace.

2. **Type Migration**: Moving to TypeScript interfaces while keeping JS compatibility. May need `.d.ts` declaration files temporarily.

3. **Breaking Changes**: Signature changes to `computeMaxSalary`, `computeExtensionTerms`, etc. will break callers.

4. **Test Coverage**: Current test suite may not cover all timing scenarios—bugs could be hidden.

5. **Performance**: Building `RuleContext` for every player in a roster could be slow. Consider memoization.

### Open Questions

1. **Season Convention**: The codebase inconsistently uses start-year vs end-year. Should we standardize on end-year (2025 for 2024-25) or start-year? **Recommendation**: Use `SeasonId` string everywhere; only convert to numbers when needed for math.

2. **Backward Compatibility**: How long should we maintain the old function signatures? **Recommendation**: One release cycle; add deprecation warnings first.

3. **Where to Store RuleContext Type**: `src/features/architect/types/` or `src/types/`? **Recommendation**: `src/features/architect/types/` since it's Architect-specific.

4. **Cap Projection Data**: Currently in `capProjections.js` as a static object. Should this move to Firestore for easier updates? **Out of scope for this plan**, but worth considering.

5. **Simulation Date Handling**: How should `simulationDate` interact with `operationSeasonId`? **Recommendation**: `simulationDate` is for timing restrictions (30-day rules, moratorium), while `operationSeasonId` is for which cap numbers to use.

---

## CONTEXT SNAPSHOT

### Systems Involved
- Architect feature (GM Dashboard, Cap Sheet, Trade Machine)
- Player rules profile computation
- Cap/contract validation rules

### Key Folders and Files
- `src/features/architect/utils/` — Main utility location
- `src/features/architect/utils/playerRulesProfile/` — Rule computation
- `src/features/architect/utils/tradeMachine/` — Trade validation
- `src/features/architect/hooks/` — React hooks for cap state
- `src/shared/utils/contracts/` — Shared contract utilities

### Relevant Docs
- `DEVELOPER_GUIDE.md` — Project architecture
- `docs/schema/architect.md` — Architect data schema
- `cba/guides/` — CBA rule references (if available)

### Known Constraints
- No Firestore schema changes in this phase
- Maintain backward compatibility during transition
- TypeScript optional but preferred for new files

### Questions Asked and Answered
- N/A (planning phase)

### Technical Decisions Made
- Use `"YYYY-YY"` as canonical season format
- Create new `seasonHelpers.ts` rather than modifying existing files
- Use TypeScript for new files
- Builder pattern for RuleContext construction

---

## CHUNK_INDEX

Not using chunks—this is a planning document. Implementation will be tracked separately.

---

## PROGRESS

**Status**: 🟢 Completed (Planning Phase)

**Progress**: ██████████ 6/6 sections completed

**Completed**:
- ✅ Current state map
- ✅ Season model design  
- ✅ RuleContext design
- ✅ RuleContext builder plan
- ✅ Refactor plan (step-by-step)
- ✅ Risks and open questions

**Next Steps**:
- [ ] Review plan with stakeholders
- [ ] Begin Phase 1: Foundation implementation
- [ ] Create test fixtures for timing scenarios

**Blockers**: None

**Last Updated**: 2025-12-11 12:45

---

## PERMANENT_FILE_MAP

Once implemented:
- `src/features/architect/utils/seasonHelpers.ts` — Canonical season utilities
- `src/features/architect/types/ruleContext.ts` — RuleContext type definitions
- `src/features/architect/utils/buildRuleContext.ts` — Context builder
- `src/features/architect/utils/capHelpers.ts` — Cap lookup utilities

---

## REVISION_LOG

- 2025-12-11: Initial planning document created
- 2025-12-11: Added 3 missing operation types to season derivation table (DESIGNATED_VETERAN_EXTENSION, QUALIFYING_OFFER, TWO_WAY_SIGNING)
- 2025-12-11: Expanded getCurrentSeasonId() documentation with explicit July 1 rule logic and edge cases
- 2025-12-11: Added normalizeToSeasonId() examples for valid/invalid inputs
- 2025-12-11: Added RuleContextValidationError type with error codes and handling strategy
- 2025-12-11: Added validateRuleContext() function specification
- 2025-12-11: Added @source annotations to PlayerContext fields documenting computed vs loaded data
- 2025-12-11: Added BirdType and LeaguePhase type aliases
- 2025-12-11: Expanded TeamContext.apronLevelAtOperation with derivation logic and inclusions/exclusions
- 2025-12-11: Added ApronLevel type alias
- 2025-12-11: Expanded TimingContext.phase with phase-sensitive rules and derivation documentation
- 2025-12-11: Added Migration Timeline subsection with week-by-week schedule
- 2025-12-11: Added backward compatibility adapter code examples (computeMaxSalaryLegacy)

---

## KNOWN_LIMITATIONS

- This plan does not address Firestore data format migration
- Multi-year cap projections beyond 2031-32 are not included in `capProjections.js`
- Some edge cases (e.g., 10-day contracts, hardship exceptions) not explicitly covered
