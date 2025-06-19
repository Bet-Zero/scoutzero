// ListControls.jsx
// Control bar for list editing – includes save button, divider insert, and toggle UI.
import React from 'react';
import { Plus } from 'lucide-react';

const RankedListControls = ({
  showReorder,
  onToggleReorder,
  onAddDivider,
  onSave,
  isSaving,
}) => (
  <>
    <div className="w-full max-w-[1100px] mx-auto px-4 mt-4 flex justify-end gap-2">
      <button
        onClick={onToggleReorder}
        className="text-xs text-white/40 hover:text-white px-2 py-1 rounded border border-white/10"
      >
        {showReorder ? 'Hide Arrows' : 'Show Arrows'}
      </button>

      <button
        onClick={onAddDivider}
        title="Add Divider"
        className="text-white/40 hover:text-white transition p-2 rounded-full hover:bg-white/10"
      >
        <Plus size={18} />
      </button>
    </div>

    <div className="w-full max-w-[1100px] mx-auto px-4 text-right mt-6">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-md transition disabled:opacity-40"
      >
        {isSaving ? 'Saving...' : 'Save List'}
      </button>
    </div>
  </>
);

export default RankedListControls;
