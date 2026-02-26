import React, { useState, useMemo } from 'react';
import TradePlayerRow from './TradePlayerRow';
import TradeExceptionModal from '@/shared/components/TradeExceptionModal';
import { getSalaryWithFallback } from '@/features/architect/utils/contractSalaryUtils';

export const OutgoingPlayersList = ({
  team,
  sends,
  incomingPlayers = [],
  yearKey,
  worldId = null,
  otherTeams = [],
  playersMap = {},
  sourceTeamId = null,
  sourceTeamCapHolds = [],
  onSetPlayerTrade,
  onRequestSignAndTrade,
  onUndoPlayerTrade,
  tradeExceptions = [],
  onEditContract,
  compact = false,
}) => {
  const [openMenu, setOpenMenu] = useState(null);
  const [tpePlayer, setTpePlayer] = useState(null);

  // Memoized available players list
  const available = useMemo(
    () => [
      ...incomingPlayers,
      ...(team.players || []).filter(
        (p) =>
          !sends.some((s) => (s.id || s.player_id) === (p.id || p.player_id))
      ),
    ],
    [team.players, sends, incomingPlayers]
  );

  const incomingSet = useMemo(
    () => new Set(incomingPlayers.map((p) => p.id || p.player_id)),
    [incomingPlayers]
  );

  const signAndTradeActive = useMemo(
    () => sends.some((p) => p.signAndTrade),
    [sends]
  );

  // Memoized sorted list
  const sortedAvailable = useMemo(() => {
    return available.slice().sort((a, b) => {
      const inA = incomingSet.has(a.id || a.player_id);
      const inB = incomingSet.has(b.id || b.player_id);
      if (inA && !inB) return -1;
      if (inB && !inA) return 1;

      const getSalary = (player) => getSalaryWithFallback(player, yearKey);
      return getSalary(b) - getSalary(a);
    });
  }, [available, incomingSet, yearKey]);

  return (
    <div>
      <div className="space-y-1 max-h-[375px] overflow-y-auto pr-1 pb-28">
        {sortedAvailable.map((p) => (
          <TradePlayerRow
            key={p.id || p.name}
            player={p}
            included={sends.some(
              (s) => (s.id || s.player_id) === (p.id || p.player_id)
            )}
            incoming={incomingSet.has(p.id || p.player_id)}
            yearKey={yearKey}
            otherTeams={otherTeams}
            playersMap={playersMap}
            onSetPlayerTrade={onSetPlayerTrade}
            onUndoPlayerTrade={onUndoPlayerTrade}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            setContractPlayer={onEditContract}
            tradeExceptions={tradeExceptions}
            signAndTradeActive={signAndTradeActive}
            sourceTeamId={sourceTeamId}
            sourceTeamCapHolds={sourceTeamCapHolds}
            worldId={worldId}
            onRequestSignAndTrade={onRequestSignAndTrade}
            compact={compact}
          />
        ))}
        {available.length === 0 && (
          <div className="text-xs text-white/40">No players available</div>
        )}
      </div>



      {tpePlayer && (
        <TradeExceptionModal
          player={tpePlayer}
          isOpen={!!tpePlayer}
          onClose={() => setTpePlayer(null)}
          tradeExceptions={tradeExceptions}
          yearKey={yearKey}
          onApply={(plr, tpe) => {
            onSetPlayerTrade(plr, 'tradeException', null, tpe);
            setTpePlayer(null);
          }}
        />
      )}
    </div>
  );
};
