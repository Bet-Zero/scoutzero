import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  penaltyDraftInput,
  penaltyBaseOrder,
} from '../e2e/fixtures/penaltyDraftWorld';
import { multiseasonApronFixture } from '../e2e/fixtures/multiseasonApronWorld';
import {
  apronInputFromHistory,
  observationForStep,
  readApronSimulation,
} from '@/features/architect/utils/draftReview/apronSimulation';
import {
  calculatePenaltyPlacement,
  readPenaltyPlacementReceipt,
} from '@/features/architect/utils/draftReview/penaltyPlacement';
import { registerSoftwareSeasonEnvironment } from '@/features/architect/utils/governedSeason/softwareSeasonEnvironment';
import { seasonEndYearsForWorld } from '@/features/architect/GMDashboard/hooks/useArchitectState.helpers';
import { preparePenaltyDraft } from '@/features/architect/utils/draftReview/penaltyDraft';

beforeEach(() => registerSoftwareSeasonEnvironment(() => true));
afterEach(() => registerSoftwareSeasonEnvironment(() => false));
function scenario(multiple = false) {
  const teams = multiple ? ['TOR', 'MIA', 'BOS'] : ['TOR'];
  const fixture = multiseasonApronFixture([1, 1, 0, 0], 8, teams);
  const history = fixture.plan.steps.map(observationForStep);
  const input = penaltyDraftInput(teams);
  const restrictions = penaltyBaseOrder.map((t) =>
    apronInputFromHistory(
      t,
      2033,
      history,
      '2033-06-23T12:00:00-04:00',
      fixture.plan
    )
  );
  return { fixture, history, input, restrictions };
}
describe('complete final first-round penalty placement', () => {
  it('admits a later viewing year only from the matching protected software context', () => {
    const s = scenario();
    const team = {
      salaryBookInputs: {
        softwareSeasonContext: s.fixture.plan.seasons!.at(-1),
      },
    };
    expect(seasonEndYearsForWorld({}, team, '2032-33')).toEqual([2033]);
    expect(seasonEndYearsForWorld({}, team, '2031-32')).toEqual([]);
    expect(
      seasonEndYearsForWorld(
        {},
        { salaryBookInputs: { softwareSeasonContext: {} } },
        '2032-33'
      )
    ).toEqual([]);
    registerSoftwareSeasonEnvironment(() => false);
    expect(seasonEndYearsForWorld({}, team, '2032-33')).toEqual([]);
  });
  it('keeps the factual apron gap while permitting consumed software status, but rejects allocation gaps and draft rights', () => {
    const s = scenario();
    const metadata = {
      ...s.fixture.metadata,
      currentSeason: '2032-33',
      asOfDate: '2032-07-01',
      draftApronHistory: s.history,
      draftPenaltyInput: s.input,
      draftSimulationCalendar: [{ year: 2033, date: s.input.date }],
    };
    const gap = {
      dependencyId: 'season:GSW:2025-26:last-regular-game-start',
      entitlementIds: ['GSW-2033'],
      actions: ['apron', 'transfer'],
    };
    const state = {
      metadata,
      apron: readApronSimulation(metadata),
      teams: Object.fromEntries(
        s.input.selections.map((p) => [
          p.holderTeam,
          { entitlementIds: [p.entitlementId] },
        ])
      ),
      entitlements: Object.fromEntries(
        s.input.selections.map((p) => [
          p.entitlementId,
          { kind: 'pick_ownership', holderTeam: p.holderTeam },
        ])
      ),
      catalogue: {
        data: {
          records: s.input.selections.map((p) => ({
            entitlementId: p.entitlementId,
            originalPick: { originalTeam: p.originalTeam, draftYear: 2033 },
            poolIds: [],
          })),
          unresolved: [gap],
        },
      },
    } as unknown as Parameters<typeof preparePenaltyDraft>[0];
    const before = JSON.stringify(state);
    expect(preparePenaltyDraft(state).positions).toHaveLength(30);
    expect(JSON.stringify(state)).toBe(before);
    gap.actions.push('allocate');
    expect(() => preparePenaltyDraft(state)).toThrow(/Unresolved source/);
    gap.actions.pop();
    gap.dependencyId = 'unknown-ownership-gap';
    expect(() => preparePenaltyDraft(state)).toThrow(/Unresolved source/);
    gap.dependencyId = 'season:GSW:2025-26:last-regular-game-start';
    state.catalogue.data.records.push({
      entitlementId: 'competing-right',
      originalPick: null,
      poolIds: ['GSW_2033_1st'],
    } as (typeof state.catalogue.data.records)[number]);
    s.input.reviewedRightIds.push('competing-right');
    expect(() => preparePenaltyDraft(state)).toThrow(/competing draft claims/);
  });
  it('moves a single penalty to 30 and shifts all 29 other selections, preserving owners', () => {
    const s = scenario();
    const rows = calculatePenaltyPlacement(s.input, s.restrictions);
    expect(rows.map((r) => r.originalTeam)).toEqual([
      ...penaltyBaseOrder.slice(1),
      'TOR',
    ]);
    for (const [i, row] of rows.entries()) {
      expect(row.position).toBe(i + 1);
      expect(row.beforePosition).toBe(row.originalTeam === 'TOR' ? 1 : i + 2);
      expect(row.holderTeam).toBe(row.originalTeam);
    }
  });
  it('uses original-team percentages for three penalties even after ownership transfers', () => {
    const s = scenario(true);
    s.input.selections[0].holderTeam = 'MIA';
    s.input.selections[1].holderTeam = 'TOR';
    const rows = calculatePenaltyPlacement(s.input, s.restrictions);
    expect(rows.map((r) => r.originalTeam)).toEqual([
      ...penaltyBaseOrder.slice(3),
      'MIA',
      'BOS',
      'TOR',
    ]);
    expect(
      rows.slice(-3).map((r) => [r.position, r.originalTeam, r.holderTeam])
    ).toEqual([
      [28, 'MIA', 'TOR'],
      [29, 'BOS', 'BOS'],
      [30, 'TOR', 'MIA'],
    ]);
  });
  it.each([
    [
      'incomplete order',
      (s: ReturnType<typeof scenario>) => {
        s.input.ordering = 'incomplete';
      },
    ],
    [
      'missing membership',
      (s) => {
        s.input.membershipComplete = false;
      },
    ],
    [
      'omitted penalty',
      (s) => {
        s.input.penalizedPickIds.pop();
      },
    ],
    [
      'duplicate penalty',
      (s) => {
        s.input.penalizedPickIds.push(s.input.penalizedPickIds[0]);
      },
    ],
    [
      'duplicate original',
      (s) => {
        s.input.selections[1].originalTeam = 'TOR';
      },
    ],
    [
      'conflicting claim',
      (s) => {
        s.input.selections[0].claimEntitlementIds.push('competing');
      },
    ],
    [
      'incomplete claims',
      (s) => {
        s.input.selections[0].claimsComplete = false;
      },
    ],
    [
      'unknown owner',
      (s) => {
        s.input.selections[0].holderTeam = 'XXX';
      },
    ],
    [
      'tie without procedure',
      (s) => {
        s.input.selections[1].originalTeamWinningPercentage = '0.6000';
      },
    ],
    [
      'missing percentage',
      (s) => {
        s.input.selections[0].originalTeamWinningPercentage = '';
      },
    ],
    [
      'incomplete restriction history',
      (s) => {
        s.restrictions[0].observations = [];
      },
    ],
    [
      'future restriction',
      (s) => {
        s.restrictions[0].asOf = '2034-06-23T12:00:00-04:00';
      },
    ],
    [
      'unfinished regular season',
      (s) => {
        s.input.regularSeasonCompletedOn = '2033-06-24';
      },
    ],
  ] as const)('fails closed: %s', (_, mutate) => {
    const s = scenario(true);
    mutate(s);
    expect(() => calculatePenaltyPlacement(s.input, s.restrictions)).toThrow();
  });
  it('does not turn eligible 2030–31 history into a 2033 saved date', () => {
    const s = scenario();
    expect(() =>
      readApronSimulation({
        ...s.fixture.metadata,
        currentSeason: '2030-31',
        asOfDate: '2033-06-23',
        draftApronHistory: s.history.slice(0, 5),
      })
    ).toThrow(/disagree/);
  });
  it('recomputes receipts and rejects a wrong final slot', () => {
    const s = scenario();
    const receipt = {
      scope: 'governed-simulation-only',
      worldId: 'w',
      operationId: 'op',
      catalogueSha256: 'a'.repeat(64),
      planDigest: 'p',
      input: s.input,
      restrictions: s.restrictions,
      positions: calculatePenaltyPlacement(s.input, s.restrictions),
    };
    expect(readPenaltyPlacementReceipt(receipt)).not.toBeNull();
    receipt.positions[29].position = 29;
    expect(readPenaltyPlacementReceipt(receipt)).toBeNull();
  });
});
