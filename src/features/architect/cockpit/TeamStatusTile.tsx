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
  /** Optional inline marker shown next to the value (e.g. a hard-cap lock). */
  badge?: ReactNode;
}

export const TeamStatusTile = ({
  label,
  value,
  valueClassName = 'text-white',
  testId,
  badge,
}: TeamStatusTileProps) => (
  <div
    className="flex h-[46px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border border-white/10 bg-[#1c1c1c] px-1.5 text-center"
    data-testid={testId}
  >
    <div className="w-full truncate text-[9px] uppercase tracking-wider text-white/55">
      {label}
    </div>
    <div className="flex w-full items-center justify-center gap-1">
      {badge}
      <span
        className={`min-w-0 truncate text-[13px] font-bold leading-tight tabular-nums ${valueClassName}`}
        data-testid={testId ? `${testId}-value` : undefined}
      >
        {value}
      </span>
    </div>
  </div>
);
