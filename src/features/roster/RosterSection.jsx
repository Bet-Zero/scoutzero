import React from 'react';
import StarterCard from './StarterCard';
import RotationCard from './RotationCard';
import BenchCard from './BenchCard';
import EmptySlot from './EmptySlot';

const sectionClasses = {
  starters: 'flex justify-center gap-4 mb-10',
  rotation: 'flex justify-center gap-1 mb-8',
  bench: 'flex justify-center gap-0.5 mb-8',
};

const sizeMap = {
  starters: 'starter',
  rotation: 'rotation',
  bench: 'bench',
};

const cardMap = {
  starters: StarterCard,
  rotation: RotationCard,
  bench: BenchCard,
};

const RosterSection = ({
  players,
  section,
  onRemove,
  onAdd,
  isExport = false,
}) => {
  const CardComponent = cardMap[section];
  return (
    <div className={sectionClasses[section]}>
      {players.map((player, idx) => {
        if (player) {
          return (
            <CardComponent
              key={player.id}
              player={player}
              onRemove={(e) => onRemove(section, idx, e)}
              showRemove={!isExport}
            />
          );
        }
        if (!isExport) {
          return (
            <EmptySlot
              key={`${section}-${idx}`}
              size={sizeMap[section]}
              onAdd={() => onAdd(section, idx)}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

export default RosterSection;
