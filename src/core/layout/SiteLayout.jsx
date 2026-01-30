/**
 * FILE: src/core/layout/SiteLayout.jsx
 * PURPOSE: Site-wide layout with header navigation and conditional scroll handling.
 *
 * OWNERSHIP: Core: layout
 *
 * HISTORY:
 *  - 2026-01-28: Fixed scroll handling - main element no longer uses overflow-hidden globally
 *  - Previous: Had overflow-hidden on main which prevented scrolling on non-virtualized pages
 *
 * LINKS:
 *  - Return Package: docs/return_packages/scouting/SCOUTING_PLAYER_TABLE_HOTFIX_AUTOSIZER_MEASUREMENT_RP.md
 */
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ChevronDown } from 'lucide-react';

const NavGroup = ({ label, children, align = 'left' }) => {
  let alignmentClass = 'left-0';
  if (align === 'center') alignmentClass = 'left-1/2 -translate-x-1/2';
  if (align === 'right') alignmentClass = 'right-0';

  return (
    <div className="relative group">
      <div className="inline-flex items-center gap-1 cursor-pointer hover:text-white text-white/60">
        <span>{label}</span>
        <ChevronDown
          size={14}
          className="mt-[1px] text-white/60 group-hover:text-white"
        />
      </div>

      <div className="absolute top-full h-4 w-full" />

      <div
        className={`absolute hidden group-hover:flex flex-col mt-2 bg-[#1c1c1c] border border-white/10 rounded shadow-lg text-sm text-white/80 min-w-[160px] p-2 z-[10000] ${alignmentClass}`}
      >
        {children}
      </div>
    </div>
  );
};

const SiteLayout = () => {
  const location = useLocation();

  // Pages that contain react-window/AutoSizer virtualization MUST NOT live inside overflow-y-auto ancestors.
  const isVirtualizedRoute = location.pathname.startsWith('/players');

  return (
    <div className="h-screen bg-neutral-900 text-white flex flex-col">
      <header className="bg-[#121212] border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0 z-[9999] relative">
        <div className="text-2xl font-bold tracking-tight text-white">
          🏀 HoopZero
        </div>

        <nav className="flex gap-6 text-sm text-white/60 items-center">
          <Link to="/profiles" className="hover:text-white">
            Player Profiles
          </Link>
          <Link to="/players" className="hover:text-white">
            Players
          </Link>

          <NavGroup label="Tools" align="center">
            <Link to="/roster" className="hover:text-white py-1 px-2">
              Roster Builder
            </Link>
            <Link to="/tier-maker" className="hover:text-white py-1 px-2">
              Tier Maker
            </Link>
            <Link to="/gm" className="hover:text-white py-1 px-2">
              GM Tools
            </Link>
          </NavGroup>

          <NavGroup label="Saved" align="right">
            <Link to="/rosters" className="hover:text-white py-1 px-2">
              Rosters
            </Link>
            <Link to="/lists" className="hover:text-white py-1 px-2">
              Lists
            </Link>
            <Link to="/tier-lists" className="hover:text-white py-1 px-2">
              Tiers
            </Link>
          </NavGroup>
        </nav>
      </header>

      {/* 
        SCROLL HANDLING STRATEGY:
        - main: Uses flex-1 + min-h-0 to establish height chain, NO overflow property here
        - For /players (virtualized): wrapper uses overflow-hidden, react-window handles scrolling
        - For all other pages: wrapper uses overflow-y-auto for normal page scrolling
        This ensures:
        1. Virtualized routes get proper height measurement for react-window
        2. Non-virtualized routes can scroll normally
      */}
      <main className="flex-1 w-full flex flex-col min-h-0">
        {isVirtualizedRoute ? (
          /* Virtualized route: use overflow-hidden, react-window will handle its own scrolling */
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <Outlet />
          </div>
        ) : (
          /* Non-virtualized route: allow normal page scrolling */
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            <Outlet />
          </div>
        )}

        <Toaster position="bottom-center" />
      </main>
    </div>
  );
};

export default SiteLayout;
