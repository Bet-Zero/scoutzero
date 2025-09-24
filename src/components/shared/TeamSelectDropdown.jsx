/**
 * Purpose: Team selector using Headless UI Listbox.
 * Inputs: teams, selectedTeamId, onChange, getTeamColors.
 * Outputs: Button + options with team logos/colors.
 * Risks: None known.
 * Next TODO: Confirm alias portability with tooling.
*/
// TeamSelectDropdown.jsx

import React from 'react';
import { Listbox } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';
import TeamLogo from './TeamLogo';
import { TeamListFull } from '@/constants/teamList';
import { getTeamColors } from '@/utils/formatting';

const placeholderLabel = 'Select a team';

const TeamSelectDropdown = ({ selectedTeamId, onChange, buttonLabel = 'Team' }) => {
  const selectedTeam = TeamListFull.find((t) => t.id === selectedTeamId);
  const { primary: selectedColor } = getTeamColors(selectedTeamId) || {};

  return (
    <Listbox value={selectedTeamId} onChange={onChange} aria-label={buttonLabel}>
      <div className="relative w-[260px]">
        {/* Button */}
        <Listbox.Button className="group w-full flex items-center justify-between px-3 py-2 bg-[#111] rounded border border-transparent hover:border-white/20 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40" type="button">
          <div className="flex items-center gap-2 min-w-0">
            {selectedTeam ? (
              <>
                <TeamLogo
                  teamAbbr={selectedTeam.id}
                  className="w-6 h-6 shrink-0"
                />
                <span
                  className="text-[16px] font-semibold truncate"
                  style={{ color: selectedColor }}
                  title={selectedTeam.teamName}
                >
                  {selectedTeam.teamName}
                </span>
              </>
            ) : (
              <span className="text-sm text-white/60 truncate" title={placeholderLabel}>
                {placeholderLabel}
              </span>
            )}
          </div>
          <ChevronUpDownIcon className="w-4 h-4 shrink-0 text-white/40" aria-hidden="true" />
        </Listbox.Button>

        {/* Options */}
        <Listbox.Options className="absolute z-50 mt-2 w-full bg-[#1a1a1a] rounded border border-white/10 shadow-lg max-h-60 overflow-y-auto focus:outline-none">
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
              <span className="text-sm truncate" title={team.teamName}>
                {team.teamName}
              </span>
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </div>
    </Listbox>
  );
};

export default TeamSelectDropdown;
