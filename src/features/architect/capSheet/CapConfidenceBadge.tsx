import React from 'react';

/**
 * Confidence badge for league cap/apron/tax figures.
 *
 * The cap numbers (salary cap, aprons, luxury tax) are hand-maintained constants
 * in `capProjections.ts`. Each season carries a `confirmed` flag that the cap
 * rules resolver turns into a source tag (`_meta.rulesSourcesSummary`):
 *   real → Official | reported → Reported | projected → Projected | unknown
 *
 * This badge surfaces that tag so a *projected* season (e.g. a future year whose
 * official cap the NBA hasn't set yet) can never silently masquerade as official.
 * Shared by the Cap Sheet and the Trade Machine so both read identically.
 */

export type CapConfidenceSummary =
  | 'real'
  | 'reported'
  | 'projected'
  | 'unknown'
  | string;

interface CapConfidenceLabel {
  text: string;
  className: string;
}

const KNOWN_LABELS: Record<string, CapConfidenceLabel> = {
  real: {
    text: 'Official',
    className: 'text-green-400 bg-green-400/10 border-green-400/20',
  },
  reported: {
    text: 'Reported',
    className: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  },
  projected: {
    text: 'Projected',
    className: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  unknown: {
    text: 'Unknown',
    className: 'text-red-400 bg-red-400/10 border-red-400/20',
  },
};

/** Map a cap source summary to its display label, or null when absent. */
export function capConfidenceLabel(
  summary: CapConfidenceSummary | null | undefined
): CapConfidenceLabel | null {
  if (!summary) return null;
  return (
    KNOWN_LABELS[summary] ?? {
      text: String(summary),
      className: 'text-white/40 bg-white/5 border-white/10',
    }
  );
}

interface CapConfidenceBadgeProps {
  summary: CapConfidenceSummary | null | undefined;
  /** Optional leading text, e.g. a season label like "2026-27 cap ·". */
  prefix?: string;
  title?: string;
}

export const CapConfidenceBadge = ({
  summary,
  prefix,
  title,
}: CapConfidenceBadgeProps) => {
  const label = capConfidenceLabel(summary);
  if (!label) return null;
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${label.className}`}
      title={title}
      data-testid="cap-confidence-badge"
    >
      {prefix ? `${prefix} ` : ''}
      {label.text}
    </span>
  );
};
