import React, { useState, useMemo } from 'react';
import TradePlayerRow from './TradePlayerRow';
import EditContractModal from '@/components/shared/EditContractModal';
import TradeExceptionModal from '@/components/shared/TradeExceptionModal';

const parseYear = (key) => {
  if (typeof key === 'number') return key;
  const match = String(key).match(/\d{4}/);
  return match ? parseInt(match[0], 10) : NaN;
};

export const OutgoingPlayersList = ({
  team,
  sends,
  incomingPlayers = [],
  yearKey,
  otherTeams = [],
  playersMap = {},
  onSetPlayerTrade,
  onUndoPlayerTrade,
  tradeExceptions = [],
}) => {
  const [openMenu, setOpenMenu] = useState(null);
  const [contractPlayer, setContractPlayer] = useState(null);
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

  // Memoized sorted list
  const sortedAvailable = useMemo(() => {
    return available.slice().sort((a, b) => {
      const inA = incomingSet.has(a.id || a.player_id);
      const inB = incomingSet.has(b.id || b.player_id);
      if (inA && !inB) return -1;
      if (inB && !inA) return 1;

      const yr = parseYear(yearKey);
      const getSalary = (player) =>
        player.contract_clean?.salaries_by_year?.[yearKey]?.salary ||
        player.contract?.annual_salaries?.find((s) => parseYear(s.year) === yr)
          ?.salary ||
        0;
      return getSalary(b) - getSalary(a);
    });
  }, [available, incomingSet, yearKey]);

  // Check if player can be traded using TPE
  const canUseTPE = (player) => {
    if (!tradeExceptions?.length) return false;
    const salary =
      player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;
    return tradeExceptions.some((tpe) => salary <= tpe.amount && !tpe.isUsed);
  };

  return (
    <div>
      <div className="space-y-1 max-h-[375px] overflow-y-auto pr-1">
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
            setContractPlayer={setContractPlayer}
            tradeExceptions={tradeExceptions}
          />
        ))}
        {available.length === 0 && (
          <div className="text-xs text-white/40">No players available</div>
        )}
      </div>

      {contractPlayer && (
        <EditContractModal
          player={contractPlayer}
          isOpen={!!contractPlayer}
          onClose={() => setContractPlayer(null)}
          onSave={(plr, values) => console.log('Save contract', plr, values)}
          onWaive={(plr) => console.log('Waive player', plr)}
          onOptionDecision={(plr, val) =>
            console.log('Option decision', plr, val)
          }
          onExtend={(plr, ext) => console.log('Extend', plr, ext)}
          onSignAndTrade={(plr, val) => console.log('S&T', plr, val)}
        />
      )}

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
