// 1. Generate any generic contract
export function generateContract({
  baseSalary,
  years,
  raisePct = 0.08,
  options = {},
  startYear = 2025,
  roundTo = 100,
}) {
  const salaries_by_year = {};
  let salary = baseSalary;

  for (let i = 0; i < years; i++) {
    const year = startYear + i;
    salaries_by_year[year] = {
      salary: Math.round(salary / roundTo) * roundTo,
      guaranteed: options.guaranteed === false ? false : true,
    };
    salary *= 1 + raisePct;
  }

  const lastYear = startYear + years - 1;
  if (options.playerOption) salaries_by_year[lastYear].option = 'Player Option';
  if (options.teamOption) salaries_by_year[lastYear].option = 'Team Option';

  return {
    salaries_by_year,
    extension: options.extension || false,
    totalValue: Object.values(salaries_by_year).reduce(
      (sum, yr) => sum + (yr.salary || 0),
      0
    ),
    yearsLeft: years,
    birdRights: 'Full Bird',
    freeAgency: `${startYear + years} (UFA)`,
  };
}

// 2. Wrapper: generate contract for a player extension
export function generateExtensionContract({
  firstYearSalary,
  years,
  raisePct,
  startYear,
  type = 'Standard Extension',
}) {
  return generateContract({
    baseSalary: firstYearSalary,
    years,
    raisePct,
    startYear,
    options: { extension: true },
  });
}

// 3. Create max contract based on years of service
export function createMaxContract(
  playerName,
  yearsOfService,
  capProjections,
  startYear = 2025
) {
  let basePct = 0.25;
  if (yearsOfService >= 10) basePct = 0.35;
  else if (yearsOfService >= 7) basePct = 0.3;

  const key = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  const cap = capProjections[key]?.cap || 0;
  const baseSalary = cap * basePct;

  return generateContract({
    baseSalary,
    years: 5,
    raisePct: 0.08,
    options: { playerOption: false },
    startYear,
  });
}

// 4. Rookie scale contract
const rookieScale = {
  1: 12720000,
  2: 11400000,
  3: 10300000,
  4: 9500000,
  5: 8600000,
  6: 7700000,
  7: 6900000,
  8: 6200000,
  9: 5600000,
  10: 5100000,
  11: 4800000,
  12: 4500000,
  13: 4200000,
  14: 4000000,
  15: 3900000,
  16: 3800000,
  17: 3700000,
  18: 3600000,
  19: 3500000,
  20: 3400000,
  21: 3300000,
  22: 3200000,
  23: 3100000,
  24: 3000000,
  25: 2900000,
  26: 2800000,
  27: 2700000,
  28: 2600000,
  29: 2500000,
  30: 2400000,
};

export function generateRookieContract(pickNumber = 10, startYear = 2025) {
  const base = rookieScale[pickNumber] || 2500000;
  return generateContract({
    baseSalary: base,
    years: 4,
    raisePct: 0.05,
    options: { teamOption: true, rookieScale: true },
    startYear,
  });
}

// 5. Veteran minimum salary scale
export function getMinimumSalary(yearsOfService) {
  const scale = {
    0: 1120000,
    1: 1820000,
    2: 2092400,
    3: 2390000,
    4: 2600000,
    5: 2800000,
    6: 3000000,
    7: 3200000,
    8: 3400000,
    9: 3600000,
    10: 3800000,
  };
  return scale[yearsOfService] || 3800000;
}

// 6. Stretch provision calculator
export function stretchContract(contract, currentYear) {
  // Prefer Architect contract shape if available
  let yearKeys = [];
  if (contract?.contract?.salariesByYear?.length) {
    yearKeys = contract.contract.salariesByYear
      .map((y) => {
        const season = String(y.season);
        // Season codes are typically "2024-25" – derive end-year
        if (/^\d{4}-\d{2}$/.test(season)) {
          const tail = parseInt(season.split('-')[1], 10);
          return 2000 + tail;
        }
        const n = parseInt(season, 10);
        return Number.isFinite(n) ? n : null;
      })
      .filter((y) => y != null);
  } else {
    yearKeys = Object.keys(contract.contract_clean?.salaries_by_year || {}).map(
      Number
    );
  }
  const remainingYears = yearKeys.filter((y) => y >= currentYear).length;

  const totalOwed = yearKeys
    .filter((y) => y >= currentYear)
    .reduce(
      (sum, key) =>
        sum +
        (contract.contract?.salariesByYear?.find((y) => {
          // Same season → same end-year
          const season = String(y.season);
          if (/^\d{4}-\d{2}$/.test(season)) {
            const tail = parseInt(season.split('-')[1], 10);
            return 2000 + tail === key;
          }
          return String(season) === String(key);
        })?.salary ||
          contract.contract_clean?.salaries_by_year?.[key]?.salary ||
          0),
      0
    );

  const stretchYears = remainingYears * 2 + 1;
  const stretchedAnnual = Math.round(totalOwed / stretchYears);

  const stretched = {};
  for (let i = 0; i < stretchYears; i++) {
    stretched[currentYear + i] = stretchedAnnual;
  }

  return stretched;
}

// 7. Minimum cap hit calculation (special 2-year rule)
export function getMinimumCapHit(yearsOfService) {
  if (yearsOfService >= 3) return 2092400;
  return getMinimumSalary(yearsOfService);
}

// 8. Cap hold logic
export function calculateCapHold(player, capProjections, year = 2025) {
  const experience = player.bio?.yearsExperience || 0;
  const rights =
    player.contract?.birdRights?.status ||
    player.contract_clean?.birdRights ||
    'None';

  let lastSalary = 0;
  if (player.contract?.salariesByYear?.length) {
    const sorted = [...player.contract.salariesByYear].sort((a, b) => {
      const sa = String(a.season);
      const sb = String(b.season);
      const ya = /^\d{4}-\d{2}$/.test(sa)
        ? 2000 + parseInt(sa.split('-')[1], 10)
        : parseInt(sa, 10);
      const yb = /^\d{4}-\d{2}$/.test(sb)
        ? 2000 + parseInt(sb.split('-')[1], 10)
        : parseInt(sb, 10);
      return (ya || 0) - (yb || 0);
    });
    const last = sorted[sorted.length - 1];
    lastSalary = last?.salary || last?.capHit || 0;
  } else {
    lastSalary = player.contract_clean?.lastSalary || 0;
  }
  const pickNumber = player.draft?.pick || null;
  const draftRound = player.draft?.round || null;

  if (draftRound === 1 && pickNumber) {
    const rookieAmount = rookieScale[pickNumber] || 2500000;
    return {
      amount: Math.round(rookieAmount * 1.2),
      reason: 'Rookie Scale',
      active: true,
    };
  }

  if (!rights || rights === 'None') {
    const minSalary = getMinimumSalary(experience);
    return {
      amount: Math.round(minSalary * 1.2),
      reason: 'Minimum Hold',
      active: true,
    };
  }

  const multiplier =
    rights === 'Non-Bird'
      ? 1.2
      : rights === 'Early Bird'
        ? 1.3
        : rights === 'Full Bird'
          ? 1.5
          : 1.2;

  return {
    amount: Math.round(lastSalary * multiplier),
    reason: `${rights} Rights`,
    active: true,
  };
}

// 9. Summary-level free agent contract for UI previews
export function generateDefaultFreeAgentContract(
  baseSalary,
  startYear = 2025,
  yearsOfService = 0
) {
  const contract = generateContract({
    baseSalary,
    years: 1,
    raisePct: 0,
    options: {},
    startYear,
  });

  const salaryByYear = Object.keys(contract.salaries_by_year).reduce(
    (acc, yr) => {
      acc[yr] = contract.salaries_by_year[yr].salary;
      return acc;
    },
    {}
  );

  return {
    salaryByYear,
    options: {},
    signAndTrade: false,
    guaranteed: true,
    isMinimum: baseSalary <= 2200000,
    yearsOfService,
  };
}
