import React from 'react';
import { PlayerTable } from '@/features/table/PlayerTable';

/**
 * PlayerTableView - Route wrapper for the Player Database (virtualized table)
 *
 * IMPORTANT: This wrapper must maintain flex-1 + min-h-0 + overflow-hidden
 * for the height chain to work with react-virtualized-auto-sizer.
 * Without min-h-0, flex children may not constrain height properly.
 */
const PlayerTableView = () => {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
      <PlayerTable />
    </div>
  );
};

export default PlayerTableView;
