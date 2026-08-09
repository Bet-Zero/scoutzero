import { describe, expect, it } from 'vitest';

import {
  projectRightsStateAsOf,
  renounceGovernedRights,
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

const renounce = (ledger: unknown, overrides: Partial<Parameters<typeof renounceGovernedRights>[0]> = {}) =>
  renounceGovernedRights({
    ledger,
    worldId: RIGHTS_FIXTURE_WORLD_ID,
    teamId: RIGHTS_FIXTURE_TEAM_ID,
    playerId: RIGHTS_FIXTURE_PLAYER_ID,
    asOfDate: RIGHTS_FIXTURE_AS_OF_DATE,
    salaryCapYear: RIGHTS_FIXTURE_SALARY_CAP_YEAR,
    operationId: 'operation-renounce',
    authoringIdentity: 'user-bze-273',
    recordedAt: '2026-07-15T16:00:00Z',
    ...overrides,
  });

describe('governed rights renunciation', () => {
  it('fails closed instead of throwing for a structurally invalid ledger', () => {
    expect(() => renounce({})).not.toThrow();
    expect(renounce({})).toMatchObject({ success: false });
  });

  it('appends a renunciation and projects the resulting state', () => {
    const result = renounce(makeRightsLedger());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.ledger.events).toHaveLength(2);
    expect(result.after.status).toBe('renounced');
    expect(result.after.birdType).toBe('None');
    expect(result.after.signingBirdType).toBe('None');
    expect(result.after.freeAgentAmount).toBe(0);
    expect(result.after.postRenunciationSigningAuthorities).toEqual([
      'Room',
      'Minimum Exception',
      'Two-Way',
    ]);
    expect(result.after.stateReference?.stateVersion).toBe(2);
    expect(result.event.eventId).toContain(':2027:renunciation:');
  });

  it('does not mutate the prior service, source, or amount evidence', () => {
    const ledger = makeRightsLedger();
    const prior = JSON.stringify(ledger);
    const result = renounce(ledger);
    expect(result.success).toBe(true);
    expect(JSON.stringify(ledger)).toBe(prior);
    if (!result.success) return;
    expect(result.ledger.events[0]).toEqual(ledger.events[0]);
  });

  it('retains exact operation and author provenance', () => {
    const result = renounce(makeRightsLedger());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.event.provenance).toEqual({
      sourceTransactionId: 'operation-renounce',
      authoringIdentity: 'user-bze-273',
    });
  });

  it('blocks an RFA while Right of First Refusal remains active', () => {
    const result = renounce(
      makeRightsLedger(
        makeRightsEstablishedEvent({
          freeAgentStatus: 'RFA',
          rightOfFirstRefusal: 'active',
        })
      )
    );
    expect(result).toMatchObject({ success: false });
    if (result.success) return;
    expect(result.error).toContain('Right of First Refusal');
  });

  it('allows an RFA after Right of First Refusal is inactive', () => {
    const result = renounce(
      makeRightsLedger(
        makeRightsEstablishedEvent({
          freeAgentStatus: 'RFA',
          rightOfFirstRefusal: 'inactive',
        })
      )
    );
    expect(result.success).toBe(true);
  });

  it('blocks a date before July 1 following the last contract season', () => {
    const result = renounce(makeRightsLedger(), {
      asOfDate: '2026-06-30',
    });
    expect(result).toMatchObject({ success: false });
  });

  it('allows the exact governed July 1 calendar boundary', () => {
    const result = renounce(makeRightsLedger(), {
      asOfDate: '2026-07-01',
      recordedAt: '2026-07-01T16:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('records a scheduled future effect without making the runtime clock authoritative', () => {
    const result = renounce(makeRightsLedger(), {
      recordedAt: '2026-07-05T16:00:00Z',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.event.executedAt).toBe('2026-07-05T16:00:00Z');
    expect(result.event.effectiveAt).toBe(RIGHTS_FIXTURE_AS_OF_DATE);
    expect(result.after.status).toBe('renounced');
  });

  it('rejects an invalid recorded timestamp without throwing', () => {
    expect(
      renounce(makeRightsLedger(), { recordedAt: 'not-an-instant' })
    ).toMatchObject({ success: false });
  });

  it('rejects a repeated renunciation without appending another event', () => {
    const first = renounce(makeRightsLedger());
    expect(first.success).toBe(true);
    if (!first.success) return;
    const second = renounce(first.ledger, {
      operationId: 'operation-renounce-again',
    });
    expect(second).toMatchObject({ success: false });
    if (second.success) return;
    expect(second.error).toContain('already renounced');
    expect(first.ledger.events).toHaveLength(2);
  });

  it('replays the accepted appended chain from serialization-equivalent data', () => {
    const first = renounce(makeRightsLedger());
    expect(first.success).toBe(true);
    if (!first.success) return;
    const serialized = JSON.parse(JSON.stringify(first.ledger));
    const projected = projectRightsStateAsOf({
      ledger: serialized,
      worldId: RIGHTS_FIXTURE_WORLD_ID,
      teamId: RIGHTS_FIXTURE_TEAM_ID,
      playerId: RIGHTS_FIXTURE_PLAYER_ID,
      asOfDate: RIGHTS_FIXTURE_AS_OF_DATE,
      salaryCapYear: RIGHTS_FIXTURE_SALARY_CAP_YEAR,
    });
    expect(projected.status).toBe('renounced');
    expect(projected.stateReference?.stateVersion).toBe(2);
  });
});
