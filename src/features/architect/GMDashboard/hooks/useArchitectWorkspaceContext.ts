/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext.ts
 * PURPOSE: Read-only Stage 1A workspace context view model for future Architect operating UI.
 * OWNERSHIP: Feature: architect/GMDashboard
 */

import { useMemo } from 'react';
import type {
  ArchitectWorldModeBoundary,
  CapSheet,
} from './useArchitectState';
import {
  computeTeamCapTotals,
  type ComputedTeamCapTotals,
} from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';
import {
  deriveArchitectModePresentation,
  type ArchitectModePresentation,
} from './useArchitectModePresentation';

type AvailabilityStatus = 'available' | 'loading' | 'unavailable';

type WorkspaceSummaryPlaceholder = {
  status: 'unavailable';
  reason: string;
};

export type ArchitectWorkspaceTeamContext =
  | {
      status: 'available';
      id: string;
      label: string;
    }
  | {
      status: 'loading' | 'unavailable';
      id: null;
      label: string;
    };

export type ArchitectWorkspaceWorldContext =
  | {
      status: 'available' | 'loading';
      id: string;
      label: string;
      labelSource: 'provided' | 'world-id-fallback';
    }
  | {
      status: 'sandbox';
      id: null;
      label: 'Sandbox';
      labelSource: 'sandbox';
    };

export interface ArchitectWorkspaceSeasonContext {
  selectedViewingSeason: number | null;
  selectedViewingSeasonLabel: string | null;
  authoritativeWorldSeason: string | null;
  authoritativeWorldSeasonLabel: string | null;
  authoritativeWorldSeasonStatus: AvailabilityStatus;
  viewingSeasonDiffersFromWorldSeason: boolean | null;
}

export interface ArchitectWorkspaceWorldDateContext {
  status: AvailabilityStatus;
  value: string | null;
  label: string;
}

export type ArchitectWorkspaceRosterSummary =
  | {
      status: 'available';
      count: number;
      source: 'players' | 'roster';
    }
  | {
      status: 'loading' | 'unavailable';
      count: null;
      source: null;
    };

export type ArchitectWorkspaceCapSummary =
  | {
      status: 'available';
      season: number;
      seasonLabel: string;
      totalCapAllocations: number;
      salaryCap: number;
      capSpace: number;
      luxuryTax: number;
      taxSpace: number;
      firstApron: number;
      firstApronSpace: number;
      secondApron: number;
      secondApronSpace: number;
      isOverCap: boolean;
      isOverTax: boolean;
      isAtOrAboveFirstApron: boolean;
      isAboveSecondApron: boolean;
      source: ComputedTeamCapTotals['_meta']['source'];
    }
  | {
      status: 'loading' | 'unavailable';
      reason: string;
    };

export interface ArchitectWorkspaceStatusContext {
  isLoading: boolean;
  isSaving: boolean;
  worldMetadataLoading: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

export interface ArchitectWorkspaceContext {
  team: ArchitectWorkspaceTeamContext;
  world: ArchitectWorkspaceWorldContext;
  seasons: ArchitectWorkspaceSeasonContext;
  worldDate: ArchitectWorkspaceWorldDateContext;
  mode: ArchitectModePresentation;
  status: ArchitectWorkspaceStatusContext;
  roster: ArchitectWorkspaceRosterSummary;
  cap: ArchitectWorkspaceCapSummary;
  exceptions: WorkspaceSummaryPlaceholder;
  draftAssets: WorkspaceSummaryPlaceholder;
}

export interface ArchitectWorkspaceContextInput {
  teamCapSheet?: CapSheet | null;
  teamId?: string | null;
  currentYear?: number | null;
  worldId?: string | null;
  activeWorldLabel?: string | null;
  worldAsOfDate?: string | null;
  worldCurrentSeason?: string | null;
  worldMetadataLoading?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  error?: string | null;
  worldModeBoundary?: ArchitectWorldModeBoundary | null;
}

const firstUsableString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
};

const abbreviateWorldId = (worldId: string): string => {
  const clean = worldId.trim();
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 8)}...${clean.slice(-4)}`;
};

const toStableSeasonLabel = (season: string | number | null | undefined) => {
  if (season === null || season === undefined || season === '') return null;
  return toSeasonKey(season);
};

function deriveTeamContext({
  teamCapSheet,
  teamId,
  isLoading,
}: Pick<
  ArchitectWorkspaceContextInput,
  'teamCapSheet' | 'teamId' | 'isLoading'
>): ArchitectWorkspaceTeamContext {
  if (isLoading && !teamCapSheet) {
    return { status: 'loading', id: null, label: 'Loading team' };
  }

  const id = firstUsableString(
    teamCapSheet?.teamCode,
    teamCapSheet?.abbreviation,
    teamCapSheet?.id,
    teamId
  );
  const label = firstUsableString(teamCapSheet?.teamName, id);

  if (!id || !label) {
    return { status: 'unavailable', id: null, label: 'Team unavailable' };
  }

  return { status: 'available', id, label };
}

function deriveWorldContext({
  worldId,
  activeWorldLabel,
  worldMetadataLoading,
}: Pick<
  ArchitectWorkspaceContextInput,
  'worldId' | 'activeWorldLabel' | 'worldMetadataLoading'
>): ArchitectWorkspaceWorldContext {
  if (!worldId) {
    return {
      status: 'sandbox',
      id: null,
      label: 'Sandbox',
      labelSource: 'sandbox',
    };
  }

  const providedLabel = firstUsableString(activeWorldLabel);
  return {
    status: worldMetadataLoading ? 'loading' : 'available',
    id: worldId,
    label: providedLabel || `World ${abbreviateWorldId(worldId)}`,
    labelSource: providedLabel ? 'provided' : 'world-id-fallback',
  };
}

function deriveSeasonContext({
  currentYear,
  worldId,
  worldCurrentSeason,
  worldMetadataLoading,
}: Pick<
  ArchitectWorkspaceContextInput,
  'currentYear' | 'worldId' | 'worldCurrentSeason' | 'worldMetadataLoading'
>): ArchitectWorkspaceSeasonContext {
  const selectedViewingSeason =
    typeof currentYear === 'number' && Number.isFinite(currentYear)
      ? currentYear
      : null;
  const selectedViewingSeasonLabel = toStableSeasonLabel(selectedViewingSeason);
  const authoritativeWorldSeasonLabel = toStableSeasonLabel(worldCurrentSeason);
  const authoritativeWorldSeasonStatus: AvailabilityStatus = !worldId
    ? 'unavailable'
    : worldMetadataLoading
    ? 'loading'
    : authoritativeWorldSeasonLabel
    ? 'available'
    : 'unavailable';

  return {
    selectedViewingSeason,
    selectedViewingSeasonLabel,
    authoritativeWorldSeason: worldCurrentSeason || null,
    authoritativeWorldSeasonLabel,
    authoritativeWorldSeasonStatus,
    viewingSeasonDiffersFromWorldSeason:
      selectedViewingSeasonLabel && authoritativeWorldSeasonLabel
        ? selectedViewingSeasonLabel !== authoritativeWorldSeasonLabel
        : null,
  };
}

function deriveWorldDateContext({
  worldId,
  worldAsOfDate,
  worldMetadataLoading,
}: Pick<
  ArchitectWorkspaceContextInput,
  'worldId' | 'worldAsOfDate' | 'worldMetadataLoading'
>): ArchitectWorkspaceWorldDateContext {
  if (!worldId) {
    return {
      status: 'unavailable',
      value: null,
      label: 'No active world date',
    };
  }

  if (worldMetadataLoading) {
    return {
      status: 'loading',
      value: worldAsOfDate || null,
      label: 'Loading world date',
    };
  }

  if (!worldAsOfDate) {
    return {
      status: 'unavailable',
      value: null,
      label: 'World date unavailable',
    };
  }

  return {
    status: 'available',
    value: worldAsOfDate,
    label: worldAsOfDate,
  };
}

function deriveRosterSummary(
  teamCapSheet: CapSheet | null | undefined,
  isLoading: boolean
): ArchitectWorkspaceRosterSummary {
  if (isLoading && !teamCapSheet) {
    return { status: 'loading', count: null, source: null };
  }

  if (Array.isArray(teamCapSheet?.players)) {
    return {
      status: 'available',
      count: teamCapSheet.players.length,
      source: 'players',
    };
  }

  if (Array.isArray(teamCapSheet?.roster)) {
    return {
      status: 'available',
      count: teamCapSheet.roster.length,
      source: 'roster',
    };
  }

  return { status: 'unavailable', count: null, source: null };
}

function deriveCapSummary({
  teamCapSheet,
  currentYear,
  isLoading,
}: Pick<
  ArchitectWorkspaceContextInput,
  'teamCapSheet' | 'currentYear' | 'isLoading'
>): ArchitectWorkspaceCapSummary {
  if (isLoading && !teamCapSheet) {
    return { status: 'loading', reason: 'Team cap sheet is loading.' };
  }

  if (!teamCapSheet) {
    return {
      status: 'unavailable',
      reason: 'Team cap sheet is not available.',
    };
  }

  if (typeof currentYear !== 'number' || !Number.isFinite(currentYear)) {
    return {
      status: 'unavailable',
      reason: 'Selected viewing season is not available.',
    };
  }

  try {
    const totals = computeTeamCapTotals(teamCapSheet, currentYear);
    const capSpace = -totals.deltas.vsCap;
    const taxSpace = -totals.deltas.vsLuxuryTax;
    const firstApronSpace = -totals.deltas.vsFirstApron;
    const secondApronSpace = -totals.deltas.vsSecondApron;

    return {
      status: 'available',
      season: currentYear,
      seasonLabel: toSeasonKey(currentYear),
      totalCapAllocations: totals.totalCapAllocations,
      salaryCap: totals.salaryCap,
      capSpace,
      luxuryTax: totals.luxuryTax,
      taxSpace,
      firstApron: totals.firstApron,
      firstApronSpace,
      secondApron: totals.secondApron,
      secondApronSpace,
      isOverCap: totals.deltas.vsCap > 0,
      isOverTax: totals.deltas.vsLuxuryTax > 0,
      isAtOrAboveFirstApron: totals.deltas.vsFirstApron >= 0,
      isAboveSecondApron: totals.deltas.vsSecondApron > 0,
      source: totals._meta.source,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      reason:
        error instanceof Error
          ? error.message
          : 'Cap posture could not be derived.',
    };
  }
}

export function deriveArchitectWorkspaceContext({
  teamCapSheet = null,
  teamId = null,
  currentYear = null,
  worldId = null,
  activeWorldLabel = null,
  worldAsOfDate = null,
  worldCurrentSeason = null,
  worldMetadataLoading = false,
  isLoading = false,
  isSaving = false,
  error = null,
  worldModeBoundary = null,
}: ArchitectWorkspaceContextInput): ArchitectWorkspaceContext {
  const normalizedError = error?.trim() || null;

  return {
    team: deriveTeamContext({ teamCapSheet, teamId, isLoading }),
    world: deriveWorldContext({ worldId, activeWorldLabel, worldMetadataLoading }),
    seasons: deriveSeasonContext({
      currentYear,
      worldId,
      worldCurrentSeason,
      worldMetadataLoading,
    }),
    worldDate: deriveWorldDateContext({
      worldId,
      worldAsOfDate,
      worldMetadataLoading,
    }),
    mode: deriveArchitectModePresentation({
      worldId,
      worldModeBoundary,
      isLoading,
      worldMetadataLoading,
      error: normalizedError,
    }),
    status: {
      isLoading,
      isSaving,
      worldMetadataLoading,
      hasError: Boolean(normalizedError),
      errorMessage: normalizedError,
    },
    roster: deriveRosterSummary(teamCapSheet, isLoading),
    cap: deriveCapSummary({ teamCapSheet, currentYear, isLoading }),
    exceptions: {
      status: 'unavailable',
      reason:
        'Exception and TPE posture remains with the current cap-sheet authority until a reliable workspace summary seam is added.',
    },
    draftAssets: {
      status: 'unavailable',
      reason:
        'No canonical active-world draft asset summary is exposed to the workspace context yet.',
    },
  };
}

export function useArchitectWorkspaceContext(
  input: ArchitectWorkspaceContextInput
): ArchitectWorkspaceContext {
  return useMemo(
    () => deriveArchitectWorkspaceContext(input),
    [
      input.activeWorldLabel,
      input.currentYear,
      input.error,
      input.isLoading,
      input.isSaving,
      input.teamCapSheet,
      input.teamId,
      input.worldAsOfDate,
      input.worldCurrentSeason,
      input.worldId,
      input.worldMetadataLoading,
      input.worldModeBoundary,
    ]
  );
}
