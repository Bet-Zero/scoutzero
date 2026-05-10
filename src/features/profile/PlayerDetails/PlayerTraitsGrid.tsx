// components/PlayerTraitsGrid.tsx
import React from 'react';
import { NotebookText } from 'lucide-react';
import { TRAIT_ORDER, getTraitColor } from '@/constants/scoutingConstants';
import type { OpenProfileModal } from '../profileUiTypes';

export const PlayerTraitsGrid = ({
  traits,
  onTraitClick,
  setOpenModal,
}: {
  traits: Record<string, number>;
  onTraitClick: (event: React.MouseEvent<HTMLElement>, trait: string) => void;
  setOpenModal: OpenProfileModal;
}) => {
  return (
    <div
      className="bg-[#1f1f1f] rounded-2xl shadow-lg px-3 py-4 text-white text-sm font-medium flex flex-col gap-3 justify-center"
      style={{ width: '320px', height: '460px' }}
    >
      {TRAIT_ORDER.map((trait) => {
        const value = traits[trait];
        const isUngraded = typeof value !== 'number' || value <= 0;
        const color = isUngraded ? '#262626' : getTraitColor(value);
        const display = isUngraded ? '—' : value;
        const borderClass = isUngraded ? 'border border-black' : '';
        return (
          <div
            key={trait}
            className={`flex items-center justify-between text-base font-bold px-5 h-11 rounded-full cursor-pointer text-black transition-all ${borderClass}`}
            style={{
              backgroundColor: color,
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => onTraitClick(e, trait)}
          >
            <div className="flex items-center gap-2">
              <span>{trait}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // don’t trigger grading
                  setOpenModal(`trait_${trait}`);
                }}
                className="text-sm text-black hover:text-neutral-400"
                title={`Edit ${trait} breakdown`}
              >
                <NotebookText size={14} strokeWidth={1.25} />
              </button>
            </div>
            <span>{display}</span>
          </div>
        );
      })}
    </div>
  );
};

