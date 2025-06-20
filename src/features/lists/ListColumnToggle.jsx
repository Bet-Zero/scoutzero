// src/features/lists/ListColumnToggle.jsx
import React from 'react';
import ToggleButton from '@/components/shared/ui/ToggleButton';

const ListColumnToggle = ({ twoColumn, onChange }) => {
  return (
    <div className="flex gap-2">
      <ToggleButton selected={!twoColumn} onClick={() => onChange(false)}>
        Single Column
      </ToggleButton>
      <ToggleButton selected={twoColumn} onClick={() => onChange(true)}>
        Two Columns
      </ToggleButton>
    </div>
  );
};

export default ListColumnToggle;
