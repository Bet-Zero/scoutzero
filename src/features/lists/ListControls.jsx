// ListControls.jsx
// Control bar for list editing – includes save button, divider insert, and toggle UI.
import React from 'react';
import { Plus } from 'lucide-react';

const ListControls = ({
  showReorder,
  onToggleReorder,
  onAddDivider,
  onSave,
  isSaving,
  isRanked = true,
}) => (
  <>
    <div className="w-full max-w-[1100px] mx-auto px-4 mt-4 flex justify-start gap-2">
      <button
        onClick={onToggleReorder}
        className="text-xs text-white/40 hover:text-white px-2 py-1 rounded border border-white/10"
      >
        {showReorder ? 'Hide Arrows' : 'Show Arrows'}
      </button>

      <button
        onClick={onAddDivider}
        title="Add Divider"
        disabled={!isRanked}
        className="text-white/40 hover:text-white transition p-2 rounded-full hover:bg-white/10 disabled:opacity-30"
      >
        <Plus size={18} />
      </button>
    </div>

    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="bg-black/20 text-white px-4 py-2 rounded hover:bg-white/20 transition disabled:opacity-40"
      >
        {isSaving ? 'Saving...' : 'Save List'}
      </button>
    </div>
  </>
);

export default ListControls;
