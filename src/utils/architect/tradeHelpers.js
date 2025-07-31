// tradeHelpers.js - Complete Optimized Version

// ======================
// Salary Calculations
// ======================
export const MIN_SALARY = 1_119_563;

export const getSalaryForYear = (players = [], year) =>
  players.reduce((sum, p) => {
    const yearData = p.contract_clean?.salaries_by_year?.[year] || {};
    const salaryFromMap = p.salaryByYear?.[year];
    const salary =
      typeof yearData.salary === 'number'
        ? yearData.salary
        : typeof salaryFromMap === 'number'
          ? salaryFromMap
          : typeof p.salary === 'number'
            ? p.salary
            : 0;
    const likelyBonus =
      yearData.bonuses?.likely ??
      yearData.likelyIncentives ??
      p.bonusesByYear?.[year]?.likely ??
      0;
    return sum + salary + likelyBonus;
  }, 0);

// In tradeHelpers.js - Replace existing implementation with this:

export const calculateAllowableIncoming = (
  teamTotalSalary,
  salaryOut,
  incomingPlayers = [],
  tradeExceptions = [],
  capSettings = {},
  yearKey
) => {
  // 1. Get the numbers we need
  const cap = Number(capSettings.cap) || Infinity;
  const firstApron = Number(capSettings.firstApron) || Infinity;
  const secondApron = Number(capSettings.secondApron) || Infinity;
  const MIN_SALARY = 1_119_563; // Current NBA minimum

  // 2. Calculate base allowable based on team's cap position
  let allowable;

  // Second apron teams - most restrictive
  if (teamTotalSalary > secondApron) {
    allowable = salaryOut; // Can only take back equal salary
  }
  // First apron teams
  else if (teamTotalSalary > firstApron) {
    allowable = salaryOut * 1.1; // 110% of outgoing
  }
  // Under cap teams
  else if (teamTotalSalary <= cap) {
    const capSpace = cap - teamTotalSalary;
    allowable = salaryOut + 250_000 + Math.max(0, capSpace);
  }
  // Over cap but below aprons - standard matching
  else {
    if (salaryOut <= 6_500_000) {
      allowable = salaryOut * 1.75 + 100_000;
    } else if (salaryOut <= 19_600_000) {
      allowable = salaryOut * 1.25 + 100_000;
    } else {
      allowable = salaryOut * 1.25;
    }
  }

  // 3. Add trade exceptions if available
  const validTPEs = tradeExceptions.filter(
    (tpe) => !tpe.isUsed && (tpe.remaining ?? tpe.amount) > 0
  );

  const tpeAmount = validTPEs.reduce(
    (sum, tpe) => sum + (tpe.remaining ?? tpe.amount),
    0
  );

  // 4. Add minimum salary exceptions for over-cap teams
  let minException = 0;
  if (teamTotalSalary > cap) {
    minException = incomingPlayers.reduce((sum, player) => {
      const salary = getSalaryForYear([player], yearKey);
      return salary <= MIN_SALARY ? sum + salary : sum;
    }, 0);
  }

  // 5. Return the total
  return allowable + tpeAmount + minException;
};

export const getApronStatus = (salary, { firstApron, secondApron } = {}) => {
  if (secondApron && salary > secondApron) return 'Above 2nd Apron';
  if (firstApron && salary > firstApron) return 'Above 1st Apron';
  return 'Below Aprons';
};

// ======================
// Pick Utilities
// ======================
export const areSamePick = (a, b) =>
  String(a.year) === String(b.year) &&
  String(a.round) === String(b.round) &&
  (a.via || '') === (b.via || '');

export const formatPick = (p) => {
  let str = `${p.year} ${p.round} Round`;
  if (p.via) str += ` (via ${p.via})`;
  if (p.protection) str += ` 🛡 ${p.protection}`;
  if (p.isSwap) str += ' 🔁 Swap';
  if (p.note) str += ` 📝 ${p.note}`;
  return str;
};

export const isMeaningfulProtection = (protection) => {
  if (!protection) return false;
  return (
    /top\s*[1-9]\d*/i.test(protection) ||
    /lottery/i.test(protection) ||
    /1-14/i.test(protection)
  );
};

// ======================
// Trade Exceptions
// ======================
export const calculateTPERemaining = (tpe, usedAmount = 0) =>
  tpe.amount - usedAmount;

export const playerFitsInTPE = (player, yearKey, tpe) => {
  if (!tpe || tpe.isUsed) return false;
  const salary =
    player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;
  const currentDate = new Date();
  const expirationDate = tpe.expirationDate
    ? new Date(tpe.expirationDate)
    : null;
  return (
    salary <= tpe.amount && (!expirationDate || expirationDate > currentDate)
  );
};

// ======================
// Formatting & Utilities
// ======================
export const formatCurrency = (value) =>
  typeof value === 'number' ? `$${value.toLocaleString()}` : '-';

export const generateTradeId = (teams) =>
  teams
    .map((t) => `${t.team?.id}:${t.sends.map((p) => p.id).join(',')}`)
    .join('|');
