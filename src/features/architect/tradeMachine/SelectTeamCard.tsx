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
  <div className="flex-1 border border-cockpit-edge rounded-lg p-4 bg-cockpit-slab relative shadow-cockpit-slab">
    {onRemove && (
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 text-cockpit-text-muted hover:text-cockpit-text-primary text-xs"
      >
        ✕
      </button>
    )}
    <label className="text-sm mb-1 block text-cockpit-text-secondary">Select Team</label>
    <select
      className="w-full bg-cockpit-inlay text-cockpit-text-primary p-2 rounded-md text-sm border border-cockpit-edge"
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
