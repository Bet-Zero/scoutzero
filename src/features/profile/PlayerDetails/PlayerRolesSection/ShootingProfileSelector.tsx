/**
 * FILE: src/features/profile/PlayerDetails/PlayerRolesSection/ShootingProfileSelector.tsx
 * PURPOSE: Shooting profile tier picker used in the player roles section.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-22: Phase 4 - Sourced tiers from shared constants to avoid drift
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-4/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import React, { useState, useEffect } from 'react';
import { shootingProfileTiers } from '@/shared/utils/roles';

const SHOOTING_TIER_STYLES: Record<string, { border: string; text: string }> = {
  Elite: { border: 'border-green-500', text: 'text-green-500' },
  Plus: { border: 'border-lime-400', text: 'text-lime-400' },
  Capable: { border: 'border-yellow-400', text: 'text-yellow-400' },
  Willing: { border: 'border-orange-400', text: 'text-orange-400' },
  Hesitant: { border: 'border-orange-600', text: 'text-orange-600' },
  Non: { border: 'border-red-600', text: 'text-red-600' },
};

export const ShootingProfileSelector = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const [selected, setSelected] = useState('');

  // Sync selection on prop change (e.g. when switching players)
  useEffect(() => {
    setSelected(value || '');
  }, [value]);

  const handleSelect = (label: string) => {
    setSelected(label);
    if (onChange) onChange(label);
  };

  return (
    <div className="flex justify-between gap-1 w-full max-w-[100%] mt-3 px-1">
      {shootingProfileTiers.map((label) => {
        const { border, text } = SHOOTING_TIER_STYLES[label] || {
          border: 'border-gray-500',
          text: 'text-gray-500',
        };
        const isSelected = selected === label;
        const classes = `
          flex-1 cursor-pointer text-xs font-bold py-2 px-1 rounded-md text-center transition-all border
          ${isSelected ? `${border} ${text}` : `border-gray-500 text-gray-500`}
          bg-transparent hover:bg-neutral-800
        `;

        return (
          <button
            key={label}
            type="button"
            onClick={() => handleSelect(label)}
            aria-pressed={isSelected}
            aria-label={`${label} shooting profile`}
            className={classes}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
