/**
 * FILE: staleValidationFix.test.js
 * PURPOSE: Tests for the stale validation state fix - ensuring "Validated" only appears
 *          when validation result matches current trade draft configuration.
 * OWNERSHIP: Trade Machine Team
 * HISTORY:
 *   - Jan 2026: Created for stale validation pill bug fix
 * LINKS: computeTradeDraftKey.js, useTradeMachine.js, MASTER_TRADE_MACHINE_ALIGNMENT.md
 */

import { describe, it, expect } from 'vitest';
import {
  computeTradeDraftKey,
  isValidationCurrent,
} from '@/features/architect/tradeMachine/utils/computeTradeDraftKey';

describe('computeTradeDraftKey', () => {
  const mockTeamsEmpty = [
    { team: { id: 'BOS' }, sends: [], picksOut: [] },
    { team: { id: 'LAL' }, sends: [], picksOut: [] },
  ];

  const mockTeamsWithPlayers = [
    {
      team: { id: 'BOS' },
      sends: [{ id: 'player-1' }, { id: 'player-2' }],
      picksOut: [],
    },
    { team: { id: 'LAL' }, sends: [{ id: 'player-3' }], picksOut: [] },
  ];

  const mockTeamsWithPicks = [
    {
      team: { id: 'BOS' },
      sends: [],
      picksOut: [],
      entitlementsOut: [
        { draftKey: '2025-1-BOS', year: 2025, round: 1, originalTeam: 'BOS' },
      ],
    },
    { team: { id: 'LAL' }, sends: [], picksOut: [], entitlementsOut: [] },
  ];

  describe('Basic key computation', () => {
    it('generates a key with yearKey and team IDs', () => {
      const key = computeTradeDraftKey({
        yearKey: 2025,
        teams: mockTeamsEmpty,
      });
      expect(key).toContain('2025');
      expect(key).toContain('BOS');
      expect(key).toContain('LAL');
    });

    it('generates different keys for different years', () => {
      const key2025 = computeTradeDraftKey({
        yearKey: 2025,
        teams: mockTeamsEmpty,
      });
      const key2026 = computeTradeDraftKey({
        yearKey: 2026,
        teams: mockTeamsEmpty,
      });
      expect(key2025).not.toBe(key2026);
    });

    it('generates different keys for different team sets', () => {
      const keyBosLal = computeTradeDraftKey({
        yearKey: 2025,
        teams: mockTeamsEmpty,
      });
      const keyBosMia = computeTradeDraftKey({
        yearKey: 2025,
        teams: [
          { team: { id: 'BOS' }, sends: [], picksOut: [] },
          { team: { id: 'MIA' }, sends: [], picksOut: [] },
        ],
      });
      expect(keyBosLal).not.toBe(keyBosMia);
    });
  });

  describe('Player changes invalidate key', () => {
    it('generates different keys when players are added', () => {
      const keyEmpty = computeTradeDraftKey({
        yearKey: 2025,
        teams: mockTeamsEmpty,
      });
      const keyWithPlayers = computeTradeDraftKey({
        yearKey: 2025,
        teams: mockTeamsWithPlayers,
      });
      expect(keyEmpty).not.toBe(keyWithPlayers);
    });

    it('generates different keys for different player selections', () => {
      const keyPlayers1 = computeTradeDraftKey({
        yearKey: 2025,
        teams: mockTeamsWithPlayers,
      });
      const keyPlayers2 = computeTradeDraftKey({
        yearKey: 2025,
        teams: [
          {
            team: { id: 'BOS' },
            sends: [{ id: 'player-1' }], // Only 1 player instead of 2
            picksOut: [],
          },
          { team: { id: 'LAL' }, sends: [{ id: 'player-3' }], picksOut: [] },
        ],
      });
      expect(keyPlayers1).not.toBe(keyPlayers2);
    });
  });

  describe('Pick changes invalidate key', () => {
    it('generates different keys when picks are added', () => {
      const keyEmpty = computeTradeDraftKey({
        yearKey: 2025,
        teams: mockTeamsEmpty,
      });
      const keyWithPicks = computeTradeDraftKey({
        yearKey: 2025,
        teams: mockTeamsWithPicks,
      });
      expect(keyEmpty).not.toBe(keyWithPicks);
    });

    it('generates different keys for different pick selections', () => {
      const keyPicks1 = computeTradeDraftKey({
        yearKey: 2025,
        teams: mockTeamsWithPicks,
      });
      const keyPicks2 = computeTradeDraftKey({
        yearKey: 2025,
        teams: [
          {
            team: { id: 'BOS' },
            sends: [],
            picksOut: [],
            entitlementsOut: [
              {
                draftKey: '2026-1-BOS',
                year: 2026,
                round: 1,
                originalTeam: 'BOS',
              },
            ],
          }, // 2026 instead of 2025
          { team: { id: 'LAL' }, sends: [], picksOut: [], entitlementsOut: [] },
        ],
      });
      expect(keyPicks1).not.toBe(keyPicks2);
    });
  });

  describe('Salary path changes invalidate key', () => {
    it('generates a different key when the elected path or an exact input changes', () => {
      const baseTeam = {
        team: { id: 'BOS' },
        sends: [{ id: 'player-1' }],
        entitlementsOut: [],
      };
      const standardKey = computeTradeDraftKey({
        yearKey: 2027,
        teams: [
          {
            ...baseTeam,
            salaryMatchingElection: {
              version: 1,
              path: 'STANDARD_TPE',
              postAssignmentApronTeamSalary: 200_000_000,
              tradedPlayerPreTradeSalaries: {
                'player-1': 10_000_000,
              },
            },
          },
        ],
      });
      const changedInputKey = computeTradeDraftKey({
        yearKey: 2027,
        teams: [
          {
            ...baseTeam,
            salaryMatchingElection: {
              version: 1,
              path: 'STANDARD_TPE',
              postAssignmentApronTeamSalary: 200_000_001,
              tradedPlayerPreTradeSalaries: {
                'player-1': 10_000_000,
              },
            },
          },
        ],
      });

      expect(changedInputKey).not.toBe(standardKey);
      expect(isValidationCurrent(changedInputKey, standardKey)).toBe(false);
    });
  });

  describe('Deterministic ordering', () => {
    it('generates same key regardless of player order in sends array', () => {
      const key1 = computeTradeDraftKey({
        yearKey: 2025,
        teams: [
          {
            team: { id: 'BOS' },
            sends: [{ id: 'player-1' }, { id: 'player-2' }],
            picksOut: [],
          },
        ],
      });
      const key2 = computeTradeDraftKey({
        yearKey: 2025,
        teams: [
          {
            team: { id: 'BOS' },
            sends: [{ id: 'player-2' }, { id: 'player-1' }],
            picksOut: [],
          },
        ],
      });
      expect(key1).toBe(key2);
    });

    it('generates same key regardless of team order in array', () => {
      const key1 = computeTradeDraftKey({
        yearKey: 2025,
        teams: [
          { team: { id: 'BOS' }, sends: [], picksOut: [] },
          { team: { id: 'LAL' }, sends: [], picksOut: [] },
        ],
      });
      const key2 = computeTradeDraftKey({
        yearKey: 2025,
        teams: [
          { team: { id: 'LAL' }, sends: [], picksOut: [] },
          { team: { id: 'BOS' }, sends: [], picksOut: [] },
        ],
      });
      expect(key1).toBe(key2);
    });
  });

  describe('Edge cases', () => {
    it('handles empty teams array', () => {
      const key = computeTradeDraftKey({ yearKey: 2025, teams: [] });
      expect(key).toBe('2025|');
    });

    it('handles teams with null team property', () => {
      const key = computeTradeDraftKey({
        yearKey: 2025,
        teams: [
          { team: null, sends: [], picksOut: [] },
          { team: { id: 'BOS' }, sends: [], picksOut: [] },
        ],
      });
      expect(key).toContain('BOS');
      expect(key).not.toContain('null');
    });

    it('handles missing sends/picksOut arrays', () => {
      const key = computeTradeDraftKey({
        yearKey: 2025,
        teams: [{ team: { id: 'BOS' } }], // no sends or picksOut
      });
      expect(key).toContain('BOS');
    });

    it('uses the current fallback identifiers exactly for missing team, player, and entitlement keys', () => {
      const key = computeTradeDraftKey({
        yearKey: 2025,
        teams: [
          {
            team: {},
            sends: [{ player_id: 'player-2' }, { id: 'player-1' }, {}],
            entitlementsOut: [
              { entitlementId: 'ent-3' },
              { id: 'ent-2' },
              { draftKey: 'ent-1' },
              {},
            ],
          },
        ],
      });

      expect(key).toBe(
        '2025|unknown:player-1,player-2,unknown:ent-1,ent-2,ent-3,unknown'
      );
    });

    it('uses the current empty-slot formatting exactly when sends and entitlements are absent', () => {
      const key = computeTradeDraftKey({
        yearKey: '2025-26',
        teams: [{ team: { id: 'BOS' } }],
      });

      expect(key).toBe('2025-26|BOS::');
    });
  });
});

describe('isValidationCurrent', () => {
  it('returns false when lastValidatedDraftKey is null', () => {
    expect(isValidationCurrent('some-key', null)).toBe(false);
  });

  it('returns false when currentDraftKey is empty', () => {
    expect(isValidationCurrent('', 'some-key')).toBe(false);
  });

  it('returns true when keys match', () => {
    const key = '2025|BOS::';
    expect(isValidationCurrent(key, key)).toBe(true);
  });

  it('returns false when keys differ', () => {
    expect(isValidationCurrent('2025|BOS::', '2025|LAL::')).toBe(false);
  });
});

describe('Stale Validation State Scenarios', () => {
  // These tests validate the expected behavior described in the bug fix

  it('STALE-01: Selecting 2nd team without validating produces different key than validated state', () => {
    // Simulates: User validates trade, then changes trade configuration
    const initialKey = computeTradeDraftKey({
      yearKey: 2025,
      teams: [
        { team: { id: 'BOS' }, sends: [{ id: 'player-1' }], picksOut: [] },
        { team: { id: 'LAL' }, sends: [{ id: 'player-2' }], picksOut: [] },
      ],
    });

    // User adds a player to the trade
    const changedKey = computeTradeDraftKey({
      yearKey: 2025,
      teams: [
        {
          team: { id: 'BOS' },
          sends: [{ id: 'player-1' }, { id: 'player-3' }],
          picksOut: [],
        },
        { team: { id: 'LAL' }, sends: [{ id: 'player-2' }], picksOut: [] },
      ],
    });

    // Keys should differ, so isValidationCurrent returns false
    expect(isValidationCurrent(changedKey, initialKey)).toBe(false);
  });

  it('STALE-02: Re-validating same configuration produces same key', () => {
    const config = {
      yearKey: 2025,
      teams: [
        { team: { id: 'BOS' }, sends: [{ id: 'player-1' }], picksOut: [] },
        { team: { id: 'LAL' }, sends: [{ id: 'player-2' }], picksOut: [] },
      ],
    };

    // Validate twice on same state
    const key1 = computeTradeDraftKey(config);
    const key2 = computeTradeDraftKey(config);

    expect(isValidationCurrent(key2, key1)).toBe(true);
  });

  it('STALE-03: Switching team invalidates previous validation', () => {
    const beforeSwitch = computeTradeDraftKey({
      yearKey: 2025,
      teams: [
        { team: { id: 'BOS' }, sends: [], picksOut: [] },
        { team: { id: 'LAL' }, sends: [], picksOut: [] },
      ],
    });

    // User switches LAL to MIA
    const afterSwitch = computeTradeDraftKey({
      yearKey: 2025,
      teams: [
        { team: { id: 'BOS' }, sends: [], picksOut: [] },
        { team: { id: 'MIA' }, sends: [], picksOut: [] },
      ],
    });

    expect(isValidationCurrent(afterSwitch, beforeSwitch)).toBe(false);
  });

  it('STALE-04: Removing a player invalidates previous validation', () => {
    const withPlayer = computeTradeDraftKey({
      yearKey: 2025,
      teams: [
        { team: { id: 'BOS' }, sends: [{ id: 'player-1' }], picksOut: [] },
        { team: { id: 'LAL' }, sends: [], picksOut: [] },
      ],
    });

    const withoutPlayer = computeTradeDraftKey({
      yearKey: 2025,
      teams: [
        { team: { id: 'BOS' }, sends: [], picksOut: [] },
        { team: { id: 'LAL' }, sends: [], picksOut: [] },
      ],
    });

    expect(isValidationCurrent(withoutPlayer, withPlayer)).toBe(false);
  });
});
