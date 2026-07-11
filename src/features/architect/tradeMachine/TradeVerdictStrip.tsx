/**
 * FILE: src/features/architect/tradeMachine/TradeVerdictStrip.tsx
 * PURPOSE: Team-attributed violations and warnings rendered inside the sticky
 *          verdict band so the reasons live at the point of decision (BZE-247).
 * OWNERSHIP: Feature: architect/tradeMachine
 */

import React from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import type { VerdictItem } from './verdictSummary';

interface TradeVerdictStripProps {
  items: VerdictItem[];
  /** Rows shown before collapsing into a "+N more" line. */
  maxRows?: number;
}

export const TradeVerdictStrip = ({
  items,
  maxRows = 4,
}: TradeVerdictStripProps) => {
  if (items.length === 0) return null;

  const visible = items.slice(0, maxRows);
  const hiddenCount = items.length - visible.length;

  return (
    <ul
      className="mt-1.5 space-y-0.5 rounded-md border border-cockpit-edge bg-cockpit-slab px-3 py-1.5"
      data-testid="trade-verdict-strip"
      aria-label="Trade verdict details"
    >
      {visible.map((item, index) => {
        const isViolation = item.kind === 'violation';
        const Icon = isViolation ? XCircle : AlertTriangle;
        return (
          <li
            key={`${item.teamName ?? 'trade'}-${index}`}
            className="flex items-start gap-1.5 text-xs leading-snug"
          >
            <Icon
              size={12}
              className={`mt-0.5 shrink-0 ${
                isViolation ? 'text-cockpit-danger' : 'text-cockpit-watch'
              }`}
            />
            <span
              className={
                isViolation ? 'text-cockpit-danger' : 'text-cockpit-watch'
              }
            >
              {item.teamName ? (
                <span className="font-semibold">{item.teamName} — </span>
              ) : null}
              {item.text}
            </span>
          </li>
        );
      })}
      {hiddenCount > 0 && (
        <li className="pl-[18px] text-[11px] text-cockpit-text-muted">
          +{hiddenCount} more in Validation Results below.
        </li>
      )}
    </ul>
  );
};
