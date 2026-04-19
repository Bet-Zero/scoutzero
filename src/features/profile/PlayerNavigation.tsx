import React from 'react';

const PlayerNavigation = ({ onPrev, onNext }) => (
  <div className="absolute top-6 right-6 flex gap-4" role="navigation" aria-label="Player navigation">
    <button
      className="px-4 py-2 text-black rounded-lg border border-black shadow"
      onClick={onPrev}
      aria-label="Previous player"
    >
      ◀
    </button>
    <button
      className="px-4 py-2 text-black rounded-lg border border-black shadow"
      onClick={onNext}
      aria-label="Next player"
    >
      ▶
    </button>
  </div>
);

export default PlayerNavigation;
