/**
 * FILE: src/features/architect/cockpit/TeamStatusStrip.tsx
 * PURPOSE: Persistent team-status strip below the cockpit TopBar. Surfaces
 *          the 5 cap-summary stats (Total Cap, Cap Space, Luxury Tax Space,
 *          1st Apron Space, 2nd Apron Space) plus roster count and active
 *          exception flags. Always visible, every room.
 *
 *          Visual treatment mirrors the legacy CapSummaryTiles so the
 *          chrome looks like the existing Cap Sheet tiles at chrome scale —
 *          same formatMoney, same red/green semantics, same hard-cap lock
 *          icon on apron tiles.
 * OWNERSHIP: Feature: architect/cockpit
 */
import { Lock } from 'lucide-react';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { TeamStatusTile } from './TeamStatusTile';

export type HardCapCockpitStatus = {
  isHardCapped: boolean;
  hardCapCeilingType: 'FIRST_APRON' | 'SECOND_APRON' | string | null;
  hardCapCeilingLabel: string | null;
  reason: string | null;
} | null;

interface TeamStatusStripProps {
  workspace: ArchitectWorkspaceContext;
  hardCapStatus?: HardCapCockpitStatus;
}

const formatMoney = (amount: number): string => {
  if (!Number.isFinite(amount)) return '—';
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString()}`;
};

const exceptionFlagsLabel = (
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

const HardCapLock = ({ heading, reason }: { heading: string; reason: string }) => (
  <div className="group relative" data-testid="cockpit-status-hard-cap-lock">
    <div className="rounded border border-white/20 bg-white/10 p-0.5">
      <Lock size={10} className="text-white/90" />
    </div>
    <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-48 rounded-md border border-white/10 bg-[#151515] p-2 text-center shadow-xl group-hover:block">
      <div className="text-[11px] font-bold text-white">{heading}</div>
      {reason ? (
        <div className="mt-0.5 text-[10px] leading-tight text-white/60">
          {reason}
        </div>
      ) : null}
    </div>
  </div>
);

export const TeamStatusStrip = ({
  workspace,
  hardCapStatus = null,
}: TeamStatusStripProps) => {
  const cap = workspace.cap;

  if (cap.status !== 'available') {
    return (
      <div
        className="flex shrink-0 items-center border-b border-cockpit-edge bg-cockpit-bar px-4 py-2 text-[11px] text-white/40"
        data-testid="cockpit-team-status-strip"
        data-state="unavailable"
      >
        Cap posture is loading…
      </div>
    );
  }

  const rosterCount =
    workspace.roster.status === 'available' ? workspace.roster.count : null;
  const excFlags = exceptionFlagsLabel(workspace.exceptions);

  const spaceColor = (space: number) =>
    space < 0 ? 'text-red-400' : 'text-green-400';

  // Apron hard-cap badges only appear when the user is viewing the world's
  // current season (per the legacy CapSummaryTiles boundary).
  const onCurrentSeason =
    workspace.seasons.viewingSeasonDiffersFromWorldSeason === false ||
    workspace.seasons.authoritativeWorldSeasonStatus !== 'available';
  const showHardCap = onCurrentSeason && Boolean(hardCapStatus?.isHardCapped);
  const isFirstApronHardCapped =
    showHardCap && hardCapStatus?.hardCapCeilingType === 'FIRST_APRON';
  const isSecondApronHardCapped =
    showHardCap && hardCapStatus?.hardCapCeilingType === 'SECOND_APRON';
  const hardCapHeading = hardCapStatus?.hardCapCeilingLabel
    ? `Hard Capped at ${hardCapStatus.hardCapCeilingLabel}`
    : 'Hard Capped';
  const hardCapReason = hardCapStatus?.reason || '';

  return (
    <section
      className="grid shrink-0 grid-cols-6 gap-1.5 border-b border-cockpit-edge bg-cockpit-bar px-3 py-1.5"
      data-testid="cockpit-team-status-strip"
      data-state="ready"
      aria-label="Team financial posture"
    >
      <TeamStatusTile
        testId="cockpit-status-total-cap"
        label="Total Cap"
        value={formatMoney(cap.totalCapAllocations)}
      />
      <TeamStatusTile
        testId="cockpit-status-cap-space"
        label="Cap Space"
        value={formatMoney(cap.capSpace)}
        valueClassName={spaceColor(cap.capSpace)}
      />
      <TeamStatusTile
        testId="cockpit-status-tax-space"
        label="Luxury Tax Space"
        value={formatMoney(cap.taxSpace)}
        valueClassName={spaceColor(cap.taxSpace)}
      />
      <TeamStatusTile
        testId="cockpit-status-apron1"
        label="1st Apron Space"
        value={formatMoney(cap.firstApronSpace)}
        valueClassName={spaceColor(cap.firstApronSpace)}
        badge={
          isFirstApronHardCapped ? (
            <HardCapLock heading={hardCapHeading} reason={hardCapReason} />
          ) : null
        }
      />
      <TeamStatusTile
        testId="cockpit-status-apron2"
        label="2nd Apron Space"
        value={formatMoney(cap.secondApronSpace)}
        valueClassName={spaceColor(cap.secondApronSpace)}
        badge={
          isSecondApronHardCapped ? (
            <HardCapLock heading={hardCapHeading} reason={hardCapReason} />
          ) : null
        }
      />
      <TeamStatusTile
        testId="cockpit-status-roster"
        label="Roster"
        value={rosterCount !== null ? `${rosterCount} / 15` : '—'}
        sub={excFlags ? `Exc · ${excFlags}` : null}
      />
    </section>
  );
};
