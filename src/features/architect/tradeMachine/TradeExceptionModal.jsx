import React, { useState } from 'react';
import { formatCurrency } from '@/utils/architect/tradeHelpers';

const TradeExceptionModal = ({
  player,
  isOpen,
  onClose,
  tradeExceptions = [],
  yearKey,
  onApply,
}) => {
  const [selectedTPE, setSelectedTPE] = useState(null);
  const playerSalary =
    player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;

  const availableTPEs = tradeExceptions.filter(
    (tpe) => !tpe.isUsed && playerSalary <= tpe.amount
  );

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-black opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-[#1a1a1a] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg leading-6 font-medium text-white">
              Use Trade Exception
            </h3>
            <div className="mt-4">
              <p className="text-sm text-white/80">
                Acquire {player.name} ({formatCurrency(playerSalary)}) using:
              </p>

              <div className="mt-4 space-y-2">
                {availableTPEs.length > 0 ? (
                  availableTPEs.map((tpe) => (
                    <div
                      key={tpe.id}
                      className={`p-3 border rounded cursor-pointer ${
                        selectedTPE?.id === tpe.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                      onClick={() => setSelectedTPE(tpe)}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {tpe.name || 'Trade Exception'}
                        </span>
                        <span>{formatCurrency(tpe.amount)}</span>
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        Expires: {tpe.expirationDate || 'Unknown'}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/60">
                    No valid trade exceptions available
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${
                selectedTPE
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
              onClick={() => {
                if (selectedTPE) {
                  onApply(player, selectedTPE);
                  onClose();
                }
              }}
              disabled={!selectedTPE}
            >
              Apply Exception
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeExceptionModal;
