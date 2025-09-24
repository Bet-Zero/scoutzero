/**
 * Purpose: Show/manage trade exceptions in a modal.
 * Inputs: exceptions[], onConfirm/onCancel, open state.
 * Outputs: Modal with scrolling list and actions.
 * Risks: A11y/keyboard handling unknown; duplication vs Dialog/Modal; long-list UX.
 * Next TODO: Use shared Dialog/Modal; add keyboard/ARIA; set max-height & scroll.
 */
import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/Dialog';

const TradeExceptionModal = ({ player, isOpen, onClose, onApply }) => {
  const [amount, setAmount] = useState(0);
  const [createNew, setCreateNew] = useState(true);

  const handleApply = () => {
    if (onApply) onApply(player, amount, createNew);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-4 max-w-sm">
        <h2 className="text-xl font-bold mb-3">Trade Exception</h2>
        <label className="block mb-2">
          Amount
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-1 w-full p-1 bg-neutral-800 border border-neutral-600 rounded"
          />
        </label>
        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={createNew}
            onChange={(e) => setCreateNew(e.target.checked)}
          />
          Create new exception
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-sm"
          >
            Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TradeExceptionModal;
