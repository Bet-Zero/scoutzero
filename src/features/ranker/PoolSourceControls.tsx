/**
 * FILE: src/features/ranker/PoolSourceControls.tsx
 * PURPOSE: Add a whole team or one of the user's lists to the ranker pool
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Extracted from RankingBuilder.tsx
 *  - 2026-10-23: Labelled pickers in the shared panel style
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TeamListFull } from '@/constants/teamList';
import type { OwnerPlayerList } from './hooks/useOwnerPlayerLists';
import { FieldLabel, RankerPanel, fieldClass } from './RankerPanel';

type PoolSourceControlsProps = {
  lists: OwnerPlayerList[];
  onAddTeam: (teamId: string) => void;
  onAddList: (listId: string) => void;
};

type SourcePickerProps = {
  id: string;
  label: string;
  ariaLabel: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  actionLabel: string;
  onPick: (value: string) => void;
};

// A select plus its add button; the button stays off until something is picked
const SourcePicker = ({
  id,
  label,
  ariaLabel,
  placeholder,
  options,
  actionLabel,
  onPick,
}: SourcePickerProps) => {
  const [value, setValue] = useState('');

  return (
    <div className="flex-1 min-w-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <select
            id={id}
            aria-label={ariaLabel}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={options.length === 0}
            className={`${fieldClass} w-full appearance-none pl-3 pr-8 py-2 cursor-pointer disabled:cursor-not-allowed disabled:text-white/35`}
          >
            <option value="" className="bg-[#1a1a1a] text-white/50">
              {placeholder}
            </option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-[#1a1a1a] text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
        </div>
        <button
          onClick={() => {
            onPick(value);
            setValue('');
          }}
          disabled={!value}
          className="px-4 py-2 text-sm rounded-lg bg-white/[0.1] hover:bg-white/[0.16] text-white font-medium disabled:bg-white/[0.04] disabled:text-white/30 disabled:cursor-not-allowed transition-colors"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

export const PoolSourceControls = ({
  lists,
  onAddTeam,
  onAddList,
}: PoolSourceControlsProps) => (
  <RankerPanel
    title="Quick add"
    description="Drop in a whole roster or one of your saved lists."
  >
    <div className="flex flex-col sm:flex-row gap-4">
      <SourcePicker
        id="ranker-add-team"
        label="Team roster"
        ariaLabel="Team"
        placeholder="Choose a team…"
        options={TeamListFull.map((team) => ({
          value: team.id,
          label: team.teamName,
        }))}
        actionLabel="Add"
        onPick={onAddTeam}
      />
      <SourcePicker
        id="ranker-add-list"
        label="Your lists"
        ariaLabel="List"
        placeholder={lists.length > 0 ? 'Choose a list…' : 'No saved lists'}
        options={lists.map((l) => ({ value: l.id, label: l.name }))}
        actionLabel="Import"
        onPick={onAddList}
      />
    </div>
  </RankerPanel>
);
