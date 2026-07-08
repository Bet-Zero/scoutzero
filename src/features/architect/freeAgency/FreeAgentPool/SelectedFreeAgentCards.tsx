/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx
 * PURPOSE: Selected free-agent decision deck docked between the filters and the
 *          pool list. Fixed-height region so the pool always stays on screen at
 *          the 1280×720 review viewport; overflows internally beyond two rows.
 * OWNERSHIP: Feature: architect/freeAgency
 */
import React from 'react';
import { FreeAgentCard } from './FreeAgentCard';
import type { FreeAgentSurfaceEntry } from './types';

interface SelectedFreeAgentCardsProps {
  selectedEntries: FreeAgentSurfaceEntry[];
  onOpenContractModal: (entry: FreeAgentSurfaceEntry) => void;
  onRemove: (selectionKey: string) => void;
  // Mirrors the modal's world-aware signing label so the deck's Sign action
  // carries the same "(Preview)" marker in sandbox and drops it in a saved world.
  isPreviewSigning?: boolean;
}

export const SelectedFreeAgentCards = ({
  selectedEntries,
  onOpenContractModal,
  onRemove,
  isPreviewSigning = false,
}: SelectedFreeAgentCardsProps) => {
  if (selectedEntries.length === 0) return null;

  return (
    <div
      data-testid="selected-free-agent-deck"
      className="mb-2 max-h-[236px] shrink-0 overflow-y-auto rounded-md border border-cockpit-info/25 bg-white/[0.03] p-2"
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-2">
        {selectedEntries.map((entry) => (
          <FreeAgentCard
            key={entry.selectionKey}
            entry={entry}
            onOpenContractModal={onOpenContractModal}
            onRemove={onRemove}
            isPreviewSigning={isPreviewSigning}
          />
        ))}
      </div>
    </div>
  );
};
