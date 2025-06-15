import React from 'react';
import { X } from 'lucide-react';

const DrawerHeader = ({ onClose }) => (
  <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10">
    <h2 className="text-white font-bold text-lg">Select Player</h2>
    <button onClick={onClose} className="text-white/50 hover:text-white">
      <X size={20} />
    </button>
  </div>
);

export default DrawerHeader;
