/**
 * FILE: src/shared/components/EditContractModal.jsx
 * PURPOSE: Manage Architect contract actions (options, FA, extensions, waivers) with validation and rules profile guidance.
 * OWNERSHIP: Feature: architect/contracts
 *
 * HISTORY:
 *  - 2025-12-10: Integrated PlayerRulesProfile for extension defaults/validation (chunk_01).
 *  - 2025-12-10: Added fallback extension gating and FA/QO validation via rules profile (chunk_02).
 *
 * LINKS:
 *  - Plan: plans/_archive/player-rules-architect/plan.md
 *  - Latest Chunk: plans/_archive/player-rules-architect/chunks/chunk_02.md
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';
import { formatCurrencyFull, formatCurrency } from '@/shared/utils/formatting';
import capProjections from '@/features/architect/utils/capProjections';
import { generateExtensionContract } from '@/features/architect/utils/contractUtils';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  getExtensionEligibilityReason,
  getExtensionMaxDetails,
} from '@/features/architect/utils/extensionRules';
import useCapValidation, { buildSigningGuardrails } from '@/features/architect/hooks/useCapValidation';
import ValidationWarnings from '@/features/architect/ValidationWarnings';

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

const getCapSettings = (year) => {
  const key = `${year - 1}-${String(year % 100).padStart(2, '0')}`;
  return capProjections[key] || capProjections['2025-26'];
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
  initialAction = null,
  targetYear = null,
  actionContext = null, // 'option' | 'freeAgent' | null - from clicked cell
  teamCapSheet = null,
  currentYear: currentYearProp = null,
  playerRulesProfile = null,
  rulesLeagueContext = null,
  actionsOverride = null,
  actionLabelsOverride = {},
}) => {
  const [selectedAction, setSelectedAction] = useState('');
  const [showValidationErrors] = useState(false);
  const [extension, setExtension] = useState({
    years: 1,
    contractType: 'Standard',
    salaries: [0],
  });
  const [salaryInputs, setSalaryInputs] = useState(['']);
  const [selectedException, setSelectedException] = useState('None');

  const [extReason, setExtReason] = useState('');
  const [extMax, setExtMax] = useState(null);

  const today = new Date();
  // CURRENT_YEAR = the END year of the current NBA season
  // e.g., in Dec 2025 we're in the 2025-26 season, so CURRENT_YEAR = 2026
  // After June, we're in the next season (e.g., July 2025 = 2025-26 season = 2026)
  const simDate = rulesLeagueContext?.simulationDate || today;
  const CURRENT_YEAR =
    currentYearProp ||
    rulesLeagueContext?.currentYear ||
    (simDate.getFullYear() + (simDate.getMonth() >= 6 ? 1 : 0));

  const capSettings = useMemo(
    () => getCapSettings(CURRENT_YEAR),
    [CURRENT_YEAR]
  );

  const isSigningAction =
    selectedAction === 'signNew' || selectedAction === 'resign';

  const signingGuardrails = useMemo(() => {
    if (!isSigningAction) return null;
    return buildSigningGuardrails(
      playerRulesProfile,
      capSettings,
      selectedException
    );
  }, [isSigningAction, playerRulesProfile, capSettings, selectedException]);

  // Helper to get contract years from Architect schema (contract.salariesByYear[])
  // Includes both base contract and extension years (from futureContract)
  const contractYears = useMemo(() => {
    if (!player) return [];

    const baseYears = (player.contract?.salariesByYear || []).map((y) => ({
      year: toEndYear(y.season),
      season: y.season,
      salary: y.salary || y.capHit || 0,
      option: y.option,
      guaranteed: y.guaranteed,
      isExtension: false,
    }));

    const extensionYears = (player.futureContract?.salariesByYear || []).map(
      (y) => ({
        year: toEndYear(y.season),
        season: y.season,
        salary: y.salary || y.capHit || 0,
        option: y.option,
        guaranteed: y.guaranteed,
        isExtension: true,
      })
    );

    // Combine and dedupe by year, preferring extension years (they're more recent)
    const yearMap = new Map();
    [...baseYears, ...extensionYears].forEach((y) => {
      if (!yearMap.has(y.year) || y.isExtension) {
        yearMap.set(y.year, y);
      }
    });

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
  }, [player]);

  const isFreeAgent =
    player?.freeAgentYear && player.freeAgentYear <= CURRENT_YEAR;

  // Only consider options on future years (not current season - that decision is already made)
  const optionYearEntry = contractYears.find(
    (y) => y.year > CURRENT_YEAR && y.option
  );
  const optionYear = optionYearEntry?.year || null;
  const optionType = optionYearEntry?.option || null;

  const lastSalaryForPrefill = useMemo(() => {
    if (!player) return 0;

    const years = [...contractYears].sort((a, b) => b.year - a.year);
    if (!years.length) return 0;

    if (isFreeAgent) {
      const lastYearEntry =
        years.find((y) => y.year <= CURRENT_YEAR) ?? years[0];
      return lastYearEntry?.salary || 0;
    }

    const targetYearForBase = optionYear ?? years[0]?.year;
    const targetEntry = years.find((y) => y.year === targetYearForBase);
    return targetEntry?.salary || 0;
  }, [CURRENT_YEAR, contractYears, isFreeAgent, optionYear, player]);

  const hasOption = !!optionType;

  // Player is "under contract" if they have the current season or future guaranteed years
  const isUnderContract = contractYears.some((y) => y.year >= CURRENT_YEAR);

  // Player is expiring (for context text) - under contract now but no future years
  const isExpiring =
    isUnderContract && !contractYears.some((y) => y.year > CURRENT_YEAR);

  // Determine action set:
  // If actionContext is provided (from cell click), use it directly
  // Otherwise, infer from player's contract state (when clicking player name)
  const actionSet = actionContext 
    ? actionContext 
    : hasOption
      ? 'option'
      : isFreeAgent && !isUnderContract
        ? 'freeAgent'
        : isUnderContract
          ? 'underContract'
          : null;

  const actions = actionsOverride || ACTION_SETS[actionSet] || [];
  const extensionEligibility = playerRulesProfile?.extensionEligibility;
  const isExtendEligible =
    extensionEligibility?.isEligible ?? extReason === 'Eligible';

  // Determine if option actions are currently actionable (timing check)
  // ONLY applies when this is an option scenario, not for free agents or under contract
  const isOptionActionable = actionSet !== 'option' || !targetYear || targetYear === CURRENT_YEAR + 1;
  
  // Get the timing error message for display - ONLY for option scenarios
  const optionTimingError = actionSet === 'option' && !isOptionActionable && targetYear
    ? targetYear < CURRENT_YEAR + 1
      ? `This option has already been decided (past season)`
      : `Cannot act on this option yet. It can be decided during the ${targetYear - 2}-${String((targetYear - 1) % 100).padStart(2, '0')} offseason.`
    : null;

  const contractDataForValidation = useMemo(
    () => ({
      ...extension,
      salaries: (extension.salaries || []).slice(
        0,
        extension.years || extension.salaries.length || 0
      ),
      guardrails: signingGuardrails,
      exceptionType: selectedException,
    }),
    [extension, signingGuardrails, selectedException]
  );

  // CBA Validation - get warnings/errors for current action
  // Use targetYear for option/FA actions, currentYear for extensions/waivers
  const { warnings, errors, isValid } = useCapValidation({
    player,
    action: selectedAction,
    contractData: contractDataForValidation,
    teamCapSheet,
    currentYear: CURRENT_YEAR,
    targetYear: targetYear, // The specific year the action applies to
    rulesProfile: playerRulesProfile,
  });

  const disableConfirm =
    !selectedAction ||
    (selectedAction === 'extend' && (!isValid || !isExtendEligible));
  const showForceState =
    !isValid || (selectedAction === 'extend' && !isExtendEligible);

  // Contract Summary Calculations
  const summary = useMemo(() => {
    const totalValue = contractYears.reduce((sum, y) => sum + y.salary, 0);
    const totalYears = contractYears.length;

    // Remaining = current season + future years
    const remainingYearsList = contractYears.filter(
      (y) => y.year >= CURRENT_YEAR
    );
    const remainingValue = remainingYearsList.reduce(
      (sum, y) => sum + y.salary,
      0
    );
    const remainingYears = remainingYearsList.length;

    // Extension calculations
    const extensionYearsList = contractYears.filter((y) => y.isExtension);
    const extensionValue = extensionYearsList.reduce(
      (sum, y) => sum + y.salary,
      0
    );
    const extensionYears = extensionYearsList.length;

    return {
      totalValue,
      totalYears,
      remainingValue,
      remainingYears,
      extensionValue,
      extensionYears,
    };
  }, [contractYears, CURRENT_YEAR]);

  // Rebuild signing defaults when guardrails context changes; intentionally
  // exclude extension deps to avoid clobbering user edits mid-entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!player) return;

    // Default pre-fill with last salary for all years
    const defaultYears = 3; // Default to 3 years for new contracts
    const baseSalary = lastSalaryForPrefill || 0;
    setExtension({
      years: defaultYears,
      contractType: 'Standard',
      salaries: Array(5).fill(baseSalary), // Pre-fill all 5 possible years with last salary
      raisePct: 0.05,
    });
    setSalaryInputs(
      Array(5).fill(baseSalary).map((s) => (s ? formatCurrencyFull(s) : ''))
    );
    // Use initialAction if provided, otherwise reset
    setSelectedAction(initialAction || '');
    setSelectedException('None');

    const eligibility = playerRulesProfile?.extensionEligibility;
    const terms = playerRulesProfile?.extensionTerms;
    if (eligibility) {
      setExtReason(
        eligibility.isEligible ? 'Eligible' : eligibility.reason || 'Not eligible'
      );
      setExtMax(
        terms
          ? {
              maxYears: terms.maxYears,
              maxFirstYearSalary: terms.maxFirstYearSalary,
              minFirstYearSalary: terms.minFirstYearSalary,
              baseRaisePct: terms.raisePercentage,
              type: terms.extensionType,
              basedOn: terms.basedOn,
              notes: terms.notes,
            }
          : null
      );
      return;
    }

    const fallbackReason = getExtensionEligibilityReason(player, CURRENT_YEAR);
    setExtReason(fallbackReason);

    if (fallbackReason !== 'Eligible') {
      setExtMax(null);
      return;
    }

    const fallbackTerms = getExtensionMaxDetails(
      player,
      getCapSettings(CURRENT_YEAR)
    );
    setExtMax(
      fallbackTerms
        ? {
            maxYears: fallbackTerms.maxYears,
            maxFirstYearSalary: fallbackTerms.maxFirstYearSalary,
            minFirstYearSalary:
              fallbackTerms.minFirstYearSalary ??
              fallbackTerms.maxFirstYearSalary ??
              null,
            baseRaisePct: fallbackTerms.baseRaisePct,
            type: fallbackTerms.type,
            basedOn: fallbackTerms.basedOn,
            notes: fallbackTerms.notes,
          }
        : null
    );
  }, [
    CURRENT_YEAR,
    initialAction,
    lastSalaryForPrefill,
    player,
    playerRulesProfile,
  ]);

  useEffect(() => {
    if (selectedAction !== 'extend') return;
    if (!extMax) {
      setExtension((prev) => ({
        ...prev,
        years: prev.years || 1,
        salaries: prev.salaries || [0],
      }));
      setSalaryInputs((prev) => (prev.length ? prev : ['']));
      return;
    }

    const firstYearSalary = (() => {
      const min = extMax.minFirstYearSalary ?? 0;
      const max = extMax.maxFirstYearSalary ?? min;
      const target = extMax.maxFirstYearSalary ?? min;
      const clamped = Math.max(min, Math.min(target, max || target));
      return clamped;
    })();
    const years = extMax.maxYears || extension.years || 1;

    setExtension({
      years,
      contractType: 'Standard',
      salaries: Array(years).fill(firstYearSalary),
    });
    setSalaryInputs(
      Array(years)
        .fill(firstYearSalary)
        .map((s) => (s ? formatCurrencyFull(s) : ''))
    );
  }, [extMax, selectedAction]);

  const clampFirstYearToGuardrails = (value) => {
    if (!signingGuardrails) return value || 0;
    const min = signingGuardrails.minFirstYear || 0;
    const max = signingGuardrails.maxFirstYear;
    let next = Math.max(min, value || 0);
    if (max != null) next = Math.min(next, max);
    return next;
  };

  const buildSalarySeries = (firstYear, years, raisePct) => {
    const totalYears = Math.min(Math.max(years, 1), 5);
    const series = [];
    for (let i = 0; i < totalYears; i += 1) {
      if (i === 0) {
        series.push(Math.round(firstYear));
      } else {
        series.push(Math.round(series[i - 1] * (1 + raisePct)));
      }
    }
    return series;
  };

  const toSalaryInputs = (series, years) =>
    Array.from({ length: 5 }, (_, idx) =>
      idx < years && series[idx]
        ? formatCurrencyFull(series[idx])
        : ''
    );

  useEffect(() => {
    if (!signingGuardrails || !isSigningAction) return;

    const maxYears =
      signingGuardrails.maxYears && signingGuardrails.maxYears > 0
        ? Math.min(signingGuardrails.maxYears, 5)
        : Math.min(extension.years || 3, 5);

    const baseFirstYear = clampFirstYearToGuardrails(
      (selectedException !== 'None' &&
      signingGuardrails.maxFirstYear != null
        ? signingGuardrails.maxFirstYear
        : extension.salaries?.[0]) ??
        signingGuardrails.maxFirstYear ??
        lastSalaryForPrefill ??
        signingGuardrails.minFirstYear ??
        0
    );

    const raisePct = signingGuardrails.raisePct ?? extension.raisePct ?? 0.05;
    const series = buildSalarySeries(baseFirstYear, maxYears, raisePct);

    setExtension((prev) => ({
      ...prev,
      years: maxYears,
      salaries: series,
      raisePct,
    }));
    setSalaryInputs(toSalaryInputs(series, maxYears));
  }, [
    isSigningAction,
    signingGuardrails,
    lastSalaryForPrefill,
  ]);

  const handleConfirm = () => {
    switch (selectedAction) {
      case 'accept':
        onOptionDecision?.(player, true);
        break;
      case 'decline':
        onOptionDecision?.(player, false);
        break;
      case 'signNew':
        onSave?.(player, {
          ...extension,
          years: extension.years,
          salaries: (extension.salaries || []).slice(
            0,
            extension.years || extension.salaries.length || 0
          ),
          base: extension.salaries[0] || 0,
          exceptionType: selectedException,
          guardrails: signingGuardrails,
          raisePct: extension.raisePct ?? signingGuardrails?.raisePct ?? 0.05,
        });
        break;
      case 'resign':
        onSave?.(player, {
          ...extension,
          years: extension.years,
          salaries: (extension.salaries || []).slice(
            0,
            extension.years || extension.salaries.length || 0
          ),
          base: extension.salaries[0] || 0,
          exceptionType: selectedException,
          guardrails: signingGuardrails,
          raisePct: extension.raisePct ?? signingGuardrails?.raisePct ?? 0.05,
        });
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
      <DialogContent className="max-w-6xl w-[95vw] bg-[#0f0f0f] border-2 border-white/20 rounded-xl shadow-2xl shadow-black/50 p-0 overflow-hidden flex flex-col lg:flex-row min-h-[500px] max-h-[85vh]">
        {/* === LEFT PANEL: Contract Summary === */}
        <div className="w-full lg:w-[35%] bg-[#161616] border-r border-white/10 p-8 flex flex-col">
          {/* Header Total */}
          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(summary.totalValue)}{' '}
              <span className="text-white/40 mx-1">-</span> {summary.totalYears}{' '}
              yrs
            </div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">
              Total Contract
            </div>
          </div>

          {/* Years List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
            {contractYears
              .filter((y) => {
                // When extensions exist, only show from current year onward
                if (summary.extensionYears > 0) {
                  return y.year >= CURRENT_YEAR;
                }
                return true;
              })
              .map((y) => {
                // CURRENT_YEAR is the end year of the current season (e.g., 2026 for 2025-26 season)
                // Only years strictly greater than CURRENT_YEAR are future years
                const isFuture = y.year > CURRENT_YEAR;
                const isCurrent = y.year === CURRENT_YEAR;
                const isOption = !!y.option;
                const isExtension = y.isExtension;
                return (
                  <div
                    key={y.season}
                    className={`flex items-center justify-between py-3 border-b border-white/5 ${
                      isFuture || isCurrent ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/60">
                        {y.season}
                      </span>
                      {isExtension && (
                        <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                          EXT
                        </span>
                      )}
                      {isOption && (
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            y.option === 'TO' || y.option === 'Team Option'
                              ? 'text-orange-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {y.option}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono text-sm ${
                        isOption
                          ? y.option === 'TO' || y.option === 'Team Option'
                            ? 'text-orange-400 font-bold'
                            : 'text-emerald-400 font-bold'
                          : isExtension
                            ? 'text-cyan-300 font-bold'
                            : isFuture || isCurrent
                              ? 'text-white font-medium'
                              : 'text-white/60'
                      }`}
                    >
                      {formatCurrencyFull(y.salary)}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Footer Remaining + Extension */}
          <div className="text-center mt-6 pt-6 border-t border-white/5">
            <div className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(summary.remainingValue)}{' '}
              <span className="text-white/40 mx-1">-</span>{' '}
              {summary.remainingYears} yrs
            </div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">
              Remaining
            </div>

            {/* Extension Summary */}
            {summary.extensionYears > 0 && (
              <div className="mt-4 pt-4 border-t border-cyan-500/20">
                <div className="text-lg font-bold text-cyan-100 tracking-tight">
                  {formatCurrency(summary.extensionValue)}{' '}
                  <span className="text-cyan-400/40 mx-1">-</span>{' '}
                  {summary.extensionYears} yrs
                </div>
                <div className="text-xs uppercase tracking-wider text-cyan-400/60 font-semibold mt-1">
                  Extension
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === RIGHT PANEL: Actions === */}
        <div className="w-full lg:w-[65%] p-8 bg-[#0f0f0f] flex flex-col overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-6">
            Available Actions
          </h2>

          {/* Context Text */}
          <div className="mb-6 text-sm text-white/70 leading-relaxed">
            {hasOption && (
              <p>
                <span className="text-white font-semibold">{player.name}</span>{' '}
                has a <span className="text-orange-400">{optionType}</span> for
                the {optionYear ? `${optionYear - 1}-${String(optionYear % 100).padStart(2, '0')}` : 'upcoming'} season. You may choose to accept it to retain him,
                decline it to make him a Free Agent, or negotiate a new
                contract.
              </p>
            )}
            {actionSet === 'freeAgent' && (
              <p>
                <span className="text-white font-semibold">{player.name}</span>{' '}
                is currently a Free Agent (Cap Hold). You can re-sign him using
                Bird Rights (if applicable), renounce his rights to clear cap
                space, or execute a sign-and-trade.
              </p>
            )}
            {actionSet === 'underContract' && isExpiring && (
              <p>
                <span className="text-white font-semibold">{player.name}</span>{' '}
                is on an expiring contract. You can extend his deal if eligible,
                or waive him to clear a roster spot (with potential dead cap
                implications). He will become a free agent after this season.
              </p>
            )}
            {actionSet === 'underContract' && !isExpiring && (
              <p>
                <span className="text-white font-semibold">{player.name}</span>{' '}
                is under contract. You can extend his deal if eligible, or waive
                him to clear a roster spot (with potential dead cap
                implications).
              </p>
            )}
          </div>

          {/* Action Selection */}
          <div className="space-y-3 mb-6">
            {/* Show timing error for future options immediately */}
            {optionTimingError && (
              <div className="flex items-start gap-2 px-3 py-2 rounded border bg-red-500/10 border-red-500/30 mb-3">
                <span className="shrink-0 text-sm">❌</span>
                <span className="text-xs text-red-300">{optionTimingError}</span>
              </div>
            )}
            
            {actions.map((type) => {
              // Option actions (accept/decline) are disabled when not actionable
              const isOptionAction = type === 'accept' || type === 'decline';
              const extendBlocked = type === 'extend' && !isExtendEligible;
              const isDisabled =
                (isOptionAction && !isOptionActionable) || extendBlocked;
              
              return (
                <label
                  key={type}
                  className={`flex items-start gap-3 p-3 rounded border transition-all ${
                    isDisabled
                      ? 'cursor-not-allowed opacity-40 bg-white/[0.01] border-white/5'
                      : selectedAction === type
                        ? 'bg-orange-500/10 border-orange-500/50 cursor-pointer'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5 cursor-pointer'
                  }`}
                >
                  <input
                    type="radio"
                    value={type}
                    checked={selectedAction === type}
                    onChange={() => !isDisabled && setSelectedAction(type)}
                    disabled={isDisabled}
                    className="mt-1 accent-orange-500 disabled:opacity-50"
                  />
                  <div>
                    <div
                      className={`font-medium ${
                        isDisabled
                          ? 'text-white/40'
                          : selectedAction === type
                            ? 'text-orange-400'
                            : 'text-white'
                      }`}
                    >
                      {actionLabelsOverride[type] || ACTION_LABELS[type]}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {ACTION_DESCRIPTIONS[type]}
                      {extendBlocked && (
                        <span className="block text-red-300 mt-1">
                          {playerRulesProfile?.extensionEligibility?.reason ||
                            'Not extension eligible'}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* === Contract Details (Cap Table Row Preview) === */}
          {['signNew', 'resign', 'extend', 'signAndTrade'].includes(selectedAction) && (
            <div className="bg-white/5 rounded-lg border border-white/20 p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                  New Contract Preview
                </h4>
                <div className="flex items-center gap-2">
                  <select
                    value={extension.contractType}
                    onChange={(e) =>
                      setExtension({
                        ...extension,
                        contractType: e.target.value,
                      })
                    }
                    className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Rookie Scale">Rookie Scale</option>
                    <option value="Designated veteran">Designated Veteran</option>
                  </select>

                  {['signNew', 'resign'].includes(selectedAction) && (
                    <select
                      value={selectedException}
                      onChange={(e) => setSelectedException(e.target.value)}
                      className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
                    >
                      <option value="None">Cap Space / Rights</option>
                      <option value="Full MLE">Full MLE</option>
                      <option value="Taxpayer MLE">Taxpayer MLE</option>
                      <option value="Room MLE">Room MLE</option>
                      <option value="BAE">Bi-Annual</option>
                      <option value="Minimum">Minimum</option>
                    </select>
                  )}
                  <select
                    value={extension.years}
                    onChange={(e) => {
                      const guardrailYears =
                        isSigningAction && signingGuardrails?.maxYears
                          ? Math.min(signingGuardrails.maxYears, 5)
                          : null;
                      const maxYearsOption =
                        selectedAction === 'extend' && extMax?.maxYears
                          ? extMax.maxYears
                          : guardrailYears || 5;
                      const yrs = Math.min(Number(e.target.value), maxYearsOption);
                      const raisePct =
                        signingGuardrails?.raisePct ?? extension.raisePct ?? 0.05;
                      const firstYear = isSigningAction
                        ? clampFirstYearToGuardrails(
                            extension.salaries?.[0] ??
                              signingGuardrails?.minFirstYear ??
                              0
                          )
                        : extension.salaries?.[0] || 0;
                      const salaries = isSigningAction
                        ? buildSalarySeries(firstYear, yrs, raisePct)
                        : Array.from(
                            { length: yrs },
                            (_, i) => extension.salaries[i] || 0
                          );
                      setExtension({
                        ...extension,
                        years: yrs,
                        salaries,
                        raisePct,
                      });
                      setSalaryInputs(toSalaryInputs(salaries, yrs));
                    }}
                    className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((yr) => {
                      const maxYearsOption =
                        selectedAction === 'extend' && extMax?.maxYears
                          ? extMax.maxYears
                          : isSigningAction && signingGuardrails?.maxYears
                            ? Math.min(signingGuardrails.maxYears, 5)
                            : 5;
                      return (
                        <option key={yr} value={yr} disabled={yr > maxYearsOption}>
                          {yr}yr
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {isSigningAction && signingGuardrails && (
                <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-white/70">
                  <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                    Rights/Exception: {signingGuardrails.source}
                    {playerRulesProfile?.birdRights?.type
                      ? ` (${playerRulesProfile.birdRights.type})`
                      : ''}
                  </span>
                  <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                    First-year range:{' '}
                    {formatCurrencyFull(signingGuardrails.minFirstYear || 0)} -{' '}
                    {signingGuardrails.maxFirstYear != null
                      ? formatCurrencyFull(signingGuardrails.maxFirstYear)
                      : 'Max'}
                  </span>
                  <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                    Raises up to {Math.round((signingGuardrails.raisePct || 0) * 100)}% • Max{' '}
                    {signingGuardrails.maxYears || '—'} yrs
                  </span>
                  {playerRulesProfile?.restrictedFreeAgency?.qualifyingOfferAmount ? (
                    <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-100">
                      QO: {formatCurrencyFull(playerRulesProfile.restrictedFreeAgency.qualifyingOfferAmount)}
                    </span>
                  ) : null}
                </div>
              )}

              {/* Salary Inputs Grid */}
              <div className="grid grid-cols-5 gap-2 bg-white/5 rounded-lg p-3">
                {Array.from({ length: 5 }, (_, idx) => {
                  const isActive = idx < extension.years;
                  const year = CURRENT_YEAR + idx + (selectedAction === 'extend' ? 1 : 0);
                  
                  return (
                    <div key={idx} className={`${isActive ? 'opacity-100' : 'opacity-30'}`}>
                      <div className="text-[10px] text-white/50 text-center mb-1 font-medium">
                        {year - 1}-{String(year % 100).padStart(2, '0')}
                      </div>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          disabled={!isActive}
                          value={salaryInputs[idx] || ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            const parsed = Number(raw);
                            const nextSalaries = (() => {
                              const arr = [...extension.salaries];
                              let nextVal = parsed;
                              if (isSigningAction && signingGuardrails) {
                                if (idx === 0) {
                                  nextVal = clampFirstYearToGuardrails(parsed);
                                } else if (signingGuardrails.raisePct != null) {
                                  const prevSalary = arr[idx - 1] || 0;
                                  const allowed = Math.round(
                                    prevSalary * (1 + signingGuardrails.raisePct)
                                  );
                                  nextVal = Math.min(parsed || 0, allowed);
                                }
                              }
                              arr[idx] = nextVal;
                              return arr;
                            })();
                            const activeYears =
                              extension.years || nextSalaries.length || 0;
                            setExtension((prev) => ({
                              ...prev,
                              salaries: nextSalaries,
                            }));
                            setSalaryInputs(
                              toSalaryInputs(nextSalaries, activeYears)
                            );
                          }}
                          className="w-full pl-5 pr-2 py-2 rounded bg-black/50 border border-white/10 text-xs text-white font-medium text-center focus:border-cyan-500 focus:bg-cyan-500/10 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Extension Eligibility Note */}
              {selectedAction === 'extend' && (
                <div className="mt-3 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-200 space-y-1">
                  {isExtendEligible && extMax ? (
                    <>
                      <div>
                        {`Up to ${extMax?.maxYears || 0} years — first-year range ${formatCurrencyFull(
                          extMax?.minFirstYearSalary ?? 0
                        )} to ${formatCurrencyFull(
                          extMax?.maxFirstYearSalary ?? 0
                        )}`}
                      </div>
                      <div className="text-[11px] text-orange-100/80">
                        Raises: {Math.round((extMax?.baseRaisePct || 0) * 100)}%
                        {extMax?.basedOn ? ` • ${extMax.basedOn}` : ''}
                      </div>
                      {(extMax?.notes || extMax?.type) && (
                        <div className="text-[11px] text-orange-100/60">
                          {extMax?.notes || extMax?.type}
                        </div>
                      )}
                    </>
                  ) : (
                    <span>
                      {`Not eligible: ${
                        playerRulesProfile?.extensionEligibility?.reason ||
                        extReason
                      }`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* === Validation Warnings === */}
          {selectedAction && (warnings.length > 0 || errors.length > 0) && (
            <ValidationWarnings
              warnings={warnings}
              errors={errors}
              showErrors={showValidationErrors}
            />
          )}

          {/* Footer Buttons */}
          <div className="mt-auto pt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // validation override allowed
                handleConfirm();
              }}
              disabled={disableConfirm}
              className={`px-6 py-2 text-sm font-bold rounded shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                !showForceState
                  ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/20'
                  : 'bg-red-600/80 hover:bg-red-500 text-white shadow-red-900/20'
              }`}
            >
              {!showForceState
                ? 'Confirm Action'
                : 'Force Action (Override Rules)'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditContractModal;
