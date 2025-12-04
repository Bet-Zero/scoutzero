/**
 * Purpose: Manage contract actions (options, FA, extend, S&T) in a modal.
 * Inputs: player, CURRENT_YEAR, extReason/extMax, callbacks (onSave/onWaive/...).
 * Outputs: User actions & formatted salary inputs per path.
 * Risks: Salary string/number mismatch; Dialog export alignment; null extMax edge cases.
 * Next TODO: Store numeric, format on display; verify Dialog exports; guard extend path.
 */
// EditContractModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';
import { formatCurrencyFull, formatCurrency } from '@/shared/utils/formatting';
import capProjections from '@/features/architect/utils/capProjections';
import {
  getExtensionEligibilityReason,
  getExtensionMaxDetails,
} from '@/features/architect/utils/extensionRules';
import { generateExtensionContract } from '@/features/architect/utils/contractUtils';
import { toEndYear } from '@/features/architect/utils/seasonFormat';

const ACTION_SETS = {
  option: ['accept', 'decline', 'signNew'],
  freeAgent: ['resign', 'signAndTrade', 'renounce'],
  underContract: ['extend', 'waive', 'waiveStretch', 'buyout'],
};

const ACTION_LABELS = {
  accept: 'Accept Option',
  decline: 'Decline Option',
  signNew: 'Sign New Contract',
  resign: 'Re-sign Player',
  signAndTrade: 'Sign & Trade',
  renounce: 'Renounce Rights',
  extend: 'Extend Contract',
  waive: 'Waive Player',
  waiveStretch: 'Waive & Stretch',
  buyout: 'Buyout Contract',
};

const ACTION_DESCRIPTIONS = {
  accept: 'Player remains under contract for the option year.',
  decline: 'Player becomes a Free Agent immediately.',
  signNew: 'Negotiate a new contract, replacing the option.',
  resign: 'Sign player to a new multi-year deal.',
  signAndTrade: 'Sign player and immediately trade them.',
  renounce: 'Release cap hold and rights to this player.',
  extend: 'Add years to the current contract.',
  waive: 'Release player. Salary remains on cap unless claimed.',
  waiveStretch: 'Release player and stretch salary over 2x + 1 years.',
  buyout: 'Negotiate a reduced amount to release player.',
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

  const today = new Date();
  const CURRENT_YEAR = today.getFullYear() - (today.getMonth() < 6 ? 1 : 0);

  // Helper to get contract years from Architect schema (contract.salariesByYear[])
  const contractYears = useMemo(() => {
    if (!player?.contract?.salariesByYear?.length) return [];
    return player.contract.salariesByYear
      .map((y) => ({
        year: toEndYear(y.season),
        season: y.season,
        salary: y.salary || y.capHit || 0,
        option: y.option,
        guaranteed: y.guaranteed,
      }))
      .filter((y) => y.year != null)
      .sort((a, b) => a.year - b.year);
  }, [player]);

  const isFreeAgent =
    player?.freeAgentYear && player.freeAgentYear <= CURRENT_YEAR;

  const isUnderContract = contractYears.some((y) => y.year > CURRENT_YEAR);

  const optionYearEntry = contractYears.find(
    (y) => y.year >= CURRENT_YEAR && y.option
  );
  const optionYear = optionYearEntry?.year || null;
  const optionType = optionYearEntry?.option || null;

  const hasOption = !!optionType;

  const actionSet = hasOption
    ? 'option'
    : isFreeAgent
    ? 'freeAgent'
    : isUnderContract
    ? 'underContract'
    : null;

  const actions = actionsOverride || ACTION_SETS[actionSet] || [];

  // Contract Summary Calculations
  const summary = useMemo(() => {
    const totalValue = contractYears.reduce((sum, y) => sum + y.salary, 0);
    const totalYears = contractYears.length;
    
    const remainingYearsList = contractYears.filter(y => y.year >= CURRENT_YEAR);
    const remainingValue = remainingYearsList.reduce((sum, y) => sum + y.salary, 0);
    const remainingYears = remainingYearsList.length;

    return { totalValue, totalYears, remainingValue, remainingYears };
  }, [contractYears, CURRENT_YEAR]);

  useEffect(() => {
    if (!player) return;

    // Get contract years from Architect schema
    const years = [...contractYears].sort((a, b) => b.year - a.year);

    let lastSalary = 0;
    if (years.length) {
      if (isFreeAgent) {
        const lastYearEntry =
          years.find((y) => y.year <= CURRENT_YEAR) ?? years[0];
        lastSalary = lastYearEntry?.salary || 0;
      } else {
        const targetYear = optionYear ?? years[0]?.year;
        const targetEntry = years.find((y) => y.year === targetYear);
        lastSalary = targetEntry?.salary || 0;
      }
    }

    setExtension({
      years: 1,
      contractType: 'Standard',
      salaries: [lastSalary],
    });
    setSalaryInputs([lastSalary ? formatCurrencyFull(lastSalary) : '']);
    setSelectedAction('');

    const key = `${CURRENT_YEAR + 1}-${String(
      (CURRENT_YEAR + 2) % 100
    ).padStart(2, '0')}`;
    const capSettings = capProjections[key] || {};
    setExtReason(getExtensionEligibilityReason(player, CURRENT_YEAR));
    setExtMax(getExtensionMaxDetails(player, capSettings));
  }, [player, contractYears, isFreeAgent, optionYear, CURRENT_YEAR]);

  useEffect(() => {
    if (selectedAction !== 'extend' || !extMax) return;
    setExtension({
      years: extMax.maxYears,
      contractType: 'Standard',
      salaries: Array(extMax.maxYears).fill(extMax.maxFirstYearSalary),
    });
    setSalaryInputs(
      Array(extMax.maxYears)
        .fill(extMax.maxFirstYearSalary)
        .map((s) => (s ? formatCurrencyFull(s) : ''))
    );
  }, [selectedAction, extMax]);

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

    onClose();
  };

  if (!player) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-[#0f0f0f] border border-white/10 p-0 overflow-hidden flex flex-col md:flex-row h-[600px]">
        {/* === LEFT PANEL: Contract Summary === */}
        <div className="w-full md:w-[40%] bg-[#161616] border-r border-white/5 p-6 flex flex-col">
          {/* Header Total */}
          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(summary.totalValue)} <span className="text-white/40 mx-1">-</span> {summary.totalYears} yrs
            </div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">Total Contract</div>
          </div>

          {/* Years List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
            {contractYears.map((y) => {
              const isFuture = y.year >= CURRENT_YEAR;
              const isOption = !!y.option;
              return (
                <div key={y.season} className={`flex items-center justify-between py-3 border-b border-white/5 ${isFuture ? 'opacity-100' : 'opacity-40'}`}>
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-white/60">{y.season}</span>
                    {isOption && <span className="text-[10px] text-orange-400 font-bold uppercase">{y.option}</span>}
                  </div>
                  <span className={`font-mono text-sm ${isFuture ? 'text-orange-500 font-bold' : 'text-white'}`}>
                    {formatCurrencyFull(y.salary)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer Remaining */}
          <div className="text-center mt-6 pt-6 border-t border-white/5">
            <div className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(summary.remainingValue)} <span className="text-white/40 mx-1">-</span> {summary.remainingYears} yrs
            </div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">Remaining</div>
          </div>
        </div>

        {/* === RIGHT PANEL: Actions === */}
        <div className="w-full md:w-[60%] p-6 bg-[#0f0f0f] flex flex-col overflow-y-auto">
          <h2 className="text-lg font-bold text-white mb-4">Available Actions</h2>
          
          {/* Context Text */}
          <div className="mb-6 text-sm text-white/70 leading-relaxed">
            {hasOption && (
              <p>
                <span className="text-white font-semibold">{player.name}</span> has a <span className="text-orange-400">{optionType}</span> for the upcoming season. 
                You may choose to accept it to retain him, decline it to make him a Free Agent, or negotiate a new contract.
              </p>
            )}
            {isFreeAgent && (
              <p>
                <span className="text-white font-semibold">{player.name}</span> is currently a Free Agent (Cap Hold). 
                You can re-sign him using Bird Rights (if applicable), renounce his rights to clear cap space, or execute a sign-and-trade.
              </p>
            )}
            {isUnderContract && (
              <p>
                <span className="text-white font-semibold">{player.name}</span> is under contract. 
                You can extend his deal if eligible, or waive him to clear a roster spot (with potential dead cap implications).
              </p>
            )}
          </div>

          {/* Action Selection */}
          <div className="space-y-3 mb-6">
            {actions.map((type) => (
              <label
                key={type}
                className={`flex items-start gap-3 p-3 rounded border transition-all cursor-pointer ${
                  selectedAction === type
                    ? 'bg-orange-500/10 border-orange-500/50'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                }`}
              >
                <input
                  type="radio"
                  value={type}
                  checked={selectedAction === type}
                  onChange={() => setSelectedAction(type)}
                  className="mt-1 accent-orange-500"
                />
                <div>
                  <div className={`font-medium ${selectedAction === type ? 'text-orange-400' : 'text-white'}`}>
                    {actionLabelsOverride[type] || ACTION_LABELS[type]}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">
                    {ACTION_DESCRIPTIONS[type]}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* === Contract Inputs (Conditional) === */}
          {['signNew', 'resign', 'extend'].includes(selectedAction) && (
            <div className="bg-[#161616] p-4 rounded border border-white/10 animate-in fade-in slide-in-from-bottom-2">
              <h4 className="font-semibold text-sm text-white mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                Contract Details
              </h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Type</label>
                  <select
                    value={extension.contractType}
                    onChange={(e) =>
                      setExtension({ ...extension, contractType: e.target.value })
                    }
                    className="w-full p-2 rounded bg-black border border-white/20 text-sm text-white focus:border-orange-500 outline-none"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Rookie Scale">Rookie Scale</option>
                    <option value="Designated veteran">Designated veteran</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Years</label>
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
                          extension.salaries[i] ? String(extension.salaries[i]) : ''
                        )
                      );
                    }}
                    className="w-full p-2 rounded bg-black border border-white/20 text-sm text-white focus:border-orange-500 outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr} year{yr > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {extension.salaries.slice(0, extension.years).map((sal, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <label className="text-xs text-white/40 w-16">Year {idx + 1}</label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={salaryInputs[idx] || ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          const val = Number(raw);
                          setExtension((prev) => {
                            const arr = [...prev.salaries];
                            arr[idx] = val;
                            return { ...prev, salaries: arr };
                          });
                          setSalaryInputs((prev) => {
                            const arr = [...prev];
                            arr[idx] = formatCurrencyFull(raw);
                            return arr;
                          });
                        }}
                        className="w-full pl-6 pr-3 py-1.5 rounded bg-black border border-white/20 text-sm text-white focus:border-orange-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {selectedAction === 'extend' && (
                <div className="mt-3 p-2 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-200">
                  {extReason === 'Eligible'
                    ? `Max ${extMax?.maxYears || 0} years starting at $${
                        extMax?.maxFirstYearSalary?.toLocaleString() || 0
                      }`
                    : `Not eligible: ${extReason}`}
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="mt-auto pt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              Cancel
            </button>
            {selectedAction && (
              <button
                onClick={handleConfirm}
                disabled={selectedAction === 'extend' && extReason !== 'Eligible'}
                className="px-6 py-2 text-sm font-bold rounded bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Confirm Action
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditContractModal;
