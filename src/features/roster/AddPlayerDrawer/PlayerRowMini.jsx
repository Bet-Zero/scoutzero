// src/components/roster/PlayerRowMini.jsx
import React, { useState } from 'react';
import PlayerNameMini from '@/features/table/PlayerTable/PlayerRow/PlayerNameMini';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getPlayerPositionLabel } from '@/utils/roles';
import { formatSalary } from '@/utils/formatting';

const PlayerRowMini = ({ player, onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const name = player.display_name || player.name || 'Unknown Player';
  const headshot = player.headshot || `/assets/headshots/${player.id}.png`;

  const rawPosition = player.bio?.Position || '—';
  const position = getPlayerPositionLabel(rawPosition);

  const height = player.bio?.HT || '—';
  const weight = player.bio?.WT || '—';
  const currentYearSalary = player.contract?.annual_salaries?.find(
    (s) => s.year === 2025
  )?.salary;
  const formattedSalary = formatSalary(currentYearSalary);
  const rightSideValue =
    formattedSalary !== '—' ? formattedSalary : player.free_agent_type || '—';

  const handleChevronClick = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="relative mb-2">
      <button
        onClick={onClick}
        className="w-full flex items-center bg-[#2a2a2a] hover:bg-[#333] text-white px-3 py-[6px] rounded-md transition h-[58px]"
      >
        {/* Headshot */}
        <div className="h-[58px] w-[56px] -ml-0.5 bg-[#1e1e1e] overflow-hidden">
          <img
            src={headshot}
            onError={(e) => {
              e.target.src = '/assets/headshots/default.png';
            }}
            alt={name}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Name + Team Info */}
        <div className="ml-3 flex flex-col justify-center w-[140px] mb-5 mr-7">
          <div className="h-[34px] leading-tight">
            <PlayerNameMini name={name} />
          </div>
        </div>

        {/* Position Label */}
        <div className="h-full w-10 flex items-center justify-center text-md text-white/40 font-semibold uppercase tracking-wide -mr-2">
          {position}
        </div>

        {/* Chevron Icon – now using <div role="button"> to avoid nesting inside button */}
        <div
          role="button"
          onClick={handleChevronClick}
          className="absolute bottom-1 right-2 p-1 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
        >
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </button>
      {/* Expandable Info Drawer */}
      {isExpanded && (
        <div className="bg-[#1a1a1a] border-l border-r border-b border-white/10 rounded-t-none rounded-b-md mx-1 mb-1 px-3 py-1">
          <div className="flex justify-between items-center">
            <div className="text-xs text-white/70 tracking-wide">
              {height} <span className="text-white/30">|</span> {weight}
            </div>
            <div className="text-xs">
              <span className="text-white/30">Salary: </span>
              <span className="text-white/70">{rightSideValue}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerRowMini;
