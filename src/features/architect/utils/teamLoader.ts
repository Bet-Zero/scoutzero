/**
 * Team Data Loader with Fallback Chain
 *
 * Implements the fallback chain pattern: world snapshot -> parent world -> base
 * This enables efficient storage by only snapshotting modified teams.
 *
 * ARCHITECT READ-STACK LAYER: world-aware fallback-chain authority.
 * - Owns world -> parent world -> base resolution for team/player reads.
 * - Delegates base hydration to firebaseTeamPlanHelpers.ts.
 * - Dashboard consumers should use worldTeamData.ts when they need adapter-friendly team loads.
 *
 * @file src/utils/architect/teamLoader.ts
 * @module teamLoader
 */

import { getDoc, getDocs } from 'firebase/firestore';
import { getWorldMetadata } from '@/features/architect/utils/worldManager';
import { hydrateBaseTeam } from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { normalizeTeamExceptionOwnership } from '@/features/architect/utils/exceptions/exceptionOwnership';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  baseTeamRef,
  basePlayerRef,
  worldTeamRef,
  worldTeamsCol,
  worldPlayerRef,
} from '@/features/architect/utils/architectFirestorePaths';

type UnknownRecord = Record<string, unknown>;

interface WorldMetadataLike extends UnknownRecord {
  parentWorldId?: string | null;
}

interface SalaryByYearEntry extends UnknownRecord {
  season: string;
}

interface ContractLike extends UnknownRecord {
  salariesByYear?: SalaryByYearEntry[];
}

interface PlayerLike extends UnknownRecord {
  displayName?: string;
  playerId?: string;
  player_id?: string;
  teamCode?: string;
  contract?: ContractLike | null;
  bio?: UnknownRecord | null;
}

interface TeamLike extends UnknownRecord {
  entitlementIds?: string[];
  players?: PlayerLike[];
  roster?: unknown[];
  season?: string;
  teamCode?: string;
  teamName?: string;
  totals?: UnknownRecord | null;
}

function deriveTeamTotalsYear(team: TeamLike | null | undefined): number | null {
  const seasonYear =
    typeof team?.season === 'string' ? toEndYear(team.season) : null;
  if (typeof seasonYear === 'number' && Number.isFinite(seasonYear)) {
    return seasonYear;
  }

  const yearKey = Number(team?.totals?.yearKey);
  return Number.isFinite(yearKey) ? yearKey : null;
}

function synchronizeLoadedTeam(team: TeamLike): TeamLike {
  const normalizedTeam = normalizeTeamExceptionOwnership(team) as TeamLike;
  const year = deriveTeamTotalsYear(team);
  return (
    (synchronizeTeamTotalsSnapshot(normalizedTeam, year) as TeamLike) ||
    normalizedTeam
  );
}

/**
 * Get team data with fallback chain
 *
 * Layer 2 of the Architect read stack.
 *
 * Fallback order:
 * 1. World snapshot (if worldId provided)
 * 2. Parent world snapshot (recursive)
 * 3. Base team (architect_baseTeams)
 *
 * @param worldId - World ID (null for base only)
 * @param teamCode - Team code (e.g., "LAL")
 * @returns Team data
 */
export async function getTeam(
  worldId: string | null,
  teamCode: string
): Promise<TeamLike> {
  if (!teamCode) {
    throw new Error('teamCode is required');
  }

  // Base mode: No world selected, return base team directly
  if (!worldId) {
    return await getBaseTeam(teamCode);
  }

  // Try world snapshot first
  // Path: architect_worlds/{worldId}/teams/{teamCode}
  const worldSnapshotRef = worldTeamRef(worldId, teamCode);
  const worldSnapshotSnap = await getDoc(worldSnapshotRef);

  if (worldSnapshotSnap.exists()) {
    const snapshotData = worldSnapshotSnap.data() as TeamLike;
    // Hydrate roster from base players if needed
    return synchronizeLoadedTeam(
      await hydrateTeamFromSnapshot(snapshotData, teamCode)
    );
  }

  // Try parent world (recursive)
  try {
    const worldMeta = (await getWorldMetadata(worldId)) as WorldMetadataLike;
    if (worldMeta.parentWorldId) {
      const parentTeam = await getTeam(worldMeta.parentWorldId, teamCode);
      if (parentTeam) {
        return synchronizeLoadedTeam(parentTeam);
      }
    }
  } catch (error) {
    // If parent lookup fails, continue to base fallback
    console.warn(`Failed to load parent world for ${worldId}:`, error);
  }

  // Fall back to base
  return synchronizeLoadedTeam(await getBaseTeam(teamCode));
}

/**
 * Get base team (no world context)
 *
 * Internal base fallback entry for the world-aware authority. Dashboard callers
 * should prefer loadWorldTeamData(...) unless they explicitly need layer 2.
 *
 * @param teamCode - Team code
 * @returns Base team data
 */
async function getBaseTeam(teamCode: string): Promise<TeamLike> {
  const baseTeamSnap = await getDoc(baseTeamRef(teamCode));

  if (!baseTeamSnap.exists()) {
    throw new Error(`Base team ${teamCode} not found`);
  }

  const baseDoc = baseTeamSnap.data() as TeamLike;
  return synchronizeLoadedTeam(
    (await hydrateBaseTeam(teamCode, baseDoc)) as TeamLike
  );
}

/**
 * Hydrate team from snapshot data
 * Ensures roster is properly hydrated from base players
 *
 * @param snapshotData - Snapshot team data
 * @param teamCode - Team code
 * @returns Hydrated team data
 */
async function hydrateTeamFromSnapshot(
  snapshotData: TeamLike,
  teamCode: string
): Promise<TeamLike> {
  const snapshotPlayers = snapshotData.players;

  // If snapshot already has hydrated roster, return as-is
  if (snapshotPlayers && snapshotPlayers.length && snapshotPlayers.length > 0) {
    return synchronizeLoadedTeam(snapshotData);
  }

  // Otherwise, hydrate from base players
  return synchronizeLoadedTeam(
    (await hydrateBaseTeam(teamCode, snapshotData)) as TeamLike
  );
}

/**
 * Get all 30 teams for league view
 * Optimized: Batch read world snapshots first, then fill gaps from base
 *
 * @param worldId - World ID (null for base only)
 * @returns Array of all 30 teams
 */
export async function getLeague(worldId: string | null): Promise<TeamLike[]> {
  const TEAM_CODES = [
    'ATL',
    'BOS',
    'BKN',
    'CHA',
    'CHI',
    'CLE',
    'DAL',
    'DEN',
    'DET',
    'GSW',
    'HOU',
    'IND',
    'LAC',
    'LAL',
    'MEM',
    'MIA',
    'MIL',
    'MIN',
    'NOP',
    'NYK',
    'OKC',
    'ORL',
    'PHI',
    'PHX',
    'POR',
    'SAC',
    'SAS',
    'TOR',
    'UTA',
    'WAS',
  ];

  // Base mode: Read all from baseTeams
  if (!worldId) {
    return await Promise.all(TEAM_CODES.map((code) => getBaseTeam(code)));
  }

  // World mode: Batch read all world snapshots first
  // Path: architect_worlds/{worldId}/teams
  const snapshotCollectionRef = worldTeamsCol(worldId);
  const snapshotQuery = await getDocs(snapshotCollectionRef);

  const snapshotMap = new Map<string, TeamLike>();
  snapshotQuery.docs.forEach((docSnap) => {
    snapshotMap.set(docSnap.id, docSnap.data() as TeamLike);
  });

  // Get world metadata for parent lookup
  let parentWorldId: string | null = null;
  try {
    const worldMeta = (await getWorldMetadata(worldId)) as WorldMetadataLike;
    parentWorldId = worldMeta.parentWorldId ?? null;
  } catch (error) {
    console.warn(`Failed to load world metadata for ${worldId}:`, error);
  }

  // Load all teams: use snapshot if available, otherwise try parent or base
  const teams = await Promise.all(
    TEAM_CODES.map(async (code) => {
      if (snapshotMap.has(code)) {
        const snapshotData = snapshotMap.get(code) as TeamLike;
        return await hydrateTeamFromSnapshot(snapshotData, code);
      }

      // Try parent world
      if (parentWorldId) {
        try {
          const parentTeam = await getTeam(parentWorldId, code);
          if (parentTeam) {
            return parentTeam;
          }
        } catch {
          // Continue to base fallback
        }
      }

      // Fall back to base
      return await getBaseTeam(code);
    })
  );

  return teams;
}

/**
 * Get player data with overrides
 *
 * Player override path: architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
 *
 * @param worldId - World ID (null for base only)
 * @param teamCode - Team code
 * @param playerId - Player ID
 * @returns Player data (merged with overrides if any)
 */
export async function getPlayer(
  worldId: string | null,
  teamCode: string,
  playerId: string
): Promise<PlayerLike> {
  if (!teamCode || !playerId) {
    throw new Error('teamCode and playerId are required');
  }

  // Get base player
  const basePlayerSnap = await getDoc(basePlayerRef(playerId));
  if (!basePlayerSnap.exists()) {
    throw new Error(`Base player ${playerId} not found`);
  }
  const basePlayer = basePlayerSnap.data() as PlayerLike;

  // Base mode: No world, return base player
  if (!worldId) {
    return basePlayer;
  }

  // Try world-specific player override
  // Path: architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
  const playerOverrideRef = worldPlayerRef(worldId, teamCode, playerId);
  const playerOverrideSnap = await getDoc(playerOverrideRef);

  if (playerOverrideSnap.exists()) {
    const override = playerOverrideSnap.data() as PlayerLike;
    return mergePlayerOverride(basePlayer, override);
  }

  // Try parent world
  try {
    const worldMeta = (await getWorldMetadata(worldId)) as WorldMetadataLike;
    if (worldMeta.parentWorldId) {
      const parentPlayer = await getPlayer(
        worldMeta.parentWorldId,
        teamCode,
        playerId
      );
      if (parentPlayer) {
        return parentPlayer;
      }
    }
  } catch {
    // Continue to base fallback
  }

  // Fall back to base
  return basePlayer;
}

/**
 * Merge player override data with base player
 *
 * @param basePlayer - Base player data
 * @param override - Override data (partial)
 * @returns Merged player data
 */
export function mergePlayerOverride(
  basePlayer: PlayerLike,
  override: PlayerLike | null | undefined
): PlayerLike {
  if (!override) {
    return basePlayer;
  }

  // Deep merge: override takes precedence
  const merged: PlayerLike = { ...basePlayer };

  // Merge contract if override has contract changes
  if (override.contract) {
    merged.contract = {
      ...((basePlayer.contract ?? {}) as ContractLike),
      ...override.contract,
    };

    // Merge salariesByYear array if present
    if (override.contract.salariesByYear) {
      merged.contract.salariesByYear = mergeSalariesByYear(
        basePlayer.contract?.salariesByYear || [],
        override.contract.salariesByYear
      );
    }
  }

  // Merge bio if override has bio changes
  if (override.bio) {
    merged.bio = {
      ...((basePlayer.bio ?? {}) as UnknownRecord),
      ...override.bio,
    };
  }

  // Merge other top-level fields
  Object.keys(override).forEach((key) => {
    if (key !== 'contract' && key !== 'bio') {
      merged[key] = override[key];
    }
  });

  return merged;
}

/**
 * Merge salariesByYear arrays
 * Override entries replace base entries for matching seasons
 *
 * @param baseSalaries - Base salariesByYear array
 * @param overrideSalaries - Override salariesByYear array
 * @returns Merged salariesByYear array
 */
function mergeSalariesByYear(
  baseSalaries: SalaryByYearEntry[],
  overrideSalaries: SalaryByYearEntry[] | undefined
): SalaryByYearEntry[] {
  if (!overrideSalaries || overrideSalaries.length === 0) {
    return baseSalaries;
  }

  const merged = [...baseSalaries];
  overrideSalaries.forEach((override) => {
    const idx = merged.findIndex((s) => s.season === override.season);
    if (idx >= 0) {
      // Replace existing entry
      merged[idx] = { ...merged[idx], ...override };
    } else {
      // Add new entry
      merged.push(override);
    }
  });

  // Sort by season
  return merged.sort((a, b) => {
    const aYear = parseInt(a.season.split('-')[0]);
    const bYear = parseInt(b.season.split('-')[0]);
    return aYear - bYear;
  });
}
