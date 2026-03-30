/**
 * FILE: src/features/architect/utils/worldTeamData.ts
 * PURPOSE: World-aware team data loading utilities for Architect feature
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2025-12-20: Created for Phase 2B - wire world-aware data loading
 *
 * LINKS:
 *  - teamLoader API: src/features/architect/utils/teamLoader.js
 *  - Gap Analysis: docs/ARCHITECT_GAP_ANALYSIS.md
 *
 * This module provides world-aware team data loading using the teamLoader fallback chain:
 * 1. World snapshot (if worldId provided)
 * 2. Parent world snapshot (recursive)
 * 3. Base team (architect_baseTeams)
 */

import { getTeam } from '@/features/architect/utils/teamLoader';
import { synchronizeTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  loadTeamCapSheet,
  type HydratedBaseTeamCapSheet,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { normalizeTeamExceptionOwnership } from '@/features/architect/utils/exceptions/exceptionOwnership';
import { normalizeTeamTpeSchema } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import { TeamSlugToCode, TeamCodeMap } from '@/constants/teamList';
import type { TeamTotals } from '@/features/architect/types';
import { toEndYear } from '@/features/architect/utils/seasonFormat';

// ==== Type Definitions ====

/** Explicit hydrated team shape returned to dashboard consumers. */
export type LoadedWorldTeamCapSheet = Pick<
  Partial<HydratedBaseTeamCapSheet>,
  | 'id'
  | 'teamCode'
  | 'teamName'
  | 'season'
  | 'abbreviation'
  | 'activeContracts'
  | 'draftAssets'
  | 'entitlementIds'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
  | 'hardCapped'
  | 'baseline'
> & {
  players?: unknown[] | null;
  roster?: unknown[] | null;
  capHolds?: unknown[] | null;
  deadCap?: unknown[] | null;
  draftPicks?: unknown[] | null;
  draftPicksInventory?: unknown[] | null;
  draftPicksObligations?: unknown[] | null;
  draftPicksContested?: unknown[] | null;
  offerSheets?: unknown[] | null;
  incomingOfferSheets?: unknown[] | null;
  exceptions?: HydratedBaseTeamCapSheet['exceptions'] | null;
  totals?: TeamTotals | null;
};

/**
 * Resolve a team ID to a team code
 *
 * Team IDs can be slugs (e.g., "lakers"), codes (e.g., "LAL"), or already valid codes.
 *
 * @param teamId - Team ID/slug/code to resolve
 * @returns Team code (e.g., "LAL") or null if not found
 */
export function resolveTeamCode(teamId: string | null | undefined): string | null {
  if (!teamId) return null;
  // Check if it's a slug that maps to a code
  if (TeamSlugToCode[teamId]) return TeamSlugToCode[teamId];
  // Check if it's already a valid code
  if (TeamCodeMap[teamId]) return teamId;
  // Try uppercase
  const upper = teamId.toUpperCase();
  if (TeamCodeMap[upper]) return upper;
  return null;
}

function deriveLoadedTeamTotalsYear(
  teamData: LoadedWorldTeamCapSheet | null | undefined
): number | null {
  const seasonYear =
    typeof teamData?.season === 'string' ? toEndYear(teamData.season) : null;
  if (typeof seasonYear === 'number' && Number.isFinite(seasonYear)) {
    return seasonYear;
  }

  const yearKey = Number(teamData?.totals?.yearKey);
  return Number.isFinite(yearKey) ? yearKey : null;
}

function normalizeLoadedTeamExceptionOwners(
  teamData: LoadedWorldTeamCapSheet | null
): LoadedWorldTeamCapSheet | null {
  if (!teamData) {
    return teamData;
  }

  return normalizeTeamExceptionOwnership(
    normalizeTeamTpeSchema(teamData)
  ) as LoadedWorldTeamCapSheet;
}

function synchronizeLoadedTeamTotals(
  teamData: LoadedWorldTeamCapSheet | null
): LoadedWorldTeamCapSheet | null {
  if (!teamData) {
    return teamData;
  }

  const normalizedTeamData = normalizeLoadedTeamExceptionOwners(teamData);
  const year = deriveLoadedTeamTotalsYear(normalizedTeamData);
  return normalizeLoadedTeamExceptionOwners(
    synchronizeTeamTotalsSnapshot(
      normalizedTeamData,
      year
    ) as LoadedWorldTeamCapSheet | null
  );
}

/**
 * Load team data with world awareness
 *
 * Uses teamLoader for world-aware reads with fallback chain:
 * - world snapshot → parent world → base team
 *
 * Falls back to loadTeamCapSheet when worldId is null (base-only mode).
 *
 * @param worldId - World ID for world-aware reads (null for base-only)
 * @param teamId - Team ID/slug (e.g., "lakers" or "LAL")
 * @returns Promise resolving to team cap sheet data
 */
export async function loadWorldTeamData(
  worldId: string | null,
  teamId: string
): Promise<LoadedWorldTeamCapSheet | null> {
  const teamCode = resolveTeamCode(teamId);
  if (!teamCode) {
    console.warn('Unable to resolve team code for:', teamId);
    return null;
  }

  try {
    // If no worldId, use base-only loading (same as before)
    if (!worldId) {
      return synchronizeLoadedTeamTotals(await loadTeamCapSheet(teamId));
    }

    // World-aware loading via teamLoader
    // teamLoader.getTeam handles the fallback chain:
    // world snapshot → parent world → base team
    const teamData = await getTeam(worldId, teamCode);
    return synchronizeLoadedTeamTotals(teamData as LoadedWorldTeamCapSheet);
  } catch (error) {
    console.error('Error loading world team data:', error);
    return null;
  }
}
