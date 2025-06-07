// SiteLayout.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

const SiteLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="bg-[#121212] border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="text-2xl font-bold tracking-tight text-white">
          🏀 HoopZero
        </div>
        <nav className="flex gap-6 text-sm text-white/60">
          <Link to="/players" className="hover:text-white">
            Player Table
          </Link>
          <Link to="/profiles" className="hover:text-white">
            Player Profiles
          </Link>
          <Link to="/roster" className="hover:text-white">
            Roster Viewer
          </Link>
        </nav>
      </header>
      <main className="flex-1 w-full">
        {children}
        <Toaster position="bottom-center" />
      </main>
    </div>
  );
};

export default SiteLayout;
