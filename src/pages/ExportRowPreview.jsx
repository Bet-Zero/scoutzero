// src/pages/ExportRowPreview.jsx
import React from 'react';
import ListExportRowCompactSingle from '@/features/lists/ListExportRowCompactSingle';

const dummyPlayer = {
  player_id: 'lebron_james',
  display_name: 'LeBron James',
  name: 'LeBron James',
  headshotUrl: '/assets/headshots/lebron_james.png',
  bio: {
    Team: 'LAL',
    HT: '6-9',
    WT: '250',
    Position: 'SF',
  },
  formattedPosition: 'SF',
};

const ExportRowPreview = () => {
  return (
    <div className="bg-neutral-900 p-6 grid grid-cols-1 gap-y-2">
      {[1, 2, 3, 4, 5].map((rank) => (
        <ListExportRowCompactSingle key={rank} player={dummyPlayer} rank={rank} />
      ))}
    </div>
  );
};

export default ExportRowPreview;
