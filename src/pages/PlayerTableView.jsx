import React from 'react';
import SiteLayout from '@/components/layout/SiteLayout';
import PlayerTable from '@/components/table/PlayerTable';

const PlayerTableView = () => {
  return (
    <SiteLayout>
      <div className="mt-2 mb-2 w-full max-w-[1100px] mx-auto" />
      <PlayerTable />
    </SiteLayout>
  );
};

export default PlayerTableView;
