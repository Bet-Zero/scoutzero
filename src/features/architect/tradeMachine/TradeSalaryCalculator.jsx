import React, { useEffect, useState } from 'react';
import {
  formatCurrency,
  calculateAllowableIncoming,
  getSalaryForYear,
  MIN_SALARY,
} from '@/utils/architect/tradeHelpers';

const TradeSalaryCalculator = ({
  teamSalary,
  outgoingSalary,
  incomingPlayers = [],
  tpes = [],
  capSettings,
  yearKey,
}) => {
  const [incomingSalary, setIncomingSalary] = useState(0);
  const [allowableIncoming, setAllowableIncoming] = useState(0);
  const [breakdown, setBreakdown] = useState({
    base: 0,
    min: 0,
    tpe: 0,
    rule: '',
  });

  useEffect(() => {
    if (!teamSalary || !capSettings) return;

    // Calculate base allowable
    const base = calculateAllowableIncoming(
      teamSalary,
      outgoingSalary,
      [],
      [],
      capSettings,
      yearKey
    );

    // Calculate minimum salary exception
    const min =
      teamSalary > capSettings.cap
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

    // Determine which rule applies
    let rule;
    if (teamSalary > capSettings.secondApron) {
      rule = 'Second Apron: Dollar-for-dollar matching';
    } else if (teamSalary > capSettings.firstApron) {
      rule = 'First Apron: 110% of outgoing salary';
    } else if (teamSalary <= capSettings.cap) {
      rule = 'Under Cap: Outgoing + $100k + cap space';
    } else if (outgoingSalary <= 6_500_000) {
      rule = 'Normal: 175% + $100k (≤$6.5M outgoing)';
    } else if (outgoingSalary <= 19_600_000) {
      rule = 'Normal: 125% + $100k ($6.5M-$19.6M outgoing)';
    } else {
      rule = 'Normal: 125% (>$19.6M outgoing)';
    }

    setBreakdown({ base, min, tpe, rule });
    setAllowableIncoming(base + min + tpe);
  }, [teamSalary, outgoingSalary, incomingPlayers, tpes, capSettings, yearKey]);

  const isValid = incomingSalary <= allowableIncoming;

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
      </div>
    </div>
  );
};

export default TradeSalaryCalculator;
