/**
 * FILE: src/features/architect/cockpit/TeamStatusStrip.tsx
 * PURPOSE: Persistent team-status strip below the cockpit TopBar.
 *          Surfaces the 5 cap-summary stats (Total Cap, Cap Space, Luxury
 *          Tax Space, 1st Apron Space, 2nd Apron Space) plus roster size
 *          and active exception flags. Always visible, every room.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Phase 2A notes:
 *  - Pure presentation. Reads from useArchitectWorkspaceContext only.
 *  - Replaces the legacy CapSummaryTiles render inside the Cap Sheet
 *    room AND the half-meter / roster chip previously in the TopBar.
 *  - Sized as a fixed-height strip (shrink-0) so the workbench keeps
 *    its no-page-scroll guarantee.
 */
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { TeamStatusTile, type TeamStatusTone } from './TeamStatusTile';

interface TeamStatusStripProps {
  workspace: ArchitectWorkspaceContext;
}

const formatMillions = (value: number): string => {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const formatTotal = (value: number): string => {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

// Posture tone helpers — each respects the "space" semantics of the field:
// positive space = under the threshold (safe), zero or negative = over.
const capSpaceTone = (cap: Extract<ArchitectWorkspaceContext['cap'], { status: 'available' }>): TeamStatusTone =>
  cap.isOverCap ? 'watch' : 'safe';

const taxSpaceTone = (cap: Extract<ArchitectWorkspaceContext['cap'], { status: 'available' }>): TeamStatusTone =>
  cap.isOverTax ? 'watch' : 'safe';

const firstApronTone = (cap: Extract<ArchitectWorkspaceContext['cap'], { status: 'available' }>): TeamStatusTone =>
  cap.isAtOrAboveFirstApron ? 'danger' : 'safe';

const secondApronTone = (cap: Extract<ArchitectWorkspaceContext['cap'], { status: 'available' }>): TeamStatusTone =>
  cap.isAboveSecondApron ? 'danger' : 'safe';

const rosterTone = (count: number): TeamStatusTone => {
  if (count < 13) return 'danger'; // below NBA roster minimum
  if (count < 14) return 'watch';
  return 'safe';
};

const exceptionsLabel = (
  exc: ArchitectWorkspaceContext['exceptions']
): string | null => {
  if (exc.status !== 'available') return null;
  const flags: string[] = [];
  if (exc.hasAvailableMle) flags.push('MLE');
  if (exc.hasAvailableBae) flags.push('BAE');
  if (exc.hasAvailableRoom) flags.push('Room');
  if (exc.tpeCount > 0) flags.push(`TPE×${exc.tpeCount}`);
  return flags.length ? flags.join(' · ') : null;
};

export const TeamStatusStrip = ({ workspace }: TeamStatusStripProps) => {
  const cap = workspace.cap;
  const roster = workspace.roster;

  // While cap data is loading or unavailable, render a placeholder strip so
  // the cockpit shell's vertical rhythm stays stable.
  if (cap.status !== 'available') {
    return (
      <div
        className="flex shrink-0 items-center gap-3 border-b border-cockpit-edge bg-cockpit-bar/60 px-4 py-3 text-xs text-cockpit-text-muted"
        style={{ minHeight: 72 }}
        data-testid="cockpit-team-status-strip"
        data-state="unavailable"
      >
        Cap posture is loading…
      </div>
    );
  }

  const rosterCount =
    roster.status === 'available' ? roster.count : null;
  const exceptionFlags = exceptionsLabel(workspace.exceptions);

  return (
    <section
      className="flex shrink-0 items-stretch border-b border-cockpit-edge bg-cockpit-bar"
      style={{ minHeight: 72 }}
      data-testid="cockpit-team-status-strip"
      data-state="ready"
      aria-label="Team financial posture"
    >
      <TeamStatusTile
        testId="cockpit-status-total-cap"
        label="Total Cap"
        value={formatTotal(cap.totalCapAllocations)}
        sub={cap.seasonLabel}
        tone="neutral"
      />
      <TeamStatusTile
        testId="cockpit-status-cap-space"
        label="Cap Space"
        value={formatMillions(cap.capSpace)}
        sub={cap.isOverCap ? 'Over cap' : 'Under cap'}
        tone={capSpaceTone(cap)}
      />
      <TeamStatusTile
        testId="cockpit-status-tax-space"
        label="Luxury Tax Space"
        value={formatMillions(cap.taxSpace)}
        sub={cap.isOverTax ? 'Over tax' : 'Under tax'}
        tone={taxSpaceTone(cap)}
      />
      <TeamStatusTile
        testId="cockpit-status-apron1"
        label="1st Apron Space"
        value={formatMillions(cap.firstApronSpace)}
        sub={cap.isAtOrAboveFirstApron ? 'At / over Apron 1' : 'Under Apron 1'}
        tone={firstApronTone(cap)}
      />
      <TeamStatusTile
        testId="cockpit-status-apron2"
        label="2nd Apron Space"
        value={formatMillions(cap.secondApronSpace)}
        sub={cap.isAboveSecondApron ? 'Over Apron 2' : 'Under Apron 2'}
        tone={secondApronTone(cap)}
      />
      <TeamStatusTile
        testId="cockpit-status-roster"
        label="Roster"
        value={rosterCount !== null ? `${rosterCount} / 15` : '—'}
        sub={exceptionFlags ? `Exc · ${exceptionFlags}` : 'No active exceptions'}
        tone={rosterCount !== null ? rosterTone(rosterCount) : 'neutral'}
      />
    </section>
  );
};
