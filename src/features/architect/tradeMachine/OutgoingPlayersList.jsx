import React, { useState } from 'react';
import { formatSalary } from '@/utils/formatting';

export const OutgoingPlayersList = ({
  team,
  sends,
  yearKey,
  otherTeamNames = [],
  onSetPlayerTrade,
}) => {
  const [openMenu, setOpenMenu] = useState(null);

  return (
    <div>
      <h4 className="text-sm text-white/70 mb-1">Outgoing Players</h4>
      <div className="space-y-1">
        {team.players?.map((p) => {
          const included = sends.includes(p);
          const salary = p.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;
          return (
            <div
              key={p.id || p.name}
              className={`flex items-center px-3 py-1 rounded-md text-sm transition-colors ${
                included ? 'bg-green-800/40' : 'bg-white/10'
              }`}
            >
              <span className="flex-1">{p.name}</span>
              <span className="w-20 text-right text-white/70">{formatSalary(salary)}</span>
              <div className="flex items-center gap-2 ml-3 relative">
                <button
                  onClick={() => setOpenMenu(openMenu === p.name ? null : p.name)}
                  className="text-xs text-blue-400 hover:underline"
                >
                  •••
                </button>
                {openMenu === p.name && (
                  <div className="absolute right-0 top-5 bg-[#222] border border-white/20 rounded z-20 text-xs min-w-[8rem]">
                    {otherTeamNames.map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          onSetPlayerTrade(p, included ? 'keep' : 'trade');
                          setOpenMenu(null);
                        }}
                        className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                      >
                        {`Trade to ${n}`}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        console.log('Modify contract', p.name);
                        setOpenMenu(null);
                      }}
                      className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                    >
                      Modify Contract
                    </button>
                    <button
                      onClick={() => {
                        window.location.href = `/profiles?player=${p.id || p.player_id}`;
                      }}
                      className="block w-full text-left px-3 py-1 hover:bg-[#333]"
                    >
                      View Profile
                    </button>
                  </div>
                )}
                {included && (
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!!p.signAndTrade}
                      onChange={() => onSetPlayerTrade(p, 'signAndTrade', !p.signAndTrade)}
                    />
                    S&T
                  </label>
                )}
              </div>
            </div>
          );
        })}
        {team.players?.length === 0 && (
          <div className="text-xs text-white/40">No players available</div>
        )}
      </div>
    </div>
  );
};

