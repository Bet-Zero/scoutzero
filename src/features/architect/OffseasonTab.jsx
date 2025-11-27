import React, { useState } from 'react';
import OptionManager from './OptionManager';
import { runOffseason } from '@/features/architect/utils/runOffseason';

const OffseasonTab = ({
  teamCapSheet,
  setTeamCapSheet,
  currentYear,
  setCurrentYear,
  capProjections,
  setLastCapSheet,
  setOffseasonRun,
  setOffseasonSummary,
  setShowModal,
  playersMap = {},
}) => {
  const [optionsConfirmed, setOptionsConfirmed] = useState(false);
  const [optionDecisions, setOptionDecisions] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDecisionsReady = (decisions) => {
    setOptionDecisions(decisions);
    setOptionsConfirmed(true);
  };

  const handleAdvanceYear = async () => {
    setIsLoading(true);
    setError('');
    try {
      setLastCapSheet(JSON.parse(JSON.stringify(teamCapSheet)));
      const { updatedCapSheet, summary } = runOffseason(
        teamCapSheet,
        currentYear,
        capProjections,
        optionDecisions
      );
      setTeamCapSheet(updatedCapSheet);
      setCurrentYear(currentYear + 1);
      setOffseasonSummary(summary);
      setShowModal(true);
      setOffseasonRun(true);
    } catch (err) {
      console.error('Failed to advance offseason', err);
      setError('Failed to advance offseason');
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
            Advance to {currentYear + 1}
          </button>
        </div>
      )}

      {offseasonRun && (
        <div className="mt-5">
          <strong>✅ Offseason Complete!</strong>
          <p>You are now in the {currentYear + 1} season.</p>
        </div>
      )}
    </div>
  );
};

export default OffseasonTab;
