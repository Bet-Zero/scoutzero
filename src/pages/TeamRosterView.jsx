// TeamRosterView.jsx
import React from 'react';
import RosterViewer from '@/components/roster/RosterViewer';

const TeamRosterViewer = () => {
  return (
    <>
      <div className="w-full text-center py-6 border-b border-white/10">
        <h1 className="text-3xl font-bold text-white tracking-wide">
          HoopZero - Team Roster Builder
        </h1>
        <p className="text-white/40 mt-1 text-sm">
          Build lineups, evaluate depth, and visualize fit
        </p>
      </div>

      <div className="mt-6 px-4">
        <RosterViewer />
      </div>
    </>
  );
};

export default TeamRosterViewer;
