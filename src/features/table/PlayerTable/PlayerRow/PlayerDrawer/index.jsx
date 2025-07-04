import React from 'react';
import BadgeMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/BadgeMini';
import OverallBlurbMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/OverallBlurbMini';
import PlayerTraitsMiniGrid from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerTraitsMiniGrid';
import PlayerSubRolesMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerSubRolesMini';
import PlayerStatsMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerStatsMini';
import PlayerContractMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerContractMini';

const Divider = () => <div className="w-px h-auto bg-white/10 mx-3 my-1" />;

const PlayerDrawer = ({ player }) => {
  return (
    <div className="w-full bg-[#111] border-t border-white/10 py-3">
      <div className="flex w-full gap-2">
        {/* LEFT SIDE: Full left column container */}
        <div className="flex flex-col gap-2 ml-0 pr-2 items-start">
          <div className="-mt-3">
            <BadgeMini badges={player.badges || []} />
          </div>

          {/* TODO: Uncomment when overall blurbs are live */}
          {/* <div className="ml-5 mt-1">
            <OverallBlurbMini text={player.blurbs?.overall || ""} />
          </div> */}
        </div>

        {/* RIGHT SIDE: Drawer content */}
        <div className="flex flex-nowrap -mr-[2px] gap-0 w-full justify-end overflow-x-auto">
          <PlayerSubRolesMini
            subRoles={player.subRoles || player.subroles || {}}
          />
          <Divider />
          <PlayerContractMini
            contract={player.contract || {}}
            bird_rights={player.bird_rights || 'Unknown'}
            option_type={
              player.contract?.extension?.options?.[0] ||
              player.contract?.options?.[0] ||
              null
            }
            free_agent_year={player.free_agency_year} // Add this
            free_agent_type={player.free_agent_type} // Add this
          />
          <Divider />
          <PlayerStatsMini stats={player.system?.stats} />
          <Divider />
          <PlayerTraitsMiniGrid traits={player.traits || {}} />
        </div>
      </div>
    </div>
  );
};

export default PlayerDrawer;
