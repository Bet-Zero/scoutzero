import {
  packApronPlan,
  unpackApronPlan,
} from '@/features/architect/utils/draftReview/apronPlanStorage';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { multiseasonApronFixture } from '../e2e/fixtures/multiseasonApronWorld';
import {
  readApronSimulation,
  observationForStep,
  apronInputFromHistory,
  readApronSeasonReceipt,
} from '@/features/architect/utils/draftReview/apronSimulation';
import { registerSoftwareSeasonEnvironment } from '@/features/architect/utils/governedSeason/softwareSeasonEnvironment';
import { softwareSeasonRegistry } from '@/features/architect/utils/governedSeason/softwareSeasonContext';
import { resolveGovernedSeasonEnvelope } from '@/features/architect/utils/governedSeason';
import { resolveSeasonAdvanceAuthority } from '@/features/architect/utils/seasonManager.authority';
import { prepareSeasonAdvance } from '@/features/architect/utils/seasonManager.prepare';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { evaluateDraftApronLifecycle } from '@/features/architect/utils/draftApronMechanisms';

beforeEach(() => registerSoftwareSeasonEnvironment(() => true));
afterEach(() => registerSoftwareSeasonEnvironment(() => false));
describe('governed multi-season software chronology', () => {
  it.each([
    {
      name: 'penalty',
      followups: [1, 1, 0, 0],
      released: false,
      release: null,
    },
    {
      name: 'earliest release',
      followups: [0, -1, 0, 1],
      released: true,
      release: '2029-04-16T00:00:00-04:00',
    },
    {
      name: 'fourth-year release',
      followups: [1, 0, -1, 0],
      released: true,
      release: '2030-04-15T00:00:00-04:00',
    },
  ])(
    'prepares and reloads every consecutive season: $name',
    async ({ followups, released, release }) => {
      const f = multiseasonApronFixture(followups);
      let metadata: Record<string, unknown> = {
        ...f.metadata,
        draftSimulationCatalogue: 'a'.repeat(64),
      };
      let teams = Object.values(f.teams);
      // Firestore's root limit, including all five observation/book steps.
      const packed = packApronPlan(f.plan);
      expect(unpackApronPlan(packed.reference, packed.documents)).toEqual(
        f.plan
      );
      for (const doc of [packed.reference, ...Object.values(packed.documents)])
        expect(Buffer.byteLength(JSON.stringify(doc))).toBeLessThan(950000);
      for (let i = 0; i < 5; i++) {
        const apron = readApronSimulation(metadata);
        const authority = resolveSeasonAdvanceAuthority({
          worldId: 'w',
          worldSeason: String(metadata.currentSeason),
          worldAsOfDate: apron.next!.regularSeasonEnd.date,
          registry: apron.registry,
          requiredAuthority: 'software-test',
        });
        if (authority.status !== 'complete') throw new Error(authority.reason);
        const prepared = await prepareSeasonAdvance({
          worldId: 'w',
          worldMeta: metadata,
          teams,
          authority: authority.authority,
          operationId: `op${i}`,
          occurredAt: '2026-10-31T12:00:00Z',
          optionDecisions: {},
          focusTeamCode: 'TOR',
          worldLineage: ['w'],
          draftReview: null,
          conditionalSeasonBooks: apron.next!.targetBooks,
          apronSeason: apron,
          conditionalEnvironmentCheck: () => true,
        });
        expect(prepared.success, JSON.stringify(prepared)).toBe(true);
        if (!prepared.success) throw new Error(prepared.error);
        const receipt = readApronSeasonReceipt(
          Reflect.get(prepared.safeEvent.metadata, 'apronSeasonReceipt')
        )!;
        expect(receipt).not.toBeNull();
        expect(receipt.after).toHaveLength(i + 1);
        expect(receipt.restrictions).toHaveLength(30);
        const result = evaluateDraftApronLifecycle(
          receipt.restrictions.find((r) => r.team === 'TOR')
        );
        expect(result.placement.status).toBe('blocked');
        if (i === 1) expect(result.penalized.status).not.toBe('known');
        if (i === 2 && !released)
          expect(result.penalized).toMatchObject({
            status: 'known',
            value: true,
          });
        if (i === 4) {
          expect(result.unfrozen).toMatchObject({
            status: 'known',
            value: released,
          });
          expect(result.noPenalty).toMatchObject({
            status: 'known',
            value: released,
          });
          expect(result.releaseEffectiveAt ?? null).toBe(release);
        }
        metadata = JSON.parse(
          JSON.stringify({
            ...metadata,
            ...prepared.committedMetadata,
            draftApronHistory: receipt.after,
          })
        );
        teams = JSON.parse(
          JSON.stringify(prepared.preparedTeams.map((t) => t.committedTeam))
        );
        for (const team of teams) {
          const totals = createCanonicalTeamTotalsSnapshot(team, 2027 + i, {
            asOfDate: String(metadata.asOfDate),
          });
          expect(
            totals.salaryBooks.status,
            JSON.stringify(totals.salaryBooks)
          ).toBe('complete');
          expect(totals.salaryCap).toBe(f.plan.seasons![i + 1].salaryCap);
          expect(totals.secondApron).toBe(f.plan.seasons![i + 1].secondApron);
        }
        expect(readApronSimulation(metadata).history).toHaveLength(i + 1);
      }
      expect(readApronSimulation(metadata).next).toBeNull();
    }
  );

  it('keeps unconsumed outcomes pending and enforces the exact release instant', () => {
    const f = multiseasonApronFixture([0, 0, 0, 1]);
    const history = f.plan.steps.slice(0, 4).map(observationForStep);
    const input = (asOf: string) =>
      apronInputFromHistory('TOR', 2033, history, asOf, f.plan);
    const before = evaluateDraftApronLifecycle(
      input('2029-04-15T23:59:59-04:00')
    );
    const after = evaluateDraftApronLifecycle(
      input('2029-04-16T00:00:00-04:00')
    );
    expect(before.frozen).toMatchObject({ status: 'known', value: true });
    expect(after.unfrozen).toMatchObject({ status: 'known', value: true });
    expect(after.noPenalty).toMatchObject({ status: 'known', value: true });
    expect(
      apronInputFromHistory(
        'TOR',
        2033,
        history.slice(0, 1),
        f.plan.steps[0].tradingWindow.asOf,
        f.plan
      ).observations.filter((o) => o.state === 'supported')
    ).toHaveLength(1);
  });

  it('cannot promote software values to official authority or admit them outside the protected environment', () => {
    const c = multiseasonApronFixture().plan.seasons![2];
    const registry = softwareSeasonRegistry([c]);
    const request = {
      salaryCapYear: 2028,
      asOfDate: '2027-07-01T00:00:00-04:00',
      team: { teamId: 'TOR' },
      registry,
    };
    expect(
      resolveGovernedSeasonEnvelope({
        ...request,
        requiredAuthority: 'official',
      }).status
    ).toBe('unavailable');
    const software = resolveGovernedSeasonEnvelope({
      ...request,
      requiredAuthority: 'software-test',
    });
    expect(software.status).toBe('complete');
    expect(software.inputManifest!.calendar.sourceAuthorityClass).toBe(
      'software-test'
    );
    expect(
      software.inputManifest!.systemLevels.every(
        (level) => level.sourceAuthorityClass === 'software-test'
      )
    ).toBe(true);
    registerSoftwareSeasonEnvironment(() => false);
    expect(
      resolveGovernedSeasonEnvelope({
        ...request,
        requiredAuthority: 'software-test',
      }).status
    ).toBe('unavailable');
    expect(() => softwareSeasonRegistry([c])).toThrow();
  });

  it('uses the selected software minimum for offseason roster charges and leaves other-year books unavailable', () => {
    const f = multiseasonApronFixture();
    const team = {
      ...f.teams.TOR,
      salaryBookInputs: f.plan.steps[1].targetBooks.TOR,
    };
    team.players = team.players.filter((p, index) => index < 11 || p.isTwoWay);
    const totals = createCanonicalTeamTotalsSnapshot(team, 2028, {
      asOfDate: '2027-07-01',
    });
    expect(totals.incompleteChargesTotal).toBe(
      f.plan.seasons![2].zeroYosMinimum
    );
    expect(totals._meta.capSettingsSource).toBe('software-test');
    const unsupported = createCanonicalTeamTotalsSnapshot(team, 2032, {
      asOfDate: '2031-07-01',
    });
    expect(unsupported.salaryBooks.status).not.toBe('complete');
  });

  it.each([
    'missing-context',
    'wrong-books',
    'wrong-threshold',
    'wrong-calendar',
    'skip',
    'future-result',
    'history-drift',
  ])('rejects %s before preparation', (kind) => {
    const f = multiseasonApronFixture();
    if (kind === 'missing-context') f.plan.seasons!.splice(2, 1);
    if (kind === 'wrong-books')
      f.plan.steps[1].targetBooks.TOR.softwareSeasonContext =
        f.plan.seasons![1];
    if (kind === 'wrong-threshold')
      f.plan.steps[1].observations[0].value!.secondApronCents++;
    if (kind === 'wrong-calendar')
      f.plan.steps[1].regularSeasonEnd.date = '2027-04-12';
    if (kind === 'skip') f.plan.steps.splice(1, 1);
    if (kind === 'future-result')
      f.plan.futureObservations[0] = f.plan.steps[1].observations[0];
    if (kind === 'history-drift')
      Object.assign(f.metadata, {
        currentSeason: '2026-27',
        asOfDate: '2026-07-01',
        draftApronHistory: [observationForStep(f.plan.steps[1])],
      });
    expect(() => readApronSimulation(f.metadata)).toThrow();
  });
});
