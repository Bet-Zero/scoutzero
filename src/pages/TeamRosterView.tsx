// TeamRosterView.tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { RosterViewer } from '@/features/roster/RosterViewer';

const TeamRosterView = () => {
  const { rosterId } = useParams<{ rosterId?: string }>();

  return (
    <div className="px-4 pt-4">
      <div className="w-full max-w-[1100px] mx-auto">
        <RosterViewer initialRosterId={rosterId} />
      </div>
    </div>
  );
};

export default TeamRosterView;
