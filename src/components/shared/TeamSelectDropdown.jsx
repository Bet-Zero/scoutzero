// TeamSelectDropdown.jsx

import React from 'react';
import { Listbox } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';
import TeamLogo from './TeamLogo';
import { TeamListFull } from '@/constants/teamList';
import { getTeamColors } from '@/utils/formatting';

const TeamSelectDropdown = ({ selectedTeamId, onChange }) => {
  const selectedTeam = TeamListFull.find((t) => t.id === selectedTeamId);
  const { primary: selectedColor } = getTeamColors(selectedTeamId) || {};

  return (
    <Listbox value={selectedTeamId} onChange={onChange}>
      <div className="relative w-[260px]">
        {/* Button */}
        <Listbox.Button className="group w-full flex items-center justify-between px-3 py-2 bg-[#111] rounded border border-transparent hover:border-white/20 transition text-left">
          {selectedTeam && (
            <>
              <div className="flex items-center gap-2">
                <TeamLogo
                  teamAbbr={selectedTeam.id}
                  className="w-6 h-6 shrink-0"
                />
                <span
                  className="text-[16px] font-semibold whitespace-nowrap"
                  style={{ color: selectedColor }}
                >
                  {selectedTeam.teamName}
                </span>
              </div>
              <ChevronUpDownIcon className="w-4 h-4 shrink-0 text-white/0 group-hover:text-white/30 transition" />
            </>
          )}
        </Listbox.Button>

        {/* Options */}
        <Listbox.Options className="absolute z-50 mt-2 w-full bg-[#1a1a1a] rounded border border-white/10 shadow-lg max-h-60 overflow-y-auto">
          {TeamListFull.map((team) => (
            <Listbox.Option
              key={team.id}
              value={team.id}
              className={({ active, selected }) =>
                `flex items-center gap-2 px-3 py-2 cursor-pointer ${
                  active ? 'bg-white/10' : ''
                } ${selected ? 'font-semibold text-white' : 'text-white/80'}`
              }
            >
              <TeamLogo teamAbbr={team.id} className="w-5 h-5 shrink-0" />
              <span className="text-sm whitespace-nowrap">{team.teamName}</span>
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </div>
    </Listbox>
  );
};

export default TeamSelectDropdown;
