/**
 * FILE: src/features/architect/hooks/useCapValidation.js
 * PURPOSE: Provide real-time CBA validation for Architect contract actions, leveraging PlayerRulesProfile when available.
 * OWNERSHIP: Feature: architect/contracts validation
 *
 * HISTORY:
 *  - 2025-12-10: Added PlayerRulesProfile-aware extension checks (chunk_01).
 *  - 2025-12-10: Added rules profile gating for FA/QO validation (chunk_02).
 *
 * LINKS:
 *  - Plan: plans/_archive/player-rules-architect/plan.md
 *  - Latest Chunk: plans/_archive/player-rules-architect/chunks/chunk_02.md
 */
/**
 * useCapValidation Hook
 *
 * Provides real-time CBA validation for contract actions.
 * Returns warnings (advisory) and errors (blocking on confirm).
 */
import { useMemo } from 'react';
import capProjections from '@/features/architect/utils/capProjections';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import {
  getExtensionEligibilityReason,
  getExtensionMaxDetails,
} from '@/features/architect/utils/extensionRules';

export const buildSigningGuardrails = (
  rulesProfile = null,
  capSettings = {},
  exceptionType = 'None'
) => {
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
      maxYears: 3,
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
    exceptionGuardrails[exceptionType] ||
    exceptionGuardrails[String(exceptionType)] ||
    null;

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
 */
const calculateTeamCapHit = (players, year) => {
  return (players || []).reduce((sum, player) => {
    const contractType =
      player?.contractType || player?.contract?.contractType || '';
    // Two-way contracts don't count against cap
    if (contractType.toLowerCase() === 'two-way') return sum;

    const slice = getContractYearSlice(player, year);
    return sum + (slice?.capHit ?? slice?.salary ?? 0);
  }, 0);
};

/**
 * Get cap settings for a season
 */
const getCapSettings = (year) => {
  const key = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
  const settings = capProjections[key];
  
  if (!settings) {
    // Log warning if cap data not found, but return latest available
    // to avoid breaking the UI
    const availableSeasons = Object.keys(capProjections).sort((a, b) => {
  if (!settings) {
    // Fall back to latest available season to avoid breaking the UI
    const availableSeasons = Object.keys(capProjections).sort();
    const latestSeason = availableSeasons[availableSeasons.length - 1];
    console.warn(`Cap data not found for ${key}, falling back to ${latestSeason}`);
    return capProjections[latestSeason] || null;
  }
  
  return settings;
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
}) {
  return useMemo(() => {
    const warnings = [];
    const errors = [];

    if (!player || !action) {
      return { warnings, errors, isValid: true };
    }

    // Determine which year to use for cap calculations
    // For options/FA, use targetYear (the year clicked); otherwise use currentYear
    const actionYear = targetYear || currentYear;

    const capSettings = getCapSettings(actionYear);
    const teamPlayers = teamCapSheet?.players || [];
    const yearCapHit = calculateTeamCapHit(teamPlayers, actionYear);

    const { cap, tax, firstApron, secondApron, fullMLE, taxpayerMLE, bae } =
      capSettings;

    // ===== TIMING VALIDATION FOR OPTIONS =====
    if (action === 'accept' || action === 'decline') {
      // Options can only be exercised for the upcoming season
      // e.g., in the 2025-26 season (currentYear=2026), you can only decide on 2026-27 options (targetYear=2027)
      const isActionableOption = targetYear === currentYear + 1;

      if (targetYear && !isActionableOption) {
        if (targetYear < currentYear + 1) {
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

      // Get the salary for the option year
      const slice = getContractYearSlice(player, actionYear);
      const optionSalary = slice?.salary || slice?.capHit || 0;

      if (action === 'accept' && targetYear === currentYear + 1) {
        // Calculate what the cap hit would be IF this option is exercised
        // The player's salary is already in yearCapHit if they have contract for that year
        // So we don't need to add it again - the team already committed this
        const projectedCap = yearCapHit;

        // Show cap impact for the option YEAR (not current year)
        if (projectedCap > secondApron) {
          warnings.push({
            severity: 'warning',
            message: `Team is over Second Apron in ${actionYear - 1}-${String(actionYear % 100).padStart(2, '0')} ($${(projectedCap / 1000000).toFixed(1)}M / $${(secondApron / 1000000).toFixed(1)}M)`,
          });
        } else if (projectedCap > firstApron) {
          warnings.push({
            severity: 'warning',
            message: `Team is over First Apron in ${actionYear - 1}-${String(actionYear % 100).padStart(2, '0')} ($${(projectedCap / 1000000).toFixed(1)}M)`,
          });
        } else if (projectedCap > tax) {
          warnings.push({
            severity: 'info',
            message: `Team is in luxury tax in ${actionYear - 1}-${String(actionYear % 100).padStart(2, '0')} ($${(projectedCap / 1000000).toFixed(1)}M)`,
          });
        } else {
          warnings.push({
            severity: 'info',
            message: `${actionYear - 1}-${String(actionYear % 100).padStart(2, '0')} cap: $${(projectedCap / 1000000).toFixed(1)}M committed`,
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
                (terms.maxFirstYearSalary || 0) / 1_000_000
              ).toFixed(1)}M`,
            });
          }
        }
      } else {
        const eligibilityReason = getExtensionEligibilityReason(
          player,
          currentYear
        );

        if (eligibilityReason !== 'Eligible') {
          errors.push({
            severity: 'error',
            message: eligibilityReason,
          });
        } else {
          const extMax = getExtensionMaxDetails(player, capSettings);
          const proposedFirstYear = contractData.salaries?.[0] || 0;

          if (extMax && proposedFirstYear > extMax.maxFirstYearSalary) {
            errors.push({
              severity: 'error',
              message: `Exceeds max first year salary ($${(extMax.maxFirstYearSalary / 1000000).toFixed(2)}M)`,
            });
          }

          if (extMax && contractData.years > extMax.maxYears) {
            errors.push({
              severity: 'error',
              message: `Exceeds max years (${extMax.maxYears} years)`,
            });
          }

          // Advisory: extension type info
          if (extMax) {
            warnings.push({
              severity: 'info',
              message: `${extMax.type}: Max ${extMax.maxYears}yr @ $${(extMax.maxFirstYearSalary / 1000000).toFixed(1)}M`,
            });
          }
        }
      }
    }

    // ===== RE-SIGNING FREE AGENTS =====
    if (action === 'resign' || action === 'signNew') {
      const currentYearCapHit = calculateTeamCapHit(teamPlayers, currentYear);
      const currentCapSettings = getCapSettings(currentYear);
      const guardrails =
        contractData.guardrails ||
        buildSigningGuardrails(
          rulesProfile,
          currentCapSettings,
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
      const hasCapRoom = currentYearCapHit < currentCapSettings.cap;

      if (!hasCapRoom && proposedSalary > 0) {
        // Over cap - check exception eligibility
        const birdRights = player.contract?.birdRights?.status || 'None';

        if (birdRights === 'None' || birdRights === 'Non-Bird') {
          if (proposedSalary > currentCapSettings.fullMLE) {
            warnings.push({
              severity: 'warning',
              message: `Exceeds Full MLE ($${(currentCapSettings.fullMLE / 1000000).toFixed(1)}M) - need exception or Bird Rights`,
            });
          }
        }

        // Hard cap trigger warning
        if (projectedCap > currentCapSettings.firstApron) {
          warnings.push({
            severity: 'warning',
            message: 'This signing may hard-cap the team at First Apron',
          });
        }
      }

      // Apron warnings
      if (projectedCap > currentCapSettings.secondApron) {
        warnings.push({
          severity: 'warning',
          message: `Signing puts team over Second Apron - limited flexibility`,
        });
      } else if (projectedCap > currentCapSettings.firstApron) {
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
          return yearNum >= currentYear && y.guaranteed !== false;
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
      const currentYearCapHit = calculateTeamCapHit(teamPlayers, currentYear);
      const currentCapSettings = getCapSettings(currentYear);

      warnings.push({
        severity: 'info',
        message: 'Sign-and-trade will hard cap receiving team at First Apron',
      });

      if (currentYearCapHit > currentCapSettings.firstApron) {
        errors.push({
          severity: 'error',
          message: 'Team over First Apron - cannot execute sign-and-trade',
        });
      }
    }

    const isValid = errors.length === 0;

    return { warnings, errors, isValid };
  }, [
    player,
    action,
    contractData,
    teamCapSheet,
    currentYear,
    targetYear,
    rulesProfile,
  ]);
}

export default useCapValidation;
