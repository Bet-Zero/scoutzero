import { TieramidPlayerTile } from '@/features/tierMaker/TieramidPlayerTile';
import type { TieramidBoardPlayer } from './utils/tieramidHelpers';

type TieramidPoolProps = {
  players: TieramidBoardPlayer[];
  onPlace: (player: TieramidBoardPlayer) => void;
};

export function TieramidPool({ players, onPlace }: TieramidPoolProps) {
  const visible = players.filter(Boolean);
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2 bg-neutral-900 p-4 rounded-lg border border-white/10 min-h-[100px]">
        <span className="text-white/60 font-bold mr-4 self-start">Pool</span>
        {visible.length > 0 ? (
          visible.map((p, idx) => (
            <div key={p.player_id || p.id || idx} className="relative">
              <TieramidPlayerTile player={p} />
              <button
                onClick={() => onPlace(p)}
                className="absolute top-1 left-1 px-1 py-0.5 bg-blue-700 text-xs rounded text-white"
              >
                Place
              </button>
            </div>
          ))
        ) : (
          <span className="text-white/40">No players</span>
        )}
      </div>
    </div>
  );
}
