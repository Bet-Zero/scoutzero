/**
 * CBA2-C07.3 zero/one-YOS Minimum uplift in trades.
 *
 * The uplift is an Apron Team Salary row tied to one Minimum Contract. When the
 * Contract is traded, the row moves with it: the sending team stops counting it
 * and the receiving team counts it from the trade day. Tax Salary is fixed at
 * the last Regular Season game (CBA2-C08.1), so a trade after that instant
 * leaves both Tax ledgers unchanged; an earlier trade is outside this tranche.
 *
 * A row belongs to a player when its source reference ends with
 * `;player:<id>` (in-world signings and trade transfers) or when it is a
 * SIMULATION baseline roster row `apron-team-salary:simulation:<team>:minimum-uplift:<id>`. Dead-money
 * rows (`:minimum-uplift:<id>:dead-<n>`) stay with the team. Any other active,
 * nonzero uplift row cannot be matched to a player, so a team holding one
 * cannot send players until it is attributed.
 */
import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';

type LedgerLine = Extract<
  TeamSalaryBookInputs['apronAdjustments'],
  { status: 'ready' }
>['lineItems'][number];

export const MINIMUM_UPLIFT_LEAF = 'CBA2-C07.3';

const PLAYER_REFERENCE = /;player:([^;]+)$/;
const BASELINE_ROW_ID =
  /^apron-team-salary:simulation:[^:]+:minimum-uplift:([^:]+)$/;
const DEAD_MONEY_ROW_ID = /:minimum-uplift:[^:]+:dead-\d+$/;

export function minimumUpliftPlayerReference(
  reference: string,
  playerId: string
): string {
  return `${reference};player:${playerId}`;
}

function rowPlayerId(line: LedgerLine): string | null {
  const reference = String(line.source?.reference ?? '');
  const fromReference = PLAYER_REFERENCE.exec(reference)?.[1];
  if (fromReference) return fromReference;
  if (DEAD_MONEY_ROW_ID.test(line.id)) return null;
  const fromId = BASELINE_ROW_ID.exec(line.id)?.[1];
  return fromId && fromId !== 'none' ? fromId : null;
}

function isActive(line: LedgerLine, at: number): boolean {
  const from = Date.parse(line.effectiveFrom);
  const until = line.effectiveUntil ? Date.parse(line.effectiveUntil) : null;
  return Number.isFinite(from) && from <= at && (until === null || at < until);
}

function isUplift(line: LedgerLine): boolean {
  return (line.canonLeafIds ?? []).includes(MINIMUM_UPLIFT_LEAF);
}

function readyApronLines(books: unknown): LedgerLine[] | null {
  const apron = (books as TeamSalaryBookInputs | null | undefined)
    ?.apronAdjustments;
  return apron?.status === 'ready' && Array.isArray(apron.lineItems)
    ? apron.lineItems
    : null;
}

/** Start of the world day as an instant, or null for a non-date input. */
export function tradeDayStart(asOfDate: unknown): string | null {
  const day = typeof asOfDate === 'string' ? asOfDate.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const instant = `${day}T00:00:00.000Z`;
  return Number.isFinite(Date.parse(instant)) ? instant : null;
}

export type TradeMinimumUplift =
  | { status: 'ready'; amount: number; rows: LedgerLine[] }
  | { status: 'blocked'; reason: string };

/**
 * The active uplift the sending team counts for one outgoing player at the
 * trade day. Teams without governed Apron inputs carry no uplift rows.
 */
export function tradeMinimumUpliftFor(
  books: unknown,
  playerId: string,
  asOfDate: unknown
): TradeMinimumUplift {
  const lines = readyApronLines(books);
  if (!lines || !lines.some((line) => isUplift(line) && line.amount !== 0)) {
    return { status: 'ready', amount: 0, rows: [] };
  }
  const start = tradeDayStart(asOfDate);
  if (!start) {
    return {
      status: 'blocked',
      reason:
        'A Minimum Contract uplift (CBA2-C07.3) can move only on an exact world date.',
    };
  }
  const at = Date.parse(start);
  const active = lines.filter(
    (line) => isUplift(line) && line.amount !== 0 && isActive(line, at)
  );
  const unattributed = active.filter(
    (line) => !rowPlayerId(line) && !DEAD_MONEY_ROW_ID.test(line.id)
  );
  if (unattributed.length > 0) {
    return {
      status: 'blocked',
      reason: `This team has a Minimum Contract uplift (CBA2-C07.3) that is not tied to a player (${unattributed
        .map((line) => line.id)
        .join(', ')}), so its players cannot be traded until it is.`,
    };
  }
  const rows = active.filter((line) => rowPlayerId(line) === playerId);
  return {
    status: 'ready',
    amount: rows.reduce((sum, line) => sum + line.amount, 0),
    rows,
  };
}

/**
 * Moves each traded player's uplift rows from the sender to the receiver.
 * Returns the updated books by team, or an error. Teams whose books do not
 * change are absent from the result.
 */
export function moveTradeMinimumUplifts({
  booksByTeam,
  movements,
  asOfDate,
  transactionId,
}: {
  booksByTeam: ReadonlyMap<string, unknown>;
  movements: ReadonlyArray<{
    playerId: string;
    fromTeam: string;
    toTeam: string;
  }>;
  asOfDate: unknown;
  transactionId: string;
}):
  | { ok: true; books: Map<string, TeamSalaryBookInputs> }
  | { ok: false; error: string } {
  const updated = new Map<string, TeamSalaryBookInputs>();
  const current = (team: string) =>
    (updated.get(team) ?? booksByTeam.get(team)) as
      | TeamSalaryBookInputs
      | null
      | undefined;
  for (const movement of movements) {
    const sender = current(movement.fromTeam);
    const uplift = tradeMinimumUpliftFor(
      booksByTeam.get(movement.fromTeam),
      movement.playerId,
      asOfDate
    );
    if (uplift.status === 'blocked') return { ok: false, error: uplift.reason };
    if (uplift.rows.length === 0) continue;
    const start = tradeDayStart(asOfDate)!;
    const at = Date.parse(start);
    if (movement.toTeam === movement.fromTeam) {
      return { ok: false, error: 'A traded player must change teams.' };
    }
    const receiver = current(movement.toTeam);
    const receiverLines = readyApronLines(receiver);
    if (!sender || !receiver || !receiverLines) {
      return {
        ok: false,
        error: `The receiving team ${movement.toTeam} needs governed Apron Team Salary inputs to take a Minimum Contract uplift (CBA2-C07.3).`,
      };
    }
    for (const books of [sender, receiver]) {
      const tax = books.taxSalary;
      const baseline =
        tax.status === 'ready'
          ? tax.lineItems.find((line) =>
              line.canonLeafIds.includes('CBA2-C08.1')
            )
          : null;
      if (
        tax.status === 'ready' &&
        (!baseline || Date.parse(baseline.effectiveFrom) > at)
      ) {
        return {
          ok: false,
          error:
            'Moving a Minimum Contract uplift before Tax Salary is fixed at the last Regular Season game is outside this governed tranche.',
        };
      }
    }
    const moved = new Set(uplift.rows.map((line) => line.id));
    const senderLines = readyApronLines(sender)!.flatMap((line) => {
      if (!moved.has(line.id)) return [line];
      // A row that began before the trade day keeps its history.
      return Date.parse(line.effectiveFrom) < at
        ? [{ ...line, effectiveUntil: start }]
        : [];
    });
    if (!senderLines.some(isUplift)) {
      senderLines.push({
        id: `apron-team-salary:${movement.fromTeam}:minimum-uplift:none:${transactionId}`,
        ledger: 'apron-team-salary',
        label: 'No qualifying zero/one-YOS Minimum Contract after this trade',
        amount: 0,
        effectiveFrom: start,
        canonLeafIds: [MINIMUM_UPLIFT_LEAF],
        source: {
          authority: 'team-state',
          reference: `trade-operation:${transactionId}`,
        },
      });
    }
    const amount = uplift.amount;
    const label = uplift.rows[0].label;
    const nextReceiverLines = [
      ...receiverLines,
      {
        id: `apron-team-salary:${movement.toTeam}:minimum-uplift:trade:${transactionId}:${movement.playerId}`,
        ledger: 'apron-team-salary' as const,
        label: `${label} (acquired by trade)`,
        amount,
        effectiveFrom: start,
        canonLeafIds: [MINIMUM_UPLIFT_LEAF],
        source: {
          authority: 'team-state' as const,
          reference: minimumUpliftPlayerReference(
            `trade-operation:${transactionId}; from ${movement.fromTeam}`,
            movement.playerId
          ),
        },
      },
    ];
    updated.set(movement.fromTeam, {
      ...sender,
      apronAdjustments: { status: 'ready', lineItems: senderLines },
    });
    updated.set(movement.toTeam, {
      ...receiver,
      apronAdjustments: { status: 'ready', lineItems: nextReceiverLines },
    });
  }
  return { ok: true, books: updated };
}

/** Same identity order as the trade persistence manifest (getMutationPlayerId). */
export function tradeUpliftPlayerId(player: {
  player_id?: unknown;
  playerId?: unknown;
  id?: unknown;
}): string {
  return String(player.player_id || player.playerId || player.id || '').trim();
}
