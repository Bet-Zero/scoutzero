// TeamRosterView.jsx
import React, { useState } from 'react';
import RosterViewer from '@/features/roster/RosterViewer';

const TeamRosterView = () => {
  const [isExport, setIsExport] = useState(false);

  return (
    <div className="px-4 pt-4">
      <div className="max-w-[1300px] mx-auto mb-4 text-right">
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
      <RosterViewer isExport={isExport} />
    </div>
  );
};

export default TeamRosterView;
