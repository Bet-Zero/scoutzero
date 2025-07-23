// EditContractModal.jsx

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/dialog';

const ACTION_SETS = {
  option: ['accept', 'decline', 'signNew'],
  freeAgent: ['resign', 'signAndTrade', 'renounce'],
  underContract: ['extend', 'waive', 'waiveStretch', 'buyout'],
};

const ACTION_LABELS = {
  accept: 'Accept',
  decline: 'Decline',
  signNew: 'Sign New Contract',
  resign: 'Re-sign',
  signAndTrade: 'Sign & Trade',
  renounce: 'Renounce',
  extend: 'Extend',
  waive: 'Waive',
  waiveStretch: 'Waive & Stretch',
  buyout: 'Buyout',
};

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
  const [selectedAction, setSelectedAction] = useState('');
  const [extension, setExtension] = useState({ years: 1, base: 0 });

  const today = new Date();
  const CURRENT_YEAR = today.getFullYear() - (today.getMonth() < 6 ? 1 : 0);

  const isFreeAgent =
    player?.free_agency_year && player.free_agency_year <= CURRENT_YEAR;

  const isUnderContract =
    player?.contract_clean?.salaries_by_year &&
    Object.keys(player.contract_clean.salaries_by_year)
      .map(Number)
      .some((y) => y > CURRENT_YEAR);

  const optionYear = Object.keys(player?.contract_clean?.salaries_by_year || {})
    .map(Number)
    .find((y) => y >= CURRENT_YEAR);

  const optionType =
    player?.contract_clean?.salaries_by_year?.[optionYear]?.option || null;

  const hasOption = !!optionType;

  const actionSet = hasOption
    ? 'option'
    : isFreeAgent
      ? 'freeAgent'
      : isUnderContract
        ? 'underContract'
        : null;

  useEffect(() => {
    if (!player) return;

    const lastSalary =
      player.contract_clean?.salaries_by_year?.[optionYear]?.salary || 0;

    setExtension({ years: 1, base: lastSalary });
    setSelectedAction('');
  }, [player]);

  const handleConfirm = () => {
    switch (selectedAction) {
      case 'accept':
        onOptionDecision?.(player, true);
        break;
      case 'decline':
        onOptionDecision?.(player, false);
        break;
      case 'signNew':
        onSave?.(player, extension);
        break;
      case 'resign':
        onSave?.(player, extension);
        break;
      case 'signAndTrade':
        onSignAndTrade?.(player, true);
        break;
      case 'renounce':
        onSignAndTrade?.(player, false);
        break;
      case 'extend':
        onExtend?.(player, extension);
        break;
      case 'waive':
        onWaive?.(player, { stretch: false, buyout: false });
        break;
      case 'waiveStretch':
        onWaive?.(player, { stretch: true, buyout: false });
        break;
      case 'buyout':
        onWaive?.(player, { stretch: false, buyout: true });
        break;
      default:
        break;
    }

    onClose();
  };

  if (!player) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-5 max-w-md text-sm space-y-5">
        <h2 className="text-lg font-semibold">
          {hasOption
            ? `${optionYear} ${optionType} Option`
            : isFreeAgent
              ? 'Free Agent Cap Hold Options'
              : 'Under Contract Actions'}
        </h2>

        {/* Explanatory Note */}
        {hasOption && (
          <p className="text-xs text-neutral-400">
            Note: {optionType} Options are included in the current cap space.
            Declining this option will free up that cap. Signing a new contract
            replaces that space with the new value.
          </p>
        )}

        {isFreeAgent && (
          <p className="text-xs text-neutral-400">
            Note: This player is a cap hold. Re-signing or sign & trade retains
            rights. Renouncing frees the cap space entirely.
          </p>
        )}

        {isUnderContract && (
          <p className="text-xs text-neutral-400">
            Note: All under-contract players are currently eligible for
            extension. Waiving and stretching will alter cap hit timing.
          </p>
        )}

        {/* === Radio Options === */}
        <div className="space-y-3 border border-white/10 p-3 rounded">
          {ACTION_SETS[actionSet]?.map((type) => (
            <label
              key={type}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="radio"
                value={type}
                checked={selectedAction === type}
                onChange={() => setSelectedAction(type)}
                className="accent-orange-500"
              />
              <span>{ACTION_LABELS[type]}</span>
            </label>
          ))}
        </div>

        {/* === Contract Inputs === */}
        {['signNew', 'resign', 'extend'].includes(selectedAction) && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Contract Details</h4>
            <div className="flex items-center gap-3">
              <label className="text-xs">Years</label>
              <input
                type="number"
                min={1}
                max={5}
                value={extension.years}
                onChange={(e) =>
                  setExtension({ ...extension, years: Number(e.target.value) })
                }
                className="w-16 p-1 rounded bg-neutral-800 border border-neutral-600 text-sm"
              />
              <label className="text-xs">Base Salary</label>
              <input
                type="number"
                value={extension.base}
                onChange={(e) =>
                  setExtension({ ...extension, base: Number(e.target.value) })
                }
                className="w-24 p-1 rounded bg-neutral-800 border border-neutral-600 text-sm"
              />
            </div>
          </div>
        )}

        {/* === Action Buttons === */}
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm rounded bg-neutral-700 hover:bg-neutral-600"
          >
            Cancel
          </button>
          {selectedAction && (
            <button
              onClick={handleConfirm}
              className="px-4 py-1 text-sm rounded bg-blue-600 hover:bg-blue-500"
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
