import React from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import { TeamLogo } from '@/shared/components/TeamLogo';

type TradeExceptionLike = {
  id?: string | number;
  name?: string;
  amount?: number | string | null;
  remaining?: number | string | null;
  remainingAmount?: number | string | null;
  isUsed?: boolean;
  expirationDate?: string | null;
  expiresOn?: string | null;
};

interface TradeExceptionManagerProps {
  exceptions?: TradeExceptionLike[];
  teamId?: string;
}

function isTpeExpired(tpe: TradeExceptionLike) {
  const expiry = tpe.expirationDate || tpe.expiresOn;
  if (!expiry) return false;
  return new Date(expiry) <= new Date();
}

function getTpeRemaining(tpe: TradeExceptionLike): number | null {
  const value = Number(tpe.remainingAmount ?? tpe.remaining ?? tpe.amount);
  return Number.isFinite(value) ? value : null;
}

export const TradeExceptionManager = ({
  exceptions = [],
  teamId,
}: TradeExceptionManagerProps) => {
  const formatDate = (dateString?: string | null) => {
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
    <div className="border border-cockpit-edge rounded-lg p-3 mt-4 bg-cockpit-slab">
      <h3 className="font-medium text-sm mb-2 flex items-center">
        <TeamLogo teamId={teamId} className="w-5 h-5 mr-2" />
        Available Trade Exceptions
      </h3>

      {activeExceptions.length > 0 ? (
        <div className="space-y-2">
          {activeExceptions.map((tpe) => (
            <div
              key={tpe.id}
              className="flex justify-between items-center p-2 bg-cockpit-raised rounded border border-cockpit-edge"
            >
              <div>
                <div className="font-medium text-sm">
                  {tpe.name || 'Trade Exception'}
                </div>
                <div className="text-xs text-cockpit-text-secondary">
                  Expires: {formatDate(tpe.expirationDate ?? tpe.expiresOn)}
                </div>
              </div>
              <div className="font-mono text-cockpit-safe">
                {formatCurrency(getTpeRemaining(tpe))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-cockpit-text-secondary text-sm py-2">
          No active trade exceptions available
        </p>
      )}

      {expiredExceptions.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs text-cockpit-text-muted font-medium">
            Expired
          </div>
          {expiredExceptions.map((tpe) => (
            <div
              key={tpe.id}
              className="flex justify-between items-center p-2 bg-cockpit-raised rounded border border-cockpit-edge opacity-50"
            >
              <div>
                <div className="font-medium text-sm text-cockpit-text-muted">
                  {tpe.name || 'Trade Exception'}
                </div>
                <div className="text-xs text-cockpit-danger/60">
                  Expired: {formatDate(tpe.expirationDate ?? tpe.expiresOn)}
                </div>
              </div>
              <div className="font-mono text-cockpit-text-muted">
                {formatCurrency(getTpeRemaining(tpe))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-cockpit-text-muted border-t border-cockpit-edge pt-2">
        <p>Trade exceptions allow acquiring players without matching salary.</p>
        <p className="mt-1">
          Standard TPEs retain their unused governed component capacity for one
          year.
        </p>
      </div>
    </div>
  );
};
