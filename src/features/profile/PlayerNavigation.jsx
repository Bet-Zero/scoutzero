import React from 'react';

const PlayerNavigation = ({ onPrev, onNext }) => (
  <div className="absolute top-6 right-6 flex gap-4">
    <button
      className="px-4 py-2 text-black rounded-lg border border-black shadow"
      onClick={onPrev}
    >
      ◀
    </button>
    <button
      className="px-4 py-2 text-black rounded-lg border border-black shadow"
      onClick={onNext}
    >
      ▶
    </button>
  </div>
);

export default PlayerNavigation;
