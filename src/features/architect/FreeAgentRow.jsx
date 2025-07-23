import React from 'react';
import { getPlayerPositionLabel } from '@/utils/roles';
import { formatName } from '@/utils/formatting';

const FreeAgentRow = ({
  player = {},
  askInfo = {},
  onSelect,
  isSelected = false,
}) => {
  const name = player.display_name || player.name || formatName(askInfo.name);
  const nameParts = name.split(' ');
  const firstName = nameParts[0]?.toUpperCase() || '';
  const lastName = nameParts.slice(1).join(' ').toUpperCase() || '';

  const rawPosition = player.bio?.Position || player.formattedPosition || '';
  const position = getPlayerPositionLabel(rawPosition) || '—';

  const asking =
    askInfo.askingSalary != null
      ? `$${askInfo.askingSalary.toLocaleString()}`
      : 'N/A';
  const rights = askInfo.birdRights;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className={`w-full h-[45px] bg-neutral-800 rounded-sm flex items-center border border-black mb-[3px] pr-0 overflow-hidden hover:bg-neutral-700 cursor-pointer focus:outline-none ${isSelected ? 'ring-1 ring-lakers' : ''}`}
    >
      <div className="h-[45px] w-[50px] bg-[#2a2a2a] flex items-center justify-center overflow-hidden rounded-sm">
        <img
          src={
            player.headshotUrl || `/assets/headshots/${player.player_id}.png`
          }
          onError={(e) => {
            e.target.src = '/assets/headshots/default.png';
          }}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex items-center ml-3 mr-4 flex-1 justify-between">
        <div
          className="text-white font-anton font-bold uppercase tracking-normal leading-none whitespace-nowrap overflow-visible"
          style={{ fontSize: '17px', maxWidth: '300px' }}
        >
          {firstName}{' '}
          <span className="text-white/70 font-light">{lastName}</span>
        </div>
        <div className="flex items-center justify-end text-white/50 text-[13px] w-[180px] gap-2 whitespace-nowrap">
          <span>{asking}</span>
          <span className="text-white/30">|</span>
          <span>{rights}</span>
        </div>
      </div>
      <div className="w-[70px] flex items-center justify-center text-white/60 text-sm font-semibold -mr-3">
        {position}
      </div>
    </div>
  );
};

export default FreeAgentRow;
