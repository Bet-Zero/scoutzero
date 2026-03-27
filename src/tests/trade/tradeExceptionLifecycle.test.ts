import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTradeExceptionLifecycle } from '@/features/architect/utils/tradeMachine/utils/tradeExceptionLifecycle';

const FIXED_TIMESTAMP = Date.parse('2026-03-27T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-03-27T12:00:00.000Z';

describe('tradeExceptionLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIMESTAMP);
  });

  it('keeps consumption, creation, and history generation owned by one helper', () => {
    const result = applyTradeExceptionLifecycle({
      currentTradeExceptions: [
        {
          id: 'existing-tpe',
          amount: 5_000_000,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          usedAmount: 0,
          createdSeason: 2025,
          expiresOn: '2026-07-01T00:00:00.000Z',
          createdFrom: 'Earlier Trade',
          isUsed: false,
        },
      ],
      hasTradeExceptionsValidation: true,
      createdTPE: {
        id: 'created-tpe',
        amount: 2_000_000,
        totalAmount: 2_000_000,
        remainingAmount: 2_000_000,
        createdSeason: 2026,
        expiresOn: '2027-07-01T00:00:00.000Z',
      },
      incomingPlayers: [
        {
          player_id: 'incoming-player',
          name: 'Incoming Player',
          absorptionMode: 'TPE',
          tpeId: 'existing-tpe',
          matchIncoming: 3_000_000,
        },
      ],
      outgoingPlayers: [{ name: 'Outgoing Veteran' }],
      teamCode: 'BOS',
      seasonId: '2025-26',
      seasonYear: 2026,
      timestampISO: FIXED_TIMESTAMP_ISO,
      worldId: 'world_tm5a',
      mutationType: 'executeTrade',
      mutationId: 'mutation_tm5a',
    });

    expect(result.blockingIssues).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.updatedTradeExceptions).toHaveLength(2);
    expect(result.updatedTradeExceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'existing-tpe',
          remainingAmount: 2_000_000,
          usedAmount: 3_000_000,
          isUsed: false,
        }),
        expect.objectContaining({
          id: 'created-tpe',
          amount: 2_000_000,
          totalAmount: 2_000_000,
          remainingAmount: 2_000_000,
          usedAmount: 0,
          createdFrom: 'Outgoing Veteran',
          isUsed: false,
        }),
      ])
    );

    expect(result.historyEntries).toHaveLength(2);
    expect(result.historyEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TPE_CONSUMED',
          tpeId: 'existing-tpe',
          amountConsumed: 3_000_000,
          remainingAmountAfter: 2_000_000,
        }),
        expect.objectContaining({
          type: 'TPE_CREATED',
          tpeId: 'created-tpe',
          amountCreated: 2_000_000,
          createdFrom: 'Outgoing Veteran',
        }),
      ])
    );
  });
});
