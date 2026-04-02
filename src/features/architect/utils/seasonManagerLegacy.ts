/**
 * FILE: src/features/architect/utils/seasonManagerLegacy.ts
 * PURPOSE: Isolated legacy season-advance engine retained only for explicit
 *          compatibility consumers. The authoritative world-backed executor
 *          lives in seasonManager.ts.
 * OWNERSHIP: Feature: architect/offseason
 */

import { db } from '@/firebaseConfig';
import {
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { getLeague } from '@/features/architect/utils/teamLoader';
import { getWorldMetadata } from '@/features/architect/utils/worldManager';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  worldTeamRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { getMinimumSalaryScale } from '@/features/architect/utils/salaryEngine';
import {
  normalizeTeamTpeSchema,
} from '@/features/architect/utils/persistenceContracts';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';

type LooseRecord = Record<string, unknown>;

type LegacyDraftPick = {
  year?: number;
  status?: string;
  [key: string]: unknown;
};

type LegacyDraftPickCarrier = {
  draftPicks?: LegacyDraftPick[];
};

const FALLBACK_SEASON_YEAR = new Date().getFullYear();

function resolveSeasonEndYear(
  season: string | null | undefined,
  fallback = FALLBACK_SEASON_YEAR
): number {
  return toEndYear(season) ?? fallback;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getLegacyDraftPicks(
  teamData: LegacyDraftPickCarrier
): LegacyDraftPick[] {
  return Array.isArray(teamData.draftPicks) ? teamData.draftPicks : [];
}

export async function advanceSeasonLegacy(
  worldId: string,
  targetSeason: string | null = null
) {
  if (!worldId) {
    throw new Error('worldId is required');
  }

  const worldMeta = await getWorldMetadata(worldId);
  const currentSeason = worldMeta.currentSeason;

  if (!currentSeason) {
    throw new Error('World metadata missing currentSeason');
  }

  let nextSeason = targetSeason;
  if (!nextSeason) {
    const currentYear = resolveSeasonEndYear(currentSeason);
    const nextYear = currentYear + 1;
    nextSeason = toSeasonCode(nextYear);
  }

  return processSeasonTransitionLegacy(worldId, currentSeason, nextSeason);
}

export async function processSeasonTransitionLegacy(
  worldId: string,
  fromSeason: string,
  toSeason: string
) {
  if (!worldId || !fromSeason || !toSeason) {
    throw new Error('worldId, fromSeason, and toSeason are required');
  }

  const teams = await getLeague(worldId);
  const batch = writeBatch(db);
  const updatedTeams: string[] = [];

  for (const team of teams) {
    const teamCode = team.teamCode;
    if (!isNonEmptyString(teamCode)) {
      throw new Error('Team missing teamCode during season transition');
    }

    const updatedTeam = await processTeamSeasonTransitionLegacy(
      team,
      fromSeason,
      toSeason
    );

    if (updatedTeam) {
      const snapshotRef = worldTeamRef(worldId, teamCode);
      const normalizedTeam = normalizeTeamTpeSchema(updatedTeam);
      batch.set(snapshotRef, normalizedTeam);
      updatedTeams.push(teamCode);
    }
  }

  const metadataRef = worldMetadataRef(worldId);
  batch.update(metadataRef, {
    currentSeason: toSeason,
    lastModifiedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    success: true,
    fromSeason,
    toSeason,
    updatedTeams,
  };
}

async function processTeamSeasonTransitionLegacy(
  teamData: LooseRecord,
  fromSeason: string,
  toSeason: string
) {
  const updatedTeam = { ...teamData };
  let hasChanges = false;

  updatedTeam.season = toSeason;

  const contractResult = processContractExpirationsLegacy(
    updatedTeam,
    fromSeason,
    toSeason
  );
  if (contractResult.hasChanges) {
    hasChanges = true;
    updatedTeam.roster = contractResult.roster;
    updatedTeam.players = contractResult.players;
  }

  const optionsResult = processOptionsLegacy(updatedTeam, fromSeason);
  if (optionsResult.hasChanges) {
    hasChanges = true;
    updatedTeam.roster = optionsResult.roster;
    updatedTeam.players = optionsResult.players;
  }

  const emptyRosterResult = processEmptyRosterChargesLegacy(updatedTeam, toSeason);
  if (emptyRosterResult.hasChanges) {
    hasChanges = true;
    updatedTeam.totals = {
      ...((updatedTeam.totals as LooseRecord) || {}),
      ...emptyRosterResult.totals,
    };
  }

  const capHoldsResult = updateCapHoldsLegacy(updatedTeam, toSeason);
  if (capHoldsResult.hasChanges) {
    hasChanges = true;
    updatedTeam.capHolds = capHoldsResult.capHolds;
  }

  const draftPicksResult = updateDraftPicksLegacy(updatedTeam, fromSeason, toSeason);
  if (draftPicksResult.hasChanges) {
    hasChanges = true;
    updatedTeam.draftPicks = draftPicksResult.draftPicks;
  }

  if (hasChanges) {
    const toYear = resolveSeasonEndYear(toSeason);
    updatedTeam.totals = computeTeamCapTotals(updatedTeam, toYear);
  }

  return hasChanges ? updatedTeam : null;
}

function processContractExpirationsLegacy(
  teamData: LooseRecord,
  fromSeason: string,
  toSeason: string
) {
  void fromSeason;
  const toYear = resolveSeasonEndYear(toSeason);
  const roster = [...((teamData.roster as unknown[]) || [])];
  const players = [...((teamData.players as LooseRecord[]) || [])];
  let hasChanges = false;

  const activeRoster: unknown[] = [];
  const activePlayers: (LooseRecord | undefined)[] = [];

  roster.forEach((playerId, index) => {
    const player =
      players[index] ||
      players.find(
        (candidate) =>
          candidate.player_id === playerId ||
          candidate.id === playerId ||
          candidate.playerId === playerId
      );

    if (!player || !player.contract) {
      activeRoster.push(playerId);
      activePlayers.push(player);
      return;
    }

    const contract = player.contract as LooseRecord;
    const endSeason = contract.endSeason as string | undefined;

    if (endSeason) {
      const endYear = resolveSeasonEndYear(endSeason, toYear);
      if (endYear < toYear) {
        hasChanges = true;
        return;
      }
    }

    if (contract.yearsRemaining !== undefined) {
      const yearsRemaining = Math.max(
        0,
        (contract.yearsRemaining as number) - 1
      );
      if (yearsRemaining !== (contract.yearsRemaining as number)) {
        hasChanges = true;
        contract.yearsRemaining = yearsRemaining;
      }
    }

    const salariesByYear = contract.salariesByYear as LooseRecord[] | undefined;
    if (Array.isArray(salariesByYear)) {
      const activeSalaries = salariesByYear.filter((yearData: LooseRecord) => {
        const year = resolveSeasonEndYear(yearData.season as string, toYear);
        return year >= toYear;
      });

      if (activeSalaries.length !== salariesByYear.length) {
        hasChanges = true;
        contract.salariesByYear = activeSalaries;
      }
    }

    activeRoster.push(playerId);
    activePlayers.push(player);
  });

  return {
    hasChanges,
    roster: activeRoster,
    players: activePlayers,
  };
}

function processOptionsLegacy(teamData: LooseRecord, season: string) {
  const seasonYear = resolveSeasonEndYear(season);
  const roster = [...((teamData.roster as unknown[]) || [])];
  const players = [...((teamData.players as LooseRecord[]) || [])];
  let hasChanges = false;

  players.forEach((player: LooseRecord) => {
    if (!player || !player.contract) return;

    const contract = player.contract as LooseRecord;

    if (Array.isArray(contract.salariesByYear)) {
      contract.salariesByYear.forEach((yearData: LooseRecord) => {
        const year = resolveSeasonEndYear(
          yearData.season as string,
          seasonYear
        );
        if (
          year === seasonYear &&
          yearData.option &&
          yearData.optionUsed == null
        ) {
          hasChanges = true;
          yearData.optionUsed = true;
        }

        if (year === seasonYear && yearData.option && !yearData.optionUsed) {
          hasChanges = true;
          const rosterIndex = roster.indexOf(player.player_id || player.id);
          if (rosterIndex >= 0) {
            roster.splice(rosterIndex, 1);
          }
        }
      });
    }
  });

  return {
    hasChanges,
    roster,
    players,
  };
}

function processEmptyRosterChargesLegacy(
  teamData: LooseRecord,
  season: string
) {
  const rosterCount = (teamData.roster as unknown[] | undefined)?.length || 0;
  const minimumRosterSize = 12;
  const minSalaryScale = getMinimumSalaryScale(season);
  const emptyRosterCharge = minSalaryScale?.[0] || 1_119_563;

  let emptyRosterCharges = 0;
  if (rosterCount < minimumRosterSize) {
    emptyRosterCharges =
      (minimumRosterSize - rosterCount) * emptyRosterCharge;
  }

  const totals = (teamData.totals as LooseRecord) || {};
  const hasChanges = totals.emptyRosterCharges !== emptyRosterCharges;

  return {
    hasChanges,
    totals: {
      ...totals,
      emptyRosterCharges,
      rosterCount,
    },
  };
}

function updateCapHoldsLegacy(teamData: LooseRecord, season: string) {
  const capHolds = [...((teamData.capHolds as LooseRecord[]) || [])];
  let hasChanges = false;

  const activeCapHolds = capHolds.filter((hold) => {
    if (hold.expiresOn) {
      const expireDate = new Date(hold.expiresOn as string);
      const seasonStartDate = new Date(`${season.split('-')[0]}-07-01`);

      if (expireDate < seasonStartDate) {
        hasChanges = true;
        return false;
      }
    }

    if (hold.isSigned) {
      hasChanges = true;
      return false;
    }

    return true;
  });

  return {
    hasChanges,
    capHolds: activeCapHolds,
  };
}

function updateDraftPicksLegacy(
  teamData: LegacyDraftPickCarrier,
  fromSeason: string,
  toSeason: string
) {
  void fromSeason;
  const toYear = resolveSeasonEndYear(toSeason);
  const draftPicks = getLegacyDraftPicks(teamData);
  let hasChanges = false;

  const updatedPicks = draftPicks.map((pick) => {
    const updatedPick = { ...pick };

    if (pick.year && pick.year < toYear) {
      if (pick.status === 'future' || !pick.status) {
        hasChanges = true;
        updatedPick.status = 'available';
      }
    }

    return updatedPick;
  });

  return {
    hasChanges,
    draftPicks: updatedPicks,
  };
}
