import React from 'react';
import { areSamePick, formatPick } from '@/utils/architect/tradeHelpers';
import { getPickOptions } from '@/utils/architect/tradeMachine/pickOptions';

export const OutgoingPicksList = ({
  team,
  picks,
  onTogglePick,
  onEditPick,
}) => (
  <div>
    <h4 className="text-sm text-white/70 mb-1">Outgoing Picks</h4>
    <div className="space-y-1 max-h-[375px] overflow-y-auto pr-1">
      {team.picks?.map((p) => {
        const pickObj = picks.find((pk) => areSamePick(pk, p));
        const exists = !!pickObj;
        return (
          <div
            key={`${p.year}-${p.round}-${p.via || ''}`}
            className={`flex items-start justify-between px-3 py-1 rounded-md text-xs transition-colors ${
              exists ? 'bg-purple-800/30' : 'bg-white/10'
            }`}
          >
            <div>
              <div>{formatPick(pickObj || p)}</div>
              {exists && (
                <div className="text-white/50 mt-1 space-y-1">
                  <select
                    className="bg-black/30 p-1 rounded w-full"
                    value={pickObj?.protection || ''}
                    onChange={(e) =>
                      onEditPick(p, 'protection', e.target.value)
                    }
                  >
                    {getPickOptions().map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="bg-black/30 p-1 rounded w-full"
                    value={pickObj?.note || ''}
                    placeholder="Note"
                    onChange={(e) => onEditPick(p, 'note', e.target.value)}
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => onTogglePick(p)}
              className="text-blue-400 hover:underline"
            >
              {exists ? 'Remove' : 'Trade'}
            </button>
          </div>
        );
      })}
      {team.picks?.length === 0 && (
        <div className="text-xs text-white/40">No picks available</div>
      )}
    </div>
  </div>
);
