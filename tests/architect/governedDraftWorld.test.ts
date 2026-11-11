import { describe, expect, it } from 'vitest';
import fixture from '../../functions/src/architect/fixtures/governedDraftWorld.json';
import {
  validateGovernedDraftBaseline,
  governedDraftHolders,
  reviewGovernedDraftWorldTrade,
} from '@/features/architect/utils/governedDraftWorld.baseline';
import { buildTradeApplyPreparation } from '@/features/architect/utils/tradeContext';
import { computeTradeResult } from '@/features/architect/utils/mutationPipeline.compute.trade';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import { draftFinancialState } from '@/features/architect/utils/tradeContext/draftFinancialPreservation';
import { retainDraftPersistenceSource } from '@/features/architect/utils/tradeContext/draftFinancialPersistence';
import {
  canonicalizeComputeResultTeamUpdates,
  buildGeneralMutationCommittedTeamUpdates,
} from '@/features/architect/utils/mutationPipeline.read.persistence.snapshots';
import {
  canonicalStringify,
  sha256Digest,
} from '@/features/architect/utils/contractSource/deterministicDigest';
import { GOVERNED_DRAFT_WORLD_FIXTURE_PIN } from '@/features/architect/utils/governedDraftWorldPin';
import pin from '../../functions/src/architect/fixtures/governedDraftWorldPin.json';
import { governedDraftWorldAssets } from '@/features/architect/utils/governedDraftWorld.assets';
import {
  LIVE_GOVERNED_TRADE_SALARY_AUTHORITY,
  normalizeDraftSelectionTeamAliases,
} from '@/features/architect/utils/tradeContext/tradeContext.payloadNormalization';

export function ordinaryDraftFixture(codes = ['BOS', 'MIA'], year = 2028) {
  const baseline = validateGovernedDraftBaseline(structuredClone(fixture));
  const { holders } = governedDraftHolders(baseline, []);
  const state = {
    teams: codes.map((teamCode) => {
      const raw = structuredClone(baseline.initialTeams[teamCode]);
      const team = {
        ...raw,
        entitlements: baseline.records
          .filter((r) => holders[String(r.entitlement.id)] === teamCode)
          .map((r) => r.entitlement),
      };
      retainDraftPersistenceSource(team, raw);
      return { teamCode, team };
    }),
  };
  const payload = {
    asOfDate: '2026-06-05',
    tradeCtx: {
      worldId: 'software-world',
      source: 'tradeMachine',
      asOfDate: '2026-06-05',
      yearKey: 2026,
    },
    teams: codes.map((teamCode, i) => ({
      teamCode,
      sends: [],
      picksOut: [],
      entitlementsOut: state.teams[i].team.entitlements
        .filter((e) => e.seasonYear === year)
        .map((e) => ({
          ...decorateEntitlementForTrade(e),
          entitlementId: e.id,
          toTeamId: codes[(i + 1) % codes.length],
        })),
    })),
  };
  return {
    baseline,
    holders,
    payload,
    state,
    stateVersion: 'software-world-state',
    seasonId: baseline.seasonId,
    timestamp: Date.parse(baseline.asOf),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose fixture documents
type Loose = Record<string, any>;

/** Gives a fixture team's first player an exact governed salary basis. */
function withGovernedPlayer(
  f: ReturnType<typeof ordinaryDraftFixture>,
  index: number,
  to: string
) {
  const slot = f.state.teams[index];
  const team = slot.team as Loose;
  const player = team.players[0];
  const salary = player.contract.salariesByYear[0].salary;
  player.governedTradeSalaryBasis = {
    authorityVersion: 1,
    status: 'ready',
    worldId: 'software-world',
    teamId: slot.teamCode,
    playerId: player.id,
    contractId: `${player.id}:contract`,
    asOfDate: '2026-06-05',
    salaryCapYear: 2026,
    method: 'postseason-lesser-of',
    currentSalary: salary,
    outgoingSalary: salary,
    incomingSalary: salary,
    poisonPillIncomingSalary: null,
    canonLeafIds: ['CBA2-A03.3'],
    reasons: [],
    proof: {
      ledgerId: 'l',
      ledgerVersion: 1,
      contractVersion: 1,
      stateDigest: 'fnv1a64:aaaaaaaaaaaaaaaa',
      calendarRecordId: 'calendar',
      calendarRecordVersion: 1,
      calendarSourceRecordId: 'source',
      calendarSourceRecordVersion: 1,
    },
  };
  for (const s of f.state.teams)
    Object.defineProperty(s.team, LIVE_GOVERNED_TRADE_SALARY_AUTHORITY, {
      value: true,
      configurable: true,
    });
  const payloadTeam = f.payload.teams[index] as Loose;
  payloadTeam.sends = [
    {
      id: player.id,
      playerId: player.id,
      tradeTo: to,
      receivingTeamIndex: 1 - index,
    },
  ];
  for (const t of f.payload.teams as Loose[])
    t.salaryMatchingElection = {
      version: 1,
      path: 'STANDARD_TPE',
      postAssignmentApronTeamSalary: 170_000_000,
      tradedPlayerPreTradeSalaries:
        t === payloadTeam ? { [player.id]: salary } : {},
    };
  return player.id as string;
}

describe('ordinary draft world adapter (software fixtures, not NBA facts)', () => {
  it('binds the same complete immutable fixture on client and initializer', async () => {
    expect(GOVERNED_DRAFT_WORLD_FIXTURE_PIN).toEqual(pin);
    expect((await sha256Digest(canonicalStringify(fixture))).slice(7)).toBe(
      pin.sha256
    );
  });
  it('rejects inconsistent original-team bindings and preserves unknown selection terms during UI routing', () => {
    const baseline = structuredClone(fixture);
    baseline.records[0].ownership.pick.originalTeam = 'MIA';
    expect(() => validateGovernedDraftBaseline(baseline)).toThrow();
    expect(
      normalizeDraftSelectionTeamAliases({
        fromTeamId: 'celtics',
        toTeamId: 'heat',
        hiddenCash: 1,
      })
    ).toEqual({ fromTeamId: 'BOS', toTeamId: 'MIA', hiddenCash: 1 });
  });
  it('retains a full software universe and unresolved mappings separately from executable rights', () => {
    const baseline = validateGovernedDraftBaseline(structuredClone(fixture));
    // Cardinality regression only: these 257 added definitions are invented
    // test inputs, never the retained NBA catalogue or its actual unresolved IDs.
    for (let i = 0; i < 257; i++) {
      const id = `software:unqualified:${i}`;
      baseline.identities.push(id);
      baseline.retainedEntitlements[id] = {
        id,
        holderTeam: 'BOS',
        description: 'Unqualified software holding',
      };
      (baseline.initialTeams.BOS.entitlementIds as string[]).push(id);
      if (i < 29)
        baseline.unresolved.push({
          dependencyId: `software:missing:${i}`,
          entitlementIds: [id],
          occurrenceIds: [],
          actions: ['transfer', 'allocate', 'stepien', 'apron'],
          reason: 'Software mapping unresolved',
          missingSource: 'software-only',
          sourceRefs: ['software-only'],
        });
    }
    const admitted = validateGovernedDraftBaseline(baseline);
    expect(admitted.identities).toHaveLength(278);
    expect(admitted.unresolved).toEqual(baseline.unresolved);
    expect(admitted.unresolved).toHaveLength(29);
    const replay = governedDraftHolders(admitted, []);
    expect(Object.keys(replay.holders)).toHaveLength(278);
    expect(
      governedDraftWorldAssets(
        { baseline: admitted, holders: replay.holders },
        'BOS',
        2026
      ).status
    ).toBe('available');
    const assets = governedDraftWorldAssets(
      { baseline: admitted, holders: replay.holders },
      'BOS',
      2026
    );
    expect(assets.status === 'available' && assets.rightCount).toBe(257);
    expect(() =>
      governedDraftHolders(admitted, [
        {
          operationId: 'invalid',
          asOfDate: '2026-06-05',
          movements: [
            {
              entitlementId: 'software:unqualified:0',
              fromTeam: 'BOS',
              toTeam: 'MIA',
            },
          ],
        },
      ])
    ).toThrow('inconsistent');
    delete admitted.retainedEntitlements['software:unqualified:0'];
    expect(() => validateGovernedDraftBaseline(admitted)).toThrow(
      'identity membership'
    );
  });
  it.each([
    ['BOS', 'MIA'],
    ['BOS', 'MIA', 'NYK'],
  ])(
    'uses the existing ownership, Stepien and consideration engines for %j',
    async (...codes) => {
      const f = ordinaryDraftFixture(codes);
      const result = await reviewGovernedDraftWorldTrade(f);
      expect(result.reviews.map((r) => r.reasons)).toEqual(codes.map(() => []));
      expect(result.reviews.every((r) => r.eligible)).toBe(true);
      expect(result.movements).toHaveLength(codes.length);
    }
  );
  it('preserves the exact stored financial document through final serialization', () => {
    const f = ordinaryDraftFixture();
    const preparation = buildTradeApplyPreparation({
      ...f,
      currentState: f.state,
    });
    // Component proof cannot authorize saving: the ordinary source capability is separate.
    expect(preparation.validatedContext.legal).toBe(false);
    const computed = computeTradeResult({
      ...f,
      currentState: f.state,
      postTradeSnapshot: preparation.postTradeSnapshot,
      validatedContext: preparation.validatedContext,
    });
    const canonical = canonicalizeComputeResultTeamUpdates(
      computed,
      f.seasonId,
      '2026-06-05'
    );
    const committed = buildGeneralMutationCommittedTeamUpdates(
      canonical.teamUpdates,
      f.seasonId,
      '2026-06-05'
    );
    for (const row of committed) {
      expect(draftFinancialState(row.team!)).toEqual(
        draftFinancialState(f.baseline.initialTeams[row.teamCode!])
      );
      expect(row.team).not.toHaveProperty('entitlements');
    }
    computed.teamUpdates![0].team!.cashLedger = { invented: true } as never;
    expect(() =>
      canonicalizeComputeResultTeamUpdates(computed, f.seasonId, '2026-06-05')
    ).toThrow('changed after computation');
  });
  it('replays custody without minting rights and detects duplicate/reversed history', () => {
    const f = ordinaryDraftFixture();
    const movement = {
      entitlementId: 'software:BOS:2028:first',
      fromTeam: 'BOS',
      toTeam: 'MIA',
    };
    const transfer = {
      operationId: 'trade_1',
      asOfDate: '2026-06-05',
      movements: [movement],
    };
    expect(
      governedDraftHolders(f.baseline, [transfer]).holders[
        movement.entitlementId
      ]
    ).toBe('MIA');
    expect(() =>
      governedDraftHolders(f.baseline, [transfer, transfer])
    ).toThrow('duplicate');
    expect(() =>
      governedDraftHolders(f.baseline, [
        { ...transfer, movements: [{ ...movement, fromTeam: 'NYK' }] },
      ])
    ).toThrow('inconsistent');
  });
  it('keeps missing freeze evidence blocking a later first', async () => {
    const result = await reviewGovernedDraftWorldTrade(
      ordinaryDraftFixture(['BOS', 'MIA'], 2032)
    );
    expect(result.reviews.every((r) => !r.eligible)).toBe(true);
    expect(JSON.stringify(result.reviews)).toContain('missing-apron-input');
  });
  it('keeps Stepien needs-input blocking when positive retained witnesses disappear', async () => {
    const f = ordinaryDraftFixture();
    f.baseline.records = f.baseline.records.filter(
      (r) =>
        r.entitlement.holderTeam !== 'BOS' || r.entitlement.seasonYear === 2028
    );
    const result = await reviewGovernedDraftWorldTrade(f);
    expect(result.reviews[0].eligible).toBe(false);
    expect(result.reviews[0].reasons.join()).toContain('stepien:needs-input');
  });

  it('admits players travelling with firsts and lists them as consideration (V1 B1)', async () => {
    const f = ordinaryDraftFixture();
    const id = withGovernedPlayer(f, 0, 'MIA');
    const review = await reviewGovernedDraftWorldTrade(f);
    expect(review.reviews.map((r) => r.eligible)).toEqual([true, true]);
    expect(review.playerMovements).toEqual([
      {
        playerId: id,
        contractId: `${id}:contract`,
        fromTeam: 'BOS',
        toTeam: 'MIA',
      },
    ]);
  });
  it('reviews only the teams that send firsts when the other sends only players', async () => {
    const f = ordinaryDraftFixture();
    withGovernedPlayer(f, 1, 'BOS');
    f.payload.teams[1].entitlementsOut = [];
    const review = await reviewGovernedDraftWorldTrade(f);
    expect(review.reviews).toHaveLength(1);
    expect(review.reviews[0].eligible).toBe(true);
    expect(review.firstsByTeam.MIA).toEqual([]);
  });
  it('still needs consideration both ways, matching elections and no cash with players', async () => {
    const gift = ordinaryDraftFixture();
    withGovernedPlayer(gift, 0, 'MIA');
    gift.payload.teams[1].entitlementsOut = [];
    await expect(reviewGovernedDraftWorldTrade(gift)).rejects.toThrow(
      /give and receive/
    );
    const noElection = ordinaryDraftFixture();
    withGovernedPlayer(noElection, 0, 'MIA');
    for (const t of noElection.payload.teams as Loose[])
      delete t.salaryMatchingElection;
    await expect(reviewGovernedDraftWorldTrade(noElection)).rejects.toThrow(
      /matching path/
    );
    const cash = ordinaryDraftFixture();
    withGovernedPlayer(cash, 0, 'MIA');
    Object.assign(cash.payload.teams[0], { cashSent: 1 });
    await expect(reviewGovernedDraftWorldTrade(cash)).rejects.toThrow(
      'no financial'
    );
    const unbased = ordinaryDraftFixture();
    withGovernedPlayer(unbased, 0, 'MIA');
    delete (unbased.state.teams[0].team as Loose).players[0]
      .governedTradeSalaryBasis;
    await expect(reviewGovernedDraftWorldTrade(unbased)).rejects.toThrow(
      /salary basis/
    );
  });
  it('rejects new financial terms before source components can grant authority', async () => {
    const f = ordinaryDraftFixture();
    Object.assign(f.payload.teams[0], { cashSent: 1 });
    await expect(reviewGovernedDraftWorldTrade(f)).rejects.toThrow(
      'no financial'
    );
  });
  it('projects both affected teams from the current custody without legacy inventory writes', async () => {
    const f = ordinaryDraftFixture();
    const review = await reviewGovernedDraftWorldTrade(f);
    const holders = { ...f.holders };
    for (const move of review.movements)
      holders[move.entitlementId] = move.toTeam;
    for (const [team, other] of [
      ['BOS', 'MIA'],
      ['MIA', 'BOS'],
    ]) {
      const assets = governedDraftWorldAssets(
        { baseline: f.baseline, holders },
        team,
        2026
      );
      expect(assets.status).toBe('available');
      if (assets.status !== 'available')
        throw new Error('Expected available fixture assets');
      expect(assets.firstRoundCount).toBe(7);
      expect(
        assets.years.find((y) => y.year === 2028)?.firstRound[0].sourceLabel
      ).toBe(`via ${other}`);
      expect(assets.outgoing).toContainEqual(
        expect.objectContaining({
          key: `software:${team}:2028:first`,
          sourceLabel: `to ${other}`,
        })
      );
    }
  });
});
