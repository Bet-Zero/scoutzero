/**
 * FILE: src/features/architect/utils/tradeManager.ts
 * PURPOSE: Computes read-only roster transaction helpers for signings, waivers, and extensions without persisting to Firestore.
 * OWNERSHIP: Feature: architect/utils
 *
 * HISTORY:
 *  - 2025-11-27: Created (Bet_Zero)
 *  - 2025-12-13: Removed client-side Firestore write operations; module is now read-only (Copilot)
 *  - 2026-02-01: Phase 78 - Removed deprecated updateTeamCapTotals(); all totals now use SSOT computeTeamCapTotals() from capTotals
 *
 * LINKS:
 *  - Plan: N/A (not created via plan)
 *  - Latest Chunk: N/A
 *  - Related: src/features/architect/utils/mutationPipeline (authoritative trade execution)
 */

import { getTeam, getPlayer } from '@/features/architect/utils/teamLoader';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import {
  allocateStandardWaiverDeadCapBySeason,
  countRemainingContractSeasons,
  getStretchProvisionYears,
  sumWaiverDeadCapAllocations,
} from '@/features/architect/utils/waiverDeadCapAllocation';

type UnknownRecord = Record<string, unknown>;

type RosterItem =
  | string
  | ({
      player_id?: string;
      playerId?: string;
      id?: string;
    } & UnknownRecord);

interface TeamSourceLike extends UnknownRecord {
  scrapedAt?: string;
  version?: string;
}

interface ExceptionEntryLike extends UnknownRecord {
  usedAmount?: number;
  remainingAmount?: number;
  type?: string;
}

interface TeamExceptionsLike extends UnknownRecord {
  mle?: ExceptionEntryLike;
  bae?: ExceptionEntryLike;
}

interface DeadCapEntryLike extends UnknownRecord {
  playerId?: string;
}

interface CapHoldLike extends UnknownRecord {
  playerId?: string;
}

interface TeamStateLike extends UnknownRecord {
  roster: RosterItem[];
  source?: TeamSourceLike;
  season?: string;
  hardCapped?: boolean;
  hardCapFirstApron?: UnknownRecord;
  exceptions?: TeamExceptionsLike;
  capHolds?: CapHoldLike[];
  deadCap?: DeadCapEntryLike[];
  totals?: UnknownRecord;
}

interface ContractLike extends UnknownRecord {
  guaranteedValue?: number;
  salariesByYear?: Array<{
    season?: string | number | null;
    year?: string | number | null;
    salary?: string | number | null;
    guaranteed?: boolean | null;
    guaranteedAmount?: string | number | null;
  }>;
}

interface PlayerLike extends UnknownRecord {
  displayName?: string;
  contract?: ContractLike | null;
}

interface SigningDataLike extends UnknownRecord {
  playerId?: string;
  contract?: UnknownRecord & {
    totalValue?: number;
  };
  signedUsing?: string;
}

interface WaiveOptionsLike extends UnknownRecord {
  stretch?: boolean;
  stretchYears?: number;
}

/**
 * Client-side note:
 * This module is intentionally READ-ONLY with respect to Firestore.
 * It computes updated team/player snapshots for non-trade helpers and returns
 * them to callers, but does not persist them. Persistence must be handled
 * through the mutation pipeline authority path.
 */

/**
 * Sign free agent to team
 *
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team code
 * @param {Object} signingData - Signing data
 * @param {string} signingData.playerId - Player ID
 * @param {Object} signingData.contract - Contract details
 * @param {string} [signingData.signedUsing] - Exception used (e.g., "MLE", "BAE")
 * @returns {Promise<Object>} Signing result
 */
export async function signFreeAgent(
  worldId: string,
  teamCode: string,
  signingData: SigningDataLike
) {
  if (!worldId || !teamCode || !signingData || !signingData.playerId) {
    throw new Error('worldId, teamCode, and signingData.playerId are required');
  }

  // Load team state
  const teamState = (await getTeam(worldId, teamCode)) as TeamStateLike;

  // Build updated team
  const updatedTeam = { ...teamState };

  // Add player to roster if not already present
  if (!updatedTeam.roster.includes(signingData.playerId)) {
    updatedTeam.roster = [...updatedTeam.roster, signingData.playerId];
  }

  // Update exceptions if used
  if (signingData.signedUsing) {
    const exceptionType = signingData.signedUsing.toLowerCase();
    const contractValue = signingData.contract?.totalValue || 0;

    if (exceptionType === 'mle' && updatedTeam.exceptions?.mle) {
      updatedTeam.exceptions.mle.usedAmount =
        (updatedTeam.exceptions.mle.usedAmount || 0) + contractValue;
      updatedTeam.exceptions.mle.remainingAmount =
        (updatedTeam.exceptions.mle.remainingAmount || 0) - contractValue;

      // Trigger hard cap if using non-taxpayer MLE
      // Note: Must check for 'non-taxpayer' explicitly, not just !includes('taxpayer')
      // because 'non-taxpayer' includes 'taxpayer' as a substring
      if (updatedTeam.exceptions.mle.type === 'non-taxpayer') {
        updatedTeam.hardCapped = true;
        updatedTeam.hardCapFirstApron = {
          active: true,
          reason: 'Triggered by Non-Taxpayer MLE',
          season: updatedTeam.season,
        };
      }
    } else if (exceptionType === 'bae' && updatedTeam.exceptions?.bae) {
      updatedTeam.exceptions.bae.usedAmount =
        (updatedTeam.exceptions.bae.usedAmount || 0) + contractValue;
      updatedTeam.exceptions.bae.remainingAmount =
        (updatedTeam.exceptions.bae.remainingAmount || 0) - contractValue;
    }
  }

  // Remove cap hold if player had one
  if (updatedTeam.capHolds) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter(
      (hold) => hold.playerId !== signingData.playerId
    );
  }

  // Recalculate cap totals using SSOT (Phase 78)
  const yearKey = toEndYear(
    updatedTeam.season || teamState.season || '2025-26'
  ) ?? 2026;
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, yearKey);

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    worldId,
    generatedAt: new Date().toISOString(),
    baseTeamVersion: teamState.source?.scrapedAt || teamState.source?.version,
  };

  return {
    success: true,
    team: updatedTeam,
  };
}

/**
 * Waive player (with optional stretch)
 *
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team code
 * @param {string} playerId - Player ID
 * @param {Object} [options] - Waive options
 * @param {boolean} [options.stretch=false] - Stretch contract over multiple years
 * @param {number} [options.stretchYears=3] - Number of years to stretch
 * @returns {Promise<Object>} Waive result
 */
export async function waivePlayer(
  worldId: string,
  teamCode: string,
  playerId: string,
  options: WaiveOptionsLike = {}
) {
  if (!worldId || !teamCode || !playerId) {
    throw new Error('worldId, teamCode, and playerId are required');
  }

  const { stretch = false, stretchYears: explicitStretchYears } = options;

  // Load team and player states
  const teamState = (await getTeam(worldId, teamCode)) as TeamStateLike;
  const playerData = (await getPlayer(
    worldId,
    teamCode,
    playerId
  )) as PlayerLike | null;

  if (!playerData || !playerData.contract) {
    throw new Error(`Player ${playerId} not found or has no contract`);
  }

  // Build updated team
  const updatedTeam = { ...teamState };

  // Remove player from roster
  updatedTeam.roster = updatedTeam.roster.filter((id) => id !== playerId);

  // Calculate dead cap
  const contract = playerData.contract;
  const currentSeason = teamState.season || '2025-26';
  const standardDeadCapBySeason = allocateStandardWaiverDeadCapBySeason({
    salaryRows: Array.isArray(contract.salariesByYear)
      ? contract.salariesByYear
      : [],
    currentSeason,
  });
  const remainingGuaranteedFromRows = sumWaiverDeadCapAllocations(
    standardDeadCapBySeason
  );
  const remainingSalary =
    remainingGuaranteedFromRows ||
    (Array.isArray(contract.salariesByYear) && contract.salariesByYear.length > 0
      ? 0
      : contract.guaranteedValue || 0);

  // CBA stretch term: (2 x seasons remaining) + 1, derived from the contract.
  // An explicit stretchYears option (if provided) overrides for callers/tests.
  const remainingSeasonCount = countRemainingContractSeasons({
    salaryRows: Array.isArray(contract.salariesByYear)
      ? contract.salariesByYear
      : [],
    currentSeason,
  });
  const stretchYears =
    typeof explicitStretchYears === 'number' && explicitStretchYears > 0
      ? explicitStretchYears
      : getStretchProvisionYears(remainingSeasonCount) || 3;

  if (stretch && remainingSalary > 0) {
    // Stretch over multiple years
    const stretchedAmount = Math.floor(remainingSalary / stretchYears);

    // Add to dead cap array
    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: playerData.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: Array.from({ length: stretchYears }, (_, i) => {
        const seasonYear = parseInt(currentSeason.split('-')[0]) + i;
        const nextYear = seasonYear + 1;
        return {
          season: `${seasonYear}-${String(nextYear).slice(-2)}`,
          amount: stretchedAmount,
          isStretched: true,
        };
      }),
      waiveDate: new Date().toISOString(),
      notes: `Stretched over ${stretchYears} years`,
    });
  } else if (remainingSalary > 0) {
    const amountByYear =
      remainingGuaranteedFromRows > 0
        ? standardDeadCapBySeason
        : [
            {
              season: currentSeason,
              amount: remainingSalary,
              isStretched: false,
            },
          ];

    // Standard waiver dead cap stays on the original guaranteed seasons.
    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: playerData.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear,
      waiveDate: new Date().toISOString(),
    });
  }

  // Recalculate cap totals using SSOT (Phase 78)
  const yearKeyForTotals = toEndYear(
    updatedTeam.season || teamState.season || '2025-26'
  ) ?? 2026;
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, yearKeyForTotals);

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    worldId,
    generatedAt: new Date().toISOString(),
    baseTeamVersion: teamState.source?.scrapedAt || teamState.source?.version,
  };

  return {
    success: true,
    team: updatedTeam,
  };
}

/**
 * Extend player contract
 *
 * @param {string} worldId - World ID
 * @param {string} teamCode - Team code
 * @param {string} playerId - Player ID
 * @param {Object} extension - Extension contract details
 * @returns {Promise<Object>} Extension result
 */
export async function extendPlayer(
  worldId: string,
  teamCode: string,
  playerId: string,
  extension: UnknownRecord
) {
  if (!worldId || !teamCode || !playerId || !extension) {
    throw new Error('worldId, teamCode, playerId, and extension are required');
  }

  // Load team and player states
  const teamState = (await getTeam(worldId, teamCode)) as TeamStateLike;
  const playerData = (await getPlayer(
    worldId,
    teamCode,
    playerId
  )) as PlayerLike | null;

  if (!playerData || !playerData.contract) {
    throw new Error(`Player ${playerId} not found or has no contract`);
  }

  const updatedPlayer = {
    ...playerData,
    contract: {
      ...playerData.contract,
      ...extension,
      isExtension: true,
    },
  };

  // Recalculate team cap totals using SSOT (Phase 78)
  const updatedTeam = { ...teamState };
  const yearKeyForExtend = toEndYear(
    updatedTeam.season || teamState.season || '2025-26'
  ) ?? 2026;
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, yearKeyForExtend);

  return {
    success: true,
    player: updatedPlayer,
    team: updatedTeam,
  };
}
