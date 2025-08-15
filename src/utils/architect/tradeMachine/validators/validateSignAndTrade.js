import { wouldExceedHardCap } from '@/utils/architect/tradeHelpers.js';
import { validationCache } from './validationCache.js';

/**
 * Validates Sign-and-Trade requirements:
 * - Must be executed in offseason
 * - Must be executed by player's original team
 * - Player must be traded alone (no other players/picks)
 * - Contract must be 3-4 years with first year guaranteed
 * - Team receiving player will be hard capped at first apron
 * - Teams using taxpayer MLE cannot receive S&T players
 */
export function validateSignAndTrade(team, tradeCtx = {}) {
  // Generate cache key from team and trade context
  const cacheKey = `${team.teamId}-${tradeCtx.tradeDate || ''}-${tradeCtx.season || ''}`;
  const cached = validationCache.getCachedSignAndTrade(cacheKey);
  if (cached) {
    return cached;
  }

  const violations = [];
  const { context = {} } = team;
  const { tradeDate, season, offseason } = tradeCtx;

  // Find sign-and-trade players
  const sntIn = (team.incomingPlayers || []).filter(
    (p) => p.isSignAndTrade || p.signAndTrade
  );
  const sntOut = (team.sends || team.outgoingPlayers || []).filter(
    (p) => p.isSignAndTrade || p.signAndTrade
  );
  const anySnt = sntIn.length > 0 || sntOut.length > 0;

  if (!anySnt) {
    return {
      passed: true,
      violations: [],
      message: 'No sign-and-trade players involved',
      details: '',
    };
  }

  // Check offseason timing - handle both explicit flag and date-based calculation
  let isOffseason = false;
  if (typeof offseason === 'boolean') {
    isOffseason = offseason;
  } else {
    // Must be offseason (July 1 - October 15)
    const date = new Date(tradeDate || Date.now());
    const month = date.getMonth(); // 0-based: 0=Jan, 6=July, 9=October
    const day = date.getDate();

    // Offseason: July 1 (month 6) through October 15 (month 9, day 15)
    isOffseason =
      month === 6 || month === 7 || month === 8 || (month === 9 && day <= 15);
  }

  if (!isOffseason) {
    violations.push(
      'Sign-and-trade only allowed during offseason (July 1 - Oct 15)'
    );
  }

  // Origin team validation - must be from player's Bird rights team
  sntOut.forEach((player) => {
    // Check if this team has the player's Bird rights
    const teamId = team.teamId || team.team?.id;
    const hasRights =
      player.birdRightsTeam === teamId ||
      player.originTeamId === teamId ||
      player.currentTeamId === teamId;

    if (!hasRights) {
      violations.push(
        `${player.name || 'Player'} can only be signed-and-traded by team with Bird rights`
      );
    }
  });

  // Validate each S&T player
  [...sntIn, ...sntOut].forEach((player) => {
    // Must be 3-4 years (excluding options)
    const contractYears = player.contractYears || player.years || 0;
    if (contractYears < 3 || contractYears > 4) {
      violations.push(
        `Sign-and-trade contracts must be 3-4 years, got ${contractYears} years`
      );
    }

    // First year must be fully guaranteed
    const firstYearGuaranteed = player.firstYearGuaranteed !== false;
    if (!firstYearGuaranteed) {
      violations.push(
        `${player.name || 'Player'}'s first year must be fully guaranteed`
      );
    }

    // Player must be traded alone (no aggregation)
    if (sntOut.length > 0) {
      const totalOutgoingPlayers = (team.sends || team.outgoingPlayers || [])
        .length;
      const totalOutgoingPicks = (team.picksOut || team.outgoingPicks || [])
        .length;

      if (totalOutgoingPlayers > 1 || totalOutgoingPicks > 0) {
        violations.push('Sign-and-trade player must be traded alone.');
      }
    }
  });

  // Teams using taxpayer MLE cannot receive S&T players
  const usedTaxpayerMLE =
    team.usedTaxpayerMLE || team.team?.usedTaxpayerMLEThisSeason;
  if (sntIn.length > 0 && usedTaxpayerMLE) {
    violations.push(
      'Teams using taxpayer MLE cannot receive sign-and-trade players'
    );
  }

  // Check sign-and-trade hard cap violation for receiving teams
  if (sntIn.length > 0) {
    const { capSettings = {} } = context;
    const firstApron = capSettings.firstApron || 0;
    const projectedSalary = team.projectedSalary || team.teamTotalSalary || 0;

    if (projectedSalary > firstApron) {
      violations.push(
        'Sign-and-trade would cause team to exceed first apron hard-cap'
      );
    }
  }

  const willBeHardCapped = sntIn.length > 0;

  const result = {
    passed: violations.length === 0,
    violations,
    message:
      violations.length > 0
        ? 'Sign-and-trade violations'
        : 'Sign-and-trade validated',
    details: violations.join('; '),
    hasSignAndTrade: anySnt,
    hardCapped: willBeHardCapped,
  };

  // Cache the result
  validationCache.cacheSignAndTrade(cacheKey, result);

  return result;
}
