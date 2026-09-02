import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { toTeamHistoryEventDisplay } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';

const NORMALIZE_TEAM_HISTORY_PATH = path.resolve(
  process.cwd(),
  'src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts'
);
// Stage 6B: MUTATION_DISPLAY_CONFIG and the per-mutation display map
// were extracted into a co-located .utils.ts sub-module.
const NORMALIZE_TEAM_HISTORY_UTILS_PATH = path.resolve(
  process.cwd(),
  'src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.utils.ts'
);
const readNormalizeTeamHistoryBundle = (): string => {
  let bundle = fs.readFileSync(NORMALIZE_TEAM_HISTORY_PATH, 'utf8');
  if (fs.existsSync(NORMALIZE_TEAM_HISTORY_UTILS_PATH)) {
    bundle += fs.readFileSync(NORMALIZE_TEAM_HISTORY_UTILS_PATH, 'utf8');
  }
  return bundle;
};

function getSectionTitles(row: ReturnType<typeof toTeamHistoryEventDisplay>) {
  return row.detailSections.map((section) => section.title);
}

function getSectionLines(
  row: ReturnType<typeof toTeamHistoryEventDisplay>,
  title: string
) {
  return row.detailSections.find((section) => section.title === title)?.lines || [];
}

describe('TEAM_HISTORY_E6 normalization display-contract guardrail', () => {
  it('keeps explicit mutation-display map ownership for key mutation families', () => {
    const source = readNormalizeTeamHistoryBundle();

    expect(source).toContain('const MUTATION_DISPLAY_CONFIG');
    expect(source).toContain('executeTrade:');
    expect(source).toContain('signFreeAgent:');
    expect(source).toContain('signAndTrade:');
    expect(source).toContain('finalizeDeclinedOfferSheet:');
    expect(source).toContain('waivePlayer:');
    expect(source).toContain('setExceptions:');
    expect(source).toContain('setDeadCap:');
    expect(source).not.toContain('function inferCategory');
  });

  const normalizationMatrix = [
    {
      mutationType: 'executeTrade',
      input: {
        mutationType: 'executeTrade',
        occurredAt: '2026-03-05T12:00:00.000Z',
        teamCodes: ['LAL', 'BOS'],
        playerIds: ['player_trade_a', 'player_trade_b'],
        diffSummary: {
          playersMoved: ['player_trade_a', 'player_trade_b'],
          picksMoved: ['2028-LAL-R1'],
        },
      },
      expectedCategory: 'trade',
      expectedType: 'Trade Executed',
      expectedSummary: 'Trade Executed: LAL ↔ BOS',
      expectedSections: ['Players', 'Picks', 'Teams'],
    },
    {
      mutationType: 'signFreeAgent',
      input: {
        mutationType: 'signFreeAgent',
        occurredAt: '2026-03-05T11:00:00.000Z',
        teamCodes: ['LAL'],
        playerIds: ['player_sign'],
        mutationMetadata: {
          playerName: 'Darius Cole',
          teamCode: 'LAL',
          signedUsing: 'NTMLE',
          contract: {
            years: 3,
            firstYearSalary: 12_000_000,
          },
        },
      },
      expectedCategory: 'free-agency',
      expectedType: 'Signed Free Agent',
      expectedSummary: 'Signed Free Agent: Darius Cole → LAL',
      expectedSections: ['Player', 'Contract', 'Signing Context'],
    },
    {
      mutationType: 'signAndTrade',
      input: {
        mutationType: 'signAndTrade',
        occurredAt: '2026-03-05T10:00:00.000Z',
        teamCodes: ['LAL', 'CHI'],
        playerIds: ['player_sat'],
        mutationMetadata: {
          playerName: 'Evan Brooks',
          teamCode: 'LAL',
          signedUsing: 'Bird',
          contract: {
            years: 4,
            firstYearSalary: 30_000_000,
          },
        },
      },
      expectedCategory: 'trade',
      expectedType: 'Sign-and-Trade Executed',
      expectedSummary: 'Sign-and-Trade Executed: Evan Brooks (LAL ↔ CHI)',
      expectedSections: ['Player', 'Contract', 'Trade Context', 'Teams'],
    },
    {
      mutationType: 'finalizeDeclinedOfferSheet',
      input: {
        mutationType: 'finalizeDeclinedOfferSheet',
        occurredAt: '2026-03-05T09:00:00.000Z',
        teamCodes: ['LAL', 'BOS'],
        playerIds: ['player_offer_decline'],
        mutationMetadata: {
          playerName: 'Jordan Lee',
          teamCode: 'LAL',
          signedUsing: 'Offer Sheet',
          contract: {
            years: 4,
            firstYearSalary: 16_000_000,
          },
        },
      },
      expectedCategory: 'offer-sheet',
      expectedType: 'Offer Sheet Finalized (Declined)',
      expectedSummary: 'Offer Sheet Finalized (Declined): Jordan Lee → LAL',
      expectedSections: ['Player', 'Contract', 'Offer Sheet', 'Teams'],
    },
    {
      mutationType: 'waivePlayer',
      input: {
        mutationType: 'waivePlayer',
        occurredAt: '2026-03-05T08:00:00.000Z',
        teamCodes: ['LAL'],
        playerIds: ['player_waive'],
        mutationMetadata: {
          playerName: 'Malik Turner',
          stretched: true,
          deadCapAmount: 4_500_000,
        },
      },
      expectedCategory: 'cap-transaction',
      expectedType: 'Waive Player',
      expectedSummary: 'Waive Player: Malik Turner (stretch)',
      expectedSections: ['Player', 'Waiver'],
    },
    {
      mutationType: 'setExceptions',
      input: {
        mutationType: 'setExceptions',
        occurredAt: '2026-03-05T07:00:00.000Z',
        teamCodes: ['LAL'],
        diffSummary: {
          exceptionChanges: ['NTMLE remaining reduced'],
        },
      },
      expectedCategory: 'entitlements',
      expectedType: 'Exceptions Updated',
      expectedSummary: 'Exceptions Updated: NTMLE remaining reduced',
      expectedSections: ['Exception Changes', 'Teams'],
    },
    {
      mutationType: 'setDeadCap',
      input: {
        mutationType: 'setDeadCap',
        occurredAt: '2026-03-05T06:00:00.000Z',
        teamCodes: ['LAL'],
        diffSummary: {
          deadCapChanges: ['waived player bucket +$1.2M'],
        },
      },
      expectedCategory: 'cap-transaction',
      expectedType: 'Dead Cap Updated',
      expectedSummary: 'Dead Cap Updated: waived player bucket +$1.2M',
      expectedSections: ['Dead Cap Changes', 'Teams'],
    },
  ] as const;

  it.each(normalizationMatrix)(
    'normalizes $mutationType through the owned Team History display contract',
    ({ input, expectedCategory, expectedType, expectedSummary, expectedSections }) => {
      const row = toTeamHistoryEventDisplay(input, { teamCode: 'LAL' });

      expect(row.category).toBe(expectedCategory);
      expect(row.type).toBe(expectedType);
      expect(row.summary).toBe(expectedSummary);
      expect(getSectionTitles(row)).toEqual(expectedSections);
    }
  );

  it('does not let generic source summaries suppress more grounded signing summaries', () => {
    const row = toTeamHistoryEventDisplay(
      {
        mutationType: 'signFreeAgent',
        occurredAt: '2026-03-05T05:00:00.000Z',
        teamCodes: ['LAL'],
        playerIds: ['player_anchor'],
        mutationMetadata: {
          summary: 'Signed Free Agent',
          playerName: 'Devin Price',
          teamCode: 'LAL',
          signedUsing: 'NTMLE',
        },
      },
      { teamCode: 'LAL' }
    );

    expect(row.summary).toBe('Signed Free Agent: Devin Price → LAL');
  });

  it('preserves materially specific source summaries when they are already grounded', () => {
    const row = toTeamHistoryEventDisplay(
      {
        mutationType: 'executeTrade',
        occurredAt: '2026-03-05T04:00:00.000Z',
        teamCodes: ['LAL', 'BOS'],
        metadata: {
          summary: 'Three-team salary dump routed through BOS',
        },
      },
      { teamCode: 'LAL' }
    );

    expect(row.summary).toBe('Three-team salary dump routed through BOS');
  });

  it('sanitizes participant IDs in persisted summaries and primary deltas', () => {
    const unresolvedRow = toTeamHistoryEventDisplay(
      {
        mutationType: 'renounceRights',
        occurredAt: '2026-03-05T03:55:00.000Z',
        teamCodes: ['LAL'],
        playerIds: ['historical_player_1'],
        metadata: {
          summary: 'historical_player_1: rights renounced',
        },
      },
      { teamCode: 'LAL' }
    );
    const resolvedRow = toTeamHistoryEventDisplay(
      {
        mutationType: 'renounceRights',
        occurredAt: '2026-03-05T03:50:00.000Z',
        teamCodes: ['LAL'],
        metadata: {
          playerId: 'austin_reaves',
          summary: 'austin_reaves: rights renounced',
        },
      },
      {
        teamCode: 'LAL',
        playerNameLookup: { austin_reaves: 'Austin Reaves' },
      }
    );

    expect(unresolvedRow.summary).toBe(
      'Player details unavailable: rights renounced'
    );
    expect(unresolvedRow.primaryDeltas).toBe(
      'Player details unavailable: rights renounced'
    );
    expect(unresolvedRow.summary).not.toContain('historical_player_1');
    expect(resolvedRow.summary).toBe('Austin Reaves: rights renounced');
    expect(resolvedRow.primaryDeltas).toBe('Austin Reaves: rights renounced');
  });

  it('keeps every governed entitlement as its own directed trade-history line', () => {
    const row = toTeamHistoryEventDisplay(
      {
        mutationType: 'executeTrade',
        occurredAt: '2026-03-05T03:30:00.000Z',
        teamCodes: ['LAL', 'BOS'],
        metadata: {
          entitlementsTraded: {
            LAL: {
              out: ['2028-LAL-R1', 'pick_lal_2029_2nd'],
              in: [],
            },
            BOS: {
              out: [],
              in: ['2028-LAL-R1', 'pick_lal_2029_2nd'],
            },
          },
        },
      },
      { teamCode: 'LAL' }
    );

    expect(getSectionLines(row, 'Picks')).toEqual([
      'LAL: out 2028-LAL-R1',
      'LAL: out pick_lal_2029_2nd',
      'BOS: in 2028-LAL-R1',
      'BOS: in pick_lal_2029_2nd',
    ]);
  });

  it('splits every entitlement in the persisted grouped pick summary', () => {
    const row = toTeamHistoryEventDisplay(
      {
        mutationType: 'executeTrade',
        occurredAt: '2026-03-05T03:15:00.000Z',
        teamCodes: ['BOS', 'NYK'],
        diffSummary: {
          picksMoved: [
            'BOS: out ent:BOS:2027:1:swap:abc12345, ent:NYK:2027:1:conv:def67890',
          ],
        },
      },
      { teamCode: 'BOS' }
    );

    expect(getSectionLines(row, 'Picks')).toEqual([
      'BOS: out ent:BOS:2027:1:swap:abc12345',
      'BOS: out ent:NYK:2027:1:conv:def67890',
    ]);
  });

  it('keeps unresolved player IDs out of normal-mode world-event rows', () => {
    const unresolvedRow = toTeamHistoryEventDisplay(
      {
        mutationType: 'executeTrade',
        occurredAt: '2026-03-05T03:10:00.000Z',
        teamCodes: ['LAL', 'BOS'],
        playerIds: ['historical_player_1'],
      },
      { teamCode: 'LAL' }
    );
    const resolvedRow = toTeamHistoryEventDisplay(
      {
        mutationType: 'executeTrade',
        occurredAt: '2026-03-05T03:05:00.000Z',
        teamCodes: ['LAL', 'BOS'],
        playerIds: ['austin_reaves'],
      },
      {
        teamCode: 'LAL',
        playerNameLookup: { austin_reaves: 'Austin Reaves' },
      }
    );

    expect(getSectionLines(unresolvedRow, 'Players')).toEqual([
      'Player details unavailable',
    ]);
    expect(unresolvedRow.summary).not.toContain('historical_player_1');
    expect(getSectionLines(unresolvedRow, 'Players')).not.toContain(
      'historical_player_1'
    );
    expect(getSectionLines(resolvedRow, 'Players')).toEqual(['Austin Reaves']);
  });

  it('rejects ID-valued metadata-only player names without hiding real names', () => {
    const unresolvedRow = toTeamHistoryEventDisplay(
      {
        mutationType: 'waivePlayer',
        occurredAt: '2026-03-05T03:02:00.000Z',
        metadata: {
          playerName: 'historical_player_1',
          summary: 'historical_player_1 was waived',
        },
      },
      { teamCode: 'LAL' }
    );
    const resolvedRow = toTeamHistoryEventDisplay(
      {
        mutationType: 'waivePlayer',
        occurredAt: '2026-03-05T03:01:00.000Z',
        metadata: { playerName: 'Austin Reaves' },
      },
      { teamCode: 'LAL' }
    );
    const pairedIdentityRow = toTeamHistoryEventDisplay(
      {
        mutationType: 'waivePlayer',
        occurredAt: '2026-03-05T03:00:00.000Z',
        metadata: {
          playerId: 'austin_reaves',
          playerName: 'Austin Reaves',
          summary: 'Austin Reaves was waived',
        },
      },
      { teamCode: 'LAL' }
    );

    expect(unresolvedRow.summary).toBe('Player details unavailable was waived');
    expect(unresolvedRow.summary).not.toContain('historical_player_1');
    expect(resolvedRow.summary).toBe('Waive Player: Austin Reaves');
    expect(pairedIdentityRow.summary).toBe('Austin Reaves was waived');
  });

  it('uses active-team-first Team Salary delta and retains all book identities', () => {
    const row = toTeamHistoryEventDisplay(
      {
        mutationType: 'executeTrade',
        occurredAt: '2026-03-05T03:00:00.000Z',
        teamCodes: ['BOS', 'LAL'],
        beforeTotalsByTeam: {
          BOS: {
            teamSalary: 150_000_000,
            apronTeamSalary: 151_000_000,
            taxSalary: 152_000_000,
          },
          LAL: {
            teamSalary: 160_000_000,
            apronTeamSalary: 161_000_000,
            taxSalary: 159_000_000,
          },
        },
        afterTotalsByTeam: {
          BOS: {
            teamSalary: 148_000_000,
            apronTeamSalary: 150_000_000,
            taxSalary: 149_000_000,
          },
          LAL: {
            teamSalary: 163_500_000,
            apronTeamSalary: 166_000_000,
            taxSalary: 164_000_000,
          },
        },
      },
      { teamCode: 'LAL' }
    );

    expect(row.capDelta).toBe(3_500_000);
    expect(getSectionLines(row, 'Salary Books')).toEqual([
      'LAL Team Salary: +$3,500,000',
      'LAL Apron Team Salary: +$5,000,000',
      'LAL Tax Salary: +$5,000,000',
      'BOS Team Salary: -$2,000,000',
      'BOS Apron Team Salary: -$1,000,000',
      'BOS Tax Salary: -$3,000,000',
    ]);
  });

  it('uses explicit fallback notes for generic entitlement payloads, sparse waivers, and unknown mutations', () => {
    const genericExceptionRow = toTeamHistoryEventDisplay(
      {
        type: 'setException',
        timestamp: '2026-03-05T02:00:00.000Z',
      },
      { teamCode: 'LAL' }
    );
    const sparseWaiveRow = toTeamHistoryEventDisplay(
      {
        mutationType: 'waivePlayer',
        occurredAt: '2026-03-05T01:00:00.000Z',
      },
      { teamCode: 'LAL' }
    );
    const unknownRow = toTeamHistoryEventDisplay(
      {
        mutationType: 'mysteryMutation',
        occurredAt: '2026-03-05T00:00:00.000Z',
        teamCodes: ['LAL'],
        playerIds: ['player_unknown'],
      },
      { teamCode: 'LAL' }
    );

    expect(genericExceptionRow.category).toBe('entitlements');
    expect(genericExceptionRow.type).toBe('Exceptions Updated');
    expect(genericExceptionRow.summary).toBe('Exceptions Updated (detail limited)');
    expect(getSectionLines(genericExceptionRow, 'Exception Changes')).toEqual([
      'No exception change detail was included in this event payload.',
    ]);

    expect(sparseWaiveRow.summary).toBe('Waive Player (details unavailable)');
    expect(sparseWaiveRow.detailSections).toEqual([]);

    expect(unknownRow.category).toBe('world-event');
    expect(unknownRow.type).toBe('Mystery Mutation');
    expect(unknownRow.summary).toBe(
      'Mystery Mutation: Player details unavailable'
    );
    expect(getSectionLines(unknownRow, 'Event Detail')).toEqual([
      'No event-specific Team History detail mapping exists for mysteryMutation.',
    ]);
  });
});
