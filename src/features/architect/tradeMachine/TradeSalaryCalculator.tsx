import React, { useState } from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import type {
  CapSettingsLike,
  TeamPlayerLike,
  TpeLike,
} from './validationPresentationTypes';

interface TradeSalaryCalculatorProps {
  teamSalary?: number;
  outgoingSalary?: number;
  incomingPlayers?: TeamPlayerLike[];
  tpes?: TpeLike[];
  capSettings?: CapSettingsLike | null;
  yearKey?: string | number | null;
  validatorAllowableIncoming?: number | null;
  validatorRule?: string | null;
  hasValidatorResult?: boolean;
  validatorSkipReason?: string | null;
}

export const TradeSalaryCalculator = ({
  validatorAllowableIncoming = null,
  validatorRule = null,
  hasValidatorResult = false,
  validatorSkipReason = null,
}: TradeSalaryCalculatorProps) => {
  const [counterfactualIncoming, setCounterfactualIncoming] = useState(0);

  if (!hasValidatorResult) {
    return (
      <div className="border border-cockpit-edge rounded-lg p-4 mt-4 bg-cockpit-slab">
        <h3 className="font-medium mb-2">Salary Path Counterfactual</h3>
        <p className="text-cockpit-text-secondary text-sm">
          Validate the elected path first. No generic matching estimate is used.
        </p>
      </div>
    );
  }

  const canCompare =
    validatorSkipReason == null && validatorAllowableIncoming != null;
  const wouldPass =
    canCompare && counterfactualIncoming <= validatorAllowableIncoming;

  return (
    <div className="border border-cockpit-edge rounded-lg p-4 mt-4 bg-cockpit-slab">
      <h3 className="font-medium mb-2">Salary Path Counterfactual</h3>
      <p className="text-xs text-cockpit-text-muted mb-4">
        Uses only the last official validation result for the elected component.
        Changing the trade or its path requires validation again.
      </p>

      {validatorSkipReason ? (
        <div className="text-sm text-cockpit-text-secondary">
          Salary matching not applicable ({validatorSkipReason}).
        </div>
      ) : validatorAllowableIncoming == null ? (
        <div className="text-sm text-cockpit-watch">
          Exact governed inputs are still required.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-cockpit-text-muted">Path limit</div>
              <div className="font-mono">
                {formatCurrency(validatorAllowableIncoming)}
              </div>
            </div>
            <div>
              <div className="text-xs text-cockpit-text-muted">Path</div>
              <div>{validatorRule || 'Elected salary path'}</div>
            </div>
          </div>
          <label className="block text-xs text-cockpit-text-secondary">
            Test another incoming total
            <input
              type="number"
              min="0"
              step="0.01"
              value={counterfactualIncoming}
              onChange={(event) =>
                setCounterfactualIncoming(Number(event.target.value) || 0)
              }
              className="mt-1 w-full rounded border border-cockpit-edge bg-cockpit-raised px-2 py-1.5 font-mono text-cockpit-text-primary"
            />
          </label>
          <div
            className={`rounded border px-3 py-2 text-sm ${
              wouldPass
                ? 'border-cockpit-safe/30 bg-cockpit-safe/15 text-cockpit-safe'
                : 'border-cockpit-danger/30 bg-cockpit-danger/15 text-cockpit-danger'
            }`}
          >
            {wouldPass
              ? `Within the validated path by ${formatCurrency(
                  validatorAllowableIncoming - counterfactualIncoming
                )}.`
              : `Exceeds the validated path by ${formatCurrency(
                  counterfactualIncoming - validatorAllowableIncoming
                )}.`}
          </div>
        </div>
      )}
    </div>
  );
};
