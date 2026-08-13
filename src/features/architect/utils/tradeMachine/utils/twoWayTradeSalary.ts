type ContractTypeCarrier = {
  contractType?: unknown;
  isTwoWay?: unknown;
};

export type TwoWayTradePlayerLike = ContractTypeCarrier & {
  contract?: ContractTypeCarrier | null;
  primaryContract?: ContractTypeCarrier | null;
};

function isTwoWayContractType(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.trim().toLowerCase().replace(/[-_\s]+/g, '') === 'twoway'
  );
}

/**
 * Resolves the explicit Two-Way markers carried by Trade Machine player data.
 * This is deliberately source-independent: callers must not infer contract type
 * from salary, roster placement, or another player's record.
 */
export function isTwoWayTradePlayer(
  player: unknown
): boolean {
  if (!player || typeof player !== 'object') return false;

  const candidate = player as TwoWayTradePlayerLike;

  return (
    candidate.isTwoWay === true ||
    candidate.contract?.isTwoWay === true ||
    candidate.primaryContract?.isTwoWay === true ||
    isTwoWayContractType(candidate.contractType) ||
    isTwoWayContractType(candidate.contract?.contractType) ||
    isTwoWayContractType(candidate.primaryContract?.contractType)
  );
}

export const TWO_WAY_TRADE_MATCHING_LABEL = 'Two-Way salary exclusion';

export const TWO_WAY_TRADE_MATCHING_EXPLANATION =
  'Two-Way contracts do not count toward trade salary matching and cannot create or use a trade exception.';
