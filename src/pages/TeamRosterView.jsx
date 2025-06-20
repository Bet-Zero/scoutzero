// TeamRosterView.jsx
import React, { useState } from 'react';
import RosterViewer from '@/features/roster/RosterViewer';
import RosterExportWrapper from '@/features/roster/RosterExportWrapper';

const TeamRosterView = () => {
  const [isExport, setIsExport] = useState(false);

  return (
    <div className="px-4 pt-4">
      <div className="w-full max-w-[1100px] mx-auto">
        <RosterExportWrapper isExport={isExport}>
          <RosterViewer isExport={isExport} />
        </RosterExportWrapper>
      </div>
      <div className="w-full max-w-[1100px] mx-auto mt-8 mb-12 text-right">
        {isExport ? (
          <button
            onClick={() => setIsExport(false)}
            className="px-3 py-1 text-sm rounded bg-white/10 text-white hover:bg-white/20"
          >
            Back to Edit
          </button>
        ) : (
          <button
            onClick={() => setIsExport(true)}
            className="px-3 py-1 text-sm rounded bg-white/10 text-white hover:bg-white/20"
          >
            Export
          </button>
        )}
      </div>
    </div>
  );
};

export default TeamRosterView;
