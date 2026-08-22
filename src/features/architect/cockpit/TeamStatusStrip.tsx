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
  /**
   * Layout orientation. 'horizontal' is the legacy full-width band; 'vertical'
   * stacks the tiles for the right Activity rail so the cap posture lives there
   * instead of stealing a full-width band of vertical space from the workspace.
   */
  orientation?: 'horizontal' | 'vertical';
}

// Abbreviated money so the posture reads like a clean dashboard ($239.3M), not
// a spreadsheet ($239,343,312). No minus sign — the tile color already conveys
// negative (red). Millions always carry one decimal ($211.0M, not $211M).
export const formatMoney = (amount: number | null): string => {
  if (amount === null) return 'Needs input';
  if (!Number.isFinite(amount)) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return `$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `$${(abs / 1_000).toFixed(1)}K`;
  }
  return `$${Math.round(abs)}`;
};


const HardCapLock = ({ heading, reason }: { heading: string; reason: string }) => (
  <div
    className="group relative flex shrink-0 items-center"
    data-testid="cockpit-status-hard-cap-lock"
  >
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
  orientation = 'horizontal',
}: TeamStatusStripProps) => {
  const cap = workspace.cap;
  const isVertical = orientation === 'vertical';

  if (cap.status !== 'available') {
    return (
      <div
        className={
          isVertical
            ? 'shrink-0 px-2 py-3 text-[11px] text-white/40'
            : 'flex shrink-0 items-center border-b border-cockpit-edge bg-cockpit-bar px-4 py-2 text-[11px] text-white/40'
        }
        data-testid="cockpit-team-status-strip"
        data-state="unavailable"
      >
        Cap status is loading…
      </div>
    );
  }

  const roster = workspace.roster;

  const spaceColor = (space: number | null) =>
    space === null
      ? 'text-white/50'
      : space < 0
        ? 'text-red-400'
        : 'text-green-400';
  const bookValue = (
    book: typeof cap.books.teamSalary
  ): string =>
    book.status === 'available'
      ? formatMoney(book.value)
      : book.status === 'not-evaluated'
        ? 'Not evaluated'
        : 'Needs input';

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

  const firstApronBadge = isFirstApronHardCapped ? (
    <HardCapLock heading={hardCapHeading} reason={hardCapReason} />
  ) : null;
  const secondApronBadge = isSecondApronHardCapped ? (
    <HardCapLock heading={hardCapHeading} reason={hardCapReason} />
  ) : null;
  // Standard players fill the 15 standard slots; two-way players are counted
  // separately against their own 3 two-way slots — matching the Roster room and
  // the Team Plan rail (which already split the count). Folding both into the
  // 15 denominator makes a legal 15+3 roster read as "18 / 15" (over-limit).
  // Falls back to the raw count when the split is unknown (id-only / roster-
  // array source), preserving the legacy `N / 15` read.
  const rosterValue = (() => {
    if (roster.status !== 'available') return '—';
    const standard = roster.standardCount ?? roster.count;
    return roster.twoWayCount && roster.twoWayCount > 0
      ? `${standard} / 15 · ${roster.twoWayCount} / 3`
      : `${standard} / 15`;
  })();

  // The four space tiles are shared by both layouts; `dense` shortens them for
  // the horizontal top band where vertical height is scarce.
  const spaceTiles = (dense: boolean) => ({
    capSpaceTile: (
      <TeamStatusTile
        testId="cockpit-status-cap-space"
        label="Cap Space"
        value={formatMoney(cap.capSpace)}
        valueClassName={spaceColor(cap.capSpace)}
        dense={dense}
      />
    ),
    taxSalaryTile: (
      <TeamStatusTile
        testId="cockpit-status-tax-salary"
        label="Tax Salary"
        value={bookValue(cap.books.taxSalary)}
        valueClassName={spaceColor(cap.taxSpace)}
        dense={dense}
      />
    ),
    apronSalaryTile: (
      <TeamStatusTile
        testId="cockpit-status-apron-salary"
        label="Apron Team Salary"
        value={bookValue(cap.books.apronTeamSalary)}
        valueClassName={spaceColor(cap.firstApronSpace)}
        badge={firstApronBadge}
        dense={dense}
      />
    ),
    secondApronTile: (
      <TeamStatusTile
        testId="cockpit-status-apron2"
        label="2nd Apron Space"
        value={formatMoney(cap.secondApronSpace)}
        valueClassName={spaceColor(cap.secondApronSpace)}
        badge={secondApronBadge}
        dense={dense}
      />
    ),
  });

  // Vertical layout (the canonical left-dock posture panel) carries a visual
  // hierarchy: Total Cap is a prominent wide row (second-biggest figure after
  // the panel's hero verdict), the four space tiles step down into a 2×2 grid,
  // and roster is a thin supporting row. Horizontal keeps the legacy flat band.
  if (isVertical) {
    const { capSpaceTile, taxSalaryTile, apronSalaryTile, secondApronTile } =
      spaceTiles(false);
    return (
      <section
        className="flex shrink-0 flex-col gap-1.5"
        data-testid="cockpit-team-status-strip"
        data-state="ready"
        data-orientation={orientation}
        data-team-salary={cap.teamSalary ?? undefined}
        data-apron-team-salary={cap.apronTeamSalary ?? undefined}
        data-tax-salary={cap.taxSalary ?? undefined}
        aria-label="Team financial status"
      >
        <div
          className="flex items-center justify-between rounded-md border border-white/10 bg-[#1c1c1c] px-2.5 py-2"
          data-testid="cockpit-status-total-cap"
        >
          <span className="text-[9px] uppercase tracking-wider text-white/55">
            Team Salary
          </span>
          <span
            className="text-[17px] font-bold leading-none tabular-nums text-white"
            data-testid="cockpit-status-total-cap-value"
          >
            {bookValue(cap.books.teamSalary)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {capSpaceTile}
          {taxSalaryTile}
          {apronSalaryTile}
          {secondApronTile}
        </div>
        <div
          className="flex items-center justify-between rounded-md border border-white/10 bg-[#1c1c1c] px-2.5 py-1.5"
          data-testid="cockpit-status-roster"
        >
          <span className="text-[9px] uppercase tracking-wider text-white/55">
            Roster
          </span>
          <span
            className="text-[13px] font-bold leading-none tabular-nums text-white"
            data-testid="cockpit-status-roster-value"
          >
            {rosterValue}
          </span>
        </div>
      </section>
    );
  }

  // Horizontal lives inside the posture panel's own band, so it carries no
  // border/background of its own — just the tile grid. Tiles are dense so the
  // band stays short enough to keep the Full Cap Table off a scroll.
  const { capSpaceTile, taxSalaryTile, apronSalaryTile, secondApronTile } =
    spaceTiles(true);
  return (
    <section
      className="grid w-full shrink-0 grid-cols-6 gap-1.5"
      data-testid="cockpit-team-status-strip"
      data-state="ready"
      data-orientation={orientation}
      data-team-salary={cap.teamSalary ?? undefined}
      data-apron-team-salary={cap.apronTeamSalary ?? undefined}
      data-tax-salary={cap.taxSalary ?? undefined}
      aria-label="Team financial status"
    >
      <TeamStatusTile
        testId="cockpit-status-total-cap"
        label="Team Salary"
        value={bookValue(cap.books.teamSalary)}
        dense
      />
      {capSpaceTile}
      {apronSalaryTile}
      {secondApronTile}
      {taxSalaryTile}
      <TeamStatusTile
        testId="cockpit-status-roster"
        label="Roster"
        value={rosterValue}
        dense
      />
    </section>
  );
};
