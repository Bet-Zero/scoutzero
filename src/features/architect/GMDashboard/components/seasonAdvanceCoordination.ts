/**
 * FILE: src/features/architect/GMDashboard/components/seasonAdvanceCoordination.ts
 * PURPOSE: Shared, presentation-free coordination for world-backed season
 *          advancement — availability, committed-aftermath application, and the
 *          reload reconciliation plan. Extracted from OffseasonSection (BZE-250)
 *          so the relocated World-menu Season Advance entry and the parked
 *          Offseason room reuse ONE source of this logic instead of duplicating
 *          it.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * ARCHITECT OWNERSHIP:
 * - Pure coordination only: no JSX, no mutation authority. Committed season
 *   advancement stays in SeasonAdvanceModal / worldManager; this module only
 *   shapes the aftermath into dashboard-state updates + a reload request.
 */
import type {
  SeasonAdvanceResult,
  WorldAdvanceAftermath,
} from '@/features/architect/GMDashboard/components/SeasonAdvanceModal';
import type { DraftPositionsCommittedState } from '@/features/architect/GMDashboard/components/DraftPositionsInput';
import type {
  ArchitectDashboardCapSheet,
  ReloadActiveWorldTeamDataOptions,
  ReloadActiveWorldTeamDataResult,
  DashboardOffseasonSummary,
  UseArchitectStateReturn,
} from '@/features/architect/GMDashboard/hooks/useArchitectState';

export type WorldAdvanceReloadRequest = Pick<
  ReloadActiveWorldTeamDataOptions,
  'committedTeamSnapshot' | 'committedWorldMetadata'
>;
export type WorldAdvanceReloadHandler = (
  options?: WorldAdvanceReloadRequest
) => Promise<ReloadActiveWorldTeamDataResult | null>;

export const OFFSEASON_WORLD_ONLY_BADGE = 'World-only';
export const OFFSEASON_WORLD_ADVANCE_DISABLED_REASON =
  'Select a world to unlock season advance.';
export const OFFSEASON_WORLD_ADVANCE_ENABLED_TITLE =
  'Advance the active world to the next season';
export const OFFSEASON_WORLD_ADVANCE_DISABLED_TITLE =
  OFFSEASON_WORLD_ADVANCE_DISABLED_REASON;

export type OffseasonWorldAdvanceAvailability = {
  hasActiveWorld: boolean;
  worldOnlyBadgeLabel: typeof OFFSEASON_WORLD_ONLY_BADGE | null;
  unavailableReason: string | null;
  advanceButtonTitle: string;
};

export type CommittedWorldAdvanceReconciliationPlan = {
  immediateAftermath: WorldAdvanceAftermath;
  followUpReloadRequest: WorldAdvanceReloadRequest;
};

export type ApplyCommittedWorldAdvanceCallbacks = {
  setTeamCapSheet?: UseArchitectStateReturn['setTeamCapSheet'];
  setCurrentYear: (year: number) => void;
  setOffseasonRun: (run: boolean) => void;
  setOffseasonSummary: (summary: DashboardOffseasonSummary | null) => void;
  setShowOffseasonModal: (show: boolean) => void;
};

export function getOffseasonWorldAdvanceAvailability(
  worldId?: string | null
): OffseasonWorldAdvanceAvailability {
  const hasActiveWorld = Boolean(worldId);

  return {
    hasActiveWorld,
    worldOnlyBadgeLabel: hasActiveWorld ? null : OFFSEASON_WORLD_ONLY_BADGE,
    unavailableReason: hasActiveWorld
      ? null
      : OFFSEASON_WORLD_ADVANCE_DISABLED_REASON,
    advanceButtonTitle: hasActiveWorld
      ? OFFSEASON_WORLD_ADVANCE_ENABLED_TITLE
      : OFFSEASON_WORLD_ADVANCE_DISABLED_TITLE,
  };
}

export function getCommittedWorldAdvanceAftermath(
  result: SeasonAdvanceResult
): WorldAdvanceAftermath | null {
  if (!result.success) {
    return null;
  }

  if (!('worldAdvanceAftermath' in result) || !result.worldAdvanceAftermath) {
    return null;
  }

  const { worldAdvanceAftermath } = result;
  if (
    typeof worldAdvanceAftermath.nextWorldSeason !== 'string' ||
    typeof worldAdvanceAftermath.nextViewingYear !== 'number' ||
    !worldAdvanceAftermath.offseasonSummary ||
    typeof worldAdvanceAftermath.offseasonSummary !== 'object' ||
    !('committedTeamCapSheet' in worldAdvanceAftermath)
  ) {
    return null;
  }

  return worldAdvanceAftermath;
}

export function applyCommittedWorldAdvanceAftermath(
  committedWorldAdvanceAftermath: WorldAdvanceAftermath,
  callbacks: ApplyCommittedWorldAdvanceCallbacks
) {
  if (
    callbacks.setTeamCapSheet &&
    committedWorldAdvanceAftermath.committedTeamCapSheet
  ) {
    const committedTeamCapSheet =
      committedWorldAdvanceAftermath.committedTeamCapSheet;

    callbacks.setTeamCapSheet((previousTeamCapSheet) => {
      return {
        ...(previousTeamCapSheet || {}),
        ...committedTeamCapSheet,
        id:
          typeof committedTeamCapSheet.id === 'string'
            ? committedTeamCapSheet.id
            : previousTeamCapSheet?.id ?? null,
        teamCode:
          typeof committedTeamCapSheet.teamCode === 'string'
            ? committedTeamCapSheet.teamCode
            : previousTeamCapSheet?.teamCode ?? null,
      } as ArchitectDashboardCapSheet;
    });
  }

  callbacks.setCurrentYear(committedWorldAdvanceAftermath.nextViewingYear);
  callbacks.setOffseasonRun(true);
  callbacks.setOffseasonSummary(
    committedWorldAdvanceAftermath.offseasonSummary
  );
  callbacks.setShowOffseasonModal(true);
}

export function buildCommittedWorldAdvanceReloadRequest(
  committedWorldAdvanceAftermath: WorldAdvanceAftermath
): WorldAdvanceReloadRequest {
  return {
    committedTeamSnapshot:
      committedWorldAdvanceAftermath.committedTeamCapSheet as ReloadActiveWorldTeamDataOptions['committedTeamSnapshot'],
    committedWorldMetadata: {
      currentSeason: committedWorldAdvanceAftermath.nextWorldSeason,
    },
  };
}

export function buildCommittedWorldAdvanceReconciliationPlan(
  result: SeasonAdvanceResult
): CommittedWorldAdvanceReconciliationPlan | null {
  const committedWorldAdvanceAftermath =
    getCommittedWorldAdvanceAftermath(result);

  if (!committedWorldAdvanceAftermath) {
    return null;
  }

  return {
    immediateAftermath: committedWorldAdvanceAftermath,
    followUpReloadRequest: buildCommittedWorldAdvanceReloadRequest(
      committedWorldAdvanceAftermath
    ),
  };
}

export function normalizeCommittedDraftPositions(
  draftPositions: DraftPositionsCommittedState | null | undefined
) {
  if (!draftPositions?.positionsMap) {
    return null;
  }

  return draftPositions;
}
