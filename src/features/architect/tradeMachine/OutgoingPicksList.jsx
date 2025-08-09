import React, { useState, useMemo } from 'react';
import { areSamePick } from '@/utils/architect/tradeHelpers';
import TradePickRow from './TradePickRow';

export const OutgoingPicksList = ({
  team,
  picks,
  incomingPicks = [],
  otherTeams = [],
  onTogglePick,
  onEditPick,
}) => {
  const [openMenu, setOpenMenu] = useState(null);

  const available = useMemo(
    () => [
      ...incomingPicks,
      ...(team.picks || []).filter(
        (p) => !picks.some((pk) => areSamePick(pk, p))
      ),
    ],
    [team.picks, picks, incomingPicks]
  );

  return (
    <div>
      <h4 className="text-sm text-white/70 mb-1">Outgoing Picks</h4>
      <div className="space-y-1 max-h-[375px] overflow-y-auto pr-1">
        {available.map((p, idx) => {
          const pickObj = picks.find((pk) => areSamePick(pk, p));
          const rowKey = `${idx}-${p.year}-${p.round}-${p.via || ''}`;
          return (
            <TradePickRow
              key={rowKey}
              rowKey={rowKey}
              pick={p}
              pickObj={pickObj}
              teamId={team.id}
              otherTeams={otherTeams}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onToggle={onTogglePick}
              onEdit={onEditPick}
            />
          );
        })}
        {available.length === 0 && (
          <div className="text-xs text-white/40">No picks available</div>
        )}
      </div>
    </div>
  );
};
