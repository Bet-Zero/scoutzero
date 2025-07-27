import React from 'react';
import { formatCurrency } from '@/utils/architect/tradeHelpers';
import TeamLogo from '@/components/shared/TeamLogo';

const TradeExceptionManager = ({
  exceptions = [],
  teamId,
  onApplyException,
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

  return (
    <div className="border border-white/10 rounded-lg p-3 mt-4 bg-[#111]">
      <h3 className="font-medium text-sm mb-2 flex items-center">
        <TeamLogo teamId={teamId} className="w-5 h-5 mr-2" />
        Available Trade Exceptions
      </h3>

      {exceptions.length > 0 ? (
        <div className="space-y-2">
          {exceptions
            .filter((tpe) => !tpe.isUsed)
            .map((tpe) => (
              <div
                key={tpe.id}
                className="flex justify-between items-center p-2 bg-[#222] rounded border border-white/5 hover:border-white/20 transition-colors"
                onClick={() => onApplyException(tpe)}
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
