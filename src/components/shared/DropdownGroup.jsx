// src/components/shared/DropdownGroup.jsx

import React from 'react';

const DropdownGroup = ({ label, children }) => {
  return (
    <div className="mb-0">
      <label className="text-white text-xs block mb-1">{label}</label>
      {children}
    </div>
  );
};

export default DropdownGroup;
