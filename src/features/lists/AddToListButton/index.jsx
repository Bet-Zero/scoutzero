// AddToListButton.jsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import AddToListModal from '@/features/lists/AddToListButton/AddToListModal';

const AddToListButton = ({ player }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-4 h-4 rounded-full flex items-center justify-center hover:border-white hover:text-white text-white/20 hover:bg-[#2a2a2a] transition"
        title="Add to List"
      >
        <Plus size={26} strokeWidth={2} />
      </button>

      {isOpen && (
        <AddToListModal player={player} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
};

export default AddToListButton;
