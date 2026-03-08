import type { TeamContext } from '../constants/types';

type DateLike = string | number | Date;

export function resolveTradeTimingDate(tradeCtx: TeamContext = {}): Date {
  return new Date(
    tradeCtx.tradeDate || tradeCtx.asOfDate || new Date().toISOString()
  );
}

export function getJanuary15RestrictionDate(tradeDateLike: DateLike): Date {
  const tradeDate =
    tradeDateLike instanceof Date ? tradeDateLike : new Date(tradeDateLike);
  const tradeMonth = tradeDate.getMonth();
  const yearOffset = tradeMonth >= 6 ? 1 : 0;

  return new Date(tradeDate.getFullYear() + yearOffset, 0, 15);
}
