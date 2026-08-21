/**
 * FILE: src/features/architect/cockpit/CapPostureMeter.tsx
 * PURPOSE: Compact horizontal cap/apron posture indicator for the TopBar.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Renders the three independent salary books and their relevant thresholds.
 * No mutation authority.
 */
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';

interface CapPostureMeterProps {
  context: ArchitectWorkspaceContext;
}

const formatMillions = (value: number | null) => {
  if (value === null) return 'Needs input';
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
        Salary books unavailable
      </div>
    );
  }

  let posture: 'safe' | 'watch' | 'danger' = 'safe';
  let postureLabel = cap.capSpace === null
    ? 'Team Salary needs input'
    : `${formatMillions(Math.abs(cap.capSpace))} ${cap.isOverCap ? 'over' : 'under'} Cap`;
  if (cap.isAboveSecondApron === true && cap.secondApronSpace !== null) {
    posture = 'danger';
    postureLabel = `${formatMillions(Math.abs(cap.secondApronSpace))} over Apron 2`;
  } else if (cap.isAtOrAboveFirstApron === true && cap.firstApronSpace !== null) {
    posture = 'danger';
    postureLabel = `${formatMillions(Math.abs(cap.firstApronSpace))} over Apron 1`;
  } else if (cap.isOverTax === true && cap.taxSpace !== null) {
    posture = 'watch';
    postureLabel = `${formatMillions(Math.abs(cap.taxSpace))} over Tax`;
  } else if (cap.isOverCap === true && cap.capSpace !== null) {
    posture = 'watch';
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
      data-team-salary={cap.teamSalary ?? 'needs-input'}
      data-apron-team-salary={cap.apronTeamSalary ?? 'needs-input'}
      data-tax-salary={cap.taxSalary ?? 'needs-input'}
      title={`Team Salary ${formatMillions(cap.teamSalary)} · Apron Team Salary ${formatMillions(cap.apronTeamSalary)} · Tax Salary ${formatMillions(cap.taxSalary)}`}
    >
      <div className="hidden items-center gap-2 md:flex" aria-label="Independent salary books">
        <span className="text-[10px] text-cockpit-text-muted">Team</span>
        <span className="text-[11px] text-cockpit-text-primary">{formatMillions(cap.teamSalary)}</span>
        <span className="text-[10px] text-cockpit-text-muted">Apron</span>
        <span className="text-[11px] text-cockpit-text-primary">{formatMillions(cap.apronTeamSalary)}</span>
        <span className="text-[10px] text-cockpit-text-muted">Tax</span>
        <span className="text-[11px] text-cockpit-text-primary">{formatMillions(cap.taxSalary)}</span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`text-[11px] font-semibold ${markerColor.replace('bg-', 'text-')}`}>
          {postureLabel}
        </span>
        <span className="text-[10px] text-cockpit-text-muted">
          {cap.seasonLabel}
        </span>
      </div>
    </div>
  );
};
