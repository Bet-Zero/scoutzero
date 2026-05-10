// src/features/lists/ListRankToggle.tsx
import React from 'react';
import { ToggleButton } from '@/shared/components/ui/ToggleButton';

type ListRankToggleProps = {
  isRanked: boolean;
  onChange: (value: boolean) => void;
};

export const ListRankToggle = ({ isRanked, onChange }: ListRankToggleProps) => {
  return (
    <div className="flex gap-2">
      <ToggleButton selected={!isRanked} onClick={() => onChange(false)}>
        Flat
      </ToggleButton>
      <ToggleButton selected={isRanked} onClick={() => onChange(true)}>
        Ranked
      </ToggleButton>
    </div>
  );
};

