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
import {
  getContractYearSlice,
  isTwoWayContract,
} from '@/features/architect/utils/contractUtils';
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';
import {
  deriveArchitectModePresentation,
  type ArchitectModePresentation,
} from './useArchitectModePresentation';
import {
  deriveArchitectTeamPlanSaveState,
  type ArchitectTeamPlanDraftSource,
  type ArchitectTeamPlanSaveState,
} from './teamPlanSaveState';

type AvailabilityStatus = 'available' | 'loading' | 'unavailable';

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
      /** Standard (non-two-way) contracts in the viewing-season slice; null when only ids are known. */
      standardCount: number | null;
      /** Two-way contracts in the viewing-season slice; null when only ids are known. */
      twoWayCount: number | null;
      source: 'players' | 'roster';
    }
  | {
      status: 'loading' | 'unavailable';
      count: null;
      standardCount: null;
      twoWayCount: null;
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

export type ArchitectWorkspaceExceptionsSummary =
  | {
      status: 'available';
      tpeCount: number;
      /** Remaining dollars per trade exception, where the data provides it. */
      tpeRemainingAmounts: number[];
      hasAvailableMle: boolean;
      hasAvailableBae: boolean;
      hasAvailableRoom: boolean;
      hasAnyActive: boolean;
      worldSeasonBasis: boolean;
    }
  | { status: 'loading' }
  | {
      status: 'unavailable';
      deferralHint: 'see-cap-sheet';
      reason: string;
    };

export interface ArchitectWorkspaceDraftPickView {
  key: string;
  year: number;
  round: 1 | 2;
  /** True when this is the team's own pick (not acquired from another team). */
  isOwn: boolean;
  /** Chip text in GM language: "Own" or "via BOS". */
  sourceLabel: string;
  /** Protection text as recorded on the pick (e.g. "Top-10"), null when none. */
  protectionLabel: string | null;
  isSwap: boolean;
}

export interface ArchitectWorkspaceDraftYearGroup {
  year: number;
  firstRound: ArchitectWorkspaceDraftPickView[];
  secondRound: ArchitectWorkspaceDraftPickView[];
}

export type ArchitectWorkspaceDraftAssetsSummary =
  | {
      status: 'available';
      years: ArchitectWorkspaceDraftYearGroup[];
      firstRoundCount: number;
      secondRoundCount: number;
      /** Own picks now owed to other teams ("to MIL"). Not counted above. */
      outgoing: ArchitectWorkspaceDraftPickView[];
    }
  | { status: 'loading' }
  | {
      status: 'unavailable';
      deferralHint: 'see-trade-history';
      reason: string;
    };

export type ArchitectWorkspaceActivityIndicator = {
  status: 'deferred';
  entryPoint: 'history-tab';
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
  saveState: ArchitectTeamPlanSaveState;
  roster: ArchitectWorkspaceRosterSummary;
  cap: ArchitectWorkspaceCapSummary;
  exceptions: ArchitectWorkspaceExceptionsSummary;
  draftAssets: ArchitectWorkspaceDraftAssetsSummary;
  recentActivity: ArchitectWorkspaceActivityIndicator;
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
  lastSavedAt?: string | null;
  lastSaveError?: string | null;
  hasStagedTradeDraft?: boolean;
  draftSources?: ArchitectTeamPlanDraftSource[];
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
  // Never print a raw world id as the plan name (BZE-209 rule). When no
  // user-given name exists, fall back to a friendly default label.
  return {
    status: worldMetadataLoading ? 'loading' : 'available',
    id: worldId,
    label: providedLabel || 'Saved Team Plan',
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
  isLoading: boolean,
  currentYear: number | null | undefined
): ArchitectWorkspaceRosterSummary {
  if (isLoading && !teamCapSheet) {
    return { status: 'loading', count: null, standardCount: null, twoWayCount: null, source: null };
  }

  if (Array.isArray(teamCapSheet?.players)) {
    const selectedYear =
      typeof currentYear === 'number' && Number.isFinite(currentYear)
        ? currentYear
        : null;
    const seasonPlayers =
      selectedYear === null
        ? teamCapSheet.players
        : teamCapSheet.players.filter((player) =>
            getContractYearSlice(player, selectedYear)
          );
    const twoWayCount = seasonPlayers.filter((player) =>
      isTwoWayContract(player)
    ).length;
    return {
      status: 'available',
      count: seasonPlayers.length,
      standardCount: seasonPlayers.length - twoWayCount,
      twoWayCount,
      source: 'players',
    };
  }

  if (Array.isArray(teamCapSheet?.roster)) {
    return {
      status: 'available',
      count: teamCapSheet.roster.length,
      standardCount: null,
      twoWayCount: null,
      source: 'roster',
    };
  }

  return { status: 'unavailable', count: null, standardCount: null, twoWayCount: null, source: null };
}

function deriveCapSummary({
  teamCapSheet,
  currentYear,
  worldAsOfDate,
  isLoading,
}: Pick<
  ArchitectWorkspaceContextInput,
  'teamCapSheet' | 'currentYear' | 'worldAsOfDate' | 'isLoading'
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
    const totals = computeTeamCapTotals(teamCapSheet, currentYear, {
      asOfDate: worldAsOfDate,
    });
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

function deriveExceptionsSummary(
  teamCapSheet: CapSheet | null | undefined,
  isLoading: boolean,
  worldId: string | null | undefined
): ArchitectWorkspaceExceptionsSummary {
  if (isLoading && !teamCapSheet) {
    return { status: 'loading' };
  }

  if (!teamCapSheet) {
    return {
      status: 'unavailable',
      deferralHint: 'see-cap-sheet',
      reason: 'Team cap sheet is not available.',
    };
  }

  const exc = teamCapSheet.exceptions;
  if (!exc) {
    return {
      status: 'unavailable',
      deferralHint: 'see-cap-sheet',
      reason: 'No exception data on cap sheet. Full details in Cap Sheet.',
    };
  }

  const tpeEntries = Array.isArray(exc.tpe) ? exc.tpe : [];
  const tpeCount = tpeEntries.length;
  const tpeRemainingAmounts = tpeEntries
    .map((entry) =>
      typeof entry?.remainingAmount === 'number' &&
      Number.isFinite(entry.remainingAmount)
        ? entry.remainingAmount
        : null
    )
    .filter((amount): amount is number => amount !== null);
  const hasAvailableMle = exc.mle?.available === true;
  const hasAvailableBae = exc.bae?.available === true;
  const hasAvailableRoom = exc.room?.available === true;

  return {
    status: 'available',
    tpeCount,
    tpeRemainingAmounts,
    hasAvailableMle,
    hasAvailableBae,
    hasAvailableRoom,
    hasAnyActive: tpeCount > 0 || hasAvailableMle || hasAvailableBae || hasAvailableRoom,
    worldSeasonBasis: Boolean(worldId),
  };
}

type CapSheetDraftPick = NonNullable<CapSheet['draftPicks']>[number];

function toDraftPickView(
  pick: CapSheetDraftPick,
  teamId: string | null,
  index: number
): {
  view: ArchitectWorkspaceDraftPickView;
  disposition: 'held' | 'outgoing';
} | null {
  if (!pick || typeof pick.year !== 'number' || !Number.isFinite(pick.year)) {
    return null;
  }
  const round = Number(pick.round);
  if (round !== 1 && round !== 2) return null;

  const holder = firstUsableString(pick.currentOwner, pick.owner);
  const origin = firstUsableString(pick.originalTeam, pick.via);
  // Held = the team owns it now; outgoing = the team's own pick owed elsewhere.
  const isOutgoing = Boolean(teamId && holder && holder !== teamId);
  // A pick neither held by nor originally this team's is not part of its
  // asset picture.
  if (isOutgoing && origin !== teamId) return null;

  const isOwn = !isOutgoing && (!origin || !teamId || origin === teamId);
  const protectionLabel = firstUsableString(pick.protection);

  return {
    disposition: isOutgoing ? 'outgoing' : 'held',
    view: {
      key: firstUsableString(pick.id) || `${pick.year}-r${round}-${index}`,
      year: pick.year,
      round,
      isOwn,
      sourceLabel: isOutgoing
        ? `to ${holder}`
        : isOwn
          ? 'Own'
          : `via ${origin}`,
      protectionLabel,
      isSwap: pick.isSwap === true,
    },
  };
}

function deriveDraftAssetsSummary(
  teamCapSheet: CapSheet | null | undefined,
  isLoading: boolean,
  teamId: string | null,
  currentYear: number | null | undefined
): ArchitectWorkspaceDraftAssetsSummary {
  if (isLoading && !teamCapSheet) {
    return { status: 'loading' };
  }

  const picks = teamCapSheet?.draftPicks;
  if (!teamCapSheet || !Array.isArray(picks)) {
    return {
      status: 'unavailable',
      deferralHint: 'see-trade-history',
      reason: 'Draft picks are not available for this team yet.',
    };
  }

  const minYear =
    typeof currentYear === 'number' && Number.isFinite(currentYear)
      ? currentYear
      : null;

  const grouped = new Map<number, ArchitectWorkspaceDraftYearGroup>();
  const outgoing: ArchitectWorkspaceDraftPickView[] = [];
  let firstRoundCount = 0;
  let secondRoundCount = 0;

  picks.forEach((pick, index) => {
    const classified = toDraftPickView(pick, teamId, index);
    if (!classified) return;
    const { view, disposition } = classified;
    if (minYear !== null && view.year < minYear) return;

    if (disposition === 'outgoing') {
      outgoing.push(view);
      return;
    }

    const group = grouped.get(view.year) ?? {
      year: view.year,
      firstRound: [],
      secondRound: [],
    };
    if (view.round === 1) {
      group.firstRound.push(view);
      firstRoundCount += 1;
    } else {
      group.secondRound.push(view);
      secondRoundCount += 1;
    }
    grouped.set(view.year, group);
  });

  const sortBySource = (
    a: ArchitectWorkspaceDraftPickView,
    b: ArchitectWorkspaceDraftPickView
  ) => Number(b.isOwn) - Number(a.isOwn);

  return {
    status: 'available',
    years: Array.from(grouped.values())
      .sort((a, b) => a.year - b.year)
      .map((group) => ({
        ...group,
        firstRound: [...group.firstRound].sort(sortBySource),
        secondRound: [...group.secondRound].sort(sortBySource),
      })),
    firstRoundCount,
    secondRoundCount,
    outgoing: outgoing.sort(
      (a, b) => a.year - b.year || a.round - b.round
    ),
  };
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
  lastSavedAt = null,
  lastSaveError = null,
  hasStagedTradeDraft = false,
  draftSources = [],
  worldModeBoundary = null,
}: ArchitectWorkspaceContextInput): ArchitectWorkspaceContext {
  const normalizedError = error?.trim() || null;
  const saveState = deriveArchitectTeamPlanSaveState({
    worldId,
    isLoading,
    worldMetadataLoading,
    isSaving,
    lastSavedAt,
    lastSaveError,
    hasStagedTradeDraft,
    draftSources,
  });

  const team = deriveTeamContext({ teamCapSheet, teamId, isLoading });

  return {
    team,
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
    saveState,
    roster: deriveRosterSummary(teamCapSheet, isLoading, currentYear),
    cap: deriveCapSummary({
      teamCapSheet,
      currentYear,
      worldAsOfDate,
      isLoading,
    }),
    exceptions: deriveExceptionsSummary(teamCapSheet, isLoading, worldId),
    draftAssets: deriveDraftAssetsSummary(
      teamCapSheet,
      isLoading,
      team.status === 'available' ? team.id : null,
      currentYear
    ),
    recentActivity: {
      status: 'deferred',
      entryPoint: 'history-tab',
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
      input.lastSavedAt,
      input.lastSaveError,
      input.hasStagedTradeDraft,
      input.draftSources,
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
