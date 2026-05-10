/**
 * Purpose: Team selector using Headless UI Listbox.
 * Inputs: teams, selectedTeamId, onChange, getTeamColors.
 * Outputs: Button + options with team logos/colors.
 * Risks: Blank state when undefined; long-name overflow; alias import portability.
 * Next TODO: Add placeholder; add truncate/ellipsis; confirm alias/ARIA labels.
 */
// TeamSelectDropdown.tsx

import React, { useMemo } from 'react';
import { Listbox } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { TeamLogo } from './TeamLogo';
import { TeamListFull } from '@/constants/teamList';
import { getTeamColors } from '@/shared/utils/formatting';

type TeamOption = (typeof TeamListFull)[number];
type TeamSelectValue = string;
type TeamSelectValueFormat = 'id' | 'teamCode';

type TeamSelectDropdownProps = {
  selectedTeamId?: TeamSelectValue | null;
  onChange?: (value: TeamSelectValue) => void;
  valueFormat?: TeamSelectValueFormat;
};

const resolveTeamByAnyIdentifier = (
  identifier: TeamSelectValue | null | undefined
): TeamOption | null => {
  if (!identifier) return null;
  const normalized = String(identifier).trim().toUpperCase();
  return (
    TeamListFull.find(
      (team) =>
        team.id === identifier ||
        team.code === identifier ||
        team.teamId === identifier
    ) ||
    TeamListFull.find(
      (team) =>
        team.code?.toUpperCase() === normalized ||
        team.teamId?.toUpperCase() === normalized
    ) ||
    null
  );
};

export const TeamSelectDropdown = ({
  selectedTeamId,
  onChange,
  valueFormat = 'id',
}: TeamSelectDropdownProps) => {
  const selectedTeam = useMemo(
    () => resolveTeamByAnyIdentifier(selectedTeamId),
    [selectedTeamId]
  );
  const optionValueFor = (team: TeamOption): TeamSelectValue =>
    valueFormat === 'teamCode' ? team.code : team.id;
  const selectedColorInput = selectedTeam?.id || selectedTeamId;
  const { primary: selectedColor } = getTeamColors(selectedColorInput) || {};
  const listboxValue = selectedTeamId ?? undefined;

  return (
    <Listbox value={listboxValue} onChange={onChange}>
      <div className="relative w-full max-w-[260px]">
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
                  className="text-[16px] font-semibold truncate"
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
          {TeamListFull.map((team: TeamOption) => (
            <Listbox.Option
              key={team.id}
              value={optionValueFor(team)}
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

