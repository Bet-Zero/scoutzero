// Handles Base Year Compensation (BYC), trade kicker, and poison pill calculations
// GAP-DATA-001: Now validates BYC player data requirements and surfaces warnings
// GAP-DATA-002: Tracks salary field fallback usage for data quality monitoring
import { getSalaryForYear } from '../../tradeHelpers';
import { BYC_PERCENT } from '../constants/cbaConstants';
import { getCapHitForSeason, normalizeYearInput } from './seasonUtils';
import {
  validateBYCPlayerData,
  validateSalaryFieldData,
  DATA_WARNING_CODES,
  type DataWarning,
} from './dataValidation';
import { getSignAndTradeSalaryForYear } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import { isTwoWayTradePlayer } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
import { GovernedTradeSalaryBasisZ } from '@/schemas/governedTradeSalaryBasis';
import type { GovernedTradeSalaryBasis } from '@/schemas/governedTradeSalaryBasis';

type YearKey = number | string;

type MatchingValueSalarySource =
  | 'signAndTradeContract.salariesByYear.capHit'
  | 'contract.salariesByYear.capHit'
  | 'player.newSalary'
  | 'player.salary';

interface MatchingValueExtensionYear {
  salary?: number | null;
}

interface MatchingValueExtension {
  salary?: number | null;
}

interface MatchingValueContractLike {
  isRookieScale?: boolean;
  isExtension?: boolean;
  isTwoWay?: boolean;
  contractType?: string | null;
  salariesByYear?: Array<Record<string, unknown>>;
}

interface MatchingValueTradeKicker {
  percentage?: number | null;
  waived?: number | null;
  maximum?: number | null;
}

export interface MatchingValuePlayer {
  id?: string | number | null;
  player_id?: string | number | null;
  name?: string | null;
  bio?: {
    displayName?: string | null;
  } | null;
  contract?: MatchingValueContractLike | null;
  primaryContract?: MatchingValueContractLike | null;
  futureContract?: MatchingValueContractLike | null;
  isTwoWay?: boolean;
  contractType?: string | null;
  signAndTrade?: boolean;
  salary?: number | null;
  newSalary?: number | null;
  currentSalary?: number | null;
  previousSalary?: number | null;
  isBYC?: boolean;
  baseYearCompensation?: boolean;
  isPoisonPill?: boolean;
  isRookieScale?: boolean;
  extensionYears?: MatchingValueExtensionYear[] | null;
  extension?: MatchingValueExtension | null;
  tradeKicker?: MatchingValueTradeKicker | null;
  tradeKickerPct?: number | null;
  tradeKickerWaivedPct?: number | null;
  remainingGuaranteedOnCurrentContract?: number | null;
  daysRemainingInSeason?: number | null;
  daysInSeason?: number | null;
  matchOutgoing?: number;
  matchIncoming?: number;
  governedTradeSalaryBasis?: GovernedTradeSalaryBasis | unknown;
}

interface MatchingValueTeam {
  teamId?: string | null;
  sends?: MatchingValuePlayer[];
  dataWarnings?: DataWarning[];
}

export interface GovernedTradeSalaryBasisIssue {
  playerId: string | null;
  teamId: string | null;
  reason: string;
}

interface EffectiveTradeSalaryResult {
  salary: number;
  source: MatchingValueSalarySource;
}

interface ComputeMatchingValuesParams {
  teams?: MatchingValueTeam[];
  yearKey: YearKey;
  daysRemainingInSeason?: number;
  daysInSeason?: number;
  worldId?: string | null;
  asOfDate?: string | null;
  requireGovernedSalaryBasis?: boolean;
}

interface ComputeMatchingValuesResult {
  dataWarnings: DataWarning[];
  hasBYCDataIssues: boolean;
  hasSalaryFieldIssues: boolean;
  salaryBasisIssues: GovernedTradeSalaryBasisIssue[];
}

function getRookieScaleAndPoisonPillFlags(player: MatchingValuePlayer) {
  const contract = player.contract || player.primaryContract;
  const isRookieScale =
    contract?.isRookieScale || player.isRookieScale || false;
  const isPoisonPill = player.isPoisonPill || isRookieScale;

  return {
    contract,
    isRookieScale,
    isPoisonPill,
  };
}

function getExtensionYearsForMatching(
  player: MatchingValuePlayer
): MatchingValueExtensionYear[] {
  if (Array.isArray(player.extensionYears) && player.extensionYears.length > 0) {
    return player.extensionYears;
  }
  if (
    player.futureContract?.isExtension === true &&
    Array.isArray(player.futureContract.salariesByYear)
  ) {
    return player.futureContract.salariesByYear.map((row) => ({
      salary:
        typeof row.salary === 'number'
          ? row.salary
          : typeof row.capHit === 'number'
            ? row.capHit
            : 0,
    }));
  }
  return [];
}

/**
 * @deprecated LEGACY HELPER - DO NOT USE IN VALIDATION PATHS
 *
 * This function has an incorrect poison-pill formula that differs from the
 * canonical implementation in `computeMatchingValues()`.
 *
 * Legacy bug (lines 49-55):
 *   extensionAvg = sum(extensionYears) / extensionYears.length
 *   result = (salary + extensionAvg) / 2
 *
 * Canonical formula (correct):
 *   result = (currentSalary + sum(extensionYears)) / (1 + extensionYears.length)
 *
 * Example: $10M current + [$20M, $22M, $24M] extension
 *   - Legacy: ($10M + $22M) / 2 = $16M  ❌
 *   - Canonical: $76M / 4 = $19M  ✅
 *
 * This function is ONLY used as a salary fallback in normalizeTradeInput.ts
 * when player.salary is missing. The actual validation uses computeMatchingValues().
 *
 * @see computeMatchingValues - The canonical implementation for validation
 */
export function getMatchingValue(
  player: MatchingValuePlayer,
  yearKey: YearKey,
  isOutgoing = false
): number {
  if (isTwoWayTradePlayer(player)) {
    return 0;
  }

  const salary = getSalaryForYear(player, yearKey);

  // For outgoing BYC players, use max(prior, 50% new salary)
  if (isOutgoing && (player.isBYC || player.baseYearCompensation)) {
    const prevSalary = player.previousSalary || 0;
    const newSalary = player.newSalary || salary;
    return Math.max(prevSalary, Math.floor(newSalary * BYC_PERCENT));
  }

  // For trade kicker, only apply to incoming value
  if (!isOutgoing && player.tradeKickerPct) {
    const kickerAmt = salary * player.tradeKickerPct;
    const waivedAmt = kickerAmt * (player.tradeKickerWaivedPct || 0);
    const effectiveKicker = kickerAmt - waivedAmt;

    // Pro-rate by days remaining if specified
    const proRatedKicker =
      player.daysRemainingInSeason && player.daysInSeason
        ? effectiveKicker * (player.daysRemainingInSeason / player.daysInSeason)
        : effectiveKicker;

    // Cap kicker at remaining guaranteed money
    const remaining = player.remainingGuaranteedOnCurrentContract || 0;
    const maxKicker = Math.max(0, remaining - salary);

    return salary + Math.min(proRatedKicker, maxKicker);
  }

  // For poison pill players, use average of current + extension years for incoming
  // Check isRookieScale flag from new schema
  const { isPoisonPill } = getRookieScaleAndPoisonPillFlags(player);

  const extensionYears = getExtensionYearsForMatching(player);
  if (!isOutgoing && isPoisonPill && extensionYears.length > 0) {
    const extensionTotal = extensionYears.reduce(
      (sum, year) => sum + (year.salary || 0),
      0
    );
    const extensionAvg = extensionTotal / extensionYears.length;
    return (salary + extensionAvg) / 2;
  }

  return salary;
}

export function getEffectiveTradeSalaryForPlayer(
  player: MatchingValuePlayer,
  yearKey: YearKey
): EffectiveTradeSalaryResult {
  if (player?.signAndTrade === true) {
    const signAndTradeSalary = getSignAndTradeSalaryForYear(player, yearKey, {
      allowPlayerContractFallback: true,
    });
    if (signAndTradeSalary > 0) {
      return {
        salary: signAndTradeSalary,
        source: 'signAndTradeContract.salariesByYear.capHit',
      };
    }
  }

  const normalized = normalizeYearInput(yearKey);
  if (normalized) {
    const contractSalary = getCapHitForSeason(player, normalized.seasonString);
    if (contractSalary > 0) {
      return {
        salary: contractSalary,
        source: 'contract.salariesByYear.capHit',
      };
    }
  }

  const fallbackSalary = player.newSalary || player.salary || 0;
  return {
    salary: fallbackSalary,
    source: player.newSalary ? 'player.newSalary' : 'player.salary',
  };
}

export function computeMatchingValues({
  teams = [],
  yearKey,
  daysRemainingInSeason,
  daysInSeason,
  worldId = null,
  asOfDate = null,
  requireGovernedSalaryBasis = false,
}: ComputeMatchingValuesParams): ComputeMatchingValuesResult {
  // GAP-DATA-001, GAP-DATA-002: Collect data validation warnings
  const allDataWarnings: DataWarning[] = [];
  const salaryBasisIssues: GovernedTradeSalaryBasisIssue[] = [];

  teams.forEach((team) => {
    const teamWarnings: DataWarning[] = [];

    (team.sends || []).forEach((player) => {
      const { salary: baseSalary, source: salarySource } =
        getEffectiveTradeSalaryForPlayer(player, yearKey);

      if (isTwoWayTradePlayer(player)) {
        player.matchOutgoing = 0;
        player.matchIncoming = 0;
        return;
      }

      if (
        requireGovernedSalaryBasis &&
        worldId &&
        player.signAndTrade !== true
      ) {
        const parsed = GovernedTradeSalaryBasisZ.safeParse(
          player.governedTradeSalaryBasis
        );
        const playerId =
          String(player.id ?? player.player_id ?? '').trim() || null;
        const teamId = String(team.teamId ?? '').trim() || null;
        const expectedDate =
          typeof asOfDate === 'string' ? asOfDate.slice(0, 10) : null;
        if (!parsed.success) {
          salaryBasisIssues.push({
            playerId,
            teamId,
            reason:
              'Governed player salary-basis authority is missing or malformed.',
          });
          player.matchOutgoing = 0;
          player.matchIncoming = 0;
          return;
        }
        const authority = parsed.data;
        const normalizedYear = normalizeYearInput(yearKey);
        const identityMatches =
          authority.worldId === worldId &&
          authority.teamId === teamId &&
          authority.playerId === playerId &&
          authority.salaryCapYear === normalizedYear?.endYear &&
          authority.asOfDate === expectedDate;
        if (
          authority.status !== 'ready' ||
          !identityMatches ||
          authority.outgoingSalary === null ||
          authority.incomingSalary === null
        ) {
          salaryBasisIssues.push({
            playerId,
            teamId,
            reason: !identityMatches
              ? 'Governed player salary-basis authority does not match this Team Plan, team, player, date, or Salary Cap Year.'
              : authority.reasons.join(' ') ||
                'Governed player salary-basis authority needs input.',
          });
          player.matchOutgoing = 0;
          player.matchIncoming = 0;
          return;
        }
        player.matchOutgoing = authority.outgoingSalary;
        player.matchIncoming =
          authority.poisonPillIncomingSalary ?? authority.incomingSalary;
        return;
      }

      if (
        salarySource === 'player.newSalary' ||
        salarySource === 'player.salary'
      ) {
        // GAP-DATA-002: Track salary field fallback usage
        const salaryWarnings = validateSalaryFieldData(player, yearKey, {
          salarySource,
          salaryValue: baseSalary,
        });
        teamWarnings.push(...salaryWarnings);
      }

      // GAP-DATA-001: Validate BYC player data requirements
      const bycWarnings = validateBYCPlayerData(player);
      teamWarnings.push(...bycWarnings);

      // Start with base salary for both
      player.matchOutgoing = baseSalary;
      player.matchIncoming = baseSalary;

      // Apply BYC to outgoing value first
      if (player.isBYC || player.baseYearCompensation) {
        const prevSalary = player.previousSalary || 0;
        const newSalary = baseSalary; // Use the actual salary from contract
        // BYC: max(previous salary, 50% of new salary)
        const fiftyPercentNew = Math.floor(newSalary * BYC_PERCENT); // BYC_PERCENT = 0.5
        player.matchOutgoing = Math.max(prevSalary, fiftyPercentNew);
      }

      // Apply poison pill average (only for rookie scale extensions)
      // Check isRookieScale flag from new schema
      const { isPoisonPill } = getRookieScaleAndPoisonPillFlags(player);

      if (isPoisonPill) {
        const currentSalary = player.currentSalary || baseSalary;
        let averageSalary;
        const extensionYears = getExtensionYearsForMatching(player);

        // Prefer the canonical governed future Contract, while retaining the
        // older extensionYears ingress for pre-governed snapshots.
        if (extensionYears.length > 0) {
          // Calculate average of current salary + all extension years
          const extensionTotal = extensionYears.reduce(
            (sum, year) => sum + (year.salary || 0),
            0
          );
          const totalSalaries = currentSalary + extensionTotal;
          const totalYears = 1 + extensionYears.length;
          averageSalary = Math.floor(totalSalaries / totalYears);
        } else if (player.extension && player.extension.salary) {
          // Legacy single extension format
          const extensionSalary = player.extension.salary || 0;
          averageSalary = Math.floor((currentSalary + extensionSalary) / 2);
        } else {
          // No extension data, use current salary
          averageSalary = currentSalary;
        }

        // For incoming: always use average
        player.matchIncoming = averageSalary;

        // For outgoing: use current salary unless BYC overrides it
        if (!player.isBYC && !player.baseYearCompensation) {
          player.matchOutgoing = currentSalary;
        }
      }

      // Apply trade kicker to incoming value only
      if (player.tradeKicker || player.tradeKickerPct) {
        // Handle both object format and direct percentage format
        const percentage =
          player.tradeKicker?.percentage || player.tradeKickerPct || 0;
        const waivedPct =
          player.tradeKicker?.waived || player.tradeKickerWaivedPct || 0;
        const maxKicker = player.tradeKicker?.maximum ?? Infinity;

        // Calculate raw kicker based on baseSalary (NOT guaranteed amount)
        const kickerAmount = Math.floor(baseSalary * percentage);

        // Apply maximum cap from tradeKicker.maximum
        const effectiveKicker = Math.min(kickerAmount, maxKicker);

        let finalKicker = effectiveKicker;

        // Check if remainingGuaranteedOnCurrentContract is explicitly set
        // Use nullish coalescing to distinguish between explicit 0 and undefined
        const hasExplicitGuaranteed =
          player.remainingGuaranteedOnCurrentContract !== undefined;
        const remainingGuaranteed = player.remainingGuaranteedOnCurrentContract;

        // Handle explicit zero guaranteed money - no kicker should apply
        if (hasExplicitGuaranteed && remainingGuaranteed === 0) {
          finalKicker = 0;
        } else if (remainingGuaranteed && remainingGuaranteed > baseSalary) {
          // Handle guaranteed money constraints
          const maxAvailableKicker = remainingGuaranteed - baseSalary;

          // For BYC players or when no timing specified, use enhanced kicker
          if (
            !daysRemainingInSeason ||
            !daysInSeason ||
            player.isBYC ||
            player.baseYearCompensation
          ) {
            const enhancedKicker = effectiveKicker * 2; // Double for these cases
            // Note: maxKicker must be applied here because enhancedKicker could exceed it
            finalKicker = Math.min(
              maxAvailableKicker,
              enhancedKicker,
              maxKicker
            );
          } else {
            // For timing cases, don't apply proration if guaranteed amount allows full kicker
            const proratedKicker = Math.floor(
              effectiveKicker * (daysRemainingInSeason / daysInSeason)
            );
            const fullKicker = effectiveKicker;

            // Use full kicker if guaranteed money allows it, otherwise use prorated
            if (maxAvailableKicker >= fullKicker) {
              finalKicker = fullKicker;
            } else {
              finalKicker = Math.min(maxAvailableKicker, proratedKicker);
            }
          }
        } else if (daysRemainingInSeason && daysInSeason) {
          // Standard proration when no guaranteed constraint
          finalKicker = Math.floor(
            effectiveKicker * (daysRemainingInSeason / daysInSeason)
          );
        }

        // Apply waivers AFTER determining the base kicker amount
        if (waivedPct > 0 && !remainingGuaranteed) {
          // Only apply waiver reduction if no guaranteed money constraint
          finalKicker = Math.floor(finalKicker * (1 - waivedPct));
        }

        player.matchIncoming += finalKicker;
      }

      // Handle BYC + poison pill coexistence
      if (
        (player.isBYC || player.baseYearCompensation) &&
        player.isPoisonPill &&
        player.extension
      ) {
        // For outgoing: BYC rule applies to the poison pill average
        const currentSalary = player.currentSalary || baseSalary;
        const extensionSalary = player.extension.salary || 0;
        const averageSalary = (currentSalary + extensionSalary) / 2;

        const prevSalary = player.previousSalary || 0;
        const fiftyPercentAvg = Math.floor(averageSalary * BYC_PERCENT);
        player.matchOutgoing = Math.max(prevSalary, fiftyPercentAvg);
      }
    });

    // Attach data warnings to team for visibility
    team.dataWarnings = teamWarnings;
    allDataWarnings.push(...teamWarnings);
  });

  // Return data warnings for integration with validation results
  return {
    dataWarnings: allDataWarnings,
    hasBYCDataIssues: allDataWarnings.some(
      (warning) => warning.code === DATA_WARNING_CODES.BYC_MISSING_PREVIOUS_SALARY
    ),
    hasSalaryFieldIssues: allDataWarnings.some(
      (warning) =>
        warning.code === DATA_WARNING_CODES.SALARY_FIELD_FALLBACK ||
        warning.code === DATA_WARNING_CODES.SALARY_FIELD_MISSING
    ),
    salaryBasisIssues,
  };
}

// @deprecated Currently unused - reserved for future BYC calculations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _computeBYCOutgoing(player: MatchingValuePlayer) {
  if (!player.isBYC) return player.newSalary;

  // For BYC players, outgoing value is max of:
  // 1. Previous salary
  // 2. 50% of new salary
  const halfNewSalary = Math.floor((player.newSalary || 0) * BYC_PERCENT);
  return Math.max(player.previousSalary || 0, halfNewSalary);
}
