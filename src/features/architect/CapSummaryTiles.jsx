import React from 'react';
import capProjections from '@/utils/architect/capProjections';

const CapSummaryTiles = ({ teamCapSheet, selectedYear }) => {
  const yearKey = `${selectedYear}-${String((selectedYear + 1) % 100).padStart(
    2,
    '0'
  )}`;
  const capData = capProjections[yearKey] || {};

  const salaryCap = capData.cap || 0;
  const firstApron = capData.firstApron || 0;
  const secondApron = capData.secondApron || 0;

  const totalCapAllocations = teamCapSheet.players.reduce((sum, player) => {
    const salary =
      player.contract_clean?.salaries_by_year?.[selectedYear]?.salary || 0;
    const holdAmount =
      typeof player.cap_hold === 'number'
        ? player.cap_hold
        : player.cap_hold?.amount || 0;
    const isActive =
      typeof player.cap_hold === 'object'
        ? player.cap_hold?.active
        : holdAmount > 0;
    const capHold = !salary && isActive ? holdAmount : 0;
    return sum + salary + capHold;
  }, 0);

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

      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10">
        <div className="text-sm text-white/70 mb-1">1ST APRON SPACE</div>
        <div
          className={`text-lg font-bold ${
            firstApronSpace < 0 ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {formatMoney(firstApronSpace)}
        </div>
      </div>

      <div className="bg-[#1c1c1c] rounded p-4 text-center border border-white/10">
        <div className="text-sm text-white/70 mb-1">2ND APRON SPACE</div>
        <div
          className={`text-lg font-bold ${
            secondApronSpace < 0 ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {formatMoney(secondApronSpace)}
        </div>
      </div>
    </div>
  );
};

export default CapSummaryTiles;
