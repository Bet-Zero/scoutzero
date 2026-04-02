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

import React, { useState, useCallback, useEffect } from 'react';
import SeasonAdvanceModal, {
  type SeasonAdvanceResult,
} from '@/features/architect/GMDashboard/components/SeasonAdvanceModal';
import DraftPositionsInput from '@/features/architect/GMDashboard/components/DraftPositionsInput';
import { toEndYear, toSeasonCode } from '@/features/architect/utils/seasonFormat';
import { getWorldMetadata } from '@/features/architect/utils/worldManager';

// OFFSEASON_E1: DEV-only flag for single-team offseason preview (non-persisting).
// Import kept for DEV preview; rendering is gated by showDevPreview below.
import OffseasonTab from '@/features/architect/offseason/OffseasonTab';
import type { OffseasonPreviewAdvanceResult } from '@/features/architect/offseason/OffseasonTab/types';

type LooseRecord = Record<string, unknown>;

type OffseasonSectionProps = {
  teamCapSheet: LooseRecord | null | undefined;
  setTeamCapSheet?: (...args: any[]) => any;
  currentYear: number;
  setCurrentYear: (...args: any[]) => any;
  capProjections: Record<string, unknown> | null | undefined;
  setLastCapSheet?: (...args: any[]) => any;
  offseasonRun?: boolean;
  setOffseasonRun: (...args: any[]) => any;
  setOffseasonSummary: (...args: any[]) => any;
  setShowOffseasonModal: (...args: any[]) => any;
  playersMap?: Record<string, unknown>;
  worldId?: string | null;
  teamCode?: string | null;
  onReloadWorldData?: (() => void) | null;
};

type WorldBackedOffseasonSurfaceProps = {
  worldId: string;
  worldSeason: string | null;
  worldSeasonLoading: boolean;
  viewingSeason: string;
  hasSeasonMismatch: boolean;
  worldDraftYear: number | null;
  viewingYear: number;
  onOpenAdvanceModal: () => void;
};

type DevPreviewOffseasonSurfaceProps = {
  showDevPreview: boolean;
  worldId?: string | null;
  teamCapSheet: LooseRecord | null | undefined;
  viewingYear: number;
  capProjections: Record<string, unknown> | null | undefined;
  offseasonRun?: boolean;
  playersMap?: Record<string, unknown>;
  onPreviewAdvanceComplete: (result: OffseasonPreviewAdvanceResult) => void;
};

function WorldBackedOffseasonSurface({
  worldId,
  worldSeason,
  worldSeasonLoading,
  viewingSeason,
  hasSeasonMismatch,
  worldDraftYear,
  viewingYear,
  onOpenAdvanceModal,
}: WorldBackedOffseasonSurfaceProps) {
  if (!worldId) {
    return null;
  }

  return (
    <section data-testid="offseason-world-surface">
      <div className="mb-6 p-4 bg-[#1a1a1a] rounded-lg border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">World Season Advancement</h3>
            <p className="text-sm text-white/60 mt-1">
              Advance the entire world to the next season. This will process all 30 teams,
              expiring contracts, and option decisions.
            </p>
            {worldSeason && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-medium text-purple-400">
                  World Season: {worldSeason}
                </span>
                {hasSeasonMismatch && (
                  <span className="text-xs text-yellow-400">
                    (Viewing: {viewingSeason})
                  </span>
                )}
              </div>
            )}
            {worldSeasonLoading && (
              <div className="mt-2 text-xs text-white/40">Loading world season...</div>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenAdvanceModal}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Advance Season
          </button>
        </div>
      </div>

      <div className="mb-6">
        <DraftPositionsInput
          worldId={worldId}
          defaultDraftYear={worldDraftYear ?? viewingYear}
          worldSeason={worldSeason}
        />
      </div>
    </section>
  );
}

function DevPreviewOffseasonSurface({
  showDevPreview,
  worldId,
  teamCapSheet,
  viewingYear,
  capProjections,
  offseasonRun,
  playersMap,
  onPreviewAdvanceComplete,
}: DevPreviewOffseasonSurfaceProps) {
  if (!showDevPreview) {
    return null;
  }

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
        capProjections={capProjections}
        offseasonRun={offseasonRun}
        onPreviewAdvanceComplete={onPreviewAdvanceComplete}
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
  setLastCapSheet,
  offseasonRun,
  setOffseasonRun,
  setOffseasonSummary,
  setShowOffseasonModal,
  playersMap,
  worldId,
  teamCode,
  onReloadWorldData,
}: OffseasonSectionProps) => {
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  // OFFSEASON_E1: Single-team preview only visible in DEV with localStorage flag
  const showDevPreview =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem(DEV_OFFSEASON_PREVIEW_FLAG) === 'true';

  // Phase 5 PATCH: Track world's actual current season (single source of truth)
  const [worldSeason, setWorldSeason] = useState<string | null>(null);
  const [worldSeasonLoading, setWorldSeasonLoading] = useState(false);

  // Fetch world metadata when worldId changes to get the actual current season
  useEffect(() => {
    async function loadWorldSeason() {
      if (!worldId) {
        setWorldSeason(null);
        return;
      }

      setWorldSeasonLoading(true);
      try {
        const worldMeta = await getWorldMetadata(worldId);
        setWorldSeason(worldMeta?.currentSeason || null);
      } catch (error) {
        console.error('Failed to load world metadata:', error);
        setWorldSeason(null);
      } finally {
        setWorldSeasonLoading(false);
      }
    }

    loadWorldSeason();
  }, [worldId]);

  const handleWorldAdvanceComplete = useCallback(
    (result: SeasonAdvanceResult) => {
      if (!result.success || !result.worldAdvanceAftermath) {
        return;
      }

      const { worldAdvanceAftermath } = result;
      setCurrentYear(worldAdvanceAftermath.nextViewingYear);
      setWorldSeason(worldAdvanceAftermath.nextWorldSeason);
      setOffseasonRun(true);
      setOffseasonSummary(worldAdvanceAftermath.offseasonSummary);
      setShowOffseasonModal(true);
      onReloadWorldData?.();
    },
    [
      setCurrentYear,
      setOffseasonRun,
      setOffseasonSummary,
      setShowOffseasonModal,
      onReloadWorldData,
    ]
  );

  const handlePreviewAdvanceComplete = useCallback(
    ({
      previousCapSheet,
      updatedCapSheet,
      nextYear,
      summary,
    }: OffseasonPreviewAdvanceResult) => {
      if (setLastCapSheet) {
        setLastCapSheet(previousCapSheet);
      }
      if (setTeamCapSheet) {
        setTeamCapSheet(updatedCapSheet);
      }
      setCurrentYear(nextYear);
      setOffseasonSummary(summary);
      setShowOffseasonModal(true);
      setOffseasonRun(true);
    },
    [
      setLastCapSheet,
      setTeamCapSheet,
      setCurrentYear,
      setOffseasonSummary,
      setShowOffseasonModal,
      setOffseasonRun,
    ]
  );

  const worldSeasonEndYear = worldSeason ? toEndYear(worldSeason) : null;
  const worldDraftYear = worldSeasonEndYear;

  const viewingSeason = toSeasonCode(viewingYear);

  const hasSeasonMismatch = worldSeason && worldSeason !== viewingSeason;

  return (
    <div>
      <WorldBackedOffseasonSurface
        worldId={worldId ?? ''}
        worldSeason={worldSeason}
        worldSeasonLoading={worldSeasonLoading}
        viewingSeason={viewingSeason}
        hasSeasonMismatch={Boolean(hasSeasonMismatch)}
        worldDraftYear={worldDraftYear}
        viewingYear={viewingYear}
        onOpenAdvanceModal={() => setShowAdvanceModal(true)}
      />

      <DevPreviewOffseasonSurface
        showDevPreview={showDevPreview}
        worldId={worldId}
        teamCapSheet={teamCapSheet}
        viewingYear={viewingYear}
        capProjections={capProjections}
        offseasonRun={offseasonRun}
        playersMap={playersMap}
        onPreviewAdvanceComplete={handlePreviewAdvanceComplete}
      />

      <SeasonAdvanceModal
        isOpen={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
        teamCapSheet={teamCapSheet}
        authoritativeSeasonEndYear={worldSeasonEndYear ?? viewingYear}
        worldId={worldId}
        teamCode={teamCode}
        onWorldAdvanceComplete={handleWorldAdvanceComplete}
      />
    </div>
  );
};

export { OffseasonSection };
