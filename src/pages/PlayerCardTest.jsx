// src/pages/PlayerCardTest.jsx
import React from 'react';
import PlayerCard from '@/components/roster/PlayerCard';

// Sample Test Player Object
const testPlayer = {
  id: 'lebron_james',
  name: 'LeBron James',
  display_name: 'LeBron James',
  bio: {
    Team: 'LAL',
    Position: 'Small Forward',
  },
  salaryByYear: {
    '2025-26': 47,
  },
  free_agency_year: 2026,
  headshot: '/assets/headshots/lebron_james.png', // ✅ this matches your live path
};

// PlayerCardTest – Isolated preview page for designing PlayerCard
const PlayerCardTest = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
      {/* Starter Card Preview */}
      <div>
        <h2 className="text-white text-xl font-bold mb-2 text-center">
          Starter Size
        </h2>
        <PlayerCard player={testPlayer} size="starter" onRemove={() => {}} />
      </div>

      {/* Rotation Card Preview */}
      <div>
        <h2 className="text-white text-xl font-bold mb-2 text-center">
          Rotation Size
        </h2>
        <PlayerCard player={testPlayer} size="rotation" onRemove={() => {}} />
      </div>

      {/* Bench Card Preview */}
      <div>
        <h2 className="text-white text-xl font-bold mb-2 text-center">
          Bench Size
        </h2>
        <PlayerCard player={testPlayer} size="bench" onRemove={() => {}} />
      </div>
    </div>
  );
};

export default PlayerCardTest;
