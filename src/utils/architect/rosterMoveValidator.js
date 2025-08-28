import capProjections from '@/utils/architect/capProjections';
import { canSignFreeAgent } from '@/utils/architect/freeAgentLogic';
import { getExtensionEligibilityReason } from '@/utils/architect/extensionRules';
import { passesRosterWindow } from '@/utils/architect/rosterUtils';

/**
 * Calculate total team salary for a given year
 * @param {Array} players - Array of player objects
 * @param {number} year - The year to calculate salary for
 * @returns {number} Total salary amount
 */
function calculateTeamSalary(players, year) {
  return (players || []).reduce((total, player) => {
    const salary = player.contract_clean?.salaries_by_year?.[year]?.salary || 0;
    return total + salary;
  }, 0);
}

/**
 * Validates a proposed roster move against CBA rules
 * @param {Object} moveData - The roster move details
 * @returns {Object} Validation result with valid flag, reason, warnings, and cap impact
 */
export function validateRosterMove(moveData) {
  const { action, player, contractDetails, teamCapSheet, currentYear, context = {} } = moveData;
  
  if (!action || !player || !teamCapSheet) {
    return { valid: false, reason: 'Missing required data' };
  }

  const result = {
    valid: true,
    reason: '',
    warnings: [],
    capImpact: 0,
    violations: [],
  };

  try {
    switch (action) {
      case 'accept':
        return validateOptionAcceptance(player, teamCapSheet, currentYear, result);
      case 'decline':
        return validateOptionDecline(player, teamCapSheet, currentYear, result);
      case 'extend':
        return validateExtension(player, contractDetails, teamCapSheet, currentYear, result);
      case 'resign':
      case 'signNew':
        return validateFreeAgentSigning(player, contractDetails, teamCapSheet, currentYear, result);
      case 'waive':
      case 'waiveStretch':
      case 'buyout':
        return validateWaive(player, action, teamCapSheet, currentYear, result);
      case 'renounce':
        return validateRenounce(player, teamCapSheet, currentYear, result);
      case 'signAndTrade':
        return validateSignAndTrade(player, contractDetails, teamCapSheet, currentYear, result);
      case 'trade':
        return validateTradeEligibility(player, teamCapSheet, currentYear, result);
      default:
        result.valid = false;
        result.reason = `Unknown action: ${action}`;
        return result;
    }
  } catch (error) {
    console.error('Error validating roster move:', error);
    result.valid = false;
    result.reason = 'Validation error occurred';
    return result;
  }
}

function validateOptionAcceptance(player, teamCapSheet, currentYear, result) {
  const optionYear = getPlayerOptionYear(player, currentYear);
  if (!optionYear) {
    result.valid = false;
    result.reason = 'No option year found';
    return result;
  }

  const optionSalary = player.contract_clean?.salaries_by_year?.[optionYear]?.salary || 0;
  result.capImpact = 0; // Option already counted in cap calculations
  
  // Check if accepting would violate roster limits
  const rosterCheck = checkRosterLimits(teamCapSheet, { action: 'keep', player });
  if (!rosterCheck.valid) {
    result.warnings.push(rosterCheck.reason);
  }

  return result;
}

function validateOptionDecline(player, teamCapSheet, currentYear, result) {
  const optionYear = getPlayerOptionYear(player, currentYear);
  if (!optionYear) {
    result.valid = false;
    result.reason = 'No option year found';
    return result;
  }

  const optionSalary = player.contract_clean?.salaries_by_year?.[optionYear]?.salary || 0;
  result.capImpact = -optionSalary; // Frees up cap space
  
  return result;
}

function validateExtension(player, contractDetails, teamCapSheet, currentYear, result) {
  // Check basic extension eligibility
  const eligibilityReason = getExtensionEligibilityReason(player, currentYear);
  if (eligibilityReason !== 'Eligible') {
    result.valid = false;
    result.reason = eligibilityReason;
    return result;
  }

  // Calculate cap impact
  const totalExtensionValue = contractDetails.salaries.reduce((sum, salary) => sum + salary, 0);
  const currentContract = player.contract_clean?.salaries_by_year || {};
  const currentValue = Object.values(currentContract).reduce((sum, year) => sum + (year.salary || 0), 0);
  
  result.capImpact = totalExtensionValue - currentValue;

  // Check apron restrictions
  const apronCheck = checkApronRestrictions(teamCapSheet, result.capImpact, currentYear);
  if (!apronCheck.valid) {
    result.valid = false;
    result.reason = apronCheck.reason;
    return result;
  }

  return result;
}

function validateFreeAgentSigning(player, contractDetails, teamCapSheet, currentYear, result) {
  // Use contract salary if asking salary not available
  const askingSalary = player.askingSalary || contractDetails.salaries[0] || 0;
  const playerWithSalary = { ...player, askingSalary };
  
  // Check if team can sign the player
  const signingCheck = canSignFreeAgent(playerWithSalary, teamCapSheet, capProjections, currentYear + 1);
  if (!signingCheck.allowed) {
    result.valid = false;
    result.reason = signingCheck.reason;
    return result;
  }

  // Calculate cap impact
  const totalSalary = contractDetails.salaries.reduce((sum, salary) => sum + salary, 0);
  const capHoldAmount = typeof player.cap_hold === 'number' 
    ? player.cap_hold 
    : player.cap_hold?.amount || 0;
  
  result.capImpact = contractDetails.salaries[0] - capHoldAmount; // First year impact

  // Check roster limits
  const rosterCheck = checkRosterLimits(teamCapSheet, { action: 'add', player, contractType: contractDetails.contractType });
  if (!rosterCheck.valid) {
    result.valid = false;
    result.reason = rosterCheck.reason;
    return result;
  }

  // Check exception usage if specified
  if (contractDetails.useException && contractDetails.exceptionType !== 'cap_space') {
    const exceptionCheck = validateExceptionUsage(contractDetails.exceptionType, contractDetails.salaries[0], teamCapSheet);
    if (!exceptionCheck.valid) {
      result.valid = false;
      result.reason = exceptionCheck.reason;
      return result;
    }
  }

  // Check hard cap if team is hard capped
  if (teamCapSheet.hardCapped) {
    const hardCapCheck = checkHardCapCompliance(teamCapSheet, result.capImpact, currentYear);
    if (!hardCapCheck.valid) {
      result.valid = false;
      result.reason = hardCapCheck.reason;
      return result;
    }
  }

  return result;
}

function validateWaive(player, action, teamCapSheet, currentYear, result) {
  const contract = player.contract_clean?.salaries_by_year || {};
  const remainingYears = Object.keys(contract)
    .map(Number)
    .filter(year => year > currentYear);

  if (remainingYears.length === 0) {
    result.valid = false;
    result.reason = 'Player has no remaining contract years';
    return result;
  }

  // Calculate dead cap impact
  const remainingSalary = remainingYears.reduce((sum, year) => 
    sum + (contract[year]?.salary || 0), 0);

  if (action === 'waiveStretch' && remainingYears.length > 1) {
    // Stretch provision: spread over 2n+1 years
    const stretchYears = (remainingYears.length * 2) + 1;
    result.capImpact = remainingSalary / stretchYears; // Annual impact
    result.warnings.push(`Dead cap will be ${formatCurrency(remainingSalary)} over ${stretchYears} years`);
  } else if (action === 'buyout') {
    // Buyout typically reduces the dead cap burden
    const buyoutAmount = remainingSalary * 0.5; // Simplified - actual buyouts vary
    result.capImpact = buyoutAmount;
    result.warnings.push(`Estimated buyout amount: ${formatCurrency(buyoutAmount)}`);
  } else {
    // Standard waive
    result.capImpact = remainingSalary;
  }

  // Check roster minimums after waiving
  const rosterCheck = checkRosterLimits(teamCapSheet, { action: 'remove', player });
  if (!rosterCheck.valid) {
    result.warnings.push(rosterCheck.reason);
  }

  return result;
}

function validateRenounce(player, teamCapSheet, currentYear, result) {
  const capHoldAmount = typeof player.cap_hold === 'number' 
    ? player.cap_hold 
    : player.cap_hold?.amount || 0;
  
  if (capHoldAmount === 0) {
    result.valid = false;
    result.reason = 'Player has no cap hold to renounce';
    return result;
  }

  result.capImpact = -capHoldAmount; // Frees up cap space
  result.warnings.push('Renouncing removes all rights to re-sign this player');
  
  return result;
}

function validateSignAndTrade(player, contractDetails, teamCapSheet, currentYear, result) {
  // Sign and trades have special restrictions
  if (!player.birdRights || player.birdRights === 'None') {
    result.valid = false;
    result.reason = 'Player must have Bird rights for sign-and-trade';
    return result;
  }

  // Check apron restrictions (teams above first apron cannot receive players in S&T)
  const key = `${currentYear + 1}-${String((currentYear + 2) % 100).padStart(2, '0')}`;
  const capData = capProjections[key] || {};
  const teamSalary = calculateTeamSalary(teamCapSheet.players || [], currentYear + 1);
  
  if (teamSalary >= (capData.firstApron || 0)) {
    result.valid = false;
    result.reason = 'Teams above first apron cannot receive sign-and-trade players';
    return result;
  }

  result.capImpact = 0; // Player is being traded away
  result.warnings.push('Sign-and-trade creates hard cap at first apron level');
  
  return result;
}

function validateTradeEligibility(player, teamCapSheet, currentYear, result) {
  // Check if player can be traded (not recently signed, etc.)
  const contract = player.contract_clean;
  if (!contract) {
    result.valid = false;
    result.reason = 'Player has no contract to trade';
    return result;
  }

  // Check for no-trade clauses, recent signing restrictions, etc.
  if (player.noTradeClause) {
    result.valid = false;
    result.reason = 'Player has a no-trade clause';
    return result;
  }

  result.capImpact = 0; // No immediate cap impact for adding to trade machine
  
  return result;
}

// Helper functions

function getPlayerOptionYear(player, currentYear) {
  const contract = player.contract_clean?.salaries_by_year || {};
  return Object.keys(contract)
    .map(Number)
    .find(year => year > currentYear && contract[year]?.option);
}

function checkRosterLimits(teamCapSheet, operation) {
  const currentPlayers = teamCapSheet.players || [];
  let projectedPlayers = [...currentPlayers];
  
  if (operation.action === 'add') {
    projectedPlayers.push(operation.player);
  } else if (operation.action === 'remove') {
    projectedPlayers = projectedPlayers.filter(p => p.name !== operation.player.name);
  }

  const standardPlayers = projectedPlayers.filter(p => 
    p.contract_clean?.contractType !== 'Two-Way'
  );
  
  const twoWayPlayers = projectedPlayers.filter(p => 
    p.contract_clean?.contractType === 'Two-Way'
  );

  const rosterCheck = passesRosterWindow({
    players: standardPlayers,
    twoWayPlayers: twoWayPlayers,
  });

  return {
    valid: rosterCheck.ok,
    reason: rosterCheck.reasons.join(', ')
  };
}

function checkApronRestrictions(teamCapSheet, additionalSalary, currentYear) {
  const key = `${currentYear + 1}-${String((currentYear + 2) % 100).padStart(2, '0')}`;
  const capData = capProjections[key] || {};
  
  const currentSalary = calculateTeamSalary(teamCapSheet.players || [], currentYear + 1);
  const projectedSalary = currentSalary + additionalSalary;
  
  if (projectedSalary >= (capData.secondApron || 0)) {
    return {
      valid: false,
      reason: 'Move would exceed second apron level'
    };
  }
  
  if (projectedSalary >= (capData.firstApron || 0)) {
    return {
      valid: true,
      warnings: ['Move would exceed first apron level']
    };
  }
  
  return { valid: true };
}

function checkHardCapCompliance(teamCapSheet, additionalSalary, currentYear) {
  const key = `${currentYear + 1}-${String((currentYear + 2) % 100).padStart(2, '0')}`;
  const capData = capProjections[key] || {};
  
  const currentSalary = calculateTeamSalary(teamCapSheet.players || [], currentYear + 1);
  const projectedSalary = currentSalary + additionalSalary;
  
  const hardCapLevel = capData.secondApron || 0;
  
  if (projectedSalary > hardCapLevel) {
    return {
      valid: false,
      reason: `Move would exceed hard cap limit of $${hardCapLevel.toLocaleString()}`
    };
  }
  
  return { valid: true };
}

function validateExceptionUsage(exceptionType, salary, teamCapSheet) {
  // Simplified exception validation - would need more complex logic for real implementation
  const exceptions = {
    'mle_full': 12900000,
    'mle_taxpayer': 5000000, 
    'mle_non_taxpayer': 12900000,
    'bae': 4500000,
    'minimum': 2000000, // Approximate vet minimum
  };
  
  const maxAmount = exceptions[exceptionType];
  if (maxAmount && salary > maxAmount) {
    return {
      valid: false,
      reason: `Salary exceeds ${exceptionType} limit of $${maxAmount.toLocaleString()}`
    };
  }
  
  return { valid: true };
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}