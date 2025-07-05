// TeamRosterView.jsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import RosterViewer from '@/features/roster/RosterViewer';
import RosterExportWrapper from '@/features/roster/RosterExportWrapper';

const TeamRosterView = () => {
  const [isExport, setIsExport] = useState(false);
  const { rosterId } = useParams();

  return (
    <div className="px-4 pt-4">
      <div className="w-full max-w-[1100px] mx-auto">
        <RosterExportWrapper isExport={isExport}>
          <RosterViewer isExport={isExport} initialRosterId={rosterId} />
        </RosterExportWrapper>
      </div>
    </div>
  );
};

export default TeamRosterView;
