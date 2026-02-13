/**
 * FILE: tests/entitlements/worldTradeTransfer.test.js
 * PURPOSE: Tests for TM-PICKS-E1 — World mode entitlement trade transfer (computeTradeResult)
 * OWNERSHIP: Feature: architect/tradeMachine
 */

import { describe, it, expect } from 'vitest';
import { buildPostTradeTeamsSnapshot } from '@/features/architect/utils/tradeContext/tradeContext';

// ── Test fixtures ──

const makeTeam = (id, entitlementIds = []) => ({
  id,
  teamCode: id,
  teamName: `Team ${id}`,
  roster: [],
  players: [],
  draftPicks: [],
  entitlementIds,
  tradeExceptions: [],
  exceptions: { tpe: [] },
  activeContracts: [],
});

const makePayloadTeam = (teamCode, sends = [], entitlementsOut = []) => ({
  teamCode,
  team: { id: teamCode },
  sends,
  picksOut: [],
  outgoingEntitlements: entitlementsOut,
  entitlementsOut,
});

describe('buildPostTradeTeamsSnapshot — entitlement transfer', () => {
  it('moves entitlement IDs between teams in 2-team trade', () => {
    const payload = {
      teams: [
        makePayloadTeam(
          'LAL',
          [],
          [
            {
              entitlementId: 'ent_lal_2027',
              toTeamId: 'BOS',
              fromTeamId: 'LAL',
            },
          ]
        ),
        makePayloadTeam(
          'BOS',
          [],
          [
            {
              entitlementId: 'ent_bos_2028',
              toTeamId: 'LAL',
              fromTeamId: 'BOS',
            },
          ]
        ),
      ],
    };

    const currentState = {
      teams: [
        {
          teamCode: 'LAL',
          team: makeTeam('LAL', ['ent_lal_2027', 'ent_lal_2029']),
        },
        { teamCode: 'BOS', team: makeTeam('BOS', ['ent_bos_2028']) },
      ],
    };

    const result = buildPostTradeTeamsSnapshot({
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    const lalUpdate = result.teamUpdates.find((u) => u.teamCode === 'LAL');
    const bosUpdate = result.teamUpdates.find((u) => u.teamCode === 'BOS');

    // LAL should have lost ent_lal_2027 and gained ent_bos_2028
    expect(lalUpdate.team.entitlementIds).toContain('ent_lal_2029');
    expect(lalUpdate.team.entitlementIds).toContain('ent_bos_2028');
    expect(lalUpdate.team.entitlementIds).not.toContain('ent_lal_2027');

    // BOS should have lost ent_bos_2028 and gained ent_lal_2027
    expect(bosUpdate.team.entitlementIds).toContain('ent_lal_2027');
    expect(bosUpdate.team.entitlementIds).not.toContain('ent_bos_2028');
  });

  it('handles 3-team trade with explicit routing', () => {
    const payload = {
      teams: [
        makePayloadTeam(
          'LAL',
          [],
          [{ entitlementId: 'ent_lal_1', toTeamId: 'BOS', fromTeamId: 'LAL' }]
        ),
        makePayloadTeam(
          'BOS',
          [],
          [{ entitlementId: 'ent_bos_1', toTeamId: 'MIA', fromTeamId: 'BOS' }]
        ),
        makePayloadTeam(
          'MIA',
          [],
          [{ entitlementId: 'ent_mia_1', toTeamId: 'LAL', fromTeamId: 'MIA' }]
        ),
      ],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', ['ent_lal_1']) },
        { teamCode: 'BOS', team: makeTeam('BOS', ['ent_bos_1']) },
        { teamCode: 'MIA', team: makeTeam('MIA', ['ent_mia_1']) },
      ],
    };

    const result = buildPostTradeTeamsSnapshot({
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    const lal = result.teamUpdates.find((u) => u.teamCode === 'LAL');
    const bos = result.teamUpdates.find((u) => u.teamCode === 'BOS');
    const mia = result.teamUpdates.find((u) => u.teamCode === 'MIA');

    expect(lal.team.entitlementIds).toContain('ent_mia_1');
    expect(lal.team.entitlementIds).not.toContain('ent_lal_1');

    expect(bos.team.entitlementIds).toContain('ent_lal_1');
    expect(bos.team.entitlementIds).not.toContain('ent_bos_1');

    expect(mia.team.entitlementIds).toContain('ent_bos_1');
    expect(mia.team.entitlementIds).not.toContain('ent_mia_1');
  });

  it('throws invariant violation if entitlement appears on multiple teams', () => {
    // Both teams have the same entitlement in their starting state (data corruption)
    // and neither sends it out — so both keep it, triggering the invariant check
    const payload = {
      teams: [makePayloadTeam('LAL', [], []), makePayloadTeam('BOS', [], [])],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', ['ent_shared']) },
        { teamCode: 'BOS', team: makeTeam('BOS', ['ent_shared']) },
      ],
    };

    expect(() =>
      buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      })
    ).toThrow(/INVARIANT VIOLATION/);
  });

  it('preserves entitlements not involved in the trade', () => {
    const payload = {
      teams: [
        makePayloadTeam(
          'LAL',
          [],
          [{ entitlementId: 'ent_traded', toTeamId: 'BOS', fromTeamId: 'LAL' }]
        ),
        makePayloadTeam('BOS', [], []),
      ],
    };

    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', ['ent_traded', 'ent_kept']) },
        { teamCode: 'BOS', team: makeTeam('BOS', ['ent_bos_kept']) },
      ],
    };

    const result = buildPostTradeTeamsSnapshot({
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    const lal = result.teamUpdates.find((u) => u.teamCode === 'LAL');
    const bos = result.teamUpdates.find((u) => u.teamCode === 'BOS');

    expect(lal.team.entitlementIds).toContain('ent_kept');
    expect(bos.team.entitlementIds).toContain('ent_bos_kept');
    expect(bos.team.entitlementIds).toContain('ent_traded');
  });
});
