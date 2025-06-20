// src/features/roster/RosterExportWrapper.jsx
import React from 'react';

const RosterExportWrapper = ({ children, isExport = false }) => {
  if (!isExport) return <>{children}</>;

  return (
    <div className="w-full overflow-auto p-4 bg-gradient-to-br from-[#1e1e1e] to-[#111] rounded-lg border border-neutral-700 shadow-sm">
      {children}
    </div>
  );
};

export default RosterExportWrapper;
