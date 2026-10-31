import { describe, expect, it } from 'vitest';
import { apronDraftFixture } from '../e2e/fixtures/apronDraftWorld';
import {
  readApronSimulation,
  observationForStep,
  apronInputFromHistory,
  readApronSeasonReceipt,
} from '@/features/architect/utils/draftReview/apronSimulation';
import { resolveSeasonAdvanceAuthority } from '@/features/architect/utils/seasonManager.authority';
import { evaluateDraftApronLifecycle } from '@/features/architect/utils/draftApronMechanisms';
import { prepareSeasonAdvance } from '@/features/architect/utils/seasonManager.prepare';
import { reviewSimulationDraftWindow } from '@/features/architect/utils/draftReview/horizon';
import { deriveDraftAssetDelta } from '@/features/architect/comparison/deriveDraftAssetDelta';

const catalogueSha256 =
  '3f288ba96decf716b25596510beb01d9f741781169e98e553d04c58409530671';
describe('saved 2025–26 Apron freeze observation', () => {
  it.each([-1, 0, 1])(
    'prepares all 30 teams and derives the strict threshold at %i cent excess',
    async (excess) => {
      const fixture = apronDraftFixture(excess);
      const metadata = {
        ...fixture.metadata,
        draftSimulationCatalogue: catalogueSha256,
        draftSimulationKind: 'retained-picks-governed-test-v1',
      };
      const apron = readApronSimulation(metadata);
      const resolved = resolveSeasonAdvanceAuthority({
        worldId: 'w',
        worldSeason: '2025-26',
        worldAsOfDate: '2026-04-12',
      });
      if (resolved.status !== 'complete') throw new Error(resolved.reason);
      const prepared = await prepareSeasonAdvance({
        worldId: 'w',
        worldMeta: metadata,
        teams: Object.values(fixture.teams),
        authority: resolved.authority,
        operationId: 'op',
        occurredAt: '2026-10-31T12:00:00Z',
        optionDecisions: {},
        focusTeamCode: 'TOR',
        worldLineage: ['w'],
        draftReview: null,
        conditionalSeasonBooks: apron.next!.targetBooks,
        conditionalEnvironmentCheck: () => true,
        apronSeason: apron,
      });
      expect(prepared.success, JSON.stringify(prepared)).toBe(true);
      if (!prepared.success) throw new Error(prepared.error);
      expect(prepared.preparedTeams).toHaveLength(30);
      const receipt = readApronSeasonReceipt(
        Reflect.get(prepared.safeEvent.metadata, 'apronSeasonReceipt')
      )!;
      expect(receipt.before).toEqual([]);
      expect(receipt.after).toHaveLength(1);
      expect(receipt.restrictions).toHaveLength(30);
      const result = evaluateDraftApronLifecycle(
        receipt.restrictions.find((r) => r.team === 'TOR')
      );
      expect(result.frozen).toMatchObject({
        status: 'known',
        value: excess > 0,
      });
      expect(result.unfrozen.status).not.toBe('known');
      expect(result.penalized.status).not.toBe('known');
      expect(result.placement.status).toBe('blocked');
      const saved = readApronSimulation({
        ...metadata,
        currentSeason: '2026-27',
        asOfDate: '2026-07-01',
        draftApronHistory: receipt.after,
      });
      expect(saved.next).toBeNull();
      expect(
        deriveDraftAssetDelta(
          [{ mutationType: 'seasonAdvance', raw: prepared.safeEvent }],
          'w',
          'TOR'
        )?.restrictions?.[0]
      ).toContain(excess > 0 ? 'Frozen' : 'No freeze triggered');
      const forged = structuredClone(receipt);
      forged.restrictions[0].observations[0].value!.apronTeamSalaryCents += 100;
      expect(readApronSeasonReceipt(forged)).toBeNull();
      expect(
        deriveDraftAssetDelta(
          [
            {
              mutationType: 'seasonAdvance',
              raw: {
                ...prepared.safeEvent,
                metadata: { apronSeasonReceipt: forged },
              },
            },
          ],
          'w',
          'TOR'
        )
      ).toBeNull();
    }
  );

  it('separates the dated seven-draft window from future release and penalty facts', () => {
    const f = apronDraftFixture();
    const history = [observationForStep(f.plan.steps[0])];
    const input = apronInputFromHistory(
      'TOR',
      2033,
      history,
      '2026-07-01T00:00:00-04:00',
      f.plan
    );
    expect(
      input.observations.filter((o) => o.state === 'supported')
    ).toHaveLength(1);
    expect(evaluateDraftApronLifecycle(input).unfrozen.status).toBe(
      'future-pending'
    );
    const w = f.plan.steps[0].tradingWindow;
    expect(reviewSimulationDraftWindow(w, w.asOf, [2033]).status).toBe(
      'permits'
    );
    expect(reviewSimulationDraftWindow(w, w.asOf, [2034]).status).toBe(
      'prohibits'
    );
    expect(
      reviewSimulationDraftWindow(w, '2026-06-05T00:00:00Z', [2033]).status
    ).toBe('needs-input');
    expect(
      evaluateDraftApronLifecycle(
        apronInputFromHistory('MIA', 2033, history, w.asOf, f.plan)
      ).freezeTriggered
    ).toMatchObject({ status: 'known', value: false });
  });

  it.each([
    'missing',
    'conflict',
    'future',
    'wrong-game',
    'missing-books',
    'wrong-year',
    'forged-history',
    'threshold',
    'future-result',
    'skip',
  ] as const)('rejects %s without preparing permission', (kind) => {
    const f = apronDraftFixture();
    const m: Record<string, unknown> = f.metadata;
    if (kind === 'missing') f.plan.steps[0].observations.pop();
    if (kind === 'conflict')
      f.plan.steps[0].observations[0].state = 'conflicting';
    if (kind === 'future')
      f.plan.steps[0].observations[0].value!.measuredAt =
        '2027-04-12T19:00:00-04:00';
    if (kind === 'wrong-game')
      f.plan.steps[0].observations[0].value!.lastRegularSeasonGameStart =
        '2026-04-12T20:00:00-04:00';
    if (kind === 'missing-books') delete f.plan.steps[0].targetBooks.ATL;
    if (kind === 'wrong-year') m.currentSeason = '2027-28';
    if (kind === 'forged-history')
      m.draftApronHistory = [observationForStep(f.plan.steps[0])];
    if (kind === 'threshold')
      f.plan.steps[0].observations[0].value!.secondApronCents--;
    if (kind === 'future-result')
      f.plan.futureObservations[0] = {
        ...f.plan.steps[0].observations[0],
        seasonStartYear: 2026,
      };
    if (kind === 'skip') f.plan.steps.push(f.plan.steps[0]);
    expect(() => readApronSimulation(m)).toThrow();
  });
});
