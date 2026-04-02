/**
 * FILE: src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx
 * PURPOSE: Single-team offseason workflow UI wiring for OSTE execution.
 * OWNERSHIP: Feature: architect/offseason
 *
 * HISTORY:
 *  - 2026-02-03: Updated to surface OSTE validation errors (plan `plans/_archive/offseason-transition-engine-phase1/plan.md`, chunk_n/a)
 *  - 2026-03-14: Migrated from JSX during TM_VALIDATOR_TS_OFFSEASON_PREVIEW_SURFACE_E93 execution.
 *
 * LINKS:
 *  - Plan: plans/_archive/offseason-transition-engine-phase1/plan.md
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_OFFSEASON_PREVIEW_SURFACE_E93_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */

import React, { useState } from 'react';
import OptionManager from './OptionManager';
import { runOffseason } from '@/features/architect/utils/runOffseason';
import type {
  OffseasonPreviewAdvanceResult,
  OffseasonOptionDecisionMap,
  OffseasonTabProps,
} from './types';

const OffseasonTab = ({
  teamCapSheet,
  currentYear,
  capProjections = null,
  offseasonRun = false,
  onPreviewAdvanceComplete,
  playersMap = {},
}: OffseasonTabProps) => {
  const [optionsConfirmed, setOptionsConfirmed] = useState(false);
  const [optionDecisions, setOptionDecisions] =
    useState<OffseasonOptionDecisionMap | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDecisionsReady = (decisions: OffseasonOptionDecisionMap) => {
    setOptionDecisions(decisions);
    setOptionsConfirmed(true);
  };

  const handleAdvanceYear = async () => {
    setIsLoading(true);
    setError('');
    try {
      const previousCapSheet = JSON.parse(JSON.stringify(teamCapSheet));
      const { updatedCapSheet, summary } = runOffseason(
        teamCapSheet,
        currentYear,
        capProjections,
        optionDecisions || {}
      );
      const previewResult: OffseasonPreviewAdvanceResult = {
        previousCapSheet,
        updatedCapSheet,
        nextYear: currentYear + 1,
        summary,
      };
      onPreviewAdvanceComplete(previewResult);
    } catch (err: any) {
      console.error('Failed to advance offseason', err);
      setError(err?.message || 'Failed to advance offseason');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-2">Offseason Manager</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {isLoading && <p className="text-sm mb-2">Processing...</p>}

      {!optionsConfirmed && !offseasonRun && (
        <OptionManager
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          onDecisionsReady={handleDecisionsReady}
          playersMap={playersMap}
        />
      )}

      {optionsConfirmed && !offseasonRun && (
        <div className="mt-5">
          <h4 className="font-semibold mb-2">
            All option decisions confirmed.
          </h4>
          <button
            onClick={handleAdvanceYear}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Preview Advance to {currentYear + 1}
          </button>
        </div>
      )}

      {offseasonRun && (
        <div className="mt-5">
          <strong>Preview computed — not saved</strong>
          <p>
            Preview shows projected state for {currentYear + 1} season. Use World Season Advance to persist.
          </p>
        </div>
      )}
    </div>
  );
};

export default OffseasonTab;
