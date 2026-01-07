/**
 * FILE: src/features/architect/GMDashboard/sections/OffseasonSection.jsx
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
 *
 * LINKS:
 *  - Plan: N/A (not created via plan)
 *  - Latest Chunk: N/A
 */

import React, { useState, useCallback, useEffect } from 'react';
import OffseasonTab from '@/features/architect/OffseasonTab';
import { SeasonAdvanceModal, DraftPositionsInput } from '@/features/architect/GMDashboard/components';
import { toEndYear, toSeasonCode } from '@/features/architect/utils/seasonFormat';
import { getWorldMetadata } from '@/features/architect/utils/worldManager';

const OffseasonSection = ({
  teamCapSheet,
  setTeamCapSheet,
  currentYear,
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
}) => {
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  
  // Phase 5 PATCH: Track world's actual current season (single source of truth)
  const [worldSeason, setWorldSeason] = useState(null);
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

  const handleAdvanceComplete = useCallback((result) => {
    // Update local state after successful season advance
    if (result.success) {
      // Update currentYear to the new season using toEndYear utility
      const toYear = toEndYear(result.toSeason) ?? currentYear;
      setCurrentYear(toYear);
      
      // Phase 5 PATCH: Also update worldSeason to reflect the new season
      setWorldSeason(result.toSeason);

      // Mark offseason as complete
      setOffseasonRun(true);

      // Store summary for display
      setOffseasonSummary({
        declinedOptions: result.summary?.declinedOptions?.map(o => o.playerName) || [],
        expiredContracts: result.summary?.expiredContracts?.map(c => c.playerName) || [],
        expiredTPEs: [],
        waivedDeadCap: [],
        resetMLE: true,
        exercisedOptions: result.summary?.exercisedOptions || [],
        stepienUpdates: result.summary?.stepienUpdates || [],
      });
      setShowOffseasonModal(true);

      // Trigger data reload if callback provided
      if (onReloadWorldData) {
        onReloadWorldData();
      }
    }
  }, [currentYear, setCurrentYear, setOffseasonRun, setOffseasonSummary, setShowOffseasonModal, onReloadWorldData]);

  // Compute world draft year from world season (used for DraftPositionsInput default)
  // worldSeason "2025-26" → worldDraftYear 2026
  const worldDraftYear = worldSeason ? toEndYear(worldSeason) : currentYear;
  
  // Format the UI's "viewing year" as a season code for comparison
  const viewingSeason = toSeasonCode(currentYear);
  
  // Detect mismatch between UI view and world state
  const hasSeasonMismatch = worldSeason && worldSeason !== viewingSeason;

  return (
    <div>
      {/* World-aware Season Advance Button */}
      {worldId && (
        <div className="mb-6 p-4 bg-[#1a1a1a] rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">World Season Advancement</h3>
              <p className="text-sm text-white/60 mt-1">
                Advance the entire world to the next season. This will process all 30 teams,
                expiring contracts, and option decisions.
              </p>
              {/* Phase 5 PATCH: Display world's actual current season */}
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
              onClick={() => setShowAdvanceModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Advance Season
            </button>
          </div>
        </div>
      )}

      {/* Phase 5: Draft Positions Input - uses worldDraftYear for default year */}
      {worldId && (
        <div className="mb-6">
          <DraftPositionsInput 
            worldId={worldId} 
            currentYear={worldDraftYear}
            worldSeason={worldSeason}
          />
        </div>
      )}

      {/* Divider */}
      {worldId && (
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#0d0d0d] text-white/40">or use single-team offseason tools</span>
          </div>
        </div>
      )}

      {/* OffseasonTab (single-team offseason tools) */}
      <OffseasonTab
        teamCapSheet={teamCapSheet}
        setTeamCapSheet={setTeamCapSheet}
        currentYear={currentYear}
        setCurrentYear={setCurrentYear}
        capProjections={capProjections}
        setLastCapSheet={setLastCapSheet}
        offseasonRun={offseasonRun}
        setOffseasonRun={setOffseasonRun}
        setOffseasonSummary={setOffseasonSummary}
        setShowOffseasonModal={setShowOffseasonModal}
        playersMap={playersMap}
      />

      {/* Season Advance Modal */}
      <SeasonAdvanceModal
        isOpen={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
        teamCapSheet={teamCapSheet}
        currentYear={currentYear}
        worldId={worldId}
        teamCode={teamCode}
        onAdvanceComplete={handleAdvanceComplete}
      />
    </div>
  );
};

export { OffseasonSection };
