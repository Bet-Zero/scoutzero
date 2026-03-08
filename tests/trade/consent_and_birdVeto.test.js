import { describe, it, expect, afterEach } from 'vitest';
import { enforceConsent } from '@/features/architect/utils/tradeMachine/rules/enforceConsent.js';
import { validationFlags } from '@/config/validationFlags.js';

const makeTeam = (player) => ({ outgoingPlayers: [player] });

describe('player consent enforcement', () => {
  afterEach(() => {
    validationFlags.consent = 'error';
  });

  it('rejects full NTC without consent', () => {
    const rejects = [];
    const violations = enforceConsent(
      makeTeam({ name: 'Full NTC', hasFullNTC: true, tradeTo: 2 }),
      {},
      { reject: (m) => rejects.push(m) }
    );
    expect(violations).toEqual(rejects);
    expect(typeof violations[0]).toBe('string');
    expect(rejects).toContain('Player NTC — consent required');
  });

  it('rejects limited NTC without consent', () => {
    const rejects = [];
    const violations = enforceConsent(
      makeTeam({
        name: 'Limited',
        limitedNTCTeamIds: [2],
        tradeTo: 3, // Changed to team 3 (NOT on approved list)
      }),
      {},
      { reject: (m) => rejects.push(m) }
    );
    expect(violations).toEqual(rejects);
    expect(typeof violations[0]).toBe('string');
    expect(rejects).toContain('Player NTC — consent required');
  });

  it('handles Bird rights veto', () => {
    const rejects = [];
    const violations = enforceConsent(
      makeTeam({
        name: 'Bird',
        onOneYearBirdDeal: true,
        currentTeamId: 1,
        tradeTo: 2,
      }),
      {},
      { reject: (m) => rejects.push(m) }
    );
    expect(violations).toEqual(rejects);
    expect(typeof violations[0]).toBe('string');
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

  it('warn mode preserves the plain-string helper contract', () => {
    validationFlags.consent = 'warn';

    const warns = [];
    const rejects = [];
    const violations = enforceConsent(
      makeTeam({ name: 'Warn NTC', hasFullNTC: true, tradeTo: 2 }),
      {},
      {
        warn: (m) => warns.push(m),
        reject: (m) => rejects.push(m),
      }
    );

    expect(rejects).toEqual([]);
    expect(violations).toEqual(warns);
    expect(typeof warns[0]).toBe('string');
    expect(warns).toContain('Player NTC — consent required');
  });
});
