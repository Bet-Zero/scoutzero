import React, { useState, useEffect } from 'react';
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
  });

  useEffect(() => {
    if (!teamSalary || !capSettings) return;

    const base = calculateAllowableIncoming(
      teamSalary,
      outgoingSalary,
      [],
      [],
      {
        ...capSettings,
        yearKey,
      }
    );
    const min =
      teamSalary > capSettings.cap
        ? incomingPlayers.reduce((sum, p) => {
            const s = getSalaryForYear([p], yearKey);
            return s <= MIN_SALARY ? sum + s : sum;
          }, 0)
        : 0;
    const tpe = tpes.reduce(
      (sum, t) => sum + (t.remaining ?? t.amount ?? 0),
      0
    );
    setBreakdown({ base, min, tpe });
    setAllowableIncoming(base + min + tpe);
  }, [teamSalary, outgoingSalary, incomingPlayers, tpes, capSettings, yearKey]);

  const isValid = incomingSalary <= allowableIncoming;

  return (
    <div className="border border-white/10 rounded-lg p-4 mt-4">
      <h3 className="font-medium mb-3">Salary Matching Calculator</h3>

      <div className="space-y-4">
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
              className={`font-mono p-2 rounded ${isValid ? 'bg-green-900/30' : 'bg-red-900/30'}`}
            >
              {formatCurrency(allowableIncoming)}
            </div>
          </div>
        </div>

        <div className="text-xs text-white/70 space-y-1">
          <div>Base: {formatCurrency(breakdown.base)}</div>
          {breakdown.min > 0 && (
            <div className="text-yellow-400">
              Min Exception: +{formatCurrency(breakdown.min)}
            </div>
          )}
          {breakdown.tpe > 0 && (
            <div>Using TPE: +{formatCurrency(breakdown.tpe)}</div>
          )}
        </div>

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

        <div
          className={`p-3 rounded ${isValid ? 'bg-green-900/20' : 'bg-red-900/20'}`}
        >
          <div className="font-medium">
            {isValid ? '✅ Valid Trade' : '❌ Invalid Trade'}
          </div>
          <div className="text-sm mt-1">
            {isValid
              ? 'This salary combination complies with CBA rules'
              : `Exceeds allowable incoming by ${formatCurrency(incomingSalary - allowableIncoming)}`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeSalaryCalculator;
