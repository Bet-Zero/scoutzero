// src/features/roster/RosterSection/EmptySlot.tsx
import React from 'react';

// EmptySlot – Displays a plus sign button to add a player to a given slot
type EmptySlotSize = 'starter' | 'rotation' | 'bench';

type EmptySlotProps = {
  onAdd: () => void;
  size?: EmptySlotSize;
};

const EmptySlot = ({ onAdd, size = 'starter' }: EmptySlotProps) => {
  const sizeClasses = {
    starter: 'w-40 h-44 text-3xl',
    rotation: 'w-32 h-36 text-2xl',
    bench: 'w-28 h-32 text-xl',
  };

  return (
    <div
      className={`flex items-center justify-center bg-[#1a1a1a] border border-white/10 rounded-md text-white/30 hover:text-white/80 cursor-pointer ${sizeClasses[size]}`}
      onClick={onAdd}
    >
      +
    </div>
  );
};

export default EmptySlot;
