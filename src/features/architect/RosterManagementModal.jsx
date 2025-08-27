import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/shared/ui/Dialog';
import { formatCurrencyFull, formatName } from '@/utils/formatting';
import capProjections from '@/utils/architect/capProjections';
import {
  getExtensionEligibilityReason,
  getExtensionMaxDetails,
} from '@/utils/architect/extensionRules';
import { generateExtensionContract, generateContract } from '@/utils/architect/contractUtils';
import { canSignFreeAgent } from '@/utils/architect/freeAgentLogic';
import { validateRosterMove } from '@/utils/architect/rosterMoveValidator';

const ACTION_SETS = {
  option: ['accept', 'decline', 'signNew'],
  freeAgent: ['resign', 'signAndTrade', 'renounce'],
  underContract: ['extend', 'waive', 'waiveStretch', 'buyout', 'trade'],
  capHold: ['resign', 'renounce'],
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
  buyout: 'Buy Out Contract',
  trade: 'Add to Trade Machine',
};

const RosterManagementModal = ({
  player,
  isOpen,
  onClose,
  onRosterMove,
  teamCapSheet,
  currentYear = 2025,
  context = {},
}) => {
  const [selectedAction, setSelectedAction] = useState('');
  const [contractDetails, setContractDetails] = useState({
    years: 1,
    contractType: 'Standard',
    salaries: [0],
    useException: false,
    exceptionType: 'cap_space',
  });
  const [salaryInputs, setSalaryInputs] = useState(['']);
  const [extReason, setExtReason] = useState('');
  const [extMax, setExtMax] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [freeAgentInfo, setFreeAgentInfo] = useState(null);

  const today = new Date();
  const CURRENT_YEAR = today.getFullYear() - (today.getMonth() < 6 ? 1 : 0);

  // Determine player status and available actions
  const isFreeAgent = player?.free_agency_year && player.free_agency_year <= CURRENT_YEAR;
  const isUnderContract = player?.contract_clean?.salaries_by_year && 
    Object.keys(player.contract_clean.salaries_by_year).some(year => 
      parseInt(year) > CURRENT_YEAR && player.contract_clean.salaries_by_year[year]?.salary > 0
    );
  
  const optionYear = isUnderContract ? Object.keys(player?.contract_clean?.salaries_by_year || {})
    .map(Number)
    .find(year => year > CURRENT_YEAR && player.contract_clean.salaries_by_year[year]?.option) : null;
  
  const optionType = optionYear ? player.contract_clean.salaries_by_year[optionYear]?.option : null;
  const hasOption = !!optionType;

  const isCapHold = player?.cap_hold && 
    (typeof player.cap_hold === 'number' ? player.cap_hold : player.cap_hold?.amount) > 0;

  // Determine action set
  const actionSet = hasOption ? 'option' : 
                   isFreeAgent ? 'freeAgent' :
                   isUnderContract ? 'underContract' :
                   isCapHold ? 'capHold' : null;

  const actions = ACTION_SETS[actionSet] || [];

  // Initialize component state
  useEffect(() => {
    if (!player || !isOpen) return;

    // Reset state
    setSelectedAction('');
    setValidationResult(null);

    // Calculate contract defaults
    const salaryYears = Object.keys(player?.contract_clean?.salaries_by_year || {})
      .map(Number)
      .sort((a, b) => b - a);

    let defaultSalary = 0;
    if (salaryYears.length) {
      if (isFreeAgent) {
        const lastYear = salaryYears.find(y => y <= CURRENT_YEAR) ?? salaryYears[0];
        defaultSalary = player.contract_clean.salaries_by_year[lastYear]?.salary || 0;
      } else {
        defaultSalary = player.contract_clean.salaries_by_year?.[optionYear ?? salaryYears[0]]?.salary || 0;
      }
    }

    setContractDetails({
      years: 1,
      contractType: 'Standard',
      salaries: [defaultSalary],
      useException: false,
      exceptionType: 'cap_space',
    });
    setSalaryInputs([defaultSalary ? formatCurrencyFull(defaultSalary) : '']);

    // Extension eligibility
    if (isUnderContract) {
      const reason = getExtensionEligibilityReason(player, CURRENT_YEAR);
      setExtReason(reason);
      
      const key = `${CURRENT_YEAR + 1}-${String((CURRENT_YEAR + 2) % 100).padStart(2, '0')}`;
      const capSettings = capProjections[key] || {};
      setExtMax(getExtensionMaxDetails(player, capSettings));
    }

    // Free agent signing analysis
    if (isFreeAgent || isCapHold) {
      const signingInfo = canSignFreeAgent(player, teamCapSheet, capProjections, CURRENT_YEAR + 1);
      setFreeAgentInfo(signingInfo);
    }
  }, [player, isOpen, isFreeAgent, isUnderContract, optionYear, CURRENT_YEAR]);

  // Auto-populate extension details when extending
  useEffect(() => {
    if (selectedAction !== 'extend' || !extMax) return;
    
    setContractDetails({
      years: extMax.maxYears,
      contractType: 'Standard',
      salaries: Array(extMax.maxYears).fill(extMax.maxFirstYearSalary),
      useException: false,
      exceptionType: 'bird_rights',
    });
    setSalaryInputs(
      Array(extMax.maxYears)
        .fill(extMax.maxFirstYearSalary)
        .map(s => s ? formatCurrencyFull(s) : '')
    );
  }, [selectedAction, extMax]);

  // Validate move when action or details change
  useEffect(() => {
    if (!selectedAction || !player) {
      setValidationResult(null);
      return;
    }

    const moveData = {
      action: selectedAction,
      player,
      contractDetails,
      teamCapSheet,
      currentYear: CURRENT_YEAR,
      context,
    };

    const result = validateRosterMove(moveData);
    setValidationResult(result);
  }, [selectedAction, contractDetails, player, teamCapSheet, CURRENT_YEAR, context]);

  const handleConfirm = () => {
    if (!selectedAction || !validationResult?.valid) return;

    const moveData = {
      action: selectedAction,
      player,
      contractDetails,
      validationResult,
    };

    onRosterMove?.(moveData);
    onClose();
  };

  const updateSalary = (index, value) => {
    const raw = value.replace(/[^0-9]/g, '');
    const numValue = Number(raw);
    
    setContractDetails(prev => {
      const newSalaries = [...prev.salaries];
      newSalaries[index] = numValue;
      return { ...prev, salaries: newSalaries };
    });
    
    setSalaryInputs(prev => {
      const newInputs = [...prev];
      newInputs[index] = formatCurrencyFull(raw);
      return newInputs;
    });
  };

  if (!player) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-5 max-w-md text-sm space-y-4">
        <h2 className="text-lg font-semibold">
          Roster Management - {formatName(player.name)}
        </h2>

        {/* Player Status Summary */}
        <div className="p-3 bg-neutral-800 rounded">
          <p className="text-xs text-neutral-400 mb-1">Player Status</p>
          <p className="text-sm">
            {hasOption && `${optionYear} ${optionType} Option`}
            {isFreeAgent && 'Free Agent'}
            {isUnderContract && !hasOption && 'Under Contract'}
            {isCapHold && 'Cap Hold'}
          </p>
          {player.birdRights && (
            <p className="text-xs text-neutral-400 mt-1">
              Bird Rights: {player.birdRights}
            </p>
          )}
        </div>

        {/* Action Selection */}
        {actions.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Available Actions</label>
            <div className="grid gap-2">
              {actions.map(action => (
                <button
                  key={action}
                  onClick={() => setSelectedAction(action)}
                  className={`p-2 text-left rounded border text-sm ${
                    selectedAction === action
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-neutral-600 bg-neutral-800 hover:bg-neutral-700'
                  }`}
                >
                  {ACTION_LABELS[action]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contract Details Form */}
        {(selectedAction === 'extend' || selectedAction === 'resign' || selectedAction === 'signNew') && (
          <div className="space-y-3 p-3 border border-neutral-600 rounded">
            <h3 className="text-sm font-medium">Contract Details</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-neutral-400">Contract Type</label>
                <select
                  value={contractDetails.contractType}
                  onChange={e => setContractDetails(prev => ({ ...prev, contractType: e.target.value }))}
                  className="w-full p-1 rounded bg-neutral-800 border border-neutral-600 text-sm"
                >
                  <option value="Standard">Standard</option>
                  <option value="Two-Way">Two-Way</option>
                  <option value="Ten-Day">Ten-Day</option>
                  <option value="Rookie Scale">Rookie Scale</option>
                  <option value="Designated veteran">Supermax</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-neutral-400">Years</label>
                <select
                  value={contractDetails.years}
                  onChange={e => {
                    const years = Number(e.target.value);
                    setContractDetails(prev => ({
                      ...prev,
                      years,
                      salaries: Array.from({ length: years }, (_, i) => prev.salaries[i] || 0)
                    }));
                    setSalaryInputs(Array.from({ length: years }, (_, i) => 
                      contractDetails.salaries[i] ? formatCurrencyFull(contractDetails.salaries[i]) : ''
                    ));
                  }}
                  className="w-full p-1 rounded bg-neutral-800 border border-neutral-600 text-sm"
                >
                  {[1, 2, 3, 4, 5].map(yr => (
                    <option key={yr} value={yr}>{yr} year{yr > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Salary Inputs */}
            <div className="space-y-2">
              {contractDetails.salaries.slice(0, contractDetails.years).map((_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <label className="text-xs text-neutral-400 w-20">
                    Year {idx + 1}
                  </label>
                  <input
                    type="text"
                    value={salaryInputs[idx] || ''}
                    onChange={e => updateSalary(idx, e.target.value)}
                    placeholder="$0"
                    className="flex-1 p-1 rounded bg-neutral-800 border border-neutral-600 text-sm"
                  />
                </div>
              ))}
            </div>

            {/* Exception Usage */}
            {(selectedAction === 'resign' || selectedAction === 'signNew') && (
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contractDetails.useException}
                    onChange={e => setContractDetails(prev => ({ 
                      ...prev, 
                      useException: e.target.checked 
                    }))}
                  />
                  <span className="text-xs">Use Exception</span>
                </label>
                
                {contractDetails.useException && (
                  <select
                    value={contractDetails.exceptionType}
                    onChange={e => setContractDetails(prev => ({ 
                      ...prev, 
                      exceptionType: e.target.value 
                    }))}
                    className="w-full p-1 rounded bg-neutral-800 border border-neutral-600 text-xs"
                  >
                    <option value="cap_space">Cap Space</option>
                    <option value="mle_full">Full MLE</option>
                    <option value="mle_taxpayer">Taxpayer MLE</option>
                    <option value="mle_non_taxpayer">Non-Taxpayer MLE</option>
                    <option value="bae">Bi-Annual Exception</option>
                    <option value="minimum">Veteran Minimum</option>
                    <option value="bird_rights">Bird Rights</option>
                    <option value="early_bird">Early Bird Rights</option>
                    <option value="non_bird">Non-Bird Rights</option>
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {/* Extension Eligibility Info */}
        {selectedAction === 'extend' && (
          <div className="p-3 bg-neutral-800 rounded">
            <p className="text-xs text-neutral-400 mb-1">Extension Eligibility</p>
            <p className="text-sm">
              {extReason === 'Eligible' 
                ? `✓ Eligible for ${extMax?.maxYears || 0} years, max $${extMax?.maxFirstYearSalary?.toLocaleString() || 0}`
                : `✗ ${extReason}`
              }
            </p>
          </div>
        )}

        {/* Free Agent Info */}
        {freeAgentInfo && (selectedAction === 'resign' || selectedAction === 'signNew') && (
          <div className="p-3 bg-neutral-800 rounded">
            <p className="text-xs text-neutral-400 mb-1">Signing Eligibility</p>
            <p className="text-sm">
              {freeAgentInfo.allowed ? '✓ Can sign' : `✗ ${freeAgentInfo.reason}`}
            </p>
          </div>
        )}

        {/* Validation Results */}
        {validationResult && (
          <div className={`p-3 rounded ${validationResult.valid ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
            <p className="text-xs text-neutral-400 mb-1">Move Validation</p>
            <p className="text-sm">
              {validationResult.valid ? '✓ Move is valid' : `✗ ${validationResult.reason}`}
            </p>
            {validationResult.warnings?.length > 0 && (
              <ul className="text-xs text-yellow-400 mt-1 space-y-1">
                {validationResult.warnings.map((warning, idx) => (
                  <li key={idx}>⚠ {warning}</li>
                ))}
              </ul>
            )}
            {validationResult.capImpact && (
              <p className="text-xs text-neutral-400 mt-1">
                Cap Impact: {validationResult.capImpact > 0 ? '+' : ''}
                ${validationResult.capImpact.toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm rounded bg-neutral-700 hover:bg-neutral-600"
          >
            Cancel
          </button>
          {selectedAction && (
            <button
              onClick={handleConfirm}
              disabled={!validationResult?.valid}
              className="px-4 py-1 text-sm rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm {ACTION_LABELS[selectedAction]}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RosterManagementModal;