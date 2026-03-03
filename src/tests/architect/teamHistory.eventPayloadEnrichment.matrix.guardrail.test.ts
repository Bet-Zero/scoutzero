import { describe, expect, it } from 'vitest';
import { buildWorldMutationEventPayload } from '@/features/architect/utils/mutationPipeline';

describe('TEAM_HISTORY_E5 event payload enrichment matrix guardrail', () => {
  const timestamp = Date.parse('2026-03-03T12:00:00.000Z');

  const matrix = [
    {
      mutationType: 'executeTrade',
      teamCodes: ['LAL', 'BOS'],
      playerIds: ['player_trade_a', 'player_trade_b'],
      metadata: {
        playersTraded: ['player_trade_a', 'player_trade_b'],
        entitlementsTraded: {
          LAL: { out: ['2028-LAL-R1'], in: [] },
          BOS: { out: [], in: ['2028-LAL-R1'] },
        },
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(Array.isArray(event.diffSummary.playersMoved)).toBe(true);
        expect(event.diffSummary.playersMoved.length).toBeGreaterThan(0);
        const hasPicksMoved =
          Array.isArray(event.diffSummary.picksMoved) &&
          event.diffSummary.picksMoved.length > 0;
        const hasEntitlementsTraded =
          event.metadata?.entitlementsTraded &&
          Object.keys(event.metadata.entitlementsTraded).length > 0;
        expect(hasPicksMoved || hasEntitlementsTraded).toBe(true);
      },
    },
    {
      mutationType: 'signFreeAgent',
      teamCodes: ['LAL'],
      playerIds: ['player_sign'],
      metadata: {
        playerId: 'player_sign',
        playerName: 'Player Sign',
        signedUsing: 'NTMLE',
        contract: {
          years: 3,
          firstYearSalary: 12000000,
          salariesByYear: [
            { season: '2025-26', salary: 12000000 },
            { season: '2026-27', salary: 13000000 },
            { season: '2027-28', salary: 14000000 },
          ],
        },
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(event.mutationMetadata?.contractSummary?.years).toBe(3);
        expect(event.mutationMetadata?.contractSummary?.firstYearSalary).toBe(
          12000000
        );
      },
    },
    {
      mutationType: 'signAndTrade',
      teamCodes: ['LAL', 'CHI'],
      playerIds: ['player_sat'],
      metadata: {
        playerId: 'player_sat',
        playerName: 'Player SAT',
        signedUsing: 'Bird',
        contract: {
          years: 4,
          firstYearSalary: 30000000,
          salariesByYear: [{ season: '2025-26', salary: 30000000 }],
        },
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(event.mutationMetadata?.contractSummary?.years).toBe(4);
        expect(event.mutationMetadata?.contractSummary?.firstYearSalary).toBe(
          30000000
        );
      },
    },
    {
      mutationType: 'finalizeMatchedOfferSheet',
      teamCodes: ['LAL', 'BOS'],
      playerIds: ['player_offer_match'],
      metadata: {
        playerId: 'player_offer_match',
        playerName: 'Player Match',
        signedUsing: 'Match',
        contract: {
          years: 4,
          firstYearSalary: 18000000,
          salariesByYear: [{ season: '2025-26', salary: 18000000 }],
        },
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(event.mutationMetadata?.contractSummary?.years).toBe(4);
        expect(event.mutationMetadata?.contractSummary?.firstYearSalary).toBe(
          18000000
        );
      },
    },
    {
      mutationType: 'finalizeDeclinedOfferSheet',
      teamCodes: ['LAL', 'BOS'],
      playerIds: ['player_offer_decline'],
      metadata: {
        playerId: 'player_offer_decline',
        playerName: 'Player Decline',
        signedUsing: 'Offer Sheet',
        contract: {
          years: 4,
          firstYearSalary: 16000000,
          salariesByYear: [{ season: '2025-26', salary: 16000000 }],
        },
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(event.mutationMetadata?.contractSummary?.years).toBe(4);
        expect(event.mutationMetadata?.contractSummary?.firstYearSalary).toBe(
          16000000
        );
      },
    },
    {
      mutationType: 'waivePlayer',
      teamCodes: ['LAL'],
      playerIds: ['player_waive'],
      metadata: {
        playerId: 'player_waive',
        playerName: 'Player Waive',
        stretched: true,
        buyout: true,
        deadCapAmount: 4500000,
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(event.mutationMetadata?.stretched).toBe(true);
        expect(event.mutationMetadata?.buyout).toBe(true);
        expect(event.mutationMetadata?.deadCapAmount).toBe(4500000);
      },
    },
    {
      mutationType: 'extendPlayer',
      teamCodes: ['LAL'],
      playerIds: ['player_extend'],
      metadata: {
        playerId: 'player_extend',
        playerName: 'Player Extend',
        extensionYears: 4,
        extensionTerms: {
          salariesByYear: [{ season: '2026-27', salary: 22000000 }],
        },
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(event.mutationMetadata?.contractSummary?.years).toBe(4);
      },
    },
    {
      mutationType: 'optionDecision',
      teamCodes: ['LAL'],
      playerIds: ['player_option'],
      metadata: {
        playerId: 'player_option',
        playerName: 'Player Option',
        optionType: 'team',
        accepted: true,
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(event.mutationMetadata?.optionType).toBe('team');
        expect(event.mutationMetadata?.accepted).toBe(true);
      },
    },
    {
      mutationType: 'renounceRights',
      teamCodes: ['LAL'],
      playerIds: ['player_renounce'],
      metadata: {
        playerId: 'player_renounce',
        playerName: 'Player Renounce',
        rightsUsed: 'Renounced',
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(event.mutationMetadata?.rightsUsed).toBe('Renounced');
      },
    },
    {
      mutationType: 'setExceptions',
      teamCodes: ['LAL'],
      playerIds: [],
      metadata: {
        teamCode: 'LAL',
        exceptionChanges: ['NTMLE remaining reduced'],
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(Array.isArray(event.diffSummary?.exceptionChanges)).toBe(true);
        expect(event.diffSummary.exceptionChanges.length).toBeGreaterThan(0);
      },
    },
    {
      mutationType: 'setDeadCap',
      teamCodes: ['LAL'],
      playerIds: [],
      metadata: {
        teamCode: 'LAL',
        deadCapChanges: ['Waived player dead cap updated'],
      },
      assertEnrichment: (event: Record<string, any>) => {
        expect(Array.isArray(event.diffSummary?.deadCapChanges)).toBe(true);
        expect(event.diffSummary.deadCapChanges.length).toBeGreaterThan(0);
      },
    },
  ] as const;

  it.each(matrix)(
    'emits required E5 event envelope + enrichment for $mutationType',
    ({ mutationType, teamCodes, playerIds, metadata, assertEnrichment }) => {
      const event = buildWorldMutationEventPayload({
        mutationType,
        eventId: `evt_${mutationType}`,
        seasonId: '2025-26',
        worldId: 'world_lal',
        timestamp,
        computeResult: {
          metadata,
          teamUpdates: teamCodes.map((teamCode) => ({ teamCode })),
          playerUpdates: playerIds.map((playerId) => ({ playerId })),
        },
        auditContext: {
          operationId: `op_${mutationType}`,
          teamCodes,
          beforeTotalsByTeam: {
            [teamCodes[0] || 'LAL']: { totalCapAllocations: 150000000 },
          },
          afterTotalsByTeam: {
            [teamCodes[0] || 'LAL']: { totalCapAllocations: 149000000 },
          },
        },
      });

      expect(event.schemaVersion).toBeTruthy();
      expect(event.eventId || event.id).toBeTruthy();
      expect(event.operationId).toBeTruthy();
      expect(event.mutationType).toBe(mutationType);
      expect(event.type).toBe(mutationType);
      expect(event.occurredAt).toBe('2026-03-03T12:00:00.000Z');
      expect(event.timestamp).toBe('2026-03-03T12:00:00.000Z');
      expect(Array.isArray(event.teamCodes)).toBe(true);
      expect(event.teamCodes.length).toBeGreaterThan(0);
      expect(Array.isArray(event.playerIds)).toBe(true);
      expect(event.metadata).toBeTruthy();
      expect(event.mutationMetadata).toBeTruthy();

      assertEnrichment(event);
    }
  );

  it('normalizes legacy setException alias to canonical setExceptions', () => {
    const event = buildWorldMutationEventPayload({
      mutationType: 'setException',
      eventId: 'evt_set_exception_alias',
      seasonId: '2025-26',
      worldId: 'world_lal',
      timestamp,
      computeResult: {
        metadata: {
          teamCode: 'LAL',
          exceptionChanges: ['TPMLE updated'],
        },
        teamUpdates: [{ teamCode: 'LAL' }],
        playerUpdates: [],
      },
      auditContext: {
        operationId: 'op_set_exception_alias',
        teamCodes: ['LAL'],
      },
    });

    expect(event.mutationType).toBe('setExceptions');
    expect(event.type).toBe('setExceptions');
  });

  it('fails closed when required mutation is missing teamCodes', () => {
    expect(() =>
      buildWorldMutationEventPayload({
        mutationType: 'signFreeAgent',
        eventId: 'evt_missing_teams',
        seasonId: '2025-26',
        worldId: 'world_lal',
        timestamp,
        computeResult: {
          metadata: {
            playerId: 'player_sign',
            contract: { years: 2, firstYearSalary: 8000000 },
          },
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
});
