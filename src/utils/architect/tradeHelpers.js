// tradeHelpers.js - Complete Optimized Version

// ======================
// Salary Calculations
// ======================
export const MIN_SALARY = 1_119_563;

export const getSalaryForYear = (players = [], year) => {
  if (!year) {
    console.warn('⚠️ getSalaryForYear called with undefined year');
    return 0;
  }

  let total = 0;

  players.forEach((p) => {
    const yearData = p.contract_clean?.salaries_by_year?.[year] || {};
    const salaryFromMap = p.salaryByYear?.[year];
    const fallback = p.salary;

    const baseSalary =
      typeof yearData.salary === 'number'
        ? yearData.salary
        : typeof salaryFromMap === 'number'
          ? salaryFromMap
          : typeof fallback === 'number'
            ? fallback
            : 0;

    const likelyBonus =
      yearData.bonuses?.likely ??
      yearData.likelyIncentives ??
      p.bonusesByYear?.[year]?.likely ??
      0;

    const playerTotal = baseSalary + likelyBonus;

    console.log(
      `👤 ${p.name || 'Unknown Player'} | Salary: $${baseSalary.toLocaleString()} | Bonus: $${likelyBonus.toLocaleString()} → Total: $${playerTotal.toLocaleString()}`
    );

    total += playerTotal;
  });

  console.log(`🧮 Total Salary for ${year}: $${total.toLocaleString()}`);
  return total;
};

// In tradeHelpers.js - Replace existing implementation with this:

export const calculateAllowableIncoming = (
  teamTotalSalary,
  salaryOut,
  incomingPlayers = [],
  tradeExceptions = [],
  capSettings = {},
  yearKey
) => {
  const cap = Number(capSettings.cap) || Infinity;
  const firstApron = Number(capSettings.firstApron) || Infinity;
  const secondApron = Number(capSettings.secondApron) || Infinity;
  const MIN_SALARY = 1_119_563;

  console.log('🧮 [Calc Allowable Incoming]');
  console.log(`📊 Team Total Salary: $${teamTotalSalary?.toLocaleString?.()}`);
  console.log(`📤 Salary Out: $${salaryOut?.toLocaleString?.()}`);
  console.log(`🗓️ YearKey: ${yearKey}`);
  console.log(`💰 Cap: $${cap?.toLocaleString?.()}`);
  console.log(`💰 First Apron: $${firstApron?.toLocaleString?.()}`);
  console.log(`💰 Second Apron: $${secondApron?.toLocaleString?.()}`);

  let allowable;

  if (teamTotalSalary > secondApron) {
    allowable = salaryOut;
    console.log('🚧 Over 2nd Apron: Equal salary only');
  } else if (teamTotalSalary > firstApron) {
    allowable = salaryOut * 1.1;
    console.log('🔁 Over 1st Apron: 110% of salary out');
  } else if (teamTotalSalary <= cap) {
    const capSpace = cap - teamTotalSalary;
    allowable = salaryOut + 250_000 + Math.max(0, capSpace);
    console.log(`💸 Under Cap: Using Cap Space = $${capSpace}`);
  } else {
    if (salaryOut <= 6_500_000) {
      allowable = salaryOut * 1.75 + 100_000;
      console.log('📏 Normal Rule (≤ $6.5M): 175% + $100K');
    } else if (salaryOut <= 19_600_000) {
      allowable = salaryOut * 1.25 + 100_000;
      console.log('📏 Normal Rule (≤ $19.6M): 125% + $100K');
    } else {
      allowable = salaryOut * 1.25;
      console.log('📏 Normal Rule (> $19.6M): 125%');
    }
  }

  const validTPEs = tradeExceptions.filter(
    (tpe) => !tpe.isUsed && (tpe.remaining ?? tpe.amount) > 0
  );

  const tpeAmount = validTPEs.reduce(
    (sum, tpe) => sum + (tpe.remaining ?? tpe.amount),
    0
  );

  console.log(`🎟️ Valid Trade Exceptions: ${validTPEs.length}`);
  console.log(`➕ TPE Amount Added: $${tpeAmount?.toLocaleString?.()}`);

  let minException = 0;
  if (teamTotalSalary > cap) {
    minException = incomingPlayers.reduce((sum, player) => {
      const salary = getSalaryForYear([player], yearKey);
      return salary <= MIN_SALARY ? sum + salary : sum;
    }, 0);
    console.log(
      `📎 Min Salary Exception: $${minException?.toLocaleString?.()}`
    );
  }

  const total = allowable + tpeAmount + minException;
  console.log(`✅ FINAL ALLOWABLE INCOMING: $${total?.toLocaleString?.()}`);

  return total;
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
