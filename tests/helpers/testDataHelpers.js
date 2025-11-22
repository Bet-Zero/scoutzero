/**
 * Test data helper functions for creating players and teams with the new schema
 */

export const makePlayer = (name, salary, options = {}) => {
  const {
    signAndTrade = false,
    contractYears = 4,
    currentYear = 2025,
    useLegacySchema = false,
  } = options;

  const player = {
    name,
    signAndTrade,
    contractYears,
    playerId: name.toLowerCase().replace(/\s+/g, '_'),
    displayName: name,
  };

  if (useLegacySchema) {
    player.contract_clean = {
      salaries_by_year: { [currentYear]: { salary } },
    };
  } else {
    // Use helper function for consistency (defined at bottom of file)
    const seasonKey = yearToSeason(currentYear);
    player.contract = {
      salariesByYear: [{ season: seasonKey, salary, capHit: salary, guaranteed: true }],
      contractType: 'Standard',
      isExtension: false,
      isRookieScale: false,
      startSeason: seasonKey,
      endSeason: `${currentYear + contractYears - 2}-${String(currentYear + contractYears - 1).slice(-2)}`,
      contractLength: contractYears,
      yearsRemaining: contractYears,
      totalValue: salary * contractYears,
      averageAnnualValue: salary,
      guaranteedValue: salary * contractYears,
      guaranteedYears: contractYears,
    };
    // IMPORTANT: Also add legacy schema for backward compatibility.
    // Both schemas maintained to support validators checking either format.
    // This duplication is intentional during migration and will be removed later.
    player.contract_clean = {
      salaries_by_year: { [currentYear]: { salary } },
    };
  }
  return player;
};

export const makeTeam = (name, totalSalary, options = {}) => {
  const { rosterSize = 14, picks = [], currentYear = 2025, useLegacySchema = false } = options;
  const baseSalary = Math.floor(totalSalary / rosterSize);
  return {
    teamName: name,
    totalSalary,
    players: Array.from({ length: rosterSize }, (_, i) =>
      makePlayer(`${name}${i}`, baseSalary, { currentYear, useLegacySchema })
    ),
    picks,
  };
};

export const makePlayerWithYears = (name, salaries, options = {}) => {
  const { startYear = 2025, useLegacySchema = false } = options;
  const player = {
    name,
    playerId: name.toLowerCase().replace(/\s+/g, '_'),
    displayName: name,
    contractYears: salaries.length,
  };
  if (useLegacySchema) {
    player.contract_clean = { salaries_by_year: {} };
    salaries.forEach((salary, index) => {
      player.contract_clean.salaries_by_year[startYear + index] = { salary };
    });
  } else {
    const salariesByYear = salaries.map((salary, index) => {
      const year = startYear + index;
      // Use helper function for consistency
      const seasonKey = yearToSeason(year);
      return { season: seasonKey, salary, capHit: salary, guaranteed: true };
    });
    player.contract = {
      salariesByYear,
      contractType: 'Standard',
      isExtension: false,
      isRookieScale: false,
      startSeason: salariesByYear[0].season,
      endSeason: salariesByYear[salariesByYear.length - 1].season,
      contractLength: salaries.length,
      yearsRemaining: salaries.length,
      totalValue: salaries.reduce((sum, s) => sum + s, 0),
      averageAnnualValue: salaries.reduce((sum, s) => sum + s, 0) / salaries.length,
      guaranteedValue: salaries.reduce((sum, s) => sum + s, 0),
      guaranteedYears: salaries.length,
    };
    player.contract_clean = { salaries_by_year: {} };
    salaries.forEach((salary, index) => {
      player.contract_clean.salaries_by_year[startYear + index] = { salary };
    });
  }
  return player;
};

export const yearToSeason = (year) => `${year - 1}-${String(year).slice(-2)}`;
export const seasonToYear = (season) => {
  const [startYear] = season.split('-').map(Number);
  return startYear + 1;
};
