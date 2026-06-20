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
  <div className="z-10 flex gap-4 md:absolute md:right-6 md:top-6" role="navigation" aria-label="Player navigation">
    <button
      className="rounded-lg border border-white/30 bg-neutral-800 px-4 py-2 text-white shadow transition-colors hover:bg-neutral-700 disabled:border-white/10 disabled:bg-neutral-900 disabled:text-white/30"
      onClick={onPrev}
      disabled={!canGoPrev}
      aria-label="Previous player"
    >
      ◀
    </button>
    <button
      className="rounded-lg border border-white/30 bg-neutral-800 px-4 py-2 text-white shadow transition-colors hover:bg-neutral-700 disabled:border-white/10 disabled:bg-neutral-900 disabled:text-white/30"
      onClick={onNext}
      disabled={!canGoNext}
      aria-label="Next player"
    >
      ▶
    </button>
  </div>
);
