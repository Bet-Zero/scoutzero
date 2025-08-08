import { getSalaryForYear } from '@/utils/architect/tradeHelpers.js';
import {
  getTeamFaExceptionBuckets,
  canUseFaException,
  allocateFaExceptionToIncoming,
  summarizeFaExceptionUsage,
  isFaExceptionEligibleType,
} from '@/utils/architect/faExceptionUtils.js';
import { markHardCapTriggered } from '@/utils/architect/hardCapTriggers.js';
import { validationFlags } from '@/config/validationFlags.js';
import { SECOND_APRON_TPE_BLOCK } from '@/utils/architect/tradeMachine/tpeUtils.js';
import debug from '@/utils/architect/tradeMachine/tradeDebug.js';

export function validateFaExceptionUsage(team, flags = validationFlags) {
  const violations = [];
  let addedGeneric = false;
  const { faExceptionTrade = 'on', faExceptionAutoSelect = true } = flags;
  if (faExceptionTrade === 'off') {
    if (team.incomingPlayers.some((p) => p.absorptionMode === 'FA_EXCEPTION')) {
      violations.push('FA Exception usage disabled.');
    }
    return violations;
  }

  const ctx = {
    teamSeasonState: team.team || {},
    teamTotalSalary: team.teamTotalSalary || 0,
    context: team.context || {},
  };
  const yearKey = ctx.context.yearKey;
  const buckets = getTeamFaExceptionBuckets(ctx.teamSeasonState);
  const faPlayers = (team.incomingPlayers || []).filter(
    (p) =>
      p.absorptionMode === 'FA_EXCEPTION' ||
      (faExceptionAutoSelect && !p.absorptionMode)
  );

  if (
    faPlayers.length &&
    ctx.teamTotalSalary >= ctx.context.capSettings?.secondApron
  ) {
    violations.push(
      'Second Apron — trade exceptions are banned for second-apron teams'
    );
    if (!addedGeneric) {
      violations.push(SECOND_APRON_TPE_BLOCK);
      addedGeneric = true;
    }
  }

  faPlayers.forEach((player) => {
    let mode = player.absorptionMode;
    let bucketType = player.bucketType;
    const salary = player.matchIncoming ?? getSalaryForYear(player, yearKey);

    if (!mode && faExceptionAutoSelect) {
      const bucket = buckets.find(
        (b) =>
          isFaExceptionEligibleType(b.type, flags) &&
          canUseFaException(ctx, b.type) &&
          b.remaining >= salary
      );
      if (bucket) {
        mode = 'FA_EXCEPTION';
        bucketType = bucket.type;
        player.absorptionMode = 'FA_EXCEPTION';
        player.bucketType = bucketType;
      }
    }

    if (mode !== 'FA_EXCEPTION') return;

    if (Array.isArray(bucketType)) {
      violations.push(
        'Cannot combine FA Exception with outgoing salary for the same player.'
      );
      return;
    }

    if (ctx.teamTotalSalary >= ctx.context.capSettings?.secondApron) {
      if (
        !violations.includes(
          'FA Exception unavailable above/beyond Second Apron.'
        )
      ) {
        violations.push('FA Exception unavailable above/beyond Second Apron.');
      }
      return;
    }
    if (ctx.teamTotalSalary >= ctx.context.capSettings?.firstApron) {
      violations.push('FA Exception unavailable above/beyond First Apron.');
      return;
    }

    const bucket = buckets.find((b) => b.type === bucketType);
    if (!bucket || !isFaExceptionEligibleType(bucketType, flags)) {
      violations.push(`FA Exception ${bucketType} not available`);
      return;
    }
    if (team.outgoingPlayers?.some((p) => p.toTeamId === player.fromTeamId)) {
      violations.push(
        'Cannot combine FA Exception with outgoing salary for the same player.'
      );
      return;
    }
    if (salary > bucket.remaining) {
      violations.push(
        `Insufficient FA Exception balance (need $${salary}, have $${bucket.remaining}).`
      );
      return;
    }
    allocateFaExceptionToIncoming({
      teamCtx: ctx,
      incomingPlayerId: player.player_id || player.id,
      amount: salary,
      bucketType,
    });
  });

  if (
    !violations.length &&
    faPlayers.some((p) => p.absorptionMode === 'FA_EXCEPTION')
  ) {
    if (team.projectedSalary > ctx.context.capSettings?.firstApron) {
      violations.push('FA Exception usage would exceed First Apron.');
    } else {
      markHardCapTriggered(ctx.teamSeasonState, {
        reason: 'FA_EXCEPTION',
        season: ctx.context.yearKey,
      });
      team.hardCapped = true;
      team.notes = team.notes || [];
      faPlayers.forEach((p) => {
        if (p.absorptionMode === 'FA_EXCEPTION') {
          const amt = p.matchIncoming ?? getSalaryForYear(p, yearKey);
          team.notes.push(
            `Absorbed ${p.name} via ${p.bucketType} bucket for $${amt}; team hard-capped at First Apron.`
          );
        }
      });
      if (debug.enabled) {
        debug.faException = summarizeFaExceptionUsage(ctx);
      }
    }
  }

  return violations;
}
