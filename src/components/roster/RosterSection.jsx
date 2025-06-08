import React from 'react';
import PlayerCard from './PlayerCard';
import EmptySlot from './EmptySlot';

const sectionClasses = {
  starters: 'flex justify-center gap-4 mb-10',
  rotation: 'flex justify-center gap-1 mb-8',
  bench: 'flex justify-center gap-0.5',
};

const sizeMap = {
  starters: 'starter',
  rotation: 'rotation',
  bench: 'bench',
};

const RosterSection = ({ players, section, onRemove, onAdd }) => (
  <div className={sectionClasses[section]}>
    {players.map((player, idx) =>
      player ? (
        <PlayerCard
          key={player.id}
          player={player}
          size={sizeMap[section]}
          onRemove={(e) => onRemove(section, idx, e)}
        />
      ) : (
        <EmptySlot
          key={`${section}-${idx}`}
          size={sizeMap[section]}
          onAdd={() => onAdd(section, idx)}
        />
      )
    )}
  </div>
);

export default RosterSection;
