// tradeHelpers.js

// Calculate salary for a given year
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

// Compare if two picks are the same
export const areSamePick = (a, b) =>
  String(a.year) === String(b.year) &&
  String(a.round) === String(b.round) &&
  (a.via || '') === (b.via || '');

// Format pick for display
export const formatPick = (p) => {
  let str = `${p.year} ${p.round} Round`;
  if (p.via) str += ` (via ${p.via})`;
  if (p.protection) str += ` 🛡 ${p.protection}`;
  if (p.isSwap) str += ' 🔁 Swap';
  if (p.note) str += ` 📝 ${p.note}`;
  return str;
};

// Format currency for display
export const formatCurrency = (value) =>
  typeof value === 'number' ? `$${value.toLocaleString()}` : '-';

// Calculate trade exception remaining
export const calculateTPERemaining = (tpe, usedAmount = 0) => {
  return tpe.amount - usedAmount;
};

// Check if player fits in TPE
export const playerFitsInTPE = (player, yearKey, tpe) => {
  const salary =
    player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;
  return (
    salary <= tpe.amount &&
    (!tpe.expirationDate || new Date(tpe.expirationDate) > new Date())
  );
};

// Calculate allowable incoming salary for a team
export const calculateAllowableIncoming = (
  teamSalary,
  salaryOut,
  capSettings
) => {
  const { cap = 0 } = capSettings;
  const overCap = teamSalary > cap;

  if (!overCap) {
    return salaryOut + 250000 + Math.max(0, cap - teamSalary);
  }

  if (salaryOut < 6530000) {
    return salaryOut * 1.75 + 100000;
  }

  if (salaryOut < 19600000) {
    return salaryOut * 1.25 + 100000;
  }

  return salaryOut * 1.25;
};

// Generate trade ID for tracking
export const generateTradeId = (teams) => {
  return teams
    .map((t) => `${t.team?.id}:${t.sends.map((p) => p.id).join(',')}`)
    .join('|');
};
