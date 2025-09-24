/**
 * Purpose: Show/manage trade exceptions in a modal.
 * Inputs: exceptions[], onConfirm/onCancel, open state.
 * Outputs: Modal with scrolling list and actions.
 * Risks: None known.
 * Next TODO: Monitor long-list UX as data scales.
*/
import React, { useId, useState } from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/Dialog';

const TradeExceptionModal = ({ player, isOpen, onClose, onApply }) => {
  const [amount, setAmount] = useState(0);
  const [createNew, setCreateNew] = useState(true);
  const headingId = useId();
  const amountInputId = useId();
  const createNewId = useId();

  const handleApply = () => {
    if (onApply) onApply(player, amount, createNew);
    onClose?.();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
      aria-labelledby={headingId}
    >
      <DialogContent className="p-4 max-w-sm max-h-[85vh] overflow-y-auto space-y-4" aria-labelledby={headingId}>
        <h2 id={headingId} className="text-xl font-bold mb-3">
          Trade Exception
        </h2>
        <label className="block mb-2" htmlFor={amountInputId}>
          Amount
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="mt-1 w-full p-1 bg-neutral-800 border border-neutral-600 rounded"
            id={amountInputId}
            inputMode="decimal"
          />
        </label>
        <label className="flex items-center gap-2 mb-4" htmlFor={createNewId}>
          <input
            type="checkbox"
            checked={createNew}
            onChange={(e) => setCreateNew(e.target.checked)}
            id={createNewId}
            className="h-4 w-4"
          />
          Create new exception
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onClose?.()}
            className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-sm"
            type="button"
          >
            Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TradeExceptionModal;
