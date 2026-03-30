/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx
 * PURPOSE: Selected free-agent card strip rendered above the pool list.
 * OWNERSHIP: Feature: architect/freeAgency
 */
import React from 'react';
import FreeAgentCard from './FreeAgentCard';
import type { FreeAgentListItem } from './types';

interface SelectedFreeAgentCardsProps {
  selectedPlayers: FreeAgentListItem[];
  onOpenContractModal: (player: FreeAgentListItem) => void;
  onRemove: (player: FreeAgentListItem) => void;
}

export const SelectedFreeAgentCards = ({
  selectedPlayers,
  onOpenContractModal,
  onRemove,
}: SelectedFreeAgentCardsProps) => {
  if (selectedPlayers.length === 0) return null;

  return (
    <div className="bg-[#1a1a1a] p-4 rounded border border-white/10 mb-3 flex flex-wrap gap-4">
      {selectedPlayers.map((player) => (
        <FreeAgentCard
          key={player.name}
          player={player}
          onOpenContractModal={onOpenContractModal}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};
