import React, { useMemo } from 'react';
import { formatMillions } from '@/shared/utils/formatting';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
import { Lock } from 'lucide-react';
import {
  isHardCappedAtFirstApron,
  isHardCappedAtSecondApron,
  getFirstApronHardCapReason,
} from '@/features/architect/utils/hardCapUtils';

type YearKeyLike = string | number;

type TradeAssetLike = Record<string, unknown>;

type CapTotalsTeamLike = NonNullable<Parameters<typeof computeTeamCapTotals>[0]>;
type HardCapTeamLike = NonNullable<
  Parameters<typeof isHardCappedAtFirstApron>[0]
>;
type TeamLike = Record<string, unknown> & {
  id?: string | number | null;
  teamId?: string | number | null;
  teamTotalSalary?: number;
  totalSalary?: number;
};

type SnapshotLike = {
  projectedSalary?: number | null;
};

interface CapImpactTilesProps {
  team?: TeamLike | null;
  sends?: TradeAssetLike[];
  incomingPlayers?: TradeAssetLike[];
  yearKey: YearKeyLike;
  snapshot?: SnapshotLike | null;
  compact?: boolean;
  isValidating?: boolean;
}

export const CapImpactTiles = ({
  team,
  sends = [],
  incomingPlayers = [],
  yearKey,
  snapshot = null,
  compact = false,
  isValidating = false,
}: CapImpactTilesProps) => {
  const baselineTotals = useMemo(
    () => (team ? computeTeamCapTotals(team as CapTotalsTeamLike, yearKey) : null),
    [team, yearKey]
  );

  const hardCapStatus = useMemo(
    () =>
      team
        ? {
            isFirstApronHardCapped: isHardCappedAtFirstApron(
              team as HardCapTeamLike,
              yearKey
            ),
            isSecondApronHardCapped: isHardCappedAtSecondApron(
              team as HardCapTeamLike
            ),
            firstApronReason: isHardCappedAtFirstApron(
              team as HardCapTeamLike,
              yearKey
            )
              ? getFirstApronHardCapReason(team as HardCapTeamLike)
              : '',
          }
        : {
            isFirstApronHardCapped: false,
            isSecondApronHardCapped: false,
            firstApronReason: '',
          },
    [team, yearKey]
  );

  const { salaryOut, salaryIn } = useMemo(
    () => ({
      salaryOut: getSalaryForYear(sends, yearKey),
      salaryIn: getSalaryForYear(incomingPlayers, yearKey),
    }),
    [sends, incomingPlayers, yearKey]
  );

  // TMUI-02: all hooks run above this guard (no early return before hooks)
  if (!team || !baselineTotals) return null;

  const {
    salaryCap,
    firstApron,
    secondApron,
    capHoldsTotal: baselineCapHolds,
    totalCapAllocations: baselineTotalAllocations,
  } = baselineTotals;
  const { isFirstApronHardCapped, isSecondApronHardCapped, firstApronReason } =
    hardCapStatus;

  const hasValidatorResult = snapshot !== null;
  const validatorProjectedSalary = snapshot?.projectedSalary ?? null;

  const projectedSalary = hasValidatorResult
    ? validatorProjectedSalary
    : baselineTotalAllocations - salaryOut + salaryIn;

  const capSpace =
    projectedSalary !== null ? salaryCap - projectedSalary : null;
  const firstApronSpace =
    projectedSalary !== null ? firstApron - projectedSalary : null;
  const secondApronSpace =
    projectedSalary !== null ? secondApron - projectedSalary : null;

  const capHoldsTotal = baselineCapHolds;

  if (import.meta.env.DEV && snapshot) {
    const teamTotalSalary = team?.teamTotalSalary ?? team?.totalSalary ?? 0;
    const localProjected = teamTotalSalary - salaryOut + salaryIn;
    const validatorProjected = snapshot.projectedSalary;
    const diff = Math.abs(localProjected - (validatorProjected ?? 0));
    if (diff > 1) {
      console.warn('[CapImpactTiles] projectedSalary DIVERGENCE', {
        teamId: team?.id || team?.teamId,
        localProjected,
        validatorProjected,
        diff,
      });
    }
  }

  return (
    <div>
      <div
        className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-4'} gap-2 text-[11px] transition-opacity ${isValidating ? 'opacity-60' : 'opacity-100'}`}
      >
        <div className="bg-cockpit-inlay rounded-md p-2 text-center border border-cockpit-edge">
          <div className="text-cockpit-text-muted">TOTAL CAP</div>
          <div className="text-cockpit-text-primary font-bold text-sm tabular-nums">
            {projectedSalary !== null
              ? formatMillions(projectedSalary, 1)
              : '—'}
          </div>
        </div>
        <div className="bg-cockpit-inlay rounded-md p-2 text-center border border-cockpit-edge">
          <div className="text-cockpit-text-muted">CAP SPACE</div>
          <div
            className={`font-bold text-sm tabular-nums ${
              capSpace !== null
                ? capSpace < 0
                  ? 'text-cockpit-danger'
                  : 'text-cockpit-safe'
                : 'text-cockpit-text-muted'
            }`}
          >
            {capSpace !== null ? formatMillions(capSpace, 1) : '—'}
          </div>
        </div>
        <div className="bg-cockpit-inlay rounded-md p-2 text-center border border-cockpit-edge relative">
          <div className="text-cockpit-text-muted">1ST APRON</div>
          <div
            className={`font-bold text-sm tabular-nums ${
              firstApronSpace !== null
                ? firstApronSpace < 0
                  ? 'text-cockpit-danger'
                  : 'text-cockpit-safe'
                : 'text-cockpit-text-muted'
            }`}
          >
            {firstApronSpace !== null
              ? formatMillions(firstApronSpace, 1)
              : '—'}
          </div>
          {isFirstApronHardCapped && (
            <div className="absolute bottom-1 left-1 group">
              <div className="bg-cockpit-raised border border-cockpit-edge rounded-md p-0.5 shadow-md backdrop-blur-md">
                <Lock size={10} className="text-cockpit-text-primary" />
              </div>
              <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-cockpit-raised border border-cockpit-edge shadow-xl rounded-md z-50 pointer-events-none text-center">
                <div className="text-[10px] font-bold text-cockpit-text-primary mb-0.5">
                  Hard Capped at 1st Apron
                </div>
                <div className="text-[10px] text-cockpit-text-muted leading-tight">
                  {firstApronReason}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="bg-cockpit-inlay rounded-md p-2 text-center border border-cockpit-edge relative">
          <div className="text-cockpit-text-muted">2ND APRON</div>
          <div
            className={`font-bold text-sm tabular-nums ${
              secondApronSpace !== null
                ? secondApronSpace < 0
                  ? 'text-cockpit-danger'
                  : 'text-cockpit-safe'
                : 'text-cockpit-text-muted'
            }`}
          >
            {secondApronSpace !== null
              ? formatMillions(secondApronSpace, 1)
              : '—'}
          </div>
          {isSecondApronHardCapped && (
            <div className="absolute bottom-1 left-1 group">
              <div className="bg-cockpit-raised border border-cockpit-edge rounded-md p-0.5 shadow-md backdrop-blur-md">
                <Lock size={10} className="text-cockpit-text-primary" />
              </div>
              <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-48 p-2 bg-cockpit-raised border border-cockpit-edge shadow-xl rounded-md z-50 pointer-events-none text-center">
                <div className="text-[10px] font-bold text-cockpit-text-primary mb-0.5">
                  Hard Capped at 2nd Apron
                </div>
                <div className="text-[10px] text-cockpit-text-muted leading-tight">
                  Team salary exceeds 2nd apron threshold
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {isValidating && (
        <div className="text-[10px] text-cockpit-info italic text-center mt-1 flex items-center justify-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cockpit-info animate-pulse" />
          Validating...
        </div>
      )}
      {capHoldsTotal > 0 && (
        <div className="text-[10px] text-cockpit-text-muted text-center mt-1">
          Cap Holds (not in projected): {formatMillions(capHoldsTotal, 1)}
        </div>
      )}
    </div>
  );
};
