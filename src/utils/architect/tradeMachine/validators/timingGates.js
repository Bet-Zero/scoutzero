import { validationFlags } from '../validationFlags.js';

export function enforceTiming(team, tradeCtx, callbacks = {}) {
  const { warn = () => {}, reject = () => {} } = callbacks;

  // Skip if disabled
  if (validationFlags.timingEnforcement === 'off') return;

  const now = new Date(tradeCtx.asOfDate || new Date());

  // Trade moratorium check (usually July 1-6)
  if (isMoratoriumPeriod(now)) {
    if (validationFlags.timingEnforcement === 'error') {
      reject('Trade moratorium in effect');
    } else {
      warn('Trade moratorium in effect');
    }
  }

  // Dec 15/Jan 15 eligibility
  team.sends?.forEach((player) => {
    if (!isEligibleToTrade(player, now)) {
      if (validationFlags.timingEnforcement === 'error') {
        reject(`${player.name} not yet eligible to be traded`);
      } else {
        warn(`${player.name} not yet eligible to be traded`);
      }
    }
  });

  // 30-day rule for recent signings
  team.sends?.forEach((player) => {
    if (isWithin30Days(player.signedDate, now)) {
      if (validationFlags.timingEnforcement === 'error') {
        reject('30-day waiting period required after signing');
      } else {
        warn('30-day waiting period required after signing');
      }
    }
  });

  // 2-month aggregation rule
  if (team.sends?.length > 1) {
    const lastReceived = team.sends
      .map((p) => p.lastReceivedDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];

    if (lastReceived && isWithin2Months(lastReceived, now)) {
      if (validationFlags.timingEnforcement === 'error') {
        reject('Cannot aggregate recently acquired players for 2 months');
      } else {
        warn('Cannot aggregate recently acquired players for 2 months');
      }
    }
  }
}

function isMoratoriumPeriod(date) {
  const month = date.getMonth();
  const day = date.getDate();
  return month === 6 && day >= 1 && day <= 6; // July 1-6
}

function isEligibleToTrade(player, now) {
  const signedDate = new Date(player.signedDate);
  const month = now.getMonth();

  // Players signed in offseason can't be traded until Dec 15
  if (signedDate.getMonth() < 9) {
    // Before October
    return month >= 11 || month < 6; // Dec-June
  }

  // Players signed during season can't be traded for 3 months
  return now - signedDate >= 90 * 24 * 60 * 60 * 1000;
}

function isWithin30Days(dateStr, now) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return now - date < 30 * 24 * 60 * 60 * 1000;
}

function isWithin2Months(dateStr, now) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return now - date < 60 * 24 * 60 * 60 * 1000;
}
