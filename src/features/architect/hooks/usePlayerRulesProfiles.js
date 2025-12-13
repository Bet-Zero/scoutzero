/**
 * FILE: src/features/architect/hooks/usePlayerRulesProfiles.js
 * PURPOSE: Compute and memoize PlayerRulesProfile objects for Architect players using shared league/team context.
 * OWNERSHIP: Feature: architect/contracts + cap flows
 *
 * HISTORY:
 *  - 2025-12-10: Added rules profile hook for cap sheet integration (chunk_01).
 *  - 2025-12-10: Added multi-year evaluation support for cap table/FA flows (chunk_02).
 *
 * LINKS:
 *  - Plan: plans/_archive/player-rules-architect/plan.md
 *  - Latest Chunk: plans/_archive/player-rules-architect/chunks/chunk_02.md
 */

import { useMemo } from 'react';
import { computePlayerRulesProfile } from '@/features/architect/utils/salaryEngine';
import capProjections from '@/features/architect/utils/capProjections';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';

const DEFAULT_SIM_MONTH = 6; // July (0-indexed)
const DEFAULT_SIM_DAY = 15;

const isTwoWayContract = (player) => {
  const contractType =
    player?.contractType || player?.contract?.contractType || '';
  return contractType.toLowerCase() === 'two-way' || contractType === 'TWO-WAY';
};

const buildCapSettingsForYear = (year) => {
  const seasonKey = toSeasonCode(year);
  const capRow = capProjections[seasonKey] || {};

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

const deriveApronStatus = (teamSalary, capSettings = {}) => {
  if (!teamSalary || !capSettings) return null;
  if (capSettings.secondApron && teamSalary > capSettings.secondApron) {
    return 'ABOVE_SECOND_APRON';
  }
  if (capSettings.firstApron && teamSalary > capSettings.firstApron) {
    return 'ABOVE_FIRST_APRON';
  }
  if (capSettings.salaryCap && teamSalary > capSettings.salaryCap) {
    return 'OVER_CAP';
  }
  return 'UNDER_CAP';
};

const calculateTeamSalary = (players = [], year) => {
  return players.reduce((sum, player) => {
    if (isTwoWayContract(player)) return sum;
    const slice = getContractYearSlice(player, year);
    return sum + (slice?.capHit ?? slice?.salary ?? 0);
  }, 0);
};

const buildLeagueContext = (year, simulationDate, leaguePhase, capSettings) => {
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

const buildTeamContext = (teamCapSheet, year, capSettings, teamCode) => {
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

export function usePlayerRulesProfiles({
  players = [],
  teamCapSheet = null,
  currentYear = null,
  teamCode = null,
  simulationDate = null,
  leaguePhase = 'regular',
  evaluationYears = null,
} = {}) {
  return useMemo(() => {
    const targetYears = (
      evaluationYears && evaluationYears.length
        ? evaluationYears
        : currentYear
          ? [currentYear]
          : []
    ).filter(Boolean);

    if (targetYears.length === 0) {
      return {
        profilesById: new Map(),
        leagueContext: null,
        teamContext: null,
        leagueContextByYear: new Map(),
        teamContextByYear: new Map(),
        profilesByYear: new Map(),
        getProfile: () => null,
        getProfileForYear: () => null,
      };
    }

    const leagueContextByYear = new Map();
    const teamContextByYear = new Map();
    const profilesByYear = new Map();

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

      const profilesById = new Map();

      (players || []).forEach((player) => {
        const id =
          player?.playerId ||
          player?.player_id ||
          player?.id ||
          player?.name ||
          player?.bio?.playerId;
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

    const defaultYear = targetYears.includes(currentYear)
      ? currentYear
      : targetYears[0];
    const defaultProfiles = profilesByYear.get(defaultYear) || new Map();
    const getProfileForYear = (player, year = defaultYear) => {
      const map = profilesByYear.get(year) || defaultProfiles;
      if (!player || !map) return null;
      const key =
        player.playerId ||
        player.player_id ||
        player.id ||
        player.name ||
        player.bio?.playerId;
      return map.get(key) || null;
    };

    const getProfile = (player, yearOverride = null) =>
      getProfileForYear(player, yearOverride || defaultYear);

    return {
      profilesById: defaultProfiles,
      profilesByYear,
      leagueContext: leagueContextByYear.get(defaultYear) || null,
      leagueContextByYear,
      teamContext: teamContextByYear.get(defaultYear) || null,
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
