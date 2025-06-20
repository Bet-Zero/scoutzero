// TeamRosterView.jsx
import React, { useState } from 'react';
import RosterViewer from '@/features/roster/RosterViewer';
import RosterExportModal from '@/features/roster/RosterExportModal';

const TeamRosterView = () => {
  const [showExport, setShowExport] = useState(false);

  return (
    <div className="px-4 pt-4">
      <div className="max-w-[1300px] mx-auto mb-4 text-right">
        <button
          onClick={() => setShowExport(true)}
          className="px-3 py-1 text-sm rounded bg-white/10 text-white hover:bg-white/20"
        >
          Export
        </button>
      </div>
      <RosterViewer />
      <RosterExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
};

export default TeamRosterView;
