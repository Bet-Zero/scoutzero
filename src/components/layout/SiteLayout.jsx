// SiteLayout.jsx
import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ChevronDown } from 'lucide-react';

const NavGroup = ({ label, children, align = 'left' }) => {
  let alignmentClass = 'left-0';
  if (align === 'center') alignmentClass = 'left-1/2 -translate-x-1/2';
  if (align === 'right') alignmentClass = 'right-0';

  return (
    <div className="relative group">
      {/* Trigger */}
      <div className="inline-flex items-center gap-1 cursor-pointer hover:text-white text-white/60">
        <span>{label}</span>
        <ChevronDown
          size={14}
          className="mt-[1px] text-white/60 group-hover:text-white"
        />
      </div>

      {/* Invisible hover bridge to prevent flicker */}
      <div className="absolute top-full h-4 w-full" />

      {/* Dropdown */}
      <div
        className={`absolute hidden group-hover:flex flex-col mt-2 bg-[#1c1c1c] border border-white/10 rounded shadow-lg text-sm text-white/80 min-w-[160px] p-2 z-50 ${alignmentClass}`}
      >
        {children}
      </div>
    </div>
  );
};

const SiteLayout = () => {
  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col">
      <header className="bg-[#121212] border-b border-white/10 px-6 py-4 flex items-center justify-between">
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
          </NavGroup>

          <NavGroup label="Saved" align="right">
            <Link to="/rosters" className="hover:text-white py-1 px-2">
              Saved Rosters
            </Link>
            <Link to="/lists" className="hover:text-white py-1 px-2">
              Saved Lists
            </Link>
            <Link to="/tier-lists" className="hover:text-white py-1 px-2">
              Saved Tiers
            </Link>
          </NavGroup>
        </nav>
      </header>

      <main className="flex-1 w-full">
        <Outlet />
        <Toaster position="bottom-center" />
      </main>
    </div>
  );
};

export default SiteLayout;
