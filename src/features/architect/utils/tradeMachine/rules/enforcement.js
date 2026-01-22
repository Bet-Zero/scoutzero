const defaultContext = {
  asOfDate: new Date().toISOString(),
  daysUntilTrade: 0,
  daysInSeason: 177,
};

export function enforceConsent(team, { reject = () => {} } = {}) {
  const violations = [];
  const { incomingPlayers = [] } = team;

  incomingPlayers.forEach((player) => {
    if (player.hasNTC && !player.consent) {
      reject('Player NTC — consent required');
      violations.push('Player NTC — consent required');
    }

    if (player.limitedNTC?.length && !player.consent) {
      if (!player.ntcTeamList?.includes(team.teamId)) {
        reject('Player NTC — consent required');
        violations.push('Player NTC — consent required');
      }
    }

    if (player.hasBirdVeto && !player.consent) {
      reject('1-yr Bird veto — consent required');
      violations.push('1-yr Bird veto — consent required');
    }
  });

  return violations;
}

export function enforceTiming(
  team,
  ctx = defaultContext,
  { reject = () => {} } = {}
) {
  const violations = [];
  const { incomingPlayers = [] } = team;
  const { asOfDate } = ctx;
  const currentDate = new Date(asOfDate);

  incomingPlayers.forEach((player) => {
    if (player.moratoriumEnd && new Date(player.moratoriumEnd) > currentDate) {
      reject('Player cannot be traded during moratorium period');
      violations.push('Player cannot be traded during moratorium period');
    }

    if (player.eligibleDate && new Date(player.eligibleDate) > currentDate) {
      reject(
        `Player cannot be traded until ${new Date(player.eligibleDate).toLocaleDateString()}`
      );
      violations.push(
        `Player cannot be traded until ${new Date(player.eligibleDate).toLocaleDateString()}`
      );
    }

    if (player.signedDate) {
      const signDate = new Date(player.signedDate);
      const daysSinceSigned = (currentDate - signDate) / (1000 * 60 * 60 * 24);
      if (daysSinceSigned < 30) {
        reject('Player cannot be traded within 30 days of signing');
        violations.push('Player cannot be traded within 30 days of signing');
      }
    }
  });

  return violations;
}

export function enforceEligibility(
  team,
  ctx = defaultContext,
  { reject = () => {} } = {}
) {
  const violations = [];
  const { incomingPlayers = [] } = team;
  const { asOfDate } = ctx;
  const currentDate = new Date(asOfDate);

  incomingPlayers.forEach((player) => {
    if (player.lastTradedFrom === team.teamId) {
      const lastTradeDate = new Date(player.lastTradeDate);
      const daysSince = (currentDate - lastTradeDate) / (1000 * 60 * 60 * 24);

      if (daysSince < 365) {
        reject('Cannot reacquire player within 1 year of trading them');
        violations.push(
          'Cannot reacquire player within 1 year of trading them'
        );
      }
    }
  });

  return violations;
}

export function enforceRosterWindow(
  team,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx = {},
  { reject = () => {} } = {}
) {
  const violations = [];
  const { projectedRosterCount = 0, projectedTwoWayCount = 0 } = team;

  if (projectedRosterCount < 14) {
    reject('Roster cannot fall below 14 players');
    violations.push('Roster cannot fall below 14 players');
  }
  if (projectedRosterCount > 15) {
    reject('Roster cannot exceed 15 players');
    violations.push('Roster cannot exceed 15 players');
  }

  if (projectedTwoWayCount > 3) {
    violations.push('Two-way slots exceeded (4/3)');
  }

  return violations;
}

// Phase 35: Fixed import - enforceSecondApronHandcuffs is in basicRules.js, not a separate file
export { enforceSecondApronHandcuffs } from './basicRules.js';
