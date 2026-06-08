import React from 'react';
import { TeamListFull } from '@/constants/teamList';

interface SelectTeamCardProps {
  onSelectTeam: (teamId: string) => void;
  onRemove?: (() => void) | null;
}

export const SelectTeamCard = ({
  onSelectTeam,
  onRemove,
}: SelectTeamCardProps) => (
  <div className="flex-1 border border-white/20 rounded-lg p-4 bg-[#111] relative shadow-inner">
    {onRemove && (
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 text-red-400 text-xs"
      >
        ✕
      </button>
    )}
    <label className="text-sm mb-1 block text-white/80">Select Team</label>
    <select
      className="w-full bg-[#111] text-white p-2 rounded text-sm"
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
        // TMUI-13: ignore the blank placeholder option
        if (e.target.value) onSelectTeam(e.target.value);
      }}
    >
      <option value="">Select Team</option>
      {TeamListFull.map((t) => (
        <option key={t.id} value={t.id}>
          {t.teamName}
        </option>
      ))}
    </select>
  </div>
);
