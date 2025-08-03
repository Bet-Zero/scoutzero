/************************** SCSP™ BLOCK: tradeHelpers.js  **************************
 * FULL FILE REPLACEMENT — drop-in ready
 * ▸ Fixes: getSalaryForYear, getIncomingCeiling, calculateAllowableIncoming,
 * areSamePick  (numeric leniency)
 * ▸ Keeps: MIN_SALARY, getApronStatus, pick utils, TPE utils, format helpers
 * -------------------------------------------------------------------------------*/

export const MIN_SALARY = 1_119_563;

/*────────────────────────  Salary Helpers  ────────────────────────*/
/******************** SCSP™ BLOCK: getSalaryForYear ********************/
export const getSalaryForYear = (input, year) => {
  if (!year) return 0;

  // Accept a single player or an array
  const players = Array.isArray(input) ? input : [input];

  return players.reduce((sum, p) => {
    const yData = p.contract_clean?.salaries_by_year?.[year] ?? {};
    const salaryMap = p.salaryByYear?.[year];
    const fallback = p.salary;

    const base =
      typeof yData.salary === 'number'
        ? yData.salary
        : typeof salaryMap === 'number'
          ? salaryMap
          : typeof fallback === 'number'
            ? fallback
            : 0;

    // tests look specifically for `likely_bonus`
    const likely =
      (typeof yData.likely_bonus === 'number' ? yData.likely_bonus : 0) ||
      (yData.bonuses?.likely ?? yData.likelyIncentives ?? 0) ||
      (p.bonusesByYear?.[year]?.likely ?? 0);

    return sum + base + likely;
  }, 0);
};
/****************** END SCSP™ BLOCK: getSalaryForYear ******************/

/*─────────────────────  Incoming-Salary (CBA rules)  ─────────────────────*/

export const getIncomingCeiling = (
  teamTotalSalary,
  salaryOut,
  tradeExceptions = [],
  capSettings
) => {
  // 1️⃣ Cap-space teams may go up to the cap.
  if (teamTotalSalary < capSettings.salaryCap) return capSettings.salaryCap;

  // 2️⃣ Standard tiers (2023-CBA §6(f)(2))
  let ceiling;
  if (salaryOut <= 7_500_000) {
    ceiling = salaryOut * 2; // 200 %
  } else if (salaryOut < 29_000_000) {
    ceiling = salaryOut * 1.75 + 100_000; // 175 % + $100 k
  } else {
    ceiling = salaryOut + 5_000_000; // + $5 M
  }

  // 3️⃣ Second-apron hard limiter (110 %)
  if (teamTotalSalary >= capSettings.secondApron) {
    ceiling = salaryOut * 1.1;
  }

  // 4️⃣ Add any valid Trade Player Exceptions
  const tpeValue = tradeExceptions
    .filter((t) => !t.expired)
    .reduce((sum, t) => sum + (t.remaining ?? t.amount ?? 0), 0);

  return Math.floor(ceiling + tpeValue);
};

/******************** SCSP™ BLOCK: Allowable Incoming *******************
 * calculateAllowableIncoming now returns “allowable *incoming* salary”
 * – for over-cap teams = ceiling − salaryOut
 * – for cap-space teams = cap − current payroll
 ***********************************************************************/
export function calculateAllowableIncoming(
  teamTotalSalary,
  salaryOut,
  incomingPlayers,
  tradeExceptions,
  capSettings,
  seasonKey
) {
  // Cap-space clubs: the only limit is up to the cap
  if (teamTotalSalary < capSettings.salaryCap) {
    return Math.max(0, capSettings.salaryCap - teamTotalSalary);
  }

  // Over-cap clubs (incl. apron teams)
  const ceiling = getIncomingCeiling(
    teamTotalSalary,
    salaryOut,
    tradeExceptions,
    capSettings,
    seasonKey
  );

  return Math.max(0, ceiling - salaryOut); // <-- **key fix**
}
/****************** END SCSP™ BLOCK: Allowable Incoming ******************/

/*───────────────────────────  Apron Status  ───────────────────────────*/
export const getApronStatus = (salary, { firstApron, secondApron } = {}) => {
  if (secondApron && salary > secondApron) return 'Above 2nd Apron';
  if (firstApron && salary > firstApron) return 'Above 1st Apron';
  return 'Below Aprons';
};

/*───────────────────────────  Pick Helpers  ───────────────────────────*/
export const areSamePick = (a, b) =>
  +a.year === +b.year &&
  +a.round === +b.round &&
  (a.via || '') === (b.via || '');

export const formatPick = (p) => {
  let str = `${p.year} ${p.round} Round`;
  if (p.via) str += ` (via ${p.via})`;
  if (p.protection) str += ` 🛡 ${p.protection}`;
  if (p.isSwap) str += ' 🔁 Swap';
  if (p.note) str += ` 📝 ${p.note}`;
  return str;
};

export const isMeaningfulProtection = (prot) =>
  !!prot &&
  (/top\s*\d+/i.test(prot) || /lottery/i.test(prot) || /1-14/i.test(prot));

/*────────────────────────  Trade-Exception Helpers  ───────────────────────*/
export const calculateTPERemaining = (tpe, used = 0) => tpe.amount - used;

export const playerFitsInTPE = (player, yearKey, tpe) => {
  if (!tpe || tpe.isUsed) return false;

  const salary =
    player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;

  const now = Date.now();
  const exp = tpe.expirationDate ? Date.parse(tpe.expirationDate) : Infinity;

  return salary <= tpe.amount && now < exp;
};

/*───────────────────────  Formatting & Misc Utilities  ───────────────────*/
export const formatCurrency = (val) =>
  typeof val === 'number' ? `$${val.toLocaleString()}` : '-';

export const generateTradeId = (teams) =>
  teams
    .map(
      (t) =>
        `${t.team?.id}:${t.sends
          .map((p) => p.id)
          .sort()
          .join(',')}`
    )
    .join('|');

/*───────────────────────────────  EOF  ───────────────────────────────*/
