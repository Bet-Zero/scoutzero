import React from 'react';
import WaiveStretchTracker from './WaiveStretchTracker';
import ExceptionHistoryTracker from './ExceptionHistoryTracker';
import DraftPickTracker from './DraftPickTracker';

const TeamHistoryTab = ({ teamCapSheet }) => {
  return (
    <div className="text-white">
      <h2 className="text-xl font-semibold mb-4">Team Transaction History</h2>
      
      <section className="mb-10">
        <WaiveStretchTracker
          waivedContracts={teamCapSheet.waivedContracts || []}
        />
      </section>

      <section className="mb-10">
        <ExceptionHistoryTracker
          exceptionHistory={teamCapSheet.exceptionHistory || []}
          mleHistory={teamCapSheet.mleHistory || []}
        />
      </section>
      
      <section>
        <DraftPickTracker 
          pickLog={teamCapSheet.pickLog || []} 
          currentPicks={teamCapSheet.currentPicks || {}} 
        />
      </section>
    </div>
  );
};

export default TeamHistoryTab;