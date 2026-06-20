// components/LayoutPreview/TwoWayMeter.tsx
import React from 'react';

export const TwoWayMeter = ({
  twoWayValue,
  onChange,
}: {
  twoWayValue: number;
  onChange: (value: number) => void;
}) => {
  const clamp = (value: number) => Math.min(100, Math.max(0, value));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keyChanges: Record<string, number> = {
      ArrowLeft: -5,
      ArrowDown: -5,
      ArrowRight: 5,
      ArrowUp: 5,
      PageDown: -10,
      PageUp: 10,
    };

    if (event.key === 'Home') {
      event.preventDefault();
      onChange(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      onChange(100);
      return;
    }

    const delta = keyChanges[event.key];
    if (typeof delta !== 'number') return;

    event.preventDefault();
    onChange(clamp(twoWayValue + delta));
  };

  return (
    <div className="mt-3">
      <div
        className="relative w-full h-5 rounded-full cursor-pointer"
        role="slider"
        tabIndex={0}
        aria-label="Two-way meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={twoWayValue}
        aria-valuetext={`${twoWayValue}% offense`}
        onKeyDown={handleKeyDown}
        style={{
          background: 'linear-gradient(to right, #3b82f6, white, #9333ea)',
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const percentage = clamp(Math.round((clickX / rect.width) * 100));
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
