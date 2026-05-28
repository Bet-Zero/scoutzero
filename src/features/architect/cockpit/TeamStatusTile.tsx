/**
 * FILE: src/features/architect/cockpit/TeamStatusTile.tsx
 * PURPOSE: Single tile primitive for the persistent TeamStatusStrip. Visual
 *          treatment matches the legacy CapSummaryTiles so the chrome
 *          recognizably inherits the existing Cap Sheet style at a smaller
 *          scale.
 * OWNERSHIP: Feature: architect/cockpit
 */
import type { ReactNode } from 'react';

interface TeamStatusTileProps {
  label: string;
  value: string;
  valueClassName?: string;
  testId?: string;
  /** Optional bottom-left badge (e.g. a hard-cap lock). */
  badge?: ReactNode;
  /** Optional bottom-center sub-line (kept very small; chrome-scale). */
  sub?: ReactNode;
}

export const TeamStatusTile = ({
  label,
  value,
  valueClassName = 'text-white',
  testId,
  badge,
  sub,
}: TeamStatusTileProps) => (
  <div
    className="relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-md border border-white/10 bg-[#1c1c1c] px-2 py-1 text-center"
    data-testid={testId}
  >
    <div className="truncate text-[10px] uppercase tracking-wider text-white/70">
      {label}
    </div>
    <div
      className={`truncate text-sm font-bold leading-tight tabular-nums ${valueClassName}`}
      data-testid={testId ? `${testId}-value` : undefined}
    >
      {value}
    </div>
    {sub ? (
      <div className="truncate text-[9px] leading-tight text-white/50">
        {sub}
      </div>
    ) : null}
    {badge ? <div className="absolute bottom-1 left-1">{badge}</div> : null}
  </div>
);
