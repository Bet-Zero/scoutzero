/**
 * FILE: src/tests/architect/architectFinalHardeningPack.chunk1.test.ts
 * PURPOSE: Narrow regression proof for ARCHITECT_FINAL_HARDENING_PACK Chunk 1.
 * Covers:
 *  - executeTrade compute path in mutationPipeline.ts
 *  - option-decline transition path in resolveOffseasonTransition.ts
 *  - hard-cap reset + TPE expiry transition path in resolveOffseasonTransition.ts
 * OWNERSHIP: Feature: architect/ts-hardening
 */

import { describe, expect, it } from 'vitest';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { resolveOffseasonTransition } from '@/features/architect/utils/offseason';
import type {
  OffseasonOptionDecisionMap,
  OffseasonTransitionParams,
} from '@/features/architect/utils/offseason/resolveOffseasonTransition';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';

const FIXED_TIMESTAMP = new Date('2026-03-22T12:00:00.000Z').getTime();

type SeasonRow = {
  season: string;
  salary: number;
  capHit: number;
  option?: string | null;
  optionUsed?: boolean | null;
};

const makeSeasonRow = (
  endYear: number,
  salary: number,
  option?: string | null
): SeasonRow => ({
  season: toSeasonCode(endYear),
  salary,
  capHit: salary,
  option: option ?? null,
  optionUsed: null,
});

const makeTradePlayer = (
  id: string,
  name: string,
  salary: number,
  teamCode: string
) => ({
  player_id: id,
  id,
  playerId: id,
  name,
  displayName: name,
  teamCode,
  salary,
  contract: {
    contractType: 'Standard',
    salariesByYear: [
      {
        season: '2025-26',
        salary,
        capHit: salary,
        guaranteed: true,
      },
    ],
    birdRights: { status: 'Full Bird' },
    freeAgency: { type: 'UFA', year: 2027 },
  },
});

const makeTradeTeam = (
  teamCode: string,
  totalSalary: number,
  players: Array<ReturnType<typeof makeTradePlayer>>
) => ({
  id: teamCode.toLowerCase(),
  teamCode,
  teamName: `Team ${teamCode}`,
  teamTotalSalary: totalSalary,
  players,
  roster: players.map((player) => player.player_id),
  tradeExceptions: [],
  exceptionHistory: [],
  capHolds: [],
  deadCap: [],
  exceptions: { mle: null, bae: null, tpe: [] },
  totals: {
    teamSalary: totalSalary,
    totalSalary,
    capHit: totalSalary,
    rosterCount: players.length,
    isHardCapped: false,
  },
  source: { type: 'test' },
});

const makeCapProjections = () => ({
  '2025-26': {
    salaryCap: 141_000_000,
    luxuryTax: 170_000_000,
    firstApron: 178_000_000,
    secondApron: 188_000_000,
    minSalary: 1_164_000,
    maxSalary: 52_750_000,
  },
});

const makeOffseasonPlayer = (
  id: string,
  name: string,
  rows: SeasonRow[]
) => ({
  player_id: id,
  id,
  playerId: id,
  name,
  displayName: name,
  contract: {
    salariesByYear: rows,
    yearsRemaining: rows.length,
    contractType: 'Standard',
    birdRights: { status: 'Full Bird' },
  },
});

const makeStandardRoster = (
  count: number,
  fromYear: number,
  toYear: number,
  startIndex = 0
) =>
  Array.from({ length: count }).map((_, index) =>
    makeOffseasonPlayer(
      `fill-${startIndex + index}`,
      `Filler ${startIndex + index}`,
      [makeSeasonRow(fromYear, 1_200_000), makeSeasonRow(toYear, 1_250_000)]
    )
  );

const makeOffseasonTeam = (
  players: Array<ReturnType<typeof makeOffseasonPlayer>>,
  overrides: Partial<OffseasonTransitionParams['teamCapSheet']> = {}
): OffseasonTransitionParams['teamCapSheet'] => ({
  teamCode: 'TST',
  teamName: 'Test Team',
  players,
  roster: players.map((player) => player.player_id),
  capHolds: [],
  exceptions: {},
  totals: {},
  ...overrides,
});

describe('Architect final hardening pack chunk 1', () => {
  it('keeps executeTrade compute output structured around the hardened trade-path contracts', () => {
    const playerA = makeTradePlayer('player_a', 'Player A', 10_000_000, 'TMA');
    const playerB = makeTradePlayer('player_b', 'Player B', 10_000_000, 'TMB');

    const teamA = makeTradeTeam('TMA', 150_000_000, [playerA]);
    const teamB = makeTradeTeam('TMB', 120_000_000, [playerB]);

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            team: teamA,
            teamCode: 'TMA',
            sends: [{ ...playerA, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerB, matchIncoming: 10_000_000 }],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            team: teamB,
            teamCode: 'TMB',
            sends: [{ ...playerB, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerA, matchIncoming: 10_000_000 }],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_chunk1', seasonId: '2025-26' },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      },
      seasonId: '2025-26',
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_chunk1',
    });

    expect(result.success).toBe(true);
    expect(result.teamUpdates).toHaveLength(2);
    expect(result.teamUpdates?.map((update) => update.teamCode)).toEqual([
      'TMA',
      'TMB',
    ]);
    expect(result.metadata?.type).toBe('trade');
    expect(result.metadata?.teamsInvolved).toEqual(['TMA', 'TMB']);
    expect(result.metadata?.playersTraded).toEqual(['player_a', 'player_b']);
    expect(result._validatedTradeContext?._isValidatedTradeContext).toBe(true);
    expect(Array.isArray(result._validatedTradeContext?.teamResults)).toBe(
      true
    );
  });

  it('keeps option-decline transition output aligned with the hardened transition contracts', () => {
    const fromYear = 2026;
    const toYear = 2027;
    const optionPlayer = makeOffseasonPlayer('p-option', 'Option Player', [
      makeSeasonRow(fromYear, 8_000_000),
      makeSeasonRow(toYear, 9_000_000, 'Player Option'),
    ]);
    const retainedPlayer = makeOffseasonPlayer('p-stay', 'Retained Player', [
      makeSeasonRow(fromYear, 5_000_000),
      makeSeasonRow(toYear, 5_500_000),
    ]);
    const fillers = makeStandardRoster(13, fromYear, toYear);
    const team = makeOffseasonTeam([optionPlayer, retainedPlayer, ...fillers]);
    const optionDecisions: OffseasonOptionDecisionMap = {
      'p-option': {
        decision: 'decline',
        optionType: 'Player Option',
        season: toSeasonCode(toYear),
      },
    };

    const result = resolveOffseasonTransition({
      teamCapSheet: team,
      fromYear,
      toYear,
      optionDecisions,
    });

    expect(result.success).toBe(true);
    expect(result.appliedChangesSummary?.declinedOptions).toEqual([
      expect.objectContaining({
        playerId: 'p-option',
        playerName: 'Option Player',
        optionType: 'Player Option',
      }),
    ]);
    expect(result.appliedChangesSummary?.capHoldsCreated).toBe(1);
    expect(result.nextTeamCapSheet?.roster).not.toContain('p-option');
    expect(result.nextTeamCapSheet?.capHolds?.[0]).toEqual(
      expect.objectContaining({
        playerId: 'p-option',
        type: 'FA Cap Hold',
        season: toSeasonCode(toYear),
      })
    );
  });

  it('keeps TPE expiry and hard-cap reset behavior intact under the hardened transition contracts', () => {
    const fromYear = 2026;
    const toYear = 2027;
    const anchorPlayer = makeOffseasonPlayer('p-anchor', 'Anchor Player', [
      makeSeasonRow(fromYear, 7_000_000),
      makeSeasonRow(toYear, 7_000_000),
    ]);
    const fillers = makeStandardRoster(13, fromYear, toYear);
    const team = makeOffseasonTeam([anchorPlayer, ...fillers], {
      exceptions: {
        dpe: {
          enabled: true,
          totalAmount: 1_000_000,
          usedAmount: 250_000,
          remainingAmount: 750_000,
          seasonKey: '2025-26',
        },
        tpe: [
          {
            id: 'tpe-expired',
            totalAmount: 1_000_000,
            remainingAmount: 1_000_000,
            expiresOn: '2026-06-01T00:00:00.000Z',
          },
          {
            id: 'tpe-active',
            totalAmount: 2_000_000,
            remainingAmount: 2_000_000,
            expiresOn: '2026-08-01T00:00:00.000Z',
          },
        ],
      },
      hardCapTriggered: 'FirstApron',
      hardCapFirstApron: { active: true, reason: 'Test', season: '2025-26' },
      hardCapped: true,
      totals: {
        isHardCapped: true,
        hardCapLevel: 'firstApron',
        hardCapDetail: 'Triggered by test',
      },
    });

    const result = resolveOffseasonTransition({
      teamCapSheet: team,
      fromYear,
      toYear,
      optionDecisions: {},
    });

    expect(result.success).toBe(true);
    expect(result.appliedChangesSummary?.hardCapCleared).toBe(true);
    expect(result.appliedChangesSummary?.expiredTPEs).toHaveLength(1);
    expect(result.appliedChangesSummary?.expiredTPEs[0]?.id).toBe(
      'tpe-expired'
    );
    expect(result.nextTeamCapSheet?.hardCapTriggered).toBeUndefined();
    expect(result.nextTeamCapSheet?.hardCapped).toBe(false);
    expect(result.nextTeamCapSheet?.exceptions?.tpe).toHaveLength(1);
    expect(result.nextTeamCapSheet?.exceptions?.tpe?.[0]).toEqual(
      expect.objectContaining({ id: 'tpe-active' })
    );
  });
});
