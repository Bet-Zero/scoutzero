import React, { useState } from 'react';
import ComparisonMatrix from './ComparisonMatrix';

const ComparisonMatrixDrawer = ({ players, comparisons }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-2 right-2 z-30 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white"
          title="Show comparison matrix"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </button>
      )}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-200 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="relative bg-[#1a1a1a] border-t border-white/10 max-h-[50vh] overflow-auto">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 p-1 text-white/60 hover:text-white"
            title="Hide comparison matrix"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <ComparisonMatrix
            players={players}
            comparisons={comparisons}
            className="mt-0"
          />
        </div>
      </div>
    </>
  );
};

export default ComparisonMatrixDrawer;
