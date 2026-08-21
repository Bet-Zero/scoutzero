/**
 * FILE: src/features/architect/cockpit/CapPostureMeter.tsx
 * PURPOSE: Compact horizontal cap/apron posture indicator for the TopBar.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Renders a Cap → Tax → Apron 1 → Apron 2 track with a marker showing the
 * team's current total. Pure presentation — reads workspace cap summary.
 * No mutation authority.
 */
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';

interface CapPostureMeterProps {
  context: ArchitectWorkspaceContext;
}

const formatMillions = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export const CapPostureMeter = ({ context }: CapPostureMeterProps) => {
  const cap = context.cap;

  if (cap.status !== 'available') {
    return (
      <div
        className="hidden items-center gap-2 rounded-md border border-cockpit-edge bg-cockpit-inlay px-2.5 py-1 text-[11px] text-cockpit-text-muted md:flex"
        data-testid="cockpit-cap-meter-unavailable"
      >
        Cap posture unavailable
      </div>
    );
  }

  const { totalCapAllocations, salaryCap, firstApron, secondApron } = cap;

  const min = Math.min(salaryCap, totalCapAllocations) * 0.92;
  const max = Math.max(secondApron, totalCapAllocations) * 1.04;
  const range = Math.max(1, max - min);
  const pct = (value: number) => Math.max(0, Math.min(100, ((value - min) / range) * 100));

  const markerPct = pct(totalCapAllocations);

  let posture: 'safe' | 'watch' | 'danger' = 'safe';
  let postureLabel = `${formatMillions(-cap.capSpace)} under Cap`;
  if (cap.isAboveSecondApron) {
    posture = 'danger';
    postureLabel = `${formatMillions(cap.totalCapAllocations - cap.secondApron)} over Apron 2`;
  } else if (cap.isAtOrAboveFirstApron) {
    posture = 'danger';
    postureLabel = `${formatMillions(cap.totalCapAllocations - cap.firstApron)} over Apron 1`;
  } else if (cap.isOverTax) {
    posture = 'watch';
    postureLabel = `${formatMillions(cap.totalCapAllocations - cap.luxuryTax)} over Tax`;
  } else if (cap.isOverCap) {
    posture = 'watch';
    postureLabel = `${formatMillions(cap.totalCapAllocations - cap.salaryCap)} over Cap`;
  } else {
    postureLabel = `${formatMillions(cap.capSpace)} under Cap`;
  }

  const markerColor = {
    safe: 'bg-cockpit-safe',
    watch: 'bg-cockpit-watch',
    danger: 'bg-cockpit-danger',
  }[posture];

  return (
    <div
      className="flex min-w-0 items-center gap-3 rounded-md border border-cockpit-edge bg-cockpit-inlay px-2.5 py-1"
      data-testid="cockpit-cap-meter"
      data-total-cap-allocations={totalCapAllocations}
      title={`Total ${formatMillions(totalCapAllocations)} · Cap ${formatMillions(salaryCap)} · Apron1 ${formatMillions(firstApron)} · Apron2 ${formatMillions(secondApron)}`}
    >
      <div className="relative h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-white/5 md:w-40">
        <div
          className="absolute inset-y-0 left-0 bg-white/10"
          style={{ width: `${pct(salaryCap)}%` }}
        />
        <div
          className="absolute inset-y-0 bg-cockpit-watch/30"
          style={{
            left: `${pct(salaryCap)}%`,
            width: `${Math.max(0, pct(firstApron) - pct(salaryCap))}%`,
          }}
        />
        <div
          className="absolute inset-y-0 bg-cockpit-danger/30"
          style={{
            left: `${pct(firstApron)}%`,
            width: `${Math.max(0, pct(secondApron) - pct(firstApron))}%`,
          }}
        />
        <div
          className={`absolute top-1/2 h-3 w-0.5 -translate-y-1/2 ${markerColor}`}
          style={{ left: `${markerPct}%` }}
          aria-hidden
        />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] font-semibold text-cockpit-text-primary">
          {formatMillions(totalCapAllocations)}
        </span>
        <span className={`text-[10px] ${posture === 'safe' ? 'text-cockpit-text-secondary' : posture === 'watch' ? 'text-cockpit-watch' : 'text-cockpit-danger'}`}>
          {postureLabel}
        </span>
      </div>
    </div>
  );
};
