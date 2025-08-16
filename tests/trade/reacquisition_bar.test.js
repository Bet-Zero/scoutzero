import { describe, it, expect, afterEach } from 'vitest';
import { enforceEligibility } from '@/utils/architect/tradeMachine/validators/index.js';
import { validationFlags } from '@/config/validationFlags.js';

describe('re-acquisition bar', () => {
  afterEach(() => {
    validationFlags.reAcquisition = 'error';
  });

  it('rejects trade-back within one year', () => {
    const player = {
      name: 'Traded',
      lastTradedFromTeamId: 1,
      lastTradeDate: new Date().toISOString(),
      eligibleReacqDate: new Date(
        Date.now() + 365 * 24 * 3600 * 1000
      ).toISOString(),
    };
    const rejects = [];
    enforceEligibility(
      { teamId: 1, teamName: 'Team', incomingPlayers: [player] },
      { asOfDate: new Date(Date.now() + 100 * 24 * 3600 * 1000).toISOString() },
      { reject: (m) => rejects.push(m) }
    );
    expect(rejects[0]).toMatch(/Re-acquisition bar/);
  });

  it('rejects reacquiring waived player before July 1 after contract end', () => {
    const player = {
      name: 'Waived',
      wasWaivedByTeamId: 1,
      contractEndDate: new Date().toISOString(),
      eligibleReacqDate: new Date(
        Date.now() + 365 * 24 * 3600 * 1000
      ).toISOString(),
    };
    const rejects = [];
    enforceEligibility(
      { teamId: 1, teamName: 'Team', incomingPlayers: [player] },
      { asOfDate: new Date().toISOString() },
      { reject: (m) => rejects.push(m) }
    );
    expect(rejects[0]).toMatch(/Re-acquisition bar/);
  });
});
