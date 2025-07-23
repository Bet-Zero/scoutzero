// tradeHelpers.js

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

export const areSamePick = (a, b) =>
  a.year === b.year && a.round === b.round && (a.via || '') === (b.via || '');

export const formatPick = (p) => {
  let str = `${p.year} ${p.round} Round`;
  if (p.via) str += ` (via ${p.via})`;
  if (p.protection) str += ` - ${p.protection}`;
  if (p.isSwap) str += ' (Swap)';
  if (p.note) str += ` - ${p.note}`;
  return str;
};

export const formatCurrency = (value) =>
  typeof value === 'number' ? `$${value.toLocaleString()}` : '-';
