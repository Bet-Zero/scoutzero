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
  const [modType, setModType] = useState('extension');
  const [optionDecision, setOptionDecision] = useState(true);
  const [optionType, setOptionType] = useState(null);
  const [extension, setExtension] = useState({ years: 1, base: 0 });
  const [signAndTrade, setSignAndTrade] = useState(false);

  useEffect(() => {
    if (!player) return;
    const years = player.contract_clean?.salaries_by_year || {};

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

  const handleSign = () => {
    if (onSave) onSave(player, extension);
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

  const today = new Date();
  const CURRENT_YEAR = today.getFullYear() - (today.getMonth() < 6 ? 1 : 0);
  const isFreeAgent =
    player.free_agency_year && player.free_agency_year <= CURRENT_YEAR;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-4 max-w-sm">
        <h2 className="text-xl font-bold mb-3">Modify Contract</h2>

        <div className="space-y-3">
          {isFreeAgent && (
            <div>
              <label className="block text-sm mb-1">New Contract</label>
              <select
                value={
                  ['extension', 'sign', 'signAndTrade'].includes(modType)
                    ? modType
                    : ''
                }
                onChange={(e) => setModType(e.target.value)}
                className="w-full p-1 bg-neutral-800 border border-neutral-600 rounded"
              >
                <option value="" disabled>
                  Select action
                </option>
                <option value="extension">Sign Extension</option>
                <option value="sign">Sign New Deal</option>
                <option value="signAndTrade">Sign &amp; Trade</option>
              </select>
            </div>
          )}

          {optionType && (
            <div>
              <label className="block text-sm mb-1">Option Decision</label>
              <select
                value={['accept', 'decline'].includes(modType) ? modType : ''}
                onChange={(e) => setModType(e.target.value)}
                className="w-full p-1 bg-neutral-800 border border-neutral-600 rounded"
              >
                <option value="" disabled>
                  Select decision
                </option>
                <option value="accept">Accept Option</option>
                <option value="decline">Decline Option</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Waive / Buyout</label>
            <select
              value={modType === 'waive' ? 'waive' : ''}
              onChange={(e) => setModType(e.target.value)}
              className="w-full p-1 bg-neutral-800 border border-neutral-600 rounded"
            >
              <option value="" disabled>
                Select action
              </option>
              <option value="waive">Waive</option>
            </select>
          </div>
        </div>

        {modType === 'accept' && optionType && (
          <p className="text-sm mb-4">Accept {optionType} for next season?</p>
        )}

        {modType === 'decline' && optionType && (
          <p className="text-sm mb-4">Decline {optionType} for next season?</p>
        )}

        {(modType === 'extension' || modType === 'sign') && (
          <div className="my-3 text-sm space-y-2">
            <h4 className="font-semibold">
              {modType === 'extension' ? 'Extension' : 'New Contract'}
            </h4>
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
              {modType === 'extension' && (
                <button
                  onClick={handleExtend}
                  className="ml-auto text-xs text-blue-400 hover:underline"
                >
                  Preview
                </button>
              )}
            </div>
          </div>
        )}

        {modType === 'signAndTrade' && (
          <label className="flex items-center gap-2 text-sm my-2">
            <input
              type="checkbox"
              checked={signAndTrade}
              onChange={(e) => setSignAndTrade(e.target.checked)}
            />
            Sign &amp; Trade
          </label>
        )}

        {modType === 'waive' && (
          <p className="text-sm mb-4">
            Are you sure you want to waive this player?
          </p>
        )}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
          >
            Cancel
          </button>
          {modType === 'waive' && (
            <button
              onClick={handleWaive}
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-sm"
            >
              Waive
            </button>
          )}
          {modType === 'extension' && (
            <button
              onClick={handleExtend}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
            >
              Extend
            </button>
          )}
          {modType === 'sign' && (
            <button
              onClick={handleSign}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
            >
              Sign
            </button>
          )}
          {modType === 'signAndTrade' && (
            <button
              onClick={() => {
                if (onSignAndTrade) onSignAndTrade(player, signAndTrade);
                onClose();
              }}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
            >
              Apply
            </button>
          )}
          {(modType === 'accept' || modType === 'decline') && (
            <button
              onClick={() => {
                if (optionType && onOptionDecision)
                  onOptionDecision(player, modType === 'accept');
                onClose();
              }}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
            >
              Confirm
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditContractModal;
