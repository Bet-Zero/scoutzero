// src/features/lists/ListExportToggle.jsx
import React from 'react';
import ToggleButton from '@/components/shared/ui/ToggleButton';

const ListExportToggle = ({ isExport, onChange }) => {
  return (
    <div className="flex gap-2">
      <ToggleButton selected={!isExport} onClick={() => onChange(false)}>
        Edit Mode
      </ToggleButton>
      <ToggleButton selected={isExport} onClick={() => onChange(true)}>
        Export View
      </ToggleButton>
    </div>
  );
};

export default ListExportToggle;
