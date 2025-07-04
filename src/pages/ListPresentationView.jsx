// src/pages/ListPresentationView.jsx

import React, { useState } from 'react';
import ToggleViewButton from '@/features/lists/RankedListTierToggle';
import ListDisplayWrapper from '@/features/lists/ListPreviewModal/ListExportWrapper';
import TieredListView from '@/features/lists/TieredListView';

const samplePlayer = {
  player_id: 'aaron_gordon',
  name: 'Aaron Gordon',
  display_name: 'Aaron Gordon',
  formattedPosition: 'F',
  headshotUrl: '/assets/headshots/aaron_gordon.png',
  bio: {
    HT: "6'8",
    WT: 235,
    Team: 'DEN',
  },
};

const sampleList = Array(15).fill(samplePlayer);

const sampleTiered = {
  'Tier 1': [samplePlayer, samplePlayer],
  'Tier 2': [samplePlayer, samplePlayer, samplePlayer],
  'Tier 3': [samplePlayer],
  'Tier 4': [samplePlayer],
  'Tier 5': [samplePlayer],
  'Tier 6': [samplePlayer],
  'Tier 7': [samplePlayer],
};

const ListPresentationView = () => {
  const [view, setView] = useState('tier');

  return (
    <div className="bg-black text-white p-0 m-0 min-h-screen relative">
      {/* Top-right toggle */}
      <div className="absolute top-2 right-4 z-10">
        <ToggleViewButton view={view} setView={setView} />
      </div>

      {/* Tier/Table display */}
      <div className="pt-2 px-2 overflow-x-hidden">
        {view === 'tier' ? (
          <TieredListView tieredPlayers={sampleTiered} />
        ) : (
          <ListDisplayWrapper players={sampleList} view="list" />
        )}
      </div>
    </div>
  );
};

export default ListPresentationView;
