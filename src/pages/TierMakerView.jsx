import React from 'react';
import TierMakerBoard from '@/features/tierMaker/TierMakerBoard';

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

const players = Array.from({ length: 10 }, (_, idx) => ({
  player_id: `player_${idx}`, // stable, unique
  display_name: `Player ${idx + 1}`,
  formattedPosition: 'F',
  headshotUrl: `/assets/headshots/aaron_gordon.png`,
  bio: { HT: "6'8", WT: 235, Team: 'DEN' },
}));

const TierMakerView = () => {
  return (
    <div className="bg-black min-h-screen text-white">
      <TierMakerBoard players={players} />
    </div>
  );
};

export default TierMakerView;
