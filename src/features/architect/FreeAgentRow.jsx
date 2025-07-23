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

  const height = player.bio?.HT || player.height || askInfo.height || '—';
  const weight = player.bio?.WT || player.weight || askInfo.weight || '—';
  const prevSalaryValue =
    askInfo.previousSalary ?? player.previousSalary ?? null;
  const prevSalary =
    prevSalaryValue != null ? `$${prevSalaryValue.toLocaleString()}` : 'N/A';

  const faType =
    askInfo.freeAgentType ||
    askInfo.fa_type ||
    player.free_agent_type ||
    player.fa_type ||
    'UFA';

  const getTagColor = (type) => {
    if (type === 'UFA') return 'bg-blue-500/30 text-white/70';
    if (type === 'RFA') return 'bg-red-600/30 text-white/70';
    if (type === 'PO') return 'bg-green-600/30 text-white/70';
    if (type === 'TO') return 'bg-orange-500/30 text-white/70';
    return 'bg-gray-600 text-white/70';
  };

  // Display the previous year's salary in place of the asking price
  const asking = prevSalary;

  const rights = askInfo.birdRights;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className={`w-full h-[45px] bg-neutral-800 rounded-sm flex items-center border border-black mb-[3px] pr-0 overflow-hidden hover:bg-neutral-700 cursor-pointer focus:outline-none ${
        isSelected ? 'ring-1 ring-lakers' : ''
      }`}
    >
      {/* Position */}
      <div className="w-[60px] flex items-center justify-center text-white/60 text-sm font-semibold">
        {position}
      </div>

      {/* Headshot */}
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

      {/* Name + Rights */}
      <div className="flex items-center ml-3 flex-1 justify-between mr-2">
        <div
          className="text-white font-anton font-bold uppercase tracking-normal leading-none whitespace-nowrap overflow-visible"
          style={{ fontSize: '17px', maxWidth: '300px' }}
        >
          {firstName}{' '}
          <span className="text-white/70 font-light">{lastName}</span>
        </div>
        <div className="flex items-center justify-end text-white/50 text-[13px] gap-2 whitespace-nowrap">
          <span>{rights}</span>
        </div>
      </div>

      {/* Aligned Stats Block */}
      <div className="flex items-center justify-end text-white/50 text-[13px] w-[290px] mr-3 whitespace-nowrap tabular-nums">
        {/* FA Type */}
        <span
          className={`w-[44px] text-center px-1.5 py-[2px] rounded text-[12px] font-semibold ${getTagColor(faType)}`}
        >
          {faType}
        </span>

        {/* Spacer between FA Type and Height/Weight */}
        <div className="ml-6 flex items-center gap-[8px]">
          <span className="w-[32px] text-right">{height}</span>
          <span className="text-white/30">|</span>
          <span className="w-[56px] text-left">
            {weight !== '—' ? `${weight} lbs` : weight}
          </span>
        </div>

        {/* Spacer between Height/Weight and Salary */}
        <span className="ml-10 w-[78px] text-right">{asking}</span>
      </div>
    </div>
  );
};

export default FreeAgentRow;
