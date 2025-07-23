import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/dialog';

const EditContractModal = ({
  player,
  isOpen,
  onClose,
  onSave,
  onWaive,
  onOptionDecision,
  onExtend,
  onSignAndTrade,
}) => {
  const [salaries, setSalaries] = useState({});
  const [optionDecision, setOptionDecision] = useState(true);
  const [optionType, setOptionType] = useState(null);
  const [extension, setExtension] = useState({ years: 1, base: 0 });
  const [signAndTrade, setSignAndTrade] = useState(false);

  useEffect(() => {
    if (!player) return;
    const years = player.contract_clean?.salaries_by_year || {};
    const init = {};
    Object.entries(years).forEach(([year, data]) => {
      init[year] = data.salary || 0;
    });
    setSalaries(init);

    const upcomingList = Object.keys(years)
      .map((y) => parseInt(y))
      .filter((y) => y >= new Date().getFullYear());
    const upcomingYear =
      upcomingList.length > 0 ? Math.min(...upcomingList) : null;
    const opt = upcomingYear
      ? player.contract_clean?.salaries_by_year?.[upcomingYear]?.option
      : null;
    setOptionType(opt);
    setOptionDecision(true);

    const lastSalary = upcomingYear ? years[upcomingYear]?.salary || 0 : 0;
    setExtension({ years: 1, base: lastSalary });
    setSignAndTrade(!!player.signAndTrade);
  }, [player]);

  const handleChange = (year, value) => {
    setSalaries({ ...salaries, [year]: Number(value) });
  };

  const handleSave = () => {
    if (onSave) onSave(player, salaries);
    if (optionType && onOptionDecision)
      onOptionDecision(player, optionDecision);
    if (onSignAndTrade) onSignAndTrade(player, signAndTrade);
    onClose();
  };

  const handleWaive = () => {
    if (onWaive) onWaive(player);
    onClose();
  };

  const handleExtend = () => {
    if (onExtend) onExtend(player, extension);
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
        {optionType && (
          <div className="my-3 text-sm">
            <label className="mr-2">{optionType}:</label>
            <button
              onClick={() => setOptionDecision(!optionDecision)}
              className="text-blue-400 hover:underline"
            >
              {optionDecision ? 'Accept' : 'Decline'}
            </button>
          </div>
        )}
        <div className="my-3 text-sm space-y-2">
          <h4 className="font-semibold">Extension</h4>
          <div className="flex gap-2 items-center">
            <label className="text-xs">Years</label>
            <input
              type="number"
              min={1}
              max={5}
              value={extension.years}
              onChange={(e) =>
                setExtension({ ...extension, years: Number(e.target.value) })
              }
              className="p-1 bg-neutral-800 border border-neutral-600 rounded w-14"
            />
            <label className="text-xs ml-2">Base Salary</label>
            <input
              type="number"
              value={extension.base}
              onChange={(e) =>
                setExtension({ ...extension, base: Number(e.target.value) })
              }
              className="p-1 bg-neutral-800 border border-neutral-600 rounded w-20"
            />
            <button
              onClick={handleExtend}
              className="ml-auto text-xs text-blue-400 hover:underline"
            >
              Preview
            </button>
          </div>
        </div>
        {player.free_agency_year &&
          player.free_agency_year <= new Date().getFullYear() && (
            <label className="flex items-center gap-2 text-sm my-2">
              <input
                type="checkbox"
                checked={signAndTrade}
                onChange={(e) => setSignAndTrade(e.target.checked)}
              />
              Sign & Trade
            </label>
          )}
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
          <button
            onClick={handleWaive}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm"
          >
            Waive
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditContractModal;
