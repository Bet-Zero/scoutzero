/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/SelectedFreeAgentCards.tsx
 * PURPOSE: Selected free-agent decision deck docked between the filters and the
 *          pool list. Collapsible + fixed-height so the pool always stays on
 *          screen at the 1280×720 review viewport; overflows internally beyond
 *          two rows, and can be hidden entirely to hand its space to the pool.
 * OWNERSHIP: Feature: architect/freeAgency
 */
import React from 'react';
import { FreeAgentCard } from './FreeAgentCard';
import type { ActionExposureClassification } from '@/features/architect/GMDashboard/hooks/useArchitectActions.types';
import type { FreeAgentSurfaceEntry } from './types';

interface SelectedFreeAgentCardsProps {
  selectedEntries: FreeAgentSurfaceEntry[];
  onOpenContractModal: (entry: FreeAgentSurfaceEntry) => void;
  onRemove: (selectionKey: string) => void;
  // Mirrors the modal's world-aware signing label so the deck's Sign action
  // carries the same "(Preview)" marker in sandbox and drops it in a saved world.
  isPreviewSigning?: boolean;
  // Same world-aware exposure truth the pool rows report, so the deck's Sign
  // action doesn't hardcode a preview-only classification in a saved world.
  exposureClassification?: ActionExposureClassification;
}

export const SelectedFreeAgentCards = ({
  selectedEntries,
  onOpenContractModal,
  onRemove,
  isPreviewSigning = false,
  exposureClassification = 'preview-only',
}: SelectedFreeAgentCardsProps) => {
  const [collapsed, setCollapsed] = React.useState(false);

  if (selectedEntries.length === 0) return null;
  const count = selectedEntries.length;

  return (
    <div
      data-testid="selected-free-agent-deck"
      className="mb-2 shrink-0 overflow-hidden rounded-md border border-cockpit-info/25 bg-white/[0.03]"
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cockpit-text-secondary">
          <span>Selected Free Agents</span>
          <span className="rounded-full border border-cockpit-info/30 bg-cockpit-info/10 px-1.5 text-cockpit-info tabular-nums">
            {count}
          </span>
        </div>
        <button
          type="button"
          data-testid="selected-free-agent-deck-toggle"
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? 'Show selected free agents' : 'Hide selected free agents'
          }
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-cockpit-text-secondary transition-colors hover:bg-white/5 hover:text-cockpit-text-primary"
        >
          {collapsed ? 'Show' : 'Hide'}
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className={`h-3 w-3 transition-transform duration-150 ${
              collapsed ? '' : 'rotate-180'
            }`}
          >
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {collapsed ? null : (
        <div className="max-h-[236px] overflow-y-auto px-2 pb-2">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-2">
            {selectedEntries.map((entry) => (
              <FreeAgentCard
                key={entry.selectionKey}
                entry={entry}
                onOpenContractModal={onOpenContractModal}
                onRemove={onRemove}
                isPreviewSigning={isPreviewSigning}
                exposureClassification={exposureClassification}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
