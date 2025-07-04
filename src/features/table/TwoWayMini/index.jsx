import React from 'react';

const TwoWayMini = ({ rating = 0, orientation = 'BALANCED' }) => {
  return (
    <div className="relative flex items-center justify-center mr-4 w-24">
      {/* Meter bar (centered visual focus) */}
      <div
        className="w-full h-4 rounded-full relative overflow-hidden"
        style={{
          background: 'linear-gradient(to right, #3b82f6, white, #9333ea)',
        }}
      >
        <div
          className="absolute top-[-5px] w-[6px] h-[26px] bg-white border border-gray-700 rounded-sm"
          style={{
            left: `${rating}%`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      {/* Floating title label */}
      <span className="absolute -top-5 text-[10px] text-gray-400 uppercase tracking-wide">
        Two-Way
      </span>

      {/* Legend */}
      <div className="absolute -bottom-5 flex justify-between w-full px-1 text-[9px] text-gray-400">
        <span>DEF</span>
        <span>OFF</span>
      </div>
    </div>
  );
};

export default TwoWayMini;
