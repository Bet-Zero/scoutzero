/**
 * FILE: src/features/architect/cockpit/TeamStatusTile.tsx
 * PURPOSE: Single tile primitive used by the persistent TeamStatusStrip.
 *          Label + value + colored posture pip + optional sub-line.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Phase 2A notes:
 *  - Pure presentation. No mutation authority.
 *  - Status pip colors come from cockpit status tokens
 *    (`bg-cockpit-safe`, `-watch`, `-danger`).
 */
import type { ReactNode } from 'react';

export type TeamStatusTone = 'safe' | 'watch' | 'danger' | 'neutral';

interface TeamStatusTileProps {
  label: string;
  value: string;
  sub?: string | null;
  tone?: TeamStatusTone;
  testId?: string;
  trailing?: ReactNode;
}

const PIP_CLASS: Record<TeamStatusTone, string> = {
  safe: 'bg-cockpit-safe',
  watch: 'bg-cockpit-watch',
  danger: 'bg-cockpit-danger',
  neutral: 'bg-white/30',
};

const VALUE_CLASS: Record<TeamStatusTone, string> = {
  safe: 'text-cockpit-text-primary',
  watch: 'text-cockpit-watch',
  danger: 'text-cockpit-danger',
  neutral: 'text-cockpit-text-primary',
};

export const TeamStatusTile = ({
  label,
  value,
  sub,
  tone = 'neutral',
  testId,
  trailing,
}: TeamStatusTileProps) => (
  <div
    className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 border-r border-cockpit-edge px-3 py-2 last:border-r-0"
    data-testid={testId}
    data-tone={tone}
  >
    <div className="flex items-center gap-1.5">
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
        {label}
      </span>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${PIP_CLASS[tone]}`}
        aria-hidden
      />
    </div>
    <div className="flex items-baseline gap-2">
      <span
        className={`truncate text-base font-semibold tabular-nums ${VALUE_CLASS[tone]}`}
        data-testid={testId ? `${testId}-value` : undefined}
      >
        {value}
      </span>
      {trailing ? (
        <span className="shrink-0 text-[10px] text-cockpit-text-muted">
          {trailing}
        </span>
      ) : null}
    </div>
    {sub ? (
      <span className="truncate text-[10px] text-cockpit-text-secondary">
        {sub}
      </span>
    ) : null}
  </div>
);
