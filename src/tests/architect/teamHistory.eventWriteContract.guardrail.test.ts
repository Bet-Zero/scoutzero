import { describe, expect, it } from 'vitest';
import { buildWorldMutationEventPayload } from '@/features/architect/utils/mutationPipeline';

describe('Team History event write contract guardrail', () => {
  it('builds event payload with required fields for world timeline SSOT', () => {
    const event = buildWorldMutationEventPayload({
      mutationType: 'executeTrade',
      eventId: 'evt_trade_1',
      seasonId: '2025-26',
      worldId: 'world_lal',
      timestamp: Date.parse('2026-03-01T10:00:00.000Z'),
      computeResult: {
        metadata: { summary: 'Trade Executed vs BOS' },
        teamUpdates: [{ teamCode: 'LAL' }, { teamCode: 'BOS' }],
        playerUpdates: [{ playerId: 'player_1' }],
      },
      auditContext: {
        operationId: 'op_trade_1',
        beforeTotalsByTeam: {
          LAL: { totalCapAllocations: 151000000 },
        },
        afterTotalsByTeam: {
          LAL: { totalCapAllocations: 150000000 },
        },
      },
    });

    expect(event.eventId).toBe('evt_trade_1');
    expect(event.mutationType).toBe('executeTrade');
    expect(event.occurredAt).toBe('2026-03-01T10:00:00.000Z');
    expect(event.teamCodes).toEqual(['LAL', 'BOS']);
    expect(event.playerIds).toEqual(['player_1']);
    expect(event.beforeTotalsByTeam).toHaveProperty('LAL');
    expect(event.afterTotalsByTeam).toHaveProperty('LAL');
  });

  it('fails closed when required teamCodes are missing', () => {
    expect(() =>
      buildWorldMutationEventPayload({
        mutationType: 'waivePlayer',
        eventId: 'evt_waive_1',
        seasonId: '2025-26',
        worldId: 'world_lal',
        timestamp: Date.parse('2026-03-01T11:00:00.000Z'),
        computeResult: {
          metadata: {},
          teamUpdates: [],
          playerUpdates: [],
        },
        auditContext: {
          teamCodes: [],
        },
      })
    ).toThrow(/requires non-empty teamCodes/);
  });
});
