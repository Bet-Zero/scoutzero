/**
 * FILE: src/features/architect/types/ruleContext.ts
 * PURPOSE: Type definitions for RuleContext used in cap/contract rule evaluation.
 * OWNERSHIP: Feature: architect/timing
 *
 * HISTORY:
 *  - 2025-12-11: Initial implementation per Architect Timing Plan.
 *
 * LINKS:
 *  - Plan: plans/architect-timing/plan.md
 */

import type { SeasonId } from '@/features/architect/utils/seasonHelpers';

/**
 * League phase enum for timing context.
 * Determines which operations are allowed and how rules are evaluated.
 */
export type LeaguePhase = 
  | 'preseason'    // Training camp signings, roster finalization
  | 'regular'      // In-season trades, 10-day contracts
  | 'playoffs'     // Trade deadline has passed, limited signings
  | 'offseason'    // Free agency signings, extensions, trades
  | 'moratorium';  // No signings allowed (July 1-6)

/**
 * Timing context for cap/contract rule evaluation.
 * Provides explicit season references for all timing-dependent calculations.
 */
export interface TimingContext {
  /** The season this move will actually apply to (when salaries begin) */
  operationSeasonId: SeasonId;
  
  /** 
   * The season to pull "prior salary" from for 105%/140% calculations.
   * For UFA/RFA signings: usually the season *before* the new contract starts.
   * For extensions: final year of the existing contract.
   */
  referenceSeasonId: SeasonId;
  
  /** Which season's cap table to use for max %, apron thresholds, etc. */
  capSeasonId: SeasonId;
  
  /**
   * Current league phase for timing rules.
   * Derived from operationDate + NBA league calendar.
   */
  phase: LeaguePhase;
  
  /** Date/time of the operation (for timing restrictions like 30-day rules) */
  operationDate: Date;
}

/**
 * Bird rights type for player context.
 * Determines signing mechanisms available to the current team.
 */
export type BirdType = 'None' | 'Non-Bird' | 'Early Bird' | 'Full Bird';

/**
 * Player-specific inputs for rule calculations.
 * All derived values are computed by the RuleContext builder.
 */
export interface ArchitectPlayerContext {
  /** Player identifier */
  playerId: string;
  
  /** Player display name */
  displayName: string;
  
  /** Team ID the player is currently on (null if free agent) */
  currentTeamId: string | null;
  
  /**
   * Years of NBA service at time of operation.
   * Computed from player.bio.draftYear relative to operationSeasonId.
   */
  yearsOfServiceAtOperation: number;
  
  /**
   * Bird type player will have when operation executes.
   * Computed from player.contract.birdRights.status and continuous tenure.
   */
  birdTypeAtOperation: BirdType;
  
  /**
   * Salary from referenceSeasonId (null if no prior contract).
   * Loaded from player.contract.salariesByYear[].
   * Used for 105%/140% calculations in extensions and Bird signings.
   */
  priorSeasonSalary: number | null;
  
  /**
   * Current season salary (if under contract).
   * Loaded from player.contract.salariesByYear[] for operationSeasonId.
   */
  currentSeasonSalary: number | null;
  
  /**
   * Max salary percentage bucket (25%, 30%, 35%).
   * Computed based on yearsOfServiceAtOperation.
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
 * Apron level enum for team context.
 * Determines which signing mechanisms and exceptions are available.
 */
export type ApronLevel = 'UNDER_CAP' | 'OVER_CAP' | 'FIRST_APRON' | 'SECOND_APRON';

/**
 * Hard cap trigger type.
 * Teams become hard-capped at the first apron when using certain mechanisms.
 */
export type HardCapTrigger = 'SIGN_AND_TRADE' | 'MLE' | 'BAE' | null;

/**
 * Team-specific inputs for rule calculations.
 * All derived values are computed by the RuleContext builder.
 */
export interface TeamContext {
  /** Team identifier */
  teamId: string;
  
  /** Team code (e.g., "LAL", "BOS") */
  teamCode: string;
  
  /**
   * Team's total salary commitments for operationSeasonId.
   * Computed as sum of all player cap hits including cap holds and dead money.
   */
  teamSalaryAtOperation: number;
  
  /**
   * Team's apron status for operationSeasonId.
   * Computed by comparing teamSalaryAtOperation against cap thresholds.
   */
  apronLevelAtOperation: ApronLevel;
  
  /**
   * Available cap space (0 if over cap).
   * Computed as cap.salaryCap - teamSalaryAtOperation, floored at 0.
   */
  capSpaceAtOperation: number;
  
  /** Whether team is hard-capped and at which level */
  hardCapStatus: {
    isHardCapped: boolean;
    trigger: HardCapTrigger;
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
 * Operation type enum.
 * Determines which rules apply and how seasons are derived.
 */
export type OperationType =
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

/**
 * Exception type for signings.
 */
export type ExceptionType = 
  | 'FULL_MLE' 
  | 'TAXPAYER_MLE' 
  | 'ROOM_MLE' 
  | 'BAE' 
  | 'TPE' 
  | null;

/**
 * Operation-specific inputs.
 * Describes the proposed operation being evaluated.
 */
export interface OperationContext {
  /** Type of operation being evaluated */
  operationType: OperationType;
  
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
    pickMovements: unknown[];
  };
  
  /** Which exception is being used (if any) */
  exceptionUsed?: ExceptionType;
  
  /** Whether this is a sign-and-trade transaction */
  isSignAndTrade: boolean;
  
  /** Whether this is an extend-and-trade transaction */
  isExtendAndTrade: boolean;
}

/**
 * Cap settings for the capSeasonId.
 * Loaded from capProjections for the relevant season.
 */
export interface CapContext {
  /** Salary cap amount */
  salaryCap: number;
  
  /** Luxury tax line */
  taxLine: number;
  
  /** First apron threshold */
  firstApron: number;
  
  /** Second apron threshold */
  secondApron: number;
  
  /** Minimum team salary (90% of cap) */
  minimumTeamSalary: number;
  
  /** Full mid-level exception amount */
  fullMLE: number;
  
  /** Taxpayer mid-level exception amount */
  taxpayerMLE: number;
  
  /** Room mid-level exception amount */
  roomMLE: number;
  
  /** Bi-annual exception amount */
  bae: number;
  
  /** Average player salary (for exception calculations) */
  averagePlayerSalary: number;
}

/**
 * Complete RuleContext that all cap/contract rules should accept.
 * Provides all necessary context for rule evaluation without implicit state.
 */
export interface RuleContext {
  /** Timing information */
  timing: TimingContext;
  
  /** Player-specific context */
  player: ArchitectPlayerContext;
  
  /** Team-specific context */
  team: TeamContext;
  
  /** Operation details */
  operation: OperationContext;
  
  /** Cap settings for the relevant season */
  cap: CapContext;
}

/**
 * Error codes for RuleContext validation failures.
 */
export type RuleContextErrorCode =
  | 'MISSING_CAP_DATA'        // capProjections doesn't have the requested season
  | 'MISSING_PRIOR_SALARY'    // No salary data for referenceSeasonId (when required)
  | 'MISSING_PLAYER_DATA'     // Player object lacks required fields
  | 'MISSING_TEAM_DATA'       // Team state incomplete
  | 'INVALID_SEASON_ID'       // Season format invalid or out of range
  | 'INVALID_OPERATION_TYPE'  // Unknown operation type
  | 'SEASON_OUT_OF_RANGE';    // Season beyond supported cap projection range

/**
 * Error thrown when RuleContext cannot be built due to missing/invalid data.
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
 * Partial RuleContext for rules that only need timing and cap info.
 * Used for rules that don't require full player/team context.
 */
export interface TimingOnlyContext {
  timing: TimingContext;
  cap: CapContext;
}

/**
 * Partial RuleContext for player-focused rules.
 * Used for rules that need player info but not full team context.
 */
export interface ArchitectPlayerRuleContext {
  timing: TimingContext;
  player: ArchitectPlayerContext;
  cap: CapContext;
}

/**
 * Partial RuleContext for team-focused rules.
 * Used for rules that need team info but not full player context.
 */
export interface TeamRuleContext {
  timing: TimingContext;
  team: TeamContext;
  cap: CapContext;
}
