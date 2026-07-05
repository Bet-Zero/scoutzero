import React from 'react';
import { StarterCard } from './StarterCard';
import { RotationCard } from './RotationCard';
import { BenchCard } from './BenchCard';
import { EmptySlot } from './EmptySlot';
import type { MouseEvent, ReactNode } from 'react';
import type {
  MissingRosterPlayer,
  NormalizedRosterPlayer,
  RosterShape,
} from '@/features/roster/utils';

type RosterSectionName = keyof RosterShape;
type RosterSectionPlayer = NormalizedRosterPlayer | MissingRosterPlayer;
type RosterCardVariant = 'legacy' | 'architect';
type RosterCardProps = {
  player: RosterSectionPlayer;
  onRemove?: (event: MouseEvent<HTMLElement>) => void;
  showRemove?: boolean;
  isExport?: boolean;
  variant?: RosterCardVariant;
  onSelect?: (event: MouseEvent<HTMLElement>) => void;
  isHighlighted?: boolean;
  menuSlot?: ReactNode;
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
  /**
   * Stage 2C navigation-only seam: clicking a player opens the existing
   * contract modal through the dashboard-owned callback. Receives the
   * player object so the upstream owner can route through
   * `handleEditContract` exactly the way Cap Sheet rows already do.
   */
  onSelectPlayer?: (player: RosterSectionPlayer) => void;
  /** Architect dashboard presentation keeps the roster builder/export cards unchanged. */
  variant?: RosterCardVariant;
  /**
   * Stage 2C focus highlight: when `isPlayerHighlighted(player)` returns
   * true, the matching card renders a non-mutating "just changed"
   * outline. Visual only.
   */
  isPlayerHighlighted?: (player: RosterSectionPlayer) => boolean;
  /**
   * Optional per-card corner overlay (interconnectivity Slice 2): returns the
   * shared PlayerActionMenu for a card. Additive — when omitted (e.g. the
   * roster builder) cards render exactly as before.
   */
  renderPlayerMenu?: (player: RosterSectionPlayer) => ReactNode;
};

const getSectionClass = (
  section: RosterSectionName,
  previewSpacing: boolean,
  variant: RosterCardVariant
) => {
  const base = 'flex justify-center';

  if (variant === 'architect') {
    if (section === 'starters') {
      return `${base} flex-wrap items-end gap-3`;
    }

    if (section === 'rotation') {
      return `${base} flex-wrap items-end gap-2.5`;
    }

    if (section === 'bench') {
      return `${base} flex-wrap items-end gap-2`;
    }
  }

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

export const RosterSection = ({
  players,
  section,
  onRemove,
  onAdd,
  isExport = false,
  previewSpacing = false,
  onSelectPlayer,
  variant = 'legacy',
  isPlayerHighlighted,
  renderPlayerMenu,
}: RosterSectionProps) => {
  const CardComponent = cardMap[section];
  const sectionClass = getSectionClass(section, previewSpacing, variant);
  const showMutationControls = !isExport && Boolean(onRemove);

  return (
    <div className={sectionClass} data-roster-section={section}>
      {players.map((player, idx) => {
        if (player) {
          const handleSelect = onSelectPlayer
            ? () => onSelectPlayer(player)
            : undefined;
          const highlighted = Boolean(isPlayerHighlighted?.(player));
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
              variant={variant}
              onSelect={handleSelect}
              isHighlighted={highlighted}
              menuSlot={renderPlayerMenu?.(player)}
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
