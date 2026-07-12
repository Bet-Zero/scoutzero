/**
 * FILE: src/features/architect/GMDashboard/components/SeasonAdvanceModals.tsx
 * PURPOSE: Root-level host for the World-menu Season Advance flow (BZE-250).
 *          Season advance was relocated out of the (now V1-hidden) Offseason
 *          room into the top-bar World menu; the trigger lives in the popover
 *          (SeasonAdvanceMenuSection) while these modals render at the dashboard
 *          root so the popover's outside-click close can't unmount them.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * ARCHITECT OWNERSHIP:
 * - Owns local modal-flow coordination only. Committed season advancement and
 *   draft-position persistence stay in SeasonAdvanceModal / worldManager; this
 *   host applies the authoritative aftermath into dashboard state and requests
 *   the follow-up reload via the shared seasonAdvanceCoordination module.
 */
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  SeasonAdvanceModal,
  type SeasonAdvanceResult,
  type WorldAdvanceAftermath,
} from '@/features/architect/GMDashboard/components/SeasonAdvanceModal';
import {
  DraftPositionsInput,
  type DraftPositionsCommittedState,
  type DraftPositionsPersistenceAuthority,
  type DraftPositionsValidationResult,
} from '@/features/architect/GMDashboard/components/DraftPositionsInput';
import {
  getSeasonAdvanceDraftContext,
  type SeasonAdvanceDraftContext,
} from '@/features/architect/utils/seasonFormat';
import {
  clearDraftPositions,
  getDraftPositions,
  saveDraftPositions,
  validateDraftPositionsMap,
} from '@/features/architect/utils/worldManager';
import {
  applyCommittedWorldAdvanceAftermath,
  buildCommittedWorldAdvanceReconciliationPlan,
  normalizeCommittedDraftPositions,
  type WorldAdvanceReloadHandler,
} from '@/features/architect/GMDashboard/components/seasonAdvanceCoordination';
import type {
  DashboardOffseasonSummary,
  UseArchitectStateReturn,
} from '@/features/architect/GMDashboard/hooks/useArchitectState';
import type { OffseasonTeamCapSheet } from '@/features/architect/offseason/OffseasonTab/types';

export type SeasonAdvanceModalsProps = {
  teamCapSheet: OffseasonTeamCapSheet | null | undefined;
  setTeamCapSheet?: UseArchitectStateReturn['setTeamCapSheet'];
  currentYear: number;
  setCurrentYear: (year: number) => void;
  setOffseasonRun: (run: boolean) => void;
  setOffseasonSummary: (summary: DashboardOffseasonSummary | null) => void;
  setShowOffseasonModal: (show: boolean) => void;
  worldId?: string | null;
  activeWorldIdentityToken?: number;
  teamCode?: string | null;
  worldSeason?: string | null;
  worldSeasonLoading?: boolean;
  onReloadWorldData?: WorldAdvanceReloadHandler | null;
  onAfterOffseasonAdvanceApplied?: (aftermath: WorldAdvanceAftermath) => void;
  /** Advance-season wizard open state (lifted to the dashboard). */
  advanceModalOpen: boolean;
  onAdvanceModalClose: () => void;
  /** Draft-positions editor open state (lifted to the dashboard). */
  draftPositionsModalOpen: boolean;
  onDraftPositionsModalClose: () => void;
};

export const SeasonAdvanceModals = ({
  teamCapSheet,
  setTeamCapSheet,
  currentYear,
  setCurrentYear,
  setOffseasonRun,
  setOffseasonSummary,
  setShowOffseasonModal,
  worldId,
  activeWorldIdentityToken = 0,
  teamCode,
  worldSeason = null,
  onReloadWorldData,
  onAfterOffseasonAdvanceApplied,
  advanceModalOpen,
  onAdvanceModalClose,
  draftPositionsModalOpen,
  onDraftPositionsModalClose,
}: SeasonAdvanceModalsProps) => {
  const [worldAdvanceReloadError, setWorldAdvanceReloadError] = useState<
    string | null
  >(null);
  const latestActiveWorldIdentityTokenRef = useRef(activeWorldIdentityToken);

  useEffect(() => {
    latestActiveWorldIdentityTokenRef.current = activeWorldIdentityToken;
  }, [activeWorldIdentityToken]);

  const handleCommittedWorldAdvanceComplete = useCallback(
    async (result: SeasonAdvanceResult) => {
      const callbackWorldIdentityToken = activeWorldIdentityToken;
      const committedWorldAdvancePlan =
        buildCommittedWorldAdvanceReconciliationPlan(result);

      if (!committedWorldAdvancePlan) {
        return;
      }

      if (
        latestActiveWorldIdentityTokenRef.current !== callbackWorldIdentityToken
      ) {
        return;
      }

      setWorldAdvanceReloadError(null);
      applyCommittedWorldAdvanceAftermath(
        committedWorldAdvancePlan.immediateAftermath,
        {
          setTeamCapSheet,
          setCurrentYear,
          setOffseasonRun,
          setOffseasonSummary,
          setShowOffseasonModal,
        }
      );

      onAfterOffseasonAdvanceApplied?.(
        committedWorldAdvancePlan.immediateAftermath
      );

      // BZE-250: the advance wizard now lives at the dashboard root (not inside
      // the old Offseason room), so it is no longer unmounted by navigating
      // away. Close it explicitly on completion — the Offseason Summary
      // (rendered above it) carries the result — so its backdrop can't block the
      // post-advance room navigation.
      onAdvanceModalClose();

      if (onReloadWorldData) {
        try {
          await onReloadWorldData(
            committedWorldAdvancePlan.followUpReloadRequest
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown world reload failure.';
          console.error(
            'Failed to reload world data after season advance:',
            error
          );
          setWorldAdvanceReloadError(
            `Season advanced, but the world reload could not finish: ${message}`
          );
        }
      }
    },
    [
      activeWorldIdentityToken,
      setTeamCapSheet,
      setCurrentYear,
      setOffseasonRun,
      setOffseasonSummary,
      setShowOffseasonModal,
      onReloadWorldData,
      onAfterOffseasonAdvanceApplied,
      onAdvanceModalClose,
    ]
  );

  const seasonAdvanceDraftContext: SeasonAdvanceDraftContext | null =
    getSeasonAdvanceDraftContext(worldSeason);

  const draftPositionsPersistenceAuthority =
    useMemo<DraftPositionsPersistenceAuthority>(
      () => ({
        async loadCommittedDraftPositions(draftYear) {
          if (!worldId) {
            return null;
          }
          return normalizeCommittedDraftPositions(
            (await getDraftPositions(
              worldId,
              draftYear
            )) as DraftPositionsCommittedState
          );
        },
        async saveCommittedDraftPositions(draftYear, positionsMap) {
          if (!worldId) {
            throw new Error('worldId is required');
          }
          const saveResult = await saveDraftPositions(
            worldId,
            draftYear,
            positionsMap,
            { method: 'manual' }
          );
          if (!saveResult.success) {
            throw new Error(
              saveResult.errors?.join(', ') || 'Failed to save draft positions'
            );
          }
          const committedDraftPositions = normalizeCommittedDraftPositions(
            (await getDraftPositions(
              worldId,
              draftYear
            )) as DraftPositionsCommittedState
          );
          if (!committedDraftPositions) {
            throw new Error(
              `Committed draft positions were unavailable after save for ${draftYear}`
            );
          }
          return committedDraftPositions;
        },
        async clearCommittedDraftPositions(draftYear) {
          if (!worldId) {
            throw new Error('worldId is required');
          }
          const clearResult = await clearDraftPositions(worldId, draftYear);
          if (!clearResult.success) {
            throw new Error(
              clearResult.errors?.join(', ') ||
                'Failed to clear draft positions'
            );
          }
        },
      }),
      [worldId]
    );

  const draftPositionsValidationAuthority = useCallback(
    (positionsMap: Record<string, unknown>) =>
      validateDraftPositionsMap(positionsMap) as DraftPositionsValidationResult,
    []
  );

  return (
    <>
      {worldId && seasonAdvanceDraftContext ? (
        <SeasonAdvanceModal
          isOpen={advanceModalOpen}
          onClose={onAdvanceModalClose}
          teamCapSheet={
            teamCapSheet as WorldAdvanceAftermath['committedTeamCapSheet']
          }
          authoritativeWorldSeason={seasonAdvanceDraftContext.authoritativeSeason}
          worldId={worldId}
          teamCode={teamCode}
          onWorldAdvanceComplete={handleCommittedWorldAdvanceComplete}
        />
      ) : null}

      {draftPositionsModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Draft positions"
          data-testid="season-advance-draft-positions-modal"
        >
          <div
            className="absolute inset-0 bg-black/70"
            onClick={onDraftPositionsModalClose}
            aria-hidden
          />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                Draft Positions
              </h3>
              <button
                type="button"
                onClick={onDraftPositionsModalClose}
                aria-label="Close draft positions"
                className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                data-testid="season-advance-draft-positions-close"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <DraftPositionsInput
                persistenceAuthority={draftPositionsPersistenceAuthority}
                validateDraftPositionsMap={draftPositionsValidationAuthority}
                worldId={worldId ?? null}
                seasonAdvanceDraftContext={seasonAdvanceDraftContext}
              />
            </div>
          </div>
        </div>
      ) : null}

      {worldAdvanceReloadError ? (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded border border-yellow-500/40 bg-yellow-900/90 px-4 py-2 text-xs text-yellow-100 shadow-lg"
          role="status"
          data-testid="season-advance-reload-error"
        >
          {worldAdvanceReloadError}
          <button
            type="button"
            onClick={() => setWorldAdvanceReloadError(null)}
            className="ml-3 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
};
