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
          playerName: 'player_sign',
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
      expectedSummary: 'Signed Free Agent: player_sign → LAL',
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
          playerName: 'player_sat',
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
      expectedSummary: 'Sign-and-Trade Executed: player_sat (LAL ↔ CHI)',
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
          playerName: 'player_offer_decline',
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
      expectedSummary:
        'Offer Sheet Finalized (Declined): player_offer_decline → LAL',
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
          playerName: 'player_waive',
          stretched: true,
          deadCapAmount: 4_500_000,
        },
      },
      expectedCategory: 'cap-transaction',
      expectedType: 'Waive Player',
      expectedSummary: 'Waive Player: player_waive (stretch)',
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
          playerName: 'player_anchor',
          teamCode: 'LAL',
          signedUsing: 'NTMLE',
        },
      },
      { teamCode: 'LAL' }
    );

    expect(row.summary).toBe('Signed Free Agent: player_anchor → LAL');
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
    expect(unknownRow.summary).toBe('Mystery Mutation: player_unknown');
    expect(getSectionLines(unknownRow, 'Event Detail')).toEqual([
      'No event-specific Team History detail mapping exists for mysteryMutation.',
    ]);
  });
});
