import React, { useEffect, useState, useMemo } from 'react';
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
 */
const TradeSalaryCalculator = ({
  teamSalary,
  outgoingSalary,
  incomingPlayers = [],
  tpes = [],
  capSettings,
  yearKey,
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
  const isValid = incomingSalary <= allowableIncoming;

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
      <h3 className="font-medium mb-3">Salary Matching Calculator</h3>

      <div className="space-y-4">
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
          </div>
        </div>

        {/* Rule Breakdown */}
        <div className="bg-[#222] p-3 rounded border border-white/10">
          <div className="text-xs text-white/70 mb-2">
            <span className="font-semibold">Rule Applied:</span>{' '}
            {breakdown.rule}
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
        <div
          className={`p-3 rounded ${
            isValid ? 'bg-green-900/20' : 'bg-red-900/20'
          }`}
        >
          <div className="font-medium flex items-center">
            {isValid ? (
              <>
                <span className="text-green-400 mr-2">✓</span>
                <span>Valid Trade</span>
              </>
            ) : (
              <>
                <span className="text-red-400 mr-2">✗</span>
                <span>Invalid Trade</span>
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

        {/* Phase 2.6: Disclaimer — validator is authoritative */}
        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/40 italic">
          Exploratory tool — validator is authoritative for final trade.
        </div>
      </div>
    </div>
  );
};

export default TradeSalaryCalculator;
