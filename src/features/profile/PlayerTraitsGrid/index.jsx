// components/PlayerTraitsGrid.jsx
import React from 'react';
import { NotebookText } from 'lucide-react';

const TRAIT_ORDER = [
  'Shooting',
  'Passing',
  'Playmaking',
  'Rebounding',
  'Defense',
  'IQ',
  'Feel',
  'Energy',
];

const getTraitColor = (rating) => {
  if (rating >= 98) return '#13895b';
  if (rating >= 94) return '#369972';
  if (rating >= 91) return '#55b48f';
  if (rating >= 86) return '#6cbd9d';
  if (rating >= 80) return '#8bc8b0';
  if (rating >= 73) return '#bce6df';
  if (rating >= 66) return '#d9efe6';
  if (rating >= 56) return '#efd9d9';
  if (rating >= 46) return '#e6bcbc';
  if (rating >= 41) return '#c88b8b';
  if (rating >= 36) return '#bd6c6c';
  if (rating >= 26) return '#b45555';
  if (rating >= 16) return '#993636';
  return '#891313';
};

const PlayerTraitsGrid = ({ traits, onTraitClick, setOpenModal }) => {
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

export default React.memo(PlayerTraitsGrid);
