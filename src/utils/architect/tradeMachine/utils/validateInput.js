/**
 * Validates trade input data structure and required fields
 * Ensures data meets minimum requirements before normalization
 */

/**
 * Validates a single team's input data
 */
function validateTeamInput(team, index) {
  const errors = [];

  if (!team) {
    errors.push(`Team at index ${index} is undefined`);
    return errors;
  }

  if (!team.team) {
    errors.push(`Team at index ${index} is missing required 'team' object`);
    return errors;
  }

  // Validate required team properties
  if (!team.team.teamName && !team.team.id) {
    errors.push('must have either');
  }

  // Validate player arrays
  const sends = team.sends || [];
  if (!Array.isArray(sends)) {
    errors.push(
      `Team ${team.team.teamName || index}: 'sends' must be an array`
    );
  }

  const picksOut = team.picksOut || [];
  if (!Array.isArray(picksOut)) {
    errors.push(
      `Team ${team.team.teamName || index}: 'picksOut' must be an array`
    );
  }

  // Validate players have minimum required data
  sends.forEach((player, playerIndex) => {
    if (!player) {
      errors.push(
        `Team ${team.team.teamName || index}: Player at index ${playerIndex} in 'sends' is undefined`
      );
      return;
    }

    if (!player.contract_clean?.salaries_by_year) {
      errors.push('missing required salary data');
    }
  });

  // Validate pick data
  picksOut.forEach((pick, pickIndex) => {
    if (!pick) {
      errors.push(
        `Team ${team.team.teamName || index}: Pick at index ${pickIndex} is undefined`
      );
      return;
    }

    if (!pick.year || !pick.round) {
      errors.push('Pick missing required year/round');
    }
  });

  return errors;
}

/**
 * Validates required cap/projection data
 */
function validateCapProjections(capProjections, currentYear) {
  const errors = [];

  if (!capProjections) {
    errors.push('Cap projections are required');
    return errors;
  }

  const seasonKey = `${currentYear - 1}-${String(currentYear).slice(-2)}`;
  const yearCaps = capProjections[seasonKey] || capProjections[currentYear];

  if (!yearCaps) {
    errors.push(
      `Cap projections missing for season ${seasonKey} or year ${currentYear}`
    );
  }

  // Check for minimum required thresholds
  if (yearCaps) {
    if (!yearCaps.salaryCap && !yearCaps.cap) {
      errors.push('Cap projections missing required salary cap value');
    }
  }

  return errors;
}

/**
 * Main entry point for validating trade input
 */
export function validateTradeInput({
  teams,
  capProjections,
  currentYear,
  tradeCtx = {},
}) {
  const errors = [];

  // Validate teams array
  if (!Array.isArray(teams)) {
    errors.push('Teams must be provided as an array');
    return errors;
  }

  if (teams.length < 2) {
    errors.push('Trade must include at least 2 teams');
    return errors;
  }

  if (teams.length > 5) {
    errors.push('Trade cannot include more than 5 teams');
    return errors;
  }

  // Validate each team's data
  teams.forEach((team, index) => {
    const teamErrors = validateTeamInput(team, index);
    errors.push(...teamErrors);
  });

  // Validate cap projections
  const capErrors = validateCapProjections(capProjections, currentYear);
  errors.push(...capErrors);

  // Validate current year
  if (!currentYear || typeof currentYear !== 'number') {
    errors.push('Current year must be provided as a number');
  }

  return errors;
}
