/**
 * FILE: src/features/architect/utils/seasonManager.draftResolution.ts
 * PURPOSE: Draft-pick swap and conveyance resolution — extracted from seasonManager.ts (Wave 4 Step 1).
 * OWNERSHIP: Feature: architect
 *
 * Contains the two pure draft-resolution functions and their full normalization/helper chain.
 * The main seasonManager.ts imports and re-exports the two public functions from here.
 */
import { resolvePickSwap } from '@/features/architect/utils/tradeMachine/utils/swapResolution';
import { resolveConveyanceForPick } from '@/features/architect/utils/tradeMachine/utils/conveyanceResolution';
// Wave 41 Step 1: types, private helpers, and toSeasonManagerDraftPick extracted to submodule
export * from './seasonManager.draftResolution.helpers';
import {
  isNonEmptyString,
  toSeasonManagerDraftPick,
  type SeasonManagerDraftPick,
  type SeasonManagerDraftPickIngress,
  type SeasonManagerDraftPickIngressList,
  type SeasonManagerDraftPickIngressSource,
  type DraftPickCarrier,
} from './seasonManager.draftResolution.helpers';

export function getSeasonManagerDraftPicks(
  teamData: SeasonManagerDraftPickIngressSource | DraftPickCarrier
): SeasonManagerDraftPick[] {
  const ingressSource = teamData as SeasonManagerDraftPickIngressSource;
  if (Array.isArray(ingressSource._derivedDraftPicks)) {
    return toSeasonManagerDraftPicks(ingressSource._derivedDraftPicks) || [];
  }

  return toSeasonManagerDraftPicks(teamData.draftPicks) || [];
}

export function hasDraftPickIngressArray(
  teamData: SeasonManagerDraftPickIngressSource
): boolean {
  return (
    Array.isArray(teamData._derivedDraftPicks) ||
    Array.isArray(teamData.draftPicks)
  );
}

export function toDraftPickCarrier(
  teamData: SeasonManagerDraftPickIngressSource | DraftPickCarrier,
  fallbackTeamCode?: string | null
): DraftPickCarrier {
  const teamCode = isNonEmptyString(teamData.teamCode)
    ? teamData.teamCode
    : isNonEmptyString(fallbackTeamCode)
      ? fallbackTeamCode
      : null;

  return {
    teamCode,
    draftPicks: getSeasonManagerDraftPicks(teamData),
  };
}

export function toSeasonManagerDraftPicks(
  draftPicks: SeasonManagerDraftPickIngressList | null | undefined
): SeasonManagerDraftPick[] | null {
  if (!Array.isArray(draftPicks)) {
    return null;
  }

  return draftPicks
    .map(toSeasonManagerDraftPick)
    .filter((pick): pick is SeasonManagerDraftPick => pick !== null);
}

// ============================================================
// Exported draft-resolution functions
// ============================================================

export function resolveDraftPickSwapsForYear(
  team: SeasonManagerDraftPickIngressSource,
  draftYear: number,
  positionsMap: Record<string, number> | null | undefined,
  opts: { nowIso?: string; method?: string } = {}
): DraftPickCarrier {
  const carrier = toDraftPickCarrier(team);
  const draftPicksSource = carrier.draftPicks;

  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return carrier;
  }

  if (draftPicksSource.length === 0) {
    return {
      teamCode: carrier.teamCode,
      draftPicks: [],
    };
  }

  const nowIso = opts.nowIso;
  const method = opts.method ?? 'lottery';

  const updatedPicks = draftPicksSource.map((pick) => {
    if (pick.isSwap !== true) {
      return pick;
    }

    if (pick.round !== 1) {
      return pick;
    }

    if (pick.year !== draftYear) {
      return pick;
    }

    if (pick.resolved === true) {
      return pick;
    }

    if (!pick.swapWithTeamId) {
      return pick;
    }

    const teamA = pick.originalTeam || 'UNK';
    const teamB = pick.swapWithTeamId;

    if (!(teamA in positionsMap) || !(teamB in positionsMap)) {
      return pick;
    }

    try {
      return (
        toSeasonManagerDraftPick(
          resolvePickSwap(pick, positionsMap, {
            nowIso,
            method,
          }) as SeasonManagerDraftPickIngress | null | undefined
        ) || pick
      );
    } catch {
      return pick;
    }
  });

  return {
    teamCode: carrier.teamCode,
    draftPicks: updatedPicks,
  };
}

export function resolveDraftPickConveyanceForYear(
  team: SeasonManagerDraftPickIngressSource,
  draftYear: number,
  positionsMap: Record<string, number> | null | undefined,
  opts: { nowIso?: string; method?: string } = {}
): DraftPickCarrier {
  const carrier = toDraftPickCarrier(team);
  const draftPicksSource = carrier.draftPicks;

  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return carrier;
  }

  if (draftPicksSource.length === 0) {
    return {
      teamCode: carrier.teamCode,
      draftPicks: [],
    };
  }

  const nowIso = opts.nowIso;
  const method = opts.method ?? 'lottery';

  const updatedPicks = draftPicksSource.map((pick) => {
    if (pick.round !== 1) {
      return pick;
    }

    if (pick.year !== draftYear) {
      return pick;
    }

    if (!pick.conveyance || !pick.conveyance.conditions) {
      return pick;
    }

    if (pick.conveyanceResult) {
      return pick;
    }

    try {
      return (
        toSeasonManagerDraftPick(
          resolveConveyanceForPick(pick, positionsMap, {
            draftYear,
            nowIso,
            method,
          }) as SeasonManagerDraftPickIngress | null | undefined
        ) || pick
      );
    } catch {
      return pick;
    }
  });

  return {
    teamCode: carrier.teamCode,
    draftPicks: updatedPicks,
  };
}
