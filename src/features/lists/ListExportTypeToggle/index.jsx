// src/features/lists/ListExportTypeToggle.jsx
import React from 'react';
import ToggleButton from '@/components/shared/ui/ToggleButton';

const ListExportTypeToggle = ({ exportType, onChange }) => {
  return (
    <div className="flex gap-2">
      <ToggleButton
        selected={exportType === 'list'}
        onClick={() => onChange('list')}
      >
        List Style
      </ToggleButton>
      <ToggleButton
        selected={exportType === 'tier'}
        onClick={() => onChange('tier')}
      >
        Tier Style
      </ToggleButton>
    </div>
  );
};

export default ListExportTypeToggle;
