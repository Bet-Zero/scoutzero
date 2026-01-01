import React, { useState, useMemo } from 'react';
import {
  formatCurrency,
  getSalaryForYear,
  MIN_SALARY,
} from '@/features/architect/utils/tradeHelpers';
import {
  getSalaryMatchingResult,
  SALARY_MATCHING_RULE_LABELS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';

/**
 * TradeSalaryCalculator - displays salary matching rules using the unified rules module
 * This component MUST use getSalaryMatchingResult to ensure consistency with the validator
 * 
 * P2 Policy: This is an exploratory tool and the ONLY exception to Invariant 2.
 * It MUST visually separate "Sandbox Estimate" from "Official Validator" values.
 * 
 * P2 Lock-in: Non-misleading guardrails (January 2026)
 * - MUST NOT show green "Valid Trade (Sandbox)" when cap settings are missing/zero
 * - MUST NOT show green "Valid Trade (Sandbox)" when validator indicates salary matching is N/A (skip reason)
 * - MUST show "Validator wins" context when sandbox contradicts official result
 */
const TradeSalaryCalculator = ({
  teamSalary,
  outgoingSalary,
  incomingPlayers = [],
  tpes = [],
  capSettings,
  yearKey,
  // P2: Accept official validator result for comparison
  validatorAllowableIncoming = null,
  validatorRule = null,
  hasValidatorResult = false,
  // P2 Lock-in: Accept skip reason from validator (e.g., 'HARD_CAP_SKIP', 'TPE_ABSORPTION', etc.)
  validatorSkipReason = null,
}) => {
  const [incomingSalary, setIncomingSalary] = useState(0);

  // Use unified salary matching rules for calculation
  const matchingResult = useMemo(() => {
    if (!teamSalary || !capSettings) return null;

    return getSalaryMatchingResult({
      teamTotalSalary: teamSalary,
      outgoingSalary: outgoingSalary || 0,
      capSettings: {
        salaryCap: capSettings.salaryCap || capSettings.cap,
        firstApron: capSettings.firstApron,
        secondApron: capSettings.secondApron,
      },
    });
  }, [teamSalary, outgoingSalary, capSettings]);

  // Calculate additional allowances (TPE, min salary exceptions)
  const breakdown = useMemo(() => {
    if (!matchingResult || !teamSalary || !capSettings) {
      return { base: 0, min: 0, tpe: 0, rule: '', formula: '' };
    }

    const base = matchingResult.allowableIncoming;

    // Calculate minimum salary exception
    const min =
      teamSalary > (capSettings.salaryCap || capSettings.cap)
        ? incomingPlayers.reduce((sum, p) => {
            const s = getSalaryForYear([p], yearKey);
            return s <= MIN_SALARY ? sum + s : sum;
          }, 0)
        : 0;

    // Calculate TPE amount
    const tpe = tpes.reduce(
      (sum, t) => sum + (t.remaining ?? t.amount ?? 0),
      0
    );

    return {
      base,
      min,
      tpe,
      rule: matchingResult.ruleLabel,
      formula: matchingResult.formulaUsed,
    };
  }, [matchingResult, teamSalary, capSettings, incomingPlayers, tpes, yearKey]);

  const allowableIncoming = breakdown.base + breakdown.min + breakdown.tpe;
  
  // P2 Lock-in: Check if cap settings are missing or have zero critical values
  const capSettingsMissing = !capSettings;
  const capSettingsZero = capSettings && (
    (!capSettings.salaryCap && !capSettings.cap) ||
    (capSettings.salaryCap === 0 && capSettings.cap === 0)
  );
  const hasInvalidCapSettings = capSettingsMissing || capSettingsZero;
  
  // P2 Lock-in: Sandbox success should be disabled when:
  // 1. Cap settings are missing/zero
  // 2. Validator indicates salary matching is N/A (skip reason present)
  // 3. Validator result exists and sandbox isValid contradicts it
  const sandboxDisabledReason = useMemo(() => {
    if (hasInvalidCapSettings) {
      return 'Missing cap settings';
    }
    if (validatorSkipReason) {
      return `Salary matching not applicable (${validatorSkipReason})`;
    }
    return null;
  }, [hasInvalidCapSettings, validatorSkipReason]);

  const isSandboxDisabled = !!sandboxDisabledReason;
  const isValid = !isSandboxDisabled && incomingSalary <= allowableIncoming;

  // P2: Detect if sandbox differs from official by more than $1
  const officialDiffers = hasValidatorResult && 
    validatorAllowableIncoming != null && 
    Math.abs(allowableIncoming - validatorAllowableIncoming) > 1;
    
  // P2 Lock-in: Detect if validator result contradicts sandbox
  // If validator has allowableIncoming and sandbox says valid but official would say invalid (or vice versa)
  const validatorContradictsSandbox = hasValidatorResult && 
    validatorAllowableIncoming != null &&
    !isSandboxDisabled &&
    ((incomingSalary <= allowableIncoming) !== (incomingSalary <= validatorAllowableIncoming));

  // Don't render until we have required data
  if (!matchingResult) {
    return (
      <div className="border border-white/10 rounded-lg p-4 mt-4 bg-[#111]">
        <h3 className="font-medium mb-3">Salary Matching Calculator</h3>
        <p className="text-white/60 text-sm">
          Missing cap settings or team salary data
        </p>
      </div>
    );
  }

  return (
    <div className="border border-white/10 rounded-lg p-4 mt-4 bg-[#111]">
      {/* P2: Prominent disclaimer at top */}
      <div className="mb-4 px-3 py-2 bg-amber-900/20 border border-amber-600/30 rounded text-xs text-amber-300">
        ⚠️ <strong>Exploratory tool</strong> — validator is authoritative for final trade legality.
      </div>

      <h3 className="font-medium mb-3">Salary Matching Calculator</h3>

      <div className="space-y-4">
        {/* P2: Official Validator Section (when available) - ALWAYS show when hasValidatorResult */}
        {hasValidatorResult && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
            <div className="text-xs font-semibold text-blue-300 mb-2 flex items-center gap-1">
              <span>✓</span> Official Validator Result
            </div>
            {/* P2 Lock-in: Show skip reason when salary matching is N/A */}
            {validatorSkipReason ? (
              <div className="text-sm text-blue-100">
                <span className="text-blue-200/60">Status: </span>
                Salary matching not applicable ({validatorSkipReason})
              </div>
            ) : validatorAllowableIncoming != null ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-blue-200/60 mb-1">Allowable Incoming</div>
                  <div className="font-mono text-blue-100">{formatCurrency(validatorAllowableIncoming)}</div>
                </div>
                {validatorRule && (
                  <div>
                    <div className="text-xs text-blue-200/60 mb-1">Rule Applied</div>
                    <div className="text-blue-100">{validatorRule}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-blue-100/60">
                Validator result available but no allowable incoming value
              </div>
            )}
          </div>
        )}

        {/* P2: Sandbox Estimate Section */}
        <div className={`rounded p-3 ${hasValidatorResult ? 'bg-white/5 border border-white/10' : ''}`}>
          <div className="text-xs font-semibold text-white/60 mb-3 flex items-center gap-1">
            {hasValidatorResult ? (
              <>
                <span className="text-yellow-400">⚡</span> Sandbox Estimate (local calculation)
              </>
            ) : (
              'Sandbox Estimate'
            )}
          </div>

          {/* Salary Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">
                Outgoing Salary
              </label>
              <div className="font-mono bg-[#222] p-2 rounded">
                {formatCurrency(outgoingSalary)}
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">
                Allowable Incoming
              </label>
              <div
                className={`font-mono p-2 rounded ${
                  isValid ? 'bg-green-900/30' : 'bg-red-900/30'
                }`}
              >
                {formatCurrency(allowableIncoming)}
              </div>
              {/* P2: Show official value if it differs */}
              {officialDiffers && (
                <div className="text-xs text-blue-300 mt-1">
                  Validator will use: {formatCurrency(validatorAllowableIncoming)}
                </div>
              )}
            </div>
          </div>

          {/* Rule Breakdown */}
          <div className="bg-[#222] p-3 rounded border border-white/10 mt-4">
            <div className="text-xs text-white/70 mb-2">
              <span className="font-semibold">Rule Applied:</span>{' '}
              {breakdown.rule}
              {/* P2: Note if validator uses different rule */}
              {hasValidatorResult && validatorRule && validatorRule !== breakdown.rule && (
                <span className="text-blue-300 ml-2">(Validator: {validatorRule})</span>
              )}
            </div>
            {breakdown.formula && (
              <div className="text-xs text-white/50 mb-2 font-mono">
                {breakdown.formula}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-white/60">Base</div>
                <div>{formatCurrency(breakdown.base)}</div>
              </div>
              <div className="text-center">
                <div className="text-white/60">TPEs</div>
                <div className={breakdown.tpe > 0 ? 'text-blue-300' : ''}>
                  +{formatCurrency(breakdown.tpe)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-white/60">Min Ex</div>
                <div className={breakdown.min > 0 ? 'text-green-300' : ''}>
                  +{formatCurrency(breakdown.min)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Test Input */}
        <div>
          <label className="block text-xs text-white/60 mb-1">
            Test Incoming Salary
          </label>
          <input
            type="number"
            value={incomingSalary}
            onChange={(e) => setIncomingSalary(Number(e.target.value) || 0)}
            className="w-full bg-[#222] border border-white/10 rounded px-3 py-2 font-mono"
            placeholder="Enter amount to test"
          />
        </div>

        {/* Validation Result */}
        {/* P2 Lock-in: Non-misleading guardrails - show different states based on sandbox validity */}
        {isSandboxDisabled ? (
          // P2 Lock-in Rule B: Sandbox disabled when cap settings missing/zero or validator skip reason exists
          <div className="p-3 rounded bg-neutral-800/50 border border-neutral-600/30">
            <div className="font-medium flex items-center text-neutral-400">
              <span className="mr-2">⊘</span>
              <span>Sandbox Disabled</span>
            </div>
            <div className="text-sm mt-1 text-neutral-400">
              {sandboxDisabledReason}
            </div>
          </div>
        ) : validatorContradictsSandbox ? (
          // P2 Lock-in Rule C: Validator contradicts sandbox - show prominent "Validator wins" line
          <div className="p-3 rounded bg-amber-900/20 border border-amber-600/30">
            <div className="font-medium flex items-center text-amber-300">
              <span className="mr-2">⚠️</span>
              <span>Sandbox vs Validator Mismatch</span>
            </div>
            <div className="text-sm mt-1 text-amber-200/80">
              Sandbox: {incomingSalary <= allowableIncoming ? 'Valid' : 'Invalid'} | 
              <span className="font-semibold text-blue-300 ml-1">
                Validator (authoritative): {incomingSalary <= validatorAllowableIncoming ? 'Valid' : 'Invalid'}
              </span>
            </div>
            <div className="text-xs mt-2 text-amber-200/60 italic">
              The official validator result takes precedence over sandbox estimates.
            </div>
          </div>
        ) : (
          // Normal sandbox validation result
          <div
            className={`p-3 rounded ${
              isValid ? 'bg-green-900/20' : 'bg-red-900/20'
            }`}
          >
            <div className="font-medium flex items-center">
              {isValid ? (
                <>
                  <span className="text-green-400 mr-2">✓</span>
                  <span>Valid Trade (Sandbox)</span>
                </>
              ) : (
                <>
                  <span className="text-red-400 mr-2">✗</span>
                  <span>Invalid Trade (Sandbox)</span>
                </>
              )}
            </div>
            <div className="text-sm mt-1">
              {isValid ? (
                'This salary combination complies with CBA rules'
              ) : (
                <>
                  Exceeds allowable incoming by{' '}
                  <span className="font-semibold">
                    {formatCurrency(incomingSalary - allowableIncoming)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeSalaryCalculator;
