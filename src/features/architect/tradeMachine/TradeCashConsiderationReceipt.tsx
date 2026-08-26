import React from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
import type { GovernedCashEvaluation } from '@/schemas/governedCashConsideration';

interface TradeCashConsiderationReceiptProps {
  evaluation: GovernedCashEvaluation;
}

function formatCents(value: number | null): string {
  return value === null ? 'Needs input' : formatCurrency(value / 100);
}

function statusClass(status: GovernedCashEvaluation['status']): string {
  if (status === 'PASS') return 'text-cockpit-safe';
  if (status === 'FAIL') return 'text-cockpit-danger';
  return 'text-cockpit-watch';
}

export function TradeCashConsiderationReceipt({
  evaluation,
}: TradeCashConsiderationReceiptProps) {
  if (evaluation.status === 'NOT_APPLICABLE') return null;

  return (
    <section
      className="mb-2 border-y border-cockpit-edge py-2 text-[11px]"
      data-testid={`trade-cash-consideration-${evaluation.teamId.toLowerCase()}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-cockpit-info">
          Cash consideration
        </span>
        <span className={statusClass(evaluation.status)}>
          {evaluation.status.replace('_', ' ')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-cockpit-text-secondary">
        <span>Paid now</span>
        <span className="text-right font-mono text-cockpit-text-primary">
          {formatCents(evaluation.cashSentCents)}
        </span>
        <span>Received now</span>
        <span className="text-right font-mono text-cockpit-text-primary">
          {formatCents(evaluation.cashReceivedCents)}
        </span>
        <span>Annual paid</span>
        <span className="text-right font-mono text-cockpit-text-primary">
          {formatCents(evaluation.projectedPaidCents)} /{' '}
          {formatCents(evaluation.annualLimitCents)}
        </span>
        <span>Annual received</span>
        <span className="text-right font-mono text-cockpit-text-primary">
          {formatCents(evaluation.projectedReceivedCents)} /{' '}
          {formatCents(evaluation.annualLimitCents)}
        </span>
      </div>
      {evaluation.salaryCapYear !== null && (
        <div className="mt-1 text-cockpit-text-muted">
          Salary Cap Year {evaluation.salaryCapYear}
        </div>
      )}
      {evaluation.missingInputs.length > 0 && (
        <div className="mt-1 text-cockpit-watch">
          Needs: {evaluation.missingInputs.join(', ')}
        </div>
      )}
      {evaluation.violations.map((violation) => (
        <div key={violation} className="mt-1 text-cockpit-danger">
          {violation}
        </div>
      ))}
    </section>
  );
}
