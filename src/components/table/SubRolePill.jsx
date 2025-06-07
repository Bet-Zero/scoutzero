// SubRolePill.jsx
import React from 'react';

const SubRolePill = ({ label = '' }) => {
  return (
    <div className="w-[70px] h-[20px] rounded-full bg-[#2a2a2a] border border-[#444] flex items-center justify-center">
      <span className="text-[9px] text-white/60 scale-[0.85] origin-center text-center leading-none">
        {label}
      </span>
    </div>
  );
};

export default SubRolePill;
