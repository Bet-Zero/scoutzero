import React from 'react';
import { areSamePick } from '@/utils/architect/tradeHelpers';
import { TradePickRow } from './TradePickRow';

export const OutgoingPicksList = ({
  team,
  picks,
  otherTeams = [],
  onTogglePick,
  onEditPick,
}) => (
  <div>
    <h4 className="text-sm text-white/70 mb-1">Outgoing Picks</h4>
    <div className="space-y-1 max-h-[375px] overflow-y-auto pr-1">
      {team.picks?.map((p) => {
        const pickObj = picks.find((pk) => areSamePick(pk, p));
        return (
          <TradePickRow
            key={`${p.year}-${p.round}-${p.via || ''}`}
            pick={p}
            pickObj={pickObj}
            teamId={team.id}
            otherTeams={otherTeams}
            onToggle={onTogglePick}
            onEdit={onEditPick}
          />
        );
      })}
      {team.picks?.length === 0 && (
        <div className="text-xs text-white/40">No picks available</div>
      )}
    </div>
  </div>
);
