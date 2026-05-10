/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx
 * PURPOSE: Selected free-agent card strip rendered above the pool list.
 * OWNERSHIP: Feature: architect/freeAgency
 */
import React from 'react';
import { FreeAgentCard } from './FreeAgentCard';
import type { FreeAgentSurfaceEntry } from './types';

interface SelectedFreeAgentCardsProps {
  selectedEntries: FreeAgentSurfaceEntry[];
  onOpenContractModal: (entry: FreeAgentSurfaceEntry) => void;
  onRemove: (selectionKey: string) => void;
}

export const SelectedFreeAgentCards = ({
  selectedEntries,
  onOpenContractModal,
  onRemove,
}: SelectedFreeAgentCardsProps) => {
  if (selectedEntries.length === 0) return null;

  return (
    <div className="bg-[#1a1a1a] p-4 rounded border border-white/10 mb-3 flex flex-wrap gap-4">
      {selectedEntries.map((entry) => (
        <FreeAgentCard
          key={entry.selectionKey}
          entry={entry}
          onOpenContractModal={onOpenContractModal}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};
