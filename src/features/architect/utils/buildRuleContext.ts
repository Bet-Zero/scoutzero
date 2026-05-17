/**
 * FILE: src/features/architect/utils/buildRuleContext.ts
 * PURPOSE: RuleContext builder for player move evaluation.
 * OWNERSHIP: Feature: architect/timing
 *
 * HISTORY:
 *  - 2025-12-11: Initial implementation per Architect Timing Plan.
 *
 * LINKS:
 *  - Plan: plans/architect-timing/plan.md
 */

import type { SeasonId } from './seasonHelpers';
import type {
  RuleContext,
  OperationType,
} from '../types/ruleContext';
import { RuleContextValidationError } from '../types/ruleContext';
import {
  isValidSeasonId,
  normalizeToSeasonId,
  prevSeason,
} from './seasonHelpers';
import {
  getCapForSeason,
  getSupportedSeasonRange,
  hasCapDataForSeason,
} from './capHelpers';

// Re-export RuleContextValidationError for backward compatibility
export { RuleContextValidationError } from '../types/ruleContext';
// Wave 45 Step 1: BuildRuleContextInput type and private helpers extracted to submodule
export * from './buildRuleContext.helpers';
import {
  BuildRuleContextInput,
  deriveOperationSeasonId,
  deriveReferenceSeasonId,
  buildTimingContext,
  buildPlayerContext,
  buildTeamContext,
  buildOperationContext,
} from './buildRuleContext.helpers';

export function validateRuleContext(ctx: RuleContext): void {
  if (
    !ctx.timing.operationSeasonId ||
    !isValidSeasonId(ctx.timing.operationSeasonId)
  ) {
    throw new RuleContextValidationError(
      'INVALID_SEASON_ID',
      'operationSeasonId is required and must be valid',
      'Cannot evaluate move: operation season not specified.'
    );
  }

  if (!ctx.cap.salaryCap || ctx.cap.salaryCap <= 0) {
    throw new RuleContextValidationError(
      'MISSING_CAP_DATA',
      `Invalid salary cap: ${ctx.cap.salaryCap}`,
      'Cannot evaluate move: cap data is missing or invalid.'
    );
  }

  if (ctx.operation.operationType !== 'TRADE' && !ctx.player.playerId) {
    throw new RuleContextValidationError(
      'MISSING_PLAYER_DATA',
      'playerId is required for non-trade operations',
      'Cannot evaluate move: player not specified.'
    );
  }
}

/**
 * Build a complete RuleContext for evaluating a player move
 *
 * @param input - Input data for building the context
 * @returns Complete RuleContext for rule evaluation
 * @throws RuleContextValidationError if required data is missing
 */
export function buildRuleContextForPlayerMove(
  input: BuildRuleContextInput
): RuleContext {
  const operationDate = input.simulationDate ?? new Date();

  let operationSeasonId: SeasonId;
  if (input.operationSeasonId) {
    const normalized = normalizeToSeasonId(input.operationSeasonId);
    if (!normalized) {
      throw new RuleContextValidationError(
        'INVALID_SEASON_ID',
        `Invalid operationSeasonId: ${input.operationSeasonId}`,
        'Cannot evaluate move: invalid season format.'
      );
    }
    operationSeasonId = normalized;
  } else {
    operationSeasonId = deriveOperationSeasonId(
      input.operationType,
      operationDate,
      input.player,
      input.proposedContract
    );
  }

  if (!hasCapDataForSeason(operationSeasonId)) {
    const { earliest, latest } = getSupportedSeasonRange();
    throw new RuleContextValidationError(
      'MISSING_CAP_DATA',
      `No cap projections available for season ${operationSeasonId}`,
      `Cannot evaluate move: cap data for ${operationSeasonId} is not available. Supported seasons: ${earliest} through ${latest}.`
    );
  }

  const cap = getCapForSeason(operationSeasonId);
  if (!cap) {
    throw new RuleContextValidationError(
      'MISSING_CAP_DATA',
      `Failed to load cap data for ${operationSeasonId}`,
      'Cannot evaluate move: cap data could not be loaded.'
    );
  }

  const referenceSeasonId = deriveReferenceSeasonId(
    input.operationType,
    operationSeasonId,
    input.player
  );

  const timing = buildTimingContext(
    input,
    operationSeasonId,
    referenceSeasonId
  );
  const player = buildPlayerContext(
    input,
    operationSeasonId,
    referenceSeasonId
  );
  const team = buildTeamContext(input, operationSeasonId, cap);
  const operation = buildOperationContext(input, operationSeasonId);

  const ctx: RuleContext = {
    timing,
    player,
    team,
    operation,
    cap,
  };

  validateRuleContext(ctx);

  return ctx;
}

/**
 * Build a minimal "cap-only" RuleContext for simple season/cap lookups.
 *
 * This function creates a skeletal RuleContext with placeholder/synthetic values
 * for player and team fields. It is intended for:
 * - Quick cap threshold lookups
 * - Season/timing calculations
 * - Rules that only need cap data (salaryCap, apron thresholds, exceptions)
 *
 * **WARNING**: Do not use this context for player-specific calculations like
 * max salary, Bird rights, or QO amounts - those require full player data.
 * The player fields (yearsOfService, priorSeasonSalary, etc.) are all set to
 * safe defaults (0, null, 'None') and will produce incorrect results if used
 * for actual player rule evaluation.
 *
 * @param seasonId - The season to build context for (e.g., "2024-25" or 2025)
 * @param operationType - Operation type for context (defaults to 'UFA_SIGNING')
 * @returns A RuleContext with real cap data but placeholder player/team data
 * @throws RuleContextValidationError if seasonId is invalid or cap data unavailable
 */
export function buildMinimalRuleContext(
  seasonId: SeasonId | string,
  operationType: OperationType = 'UFA_SIGNING'
): RuleContext {
  const normalized = normalizeToSeasonId(seasonId);
  if (!normalized) {
    throw new RuleContextValidationError(
      'INVALID_SEASON_ID',
      `Invalid seasonId: ${seasonId}`,
      'Cannot build context: invalid season format.'
    );
  }

  const cap = getCapForSeason(normalized);
  if (!cap) {
    const { earliest, latest } = getSupportedSeasonRange();
    throw new RuleContextValidationError(
      'MISSING_CAP_DATA',
      `No cap data for ${normalized}`,
      `Supported seasons: ${earliest} through ${latest}.`
    );
  }

  return {
    timing: {
      operationSeasonId: normalized,
      referenceSeasonId: prevSeason(normalized),
      capSeasonId: normalized,
      phase: 'regular',
      operationDate: new Date(),
    },
    player: {
      playerId: 'unknown',
      displayName: 'Unknown',
      currentTeamId: null,
      yearsOfServiceAtOperation: 0,
      birdTypeAtOperation: 'None',
      priorSeasonSalary: null,
      currentSeasonSalary: null,
      maxPercentBucket: 0.25,
      contractEndSeasonId: null,
      isRookieScale: false,
      draftInfo: null,
    },
    team: {
      teamId: 'unknown',
      teamCode: 'UNK',
      teamSalaryAtOperation: 0,
      apronLevelAtOperation: 'UNDER_CAP',
      capSpaceAtOperation: cap.salaryCap,
      hardCapStatus: {
        isHardCapped: false,
        trigger: null,
        ceiling: cap.firstApron,
      },
      exceptionsAvailable: {
        fullMLE: { available: true, remaining: cap.fullMLE },
        taxpayerMLE: { available: true, remaining: cap.taxpayerMLE },
        roomMLE: { available: true, remaining: cap.roomMLE },
        bae: { available: true, remaining: cap.bae },
        tradeExceptions: [],
      },
    },
    operation: {
      operationType,
      isSignAndTrade: false,
      isExtendAndTrade: false,
    },
    cap,
  };
}
