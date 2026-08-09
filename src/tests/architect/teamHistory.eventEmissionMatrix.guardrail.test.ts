import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorldMutationEventPayload } from '@/features/architect/utils/mutationPipeline';

const MUTATION_PIPELINE_PATH = path.resolve(
  process.cwd(),
  'src/features/architect/utils/mutationPipeline.ts'
);
const MUTATION_PIPELINE_PERSIST_PATH = path.resolve(
  process.cwd(),
  'src/features/architect/utils/mutationPipeline.persist.ts'
);

describe('TEAM_HISTORY_E3 event emission matrix guardrail', () => {
  const matrix = [
    {
      mutationType: 'executeTrade',
      teamCodes: ['LAL', 'BOS'],
      metadata: {
        summary: 'Trade Executed vs BOS',
        entitlementsTraded: ['pick_2028_lal_r1'],
      },
    },
    {
      mutationType: 'signFreeAgent',
      teamCodes: ['LAL'],
      metadata: { summary: 'Signed Free Agent' },
    },
    {
      mutationType: 'signAndTrade',
      teamCodes: ['LAL', 'CHI'],
      metadata: { summary: 'Sign-and-Trade Executed vs CHI' },
    },
    {
      mutationType: 'waivePlayer',
      teamCodes: ['LAL'],
      metadata: { summary: 'Waive & Stretch Processed', stretched: true },
    },
    {
      mutationType: 'setExceptions',
      teamCodes: ['LAL'],
      metadata: { summary: 'Exception Updated' },
    },
  ] as const;

  it.each(matrix)(
    'builds canonical event payload for $mutationType with required Team History fields',
    ({ mutationType, teamCodes, metadata }) => {
      const timestamp = Date.parse('2026-03-01T12:00:00.000Z');
      const event = buildWorldMutationEventPayload({
        mutationType,
        eventId: `evt_${mutationType}`,
        seasonId: '2025-26',
        worldId: 'world_lal',
        timestamp,
        computeResult: {
          metadata,
          teamUpdates: teamCodes.map((teamCode) => ({ teamCode })),
          playerUpdates: [{ playerId: `player_${mutationType}` }],
        },
        auditContext: {
          operationId: `op_${mutationType}`,
          teamCodes,
          beforeTotalsByTeam: { [teamCodes[0]]: { totalCapAllocations: 150 } },
          afterTotalsByTeam: { [teamCodes[0]]: { totalCapAllocations: 149 } },
        },
      });

      expect(event.occurredAt).toBe('2026-03-01T12:00:00.000Z');
      expect(event.timestamp).toBe('2026-03-01T12:00:00.000Z');
      expect(event.mutationType).toBe(mutationType);
      expect(event.type).toBe(mutationType);
      expect(event.teamCodes).toEqual(teamCodes);
      expect(event.teamsAffected).toEqual(teamCodes);
      expect(event.eventId).toBe(`evt_${mutationType}`);
      expect(event.operationId).toBe(`op_${mutationType}`);
      expect(Array.isArray(event.playerIds)).toBe(true);
      expect(event.playerIds.length).toBeGreaterThan(0);
      expect(event.beforeTotalsByTeam).toHaveProperty(teamCodes[0]);
      expect(event.afterTotalsByTeam).toHaveProperty(teamCodes[0]);
    }
  );

  it('fails closed when teamCodes are missing for a log-required mutation', () => {
    expect(() =>
      buildWorldMutationEventPayload({
        mutationType: 'signFreeAgent',
        eventId: 'evt_missing_teams',
        seasonId: '2025-26',
        worldId: 'world_lal',
        timestamp: Date.parse('2026-03-01T12:00:00.000Z'),
        computeResult: {
          metadata: { summary: 'Signed Free Agent' },
          teamUpdates: [],
          playerUpdates: [],
        },
        auditContext: {
          operationId: 'op_missing_teams',
          teamCodes: [],
        },
      })
    ).toThrow(/requires non-empty teamCodes/);
  });

  it('keeps pipeline success fail-closed on event writes', () => {
    const source = fs.readFileSync(MUTATION_PIPELINE_PATH, 'utf8') +
      fs.readFileSync(MUTATION_PIPELINE_PERSIST_PATH, 'utf8');

    expect(source).toContain(
      "writes.push({ kind: 'set', ref: eventRef, data: sanitizedEvent });"
    );
    expect(source).toContain('applyWritesToBatch(batch, writes);');
    expect(source).toContain(
      'applyWritesToTransaction(transaction, writes);'
    );
    expect(source).toContain('eventsWritten: eventId ? 1 : 0');
    expect(source).toContain('writesSummary.eventsWritten > 0');
    expect(source).toContain('persistedToWorld');
  });
});
