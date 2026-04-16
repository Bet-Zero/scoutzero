import React, { useMemo, useState } from 'react';
import TradePlayerRow from './TradePlayerRow';
import { getSalaryWithFallback } from '@/features/architect/utils/contractSalaryUtils';

type TradePlayerRowProps = Parameters<typeof TradePlayerRow>[0];
type PlayerLike = TradePlayerRowProps['player'];

type TeamLike = {
  players?: PlayerLike[];
};

type TeamOptionLike = NonNullable<TradePlayerRowProps['otherTeams']>[number];

interface OutgoingPlayersListProps {
  team: TeamLike;
  sends: PlayerLike[];
  incomingPlayers?: PlayerLike[];
  yearKey: string | number;
  worldId?: string | null;
  otherTeams?: TeamOptionLike[];
  playersMap?: Record<string, PlayerLike>;
  sourceTeamId?: string | null;
  sourceTeamCapHolds?: unknown[];
  onSetPlayerTrade?: (...args: unknown[]) => void;
  onRequestSignAndTrade?: (...args: unknown[]) => void;
  onUndoPlayerTrade?: (...args: unknown[]) => void;
  onEditContract?: ((player: PlayerLike) => void) | null;
  compact?: boolean;
}

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
  onEditContract,
  compact = false,
}: OutgoingPlayersListProps) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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

  const sortedAvailable = useMemo(() => {
    return available.slice().sort((a, b) => {
      const inA = incomingSet.has(a.id || a.player_id);
      const inB = incomingSet.has(b.id || b.player_id);
      if (inA && !inB) return -1;
      if (inB && !inA) return 1;

      const getSalary = (player: PlayerLike) =>
        Number(getSalaryWithFallback(player as never, yearKey as never)) || 0; // load-bearing: PlayerLike and yearKey types don't satisfy getSalaryWithFallback's expected param shapes
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
    </div>
  );
};
