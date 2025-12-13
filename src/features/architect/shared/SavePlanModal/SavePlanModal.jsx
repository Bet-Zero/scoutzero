import React from 'react';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';

const SavePlanModal = ({ name, onNameChange, onCancel, onSave, isOpen }) => (
  <Dialog open={isOpen} onOpenChange={onCancel}>
    <DialogContent className="p-6 max-w-md">
      <h2 className="text-xl font-bold mb-4">Save Team Plan</h2>
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Plan name"
        className="w-full p-2 bg-neutral-800 text-black border border-black rounded mb-2 placeholder:text-neutral-700"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500"
        >
          Save
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

export default SavePlanModal;
