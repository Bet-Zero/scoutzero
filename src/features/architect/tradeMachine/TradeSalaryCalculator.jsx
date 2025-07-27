import React, { useState, useEffect } from 'react';
import { formatCurrency } from '@/utils/architect/tradeHelpers';

const TradeSalaryCalculator = ({ teamSalary, outgoingSalary, capSettings }) => {
  const [incomingSalary, setIncomingSalary] = useState(0);
  const [allowableIncoming, setAllowableIncoming] = useState(0);

  useEffect(() => {
    if (!teamSalary || !capSettings) return;

    const { cap } = capSettings;
    const overCap = teamSalary > cap;
    let allowable = 0;

    if (!overCap) {
      allowable = outgoingSalary + 250000 + Math.max(0, cap - teamSalary);
    } else if (outgoingSalary < 6530000) {
      allowable = outgoingSalary * 1.75 + 100000;
    } else if (outgoingSalary < 19600000) {
      allowable = outgoingSalary * 1.25 + 100000;
    } else {
      allowable = outgoingSalary * 1.25;
    }

    setAllowableIncoming(allowable);
  }, [teamSalary, outgoingSalary, capSettings]);

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
