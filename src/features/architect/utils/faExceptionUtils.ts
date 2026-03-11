import { FA_EXCEPTION_TRADE_USAGE } from '@/features/architect/utils/cbaConstants.js';
import {
  isSecondApronTeam,
  isFirstApronTeam,
} from '@/features/architect/utils/capUtils.js';

type NumericLike = number | string | null | undefined;
type UnknownRecord = Record<string, unknown>;

interface FaExceptionBucketLike extends UnknownRecord {
  type?: unknown;
  remaining?: NumericLike;
  amount?: NumericLike;
  used?: NumericLike;
  expiresAt?: string | null;
}

interface FaExceptionTeamSeasonState extends UnknownRecord {
  faExceptionBuckets?: FaExceptionBucketLike[];
}

interface FaExceptionFlags extends UnknownRecord {
  faExceptionEligible?: unknown[];
}

interface FaExceptionCapSettings extends UnknownRecord {
  firstApron?: NumericLike;
  secondApron?: NumericLike;
}

interface FaExceptionTeamContext extends UnknownRecord {
  teamSeasonState?: FaExceptionTeamSeasonState;
  teamTotalSalary?: NumericLike;
  context?: {
    capSettings?: FaExceptionCapSettings;
    [key: string]: unknown;
  };
  faExceptionUsage?: UnknownRecord[];
}

export function getTeamFaExceptionBuckets(
  teamSeasonState: FaExceptionTeamSeasonState = {}
): FaExceptionBucketLike[] {
  return (teamSeasonState.faExceptionBuckets || []) as FaExceptionBucketLike[];
}

export function isFaExceptionEligibleType(
  type: unknown,
  flags: FaExceptionFlags = {}
): boolean {
  const eligible =
    flags.faExceptionEligible || FA_EXCEPTION_TRADE_USAGE.eligible;
  return Boolean(eligible?.includes(type));
}

export function canUseFaException(
  teamCtx: FaExceptionTeamContext = {},
  bucketType: unknown
): boolean {
  const { teamSeasonState = {}, teamTotalSalary = 0, context = {} } = teamCtx;
  const { capSettings = {} } = context;
  const bucket = getTeamFaExceptionBuckets(teamSeasonState).find(
    (entry) => entry.type === bucketType
  );
  if (!bucket || (bucket.remaining as any) <= 0) return false;
  const now = Date.now();
  if (bucket.expiresAt && Date.parse(bucket.expiresAt) < now) return false;

  const teamObj = { totalSalary: teamTotalSalary };
  if (capSettings.secondApron && isSecondApronTeam(teamObj, capSettings)) {
    return false;
  }
  if (capSettings.firstApron && isFirstApronTeam(teamObj, capSettings)) {
    return false;
  }
  return true;
}

export function allocateFaExceptionToIncoming({
  teamCtx = {},
  incomingPlayerId,
  amount = 0,
  bucketType,
}: {
  teamCtx?: FaExceptionTeamContext;
  incomingPlayerId?: unknown;
  amount?: NumericLike;
  bucketType?: unknown;
}): FaExceptionBucketLike | undefined {
  const { teamSeasonState = {} } = teamCtx;
  const buckets = getTeamFaExceptionBuckets(teamSeasonState);
  const bucket = buckets.find((entry) => entry.type === bucketType);
  if (bucket) {
    bucket.remaining = Math.max(
      0,
      ((bucket.remaining || 0) as any) - (((amount as number) || 0) as any)
    );
  }
  teamCtx.faExceptionUsage = teamCtx.faExceptionUsage || [];
  teamCtx.faExceptionUsage.push({
    playerId: incomingPlayerId,
    amount,
    type: bucketType,
  });
  return bucket;
}

export function summarizeFaExceptionUsage(
  teamCtx: FaExceptionTeamContext = {}
): string {
  const usage = teamCtx.faExceptionUsage || [];
  return usage.map((entry) => `${entry.type}:${entry.amount}`).join(', ');
}
