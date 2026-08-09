import { describe, expect, it } from 'vitest';

import {
  electEarlyBirdNonBirdForContract,
  projectRightsStateAsOf,
} from '@/features/architect/utils/rightsHistory';
import {
  RIGHTS_FIXTURE_AS_OF_DATE,
  RIGHTS_FIXTURE_PLAYER_ID,
  RIGHTS_FIXTURE_SALARY_CAP_YEAR,
  RIGHTS_FIXTURE_TEAM_ID,
  RIGHTS_FIXTURE_WORLD_ID,
  makeRightsEstablishedEvent,
  makeRightsLedger,
} from '../../fixtures/architect/rightsHistory';

const elect = (ledger: unknown) =>
  electEarlyBirdNonBirdForContract({
    ledger,
    worldId: RIGHTS_FIXTURE_WORLD_ID,
    teamId: RIGHTS_FIXTURE_TEAM_ID,
    playerId: RIGHTS_FIXTURE_PLAYER_ID,
    asOfDate: RIGHTS_FIXTURE_AS_OF_DATE,
    salaryCapYear: RIGHTS_FIXTURE_SALARY_CAP_YEAR,
    electedContractId: 'new-contract-bze-273',
    operationId: 'operation-election',
    authoringIdentity: 'user-bze-273',
    recordedAt: '2026-07-15T16:00:00Z',
  });

describe('governed Early Bird written election', () => {
  it('records Non-Bird authority for the new contract without rewriting classification or amount', () => {
    const ledger = makeRightsLedger(
      makeRightsEstablishedEvent({ qualifiedSeasons: 2 })
    );
    const result = elect(ledger);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.after.birdType).toBe('Early Bird');
    expect(result.after.signingBirdType).toBe('Non-Bird');
    expect(result.after.freeAgentAmount).toBe(14_950_000);
    expect(result.after.stateReference?.stateVersion).toBe(2);
    expect(result.event.canonLeafIds).toEqual(['CBA2-C14.9']);
    expect(result.event.sourceRightsState).toEqual(result.before.stateReference);
    expect(result.ledger.events[0]).toEqual(ledger.events[0]);
  });

  it.each([3, 1] as const)(
    'rejects a written election from a %s-season classification',
    (qualifiedSeasons) => {
      const result = elect(
        makeRightsLedger(makeRightsEstablishedEvent({ qualifiedSeasons }))
      );
      expect(result).toMatchObject({ success: false });
    }
  );

  it('rejects a repeated election and preserves the accepted ledger', () => {
    const first = elect(
      makeRightsLedger(makeRightsEstablishedEvent({ qualifiedSeasons: 2 }))
    );
    expect(first.success).toBe(true);
    if (!first.success) return;
    const second = elect(first.ledger);
    expect(second).toMatchObject({ success: false });
    expect(first.ledger.events).toHaveLength(2);
  });

  it('replays the election from serialization-equivalent data', () => {
    const first = elect(
      makeRightsLedger(makeRightsEstablishedEvent({ qualifiedSeasons: 2 }))
    );
    expect(first.success).toBe(true);
    if (!first.success) return;
    const replayed = projectRightsStateAsOf({
      ledger: JSON.parse(JSON.stringify(first.ledger)),
      worldId: RIGHTS_FIXTURE_WORLD_ID,
      teamId: RIGHTS_FIXTURE_TEAM_ID,
      playerId: RIGHTS_FIXTURE_PLAYER_ID,
      asOfDate: RIGHTS_FIXTURE_AS_OF_DATE,
      salaryCapYear: RIGHTS_FIXTURE_SALARY_CAP_YEAR,
    });
    expect(replayed.signingBirdType).toBe('Non-Bird');
    expect(replayed.stateReference?.stateVersion).toBe(2);
  });
});
