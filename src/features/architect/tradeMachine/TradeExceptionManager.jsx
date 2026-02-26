import React from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import TeamLogo from '@/shared/components/TeamLogo';

/**
 * Check if a TPE is expired based on its expirationDate/expiresOn.
 * @param {Object} tpe - Normalized TPE object
 * @returns {boolean}
 */
function isTpeExpired(tpe) {
  const expiry = tpe.expirationDate || tpe.expiresOn;
  if (!expiry) return false;
  return new Date(expiry) <= new Date();
}

const TradeExceptionManager = ({
  exceptions = [],
  teamId,
}) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'No expiration';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const activeExceptions = exceptions.filter(
    (tpe) => !tpe.isUsed && !isTpeExpired(tpe)
  );
  const expiredExceptions = exceptions.filter(
    (tpe) => !tpe.isUsed && isTpeExpired(tpe)
  );

  return (
    <div className="border border-white/10 rounded-lg p-3 mt-4 bg-[#111]">
      <h3 className="font-medium text-sm mb-2 flex items-center">
        <TeamLogo teamId={teamId} className="w-5 h-5 mr-2" />
        Available Trade Exceptions
      </h3>

      {activeExceptions.length > 0 ? (
        <div className="space-y-2">
          {activeExceptions.map((tpe) => (
            <div
              key={tpe.id}
              className="flex justify-between items-center p-2 bg-[#222] rounded border border-white/5"
            >
              <div>
                <div className="font-medium text-sm">
                  {tpe.name || 'Trade Exception'}
                </div>
                <div className="text-xs text-white/60">
                  Expires: {formatDate(tpe.expirationDate)}
                </div>
              </div>
              <div className="font-mono text-green-400">
                {formatCurrency(tpe.amount)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-white/60 text-sm py-2">
          No active trade exceptions available
        </p>
      )}

      {expiredExceptions.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs text-white/40 font-medium">Expired</div>
          {expiredExceptions.map((tpe) => (
            <div
              key={tpe.id}
              className="flex justify-between items-center p-2 bg-[#1a1a1a] rounded border border-white/5 opacity-50"
            >
              <div>
                <div className="font-medium text-sm text-white/50">
                  {tpe.name || 'Trade Exception'}
                </div>
                <div className="text-xs text-red-400/60">
                  Expired: {formatDate(tpe.expirationDate)}
                </div>
              </div>
              <div className="font-mono text-white/40">
                {formatCurrency(tpe.amount)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-white/50 border-t border-white/5 pt-2">
        <p>Trade exceptions allow acquiring players without matching salary.</p>
        <p className="mt-1">
          Generated when receiving less salary than sent out.
        </p>
      </div>
    </div>
  );
};

export default TradeExceptionManager;
