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
