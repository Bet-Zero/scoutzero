import React from 'react';
import { ToggleButton } from '@/shared/components/ui/ToggleButton';

type ListRowStyleToggleProps = {
  compact: boolean;
  onChange: (value: boolean) => void;
};

export const ListRowStyleToggle = ({ compact, onChange }: ListRowStyleToggleProps) => {
  return (
    <div className="flex gap-2">
      <ToggleButton selected={!compact} onClick={() => onChange(false)}>
        Full Row
      </ToggleButton>
      <ToggleButton selected={compact} onClick={() => onChange(true)}>
        Compact Row
      </ToggleButton>
    </div>
  );
};

