/**
 * FILE: src/features/architect/hooks/useCapValidation.ts
 * PURPOSE: Provide real-time CBA validation for Architect contract actions, leveraging PlayerRulesProfile when available.
 * OWNERSHIP: Feature: architect/contracts validation
 *
 * HISTORY:
 *  - 2025-12-10: Added PlayerRulesProfile-aware extension checks (chunk_01).
 *  - 2025-12-10: Added rules profile gating for FA/QO validation (chunk_02).
 *  - 2025-12-12: Unified on rulesProfile, removed legacy extensionRules fallback.
 *  - 2025-12-24: Refactored to use shared capHelpers.js per Step 6 consolidation
 *  - 2026-03-13: E71 migrated authoritative hook implementation to TypeScript.
 *
 * LINKS:
 *  - Plan: plans/_archive/player-rules-architect/plan.md
 *  - Latest Chunk: plans/_archive/player-rules-architect/chunks/chunk_02.md
 *
 * TODO: Track consolidation progress in ARCHITECT_PHASE5_HARDENING.md Step 6
 */
/**
 * useCapValidation Hook
 *
 * Provides real-time CBA validation for contract actions.
 * Returns warnings (advisory) and errors (blocking on confirm).
 *
 * NOTE: This hook now requires rulesProfile for extension validation.
 * If rulesProfile is not provided, extension validation is skipped with
 * an info warning. This ensures consistent behavior via the Salary Engine.
 */
import { useMemo } from 'react';
import type { SignAndTradePreflightResult } from '@/features/architect/utils/mutationPipeline';
import type {
  PlayerRulesProfile,
  PlayerRulesProfileInput,
  PlayerRulesProfileTeamCapSheet,
} from '@/features/architect/types';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import {
  getCapSettings,
  calculateTeamCapHit,
} from '@/features/architect/utils/capHelpers';
import { formatMillions } from '@/shared/utils/formatting/basicFormatting.js';

type ValidationMessage = {
  severity: 'error' | 'warning' | 'info';
  message: string;
};

type SigningGuardrails = {
  source: string;
  minFirstYear: number;
  maxFirstYear: number | null;
  raisePct: number;
  maxYears: number;
  qoAmount: number;
  birdRightsType: string | null;
  canSignToMax: boolean;
};

type PartialOrNull<T> = Partial<NonNullable<T>> | null;
type UseCapValidationRulesProfileFields = Pick<
  PlayerRulesProfile,
  | 'minimumSalary'
  | 'extensionEligibility'
  | 'extensionTerms'
  | 'birdRights'
  | 'maxSalary'
  | 'restrictedFreeAgency'
>;

type UseCapValidationRulesProfile = {
  minimumSalary?: UseCapValidationRulesProfileFields['minimumSalary'];
  extensionEligibility?: PartialOrNull<PlayerRulesProfile['extensionEligibility']>;
  extensionTerms?: PartialOrNull<PlayerRulesProfile['extensionTerms']>;
  birdRights?:
    | (Omit<
        Partial<NonNullable<PlayerRulesProfile['birdRights']>>,
        'signingAbilities'
      > & {
        signingAbilities?: PartialOrNull<
          NonNullable<
            NonNullable<PlayerRulesProfile['birdRights']>['signingAbilities']
          >
        >;
      })
    | null;
  maxSalary?: PartialOrNull<PlayerRulesProfile['maxSalary']>;
  restrictedFreeAgency?: PartialOrNull<PlayerRulesProfile['restrictedFreeAgency']>;
};

type UseCapValidationSalaryRow = {
  season?: unknown;
  salary?: number | null;
  capHit?: number | null;
  guaranteed?: boolean | null;
};

type UseCapValidationContract = Omit<
  NonNullable<PlayerRulesProfileInput['contract']>,
  'freeAgency' | 'salariesByYear'
> & {
  birdRights?: {
    status?: string | null;
  } | null;
  freeAgency?:
    | {
        year?: number | string | null;
        type?: string | null;
      }
    | string
    | null;
  salariesByYear?: UseCapValidationSalaryRow[] | null;
};

type UseCapValidationPlayer = Omit<
  PlayerRulesProfileInput,
  'contract' | 'futureContract' | 'id' | 'playerId' | 'player_id'
> & {
  id?: string | number | null;
  playerId?: string | number | null;
  player_id?: string | number | null;
  contract?: UseCapValidationContract | null;
  futureContract?: UseCapValidationContract | null;
};

type UseCapValidationTeamCapSheet = Omit<
  PlayerRulesProfileTeamCapSheet,
  'players'
> & {
  players?: UseCapValidationPlayer[] | null;
};

type ContractDataLike = {
  guardrails?: SigningGuardrails | null;
  exceptionType?: string | null;
  years?: number | null;
  salaries?: number[] | null;
  base?: number | null;
};

type UseCapValidationParams = {
  player?: UseCapValidationPlayer | null;
  action?: string | null;
  contractData?: ContractDataLike;
  teamCapSheet?: UseCapValidationTeamCapSheet | null;
  currentYear?: number;
  targetYear?: number | null;
  rulesProfile?: UseCapValidationRulesProfile | null;
  signAndTradePreflight?: SignAndTradePreflightResult | null;
};

type UseCapValidationResult = {
  warnings: ValidationMessage[];
  errors: ValidationMessage[];
  isValid: boolean;
  incomplete: boolean;
};

type CapSettingsLike = Partial<NonNullable<ReturnType<typeof getCapSettings>>> & {
  minimumSalary?: number | null;
};

const getResolvedCapSettings = (year: number): CapSettingsLike => {
  return getCapSettings(year) || {};
};

export const buildSigningGuardrails = (
  rulesProfile: UseCapValidationRulesProfile | null = null,
  capSettings: CapSettingsLike = {},
  exceptionType = 'None'
): SigningGuardrails => {
  const minSalary = rulesProfile?.minimumSalary || 0;
  const qoAmount =
    rulesProfile?.restrictedFreeAgency?.qualifyingOfferAmount || 0;
  const minFirstYear = Math.max(minSalary, qoAmount);

  const birdAbilities = rulesProfile?.birdRights?.signingAbilities;
  const birdRightsType = rulesProfile?.birdRights?.type || null;
  const maxSalaryCap = rulesProfile?.maxSalary?.maxSalary ?? null;
  const maxSalaryBird = rulesProfile?.maxSalary?.maxSalaryBird ?? maxSalaryCap;

  const baseMaxFirstYear = (() => {
    if (birdAbilities?.canSignToMax && maxSalaryBird != null) {
      return maxSalaryBird;
    }
    if (birdAbilities?.maxFirstYearSalary != null) {
      return birdAbilities.maxFirstYearSalary;
    }
    return maxSalaryCap;
  })();

  const baseRaisePct =
    birdAbilities?.raisePercentage != null
      ? birdAbilities.raisePercentage
      : 0.05;
  const baseMaxYears =
    birdAbilities?.maxYears ||
    (birdRightsType === 'Full Bird' ? 5 : birdRightsType ? 4 : 4);

  const baseGuardrails = {
    source: birdRightsType || 'Cap Space / Rights',
    minFirstYear,
    maxFirstYear: baseMaxFirstYear,
    raisePct: baseRaisePct,
    maxYears: baseMaxYears,
    qoAmount,
    birdRightsType,
    canSignToMax: birdAbilities?.canSignToMax ?? false,
  };

  const exceptionGuardrails = {
    'Full MLE': {
      source: 'Full MLE',
      maxFirstYear: capSettings.fullMLE ?? null,
      raisePct: 0.05,
      maxYears: 4,
    },
    'Taxpayer MLE': {
      source: 'Taxpayer MLE',
      maxFirstYear: capSettings.taxpayerMLE ?? capSettings.fullMLE ?? null,
      raisePct: 0.05,
      maxYears: 2, // Corrected to match CBA rules and pipeline SIGNING_YEARS_LIMITS.TPMLE
    },
    'Room MLE': {
      source: 'Room MLE',
      maxFirstYear: capSettings.roomMLE ?? capSettings.taxpayerMLE ?? null,
      raisePct: 0.05,
      maxYears: 2,
    },
    BAE: {
      source: 'Bi-Annual Exception',
      maxFirstYear: capSettings.bae ?? null,
      raisePct: 0.05,
      maxYears: 2,
    },
    Minimum: {
      source: 'Minimum',
      maxFirstYear: minFirstYear || capSettings.minimumSalary || null,
      raisePct: 0.05,
      maxYears: 2,
    },
  };

  const selectedGuardrail =
    exceptionType in exceptionGuardrails
      ? exceptionGuardrails[exceptionType as keyof typeof exceptionGuardrails]
      : null;

  const mergedGuardrails = {
    ...baseGuardrails,
    ...(selectedGuardrail || {}),
  };

  const maxFirstYear =
    mergedGuardrails.maxFirstYear != null
      ? Math.max(minFirstYear, mergedGuardrails.maxFirstYear)
      : baseGuardrails.maxFirstYear != null
        ? Math.max(minFirstYear, baseGuardrails.maxFirstYear)
        : null;

  return {
    ...mergedGuardrails,
    maxFirstYear,
    minFirstYear,
  };
};

/**
 * Calculate team's total cap hit for a given year
 * Uses shared calculateTeamCapHit with getContractYearSlice adapter
 */
const calculateTeamCapHitLocal = (
  players: UseCapValidationPlayer[] | null | undefined,
  year: number
) => {
  return calculateTeamCapHit(
    players as Parameters<typeof calculateTeamCapHit>[0],
    year,
    { getContractYearSlice }
  );
};

/**
 * Main validation hook
 * @param {Object} params
 * @param {Object} params.player - The player being acted upon
 * @param {string} params.action - The action type (accept, decline, extend, etc.)
 * @param {Object} params.contractData - Contract details for signings/extensions
 * @param {Object} params.teamCapSheet - Team's current cap sheet
 * @param {number} params.currentYear - The current NBA season end year (e.g., 2026 for 2025-26)
 * @param {number} params.targetYear - The year the action applies to (e.g., option year)
 * @param {Object} params.rulesProfile - PlayerRulesProfile data for the player (optional)
 */
export function useCapValidation({
  player,
  action,
  contractData = {},
  teamCapSheet,
  currentYear,
  targetYear = null,
  rulesProfile = null,
  signAndTradePreflight = null,
}: UseCapValidationParams): UseCapValidationResult {
  return useMemo(() => {
    const warnings: ValidationMessage[] = [];
    const errors: ValidationMessage[] = [];
    let incomplete = false;

    if (!player || !action) {
      return { warnings, errors, isValid: true, incomplete };
    }

    const resolvedCurrentYear =
      currentYear ?? targetYear ?? new Date().getFullYear();

    // Determine which year to use for cap calculations
    // For options/FA, use targetYear (the year clicked); otherwise use currentYear
    const actionYear = targetYear ?? resolvedCurrentYear;

    const capSettings = getResolvedCapSettings(actionYear);
    const teamPlayers = teamCapSheet?.players || [];
    const yearCapHit = calculateTeamCapHitLocal(teamPlayers, actionYear);

    const tax = capSettings.tax ?? Number.POSITIVE_INFINITY;
    const firstApron = capSettings.firstApron ?? Number.POSITIVE_INFINITY;
    const secondApron = capSettings.secondApron ?? Number.POSITIVE_INFINITY;

    // ===== TIMING VALIDATION FOR OPTIONS =====
    if (action === 'accept' || action === 'decline') {
      // Options can only be exercised for the upcoming season
      // e.g., in the 2025-26 season (currentYear=2026), you can only decide on 2026-27 options (targetYear=2027)
      const isActionableOption = targetYear === resolvedCurrentYear + 1;

      if (targetYear && !isActionableOption) {
        if (targetYear < resolvedCurrentYear + 1) {
          errors.push({
            severity: 'error',
            message: `This option has already been decided (past season)`,
          });
        } else {
          // BLOCK future options - they can't be acted on yet
          errors.push({
            severity: 'error',
            message: `Cannot act on this option yet. It can be decided during the ${targetYear - 2}-${String((targetYear - 1) % 100).padStart(2, '0')} offseason.`,
          });
        }
      }

      if (action === 'accept' && targetYear === resolvedCurrentYear + 1) {
        // Calculate what the cap hit would be IF this option is exercised
        // The player's salary is already in yearCapHit if they have contract for that year
        // So we don't need to add it again - the team already committed this
        const projectedCap = yearCapHit;

        // Show cap impact for the option YEAR (not current year)
        if (projectedCap > secondApron) {
          warnings.push({
            severity: 'warning',
            message: `Team is over Second Apron in ${actionYear - 1}-${String(actionYear % 100).padStart(2, '0')} (${formatMillions(projectedCap, 1)} / ${formatMillions(secondApron, 1)})`,
          });
        } else if (projectedCap > firstApron) {
          warnings.push({
            severity: 'warning',
            message: `Team is over First Apron in ${actionYear - 1}-${String(actionYear % 100).padStart(2, '0')} (${formatMillions(projectedCap, 1)})`,
          });
        } else if (projectedCap > tax) {
          warnings.push({
            severity: 'info',
            message: `Team is in luxury tax in ${actionYear - 1}-${String(actionYear % 100).padStart(2, '0')} (${formatMillions(projectedCap, 1)})`,
          });
        } else {
          warnings.push({
            severity: 'info',
            message: `${actionYear - 1}-${String(actionYear % 100).padStart(2, '0')} cap: ${formatMillions(projectedCap, 1)} committed`,
          });
        }
      }
    }

    // ===== EXTENSIONS =====
    if (action === 'extend') {
      if (rulesProfile?.extensionEligibility) {
        const eligibility = rulesProfile.extensionEligibility;
        const terms = rulesProfile.extensionTerms;
        const proposedFirstYear =
          contractData.salaries?.[0] || contractData.base || 0;

        if (!eligibility.isEligible) {
          errors.push({
            severity: 'error',
            message: eligibility.reason || 'Not extension eligible',
          });
        }

        if (terms) {
          if (
            terms.minFirstYearSalary != null &&
            proposedFirstYear < terms.minFirstYearSalary
          ) {
            errors.push({
              severity: 'error',
              message: `Below minimum first year ($${(
                terms.minFirstYearSalary / 1_000_000
              ).toFixed(2)}M)`,
            });
          }

          if (
            terms.maxFirstYearSalary != null &&
            proposedFirstYear > terms.maxFirstYearSalary
          ) {
            errors.push({
              severity: 'error',
              message: `Exceeds max first year ($${(
                terms.maxFirstYearSalary / 1_000_000
              ).toFixed(2)}M)`,
            });
          }

          if (
            contractData.years &&
            terms.maxYears &&
            contractData.years > terms.maxYears
          ) {
            errors.push({
              severity: 'error',
              message: `Exceeds max years (${terms.maxYears} years)`,
            });
          }

          if (eligibility?.isEligible) {
            warnings.push({
              severity: 'info',
              message: `${terms.extensionType || 'Extension'}: Max ${terms.maxYears}yr @ $${(
                ((terms.maxFirstYearSalary || 0) as number) / 1_000_000
              ).toFixed(1)}M`,
            });
          }
        }
      } else {
        // rulesProfile not provided - skip extension validation with info message
        // This ensures we don't use deprecated legacy functions
        // Callers should provide rulesProfile for complete validation
        incomplete = true;
        warnings.push({
          severity: 'info',
          message: 'Extension validation skipped: rulesProfile not provided',
        });
      }
    }

    // ===== RE-SIGNING FREE AGENTS =====
    if (action === 'resign' || action === 'signNew') {
      const currentYearCapHit = calculateTeamCapHitLocal(
        teamPlayers,
        resolvedCurrentYear
      );
      const currentCapSettings = getResolvedCapSettings(resolvedCurrentYear);
      const guardrails =
        contractData.guardrails ||
        buildSigningGuardrails(
          rulesProfile,
          currentCapSettings || {},
          contractData.exceptionType || 'None'
        );

      const contractYears =
        contractData.years ||
        contractData.salaries?.length ||
        0 ||
        (contractData.base ? 1 : 0);
      const salaries = (contractData.salaries || []).slice(
        0,
        contractYears || 1
      );
      const proposedSalary =
        (salaries.length ? salaries[0] : null) || contractData.base || 0;
      const projectedCap = currentYearCapHit + proposedSalary;

      if (guardrails) {
        if (
          guardrails.minFirstYear &&
          proposedSalary < guardrails.minFirstYear
        ) {
          errors.push({
            severity: 'error',
            message: `Below minimum allowed first year ($${(
              guardrails.minFirstYear / 1_000_000
            ).toFixed(2)}M)`,
          });
        }

        if (
          guardrails.maxFirstYear != null &&
          proposedSalary > guardrails.maxFirstYear
        ) {
          errors.push({
            severity: 'error',
            message: `Exceeds allowed first year ($${(
              guardrails.maxFirstYear / 1_000_000
            ).toFixed(2)}M) for ${guardrails.source}`,
          });
        }

        if (guardrails.maxYears && contractYears > guardrails.maxYears) {
          errors.push({
            severity: 'error',
            message: `Exceeds allowed years (${guardrails.maxYears}) for ${guardrails.source}`,
          });
        }

        if (guardrails.raisePct != null && salaries.length > 1) {
          const maxRaisePct = guardrails.raisePct;
          for (let i = 1; i < salaries.length; i += 1) {
            const prevSalary = salaries[i - 1] || 0;
            const allowed = prevSalary * (1 + maxRaisePct + Number.EPSILON);
            if (salaries[i] > allowed) {
              errors.push({
                severity: 'error',
                message: `Year ${i + 1} exceeds allowed raise (${Math.round(
                  maxRaisePct * 100
                )}% max)`,
              });
              break;
            }
          }
        }

        if (rulesProfile?.restrictedFreeAgency?.isRFA) {
          const rfaReason = rulesProfile.restrictedFreeAgency.reason;
          if (rfaReason) {
            warnings.push({
              severity: 'info',
              message: rfaReason,
            });
          }
        }
      }

      // Check if team has cap room
      const hasCapRoom =
        currentYearCapHit < (currentCapSettings.cap ?? Number.POSITIVE_INFINITY);

      if (!hasCapRoom && proposedSalary > 0) {
        // Over cap - check exception eligibility
        const birdRights = player.contract?.birdRights?.status || 'None';
        const fullMLE = currentCapSettings.fullMLE ?? Number.POSITIVE_INFINITY;
        const currentFirstApron =
          currentCapSettings.firstApron ?? Number.POSITIVE_INFINITY;

        if (birdRights === 'None' || birdRights === 'Non-Bird') {
          if (proposedSalary > fullMLE) {
            warnings.push({
              severity: 'warning',
              message: `Exceeds Full MLE ($${(fullMLE / 1000000).toFixed(1)}M) - need exception or Bird Rights`,
            });
          }
        }

        // Hard cap trigger warning
        if (projectedCap > currentFirstApron) {
          warnings.push({
            severity: 'warning',
            message: 'This signing may hard-cap the team at First Apron',
          });
        }
      }

      // Apron warnings
      if (
        projectedCap >
        (currentCapSettings.secondApron ?? Number.POSITIVE_INFINITY)
      ) {
        warnings.push({
          severity: 'warning',
          message: `Signing puts team over Second Apron - limited flexibility`,
        });
      } else if (
        projectedCap >
        (currentCapSettings.firstApron ?? Number.POSITIVE_INFINITY)
      ) {
        warnings.push({
          severity: 'info',
          message: `Signing puts team over First Apron`,
        });
      }
    }

    // ===== WAIVE / STRETCH =====
    if (action === 'waive' || action === 'waiveStretch') {
      const remainingGuaranteed = (player.contract?.salariesByYear || [])
        .filter((y) => {
          const yearNum = parseInt(String(y.season).split('-')[1], 10) + 2000;
          return yearNum >= resolvedCurrentYear && y.guaranteed !== false;
        })
        .reduce((sum, y) => sum + (y.salary || y.capHit || 0), 0);

      if (remainingGuaranteed > 0) {
        warnings.push({
          severity: 'info',
          message: `Dead cap: $${(remainingGuaranteed / 1000000).toFixed(1)}M remaining guaranteed`,
        });

        if (action === 'waiveStretch') {
          const stretchYears = Math.ceil(
            remainingGuaranteed / (remainingGuaranteed / 3)
          );
          warnings.push({
            severity: 'info',
            message: `Stretched over ~${stretchYears} years`,
          });
        }
      }
    }

    // ===== SIGN AND TRADE =====
    if (action === 'signAndTrade') {
      const normalizedPreflight = signAndTradePreflight;

      if (!normalizedPreflight) {
        incomplete = true;
        warnings.push({
          severity: 'warning',
          message:
            'Authoritative sign-and-trade preflight is unavailable.',
        });
      } else {
        normalizedPreflight.warnings.forEach((message) => {
          warnings.push({
            severity: 'warning',
            message,
          });
        });

        if (normalizedPreflight.status === 'blocked') {
          normalizedPreflight.reasons.forEach((message) => {
            errors.push({
              severity: 'error',
              message,
            });
          });
        } else if (normalizedPreflight.status === 'incomplete') {
          incomplete = true;
          normalizedPreflight.reasons.forEach((message) => {
            warnings.push({
              severity: 'warning',
              message,
            });
          });
        }
      }
    }

    const isValid = errors.length === 0;

    return { warnings, errors, isValid, incomplete };
  }, [
    player,
    action,
    contractData,
    teamCapSheet,
    currentYear,
    targetYear,
    rulesProfile,
    signAndTradePreflight,
  ]);
}

export default useCapValidation;
