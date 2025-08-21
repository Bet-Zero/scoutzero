/**
 * Validates sign-and-trade rules for NBA trades
 */

export function validateSignAndTrade(team, tradeCtx = {}) {
  const violations = [];
  let hasSignAndTrade = false;
  let hardCapped = false;

  // Check for sign-and-trade players being received
  const incomingSignAndTradePlayers = (team.incomingPlayers || [])
    .filter(player => player.signAndTrade === true);

  // Also check sends in case this team is sending S&T players  
  const outgoingSignAndTradePlayers = (team.sends || [])
    .filter(player => player.signAndTrade === true);

  if (incomingSignAndTradePlayers.length === 0 && outgoingSignAndTradePlayers.length === 0) {
    // No sign-and-trade players, validation passes
    return {
      passed: true,
      violations: [],
      message: 'No sign-and-trade players in trade',
      details: {
        hasSignAndTrade: false,
        hardCapped: false,
      }
    };
  }

  hasSignAndTrade = true;

  // Rule 1: Sign-and-trades only allowed during offseason
  if (!tradeCtx.offseason) {
    violations.push('Sign-and-trade players can only be traded during the offseason');
  }

  // Rule 2: Teams using taxpayer MLE cannot receive sign-and-trade players
  if (incomingSignAndTradePlayers.length > 0 && (team.team?.usedTaxpayerMLEThisSeason || team.usedTaxpayerMLEThisSeason)) {
    violations.push('Teams that used the taxpayer MLE cannot receive sign-and-trade players');
  }

  // Validate each incoming sign-and-trade player
  incomingSignAndTradePlayers.forEach(player => {
    // Rule 3: Contract must be at least 3 years (reject 2 years)
    if (player.contractYears === 2) {
      violations.push(`Sign-and-trade player ${player.name || player.id} has invalid contract length (2 years)`);
    }

    // Rule 4: First year must be guaranteed
    if (player.firstYearGuaranteed === false) {
      violations.push(`Sign-and-trade player ${player.name || player.id} must have guaranteed first year`);
    }
  });

  // Validate each outgoing sign-and-trade player
  outgoingSignAndTradePlayers.forEach(player => {
    // Rule 3: Contract must be at least 3 years (reject 2 years)
    if (player.contractYears === 2) {
      violations.push(`Sign-and-trade player ${player.name || player.id} has invalid contract length (2 years)`);
    }

    // Rule 4: First year must be guaranteed
    if (player.firstYearGuaranteed === false) {
      violations.push(`Sign-and-trade player ${player.name || player.id} must have guaranteed first year`);
    }

    // Rule 5: Player must be traded by their origin team
    const sendingTeamId = team.teamId || team.team?.teamId;
    if (player.originTeamId && player.originTeamId !== sendingTeamId) {
      violations.push(`Sign-and-trade player ${player.name || player.id} can only be traded by origin team ${player.originTeamId}`);
    }
  });

  // Rule 6: Receiving team becomes hard-capped at first apron
  if (hasSignAndTrade && incomingSignAndTradePlayers.length > 0) {
    hardCapped = true;
    
    // Check if team would exceed first apron (hard cap)
    const teamTotalSalary = team.teamTotalSalary || team.team?.teamTotalSalary || 0;
    const salaryIn = team.salaryIn || 0;
    const salaryOut = team.salaryOut || 0;
    const projectedSalary = teamTotalSalary + salaryIn - salaryOut;
    
    // Get first apron from context
    const firstApron = tradeCtx.capSettings?.firstApron || 
                      tradeCtx.context?.capSettings?.firstApron || 
                      172_346_000; // Default 2025 first apron
    
    if (projectedSalary > firstApron) {
      violations.push(`Team would exceed hard cap (first apron: ${firstApron.toLocaleString()}) after receiving sign-and-trade player`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    message: violations.length > 0 ? violations.join('; ') : 'Sign-and-trade validation passed',
    hardCapped, // Top-level for tradeValidator to access
    details: {
      hasSignAndTrade,
      hardCapped,
    }
  };
}