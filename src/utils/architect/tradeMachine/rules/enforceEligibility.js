import { validationFlags } from '@/config/validationFlags.js';
import { getReacqBlock } from '@/utils/architect/reacqUtils.js';

export function enforceEligibility(
  teamCtx,
  ctx = {},
  { warn = () => {}, reject = () => {} } = {}
) {
  const enforcement = validationFlags.reAcquisition;
  const violations = [];
  const nowDate = ctx.now
    ? new Date(ctx.now)
    : ctx.asOfDate
      ? new Date(ctx.asOfDate)
      : new Date();
  (teamCtx.incomingPlayers || []).forEach((p) => {
    let block = getReacqBlock(p, teamCtx.teamId, nowDate);
    if (
      !block.blocked &&
      typeof ctx.wasTradedAwayWithinOneYear === 'function' &&
      ctx.wasTradedAwayWithinOneYear(p.id, teamCtx.teamId)
    ) {
      const until = new Date(nowDate);
      until.setFullYear(until.getFullYear() + 1);
      block = { blocked: true, until };
    }
    if (block.blocked) {
      const dateStr = block.until.toISOString().slice(0, 10);
      const msg = `Re-acquisition bar: ${teamCtx.teamName} cannot reacquire ${p.name} until ${dateStr}`;
      violations.push(msg);
      reject(msg);
      if (enforcement === 'warn') warn(msg);
    }
  });
  return violations;
}
