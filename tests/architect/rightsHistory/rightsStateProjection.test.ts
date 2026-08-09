import { describe, expect, it } from 'vitest';

import { projectRightsStateAsOf } from '@/features/architect/utils/rightsHistory';
import {
  RIGHTS_FIXTURE_AS_OF_DATE,
  RIGHTS_FIXTURE_PLAYER_ID,
  RIGHTS_FIXTURE_SALARY_CAP_YEAR,
  RIGHTS_FIXTURE_TEAM_ID,
  RIGHTS_FIXTURE_WORLD_ID,
  makeRightsEstablishedEvent,
  makeRightsLedger,
} from '../../fixtures/architect/rightsHistory';

const project = (ledger: unknown) =>
  projectRightsStateAsOf({
    ledger,
    worldId: RIGHTS_FIXTURE_WORLD_ID,
    teamId: RIGHTS_FIXTURE_TEAM_ID,
    playerId: RIGHTS_FIXTURE_PLAYER_ID,
    asOfDate: RIGHTS_FIXTURE_AS_OF_DATE,
    salaryCapYear: RIGHTS_FIXTURE_SALARY_CAP_YEAR,
  });

describe('dated rights projection', () => {
  it.each([
    [3, 'Full Bird', 21_850_000],
    [2, 'Early Bird', 14_950_000],
    [1, 'Non-Bird', 13_800_000],
  ] as const)(
    'classifies %s exact preceding seasons as %s and calculates the governed amount',
    (qualifiedSeasons, birdType, amount) => {
      const result = project(
        makeRightsLedger(makeRightsEstablishedEvent({ qualifiedSeasons }))
      );
      expect(result.status).toBe('available');
      expect(result.birdType).toBe(birdType);
      expect(result.freeAgentAmount).toBe(amount);
    }
  );

  it('applies the rookie fourth-year 300% branch and maximum bound', () => {
    const event = makeRightsEstablishedEvent();
    const result = project(
      makeRightsLedger({
        ...event,
        priorContract: {
          ...event.priorContract,
          wasRookieScaleFourthYear: true,
        },
      })
    );
    expect(result.freeAgentAmount).toBe(30_000_000);
  });

  it('uses the at-or-above-EAPS Full Bird branch', () => {
    const result = project(
      makeRightsLedger(
        makeRightsEstablishedEvent({
          amountOverrides: { 'estimated-average-player-salary': 10_000_000 },
        })
      )
    );
    expect(result.freeAgentAmount).toBe(17_250_000);
  });

  it('uses the special prior one-season minimum amount capped at the two-YOS minimum', () => {
    const event = makeRightsEstablishedEvent({
      amountOverrides: {
        'applicable-minimum-salary': 2_500_000,
        'two-years-service-minimum-salary': 2_000_000,
      },
    });
    const result = project(
      makeRightsLedger({
        ...event,
        priorContract: {
          ...event.priorContract,
          wasOneSeasonMinimumContract: true,
        },
      })
    );
    expect(result.freeAgentAmount).toBe(2_000_000);
  });

  it('applies the player minimum when the ordinary calculation is lower', () => {
    const result = project(
      makeRightsLedger(
        makeRightsEstablishedEvent({
          amountOverrides: {
            'prior-regular-salary': 0,
            'prior-signing-bonus-allocation': 0,
            'earned-performance-bonuses': 0,
          },
        })
      )
    );
    expect(result.freeAgentAmount).toBe(1_500_000);
  });

  it('preserves UFA/RFA and ROFR state independently of Bird classification', () => {
    const result = project(
      makeRightsLedger(
        makeRightsEstablishedEvent({
          freeAgentStatus: 'RFA',
          rightOfFirstRefusal: 'active',
        })
      )
    );
    expect(result.freeAgentStatus).toBe('RFA');
    expect(result.rightOfFirstRefusal).toBe('active');
    expect(result.birdType).toBe('Full Bird');
  });

  it('fails closed when one exact service season is missing', () => {
    const event = makeRightsEstablishedEvent();
    const result = project(
      makeRightsLedger({ ...event, serviceSeasons: event.serviceSeasons.slice(0, 2) })
    );
    expect(result.status).toBe('needs-input');
    expect(result.reasons.join(' ')).toContain('service record is missing');
  });

  it('fails closed on conflicting current amount records', () => {
    const event = makeRightsEstablishedEvent();
    const duplicate = { ...event.amountRecords[0], amountRecordId: 'duplicate' };
    const result = project(
      makeRightsLedger({
        ...event,
        amountRecords: [...event.amountRecords, duplicate],
      })
    );
    expect(result.status).toBe('needs-input');
    expect(result.reasons.join(' ')).toContain('Conflicting current');
  });

  it('fails closed instead of silently downgrading inconsistent credited service', () => {
    const event = makeRightsEstablishedEvent();
    const first = event.serviceSeasons[0];
    const result = project(
      makeRightsLedger({
        ...event,
        serviceSeasons: [
          {
            ...first,
            creditedTeamId: 'OTHER',
            continuityRoute: 'same-team',
          },
          ...event.serviceSeasons.slice(1),
        ],
      })
    );
    expect(result.status).toBe('needs-input');
    expect(result.reasons.join(' ')).toContain('inconsistent');
  });

  it('fails closed on inconsistent UFA/RFA and ROFR evidence', () => {
    const result = project(
      makeRightsLedger(
        makeRightsEstablishedEvent({
          freeAgentStatus: 'RFA',
          rightOfFirstRefusal: 'not-applicable',
        })
      )
    );
    expect(result.status).toBe('needs-input');
    expect(result.reasons.join(' ')).toContain('Right of First Refusal');
  });

  it('fails closed on stale source versions', () => {
    const event = makeRightsEstablishedEvent();
    const first = event.amountRecords[0];
    const result = project(
      makeRightsLedger({
        ...event,
        amountRecords: [
          { ...first, source: { ...first.source, recordStatus: 'superseded' } },
          ...event.amountRecords.slice(1),
        ],
      })
    );
    expect(result.status).toBe('needs-input');
    expect(result.reasons.join(' ')).toContain('stale');
  });

  it('fails closed when the date and Salary Cap Year disagree', () => {
    const result = projectRightsStateAsOf({
      ledger: makeRightsLedger(),
      worldId: RIGHTS_FIXTURE_WORLD_ID,
      teamId: RIGHTS_FIXTURE_TEAM_ID,
      playerId: RIGHTS_FIXTURE_PLAYER_ID,
      asOfDate: '2025-07-15',
      salaryCapYear: RIGHTS_FIXTURE_SALARY_CAP_YEAR,
    });
    expect(result.status).toBe('incompatible');
  });

  it('returns a stable state and ledger reference for the transaction path', () => {
    const result = project(makeRightsLedger());
    expect(result.stateReference).toEqual({
      stateId: 'rights-ledger:player-bze-273:rights-state',
      stateVersion: 1,
    });
    expect(result.ledgerReference).toEqual({
      ledgerId: 'rights-ledger',
      ledgerVersion: 1,
    });
  });
});
