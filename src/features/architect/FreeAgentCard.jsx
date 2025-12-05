import React from 'react';
import PropTypes from 'prop-types';
import { TeamCodeMap } from '@/constants/teamList';

const FreeAgentCard = ({ player, onSign, onRemove }) => {
  // Logic from FreeAgentRow to format name/headshot
  const formattedName = player.bio?.displayName || player.displayName || player.name || '';
  const nameParts = formattedName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const rawPosition = player.bio?.position || player.formattedPosition || '';
  // Simple mapping if utils not available, or just render raw.
  // Assuming getPlayerPositionLabel isn't strictly needed for the simplified card or we can key off raw.
  // Let's try to match row style but keep it simple.
  
  const formatHeight = (inches) => {
    if (!inches || inches === 0) return null;
    if (isNaN(inches)) return inches; 
    return `${Math.floor(inches / 12)}-${inches % 12}`;
  };

  const height =
    formatHeight(player.bio?.height) || player.height || '—';
  const weight = player.bio?.weight || player.weight || '—';

  const prevSalaryValue = player.previousSalary || player.askingSalary;
  const prevSalary =
    prevSalaryValue != null ? `$${prevSalaryValue.toLocaleString()}` : 'N/A';

  const rights = player.birdRights || 'None';

  return (
    <div className="w-[180px] bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden flex flex-col relative group hover:border-white/30 transition-colors">
      
      {/* Remove Button (top right) */}
      <button 
        onClick={(e) => {
            e.stopPropagation();
            onRemove(player);
        }}
        className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/50 hover:bg-red-500/80 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✕
      </button>

      {/* Headshot Area */}
      <div className="h-[140px] w-full bg-[#151515] relative flex items-end justify-center pt-2">
         {/* Team Logo Background/Overlay */}
         {player.teamCode && (
           <div className="absolute top-2 left-2 opacity-20 z-0">
             <img 
               src={`/assets/logos/${TeamCodeMap[player.teamCode]?.id || 'default'}.png`}
               className="h-8 w-8 object-contain"
               alt=""
             />
           </div>
         )}
         
         <img
          src={
            player.headshotUrl ||
            `/assets/headshots/${
              player.bio?.playerId ||
              player.id ||
              player.player_id ||
              (player.name || '')
                .toLowerCase()
                .replace(/['.]/g, '')
                .replace(/\s+/g, '_')
            }.png`
          }
          onError={(e) => {
            e.target.src = '/assets/headshots/default.png';
          }}
          alt={formattedName}
          className="h-full object-contain relative z-1" // simplistic fit
        />
        
        {/* Name Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8">
            <div className="font-anton font-bold uppercase text-white text-lg leading-none">
                {firstName} <span className="text-white/70 block">{lastName}</span>
            </div>
            <div className="text-[10px] text-white/60 font-mono mt-1 flex justify-between">
               <span>{rawPosition}</span>
               <span>{rights !== 'None' ? rights : ''}</span>
            </div>
        </div>
      </div>

      {/* Info Body */}
      <div className="p-3 bg-[#1a1a1a] flex-1 flex flex-col gap-2">
         <div className="flex justify-between items-center text-xs text-white/50 border-b border-white/5 pb-2">
            <span>{height} | {weight}lbs</span>
         </div>
         <div className="text-center py-1">
             <div className="text-[10px] uppercase text-white/40 font-semibold mb-0.5">Previous Salary</div>
             <div className="text-sm font-mono text-white/90">{prevSalary}</div>
         </div>
         
         <button
            onClick={() => onSign(player)}
            className="w-full mt-auto bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-wider py-2 rounded transition-colors"
         >
            Sign Player
         </button>
      </div>

    </div>
  );
};

FreeAgentCard.propTypes = {
  player: PropTypes.object.isRequired,
  onSign: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default FreeAgentCard;
