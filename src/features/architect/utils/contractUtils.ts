/**
 * FILE: src/features/architect/utils/contractUtils.ts
 * PURPOSE: Authoritative contract shaping and lookup helpers for Architect utilities.
 * OWNERSHIP: Feature: architect/utils
 *
 * ARCHITECT OWNERSHIP:
 * - Shared contract SSOT for contract generation, year slicing, and cap-hit lookups.
 * - Upstream shared authority for cap totals, cap sheets, rules profiles, and contract-action UI.
 * - Downstream surfaces must not re-merge contract rows or reconstruct per-year cap hits locally.
 *
 * HISTORY:
 *  - 2026-03-12: Migrated authoritative implementation to TypeScript for E59.
 */

import { getMinimumCapHit as getMinimumCapHitFromMinimumSalaryRules } from './playerRulesProfile/minimumSalaryRules';
import { toSeasonCode, toEndYear } from './seasonFormat';
interface ContractOptions {
  guaranteed?: boolean | null;
  playerOption?: boolean | null;
  teamOption?: boolean | null;
  extension?: boolean | null;
  rookieScale?: boolean | null;
}

/** Salary row input: accepts both full schema rows and looser legacy caller shapes. */
type SalaryRowInput = {
  season?: string | null;
  year?: string | number | null;
  salary?: number | string | null;
  capHit?: number | string | null;
  guaranteed?: boolean | null;
  option?: string | null;
  guaranteedAmount?: number | string | null;
  optionUsed?: boolean | null;
  optionDecisionDate?: string | Date | null;
  tradeBonus?: number | string | null;
  [key: string]: unknown;
};

/** Minimal contract shape used by contract utility functions. */
interface ContractUtilsContract {
  salariesByYear?: SalaryRowInput[] | null;
  yearsRemaining?: number | null;
  freeAgency?:
    | {
        year?: number | string | null;
        type?: string | null;
      }
    | string
    | null;
  [key: string]: unknown;
}

/** Player shape accepted by contract utility functions. */
interface ContractUtilsPlayer {
  contract?: ContractUtilsContract | null;
  futureContract?: ContractUtilsContract | null;
  contractType?: string | null;
  isMinimum?: boolean;
  yearsOfService?: unknown;
  bio?: {
    display?: { freeAgentYear?: number | string | null } | null;
    [key: string]: unknown;
  } | null;
  freeAgentYear?: number | string | null;
}

interface CapProjectionEntry {
  cap?: number;
}

type CapProjections = Record<string, CapProjectionEntry | undefined>;

interface GetContractYearsOptions {
  primaryContract?: ContractUtilsContract | null;
}

interface GenerateContractParams {
  baseSalary: number;
  years: number;
  raisePct?: number;
  options?: ContractOptions | null;
  startYear?: number;
  roundTo?: number;
}

interface GenerateExtensionContractParams {
  firstYearSalary: number;
  years: number;
  raisePct?: number;
  startYear?: number;
}

type ContractYearSource = 'playerContract' | 'primaryContract' | 'futureContract';

type MinimumSalarySeasonInput = string | number | null | undefined;

type NormalizedContractYear = SalaryRowInput & {
  year: number | null;
  season: string;
  salary: number;
  capHit: number;
  isExtension: boolean;
  contractSource: ContractYearSource;
};

const LEGACY_MINIMUM_SALARY_SCALE: Record<number, number> = {
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

const LEGACY_MINIMUM_CAP_HIT = LEGACY_MINIMUM_SALARY_SCALE[2] ?? 2092400;

const CONTRACT_YEAR_SOURCE_PRIORITY: Record<ContractYearSource, number> = {
  primaryContract: 1,
  playerContract: 2,
  futureContract: 3,
};

export function isTwoWayContract(
  player: ContractUtilsPlayer | null | undefined
): boolean {
  const contractType = player?.contractType ?? player?.contract?.contractType;

  return (
    typeof contractType === 'string' &&
    contractType.trim().toLowerCase() === 'two-way'
  );
}

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
  let salary = baseSalary;

  for (let i = 0; i < years; i++) {
    const endYear = startYear + i;
    const season = toSeasonCode(endYear);
    const roundedSalary = Math.round(salary / roundTo) * roundTo;

    const yearEntry = {
      season,
      salary: roundedSalary,
      capHit: roundedSalary,
      guaranteed: options?.guaranteed === false ? false : true,
      guaranteedAmount: options?.guaranteed === false ? 0 : roundedSalary,
      option: null as string | null,
      optionUsed: null as boolean | null,
      tradeBonus: null as number | null,
    };

    if (i === years - 1) {
      if (options?.playerOption) yearEntry.option = 'Player Option';
      if (options?.teamOption) yearEntry.option = 'Team Option';
    }

    salariesByYear.push(yearEntry);
    salary *= 1 + raisePct;
  }

  const totalValue = salariesByYear.reduce(
    (sum, yr) => sum + (yr.salary || 0),
    0
  );

  return {
    salariesByYear,
    extension: options?.extension || false,
    totalValue,
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
}: GenerateExtensionContractParams) {
  return generateContract({
    baseSalary: firstYearSalary,
    years,
    raisePct,
    startYear,
    options: { extension: true },
  });
}

function normalizeYearsOfService(value: unknown): number {
  const years = Number(value);
  if (!Number.isFinite(years) || years < 0) {
    return 0;
  }

  return Math.floor(years);
}

function normalizeMinimumSalarySeason(
  seasonOrEndYear: MinimumSalarySeasonInput
): string | null {
  if (typeof seasonOrEndYear === 'string' && seasonOrEndYear.trim().length > 0) {
    const parsedEndYear = toEndYear(seasonOrEndYear);
    if (Number.isFinite(parsedEndYear)) {
      return toSeasonCode(parsedEndYear as number);
    }
    return seasonOrEndYear;
  }

  const parsedEndYear = toEndYear(seasonOrEndYear);
  if (!Number.isFinite(parsedEndYear)) {
    return null;
  }

  return toSeasonCode(parsedEndYear as number);
}

function getLegacyMinimumSalary(
  yearsOfService: number | string | null | undefined
): number {
  const years = normalizeYearsOfService(yearsOfService);
  return LEGACY_MINIMUM_SALARY_SCALE[years] || LEGACY_MINIMUM_SALARY_SCALE[10];
}

function normalizeContractYears(
  entries: SalaryRowInput[] | null | undefined,
  contractSource: ContractYearSource
): NormalizedContractYear[] {
  return (entries || []).map((entry) => {
    const parsedYear = toEndYear(entry.season ?? entry.year);
    const salary = Number(entry.salary ?? entry.capHit ?? 0) || 0;
    return {
      ...entry,
      year: parsedYear,
      season:
        typeof entry.season === 'string' && entry.season.length > 0
          ? entry.season
          : Number.isFinite(parsedYear)
            ? toSeasonCode(parsedYear)
            : '',
      salary,
      capHit: Number(entry.capHit ?? salary) || salary,
      option: (entry.option ?? entry.optionType ?? null) as string | null,
      isExtension: contractSource === 'futureContract',
      contractSource,
    } as NormalizedContractYear;
  });
}

function selectAuthoritativeContractYear(
  existing: NormalizedContractYear | undefined,
  incoming: NormalizedContractYear
): NormalizedContractYear {
  if (!existing) {
    return incoming;
  }

  if (existing.contractSource === incoming.contractSource) {
    return existing;
  }

  // Same-year ownership is explicit:
  // - player.contract rows beat primaryContract fallback rows
  // - futureContract rows beat any non-future row for that season
  if (existing.contractSource === 'futureContract') {
    return existing;
  }
  if (incoming.contractSource === 'futureContract') {
    return incoming;
  }

  const existingPriority = CONTRACT_YEAR_SOURCE_PRIORITY[existing.contractSource];
  const incomingPriority = CONTRACT_YEAR_SOURCE_PRIORITY[incoming.contractSource];
  return incomingPriority > existingPriority ? incoming : existing;
}

function mergeContractYearsByYear(
  entries: NormalizedContractYear[]
): NormalizedContractYear[] {
  const yearMap = new Map<number, NormalizedContractYear>();

  entries.forEach((entry) => {
    if (!Number.isFinite(entry.year)) return;

    const year = entry.year as number;
    yearMap.set(
      year,
      selectAuthoritativeContractYear(yearMap.get(year), entry)
    );
  });

  return Array.from(yearMap.values()).sort(
    (a, b) => (a.year ?? 0) - (b.year ?? 0)
  );
}

function getLegacyYearsRemainingFallback(
  player: ContractUtilsPlayer,
  primaryContract: ContractUtilsContract | null,
  normalizedCurrentYear: number
): number {
  const legacyYearsRemaining = Number(
    player.contract?.yearsRemaining ?? primaryContract?.yearsRemaining
  );
  if (Number.isFinite(legacyYearsRemaining) && legacyYearsRemaining > 0) {
    return legacyYearsRemaining;
  }

  const playerContractFreeAgency =
    typeof player.contract?.freeAgency === 'object' &&
    player.contract.freeAgency !== null
      ? player.contract.freeAgency.year
      : null;
  const primaryContractFreeAgency =
    typeof primaryContract?.freeAgency === 'object' &&
    primaryContract.freeAgency !== null
      ? primaryContract.freeAgency.year
      : null;
  const freeAgencyYear = Number(
    playerContractFreeAgency ??
      primaryContractFreeAgency ??
      player.bio?.display?.freeAgentYear ??
      player.freeAgentYear
  );
  if (!Number.isFinite(freeAgencyYear)) return 0;
  return Math.max(0, freeAgencyYear - normalizedCurrentYear);
}

export function getContractYearsForDisplay(
  player: ContractUtilsPlayer | null | undefined,
  options: GetContractYearsOptions = {}
) {
  if (!player) return [];

  const primaryContract = options.primaryContract || null;
  const seenContracts = new Set();
  const contractSources: NormalizedContractYear[] = [];

  const addContractRows = (
    contract: ContractUtilsContract | null | undefined,
    contractSource: ContractYearSource
  ) => {
    if (!contract) return;
    if (
      contractSource !== 'futureContract' &&
      seenContracts.has(contract)
    ) {
      return;
    }
    if (contractSource !== 'futureContract') {
      seenContracts.add(contract);
    }
    contractSources.push(...normalizeContractYears(contract.salariesByYear, contractSource));
  };

  addContractRows(player.contract, 'playerContract');
  addContractRows(primaryContract, 'primaryContract');
  addContractRows(player.futureContract, 'futureContract');

  return mergeContractYearsByYear(contractSources);
}

export function getYearsRemainingDisplay({
  player,
  currentYear,
  primaryContract = null,
}: {
  player: ContractUtilsPlayer | null | undefined;
  currentYear: number;
  primaryContract?: ContractUtilsContract | null;
}) {
  const normalizedCurrentYear = Number(currentYear);
  if (!player || !Number.isFinite(normalizedCurrentYear)) return 0;

  const contractYears = getContractYearsForDisplay(player, { primaryContract });
  if (contractYears.length > 0) {
    return contractYears.filter(
      (yearEntry) => (yearEntry.year ?? 0) >= normalizedCurrentYear
    ).length;
  }

  return getLegacyYearsRemainingFallback(
    player,
    primaryContract,
    normalizedCurrentYear
  );
}

// Canonical selected-year contract lookup used by downstream shared consumers.
export function getContractYearSlice(
  player: ContractUtilsPlayer | null | undefined,
  endYear: number
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

interface PlayerCapSheetAmountsForYear {
  contractSlice: ReturnType<typeof getContractYearSlice>;
  capHit: number;
  baseSalary: number;
  hasCapHitAdjustment: boolean;
}

export function getPlayerCapSheetAmountsForYear(
  player: ContractUtilsPlayer | null | undefined,
  endYear: number
): PlayerCapSheetAmountsForYear {
  const contractSlice = getContractYearSlice(player, endYear);
  const baseSalary = Number(
    contractSlice?.salary ?? contractSlice?.capHit ?? 0
  ) || 0;

  let capHit = Number(contractSlice?.capHit ?? contractSlice?.salary ?? 0) || 0;
  const yearsOfService = normalizeYearsOfService(player?.yearsOfService);

  if (contractSlice) {
    if (player && isTwoWayContract(player)) {
      capHit = 0;
    } else if (player?.isMinimum && yearsOfService >= 3) {
      capHit = getMinimumCapHit(yearsOfService, endYear);
    }
  }

  return {
    contractSlice,
    capHit,
    baseSalary,
    hasCapHitAdjustment: Math.abs(capHit - baseSalary) > 0.5,
  };
}

export function getPlayerCapHitForYear(
  player: ContractUtilsPlayer | null | undefined,
  endYear: number
): number {
  return getPlayerCapSheetAmountsForYear(player, endYear).capHit;
}

// 3. Create max contract based on years of service
export function createMaxContract(
  playerName: unknown,
  yearsOfService: number,
  capProjections: CapProjections,
  startYear: number = 2025
) {
  void playerName;

  let basePct = 0.25;
  if (yearsOfService >= 10) basePct = 0.35;
  else if (yearsOfService >= 7) basePct = 0.3;

  const key = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  const cap = capProjections?.[key]?.cap || 0;
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
  pickNumber: number = 10,
  startYear: number = 2025
) {
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
export function getMinimumSalary(
  yearsOfService: number | string | null | undefined
) {
  return getLegacyMinimumSalary(yearsOfService);
}

// 6. Stretch provision calculator
export function stretchContract(
  input: { salariesByYear?: SalaryRowInput[]; contract?: { salariesByYear?: SalaryRowInput[] } | null } | null | undefined,
  currentYear: number
) {
  const salariesByYear = input?.salariesByYear ?? input?.contract?.salariesByYear;

  const yearKeys = (salariesByYear ?? [])
    .map((y) => toEndYear(y.season))
    .filter((y): y is number => y != null);

  const remainingYears = yearKeys.filter((y) => y >= currentYear).length;

  const totalOwed = yearKeys
    .filter((y) => y >= currentYear)
    .reduce((sum, key) => {
      const yearEntry = salariesByYear?.find((y) => {
        const entryEndYear = toEndYear(y.season);
        return entryEndYear === key;
      });
      return sum + (Number(yearEntry?.salary ?? 0) || 0);
    }, 0);

  const stretchYears = remainingYears * 2 + 1;
  const stretchedAnnual = Math.round(totalOwed / stretchYears);

  const stretched: Record<number, number> = {};
  for (let i = 0; i < stretchYears; i++) {
    stretched[currentYear + i] = stretchedAnnual;
  }

  return stretched;
}

// 7. Minimum cap hit calculation (special 2-year rule)
export function getMinimumCapHit(
  yearsOfService: number | string | null | undefined,
  seasonOrEndYear?: MinimumSalarySeasonInput
) {
  const normalizedYearsOfService = normalizeYearsOfService(yearsOfService);
  const normalizedSeason = normalizeMinimumSalarySeason(seasonOrEndYear);

  if (normalizedSeason) {
    return getMinimumCapHitFromMinimumSalaryRules(
      normalizedYearsOfService,
      normalizedSeason
    );
  }

  if (normalizedYearsOfService >= 3) {
    return LEGACY_MINIMUM_CAP_HIT;
  }

  return getMinimumSalary(normalizedYearsOfService);
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
  baseSalary: number,
  startYear: number = 2025,
  yearsOfService: number = 0
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
    isMinimum: baseSalary <= 2200000,
    yearsOfService,
  };
}

/**
 * Get player's last salary from contract data
 *
 * @param {Object} player - Player data
 * @returns {number} Last salary or 0
 */
export function getLastSalary(player: ContractUtilsPlayer | null | undefined) {
  const salaries = player?.contract?.salariesByYear;

  if (!salaries?.length) return 0;

  const sorted = [...salaries].sort((a, b) => {
    const yearA = toEndYear(a.season) || 0;
    const yearB = toEndYear(b.season) || 0;
    return yearB - yearA;
  });

  return Number(sorted[0]?.salary ?? sorted[0]?.capHit ?? 0) || 0;
}
