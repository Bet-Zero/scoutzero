import React from 'react';

export const PlayerNavigation = ({
  onPrev,
  onNext,
  canGoPrev = true,
  canGoNext = true,
}: {
  onPrev: () => void;
  onNext: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
}) => (
  <div className="absolute top-6 right-6 flex gap-4" role="navigation" aria-label="Player navigation">
    <button
      className="px-4 py-2 text-black rounded-lg border border-black shadow"
      onClick={onPrev}
      disabled={!canGoPrev}
      aria-label="Previous player"
    >
      ◀
    </button>
    <button
      className="px-4 py-2 text-black rounded-lg border border-black shadow"
      onClick={onNext}
      disabled={!canGoNext}
      aria-label="Next player"
    >
      ▶
    </button>
  </div>
);
