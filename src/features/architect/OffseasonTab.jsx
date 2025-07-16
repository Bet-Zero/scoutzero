import React, { useState } from 'react';
import OptionManager from './OptionManager';
import { runOffseason } from '@/utils/architect/runOffseason';

const OffseasonTab = ({
  teamCapSheet,
  setTeamCapSheet,
  currentYear,
  setCurrentYear,
  capSettings,
  setLastCapSheet,
  setOffseasonRun,
  setOffseasonSummary,
  setShowModal,
}) => {
  const [optionsConfirmed, setOptionsConfirmed] = useState(false);
  const [optionDecisions, setOptionDecisions] = useState(null);

  const handleDecisionsReady = (decisions) => {
    setOptionDecisions(decisions);
    setOptionsConfirmed(true);
  };

  const handleAdvanceYear = () => {
    setLastCapSheet(JSON.parse(JSON.stringify(teamCapSheet)));
    const { updatedCapSheet, summary } = runOffseason(
      teamCapSheet,
      currentYear,
      capSettings,
      optionDecisions
    );
    setTeamCapSheet(updatedCapSheet);
    setCurrentYear(currentYear + 1);
    setOffseasonSummary(summary);
    setShowModal(true);
    setOffseasonRun(true);
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-2">Offseason Manager</h2>

      {!optionsConfirmed && !offseasonRun && (
        <OptionManager
          teamCapSheet={teamCapSheet}
          currentYear={currentYear}
          onDecisionsReady={handleDecisionsReady}
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
