import type { MouseEvent } from 'react';

import {
  resolvedHoldAmount,
  type CapHoldLike,
  type ResolvedCapHoldEntry,
} from './useGovernedCapHoldResolution';
import { getTagColor, normalizeFAType } from './capSheetFullPresentation';

export function CapHoldDetailRow({
  entry,
  isLegacy = false,
  allYears,
  gridTemplateColumns,
  onRenounce,
}: {
  entry: ResolvedCapHoldEntry;
  isLegacy?: boolean;
  allYears: readonly number[];
  gridTemplateColumns: string;
  onRenounce?: ((hold: CapHoldLike) => void) | null;
}) {
  const hold = entry.hold;
  const amount = resolvedHoldAmount(entry);
  const rightsAvailable =
    entry.rights.projectionStatus === 'available' ||
    entry.rights.projectionStatus === 'legacy';
  const tag = normalizeFAType(entry.rights.freeAgentType || hold.type);
  const handleRenounce = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (rightsAvailable) onRenounce?.(hold);
  };

  return (
    <div
      className={`grid items-center hover:bg-white/[0.02] transition-colors group ${isLegacy ? 'bg-white/[0.01]' : ''}`}
      style={{ gridTemplateColumns }}
    >
      <div className="px-4 py-2 flex items-center border-r border-cockpit-edge h-[24px] relative overflow-hidden">
        <span
          className="text-xs font-medium text-cockpit-text-primary truncate w-full"
          title={hold.playerName || String(hold.playerId || '')}
        >
          {hold.playerName || hold.playerId}
        </span>
        <div className="absolute inset-0 bg-cockpit-slab flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            data-testid="cap-sheet-full-absolve-button"
            data-action-exposure-classification="preview-only"
            disabled={!rightsAvailable}
            title={
              rightsAvailable
                ? 'Secondary cap-hold drawer Absolve is not a V1 supported entry point'
                : entry.rights.unavailableReasons[0]
            }
            onClick={handleRenounce}
            className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded border border-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Absolve
          </button>
        </div>
      </div>

      <div className="px-1 py-1 flex items-center justify-center border-r border-cockpit-edge h-[24px]">
        {entry.rights.isDeadHold ? (
          <span
            className="px-1 py-px rounded-[2px] text-[8px] font-bold uppercase tracking-wider truncate max-w-full border border-zinc-500/30 bg-zinc-600/20 text-zinc-300"
            title="Renounce-able hold for a departed player — not a live decision"
          >
            DEAD
          </span>
        ) : (
          <span
            className={`${getTagColor(hold.type || null)} px-1 py-px rounded-[2px] text-[8px] font-bold uppercase tracking-wider truncate max-w-full`}
          >
            {hold.type === 'FA Cap Hold'
              ? 'HOLD'
              : tag || hold.type || 'HOLD'}
          </span>
        )}
      </div>

      {allYears.map((year) => {
        const season = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
        return hold.season === season ? (
          <div
            key={year}
            className="flex items-center justify-center px-2 py-2 border-l border-white/[0.02] h-[24px] bg-cyan-900/10"
          >
            <span className="text-xs font-mono text-cyan-200 tabular-nums">
              {rightsAvailable ? `$${amount.toLocaleString()}` : 'Needs input'}
            </span>
          </div>
        ) : (
          <div
            key={year}
            className="border-l border-white/[0.02] h-[24px] opacity-30"
          />
        );
      })}
    </div>
  );
}
