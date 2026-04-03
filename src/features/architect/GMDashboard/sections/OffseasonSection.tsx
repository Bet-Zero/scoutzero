/**
 * FILE: src/features/architect/GMDashboard/sections/OffseasonSection.tsx
 * PURPOSE: Wraps the OffseasonTab component for the GM dashboard Offseason view.
 *          Phase 3B: Added world-aware season advancement with SeasonAdvanceModal.
 *          Phase 5: Added DraftPositionsInput for real draft results input.
 *          Phase 5 PATCH: Added worldSeason display + DraftPositionsInput alignment.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created outside plan mode (no chunks); header added per request.
 *  - 2025-12-20: Phase 3B - Added SeasonAdvanceModal integration for world-scoped season advancement.
 *  - 2026-01-07: Phase 5 - Added DraftPositionsInput for entering draft positions.
 *  - 2026-01-07: Phase 5 PATCH - Added worldSeason label + aligned DraftPositionsInput to world season.
 *  - 2026-03-03: OFFSEASON_E1 - DEV-gated single-team offseason preview (non-persisting preview).
 *
 * LINKS:
 *  - Plan: N/A (not created via plan)
 *  - Latest Chunk: N/A
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import SeasonAdvanceModal, {
  type SeasonAdvanceResult,
  type WorldAdvanceAftermath,
} from '@/features/architect/GMDashboard/components/SeasonAdvanceModal';
import DraftPositionsInput, {
  type DraftPositionsCommittedState,
  type DraftPositionsPersistenceAuthority,
  type DraftPositionsValidationResult,
} from '@/features/architect/GMDashboard/components/DraftPositionsInput';
import {
  getSeasonAdvanceDraftContext,
  type SeasonAdvanceDraftContext,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  clearDraftPositions,
  getDraftPositions,
  saveDraftPositions,
  validateDraftPositionsMap,
} from '@/features/architect/utils/worldManager';

// OFFSEASON_E1: DEV-only flag for single-team offseason preview (non-persisting).
// Import kept for DEV preview; rendering is gated by showDevPreview below.
import OffseasonTab from '@/features/architect/offseason/OffseasonTab';
import {
  NON_AUTHORITATIVE_OFFSEASON_PREVIEW_AUTHORITY,
  type OffseasonPreviewAuthority,
} from '@/features/architect/offseason/OffseasonTab/types';

type LooseRecord = Record<string, unknown>;

type OffseasonSectionProps = {
  teamCapSheet: LooseRecord | null | undefined;
  setTeamCapSheet?: (...args: any[]) => any;
  currentYear: number;
  setCurrentYear: (...args: any[]) => any;
  capProjections: Record<string, unknown> | null | undefined;
  setOffseasonRun: (...args: any[]) => any;
  setOffseasonSummary: (...args: any[]) => any;
  setShowOffseasonModal: (...args: any[]) => any;
  playersMap?: Record<string, unknown>;
  worldId?: string | null;
  activeWorldIdentityToken?: number;
  teamCode?: string | null;
  worldSeason?: string | null;
  worldSeasonLoading?: boolean;
  onReloadWorldData?: ((...args: unknown[]) => Promise<unknown>) | null;
};

type WorldBackedOffseasonSurfaceProps = {
  worldId?: string | null;
  worldSeasonLoading: boolean;
  viewingSeason: string;
  hasSeasonMismatch: boolean;
  worldReloadError: string | null;
  seasonAdvanceDraftContext: SeasonAdvanceDraftContext | null;
  canAdvanceSeason: boolean;
  draftPositionsPersistenceAuthority: DraftPositionsPersistenceAuthority;
  validateDraftPositionsMap: (
    positionsMap: Record<string, unknown>
  ) => DraftPositionsValidationResult;
  onOpenAdvanceModal: () => void;
};

type DevPreviewOffseasonSurfaceProps = {
  previewAuthority: OffseasonPreviewAuthority;
  worldId?: string | null;
  teamCapSheet: LooseRecord | null | undefined;
  viewingYear: number;
  capProjections: Record<string, unknown> | null | undefined;
  playersMap?: Record<string, unknown>;
};

type DevPreviewSurfaceAccess =
  | {
      kind: 'hidden';
      isDevEnvironment: boolean;
      hasPreviewIntent: boolean;
      previewAuthority: null;
    }
  | {
      kind: 'preview';
      isDevEnvironment: true;
      hasPreviewIntent: true;
      previewAuthority: OffseasonPreviewAuthority;
    };

function getCommittedWorldAdvanceAftermath(
  result: SeasonAdvanceResult
): WorldAdvanceAftermath | null {
  if (!result.success) {
    return null;
  }

  if (
    !('worldAdvanceAftermath' in result) ||
    !result.worldAdvanceAftermath
  ) {
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

function applyCommittedWorldAdvanceAftermath(
  committedWorldAdvanceAftermath: WorldAdvanceAftermath,
  callbacks: {
    setTeamCapSheet?: (...args: any[]) => any;
    setCurrentYear: (...args: any[]) => any;
    setOffseasonRun: (...args: any[]) => any;
    setOffseasonSummary: (...args: any[]) => any;
    setShowOffseasonModal: (...args: any[]) => any;
  }
) {
  if (
    callbacks.setTeamCapSheet &&
    committedWorldAdvanceAftermath.committedTeamCapSheet
  ) {
    callbacks.setTeamCapSheet(
      committedWorldAdvanceAftermath.committedTeamCapSheet
    );
  }

  callbacks.setCurrentYear(committedWorldAdvanceAftermath.nextViewingYear);
  callbacks.setOffseasonRun(true);
  callbacks.setOffseasonSummary(
    committedWorldAdvanceAftermath.offseasonSummary
  );
  callbacks.setShowOffseasonModal(true);
}

function normalizeCommittedDraftPositions(
  draftPositions: DraftPositionsCommittedState | null | undefined
) {
  if (!draftPositions?.positionsMap) {
    return null;
  }

  return draftPositions;
}

function resolveDevPreviewSurfaceAccess(): DevPreviewSurfaceAccess {
  const isDevEnvironment = Boolean(import.meta.env.DEV);
  const hasPreviewIntent =
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(DEV_OFFSEASON_PREVIEW_FLAG) === 'true';

  if (!isDevEnvironment || !hasPreviewIntent) {
    return {
      kind: 'hidden',
      isDevEnvironment,
      hasPreviewIntent,
      previewAuthority: null,
    };
  }

  return {
    kind: 'preview',
    isDevEnvironment: true,
    hasPreviewIntent: true,
    previewAuthority: NON_AUTHORITATIVE_OFFSEASON_PREVIEW_AUTHORITY,
  };
}

function WorldBackedOffseasonSurface({
  worldId,
  worldSeasonLoading,
  viewingSeason,
  hasSeasonMismatch,
  worldReloadError,
  seasonAdvanceDraftContext,
  canAdvanceSeason,
  draftPositionsPersistenceAuthority,
  validateDraftPositionsMap,
  onOpenAdvanceModal,
}: WorldBackedOffseasonSurfaceProps) {
  const hasActiveWorld = Boolean(worldId);
  const authoritativeWorldSeason =
    seasonAdvanceDraftContext?.authoritativeSeason ?? null;

  return (
    <section data-testid="offseason-world-surface">
      <div className="mb-6 p-4 bg-[#1a1a1a] rounded-lg border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">
                World Season Advancement
              </h3>
              {!hasActiveWorld && (
                <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
                  World-only
                </span>
              )}
            </div>
            <p className="text-sm text-white/60 mt-1">
              Advance the entire world to the next season. This will process all 30 teams,
              expiring contracts, and option decisions.
            </p>
            {!hasActiveWorld && (
              <div className="mt-2 text-xs text-white/45">
                Select a world to unlock season advance.
              </div>
            )}
            {hasActiveWorld && authoritativeWorldSeason && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-medium text-purple-400">
                  World Season: {authoritativeWorldSeason}
                </span>
                {hasSeasonMismatch && (
                  <span className="text-xs text-yellow-400">
                    (Viewing: {viewingSeason})
                  </span>
                )}
              </div>
            )}
            {hasActiveWorld && worldSeasonLoading && (
              <div className="mt-2 text-xs text-white/40">Loading world season...</div>
            )}
            {hasActiveWorld && !worldSeasonLoading && !authoritativeWorldSeason && (
              <div className="mt-2 text-xs text-yellow-300">
                World season unavailable. Season advance stays disabled until metadata loads.
              </div>
            )}
            {worldReloadError && (
              <div className="mt-2 rounded border border-yellow-500/30 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-200">
                {worldReloadError}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenAdvanceModal}
            disabled={!canAdvanceSeason}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/40 disabled:text-white/40 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
            title={
              hasActiveWorld
                ? 'Advance the active world to the next season'
                : 'Select a world to unlock season advance'
            }
          >
            Advance Season
          </button>
        </div>
      </div>

      <div className="mb-6">
        <DraftPositionsInput
          persistenceAuthority={draftPositionsPersistenceAuthority}
          validateDraftPositionsMap={validateDraftPositionsMap}
          worldId={worldId ?? null}
          seasonAdvanceDraftContext={seasonAdvanceDraftContext}
        />
      </div>
    </section>
  );
}

function DevPreviewOffseasonSurface({
  previewAuthority,
  worldId,
  teamCapSheet,
  viewingYear,
  capProjections,
  playersMap,
}: DevPreviewOffseasonSurfaceProps) {
  return (
    <section data-testid="offseason-preview-surface">
      {worldId && (
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#0d0d0d] text-white/40">DEV: single-team offseason preview</span>
          </div>
        </div>
      )}
      <div
        data-testid="offseason-preview-banner"
        className="mb-4 rounded border border-yellow-500/40 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-200"
      >
        Preview only — does not persist. Changes will be lost on refresh.
      </div>
      <OffseasonTab
        teamCapSheet={teamCapSheet as Record<string, unknown>}
        currentYear={viewingYear}
        previewAuthority={previewAuthority}
        capProjections={capProjections}
        playersMap={playersMap}
      />
    </section>
  );
}

export const DEV_OFFSEASON_PREVIEW_FLAG = 'hz.dev.offseasonPreview';

const OffseasonSection = ({
  teamCapSheet,
  setTeamCapSheet,
  currentYear: viewingYear,
  setCurrentYear,
  capProjections,
  setOffseasonRun,
  setOffseasonSummary,
  setShowOffseasonModal,
  playersMap,
  worldId,
  activeWorldIdentityToken = 0,
  teamCode,
  worldSeason = null,
  worldSeasonLoading = false,
  onReloadWorldData,
}: OffseasonSectionProps) => {
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [worldAdvanceReloadError, setWorldAdvanceReloadError] = useState<
    string | null
  >(null);
  const devPreviewSurfaceAccess = resolveDevPreviewSurfaceAccess();
  const latestActiveWorldIdentityTokenRef = useRef(activeWorldIdentityToken);

  useEffect(() => {
    latestActiveWorldIdentityTokenRef.current = activeWorldIdentityToken;
  }, [activeWorldIdentityToken]);

  const handleCommittedWorldAdvanceComplete = useCallback(
    async (result: SeasonAdvanceResult) => {
      const callbackWorldIdentityToken = activeWorldIdentityToken;
      const committedWorldAdvanceAftermath =
        getCommittedWorldAdvanceAftermath(result);

      if (!committedWorldAdvanceAftermath) {
        return;
      }

      if (
        latestActiveWorldIdentityTokenRef.current !== callbackWorldIdentityToken
      ) {
        return;
      }

      setWorldAdvanceReloadError(null);
      applyCommittedWorldAdvanceAftermath(committedWorldAdvanceAftermath, {
        setTeamCapSheet,
        setCurrentYear,
        setOffseasonRun,
        setOffseasonSummary,
        setShowOffseasonModal,
      });

      if (onReloadWorldData) {
        try {
          await onReloadWorldData({
            committedTeamSnapshot:
              committedWorldAdvanceAftermath.committedTeamCapSheet,
            committedWorldMetadata: {
              currentSeason: committedWorldAdvanceAftermath.nextWorldSeason,
            },
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown world reload failure.';
          console.error('Failed to reload world data after season advance:', error);
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
      setWorldAdvanceReloadError,
      onReloadWorldData,
    ]
  );

  const seasonAdvanceDraftContext = getSeasonAdvanceDraftContext(worldSeason);
  const canAdvanceWorldSeason = Boolean(
    worldId && seasonAdvanceDraftContext && !worldSeasonLoading
  );
  const draftPositionsPersistenceAuthority =
    useMemo<DraftPositionsPersistenceAuthority>(() => ({
      async loadCommittedDraftPositions(draftYear) {
        if (!worldId) {
          return null;
        }

        const committedDraftPositions = normalizeCommittedDraftPositions(
          (await getDraftPositions(
            worldId,
            draftYear
          )) as DraftPositionsCommittedState
        );

        return committedDraftPositions;
      },
      async saveCommittedDraftPositions(draftYear, positionsMap) {
        if (!worldId) {
          throw new Error('worldId is required');
        }

        const saveResult = await saveDraftPositions(
          worldId,
          draftYear,
          positionsMap,
          {
            method: 'manual',
          }
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
            clearResult.errors?.join(', ') || 'Failed to clear draft positions'
          );
        }
      },
    }), [worldId]);
  const draftPositionsValidationAuthority = useCallback(
    (positionsMap: Record<string, unknown>) =>
      validateDraftPositionsMap(
        positionsMap
      ) as DraftPositionsValidationResult,
    []
  );

  const viewingSeason = toSeasonCode(viewingYear);

  const hasSeasonMismatch =
    seasonAdvanceDraftContext?.authoritativeSeason &&
    seasonAdvanceDraftContext.authoritativeSeason !== viewingSeason;

  return (
    <div>
      <WorldBackedOffseasonSurface
        worldId={worldId}
        worldSeasonLoading={worldSeasonLoading}
        viewingSeason={viewingSeason}
        hasSeasonMismatch={Boolean(hasSeasonMismatch)}
        worldReloadError={worldAdvanceReloadError}
        seasonAdvanceDraftContext={seasonAdvanceDraftContext}
        canAdvanceSeason={canAdvanceWorldSeason}
        draftPositionsPersistenceAuthority={draftPositionsPersistenceAuthority}
        validateDraftPositionsMap={draftPositionsValidationAuthority}
        onOpenAdvanceModal={() => {
          if (!canAdvanceWorldSeason) {
            return;
          }
          setWorldAdvanceReloadError(null);
          setShowAdvanceModal(true);
        }}
      />

      {devPreviewSurfaceAccess.kind === 'preview' ? (
        <DevPreviewOffseasonSurface
          previewAuthority={devPreviewSurfaceAccess.previewAuthority}
          worldId={worldId}
          teamCapSheet={teamCapSheet}
          viewingYear={viewingYear}
          capProjections={capProjections}
          playersMap={playersMap}
        />
      ) : null}

      {worldId && seasonAdvanceDraftContext ? (
        <SeasonAdvanceModal
          isOpen={showAdvanceModal}
          onClose={() => setShowAdvanceModal(false)}
          teamCapSheet={teamCapSheet}
          authoritativeWorldSeason={
            seasonAdvanceDraftContext.authoritativeSeason
          }
          worldId={worldId}
          teamCode={teamCode}
          onWorldAdvanceComplete={handleCommittedWorldAdvanceComplete}
        />
      ) : null}
    </div>
  );
};

export { OffseasonSection };
