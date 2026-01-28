/**
 * Free-agency exception trade bucket utilities.
 * These buckets behave similarly to trade exceptions but are drawn from
 * specific free-agent exceptions (NTMLE, RMLE, BAE).
 */
import { FA_EXCEPTION_TRADE_USAGE } from '@/features/architect/utils/cbaConstants.js';

export function getTeamFaExceptionBuckets(teamSeasonState = {}) {
  return teamSeasonState.faExceptionBuckets || [];
}

export function isFaExceptionEligibleType(type, flags = {}) {
  const eligible = flags.faExceptionEligible || FA_EXCEPTION_TRADE_USAGE.eligible;
  return eligible?.includes(type);
}

export function canUseFaException(teamCtx = {}, bucketType) {
  const { teamSeasonState = {}, teamTotalSalary = 0, context = {} } = teamCtx;
  const { capSettings = {} } = context;
  const bucket = getTeamFaExceptionBuckets(teamSeasonState).find(
    (b) => b.type === bucketType
  );
  if (!bucket || bucket.remaining <= 0) return false;
  const now = Date.now();
  if (bucket.expiresAt && Date.parse(bucket.expiresAt) < now) return false;
  if (capSettings.secondApron && teamTotalSalary > capSettings.secondApron)
    return false;
  if (capSettings.firstApron && teamTotalSalary >= capSettings.firstApron)
    return false;
  return true;
}

export function allocateFaExceptionToIncoming({
  teamCtx = {},
  incomingPlayerId,
  amount = 0,
  bucketType,
}) {
  const { teamSeasonState = {} } = teamCtx;
  const buckets = getTeamFaExceptionBuckets(teamSeasonState);
  const bucket = buckets.find((b) => b.type === bucketType);
  if (bucket) {
    bucket.remaining = Math.max(0, (bucket.remaining || 0) - amount);
  }
  teamCtx.faExceptionUsage = teamCtx.faExceptionUsage || [];
  teamCtx.faExceptionUsage.push({ playerId: incomingPlayerId, amount, type: bucketType });
  return bucket;
}

export function summarizeFaExceptionUsage(teamCtx = {}) {
  const usage = teamCtx.faExceptionUsage || [];
  return usage.map((u) => `${u.type}:${u.amount}`).join(', ');
}
