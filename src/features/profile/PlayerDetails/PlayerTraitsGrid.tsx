// components/PlayerTraitsGrid.tsx
import React from 'react';
import { NotebookText } from 'lucide-react';
import { TRAIT_ORDER, getTraitColor } from '@/constants/scoutingConstants';
import type { OpenProfileModal } from '../profileUiTypes';

const getTraitContrastClasses = (backgroundColor: string) => {
  const hex = backgroundColor.replace('#', '');
  const value = Number.parseInt(hex, 16);

  if (!Number.isFinite(value) || hex.length !== 6) {
    return {
      text: 'text-white',
      icon: 'text-white/80 hover:text-white',
    };
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
  const useDarkText = yiq >= 150;

  return useDarkText
    ? {
        text: 'text-black',
        icon: 'text-black hover:text-neutral-700',
      }
    : {
        text: 'text-white',
        icon: 'text-white/80 hover:text-white',
      };
};

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
      className="flex min-h-[460px] w-full flex-col justify-center gap-3 rounded-2xl bg-[#1f1f1f] px-3 py-4 text-sm font-medium text-white shadow-lg md:h-[460px] md:w-[320px]"
    >
      {TRAIT_ORDER.map((trait) => {
        const value = traits[trait];
        const isUngraded = typeof value !== 'number' || value <= 0;
        const color = isUngraded ? '#262626' : getTraitColor(value);
        const display = isUngraded ? '—' : value;
        const borderClass = isUngraded ? 'border border-black' : '';
        const contrastClasses = getTraitContrastClasses(color);
        return (
          <div
            key={trait}
            className={`flex h-11 cursor-pointer items-center justify-between rounded-full px-5 text-base font-bold transition-all ${contrastClasses.text} ${borderClass}`}
            style={{
              backgroundColor: color,
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => onTraitClick(e, trait)}
          >
            <div className="flex items-center gap-2">
              <span>{trait}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // don’t trigger grading
                  setOpenModal(`trait_${trait}`);
                }}
                className={`text-sm ${contrastClasses.icon}`}
                aria-label={`Edit ${trait} breakdown`}
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
