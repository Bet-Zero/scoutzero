// src/components/roster/DrawerShell.jsx
import React from 'react';

const DrawerShell = ({ isOpen, onClose, children }) => (
  <>
    <div
      className={`fixed left-0 top-0 h-full w-[300px] bg-[#1a1a1a] border-r border-white/10 z-20 flex flex-col transition-transform duration-200 ease-out overflow-y-auto ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {children}
    </div>
    <div
      className={`fixed inset-0 bg-black/20 z-10 transition-opacity duration-200 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    />
  </>
);

export default DrawerShell;
