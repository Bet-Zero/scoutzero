// components/LayoutPreview/TwoWayMeter.jsx
import React from 'react';

const TwoWayMeter = ({ twoWayValue, onChange }) => {
  return (
    <div className="mt-3">
      <div
        className="relative w-full h-5 rounded-full cursor-pointer"
        style={{
          background: 'linear-gradient(to right, #3b82f6, white, #9333ea)',
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const percentage = Math.round((clickX / rect.width) * 100);
          onChange(percentage);
        }}
      >
        <div
          className="absolute top-[-6px] w-[6px] h-[31px] bg-white border border-gray-700 rounded-sm"
          style={{ left: `${twoWayValue}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-xs text-white font-medium mt-1">
        <span>Defense</span>
        <span>Offense</span>
      </div>
    </div>
  );
};

export default React.memo(TwoWayMeter);
