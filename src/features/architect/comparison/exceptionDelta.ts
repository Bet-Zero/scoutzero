import type { TradeException } from '@/schemas/architect';
import type { Stage3ExceptionDelta } from './types';

type SavedMove = { operationId?: string | null; occurredAt: string | null };

const money = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Join the saved team ledger to the same world's committed moves. */
export function deriveExceptionDelta({
  worldId,
  teamCode,
  season,
  moves,
  history,
  balances,
}: {
  worldId: string;
  teamCode: string;
  season: string | null;
  moves: SavedMove[];
  history?: readonly unknown[] | null;
  balances?: readonly TradeException[] | null;
}): Stage3ExceptionDelta {
  const savedMoves = new Map(moves.map(({ operationId, occurredAt }) => [operationId, occurredAt]));
  const entries: Extract<Stage3ExceptionDelta, { status: 'available' }>['entries'] = [];
  const seen = new Set<string>();
  const latestRemaining = new Map<string, number>();
  for (const value of history ?? []) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    const kind =
      entry.type === 'TPE_CREATED' ? 'created' :
        entry.type === 'TPE_CONSUMED' ? 'used' : null;
    const amount = kind === 'created' ? entry.amountCreated : entry.amountConsumed;
    const remaining = kind === 'created' ? amount : entry.remainingAmountAfter;
    if (
      !kind || entry.worldId !== worldId || entry.teamCode !== teamCode ||
      !season || entry.seasonId !== season || !money(amount) || amount === 0 ||
      typeof entry.mutationId !== 'string' || !savedMoves.has(entry.mutationId) ||
      typeof entry.historyKey !== 'string' || seen.has(entry.historyKey) ||
      typeof entry.tpeId !== 'string' || !entry.tpeId
    ) continue;
    seen.add(entry.historyKey);
    if (money(remaining)) latestRemaining.set(entry.tpeId, remaining);
    else latestRemaining.delete(entry.tpeId);
    entries.push({
      key: entry.historyKey,
      exceptionId: entry.tpeId,
      kind,
      amount,
      occurredAt: savedMoves.get(entry.mutationId) ?? null,
    });
  }
  if (!entries.length) {
    return { status: 'deferred', reason: 'No trade exception changes are recorded for these saved moves.' };
  }

  return {
    status: 'available',
    entries,
    balances: [...new Set(entries.map(({ exceptionId }) => exceptionId))].map((id) => {
      const current = balances?.find((balance) => balance.id === id);
      return {
        exceptionId: id,
        label: current?.createdFrom ?? null,
        remaining: money(current?.remainingAmount) &&
          current.remainingAmount === latestRemaining.get(id) ? current.remainingAmount : null,
      };
    }),
  };
}
