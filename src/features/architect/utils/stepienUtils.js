// src/utils/architect/stepienUtils.js

/* Stepien-rule helpers */

export function buildFirstRoundCalendar({
  existingPicks = [],
  picksOfferedInTrade = [],
} = {}) {
  const thisYear = new Date().getFullYear();
  const span = [...Array(8)].map((_, i) => thisYear + i);

  const cal = Object.fromEntries(
    span.map((yr) => [yr, { status: 'owned', protection: null }])
  );

  existingPicks.forEach((p) => {
    if (!cal[p.year]) return;
    cal[p.year] = {
      status: p.protected ? 'protected' : 'owed',
      protection: p.protectionText ?? null,
    };
  });

  picksOfferedInTrade.forEach((p) => {
    if (!cal[p.year]) return;
    cal[p.year] = {
      status: p.protection ? 'protected' : 'outgoing',
      protection: p.protection ?? null,
    };
  });

  return cal;
}

export function passesStepienRule(cal) {
  const yrs = Object.keys(cal)
    .map(Number)
    .sort((a, b) => a - b);
  for (let i = 0; i < yrs.length - 1; i += 1) {
    if (
      cal[yrs[i]].status === 'outgoing' &&
      cal[yrs[i + 1]].status === 'outgoing'
    ) {
      return false; // consecutive unprotected
    }
  }
  return true;
}

export function hasStepienViolation(picks) {
  if (!picks || picks.length === 0) return false;

  // Filter to first round picks only and sort by year
  const firstRoundPicks = picks
    .filter((pick) => pick.round === '1st' || pick.round === 1)
    .sort((a, b) => a.year - b.year);

  // Check for consecutive unprotected picks
  for (let i = 0; i < firstRoundPicks.length - 1; i++) {
    const currentPick = firstRoundPicks[i];
    const nextPick = firstRoundPicks[i + 1];

    // Skip if this is a swap pick
    if (currentPick.isSwap || nextPick.isSwap) continue;

    // Skip if either pick is protected
    if (currentPick.protection || nextPick.protection) continue;

    // Check if consecutive years
    if (nextPick.year === currentPick.year + 1) {
      return true; // Stepien violation found
    }
  }

  return false;
}
