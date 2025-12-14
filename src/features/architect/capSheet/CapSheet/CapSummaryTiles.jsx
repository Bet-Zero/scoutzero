import React from 'react';
import capProjections from '@/features/architect/utils/capProjections';
import { getContractYearSlice } from '@/features/architect/utils/contractUtils';
import { getActiveUnsignedCapHoldsTotalByEndYear } from '@/features/architect/utils/capHolds';
import {
  isHardCappedAtFirstApron,
  isHardCappedAtSecondApron,
  getFirstApronHardCapReason,
} from '@/features/architect/utils/hardCapUtils';
import { Lock } from 'lucide-react';

const CapSummaryTiles = ({ teamCapSheet, selectedYear }) => {
  const yearKey = `${selectedYear - 1}-${String(selectedYear % 100).padStart(
    2,
    '0'
  )}`;
  const capData = capProjections[yearKey] || {};

  const salaryCap = capData.cap || 0;
  const firstApron = capData.firstApron || 0;
  const secondApron = capData.secondApron || 0;

  // Determine if hard capped
  const isFirstApronHardCapped = isHardCappedAtFirstApron(
    teamCapSheet,
    selectedYear
  );
  const isSecondApronHardCapped = isHardCappedAtSecondApron(teamCapSheet);
  
  const firstApronReason = isFirstApronHardCapped ? getFirstApronHardCapReason(teamCapSheet) : '';

  // Calculate salary total from players
  const salaryTotal = (teamCapSheet?.players || []).reduce((sum, player) => {
    const seasonEntry = getContractYearSlice(player, selectedYear);
    const salary =
      seasonEntry?.capHit ??
      seasonEntry?.salary ??
      0;
    return sum + salary;
  }, 0);

  // Calculate cap holds total using shared utility
  // selectedYear is the END year (e.g., 2025 for "2024-25")
  const capHoldsTotal = getActiveUnsignedCapHoldsTotalByEndYear(
    teamCapSheet?.capHolds,
    selectedYear
  );

  const totalCapAllocations = salaryTotal + capHoldsTotal;

  const capSpace = salaryCap - totalCapAllocations;
  const firstApronSpace = firstApron - totalCapAllocations;
  const secondApronSpace = secondApron - totalCapAllocations;

  const formatMoney = (amount) =>
    `${amount < 0 ? '-' : ''}$${Math.abs(amount).toLocaleString()}`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-4">
      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10">
        <div className="text-sm text-white/70 mb-1">TOTAL CAP ALLOCATIONS</div>
        <div className="text-lg font-bold text-white">
          {formatMoney(totalCapAllocations)}
        </div>
      </div>

      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10">
        <div className="text-sm text-white/70 mb-1">CAP SPACE</div>
        <div
          className={`text-lg font-bold ${
            capSpace < 0 ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {formatMoney(capSpace)}
        </div>
      </div>

      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10 relative">
        <div className="text-sm text-white/70 mb-1">1ST APRON SPACE</div>
        <div
          className={`text-lg font-bold ${
            firstApronSpace < 0 ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {formatMoney(firstApronSpace)}
        </div>
        {isFirstApronHardCapped && (
          <div className="absolute bottom-2 left-2 group">
            <div className="bg-white/10 border border-white/20 rounded p-1 shadow-md backdrop-blur-md">
              <Lock size={14} className="text-white/90" />
            </div>
            {/* Tooltip */}
            <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-3 bg-[#151515] border border-white/10 shadow-xl rounded-md z-50 pointer-events-none text-center">
              <div className="text-xs font-bold text-white mb-0.5">
                Hard Capped at 1st Apron
              </div>
              <div className="text-[10px] text-white/50 leading-tight">
                {firstApronReason}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10 relative">
        <div className="text-sm text-white/70 mb-1">2ND APRON SPACE</div>
        <div
          className={`text-lg font-bold ${
            secondApronSpace < 0 ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {formatMoney(secondApronSpace)}
        </div>
        {isSecondApronHardCapped && (
          <div className="absolute bottom-2 left-2 bg-white/10 border border-white/20 rounded p-1 shadow-md backdrop-blur-md">
            <Lock size={14} className="text-white/90" />
          </div>
        )}
      </div>
    </div>
  );
};

export default CapSummaryTiles;
