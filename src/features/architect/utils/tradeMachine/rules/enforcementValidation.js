/**
 * Comprehensive trade enforcement
 * Consolidated from: enforceEligibility.js + enforceConsent.js + enforcement.js
 */

import { validationFlags } from '@/config/validationFlags.js';

// Try to import getApronStatus, fall back to no-op
let getApronStatus;
try {
  ({ getApronStatus } = require('../../capUtils.js'));
} catch {
  getApronStatus = () => ({ isFirstApron: false, isSecondApron: false });
}

const defaultContext = {
  asOfDate: new Date().toISOString(),
  daysUntilTrade: 0,
  daysInSeason: 177,
};

/**
 * Enforces player eligibility restrictions
 * (Consolidated from enforceEligibility.js)
 */
export function enforceEligibility(
  team,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const { incomingPlayers = [] } = team;
  const violations = [];

  // Check re-acquisition restrictions
  incomingPlayers.forEach((player) => {
    // Check for traded players (support multiple property names)
    const lastTradedFromTeam = player.lastTradedFrom || player.lastTradedFromTeamId;
    if (lastTradedFromTeam === team.teamId) {
      const lastTradeDate = player.lastTradeDate
        ? new Date(player.lastTradeDate)
        : null;
      const tradeDate = tradeCtx.asOfDate
        ? new Date(tradeCtx.asOfDate)
        : new Date();

      // One year from trade date
      if (
        lastTradeDate &&
        tradeDate - lastTradeDate < 365 * 24 * 60 * 60 * 1000
      ) {
        violations.push(
          `Re-acquisition bar: Cannot reacquire ${player.name || 'player'} until one year after trading them`
        );
      }
    }

    // Check waiver history (support multiple property names)
    const wasWaivedByTeam = player.lastWaivedFrom || player.wasWaivedByTeamId;
    if (wasWaivedByTeam === team.teamId) {
      const waivedDate = player.waivedDate || player.contractEndDate ? new Date(player.waivedDate || player.contractEndDate) : null;
      const july1 = new Date(waivedDate?.getFullYear() + 1, 6, 1); // July is 6 in JS dates
      const tradeDate = tradeCtx.asOfDate
        ? new Date(tradeCtx.asOfDate)
        : new Date();

      if (waivedDate && tradeDate < july1) {
        violations.push(
          `Re-acquisition bar: Cannot reacquire ${player.name || 'player'} until July 1 after waiving them`
        );
      }
    }
  });

  violations.forEach((msg) => {
    if (validationFlags.eligibility === 'warn') {
      warn(msg);
    } else {
      reject(msg);
    }
  });

  return violations;
}

/**
 * Enforces player consent requirements (NTC, Bird rights veto, etc.)
 * (Consolidated from enforceConsent.js)
 */
export function enforceConsent(
  team,
  context = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const { outgoingPlayers = [], incomingPlayers = [] } = team;
  const enforcement = validationFlags.consent || 'error';

  const violations = [];

  // Check outgoing players for consent issues
  outgoingPlayers.forEach((player) => {
    let violationMsg = null;

    // Full no-trade clause
    if (
      (player.hasFullNTC || player.noTradeClause) &&
      !player.consentGranted &&
      !player.hasConsented
    ) {
      violationMsg = 'Player NTC — consent required';
    }

    // Limited no-trade clause
    if (player.limitedNTCTeamIds && Array.isArray(player.limitedNTCTeamIds)) {
      // If player is being traded to a team NOT on their approved list
      if (
        player.tradeTo &&
        !player.limitedNTCTeamIds.includes(player.tradeTo) &&
        !player.consentGranted
      ) {
        violationMsg = 'Player NTC — consent required';
      }
    }

    // Bird rights veto (1-year Bird deals)
    if (player.onOneYearBirdDeal && !player.consentGranted) {
      violationMsg = '1-yr Bird veto — consent required';
    }

    if (violationMsg) {
      violations.push(violationMsg);
      if (enforcement === 'warn') {
        warn(violationMsg);
      } else {
        reject(violationMsg);
      }
    }
  });

  // Check incoming players for consent issues
  incomingPlayers.forEach((player) => {
    let violationMsg = null;

    // Full no-trade clause
    if (
      (player.hasFullNTC || player.hasFullNoTrade) &&
      !player.hasTradeConsent &&
      !player.consentGranted
    ) {
      violationMsg = `${player.name} has not waived their no-trade clause`;
    }

    // Limited no-trade clause
    if (player.limitedNTCTeamIds && Array.isArray(player.limitedNTCTeamIds)) {
      if (
        !player.limitedNTCTeamIds.includes(team.teamId) &&
        !player.hasTradeConsent &&
        !player.consentGranted
      ) {
        violationMsg = `${player.name} has not approved a trade to ${team.teamName}`;
      }
    }

    // Bird rights veto
    if (
      (player.hasBirdRightsVeto || player.onOneYearBirdDeal) &&
      !player.hasTradeConsent &&
      !player.consentGranted
    ) {
      violationMsg = `${player.name} has not waived their Bird rights veto`;
    }

    if (violationMsg) {
      violations.push(violationMsg);
      if (enforcement === 'warn') {
        warn(violationMsg);
      } else {
        reject(violationMsg);
      }
    }
  });

  return violations;
}

/**
 * Legacy consent enforcement (from enforcement.js)
 */
export function enforceConsentLegacy(
  team,
  { warn = () => {}, reject = () => {} } = {}
) {
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

/**
 * Legacy timing enforcement (from enforcement.js)
 */
export function enforceTimingLegacy(
  team,
  ctx = defaultContext,
  { warn = () => {}, reject = () => {} } = {}
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

/**
 * Legacy eligibility enforcement (from enforcement.js)
 */
export function enforceEligibilityLegacy(
  team,
  ctx = defaultContext,
  { warn = () => {}, reject = () => {} } = {}
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

/**
 * Legacy roster window enforcement (from enforcement.js)
 */
export function enforceRosterWindowLegacy(
  team,
  ctx = {},
  { warn = () => {}, reject = () => {} } = {}
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
    warn('Two-way slots exceeded (4/3)');
    violations.push('Two-way slots exceeded (4/3)');
  }

  return violations;
}

// Helper functions
function isWithinOneYear(date1, date2) {
  return (
    Math.abs(new Date(date1) - new Date(date2)) < 365 * 24 * 60 * 60 * 1000
  );
}

// Legacy exports for backward compatibility
export { enforceEligibility as enforceEligibilityAdvanced };
export { enforceConsent as enforceConsentAdvanced };