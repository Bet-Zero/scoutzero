import React from 'react';
import WaiveStretchTracker from './WaiveStretchTracker';
import ExceptionHistoryTracker from './ExceptionHistoryTracker';
import DraftPickTracker from './DraftPickTracker';

const TeamHistoryTab = ({ teamCapSheet }) => {
  return (
    <div className="team-history-tab">
      <h2>Team Transaction History</h2>
      
      <section style={{ marginBottom: '40px' }}>
        <WaiveStretchTracker 
          waivedContracts={teamCapSheet.waivedContracts || []} 
        />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
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