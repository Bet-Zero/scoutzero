import { GovernedWaiverLifecycleZ } from '@/schemas/governedWaiver';
import {
  isDateOnly,
  parseZonedDateTime,
} from '@/features/architect/utils/governedSeason';

const MALFORMED_LIFECYCLE_REASON =
  'A persisted governed waiver lifecycle is malformed or version-incompatible.';

type GovernedDeadCapEntryLike = {
  amountByYear?: unknown;
  governedLifecycle?: unknown;
};

type GovernedDeadCapTeamLike = {
  deadCap?: unknown[] | null;
};

export function hasGovernedWaiverTerminated(
  asOfDate: string | null | undefined,
  expiresAt: string
): boolean {
  if (!asOfDate) return false;
  if (isDateOnly(asOfDate)) {
    // Date-only plans cannot prove which side of an intraday expiry they are
    // on. Preserve pending responsibility through that date.
    return asOfDate > expiresAt.slice(0, 10);
  }
  const asOf = parseZonedDateTime(asOfDate);
  const expiry = parseZonedDateTime(expiresAt);
  return asOf !== null && expiry !== null && asOf >= expiry;
}

export function projectGovernedWaiverDeadCapEntry<
  TEntry extends GovernedDeadCapEntryLike,
>(entry: TEntry, asOfDate: string | null | undefined): TEntry {
  if (entry.governedLifecycle == null) return entry;
  const parsed = GovernedWaiverLifecycleZ.safeParse(entry.governedLifecycle);
  if (!parsed.success) throw new Error(MALFORMED_LIFECYCLE_REASON);
  const lifecycle = parsed.data;
  const allocations = hasGovernedWaiverTerminated(asOfDate, lifecycle.expiresAt)
    ? lifecycle.allocations.map((row) => ({
        season: row.season,
        amount: row.teamSalary,
        isStretched: row.isTeamSalaryStretched,
      }))
    : lifecycle.allocationsBeforeStretch.map((row) => ({
        season: row.season,
        amount: row.protectedBaseCompensation,
        isStretched: false,
      }));
  return { ...entry, amountByYear: allocations };
}

export function projectGovernedWaiverTeamSalary<
  TTeam extends GovernedDeadCapTeamLike,
>(team: TTeam, asOfDate: string | null | undefined): TTeam {
  if (!Array.isArray(team.deadCap)) return team;

  return {
    ...team,
    deadCap: team.deadCap.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return entry;
      }
      return projectGovernedWaiverDeadCapEntry(
        entry as GovernedDeadCapEntryLike,
        asOfDate
      );
    }),
  };
}
