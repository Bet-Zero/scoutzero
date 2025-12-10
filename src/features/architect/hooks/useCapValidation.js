/**
 * useCapValidation Hook
 * 
 * Provides real-time CBA validation for contract actions.
 * Returns warnings (advisory) and errors (blocking on confirm).
 */
import { useMemo } from 'react';
import capProjections from '@/features/architect/utils/capProjections';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { computePlayerRulesProfile } from '@/features/architect/utils/playerRulesProfile';

/**
 * Calculate team's total cap hit for a given year
 */
const calculateTeamCapHit = (players, year) => {
  return (players || []).reduce((sum, player) => {
    const contractType = player?.contractType || player?.contract?.contractType || '';
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
  return capProjections[key] || capProjections['2025-26'];
};

const toSeasonCodeLocal = (endYear) =>
  `${endYear - 1}-${String(endYear % 100).padStart(2, '0')}`;

/**
 * Build a basic league context from a season end year
 */
const getLeagueContextFromYear = (year) => {
  if (!year) return {};
  const startYear = year - 1;
  return {
    currentYear: year,
    currentSeason: toSeasonCodeLocal(year),
    simulationDate: new Date(startYear, 6, 15), // July 15 of start year
  };
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
 */
export function useCapValidation({
  player,
  action,
  contractData = {},
  teamCapSheet,
  currentYear,
  targetYear = null,
  teamContext = {},
  leagueContext = null,
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
    const effectiveLeagueContext =
      leagueContext || getLeagueContextFromYear(actionYear);
    const profile =
      rulesProfile ||
      computePlayerRulesProfile(player, teamContext, effectiveLeagueContext);
    
    const capSettings = getCapSettings(actionYear);
    const teamPlayers = teamCapSheet?.players || [];
    const yearCapHit = calculateTeamCapHit(teamPlayers, actionYear);
    
    const { cap, tax, firstApron, secondApron, fullMLE, taxpayerMLE, bae } = capSettings;
    
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
      const eligibility = profile?.extensionEligibility || {};
      const extMax = profile?.extensionTerms;
      const proposedFirstYear = contractData.salaries?.[0] || 0;

      if (!eligibility.isEligible) {
        errors.push({
          severity: 'error',
          message: eligibility.reason || 'Not extension eligible',
        });
      } else if (extMax) {
        if (
          extMax.maxFirstYearSalary != null &&
          proposedFirstYear > extMax.maxFirstYearSalary
        ) {
          errors.push({
            severity: 'error',
            message: `Exceeds max first year salary ($${(extMax.maxFirstYearSalary / 1000000).toFixed(2)}M)`,
          });
        }

        if (
          extMax.minFirstYearSalary != null &&
          proposedFirstYear < extMax.minFirstYearSalary
        ) {
          errors.push({
            severity: 'error',
            message: `Below minimum first year salary ($${(extMax.minFirstYearSalary / 1000000).toFixed(2)}M)`,
          });
        }
        
        if (extMax.maxYears && contractData.years > extMax.maxYears) {
          errors.push({
            severity: 'error',
            message: `Exceeds max years (${extMax.maxYears} years)`,
          });
        }
        
        if (extMax.maxYears && contractData.years < 1) {
          errors.push({
            severity: 'error',
            message: 'Extension must include at least 1 year',
          });
        }
        
        // Advisory: extension type info
        warnings.push({
          severity: 'info',
          message: `${extMax.extensionType || 'Extension'}: Max ${extMax.maxYears || '?'}yr @ $${extMax.maxFirstYearSalary ? (extMax.maxFirstYearSalary / 1000000).toFixed(1) : '?'}M`,
        });
      }
    }
    
    // ===== RE-SIGNING FREE AGENTS =====
    if (action === 'resign' || action === 'signNew') {
      const proposedSalary = contractData.salaries?.[0] || contractData.base || 0;
      const currentYearCapHit = calculateTeamCapHit(teamPlayers, currentYear);
      const currentCapSettings = getCapSettings(currentYear);
      const projectedCap = currentYearCapHit + proposedSalary;
      
      // Check if team has cap room
      const hasCapRoom = currentYearCapHit < currentCapSettings.cap;
      
      if (!hasCapRoom && proposedSalary > 0) {
        // Over cap - check exception eligibility
        const birdRights = profile?.birdRights?.type || player.contract?.birdRights?.status || 'None';
        
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
        .filter(y => {
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
          const stretchYears = Math.ceil((remainingGuaranteed / (remainingGuaranteed / 3)));
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
  }, [player, action, contractData, teamCapSheet, currentYear, targetYear, teamContext, leagueContext, rulesProfile]);
}

export default useCapValidation;
