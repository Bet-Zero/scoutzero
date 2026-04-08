// src/components/roster/index.jsx
import React from 'react';
import StarterCard from './StarterCard';
import RotationCard from './RotationCard';
import BenchCard from './BenchCard';
import EmptySlot from './EmptySlot';

const getSectionClass = (section, previewSpacing) => {
  const base = 'flex justify-center';

  if (section === 'starters') {
    return `${base} gap-4 ${previewSpacing ? 'mb-3' : 'mb-10'}`;
  }

  if (section === 'rotation') {
    return `${base} gap-2 ${previewSpacing ? 'mb-2' : 'mb-8'}`;
  }

  if (section === 'bench') {
    return `${base} ${previewSpacing ? 'gap-2 mb-3' : 'gap-0.5 mb-8'}`;
  }

  return base;
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
  previewSpacing = false,
}) => {
  const CardComponent = cardMap[section];
  const sectionClass = getSectionClass(section, previewSpacing);
  const showMutationControls = !isExport && Boolean(onRemove);

  return (
    <div className={sectionClass} data-roster-section={section}>
      {players.map((player, idx) => {
        if (player) {
          return (
            <CardComponent
              key={player.id}
              player={player}
              onRemove={
                showMutationControls
                  ? (e) => onRemove(section, idx, e)
                  : undefined
              }
              showRemove={showMutationControls}
              isExport={isExport}
            />
          );
        }
        if (!isExport && onAdd) {
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
