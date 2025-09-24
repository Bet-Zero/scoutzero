/**
 * Purpose: Manage contract actions (options, FA, extend, S&T) in a modal.
 * Inputs: player, CURRENT_YEAR, extReason/extMax, callbacks (onSave/onWaive/...).
 * Outputs: User actions & formatted salary inputs per path.
 * Risks: None known.
 * Next TODO: Expand test coverage for salary input edge cases.
*/
// EditContractModal.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/Dialog';
import { formatCurrencyFull } from '@/utils/formatting';
import capProjections from '@/utils/architect/capProjections';
import {
  getExtensionEligibilityReason,
  getExtensionMaxDetails,
} from '@/utils/architect/extensionRules';
import { generateExtensionContract } from '@/utils/architect/contractUtils';

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
  actionsOverride = null,
  actionLabelsOverride = {},
}) => {
  const [selectedAction, setSelectedAction] = useState('');
  const [extension, setExtension] = useState({
    years: 1,
    contractType: 'Standard',
    salaries: [0],
  });
  const [salaryInputs, setSalaryInputs] = useState(['']);

  const [extReason, setExtReason] = useState('');
  const [extMax, setExtMax] = useState(null);

  const today = useMemo(() => new Date(), []);
  const CURRENT_YEAR = useMemo(
    () => today.getFullYear() - (today.getMonth() < 6 ? 1 : 0),
    [today]
  );

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

  const actions = actionsOverride || ACTION_SETS[actionSet] || [];

  const formatSalaryInput = useCallback((value) => {
    if (!value) return '';
    return formatCurrencyFull(value);
  }, []);

  useEffect(() => {
    if (!player) return;

    const salaryYears = Object.keys(
      player?.contract_clean?.salaries_by_year || {}
    )
      .map(Number)
      .sort((a, b) => b - a);

    let lastSalary = 0;
    if (salaryYears.length) {
      if (isFreeAgent) {
        const lastYear =
          salaryYears.find((y) => y <= CURRENT_YEAR) ?? salaryYears[0];
        lastSalary =
          player.contract_clean.salaries_by_year[lastYear]?.salary || 0;
      } else {
        lastSalary =
          player.contract_clean.salaries_by_year?.[optionYear ?? salaryYears[0]]
            ?.salary || 0;
      }
    }

    setExtension({
      years: 1,
      contractType: 'Standard',
      salaries: [lastSalary],
    });
    setSalaryInputs([formatSalaryInput(lastSalary)]);
    setSelectedAction('');

    const key = `${CURRENT_YEAR + 1}-${String(
      (CURRENT_YEAR + 2) % 100
    ).padStart(2, '0')}`;
    const capSettings = capProjections[key] || {};
    setExtReason(getExtensionEligibilityReason(player, CURRENT_YEAR));
    setExtMax(getExtensionMaxDetails(player, capSettings));
  }, [CURRENT_YEAR, formatSalaryInput, player]);

  useEffect(() => {
    if (selectedAction !== 'extend' || !extMax) return;
    const maxSalary = extMax.maxFirstYearSalary || 0;
    const salaries = Array(extMax.maxYears).fill(maxSalary);

    setExtension({
      years: extMax.maxYears,
      contractType: 'Standard',
      salaries,
    });
    setSalaryInputs(salaries.map((value) => formatSalaryInput(value)));
  }, [extMax, formatSalaryInput, selectedAction]);

  const handleDialogOpenChange = useCallback(
    (open) => {
      if (!open) {
        onClose?.();
      }
    },
    [onClose]
  );

  const handleConfirm = () => {
    switch (selectedAction) {
      case 'accept':
        onOptionDecision?.(player, true);
        break;
      case 'decline':
        onOptionDecision?.(player, false);
        break;
      case 'signNew':
        onSave?.(player, { ...extension, base: extension.salaries[0] || 0 });
        break;
      case 'resign':
        onSave?.(player, { ...extension, base: extension.salaries[0] || 0 });
        break;
      case 'signAndTrade':
        onSignAndTrade?.(player, true);
        break;
      case 'renounce':
        onSignAndTrade?.(player, false);
        break;
      case 'extend':
        {
          const startYear = optionYear ? optionYear + 1 : CURRENT_YEAR + 1;
          const contract = generateExtensionContract({
            firstYearSalary: extension.salaries[0] || 0,
            years: extension.years,
            raisePct: extMax?.baseRaisePct || 0.08,
            startYear,
          });
          onExtend?.(player, contract);
        }
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

    onClose?.();
  };

  if (!player) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
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
            Extension eligibility: {extReason}. Waiving and stretching will
            alter cap hit timing.
          </p>
        )}

        {/* === Radio Options === */}
        <div className="space-y-3 border border-white/10 p-3 rounded">
          {actions.map((type) => (
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
              <span>{actionLabelsOverride[type] || ACTION_LABELS[type]}</span>
            </label>
          ))}
        </div>

        {/* === Contract Inputs === */}
        {['signNew', 'resign', 'extend'].includes(selectedAction) && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Contract Details</h4>
            <div className="flex items-center gap-3">
              <label className="text-xs">Type</label>
              <select
                value={extension.contractType}
                onChange={(e) =>
                  setExtension({ ...extension, contractType: e.target.value })
                }
                className="p-1 rounded bg-neutral-800 border border-neutral-600 text-sm"
              >
                <option value="Standard">Standard</option>
                <option value="Rookie Scale">Rookie Scale</option>
                <option value="Designated veteran">Designated veteran</option>
                {/* TODO: add Two-Way and Ten-Day options */}
              </select>

              <label className="text-xs">Years</label>
              <select
                value={extension.years}
                onChange={(e) => {
                  const yrs = Number(e.target.value);
                  setExtension({
                    ...extension,
                    years: yrs,
                    salaries: Array.from(
                      { length: yrs },
                      (_, i) => extension.salaries[i] || 0
                    ),
                  });
                  setSalaryInputs(
                    Array.from({ length: yrs }, (_, i) =>
                      extension.salaries[i]
                        ? formatSalaryInput(extension.salaries[i])
                        : ''
                    )
                  );
                }}
                className="p-1 rounded bg-neutral-800 border border-neutral-600 text-sm"
              >
                {[1, 2, 3, 4, 5].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr} year{yr > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              {extension.salaries.slice(0, extension.years).map((sal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <label className="text-xs w-20">Year {idx + 1} Salary</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={salaryInputs[idx] || ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      const hasValue = Boolean(raw);
                      const val = hasValue ? Number(raw) : 0;
                      setExtension((prev) => {
                        const arr = [...prev.salaries];
                        arr[idx] = val;
                        return { ...prev, salaries: arr };
                      });
                      setSalaryInputs((prev) => {
                        const arr = [...prev];
                        arr[idx] = hasValue ? formatSalaryInput(val) : '';
                        return arr;
                      });
                    }}
                    className="flex-1 p-1 rounded bg-neutral-800 border border-neutral-600 text-sm appearance-none"
                  />
                </div>
              ))}
            </div>

            {selectedAction === 'extend' && (
              <p className="text-xs text-neutral-400">
                {extReason === 'Eligible'
                  ? `Max ${extMax?.maxYears || 0} years starting at $${
                      extMax?.maxFirstYearSalary?.toLocaleString() || 0
                    }`
                  : `Not eligible: ${extReason}`}
              </p>
            )}
          </div>
        )}

        {/* === Action Buttons === */}
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={() => onClose?.()}
            className="px-3 py-1 text-sm rounded bg-neutral-700 hover:bg-neutral-600"
            type="button"
          >
            Cancel
          </button>
          {selectedAction && (
            <button
              onClick={handleConfirm}
              disabled={
                selectedAction === 'extend' &&
                (extReason !== 'Eligible' || !extMax)
              }
              className="px-4 py-1 text-sm rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
              type="button"
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
