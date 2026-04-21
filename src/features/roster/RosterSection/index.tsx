import React from 'react';
import StarterCard from './StarterCard';
import RotationCard from './RotationCard';
import BenchCard from './BenchCard';
import EmptySlot from './EmptySlot';
import type { MouseEvent } from 'react';
import type {
  MissingRosterPlayer,
  NormalizedRosterPlayer,
  RosterShape,
} from '@/features/roster/utils';

type RosterSectionName = keyof RosterShape;
type RosterSectionPlayer = NormalizedRosterPlayer | MissingRosterPlayer;
type RosterCardProps = {
  player: RosterSectionPlayer;
  onRemove?: (event: MouseEvent<HTMLElement>) => void;
  showRemove?: boolean;
  isExport?: boolean;
};

type RosterSectionProps = {
  players: Array<RosterSectionPlayer | null>;
  section: RosterSectionName;
  onRemove?: (
    section: RosterSectionName,
    index: number,
    event?: MouseEvent<HTMLElement>
  ) => void;
  onAdd?: (section: RosterSectionName, index: number) => void;
  isExport?: boolean;
  previewSpacing?: boolean;
};

const getSectionClass = (
  section: RosterSectionName,
  previewSpacing: boolean
) => {
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
} as const;

const cardMap: Record<RosterSectionName, React.ComponentType<RosterCardProps>> = {
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
}: RosterSectionProps) => {
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
                showMutationControls && onRemove
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
