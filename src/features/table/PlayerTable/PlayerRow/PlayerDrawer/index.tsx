import React from 'react';
import BadgeMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/BadgeMini';
import PlayerTraitsMiniGrid from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerTraitsMiniGrid';
import PlayerSubRolesMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerSubRolesMini';
import PlayerStatsMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerStatsMini';
import PlayerContractMini from '@/features/table/PlayerTable/PlayerRow/PlayerDrawer/PlayerContractMini';
import type { FilterablePlayer } from '@/shared/utils/filtering/playerFilterUtils';

const Divider = () => <div className="w-px h-auto bg-white/10 mx-3 my-1" />;

type PlayerDrawerProps = {
  player: FilterablePlayer;
};

const getFirstContract = (player: FilterablePlayer) =>
  player.contracts ? Object.values(player.contracts)[0] : undefined;

const PlayerDrawer = ({ player }: PlayerDrawerProps) => {
  const firstContract = getFirstContract(player);
  const contract = player.primaryContract || firstContract;
  const subRoles = player.subRoles ||
    player.subroles || { offense: [], defense: [] };

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
          <PlayerSubRolesMini subRoles={subRoles} />
          <Divider />
          <PlayerContractMini
            contract={contract}
            bird_rights={player.currentContractView?.birdRights?.status || 
              firstContract?.freeAgency?.birdRights || 'Unknown'}
            option_type={
              firstContract?.options?.[0] || null
            }
            free_agent_year={player.currentContractView?.freeAgentYear || 
              player.bio?.display?.freeAgentYear || 
              firstContract?.freeAgency?.freeAgentYear || null}
            free_agent_type={player.currentContractView?.freeAgentType || 
              player.bio?.display?.freeAgentType || 
              firstContract?.freeAgency?.freeAgentType || null}
            currentContractView={player.currentContractView}
          />
          <Divider />
          <PlayerStatsMini stats={player} />
          <Divider />
          <PlayerTraitsMiniGrid traits={player.traits || {}} />
        </div>
      </div>
    </div>
  );
};

export default PlayerDrawer;
