import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  PlayerMainDocZ,
  SeasonDocZ,
  PlayerDisplayZ,
} from '@/schemas/players_v2';
import { BasePlayerDocZ, BasePlayerContractZ } from '@/schemas/architect';

interface CliArgs {
  playerId: string;
  outDir: string;
  validate: boolean;
}

type PlayerIndexEntry = {
  fullName?: string;
  nbaId?: number;
  salarySwishSlug?: string;
  teamCode?: string;
  [key: string]: unknown;
};

type ContractSalaryRow = {
  season: string;
  salary: number;
  capHit?: number | null;
  guaranteed?: boolean;
  option?: 'PO' | 'TO' | 'ETO' | null;
  optionUsed?: boolean | null;
  optionDecisionDate?: string | null;
  tradeBonus?: number | null;
  incentives?: { likely?: number; unlikely?: number };
  guaranteeSchedule?: Array<{
    effectiveDate: string;
    guaranteedAmount: number;
    status: string;
    note: string;
  }>;
  guaranteedAmount?: number;
  voidedByExtension?: boolean;
  voidedOn?: string;
};

type ContractSource = {
  contractType: string;
  isExtension?: boolean;
  isRookieScale?: boolean;
  signedUsing?: string | null;
  signingTeam: string;
  signingDate?: string | null;
  signingExecutive?: string | null;
  signedByCurrentTeam?: boolean | null;
  startSeason?: string | null;
  endSeason?: string | null;
  contractLength: number;
  yearsRemaining?: number;
  totalValue: number;
  averageAnnualValue?: number | null;
  guaranteedValue?: number | null;
  guaranteedYears?: number | null;
  salariesByYear: ContractSalaryRow[];
  noTradeClause?: boolean;
  tradeKicker?: number | null;
  tradeRestrictions?: string[];
  birdRights?: { status?: string } | null;
  freeAgency?: {
    type?: string | null;
    year?: number;
    capHold?: number | null;
    qualifyingOffer?: number | null;
    earlyTerminationOption?: string | null;
    hasOption?: boolean | null;
    optionYear?: string | null;
    optionType?: string | null;
  } | null;
  tradeEligibility?: {
    canBeTradedNow?: boolean | null;
    restrictedUntil?: string | null;
    reason?: string | null;
    rules?: {
      baseYearCompensation?: boolean;
      poisonPill?: boolean;
      aggregation?: boolean;
    };
  } | null;
  isMaxContract?: boolean;
  maxType?: string | null;
  estimatedCapPercentage?: number | null;
  supersededIn?: string;
  supersededByContractRef?: string;
  supersedesContractRef?: string;
};

type ContractOutput = {
  playerId: string;
  displayName: string;
  teamCode: string;
  teamName: string;
  bio: {
    position?: string;
    birthdate?: string;
    height?: string;
    weight?: string;
    age?: number;
    shoots?: string;
    experience?: number;
    draftYear?: string;
    draftRound?: number;
    draftPick?: number;
    draftedBy?: string | null;
  };
  contract: ContractSource;
  futureContract?: ContractSource;
  representation?: { agent?: string | null; agency?: string | null } | null;
  source: { provider: string; playerPageUrl: string; scrapedAt: string };
  lastUpdated: string;
  version: string;
};

type StatsOutput = {
  playerId: string;
  teamCode: string;
  seasons: Record<
    string,
    {
      team?: string;
      age?: number | null;
      pos?: string | null;
      stats?: Record<string, number>;
    }
  >;
  meta?: Record<string, unknown>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname is player-scrape/firestore_staging/scripts, so ../.. = player-scrape/
const PLAYER_SCRAPE_ROOT = path.resolve(__dirname, '../..');
const CONTRACTS_DIR = path.join(
  PLAYER_SCRAPE_ROOT,
  'contracts',
  '_artifacts',
  'output'
);
const STATS_DIR = path.join(PLAYER_SCRAPE_ROOT, 'stats', 'output');
const PLAYER_INDEX_PATH = path.join(
  PLAYER_SCRAPE_ROOT,
  'shared',
  'outputs',
  'player_index.json'
);

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let playerId: string | undefined;
  let outDir: string | undefined;
  let validate = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--player' || arg === '-p') {
      playerId = argv[++i];
    } else if (arg.startsWith('--player=')) {
      [, playerId] = arg.split('=');
    } else if (arg === '--outDir') {
      outDir = argv[++i];
    } else if (arg.startsWith('--outDir=')) {
      [, outDir] = arg.split('=');
    } else if (arg === '--validate') {
      validate = true;
    }
  }

  if (!playerId) {
    throw new Error('Missing required --player argument');
  }

  return {
    playerId,
    outDir: outDir
      ? path.resolve(process.cwd(), outDir)
      : path.join(__dirname, '..', '_artifacts', 'output'),
    validate,
  };
}

function parseHeight(height?: string): number | undefined {
  if (!height) return undefined;
  const match = height.match(/(\d)\s*-\s*(\d{1,2})/);
  if (!match) return undefined;
  const [, feet, inches] = match;
  const ft = Number(feet);
  const inch = Number(inches);
  if (Number.isNaN(ft) || Number.isNaN(inch)) return undefined;
  return ft * 12 + inch;
}

function parseWeight(weight?: string): number | undefined {
  if (!weight) return undefined;
  const cleaned = weight.replace(/[^0-9.]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function parseDob(dob?: string): string | undefined {
  if (!dob) return undefined;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function parseIntegerField(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const match = trimmed.match(/-?\d+/);
    if (!match) return undefined;
    const parsed = Number.parseInt(match[0], 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === '-' ||
    trimmed === '—' ||
    trimmed.toLowerCase() === 'na' ||
    trimmed.toLowerCase() === 'n/a'
  ) {
    return undefined;
  }
  return trimmed;
}

function buildTimestamp(date = new Date()) {
  return {
    _seconds: Math.floor(date.getTime() / 1000),
    _nanoseconds: (date.getTime() % 1000) * 1_000_000,
  };
}

function normalizeSeasonCode(
  season: string | null | undefined
): string | undefined {
  if (!season) return undefined;
  // Remove suffixes like " W" (two-way), " TBD", etc. and normalize to YYYY-YY format
  const cleaned = season
    .trim()
    .replace(/\s+[A-Z]+$/, '')
    .trim();
  const match = cleaned.match(/^(\d{4})-(\d{2})$/);
  if (match) return cleaned;
  // If it doesn't match, try to extract year
  const yearMatch = cleaned.match(/^(\d{4})/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const nextYear = String(year + 1).slice(-2);
    return `${year}-${nextYear}`;
  }
  return undefined;
}

function getSeasonStartYear(season: string): number {
  const normalized = normalizeSeasonCode(season);
  if (!normalized) throw new Error(`Invalid season code: ${season}`);
  const match = normalized.match(/^(\d{4})/);
  if (!match) throw new Error(`Invalid season code: ${season}`);
  return Number(match[1]);
}

function normalizeFreeAgency(fa?: ContractSource['freeAgency']) {
  return {
    type: fa?.type ?? null,
    year: fa?.year,
    capHold: fa?.capHold ?? undefined,
    qualifyingOffer: fa?.qualifyingOffer ?? null,
    earlyTerminationOption: fa?.earlyTerminationOption ?? null,
    hasOption: fa?.hasOption ?? undefined,
    optionYear: fa?.optionYear ?? null,
    optionType: fa?.optionType ?? null,
  };
}

function normalizeSalaries(rows: ContractSalaryRow[]) {
  return rows.map((row) => ({
    season: normalizeSeasonCode(row.season) ?? row.season, // Normalize season codes (remove " W" suffix, etc.)
    salary: row.salary,
    capHit: row.capHit ?? row.salary,
    guaranteed: row.guaranteed ?? false,
    guaranteedAmount: row.guaranteedAmount ?? (row.guaranteed ? row.salary : 0),
    option: row.option ?? null,
    optionUsed: row.optionUsed ?? null,
    optionDecisionDate: row.optionDecisionDate ?? null,
    tradeBonus: row.tradeBonus ?? null,
    incentives: row.incentives ?? { likely: 0, unlikely: 0 },
    guaranteeSchedule: row.guaranteeSchedule ?? [],
    voidedByExtension: row.voidedByExtension ?? undefined,
    voidedOn: row.voidedOn ?? undefined,
  }));
}

function normalizeBirdRights(contract: ContractSource) {
  const br = contract.birdRights ?? {};
  return {
    status: br.status ?? 'Unknown',
    yearsOfService: br.yearsOfService,
    yearsWithTeam: br.yearsWithTeam,
    eligibleFor: br.eligibleFor ?? [],
  };
}

function normalizeTradeEligibility(contract: ContractSource) {
  const te = contract.tradeEligibility ?? {};
  return {
    canBeTradedNow: null,
    restrictedUntil: te.restrictedUntil ?? null,
    reason: te.reason ?? null,
    rules: {
      baseYearCompensation: te.rules?.baseYearCompensation ?? false,
      poisonPill: te.rules?.poisonPill ?? false,
      aggregation: te.rules?.aggregation ?? true,
    },
  };
}

function prepareContract(contract: ContractSource) {
  return BasePlayerContractZ.parse({
    contractType: contract.contractType,
    isExtension: contract.isExtension ?? false,
    isRookieScale: contract.isRookieScale ?? false,
    signedUsing: contract.signedUsing ?? undefined,
    signingTeam: contract.signingTeam,
    signingDate: contract.signingDate ?? undefined,
    signingExecutive: contract.signingExecutive ?? undefined,
    signedByCurrentTeam: contract.signedByCurrentTeam ?? false,
    startSeason:
      normalizeSeasonCode(
        contract.startSeason ?? contract.salariesByYear[0]?.season
      ) ?? 'TBD',
    endSeason:
      normalizeSeasonCode(
        contract.endSeason ?? contract.salariesByYear.at(-1)?.season
      ) ?? 'TBD',
    contractLength: contract.contractLength,
    yearsRemaining: contract.yearsRemaining ?? contract.contractLength,
    totalValue: contract.totalValue,
    averageAnnualValue: contract.averageAnnualValue ?? 0,
    guaranteedValue: contract.guaranteedValue ?? 0,
    guaranteedYears: contract.guaranteedYears ?? 0,
    salariesByYear: normalizeSalaries(contract.salariesByYear ?? []),
    noTradeClause: contract.noTradeClause ?? false,
    tradeKicker: contract.tradeKicker ?? null,
    tradeRestrictions: contract.tradeRestrictions ?? [],
    birdRights: normalizeBirdRights(contract),
    freeAgency: normalizeFreeAgency(contract.freeAgency),
    tradeEligibility: normalizeTradeEligibility(contract),
    isMaxContract: contract.isMaxContract ?? false,
    maxType: contract.maxType ?? null,
    estimatedCapPercentage: contract.estimatedCapPercentage ?? null,
    supersededIn: contract.supersededIn,
    supersededByContractRef: contract.supersededByContractRef,
    supersedesContractRef: contract.supersedesContractRef,
  });
}

type NormalizedContract = ReturnType<typeof prepareContract>;

function collectContracts(contractData: ContractOutput) {
  const sources: ContractSource[] = [contractData.contract];
  if (contractData.futureContract) {
    sources.push(contractData.futureContract);
  }

  const entries: Array<{ id: string; contract: NormalizedContract }> = [];

  sources
    .map((src) => prepareContract(src))
    .sort(
      (a, b) =>
        getSeasonStartYear(a.startSeason) - getSeasonStartYear(b.startSeason)
    )
    .forEach((contract, idx) => {
      entries.push({
        id: `contract_${idx + 1}`,
        contract,
      });
    });

  return entries;
}

function listActiveSeasons(contracts: NormalizedContract[]) {
  const seasons = new Map<
    string,
    { salary: number; contract: NormalizedContract }
  >();
  for (const contract of contracts) {
    for (const row of contract.salariesByYear) {
      if (row.voidedByExtension) continue;
      seasons.set(row.season, { salary: row.salary, contract });
    }
  }
  return seasons;
}

function seasonToFreeAgentYear(season: string | undefined) {
  if (!season) return undefined;
  return getSeasonStartYear(season) + 1;
}

function computeDisplay(
  contracts: NormalizedContract[],
  rosterTeamName: string,
  rosterTeamCode: string,
  position: string | undefined,
  experience: number | undefined,
  fallbackAav: number | undefined
) {
  const seasons = listActiveSeasons(contracts);
  const now = new Date();
  const currentSeasonStartYear =
    now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  let totalSalary = 0;
  let latestSeason: string | undefined;
  let latestContract: NormalizedContract | undefined;

  for (const [season, { salary, contract }] of seasons.entries()) {
    totalSalary += salary;
    if (
      !latestSeason ||
      getSeasonStartYear(season) > getSeasonStartYear(latestSeason)
    ) {
      latestSeason = season;
      latestContract = contract;
    }
  }

  const seasonCount = seasons.size;
  const averageAnnualValue =
    seasonCount > 0 ? totalSalary / seasonCount : (fallbackAav ?? 0);

  const yearsLeft = Array.from(seasons.keys()).filter(
    (season) => getSeasonStartYear(season) >= currentSeasonStartYear
  ).length;

  const freeAgentYear =
    latestContract?.freeAgency?.year ??
    seasonToFreeAgentYear(latestContract?.endSeason ?? latestSeason);

  const freeAgentType = (latestContract?.freeAgency?.type ?? 'NONE') as any;

  const display = PlayerDisplayZ.parse({
    team: rosterTeamName,
    teamId: rosterTeamCode,
    POS: position,
    yearsPro: experience,
    averageAnnualValue,
    yearsLeft,
    freeAgentYear,
    freeAgentType,
  });

  return display;
}

function isSeasonInRange(contract: NormalizedContract, year: number): boolean {
  const seasons = contract.salariesByYear.filter(
    (row) => !row.voidedByExtension
  );
  if (!seasons.length) return false;
  const start = Math.min(
    ...seasons.map((row) => getSeasonStartYear(row.season))
  );
  const end = Math.max(...seasons.map((row) => getSeasonStartYear(row.season)));
  return year >= start && year <= end;
}

type ContractRecord = NormalizedContract & {
  metadata: {
    startSeason: string;
    endSeason: string;
    isCurrent: boolean;
    label: string;
  };
};

function buildPlayersV2Payload(
  playerId: string,
  indexEntry: PlayerIndexEntry,
  contractData: ContractOutput,
  statsData: StatsOutput | null
) {
  const nowTs = buildTimestamp();
  const contractEntries = collectContracts(contractData);
  const contracts: Record<string, ContractRecord> = {};

  const currentSeasonYear =
    new Date().getMonth() >= 8
      ? new Date().getFullYear()
      : new Date().getFullYear() - 1;

  const currentEntry =
    [...contractEntries]
      .reverse()
      .find((entry) => isSeasonInRange(entry.contract, currentSeasonYear)) ??
    contractEntries[contractEntries.length - 1] ??
    null;

  const nextEntry =
    contractEntries.find(
      (entry) =>
        entry !== currentEntry &&
        entry.contract.salariesByYear
          .filter((row) => !row.voidedByExtension)
          .every((row) => getSeasonStartYear(row.season) > currentSeasonYear)
    ) ?? null;

  for (const entry of contractEntries) {
    const isCurrent = currentEntry ? entry.id === currentEntry.id : false;
    contracts[entry.id] = {
      ...entry.contract,
      metadata: {
        startSeason: entry.contract.startSeason,
        endSeason: entry.contract.endSeason,
        isCurrent,
        label: entry.contract.contractType,
      },
    };
  }

  const seasons: Record<string, ReturnType<typeof SeasonDocZ.parse>> = {};
  if (statsData) {
    for (const [seasonCode, payload] of Object.entries(
      statsData.seasons ?? {}
    )) {
      const doc = SeasonDocZ.parse({
        team: payload.team,
        age: typeof payload.age === 'number' ? payload.age : undefined,
        stats: payload.stats,
        meta: {
          ...(statsData.meta ?? {}),
        },
      });
      seasons[seasonCode] = doc;
    }
  }

  const agent =
    contractData.representation?.agent || contractData.representation?.agency
      ? {
          name: contractData.representation?.agent ?? null,
          agency: contractData.representation?.agency ?? null,
        }
      : undefined;

  const draftYear = parseIntegerField(contractData.bio.draftYear);
  const draftRound = parseIntegerField(contractData.bio.draftRound);
  const draftPick = parseIntegerField(contractData.bio.draftPick);
  const draftedBy = sanitizeString(contractData.bio.draftedBy);

  const display = computeDisplay(
    contractEntries.map((c) => c.contract),
    contractData.teamName,
    indexEntry.teamCode ?? contractData.teamCode,
    contractData.bio.position,
    contractData.bio.experience,
    contractData.contract.averageAnnualValue
  );

  const seasonMap = new Map<
    string,
    {
      salary: number;
      guaranteedAmount: number;
      optionType: string | null;
      optionDecisionDate: string | null;
      sourceContractId: string;
    }
  >();
  for (const entry of contractEntries) {
    for (const row of entry.contract.salariesByYear) {
      if (row.voidedByExtension) continue;
      seasonMap.set(row.season, {
        salary: row.salary,
        guaranteedAmount:
          row.guaranteedAmount ?? (row.guaranteed ? row.salary : 0),
        optionType: row.option ?? null,
        optionDecisionDate: row.optionDecisionDate ?? null,
        sourceContractId: entry.id,
      });
    }
  }

  function seasonCodeFromStartYear(startYear: number) {
    const nextShort = String((startYear + 1) % 100).padStart(2, '0');
    return `${startYear}-${nextShort}`;
  }

  const timelineSeasons = [];
  for (let offset = 0; offset < 6; offset++) {
    const year = currentSeasonYear + offset;
    const code = seasonCodeFromStartYear(year);
    const entry = seasonMap.get(code);
    const seasonEntry: Record<string, any> = {
      season: code,
    };
    if (entry) {
      seasonEntry.salary = entry.salary;
    }
    if (entry && entry.guaranteedAmount < entry.salary) {
      seasonEntry.nonGuaranteed = { guaranteedAmount: entry.guaranteedAmount };
    }
    if (entry?.optionType) {
      seasonEntry.optionType = entry.optionType;
      if (entry.optionDecisionDate) {
        seasonEntry.optionDecisionDate = entry.optionDecisionDate;
      }
    }
    if (entry?.sourceContractId) {
      seasonEntry.sourceContractId = entry.sourceContractId;
    }
    timelineSeasons.push(seasonEntry);
  }

  const finalContract = contractEntries.at(-1)?.contract;
  const lastSeasonWithSalary = [...seasonMap.keys()]
    .sort((a, b) => getSeasonStartYear(a) - getSeasonStartYear(b))
    .at(-1);
  const freeAgentYear =
    finalContract?.freeAgency?.year ??
    (lastSeasonWithSalary
      ? seasonToFreeAgentYear(lastSeasonWithSalary)
      : undefined);
  // Ensure freeAgentType is a valid enum value or undefined (not null)
  const rawFreeAgentType = finalContract?.freeAgency?.type;
  const validFreeAgentTypes = ['UFA', 'RFA', 'SFA', 'TWO_WAY', 'NONE'];
  const freeAgentType =
    rawFreeAgentType && validFreeAgentTypes.includes(rawFreeAgentType)
      ? rawFreeAgentType
      : undefined;

  const birdRightsSource =
    currentEntry?.contract ?? finalContract ?? contractEntries[0]?.contract;
  const birdRights = birdRightsSource?.birdRights
    ? {
        status: birdRightsSource.birdRights.status ?? null,
        eligibleFor: birdRightsSource.birdRights.eligibleFor ?? [],
      }
    : null;

  const currentSeasonCode = seasonCodeFromStartYear(currentSeasonYear);
  const currentSeasonEntry = timelineSeasons.find(
    (season) => season.season === currentSeasonCode
  );
  const yearsRemaining = timelineSeasons.filter(
    (season) =>
      getSeasonStartYear(season.season) >= currentSeasonYear &&
      typeof season.salary === 'number' &&
      season.salary > 0
  ).length;
  const averageAnnualValueRounded = Math.round(display.averageAnnualValue ?? 0);

  // Build denormalized currentContractView for main document
  const salaryByYear: Record<number, number> = {};
  for (const entry of contractEntries) {
    for (const row of entry.contract.salariesByYear) {
      if (row.voidedByExtension) continue;
      const year = getSeasonStartYear(row.season);
      if (!salaryByYear[year] || row.salary > salaryByYear[year]) {
        salaryByYear[year] = row.salary;
      }
    }
  }

  // Extract options from current contract
  const options: any[] = [];
  if (currentEntry?.contract.salariesByYear) {
    for (const row of currentEntry.contract.salariesByYear) {
      if (row.option && !options.includes(row.option)) {
        options.push(row.option);
      }
    }
  }

  const currentContractView = {
    freeAgentYear,
    freeAgentType,
    contractType:
      currentEntry?.contract.contractType ??
      finalContract?.contractType ??
      undefined,
    options: options.length > 0 ? options : undefined,
    birdRights,
    salaryByYear:
      Object.keys(salaryByYear).length > 0 ? salaryByYear : undefined,
    currentSalary: currentSeasonEntry?.salary ?? undefined,
    yearsRemaining,
    averageAnnualValue: averageAnnualValueRounded,
    maxType:
      currentEntry?.contract.maxType ?? finalContract?.maxType ?? undefined,
  };

  // Remove null/undefined values from currentContractView before validation
  // Also ensure salaryByYear keys are numbers (not strings) if present
  if (currentContractView.salaryByYear) {
    const salaryByYearFixed: Record<number, number> = {};
    for (const [key, value] of Object.entries(
      currentContractView.salaryByYear
    )) {
      const numKey = typeof key === 'string' ? parseInt(key, 10) : key;
      if (!isNaN(numKey) && typeof value === 'number') {
        salaryByYearFixed[numKey] = value;
      }
    }
    currentContractView.salaryByYear =
      Object.keys(salaryByYearFixed).length > 0 ? salaryByYearFixed : undefined;
  }

  Object.keys(currentContractView).forEach((key) => {
    if (
      currentContractView[key] === null ||
      currentContractView[key] === undefined
    ) {
      delete currentContractView[key];
    }
  });

  // Build denormalized currentSeasonStats from current season (prioritize current season over older seasons)
  let currentSeasonStats: any = undefined;
  if (statsData && Object.keys(seasons).length > 0) {
    const currentSeasonCode = seasonCodeFromStartYear(currentSeasonYear);

    // First, try to find the current season
    let selectedSeason: [string, ReturnType<typeof SeasonDocZ.parse>] | null =
      null;
    if (seasons[currentSeasonCode]) {
      selectedSeason = [currentSeasonCode, seasons[currentSeasonCode]];
    } else {
      // If current season not found, sort seasons by year (most recent first), prioritizing non-carried-over
      const sortedSeasons = Object.entries(seasons).sort(
        ([aId, a], [bId, b]) => {
          const yearA = getSeasonStartYear(aId);
          const yearB = getSeasonStartYear(bId);
          const carryOverA = a.meta?.statsCarryOver === true;
          const carryOverB = b.meta?.statsCarryOver === true;

          // Non-carried-over seasons come first
          if (carryOverA !== carryOverB) {
            return carryOverA ? 1 : -1;
          }

          // Then sort by year (most recent first)
          return yearB - yearA;
        }
      );

      // Get the first season (which will be the most recent non-carried-over, or most recent if all are carried-over)
      selectedSeason = sortedSeasons[0] || null;
    }

    const [latestSeasonId, latestSeason] = selectedSeason || [null, null];

    if (latestSeason?.stats) {
      currentSeasonStats = {
        PTS: latestSeason.stats.PTS,
        REB: latestSeason.stats.REB,
        AST: latestSeason.stats.AST,
        'FG%': latestSeason.stats['FG%'],
        '3PT%': latestSeason.stats['3PT%'],
        'FT%': latestSeason.stats['FT%'],
        'eFG%': latestSeason.stats['eFG%'],
        MIN: latestSeason.stats.MIN,
        GP: latestSeason.stats.GP,
      };
      // Remove undefined values
      Object.keys(currentSeasonStats).forEach((key) => {
        if (currentSeasonStats[key] === undefined) {
          delete currentSeasonStats[key];
        }
      });
      if (Object.keys(currentSeasonStats).length === 0) {
        currentSeasonStats = undefined;
      }
    }
  }

  // Build mainDoc with denormalized views included
  const mainDoc = PlayerMainDocZ.parse({
    bio: {
      displayName: indexEntry.displayName ?? contractData.displayName,
      name: indexEntry.fullName ?? contractData.displayName,
      playerId,
      position: contractData.bio.position ?? 'UNK',
      height: parseHeight(contractData.bio.height),
      weight: parseWeight(contractData.bio.weight),
      dob: parseDob(contractData.bio.birthdate),
      shoots: contractData.bio.shoots ?? undefined,
      agent,
      draft: {
        year: draftYear,
        round: draftRound,
        pick: draftPick,
        teamId: draftedBy,
      },
      display,
      nbaId: indexEntry.nbaId,
    },
    createdAt: nowTs,
    updatedAt: nowTs,
    currentContractView:
      Object.keys(currentContractView).length > 0
        ? currentContractView
        : undefined,
    currentEvaluationView: undefined, // Will be populated when evaluations are saved
    currentSeasonStats,
  });

  return {
    doc: mainDoc,
    contracts,
    seasons,
    views: {
      contracts: {
        seasons: timelineSeasons,
        freeAgentYear,
        freeAgentType: freeAgentType ?? undefined,
        birdRights,
        currentSalary: currentSeasonEntry?.salary ?? undefined,
        yearsRemaining,
        averageAnnualValue: averageAnnualValueRounded,
      },
    },
  };
}

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function stagePlayer({ playerId, outDir, validate }: CliArgs) {
  const index: Record<string, PlayerIndexEntry> =
    await loadJson(PLAYER_INDEX_PATH);
  const indexEntry = index[playerId];
  if (!indexEntry) {
    throw new Error(`Player ${playerId} not found in index`);
  }

  const teamCode = indexEntry.teamCode;
  // Free agents have null teamCode - use 'FREE' directory for their contract files
  const contractTeamDir = teamCode || 'FREE';

  const contractPath = path.join(
    CONTRACTS_DIR,
    contractTeamDir,
    `${playerId}.json`
  );
  const statsPath = teamCode
    ? path.join(STATS_DIR, teamCode, `${playerId}.json`)
    : null;

  let contractData: ContractOutput | null = null;
  try {
    contractData = await loadJson<ContractOutput>(contractPath);
  } catch {
    // Free agents might not have contract data - that's okay
    if (!teamCode) {
      contractData = null;
    } else {
      throw new Error(
        `Contract file not found for ${playerId} at ${contractPath}`
      );
    }
  }
  let statsData: StatsOutput | null = null;
  try {
    statsData = await loadJson<StatsOutput>(statsPath);
  } catch {
    statsData = null;
  }

  // Only require contract data for players with a team (non-free agents)
  // Free agents might not have contract data - that's okay
  if (!contractData && teamCode) {
    throw new Error(
      `Contract data required for ${playerId} (team: ${teamCode}). Contract file not found at ${contractPath}`
    );
  }

  // Normalize season codes in contract data (remove " W" suffixes, etc.)
  if (contractData && contractData.contract) {
    contractData = {
      ...contractData,
      contract: {
        ...contractData.contract,
        startSeason:
          normalizeSeasonCode(contractData.contract.startSeason) ??
          contractData.contract.startSeason ??
          'TBD',
        endSeason:
          normalizeSeasonCode(contractData.contract.endSeason) ??
          contractData.contract.endSeason ??
          'TBD',
        salariesByYear: (contractData.contract.salariesByYear ?? []).map(
          (row) => ({
            ...row,
            season: normalizeSeasonCode(row.season) ?? row.season,
          })
        ),
      },
    };
    if (contractData.futureContract) {
      contractData = {
        ...contractData,
        futureContract: {
          ...contractData.futureContract,
          startSeason:
            normalizeSeasonCode(contractData.futureContract.startSeason) ??
            contractData.futureContract.startSeason ??
            'TBD',
          endSeason:
            normalizeSeasonCode(contractData.futureContract.endSeason) ??
            contractData.futureContract.endSeason ??
            'TBD',
          salariesByYear: (
            contractData.futureContract.salariesByYear ?? []
          ).map((row) => ({
            ...row,
            season: normalizeSeasonCode(row.season) ?? row.season,
          })),
        },
      };
    }
  }

  // For free agents, create or normalize contract data structure
  if (!teamCode) {
    if (!contractData) {
      // Free agent without contract file - create minimal structure
      const fullName =
        indexEntry.fullName ??
        playerId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      contractData = {
        playerId,
        displayName: fullName,
        teamCode: 'FREE', // Use 'FREE' as teamCode for free agents (BasePlayerDocZ requires a string)
        teamName: 'Free Agent',
        bio: {
          position: indexEntry.position ?? 'UNK',
          height: undefined,
          weight: undefined,
          birthdate: undefined,
          shoots: undefined,
          experience: undefined,
        },
        contract: {
          contractType: 'FREE AGENT',
          isExtension: false,
          isRookieScale: false,
          signingTeam: undefined, // Optional field - omit for free agents
          signingDate: undefined, // Optional field
          signedByCurrentTeam: false,
          startSeason: '2025-26', // Required field - use current season as placeholder
          endSeason: '2025-26', // Required field - use current season as placeholder
          contractLength: 0,
          yearsRemaining: 0,
          totalValue: 0,
          averageAnnualValue: 0, // Required field - use 0 for free agents
          guaranteedValue: 0, // Required field - use 0 for free agents
          guaranteedYears: 0, // Required field - use 0 for free agents
          salariesByYear: [],
          noTradeClause: false,
          tradeKicker: null, // Required field - nullable, use null for free agents
          tradeRestrictions: [],
          birdRights: { status: 'Unknown' },
          freeAgency: {
            type: 'UFA',
            year: undefined,
            capHold: undefined,
            qualifyingOffer: null,
            earlyTerminationOption: null,
            hasOption: undefined,
            optionYear: null,
            optionType: null,
          },
          tradeEligibility: {
            canBeTradedNow: null,
            restrictedUntil: null,
            reason: null,
            rules: {
              baseYearCompensation: false,
              poisonPill: false,
              aggregation: false,
            },
          },
          isMaxContract: false,
          maxType: undefined, // Optional field
          estimatedCapPercentage: undefined, // Optional field
        },
        futureContract: undefined,
        lastUpdated: new Date().toISOString(),
        version: '1.0',
      };
    } else {
      // Free agent with contract file - normalize structure
      contractData = {
        ...contractData,
        teamCode: 'FREE', // Use 'FREE' as teamCode for free agents (BasePlayerDocZ requires a string)
        teamName: 'Free Agent',
        contract: {
          ...contractData.contract,
          contractType: 'FREE AGENT',
          isExtension: false,
          isRookieScale: false,
          signingTeam: undefined, // Optional field - omit for free agents
          signingDate: undefined, // Optional field
          signedByCurrentTeam: false,
          startSeason: '2025-26', // Required field - use current season as placeholder
          endSeason: '2025-26', // Required field - use current season as placeholder
          contractLength: 0,
          yearsRemaining: 0,
          totalValue: 0,
          averageAnnualValue: 0, // Required field - use 0 for free agents
          guaranteedValue: 0, // Required field - use 0 for free agents
          guaranteedYears: 0, // Required field - use 0 for free agents
          salariesByYear: [],
          noTradeClause: false,
          tradeKicker: null, // Required field - nullable, use null for free agents
          tradeRestrictions: [],
          birdRights: { status: 'Unknown' },
          freeAgency: {
            type: 'UFA',
            year: undefined,
            capHold: undefined,
            qualifyingOffer: null,
            earlyTerminationOption: null,
            hasOption: undefined,
            optionYear: null,
            optionType: null,
          },
          tradeEligibility: {
            canBeTradedNow: null,
            restrictedUntil: null,
            reason: null,
            rules: {
              baseYearCompensation: false,
              poisonPill: false,
              aggregation: false,
            },
          },
          isMaxContract: false,
          maxType: undefined, // Optional field
          estimatedCapPercentage: undefined, // Optional field
        },
        futureContract: undefined,
      };
    }
  }

  // Update contractData with the correct displayName from bio data before creating basePlayerDoc
  if (indexEntry.displayName) {
    contractData.displayName = indexEntry.displayName;
  }

  const basePlayerParsed = BasePlayerDocZ.parse(contractData);
  const { source: _baseSource, ...basePlayerDoc } = basePlayerParsed;

  const playersV2Payload = buildPlayersV2Payload(
    playerId,
    indexEntry,
    contractData,
    statsData
  );

  if (validate) {
    // Force validation of subcollections already done via parse
    for (const contractDoc of Object.values(playersV2Payload.contracts)) {
      const { metadata, ...core } = contractDoc as any;
      BasePlayerContractZ.parse(core);
    }
    for (const seasonDoc of Object.values(playersV2Payload.seasons)) {
      SeasonDocZ.parse(seasonDoc);
    }
  }

  const playersV2Out = path.join(outDir, 'players_v2');
  const basePlayersOut = path.join(outDir, 'basePlayers');
  await mkdir(playersV2Out, { recursive: true });
  await mkdir(basePlayersOut, { recursive: true });

  await writeFile(
    path.join(playersV2Out, `${playerId}.json`),
    JSON.stringify(playersV2Payload, null, 2),
    'utf8'
  );

  await writeFile(
    path.join(basePlayersOut, `${playerId}.json`),
    JSON.stringify(basePlayerDoc, null, 2),
    'utf8'
  );

  return {
    playersV2Path: path.join(playersV2Out, `${playerId}.json`),
    basePlayersPath: path.join(basePlayersOut, `${playerId}.json`),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  stagePlayer(parseArgs())
    .then((outPaths) => {
      console.log('Staged files created:', outPaths);
    })
    .catch((err) => {
      console.error('Failed to stage player:', err);
      process.exit(1);
    });
}
