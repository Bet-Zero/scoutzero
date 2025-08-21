import { describe, it, expect, afterEach } from 'vitest';
import { enforceConsent } from '@/utils/architect/tradeMachine/rules/enforceConsent.js';
import { validationFlags } from '@/config/validationFlags.js';

const makeTeam = (player) => ({ outgoingPlayers: [player] });

describe('player consent enforcement', () => {
  afterEach(() => {
    validationFlags.consent = 'error';
  });

  it('rejects full NTC without consent', () => {
    const rejects = [];
    enforceConsent(
      makeTeam({ name: 'Full NTC', hasFullNTC: true, tradeTo: 2 }),
      {},
      { reject: (m) => rejects.push(m) }
    );
    expect(rejects).toContain('Player NTC — consent required');
  });

  it('rejects limited NTC without consent', () => {
    const rejects = [];
    enforceConsent(
      makeTeam({
        name: 'Limited',
        limitedNTCTeamIds: [2],
        tradeTo: 3, // Changed to team 3 (NOT on approved list)
      }),
      {},
      { reject: (m) => rejects.push(m) }
    );
    expect(rejects).toContain('Player NTC — consent required');
  });

  it('handles Bird rights veto', () => {
    const rejects = [];
    enforceConsent(
      makeTeam({
        name: 'Bird',
        onOneYearBirdDeal: true,
        currentTeamId: 1,
        tradeTo: 2,
      }),
      {},
      { reject: (m) => rejects.push(m) }
    );
    expect(rejects).toContain('1-yr Bird veto — consent required');

    const none = [];
    enforceConsent(
      makeTeam({
        name: 'Bird',
        onOneYearBirdDeal: true,
        currentTeamId: 1,
        tradeTo: 2,
        consentGranted: true,
      }),
      {},
      { reject: (m) => none.push(m) }
    );
    expect(none.length).toBe(0);
  });
});
