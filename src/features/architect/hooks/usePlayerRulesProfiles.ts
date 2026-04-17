/**
 * FILE: src/features/architect/hooks/usePlayerRulesProfiles.ts
 * PURPOSE: Compute and memoize PlayerRulesProfile objects for Architect players using shared league/team context.
 * OWNERSHIP: Feature: architect/contracts + cap flows
 *
 * HISTORY:
 *  - 2025-12-10: Added rules profile hook for cap sheet integration (chunk_01).
 *  - 2025-12-10: Added multi-year evaluation support for cap table/FA flows (chunk_02).
 *  - 2026-03-13: E71 migrated authoritative hook implementation to TypeScript.
 *
 * LINKS:
 *  - Plan: plans/_archive/player-rules-architect/plan.md
 *  - Latest Chunk: plans/_archive/player-rules-architect/chunks/chunk_02.md
 */

import { useMemo } from 'react';
import type {
  PlayerRulesProfile,
  PlayerRulesProfileInput,
  PlayerRulesProfileLeagueContext,
  PlayerRulesProfileTeamCapSheet,
  PlayerRulesProfileTeamContext,
  PlayerRulesProfilesResult,
  UsePlayerRulesProfilesParams,
} from '@/features/architect/types';
import { computePlayerRulesProfile } from '@/features/architect/utils/salaryEngine';
import capProjections from '@/features/architect/utils/capProjections';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import { getTeamApronStatus } from '@/features/architect/utils/capUtils';

type CapSettingsLike = {
  salaryCap?: number | null;
  taxLine?: number | null;
  firstApron?: number | null;
  secondApron?: number | null;
  averageSalary?: number | null;
  fullMLE?: number | null;
  taxpayerMLE?: number | null;
  roomMLE?: number | null;
  bae?: number | null;
};

const DEFAULT_SIM_MONTH = 6; // July (0-indexed)
const DEFAULT_SIM_DAY = 15;

const isTwoWayContract = (player: PlayerRulesProfileInput | null | undefined) => {
  const contractType =
    player?.contractType || player?.contract?.contractType || '';
  return contractType.toLowerCase() === 'two-way' || contractType === 'TWO-WAY';
};

const buildCapSettingsForYear = (year: number): CapSettingsLike => {
  const seasonKey = toSeasonCode(year);
  const capRow = (capProjections[seasonKey] || {}) as {
    cap?: number;
    tax?: number;
    firstApron?: number;
    secondApron?: number;
    averageSalary?: number;
    fullMLE?: number;
    taxpayerMLE?: number;
    roomMLE?: number;
    bae?: number;
  };

  return {
    salaryCap: capRow.cap,
    taxLine: capRow.tax,
    firstApron: capRow.firstApron,
    secondApron: capRow.secondApron,
    averageSalary: capRow.averageSalary,
    fullMLE: capRow.fullMLE,
    taxpayerMLE: capRow.taxpayerMLE,
    roomMLE: capRow.roomMLE,
    bae: capRow.bae,
  };
};

/**
 * Derives apron status by delegating to SSOT.
 * Maps SSOT return values to legacy format for backward compatibility.
 */
const deriveApronStatus = (
  teamSalary: number | null | undefined,
  capSettings: CapSettingsLike = {}
) => {
  if (!teamSalary || !capSettings) return null;

  // Delegate to SSOT for correct boundary semantics
  const status = getTeamApronStatus(teamSalary, capSettings);

  // Map SSOT return values to legacy format
  switch (status) {
    case 'SECOND_APRON':
      return 'ABOVE_SECOND_APRON';
    case 'FIRST_APRON':
      return 'ABOVE_FIRST_APRON';
    case 'OVER_CAP':
      return 'OVER_CAP';
    default:
      return 'UNDER_CAP';
  }
};

const calculateTeamSalary = (
  players: PlayerRulesProfileInput[] = [],
  year: number
) => {
  return players.reduce((sum, player) => {
    if (isTwoWayContract(player)) return sum;
    const slice = getContractYearSlice(player, year);
    return sum + (slice?.capHit ?? slice?.salary ?? 0);
  }, 0);
};

const buildLeagueContext = (
  year: number,
  simulationDate: Date | null | undefined,
  leaguePhase: string | null | undefined,
  capSettings: CapSettingsLike
): PlayerRulesProfileLeagueContext => {
  const simDate =
    simulationDate ||
    new Date(year - 1, DEFAULT_SIM_MONTH, DEFAULT_SIM_DAY, 12, 0, 0);

  return {
    currentYear: year,
    currentSeason: toSeasonCode(year),
    simulationDate: simDate,
    leaguePhase: leaguePhase || 'regular',
    capSettings,
  };
};

const buildTeamContext = (
  teamCapSheet: PlayerRulesProfileTeamCapSheet | null,
  year: number,
  capSettings: CapSettingsLike,
  teamCode: string | null | undefined
): PlayerRulesProfileTeamContext => {
  const players = teamCapSheet?.players || [];
  const teamSalary = calculateTeamSalary(players, year);

  return {
    teamCode: teamCode || teamCapSheet?.teamCode || null,
    teamSalary,
    isOverCap: capSettings?.salaryCap
      ? teamSalary > capSettings.salaryCap
      : false,
    apronStatus: deriveApronStatus(teamSalary, capSettings),
  };
};

const getPlayerKey = (
  player: PlayerRulesProfileInput | null | undefined
): string | null => {
  return (
    player?.playerId ||
    player?.player_id ||
    player?.id ||
    player?.name ||
    player?.bio?.playerId ||
    null
  );
};

export function usePlayerRulesProfiles({
  players = [],
  teamCapSheet = null,
  currentYear = null,
  teamCode = null,
  simulationDate = null,
  leaguePhase = 'regular',
  evaluationYears = null,
}: UsePlayerRulesProfilesParams = {}): PlayerRulesProfilesResult {
  return useMemo(() => {
    const targetYears = (
      evaluationYears && evaluationYears.length
        ? evaluationYears
        : currentYear
          ? [currentYear]
          : []
    ).filter(Boolean) as number[];

    if (targetYears.length === 0) {
      return {
        profilesById: new Map<string, PlayerRulesProfile>(),
        leagueContext: null,
        teamContext: null,
        leagueContextByYear: new Map<number, PlayerRulesProfileLeagueContext>(),
        teamContextByYear: new Map<number, PlayerRulesProfileTeamContext>(),
        profilesByYear: new Map<number, Map<string, PlayerRulesProfile>>(),
        getProfile: () => null,
        getProfileForYear: () => null,
      };
    }

    const leagueContextByYear = new Map<
      number,
      PlayerRulesProfileLeagueContext
    >();
    const teamContextByYear = new Map<number, PlayerRulesProfileTeamContext>();
    const profilesByYear = new Map<number, Map<string, PlayerRulesProfile>>();

    targetYears.forEach((year) => {
      const capSettings = buildCapSettingsForYear(year);
      const leagueContext = buildLeagueContext(
        year,
        simulationDate,
        leaguePhase,
        capSettings
      );
      const teamContext = buildTeamContext(
        teamCapSheet,
        year,
        capSettings,
        teamCode
      );

      leagueContextByYear.set(year, leagueContext);
      teamContextByYear.set(year, teamContext);

      const profilesById = new Map<string, PlayerRulesProfile>();

      (players || []).forEach((player) => {
        const id = getPlayerKey(player);
        if (!id) return;
        const profile = computePlayerRulesProfile(
          player,
          teamContext,
          leagueContext
        );
        profilesById.set(id, profile);
      });

      profilesByYear.set(year, profilesById);
    });

    const defaultYear = targetYears.includes(currentYear as number)
      ? currentYear
      : targetYears[0];
    const defaultProfiles =
      profilesByYear.get(defaultYear as number) ||
      new Map<string, PlayerRulesProfile>();
    const getProfileForYear = (
      player: PlayerRulesProfileInput | null | undefined,
      year = defaultYear as number
    ) => {
      const map = profilesByYear.get(year) || defaultProfiles;
      if (!player || !map) return null;
      const key = getPlayerKey(player);
      return key ? map.get(key) || null : null;
    };

    const getProfile = (
      player: PlayerRulesProfileInput | null | undefined,
      yearOverride: number | null = null
    ) => getProfileForYear(player, yearOverride || (defaultYear as number));

    return {
      profilesById: defaultProfiles,
      profilesByYear,
      leagueContext: leagueContextByYear.get(defaultYear as number) || null,
      leagueContextByYear,
      teamContext: teamContextByYear.get(defaultYear as number) || null,
      teamContextByYear,
      getProfile,
      getProfileForYear,
    };
  }, [
    currentYear,
    leaguePhase,
    players,
    simulationDate,
    teamCapSheet,
    teamCode,
    evaluationYears,
  ]);
}
