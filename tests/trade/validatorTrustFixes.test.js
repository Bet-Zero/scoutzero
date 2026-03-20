import { describe, expect, it } from 'vitest';
import capProjections from '@/features/architect/utils/capProjections.js';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText.js';

const CURRENT_YEAR = 2026;
const SEASON = '2025-26';
const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.UTC(2025, 6, 10, 12, 0, 0);

const makeContract = (salary, extra = {}) => ({
  contractType: extra.contractType,
  isTwoWay: extra.isTwoWay,
  salariesByYear: [
    {
      season: SEASON,
      salary,
      capHit: salary,
      guaranteed: extra.guaranteed ?? true,
    },
  ],
});

const makePlayer = (id, salary, extra = {}) => ({
  id,
  player_id: id,
  name: extra.name || id,
  teamCode: extra.teamCode || null,
  contract: extra.contract || makeContract(salary, extra),
  ...extra,
});

const makeRoster = (teamCode, count, salary = 1_000_000) =>
  Array.from({ length: count }, (_, index) =>
    makePlayer(`${teamCode}_player_${index}`, salary, { teamCode })
  );

const makeTeam = (teamCode, players, extra = {}) => {
  const computedTotalSalary = players.reduce((sum, player) => {
    const row = player.contract?.salariesByYear?.[0] || {};
    return sum + Number(row.capHit ?? row.salary ?? 0);
  }, 0);

  const totalSalary = extra.totalSalary ?? computedTotalSalary;

  return {
    id: teamCode,
    teamCode,
    teamId: teamCode,
    teamName: `Team ${teamCode}`,
    players,
    roster: players.map((player) => String(player.player_id || player.id)),
    capHolds: extra.capHolds || [],
    draftPicks: [],
    tradeExceptions: extra.tradeExceptions || [],
    faExceptionBuckets: extra.faExceptionBuckets,
    totals: { totalSalary, capHit: totalSalary },
    teamTotalSalary: totalSalary,
    totalSalary,
    ...extra,
  };
};

const makeSatContract = (firstYearSalary) => ({
  contractType: 'Sign & Trade',
  contractYears: 3,
  firstYearGuaranteed: true,
  salariesByYear: [
    {
      season: SEASON,
      salary: firstYearSalary,
      capHit: firstYearSalary,
      guaranteed: true,
    },
    {
      season: '2026-27',
      salary: Math.round(firstYearSalary * 1.05),
      capHit: Math.round(firstYearSalary * 1.05),
      guaranteed: true,
    },
    {
      season: '2027-28',
      salary: Math.round(firstYearSalary * 1.1),
      capHit: Math.round(firstYearSalary * 1.1),
      guaranteed: true,
    },
  ],
});

const issueTexts = (issues = []) => issues.map((issue) => getValidationIssueText(issue));

describe('validator trust fixes', () => {
  it('blocks outgoing two-way players through validateTrade', () => {
    const twoWayPlayer = makePlayer('lal_two_way', 600_000, {
      teamCode: 'LAL',
      contractType: 'two-way',
      isTwoWay: true,
    });
    const lakers = makeTeam('LAL', [twoWayPlayer, ...makeRoster('LAL', 14)], {
      totalSalary: 170_000_000,
    });
    const celtics = makeTeam('BOS', makeRoster('BOS', 14), {
      totalSalary: 160_000_000,
    });

    const result = validateTrade({
      teams: [
        { team: lakers, sends: [twoWayPlayer], entitlementsOut: [] },
        { team: celtics, sends: [], entitlementsOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
    });

    const lakersResult = result.teamResults.find((team) => team.teamId === 'LAL');

    expect(result.legal).toBe(false);
    expect(lakersResult?.rules?.eligibilityEnforcement).toMatchObject({
      passed: false,
    });
    expect(issueTexts(lakersResult?.rules?.eligibilityEnforcement?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Two-way contract:.*cannot be traded/i),
      ])
    );
    expect(issueTexts(lakersResult?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Two-way contract:.*cannot be traded/i),
      ])
    );
  });

  it('routes legal FA-exception absorption through validateTrade', () => {
    const faExceptionIncoming = makePlayer('fa_exception_sender', 8_000_000, {
      teamCode: 'LAL',
      absorptionMode: 'FA_EXCEPTION',
      bucketType: 'NTMLE',
    });
    const lakers = makeTeam(
      'LAL',
      [faExceptionIncoming, ...makeRoster('LAL', 14)],
      { totalSalary: 165_000_000 }
    );
    const celtics = makeTeam('BOS', makeRoster('BOS', 14), {
      totalSalary: 160_000_000,
      faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }],
    });

    const result = validateTrade({
      teams: [
        { team: lakers, sends: [faExceptionIncoming], entitlementsOut: [] },
        { team: celtics, sends: [], entitlementsOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
    });

    const celticsResult = result.teamResults.find(
      (team) => team.teamId === 'BOS'
    );

    expect(result.legal).toBe(true);
    expect(celticsResult?.rules?.faExceptionUsage?.passed).toBe(true);
    expect(celticsResult?.rules?.salaryMatching?.skipReason).toBe(
      'FA_EXCEPTION'
    );
    expect(celticsResult?.hardCapped).toBe(true);
  });

  it('blocks FA-exception aggregation through validateTrade using the live payload shape', () => {
    const faExceptionIncoming = makePlayer('fa_exception_sender', 8_000_000, {
      teamCode: 'LAL',
      absorptionMode: 'FA_EXCEPTION',
      bucketType: 'NTMLE',
    });
    const counterPlayer = makePlayer('bos_counter', 2_000_000, {
      teamCode: 'BOS',
    });
    const lakers = makeTeam(
      'LAL',
      [faExceptionIncoming, ...makeRoster('LAL', 13)],
      { totalSalary: 165_000_000 }
    );
    const celtics = makeTeam(
      'BOS',
      [counterPlayer, ...makeRoster('BOS', 14)],
      {
        totalSalary: 160_000_000,
        faExceptionBuckets: [{ type: 'NTMLE', remaining: 10_000_000 }],
      }
    );

    const result = validateTrade({
      teams: [
        { team: lakers, sends: [faExceptionIncoming], entitlementsOut: [] },
        { team: celtics, sends: [counterPlayer], entitlementsOut: [] },
      ],
      capProjections,
      currentYear: CURRENT_YEAR,
    });

    const celticsResult = result.teamResults.find(
      (team) => team.teamId === 'BOS'
    );

    expect(result.legal).toBe(false);
    expect(celticsResult?.rules?.faExceptionUsage?.passed).toBe(false);
    expect(issueTexts(celticsResult?.rules?.faExceptionUsage?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Cannot combine FA Exception with outgoing salary/i),
      ])
    );
  });

  it('threads asOfDate through executeTrade validation so S&T timing ownership changes by date', () => {
    const satPlayer = makePlayer('sat_player', 0, {
      teamCode: 'LAL',
      freeAgentYear: CURRENT_YEAR,
      signAndTrade: true,
      signAndTradeContract: makeSatContract(15_000_000),
      tradeTo: 'BOS',
      contract: {
        salariesByYear: [
          { season: SEASON, salary: 0, capHit: 0, guaranteed: false },
        ],
      },
    });
    const counterPlayer = makePlayer('bos_counter', 12_000_000, {
      teamCode: 'BOS',
      tradeTo: 'LAL',
    });

    const sourceTeam = makeTeam('LAL', [satPlayer, ...makeRoster('LAL', 13)], {
      capHolds: [
        {
          playerId: 'sat_player',
          playerName: 'sat_player',
          season: SEASON,
          active: true,
          isSigned: false,
        },
      ],
    });
    const destinationTeam = makeTeam(
      'BOS',
      [counterPlayer, ...makeRoster('BOS', 13)],
      {
        totalSalary: 140_000_000,
      }
    );

    const payload = {
      teams: [
        { teamCode: 'LAL', sends: [satPlayer], entitlementsOut: [] },
        { teamCode: 'BOS', sends: [counterPlayer], entitlementsOut: [] },
      ],
      tradeCtx: { source: 'tradeMachine' },
    };
    const currentState = {
      teams: [
        { teamCode: 'LAL', team: sourceTeam },
        { teamCode: 'BOS', team: destinationTeam },
      ],
    };

    const offseasonResult = computeWorldMutation({
      mutationType: 'executeTrade',
      payload,
      currentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_test',
      asOfDate: '2025-07-10',
    });

    const inSeasonResult = computeWorldMutation({
      mutationType: 'executeTrade',
      payload,
      currentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_test',
      asOfDate: '2026-02-01',
    });

    const offseasonSignAndTradeRule =
      offseasonResult._validatedTradeContext?._rawValidation?.teamResults?.[0]
        ?.rules?.signAndTrade;
    const offseasonTimingRule =
      offseasonResult._validatedTradeContext?._rawValidation?.teamResults?.[0]
        ?.rules?.timingEnforcement;
    const inSeasonSignAndTradeRule =
      inSeasonResult._validatedTradeContext?._rawValidation?.teamResults?.[0]
        ?.rules?.signAndTrade;

    expect(offseasonResult._validatedTradeContext?.legal).toBe(false);
    expect(issueTexts(offseasonSignAndTradeRule?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/January 15/i),
      ])
    );
    expect(issueTexts(offseasonTimingRule?.violations)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/January 15/i),
      ])
    );
    expect(inSeasonResult._validatedTradeContext?.legal).toBe(false);
    expect(issueTexts(inSeasonSignAndTradeRule?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/only be traded during the offseason/i),
      ])
    );
  });

  it('blocks prior-year team-held TPE usage through authoritative apply validation', () => {
    const heldTpe = {
      id: 'prior_year_tpe',
      amount: 6_000_000,
      totalAmount: 6_000_000,
      remaining: 6_000_000,
      remainingAmount: 6_000_000,
      expiresOn: '2026-09-01T00:00:00.000Z',
      expirationDate: '2026-09-01T00:00:00.000Z',
      createdSeason: 2025,
    };
    const tpeAbsorbedPlayer = makePlayer('bos_tpe_target', 5_000_000, {
      teamCode: 'BOS',
      tradeTo: 'LAL',
      absorptionMode: 'TPE',
      tpeId: heldTpe.id,
    });

    const sourceTeam = makeTeam('LAL', makeRoster('LAL', 14), {
      totalSalary: 220_000_000,
      exceptions: { tpe: [heldTpe] },
    });
    const destinationTeam = makeTeam(
      'BOS',
      [tpeAbsorbedPlayer, ...makeRoster('BOS', 14)],
      {
        totalSalary: 130_000_000,
      }
    );

    const payload = {
      teams: [
        { teamCode: 'LAL', sends: [], entitlementsOut: [] },
        { teamCode: 'BOS', sends: [tpeAbsorbedPlayer], entitlementsOut: [] },
      ],
      tradeCtx: {
        source: 'tradeMachine',
        tradeDate: '2026-02-01T00:00:00.000Z',
      },
    };
    const currentState = {
      teams: [
        { teamCode: 'LAL', team: sourceTeam },
        { teamCode: 'BOS', team: destinationTeam },
      ],
    };

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload,
      currentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_test',
      asOfDate: '2026-02-01',
    });

    const lakersResult = result._validatedTradeContext?._rawValidation?.teamResults?.find(
      (entry) => entry.teamId === 'LAL'
    );

    expect(result._validatedTradeContext?.legal).toBe(false);
    expect(issueTexts(lakersResult?.rules?.tradeExceptions?.violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/prior-year TPEs cannot be used/i),
      ])
    );
  });

  it('blocks seasonal cash-limit overflow through authoritative apply validation', () => {
    const outgoingLakers = makePlayer('lal_cash_out', 5_000_000, {
      teamCode: 'LAL',
      tradeTo: 'BOS',
    });
    const outgoingCeltics = makePlayer('bos_cash_out', 5_000_000, {
      teamCode: 'BOS',
      tradeTo: 'LAL',
    });

    const sourceTeam = makeTeam(
      'LAL',
      [outgoingLakers, ...makeRoster('LAL', 13)],
      {
        totalSalary: 160_000_000,
        cashLedger: { totalOut: 5_600_000 },
      }
    );
    const destinationTeam = makeTeam(
      'BOS',
      [outgoingCeltics, ...makeRoster('BOS', 13)],
      {
        totalSalary: 150_000_000,
      }
    );

    const payload = {
      teams: [
        {
          teamCode: 'LAL',
          sends: [outgoingLakers],
          entitlementsOut: [],
          cashSent: 500_000,
        },
        {
          teamCode: 'BOS',
          sends: [outgoingCeltics],
          entitlementsOut: [],
        },
      ],
      tradeCtx: {
        source: 'tradeMachine',
        tradeDate: '2025-07-10T00:00:00.000Z',
      },
    };
    const currentState = {
      teams: [
        { teamCode: 'LAL', team: sourceTeam },
        { teamCode: 'BOS', team: destinationTeam },
      ],
    };

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload,
      currentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_test',
      asOfDate: '2025-07-10',
    });

    const lakersResult = result._validatedTradeContext?._rawValidation?.teamResults?.find(
      (entry) => entry.teamId === 'LAL'
    );

    expect(result._validatedTradeContext?.legal).toBe(false);
    expect(issueTexts(lakersResult?.rules?.cash?.violations)).toEqual(
      expect.arrayContaining([expect.stringMatching(/seasonal limit/i)])
    );
  });
});
