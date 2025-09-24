/**
 * Purpose: Floating button to open the drawer.
 * Inputs: onClick, title/label, className.
 * Outputs: Accessible button with hover/transition styles.
 * Risks: None known.
 * Next TODO: Monitor hit target sizing with future icon changes.
*/
import React from 'react';

const OpenDrawerButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="fixed left-0 top-1/2 -translate-y-1/2 z-30 bg-neutral-800 hover:bg-neutral-600 text-white shadow-lg transition-transform duration-200 hover:translate-x-1 group rounded-r-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 min-w-[44px] min-h-[44px]"
    title="Open player drawer"
    aria-label="Open player drawer"
    type="button"
  >
    <div className="flex flex-col items-center py-3 px-2 gap-2">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-80"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  </button>
);

export default OpenDrawerButton;
