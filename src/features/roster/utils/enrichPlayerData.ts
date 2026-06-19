/**
 * FILE: src/features/roster/utils/enrichPlayerData.ts
 * PURPOSE: Normalize players_v2 data into UI-friendly contract, stats, and evaluation fields.
 * OWNERSHIP: Feature: roster (player data enrichment)
 *
 * HISTORY:
 *  - 2026-01-22: Phase 3 - Added videoExamples merge for evaluations
 *  - 2026-01-21: Updated by plan `plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-3-videos/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import { POSITION_MAP } from '@/shared/utils/roles/roleUtils';
import { normalizeBlurbs } from '@/shared/utils/blurbs';
import type { Blurbs } from '@/shared/utils/blurbs';
import { normalizeVideoExamples } from '@/shared/utils/videoExamples';
import type { NormalizedVideoExamples } from '@/shared/utils/videoExamples';

type BirdRightsInput =
  | string
  | {
      status?: string | null;
      eligibleFor?: string[] | null;
    }
  | null
  | undefined;

type SalaryYearEntry = {
  year?: number | string | null;
  season?: number | string | null;
  salary?: number | string | null;
  option?: string | null;
};

type ContractOption = {
  year?: number | string | null;
  type?: string | null;
};

type FreeAgencyInput = {
  freeAgentYear?: number | string | null;
  freeAgentType?: string | null;
  type?: string | null;
  year?: number | null;
};

export type EnrichableContract = {
  salariesByYear?: SalaryYearEntry[] | null;
  freeAgency?: FreeAgencyInput | null;
  contractType?: string | null;
  options?: ContractOption[] | null;
  birdRights?: BirdRightsInput;
  yearsRemaining?: number | null;
  averageAnnualValue?: number | null;
  maxType?: string | null;
};

type CurrentContractViewInput = {
  salaryByYear?: Record<string, number | null | undefined> | null;
  optionsByYear?: Record<string, string | null | undefined> | null;
  freeAgentYear?: number | string | null;
  freeAgentType?: string | null;
  contractType?: string | null;
  options?: ContractOption[] | null;
  birdRights?: BirdRightsInput;
  yearsRemaining?: number | null;
  averageAnnualValue?: number | null;
  maxType?: string | null;
  currentSalary?: number | null;
};

type ContractViewSeasonInput = {
  season?: number | string | null;
  optionType?: string | null;
};

type ContractsViewInput = {
  seasons?: ContractViewSeasonInput[] | null;
};

type PlayerStatValue = number | string | null | undefined;

export type PlayerStats = Record<string, unknown> & {
  PTS?: PlayerStatValue;
  REB?: PlayerStatValue;
  AST?: PlayerStatValue;
  'FG%'?: PlayerStatValue;
  '3PT%'?: PlayerStatValue;
  'FT%'?: PlayerStatValue;
  'eFG%'?: PlayerStatValue;
  MIN?: PlayerStatValue;
  GP?: PlayerStatValue;
};
type SeasonMeta = Record<string, unknown>;

type SeasonInput = {
  stats?: PlayerStats | null;
  meta?: SeasonMeta | null;
};

type EvaluationRoles = {
  offense1?: string;
  offense2?: string;
  defense1?: string;
  defense2?: string;
};

export type PlayerSubRoles = {
  offense: string[];
  defense: string[];
};

type EvaluationInput = {
  roles?: EvaluationRoles | null;
  traits?: Record<string, number> | null;
  subRoles?: Partial<PlayerSubRoles> | null;
  shootingProfile?: unknown;
  twoWay?: number | null;
  badges?: string[] | null;
  overallGrade?: number | null;
  blurbs?: unknown;
  videoExamples?: unknown;
};

type PlayerBioInput = {
  displayName?: string | null;
  playerId?: string | null;
  position?: string | null;
  height?: number | null;
  weight?: number | null;
  age?: number | null;
  dob?: string | null;
  display?: {
    team?: string | null;
    teamId?: string | null;
    freeAgentYear?: number | string | null;
    freeAgentType?: string | null;
  } | null;
};

export type EnrichablePlayerData = {
  id?: string;
  bio?: PlayerBioInput | null;
  currentContractView?: CurrentContractViewInput | null;
  contractsView?: ContractsViewInput | null;
  contracts?: Record<string, EnrichableContract | null | undefined> | null;
  currentSeasonStats?: PlayerStats | null;
  seasons?: Record<string, SeasonInput | null | undefined> | null;
  currentEvaluationView?: EvaluationInput | null;
  evaluations?: Record<string, EvaluationInput | null | undefined> | null;
};

type PrimaryEvaluation = EvaluationInput & {
  roles: EvaluationRoles;
  traits: Record<string, number>;
  subRoles: PlayerSubRoles;
  shootingProfile: string;
  twoWay: number | null | undefined;
  badges: string[];
  overallGrade: number | null | undefined;
  blurbs: Blurbs;
  videoExamples: NormalizedVideoExamples;
};

export type EnrichedPlayerData<
  TPlayer extends EnrichablePlayerData = EnrichablePlayerData,
> = TPlayer & EnrichablePlayerData & {
  name: string;
  formattedPosition: string;
  heightInInches: number;
  weight: number;
  age: number;
  team: string | null;
  headshotUrl: string;
  offenseRole: string;
  defenseRole: string;
  shootingProfile: string;
  twoWay: number | null;
  blurbs: Blurbs;
  videoExamples: NormalizedVideoExamples;
  subRoles: PlayerSubRoles;
  traits: Record<string, number>;
  badges: string[];
  overallGrade: number | null;
  freeAgentYear: number | string | null;
  freeAgentType: string | null;
  birdRightsStatus: string | null;
  optionByYear: Record<string | number, string>;
  salaryByYear: Record<string | number, number | null>;
  latestSeasonId: string | null;
  latestSeasonStats: PlayerStats;
  latestSeasonMeta: SeasonMeta;
  primaryContractId: string | null;
  primaryContract: EnrichableContract | null;
  primaryEvaluation: PrimaryEvaluation;
  PPG: number | string | null | undefined;
  RPG: number | string | null | undefined;
  APG: number | string | null | undefined;
};

/**
 * Normalize playerId for headshot path lookup
 * Handles special characters (e.g., kristaps_porzingis -> kristaps_porziņģis)
 */
function normalizeHeadshotId(playerId: string | null | undefined): string {
  if (!playerId) return 'default';
  // Normalize special characters - convert to ASCII-friendly version
  return playerId
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Get headshot path, trying normalized version first, then falling back to original
 */
function getHeadshotPath(playerId: string | null | undefined): string {
  if (!playerId) return '/assets/headshots/default.png';
  const normalized = normalizeHeadshotId(playerId);
  // Try normalized first (handles special characters)
  return `/assets/headshots/${normalized}.png`;
}

/**
 * Calculate age from date of birth (DOB)
 * @param dob - Date of birth in ISO format (YYYY-MM-DD) or other parseable format
 * @returns Age in years, or null if DOB is invalid
 */
function calculateAgeFromDOB(dob: string | null | undefined): number | null {
  if (!dob) return null;

  try {
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Adjust age if birthday hasn't occurred this year
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

const hasOwn = <T extends object, K extends PropertyKey>(
  obj: T | null | undefined,
  key: K
): obj is T & Record<K, unknown> =>
  Boolean(obj && Object.prototype.hasOwnProperty.call(obj, key));

const pickEvaluationDoc = (
  evaluations: EnrichablePlayerData['evaluations'] = {}
): EvaluationInput | null => {
  if (!evaluations || typeof evaluations !== 'object') return null;
  if (evaluations.current) return evaluations.current;
  const values = Object.values(evaluations).filter(
    (value): value is EvaluationInput => Boolean(value)
  );
  return values.length > 0 ? values[0] : null;
};

const normalizeShootingProfile = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  if (value.trim() === '—') return '';
  return value;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const normalizeSubRoles = (
  viewSub: EvaluationInput['subRoles'],
  subSub: EvaluationInput['subRoles']
): PlayerSubRoles => ({
  offense:
    toStringArray(subSub?.offense).length > 0
      ? toStringArray(subSub?.offense)
      : toStringArray(viewSub?.offense),
  defense:
    toStringArray(subSub?.defense).length > 0
      ? toStringArray(subSub?.defense)
      : toStringArray(viewSub?.defense),
});

/**
 * Normalize free agent type to canonical format
 * Data may come as "UFA", "RFA", "TWO_WAY", or legacy "2W"
 */
const normalizeFreeAgentType = (
  faType: string | null | undefined
): string | null => {
  if (!faType) return null;
  const normalized = String(faType).toUpperCase().trim();
  // Handle legacy "2W" format
  if (normalized === '2W') return 'TWO_WAY';
  // Valid canonical values
  if (['UFA', 'RFA', 'TWO_WAY', 'SFA', 'NONE'].includes(normalized)) {
    return normalized;
  }
  return faType; // Return as-is if unknown
};

/**
 * Normalize bird rights status from object or string
 * Data may be object { status: "Bird", eligibleFor: [...] } or string
 */
const normalizeBirdRightsStatus = (
  birdRights: BirdRightsInput
): string | null => {
  if (!birdRights) return null;
  // If it's already a string, return it
  if (typeof birdRights === 'string') return birdRights;
  // If it's an object with status field
  if (typeof birdRights === 'object' && birdRights.status) {
    return birdRights.status;
  }
  return null;
};

const parseSeasonStartYear = (value: number | string | null | undefined): number => {
  if (typeof value === 'string' && value.includes('-')) {
    return Number.parseInt(value.split('-')[0], 10);
  }
  return Number.parseInt(String(value), 10);
};

/**
 * Enrich player data with computed/convenience fields
 * This handles the v2 nested schema structure only
 *
 * Expected v2 structure:
 * - bio: { displayName, position, height, weight, age, team, etc. }
 * - contracts: { [contractId]: { salariesByYear, etc. } }
 * - seasons: { [seasonId]: { stats, team, etc. } }
 * - evaluations: { [evalId]: { roles, traits, badges, etc. } }
 */
export function enrichPlayerData<TPlayer extends EnrichablePlayerData>(
  playerData: TPlayer | null | undefined
): EnrichedPlayerData<TPlayer> | null {
  if (!playerData) return null;

  // v2 nested position data (ONLY v2 structure)
  const rawPosition = playerData.bio?.position || null;
  const formattedPosition =
    (rawPosition ? POSITION_MAP[rawPosition] : undefined) || rawPosition || '—';

  // Prioritize denormalized views from main document, fallback to subcollections
  // Contract data: use currentContractView if available
  const salaryMap: Record<string | number, number | null> = {};
  let primaryContractId: string | null = null;
  let primaryContract: EnrichableContract | null = null;

  // Build primaryContract from currentContractView for easier access
  if (playerData.currentContractView?.salaryByYear) {
    // Use denormalized salaryByYear from main document
    const denormalizedSalaries = playerData.currentContractView.salaryByYear;
    Object.keys(denormalizedSalaries).forEach((year) => {
      const salary = denormalizedSalaries[year];
      salaryMap[year] = typeof salary === 'number' ? salary / 1_000_000 : null;
    });

    // Create a primaryContract-like structure from currentContractView
    // Convert salaryByYear object to array format for backward compatibility
    // CRITICAL: Must include option field from contractsView.seasons for Option filter
    let salariesArray: SalaryYearEntry[] = Object.entries(denormalizedSalaries)
      .map(([year, salary]) => ({
        year: Number.parseInt(year, 10),
        salary: typeof salary === 'number' ? salary : null,
        option: null, // Will be populated below from contractsView if available
      }))
      .sort((a, b) => Number(a.year) - Number(b.year));

    // Merge option data from contractsView.seasons (has optionType field)
    if (playerData.contractsView?.seasons) {
      const optionMap: Record<string | number, string> = {};
      playerData.contractsView.seasons.forEach((season) => {
        if (season.optionType && season.season) {
          // Extract start year from season string "2025-26" -> 2025
          const yearNum = parseSeasonStartYear(season.season);
          if (yearNum) {
            optionMap[yearNum] = season.optionType;
          }
        }
      });

      // Merge options into salariesArray
      salariesArray = salariesArray.map((entry) => ({
        ...entry,
        option: optionMap[entry.year ?? ''] || null,
      }));
    }

    primaryContract = {
      salariesByYear: salariesArray,
      freeAgency: {
        freeAgentYear: playerData.currentContractView.freeAgentYear,
        freeAgentType: playerData.currentContractView.freeAgentType,
      },
      contractType: playerData.currentContractView.contractType,
      options: playerData.currentContractView.options || [],
      birdRights: playerData.currentContractView.birdRights,
      yearsRemaining: playerData.currentContractView.yearsRemaining,
      averageAnnualValue: playerData.currentContractView.averageAnnualValue,
      maxType: playerData.currentContractView.maxType,
    };
  } else {
    // Fallback to contracts subcollection
    if (playerData.contracts && Object.keys(playerData.contracts).length > 0) {
      const firstEntry = Object.entries(playerData.contracts).sort(([a], [b]) =>
        a.localeCompare(b)
      )[0];
      if (firstEntry) {
        const [firstId, firstContract] = firstEntry;
        primaryContractId = firstId;
        primaryContract = firstContract || null;
      }
    }

    const annualSalaries = primaryContract?.salariesByYear || [];
    annualSalaries.forEach((s) => {
      const key = s.year || s.season;
      if (!key) return;

      const raw = s.salary;
      if (typeof raw === 'string') {
        const cleaned = raw.replace(/[$,]/g, '').trim();
        if (cleaned.endsWith('M')) {
          const value = Number.parseFloat(cleaned.slice(0, -1));
          salaryMap[key] = Number.isFinite(value) ? value : null;
        } else {
          const value = Number.parseFloat(cleaned);
          salaryMap[key] = Number.isFinite(value) ? value / 1_000_000 : null;
        }
      } else if (typeof raw === 'number') {
        salaryMap[key] = raw / 1_000_000;
      } else {
        salaryMap[key] = null;
      }

      if (Number.isNaN(salaryMap[key])) {
        salaryMap[key] = null;
      }
    });
  }

  // Stats data: use currentSeasonStats if available
  let latestSeasonId: string | null = null;
  let latestSeasonStats: PlayerStats = {};
  let latestSeasonMeta: SeasonMeta = {};

  const latestSeasonEntry =
    playerData.seasons && Object.keys(playerData.seasons).length > 0
      ? Object.entries(playerData.seasons).sort(([a], [b]) =>
          b.localeCompare(a)
        )[0]
      : null;

  if (playerData.currentSeasonStats) {
    // Use denormalized stats from main document while preserving source season metadata when available.
    latestSeasonStats = playerData.currentSeasonStats;
    if (latestSeasonEntry) {
      const [seasonId, seasonData] = latestSeasonEntry;
      latestSeasonId = seasonId;
      latestSeasonMeta = seasonData?.meta || {};
    }
  } else if (latestSeasonEntry) {
    // Fallback to seasons subcollection
    const [seasonId, seasonData] = latestSeasonEntry;
    latestSeasonId = seasonId;
    latestSeasonStats = seasonData?.stats || {};
    latestSeasonMeta = seasonData?.meta || {};
  }

  // Evaluation data: merge currentEvaluationView with evaluations/current (preferred)
  const evaluationView: EvaluationInput = playerData.currentEvaluationView || {};
  const evaluationDoc = pickEvaluationDoc(playerData.evaluations);

  const roles: EvaluationRoles = {
    ...(evaluationView.roles || {}),
    ...(evaluationDoc?.roles || {}),
  };

  const traits: Record<string, number> = {
    ...(evaluationView.traits || {}),
    ...(evaluationDoc?.traits || {}),
  };

  const subRoles = normalizeSubRoles(
    evaluationView.subRoles,
    evaluationDoc?.subRoles
  );

  const shootingProfileRaw = hasOwn(evaluationDoc, 'shootingProfile')
    ? evaluationDoc.shootingProfile
    : evaluationView.shootingProfile;
  const shootingProfile = normalizeShootingProfile(shootingProfileRaw);

  const twoWay = hasOwn(evaluationDoc, 'twoWay')
    ? evaluationDoc.twoWay
    : evaluationView.twoWay;

  const badges = hasOwn(evaluationDoc, 'badges')
    ? Array.isArray(evaluationDoc.badges)
      ? evaluationDoc.badges
      : []
    : Array.isArray(evaluationView.badges)
      ? evaluationView.badges
      : [];

  const overallGrade = hasOwn(evaluationDoc, 'overallGrade')
    ? evaluationDoc.overallGrade
    : evaluationView.overallGrade;

  const blurbs = hasOwn(evaluationDoc, 'blurbs')
    ? normalizeBlurbs(evaluationDoc.blurbs)
    : normalizeBlurbs(evaluationView.blurbs);

  const videoExamples = hasOwn(evaluationDoc, 'videoExamples')
    ? normalizeVideoExamples(evaluationDoc.videoExamples)
    : normalizeVideoExamples(evaluationView.videoExamples);

  const evaluationData: PrimaryEvaluation = {
    ...evaluationView,
    ...(evaluationDoc || {}),
    roles,
    traits,
    subRoles,
    shootingProfile,
    twoWay,
    badges,
    overallGrade,
    blurbs,
    videoExamples,
  };

  // Calculate age from DOB if age is not available
  const age =
    playerData.bio?.age || calculateAgeFromDOB(playerData.bio?.dob) || 0;

  // Build optionByYear map - Phase 2X SSOT hierarchy:
  // 1) PRIMARY: currentContractView.optionsByYear (denormalized in main doc)
  // 2) FALLBACK: Build from primaryContract.salariesByYear (legacy/subcollection)
  // Keys use seasonStartYear convention (e.g., 2025 = 2025-26 season)
  const optionByYear: Record<string | number, string> = {};

  // PRIMARY: Use denormalized optionsByYear from main document
  if (playerData.currentContractView?.optionsByYear) {
    const raw = playerData.currentContractView.optionsByYear;
    // Convert string keys to numbers for consistent access
    Object.keys(raw).forEach((key) => {
      const yearNum = Number.parseInt(key, 10);
      if (yearNum && raw[key]) {
        optionByYear[yearNum] = raw[key];
      }
    });
  }

  // FALLBACK: Build from salariesByYear if optionsByYear is empty
  if (Object.keys(optionByYear).length === 0) {
    const salariesArray = primaryContract?.salariesByYear || [];
    salariesArray.forEach((s) => {
      const key = s.year || s.season;
      if (!key || !s.option) return;
      // Extract year as number - use START year for season strings like "2025-26"
      const yearNum = parseSeasonStartYear(key);
      if (yearNum && s.option) {
        optionByYear[yearNum] = s.option; // "PO", "TO", "ETO"
      }
    });
  }

  // Extract free agency fields from nested paths
  const freeAgentYear =
    playerData.currentContractView?.freeAgentYear ||
    playerData.bio?.display?.freeAgentYear ||
    null;
  const freeAgentType = normalizeFreeAgentType(
    playerData.currentContractView?.freeAgentType ||
      playerData.bio?.display?.freeAgentType
  );
  const birdRightsStatus = normalizeBirdRightsStatus(
    playerData.currentContractView?.birdRights || primaryContract?.birdRights
  );

  return {
    ...playerData,
    // Convenience fields sourced exclusively from v2 structure
    name: playerData.bio?.displayName || '',
    formattedPosition,
    heightInInches: playerData.bio?.height || 0,
    weight: playerData.bio?.weight || 0,
    age,
    team: playerData.bio?.display?.team || null,
    headshotUrl: getHeadshotPath(playerData.bio?.playerId || playerData.id),
    offenseRole: evaluationData.roles?.offense1 || '—',
    defenseRole: evaluationData.roles?.defense1 || '—',
    shootingProfile,
    twoWay:
      typeof evaluationData.twoWay === 'number' &&
      Number.isFinite(evaluationData.twoWay)
        ? evaluationData.twoWay
        : null,
    blurbs,
    videoExamples,
    subRoles,
    traits: evaluationData.traits || {},
    badges,
    overallGrade: evaluationData.overallGrade ?? null,
    // Free agency convenience fields (exposed at top level for filtering)
    freeAgentYear,
    freeAgentType,
    birdRightsStatus,
    optionByYear,
    salaryByYear: salaryMap,
    latestSeasonId,
    latestSeasonStats,
    latestSeasonMeta,
    primaryContractId,
    primaryContract,
    primaryEvaluation: evaluationData,
    // Expose currentContractView for easy access
    currentContractView: playerData.currentContractView,
    currentEvaluationView: playerData.currentEvaluationView,
    currentSeasonStats: playerData.currentSeasonStats,
    PPG: latestSeasonStats.PTS ?? null,
    RPG: latestSeasonStats.REB ?? null,
    APG: latestSeasonStats.AST ?? null,
    ...latestSeasonStats,
  };
}
