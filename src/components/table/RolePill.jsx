// RolePill.jsx
import React from 'react';

const RolePill = ({
  label = '',
  colorClass = 'border-white text-white',
  bgClass = 'bg-[#333]',
}) => {
  return (
    <div
      className={`w-[80px] h-[24px] rounded-full border ${colorClass} ${bgClass} flex items-center justify-center`}
    >
      <span className="text-[10px] font-semibold tracking-wide scale-[0.85] origin-center text-center leading-none">
        {label.toUpperCase()}
      </span>
    </div>
  );
};

export default RolePill;
