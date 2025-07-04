import React from 'react';
import ToggleButton from '@/components/shared/ui/ToggleButton';

const ListRowStyleToggle = ({ compact, onChange }) => {
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

export default ListRowStyleToggle;
