/**
 * FILE: src/features/architect/utils/contractUtils.ts
 * PURPOSE: Authoritative contract shaping and lookup helpers for Architect utilities.
 * OWNERSHIP: Feature: architect/utils
 *
 * HISTORY:
 *  - 2026-03-12: Migrated authoritative implementation to TypeScript for E59.
 */

import { toSeasonCode, toEndYear } from './seasonFormat.js';

type NumericLike = any;
type ContractOptionsLike = {
  guaranteed?: boolean | null;
  playerOption?: boolean | null;
  teamOption?: boolean | null;
  extension?: boolean | null;
  rookieScale?: boolean | null;
  [key: string]: unknown;
};
type ContractYearLike = {
  season?: unknown;
  year?: unknown;
  salary?: NumericLike;
  capHit?: NumericLike;
  guaranteed?: unknown;
  guaranteedAmount?: NumericLike;
  option?: unknown;
  optionType?: unknown;
  optionUsed?: unknown;
  tradeBonus?: unknown;
  [key: string]: unknown;
};
type ContractFreeAgencyLike =
  | {
      year?: NumericLike;
      [key: string]: unknown;
    }
  | string
  | null
  | undefined;
type ContractLike = {
  salariesByYear?: ContractYearLike[] | null;
  yearsRemaining?: NumericLike;
  freeAgency?: ContractFreeAgencyLike;
  [key: string]: unknown;
};
type PlayerLike = {
  contract?: ContractLike | null;
  futureContract?: ContractLike | null;
  bio?: {
    display?: {
      freeAgentYear?: NumericLike;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  freeAgentYear?: NumericLike;
  yearsOfService?: NumericLike;
  [key: string]: unknown;
};
type CapProjectionEntryLike = {
  cap?: NumericLike;
  [key: string]: unknown;
};
type CapProjectionsLike = Record<string, CapProjectionEntryLike | undefined>;
type GetContractYearsOptions = {
  primaryContract?: ContractLike | null;
};
type GenerateContractParams = {
  baseSalary: NumericLike;
  years: NumericLike;
  raisePct?: NumericLike;
  options?: ContractOptionsLike | null;
  startYear?: NumericLike;
  roundTo?: NumericLike;
};
type GenerateExtensionContractParams = {
  firstYearSalary: NumericLike;
  years: NumericLike;
  raisePct?: NumericLike;
  startYear?: NumericLike;
};
type NormalizedContractYear = ContractYearLike & {
  year: number | null;
  season: string | null;
  salary: number;
  capHit: number;
  option: unknown;
  guaranteed: unknown;
  isExtension: boolean;
};

// 1. Generate any generic contract
export function generateContract({
  baseSalary,
  years,
  raisePct = 0.08,
  options = {},
  startYear = 2025,
  roundTo = 100,
}: GenerateContractParams) {
  const salariesByYear = [];
  let salary: any = baseSalary;

  for (let i = 0; i < (years as any); i++) {
    const endYear = (startYear as any) + i;
    const season = toSeasonCode(endYear);
    const roundedSalary =
      Math.round((salary as any) / (roundTo as any)) * (roundTo as any);

    const yearEntry = {
      season,
      salary: roundedSalary,
      capHit: roundedSalary,
      guaranteed: options?.guaranteed === false ? false : true,
      guaranteedAmount: options?.guaranteed === false ? 0 : roundedSalary,
      option: null,
      optionUsed: null,
      tradeBonus: null,
    };

    if (i === (years as any) - 1) {
      if (options?.playerOption) yearEntry.option = 'Player Option';
      if (options?.teamOption) yearEntry.option = 'Team Option';
    }

    salariesByYear.push(yearEntry);
    salary *= 1 + (raisePct as any);
  }

  const totalValue = salariesByYear.reduce(
    (sum, yr) => sum + ((yr as any).salary || 0),
    0
  );

  return {
    salariesByYear,
    extension: options?.extension || false,
    totalValue,
    yearsLeft: years,
    birdRights: 'Full Bird',
    freeAgency: `${(startYear as any) + (years as any)} (UFA)`,
  };
}

// 2. Wrapper: generate contract for a player extension
export function generateExtensionContract({
  firstYearSalary,
  years,
  raisePct,
  startYear,
}: GenerateExtensionContractParams) {
  return generateContract({
    baseSalary: firstYearSalary,
    years,
    raisePct,
    startYear,
    options: { extension: true },
  });
}

function normalizeContractYears(entries: ContractYearLike[] | null | undefined, isExtension: boolean) {
  return (entries || []).map((entry: any) => {
    const parsedYear = toEndYear(entry?.season ?? entry?.year);
    const salary = Number(entry?.salary ?? entry?.capHit ?? 0) || 0;
    return {
      ...entry,
      year: parsedYear,
      season:
        typeof entry?.season === 'string' && entry.season.length > 0
          ? entry.season
          : Number.isFinite(parsedYear)
            ? toSeasonCode(parsedYear)
            : null,
      salary,
      capHit: Number(entry?.capHit ?? salary) || salary,
      option: entry?.option ?? entry?.optionType ?? null,
      guaranteed: entry?.guaranteed,
      isExtension,
    } as NormalizedContractYear;
  });
}

export function getContractYearsForDisplay(
  player: PlayerLike | null | undefined,
  options: GetContractYearsOptions = {}
) {
  if (!player) return [];

  const primaryContract = options.primaryContract || null;
  const contractSources: NormalizedContractYear[] = [];
  const seenContracts = new Set();

  const addContractRows = (contractLike: ContractLike | null | undefined) => {
    if (!contractLike || seenContracts.has(contractLike)) return;
    seenContracts.add(contractLike);
    contractSources.push(
      ...normalizeContractYears(contractLike.salariesByYear, false)
    );
  };

  addContractRows(player.contract);
  addContractRows(primaryContract);

  const combined = [
    ...contractSources,
    ...normalizeContractYears(player.futureContract?.salariesByYear, true),
  ];

  const yearMap = new Map<number, NormalizedContractYear>();
  combined.forEach((entry) => {
    if (!Number.isFinite(entry.year)) return;
    const year = entry.year as number;
    const existing = yearMap.get(year);
    if (!existing || (entry.isExtension && !existing.isExtension)) {
      yearMap.set(year, entry);
    }
  });

  return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
}

export function getYearsRemainingDisplay({
  player,
  currentYear,
  primaryContract = null,
}: {
  player: PlayerLike | null | undefined;
  currentYear: NumericLike;
  primaryContract?: ContractLike | null;
}) {
  const normalizedCurrentYear = Number(currentYear);
  if (!player || !Number.isFinite(normalizedCurrentYear)) return 0;

  const contractYears = getContractYearsForDisplay(player, { primaryContract });
  const yearsFromRows = contractYears.filter(
    (yearEntry) => yearEntry.year >= normalizedCurrentYear
  ).length;
  if (yearsFromRows > 0) {
    return yearsFromRows;
  }

  const legacyYearsRemaining = Number(
    player?.contract?.yearsRemaining ?? primaryContract?.yearsRemaining
  );
  if (Number.isFinite(legacyYearsRemaining) && legacyYearsRemaining > 0) {
    return legacyYearsRemaining;
  }

  const freeAgencyYear = Number(
    (player?.contract?.freeAgency as any)?.year ??
      (primaryContract?.freeAgency as any)?.year ??
      player?.bio?.display?.freeAgentYear ??
      player?.freeAgentYear
  );
  if (!Number.isFinite(freeAgencyYear)) return 0;
  return Math.max(0, freeAgencyYear - normalizedCurrentYear);
}

// Helper: get salary entry for a given season, including future extensions
export function getContractYearSlice(
  player: PlayerLike | null | undefined,
  endYear: NumericLike
) {
  const targetYear = Number(endYear);
  if (!player || !Number.isFinite(targetYear)) return null;

  const contractYear = getContractYearsForDisplay(player).find(
    (entry) => entry.year === targetYear
  );
  if (!contractYear) return null;

  return {
    ...contractYear,
    isExtensionSeason: contractYear.isExtension,
    source: contractYear.isExtension ? 'extension' : 'contract',
  };
}

// 3. Create max contract based on years of service
export function createMaxContract(
  playerName: unknown,
  yearsOfService: NumericLike,
  capProjections: CapProjectionsLike,
  startYear: NumericLike = 2025
) {
  void playerName;

  let basePct = 0.25;
  if ((yearsOfService as any) >= 10) basePct = 0.35;
  else if ((yearsOfService as any) >= 7) basePct = 0.3;

  const key = `${startYear}-${String(((startYear as any) + 1) % 100).padStart(2, '0')}`;
  const cap = capProjections?.[key]?.cap || 0;
  const baseSalary = (cap as any) * basePct;

  return generateContract({
    baseSalary,
    years: 5,
    raisePct: 0.08,
    options: { playerOption: false },
    startYear,
  });
}

// 4. Rookie scale contract
const rookieScale: Record<number, number> = {
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

export function generateRookieContract(
  pickNumber: NumericLike = 10,
  startYear: NumericLike = 2025
) {
  const base = rookieScale[pickNumber as any] || 2500000;
  return generateContract({
    baseSalary: base,
    years: 4,
    raisePct: 0.05,
    options: { teamOption: true, rookieScale: true },
    startYear,
  });
}

// 5. Veteran minimum salary scale
export function getMinimumSalary(yearsOfService: NumericLike) {
  const scale: Record<number, number> = {
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
  return scale[yearsOfService as any] || 3800000;
}

// 6. Stretch provision calculator
export function stretchContract(
  contract: ContractLike | PlayerLike | null | undefined,
  currentYear: NumericLike
) {
  const salariesByYear =
    (contract as any)?.salariesByYear || (contract as any)?.contract?.salariesByYear;

  let yearKeys: Array<number | null> = [];
  if (salariesByYear?.length) {
    yearKeys = salariesByYear
      .map((y: ContractYearLike) => toEndYear(y.season as any))
      .filter((y: number | null) => y != null);
  }
  const remainingYears = yearKeys.filter((y) => y >= (currentYear as any)).length;

  const totalOwed = yearKeys
    .filter((y) => y >= (currentYear as any))
    .reduce((sum, key) => {
      const yearEntry = salariesByYear?.find((y: ContractYearLike) => {
        const entryEndYear = toEndYear(y.season as any);
        return entryEndYear === key;
      });
      return sum + ((yearEntry as any)?.salary || 0);
    }, 0);

  const stretchYears = remainingYears * 2 + 1;
  const stretchedAnnual = Math.round(totalOwed / stretchYears);

  const stretched: Record<number, number> = {};
  for (let i = 0; i < stretchYears; i++) {
    stretched[(currentYear as any) + i] = stretchedAnnual;
  }

  return stretched;
}

// 7. Minimum cap hit calculation (special 2-year rule)
export function getMinimumCapHit(yearsOfService: NumericLike) {
  if ((yearsOfService as any) >= 3) return 2092400;
  return getMinimumSalary(yearsOfService);
}

// 8. Cap hold logic
/**
 * @deprecated Use calculateCapHold from capHolds.ts instead.
 * This re-export exists for backwards compatibility.
 *
 * Note: The canonical implementation in capHolds.ts uses the correct CBA multipliers:
 * - Full Bird: 1.9× (190%)
 * - Early Bird: 1.3× (130%)
 * - Non-Bird: 1.2× (120%)
 */
export { calculateCapHold } from './capHolds';

// 9. Summary-level free agent contract for UI previews
export function generateDefaultFreeAgentContract(
  baseSalary: NumericLike,
  startYear: NumericLike = 2025,
  yearsOfService: NumericLike = 0
) {
  const contract = generateContract({
    baseSalary,
    years: 1,
    raisePct: 0,
    options: {},
    startYear,
  });

  return {
    ...contract,
    options: {},
    signAndTrade: false,
    guaranteed: true,
    isMinimum: (baseSalary as any) <= 2200000,
    yearsOfService,
  };
}

/**
 * Get player's last salary from contract data
 *
 * @param {Object} player - Player data
 * @returns {number} Last salary or 0
 */
export function getLastSalary(player: PlayerLike | null | undefined) {
  const salaries = player?.contract?.salariesByYear;

  if (!salaries?.length) return 0;

  const sorted = [...salaries].sort((a, b) => {
    const yearA = toEndYear(a.season as any) || 0;
    const yearB = toEndYear(b.season as any) || 0;
    return yearB - yearA;
  });

  return sorted[0]?.salary || sorted[0]?.capHit || 0;
}
