import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/dialog';

const EditContractModal = ({ player, isOpen, onClose, onSave }) => {
  const [salaries, setSalaries] = useState({});

  useEffect(() => {
    if (!player) return;
    const years = player.contract_clean?.salaries_by_year || {};
    const init = {};
    Object.entries(years).forEach(([year, data]) => {
      init[year] = data.salary || 0;
    });
    setSalaries(init);
  }, [player]);

  const handleChange = (year, value) => {
    setSalaries({ ...salaries, [year]: Number(value) });
  };

  const handleSave = () => {
    if (onSave) onSave(player, salaries);
    onClose();
  };

  if (!player) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-4 max-w-sm">
        <h2 className="text-xl font-bold mb-3">Edit Contract</h2>
        {Object.keys(salaries).map((year) => (
          <div key={year} className="mb-2">
            <label className="block text-sm mb-1">{year}</label>
            <input
              type="number"
              value={salaries[year]}
              onChange={(e) => handleChange(year, e.target.value)}
              className="w-full p-1 bg-neutral-800 border border-neutral-600 rounded"
            />
          </div>
        ))}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditContractModal;
