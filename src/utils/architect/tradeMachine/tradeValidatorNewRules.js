// tradeValidatorNewRules.js

// ===== CONSTANTS =====
const CBA_THRESHOLDS = {
  FIRST_APRON: 172_295_000,
  SECOND_APRON: 182_794_000,
  MIN_SALARY: 1_119_563,
  MAX_CASH: 7_100_000,
  TRADE_BUFFER: 100_000,
  STEPIEN_YEARS: 7, // Max future draft pick years
};

// ===== NEW VALIDATION RULES =====

// 1. TRADE EXCEPTIONS (TPEs)
export function validateTradeExceptions(team) {
  const violations = [];

  team.incomingPlayers.forEach((player) => {
    if (player.acquiredViaTPE) {
      const index = team.tradeExceptions.findIndex((e) => e.id === player.tpeId);
      const tpe = team.tradeExceptions[index];
      if (!tpe) {
        violations.push(`No valid TPE found for ${player.name}`);
      } else {
        const remaining =
          typeof tpe.remaining === 'number' ? tpe.remaining : tpe.amount;
        const expiry = tpe.expiry || tpe.expirationDate;
        const expired = expiry ? new Date(expiry) < new Date() : false;
        if (remaining < player.salary) {
          violations.push(
            `TPE too small for ${player.name} ($${player.salary} > $${remaining})`
          );
        } else if (expired) {
          const date = new Date(expiry);
          violations.push(`TPE expired on ${date.toLocaleDateString()}`);
        } else {
          team.tradeExceptions[index] = {
            ...tpe,
            remaining: remaining - player.salary,
            isUsed: true,
          };
        }
      }
    }
  });

  return violations;
}

// 2. DRAFT PICKS
export function validateDraftPicks(team, allTeams) {
  const violations = [];
  const currentYear = new Date().getFullYear();

  // Stepien Rule (no consecutive 1sts)
  const tradedFirsts = team.tradedPicks
    .filter((p) => p.round === 1 && !p.isProtected)
    .map((p) => p.year)
    .sort();

  for (let i = 0; i < tradedFirsts.length - 1; i++) {
    if (tradedFirsts[i + 1] === tradedFirsts[i] + 1) {
      violations.push(
        `Cannot trade ${tradedFirsts[i]} and ${tradedFirsts[i + 1]} 1st-round picks`
      );
    }
  }

  const limit = currentYear + CBA_THRESHOLDS.STEPIEN_YEARS;
  const distantPicks = team.tradedPicks.filter((p) => p.year > limit);
  if (distantPicks.length > 0) {
    violations.push(`Cannot trade picks beyond ${limit} (7 years out)`);
  }

  return violations;
}

// 3. ROSTER LIMITS
export function validateRosterLimits(team) {
  const violations = [];
  const postTradeRosterSize =
    team.currentRoster.length - team.sends.length + team.incomingPlayers.length;

  if (postTradeRosterSize > 15) {
    violations.push(`Roster would exceed 15 players (${postTradeRosterSize})`);
  }

  if (postTradeRosterSize < 14) {
    violations.push(
      `Roster would fall below 14 players (${postTradeRosterSize})`
    );
  }

  return violations;
}

// 4. CASH CONSIDERATIONS
export function validateCash(team) {
  const violations = [];

  if (team.cashSent > CBA_THRESHOLDS.MAX_CASH) {
    violations.push(
      `Cash sent ($${team.cashSent}) exceeds $${CBA_THRESHOLDS.MAX_CASH} limit`
    );
  }

  if ((team.overSecondApron || team.willBeOverSecond) && team.cashSent > 0) {
    violations.push('Second apron team cannot include cash in trades');
  }

  return violations;
}

// 5. SIGN-AND-TRADE RULES
export function validateSignAndTrade(team) {
  const violations = [];
  const sntPlayers = team.incomingPlayers.filter((p) => p.isSignAndTrade);

  if (sntPlayers.length > 0) {
    // Hard cap check
    if (team.projectedSalary > CBA_THRESHOLDS.FIRST_APRON) {
      violations.push('Sign-and-trade would hard-cap team at 1st apron');
    }

    // Contract length check
    sntPlayers.forEach((p) => {
      if (p.contractYears < 3 || p.contractYears > 4) {
        violations.push(`S&T contract for ${p.name} must be 3-4 years`);
      }
    });
  }

  return violations;
}

// 6. BASE YEAR COMPENSATION
export function validateBYC(team) {
  const violations = [];

  team.incomingPlayers.forEach((p) => {
    if (p.isBYC) {
      const bycValue = p.previousSalary * 1.2;
      if (p.salary > bycValue) {
        violations.push(
          `BYC restriction: ${p.name}'s salary ($${p.salary}) > 120% of previous ($${bycValue})`
        );
      }
    }
  });

  return violations;
}

export function validateSecondApronAggregation(team) {
  const violations = [];
  if (!team.overSecondApron && !team.willBeOverSecond) return violations;

  const outgoing = team.sends.map((p) => p.salary || 0).sort((a, b) => b - a);
  const incoming = team.incomingPlayers
    .map((p) => p.salary || 0)
    .sort((a, b) => b - a);

  let aggregated = false;
  if (team.sends.length === 1) {
    const maxOut = outgoing[0];
    incoming.forEach((s) => {
      if (s > maxOut) aggregated = true;
    });
  } else {
    incoming.forEach((s, i) => {
      if (s > (outgoing[i] || 0)) aggregated = true;
    });
  }

  if (aggregated) {
    violations.push('Second apron team cannot aggregate salaries');
  }
  if (incoming.reduce((a, b) => a + b, 0) > outgoing.reduce((a, b) => a + b, 0)) {
    violations.push('Second apron team cannot receive more salary than sent');
  }

  return violations;
}

// ===== MAIN VALIDATOR INTEGRATION =====
export function validateAllNewRules(team, allTeams) {
  return [
    ...validateTradeExceptions(team),
    ...validateDraftPicks(team, allTeams),
    ...validateRosterLimits(team),
    ...validateCash(team),
    ...validateSignAndTrade(team),
    ...validateBYC(team),
    ...validateSecondApronAggregation(team),
  ];
}
