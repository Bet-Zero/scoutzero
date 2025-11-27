import React, { useState, useMemo } from 'react';
import { formatCurrency, getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
import { AlertTriangle, Clock } from 'lucide-react';

const processTPE = (tpe, playerSalary) => {
  const remaining =
    typeof tpe.remaining === 'number' ? tpe.remaining : tpe.amount;
  const expiry = tpe.expirationDate || tpe.expiry || tpe.expires;
  const expired = expiry ? new Date(expiry) <= new Date() : false;
  const tooSmall = remaining < playerSalary;
  return { ...tpe, remaining, expired, tooSmall };
};

const formatExpiryDate = (dateStr) => {
  if (!dateStr) return 'No expiration';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const TradeExceptionModal = ({
  player,
  isOpen,
  onClose,
  tradeExceptions = [],
  yearKey,
  onApply,
}) => {
  const [selectedTPE, setSelectedTPE] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const playerSalary = getSalaryForYear(player, yearKey);

  const enriched = useMemo(
    () => tradeExceptions.map((tpe) => processTPE(tpe, playerSalary)),
    [tradeExceptions, playerSalary]
  );

  const handleApply = async () => {
    if (!selectedTPE) return;

    setIsProcessing(true);
    try {
      await onApply(player, selectedTPE);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

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
              <p className="text-sm text-white/80 mb-2">
                Acquire {player.name} ({formatCurrency(playerSalary)}) using:
              </p>
              <p className="text-xs text-white/60 mb-4">
                Trade exceptions can only be used for players whose salary fits
                entirely within the exception amount.
              </p>

              <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
                {enriched.length > 0 ? (
                  enriched.map((tpe) => {
                    const disabled = tpe.isUsed || tpe.tooSmall || tpe.expired;
                    return (
                      <div
                        key={tpe.id}
                        className={`p-3 border rounded relative transition-all ${
                          selectedTPE?.id === tpe.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : disabled
                              ? 'border-white/5 bg-white/5'
                              : 'border-white/10 hover:border-white/30'
                        }`}
                        onClick={() => !disabled && setSelectedTPE(tpe)}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">
                            {tpe.name || 'Trade Exception'}
                          </span>
                          <div className="flex items-center">
                            <span>{formatCurrency(tpe.remaining)}</span>
                            {tpe.expired && (
                              <AlertTriangle className="w-4 h-4 text-yellow-400 ml-2" />
                            )}
                            {tpe.isBeingUsed && (
                              <Clock className="w-4 h-4 text-blue-400 ml-2" />
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-white/60 mt-1">
                          Expires: {formatExpiryDate(tpe.expiry)}
                        </div>
                        {tpe.tooSmall && (
                          <div className="text-xs text-red-400 mt-1">
                            Insufficient for player salary
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-white/60 py-4 text-center">
                    No available trade exceptions
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${
                selectedTPE &&
                !selectedTPE.tooSmall &&
                !selectedTPE.expired &&
                !selectedTPE.isUsed
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
              onClick={handleApply}
              disabled={
                !selectedTPE ||
                selectedTPE.tooSmall ||
                selectedTPE.expired ||
                selectedTPE.isUsed ||
                isProcessing
              }
            >
              {isProcessing ? 'Processing...' : 'Apply Exception'}
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
              disabled={isProcessing}
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
