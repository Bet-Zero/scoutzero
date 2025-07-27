// tradeHelpers.js - Complete Optimized Version

// ======================
// Salary Calculations
// ======================
export const getSalaryForYear = (players = [], year) =>
  players.reduce((sum, p) => {
    const salaryFromContract =
      p.contract_clean?.salaries_by_year?.[year]?.salary;
    const salaryFromMap = p.salaryByYear?.[year];
    const salary =
      typeof salaryFromContract === 'number'
        ? salaryFromContract
        : typeof salaryFromMap === 'number'
          ? salaryFromMap
          : 0;
    return sum + salary;
  }, 0);

export const calculateAllowableIncoming = (
  teamSalary,
  salaryOut,
  { cap, firstApron, secondApron } = {}
) => {
  firstApron = firstApron || Infinity;
  secondApron = secondApron || Infinity;

  const overSecondApron = teamSalary > secondApron;
  const overFirstApron = teamSalary > firstApron;
  const overCap = teamSalary > cap;

  if (overSecondApron) return salaryOut;
  if (overFirstApron) return salaryOut * 1.1;

  if (!overCap) return salaryOut + 250000 + Math.max(0, cap - teamSalary);
  if (salaryOut < 6530000) return salaryOut * 1.75 + 100000;
  if (salaryOut < 19600000) return salaryOut * 1.25 + 100000;
  return salaryOut * 1.25;
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
