import debug from '../debug.js';
import { validationFlags } from '@/config/validationFlags.js';
import {
  isWithinMoratorium,
  violates2MonthAggregation,
} from '../timingUtils.js';

export function enforceTiming(
  team,
  tradeCtx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const { outgoingPlayers = [] } = team;
  const { asOfDate, validationFlags = {} } = tradeCtx;
  const violations = [];

  if (debug.enabled) {
    debug.log(`⏰ Timing Rules – ${team.teamName}`, {
      asOfDate: tradeCtx.asOfDate,
      players: [...outgoingPlayers, ...incomingPlayers].map((p) => p.name),
    });
  }

  // Check moratorium period
  if (isWithinMoratorium(tradeCtx.asOfDate)) {
    violations.push('Trade during moratorium period');
  }

  // Check Dec 15 / Jan 15 restrictions
  outgoingPlayers.forEach((player) => {
    if (requiresDec15(player, asOfDate)) {
      violations.push(`${player.name} cannot be traded until Dec 15`);
    }
    if (requiresJan15(player, asOfDate)) {
      violations.push(`${player.name} cannot be traded until Jan 15`);
    }
  });

  // Check 30-day trade restriction for newly signed players
  outgoingPlayers.forEach((player) => {
    if (player.signedDate && !player.hasConsented) {
      const signedDate = new Date(player.signedDate);
      const tradeDate = new Date(tradeCtx.asOfDate);
      const daysSigned = (tradeDate - signedDate) / (1000 * 60 * 60 * 24);

      if (daysSigned < 30) {
        violations.push(
          `${player.name || 'Player'} cannot be traded within 30 days of signing`
        );
      }
    }
  });

  // Check 2-month aggregation rule
  if (violates2MonthAggregation(outgoingPlayers, tradeCtx.asOfDate)) {
    violations.push('Cannot aggregate players traded for within past 2 months');
  }

  violations.forEach((msg) => {
    if (validationFlags.timing === 'warn') {
      warn(msg);
    } else {
      reject(msg);
    }
  });

  return violations;
}

function isMoratoriumActive(date) {
  const tradeDate = new Date(date);
  const month = tradeDate.getMonth(); // 0-based
  const day = tradeDate.getDate();

  // Approximate moratorium period
  return month === 5 && day >= 30; // June 30th and after
}

function requiresDec15(player, date) {
  if (!player.isNewlySignedFA) return false;
  const tradeDate = new Date(date);
  const dec15 = new Date(tradeDate.getFullYear(), 11, 15); // Month is 0-based
  return tradeDate < dec15;
}

function requiresJan15(player, date) {
  if (!player.isRecentlyExtended) return false;
  const tradeDate = new Date(date);
  const jan15 = new Date(tradeDate.getFullYear(), 0, 15); // Month is 0-based
  return tradeDate < jan15;
}

function isWithin30Days(startDate, currentDate) {
  const daysDiff =
    (new Date(currentDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
  return daysDiff < 30;
}

function hasRecentlyAcquiredPlayers(players, date) {
  // Check if trying to aggregate players acquired within 2 months
  const twoMonthsAgo = new Date(date);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const recentlyAcquired = players.filter(
    (p) => p.dateAcquired && new Date(p.dateAcquired) > twoMonthsAgo
  );

  return recentlyAcquired.length > 1;
}
