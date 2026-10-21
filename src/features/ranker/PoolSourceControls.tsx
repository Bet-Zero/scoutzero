/**
 * FILE: src/features/ranker/PoolSourceControls.tsx
 * PURPOSE: Add a whole team or one of the user's lists to the ranker pool
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Extracted from RankingBuilder.tsx
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import React, { useState } from 'react';
import { TeamListFull } from '@/constants/teamList';
import type { OwnerPlayerList } from './hooks/useOwnerPlayerLists';

type PoolSourceControlsProps = {
  lists: OwnerPlayerList[];
  onAddTeam: (teamId: string) => void;
  onAddList: (listId: string) => void;
};

export const PoolSourceControls = ({
  lists,
  onAddTeam,
  onAddList,
}: PoolSourceControlsProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedList, setSelectedList] = useState('');

  return (
    <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.07] mb-5">
      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/35 block mb-4">
        Add to Pool
      </span>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* By Team */}
        <div className="flex gap-2 flex-1 min-w-0">
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="flex-1 min-w-0 appearance-none bg-white/[0.05] text-white text-sm px-3 py-2 rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/25 transition-all cursor-pointer"
          >
            <option value="" className="bg-[#1a1a1a] text-white/50">
              Team…
            </option>
            {TeamListFull.map((team) => (
              <option
                key={team.id}
                value={team.id}
                className="bg-[#1a1a1a] text-white"
              >
                {team.teamName}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
                onAddTeam(selectedTeamId);
                setSelectedTeamId('');
              }}
            disabled={!selectedTeamId}
            className="px-3 py-2 text-sm rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium"
          >
            Add
          </button>
        </div>

        {/* By List */}
        <div className="flex gap-2 flex-1 min-w-0">
          <select
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
            className="flex-1 min-w-0 appearance-none bg-white/[0.05] text-white text-sm px-3 py-2 rounded-lg border border-white/[0.1] focus:outline-none focus:border-white/25 transition-all cursor-pointer"
          >
            <option value="" className="bg-[#1a1a1a] text-white/50">
              List…
            </option>
            {lists.map((l) => (
              <option
                key={l.id}
                value={l.id}
                className="bg-[#1a1a1a] text-white"
              >
                {l.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
                onAddList(selectedList);
                setSelectedList('');
              }}
            disabled={!selectedList}
            className="px-3 py-2 text-sm rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};
