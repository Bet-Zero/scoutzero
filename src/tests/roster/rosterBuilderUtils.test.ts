/**
 * FILE: src/tests/roster/rosterBuilderUtils.test.ts
 * PURPOSE: Guard roster builder normalization utilities (roster shape, team code, FA type).
 * OWNERSHIP: Feature: roster (Roster Builder)
 *
 * HISTORY:
 *  - 2026-02-05: Created for roster builder v1 closure.
 *  - 2026-02-05: Added tests for playerHasOptionType and isPlayerTwoWay (RB_E3).
 *
 * LINKS:
 *  - Plan: N/A (Roster Builder v1 closure execution)
 *  - Latest Chunk: N/A
 */

import { describe, expect, it } from 'vitest';
import { isTwoWayContract, normalizeRosterShape } from '@/features/roster/utils';
import {
  normalizeFreeAgentType,
  normalizeTeamCode,
  getPlayerFreeAgentType,
  playerHasOptionType,
  isPlayerTwoWay,
} from '@/shared/utils/filtering';

describe('Roster Builder Utils', () => {
  it('normalizeRosterShape pads and truncates to 5/4/6', () => {
    const result = normalizeRosterShape({
      starters: ['a', 'b'],
      rotation: ['r1', 'r2', 'r3', 'r4', 'r5'],
      bench: [],
    });

    expect(result.starters).toEqual(['a', 'b', null, null, null]);
    expect(result.rotation).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(result.bench).toEqual([null, null, null, null, null, null]);
  });

  it('isTwoWayContract detects roster utility two-way contract fields', () => {
    expect(
      isTwoWayContract({
        contract: {
          contractType: 'Two-Way',
        },
      })
    ).toBe(true);
    expect(
      isTwoWayContract({
        primaryContract: {
          signedUsing: 'Standard Contract',
        },
      })
    ).toBe(false);
  });

  it('normalizeTeamCode accepts code, slug, and full name', () => {
    expect(normalizeTeamCode('LAL')).toBe('LAL');
    expect(normalizeTeamCode('lakers')).toBe('LAL');
    expect(normalizeTeamCode('Los Angeles Lakers')).toBe('LAL');
  });

  it('normalizeFreeAgentType canonicalizes FA types from schema', () => {
    // Schema canonical values (uppercase in data) -> lowercase for filter
    expect(normalizeFreeAgentType('UFA')).toBe('ufa');
    expect(normalizeFreeAgentType('RFA')).toBe('rfa');
    expect(normalizeFreeAgentType('SFA')).toBe('sfa');
    expect(normalizeFreeAgentType('TWO_WAY')).toBe('two_way');
    expect(normalizeFreeAgentType('NONE')).toBe('none');

    // Variant forms
    expect(normalizeFreeAgentType('Unrestricted')).toBe('ufa');
    expect(normalizeFreeAgentType('Unrestricted FA')).toBe('ufa');
    expect(normalizeFreeAgentType('Restricted')).toBe('rfa');
    expect(normalizeFreeAgentType('Restricted FA')).toBe('rfa');
    expect(normalizeFreeAgentType('Two-Way')).toBe('two_way');
    expect(normalizeFreeAgentType('Two Way')).toBe('two_way');
    expect(normalizeFreeAgentType('2W')).toBe('two_way');
    expect(normalizeFreeAgentType('2-way')).toBe('two_way');

    // Option types (not FA types, but used in filter)
    expect(normalizeFreeAgentType('Team Option')).toBe('to');
    expect(normalizeFreeAgentType('Player Option')).toBe('po');
    expect(normalizeFreeAgentType('Early Termination Option')).toBe('eto');
    expect(normalizeFreeAgentType('ETO')).toBe('eto');

    // Empty/null cases
    expect(normalizeFreeAgentType('')).toBe('');
    expect(normalizeFreeAgentType(null)).toBe('');
    expect(normalizeFreeAgentType(undefined)).toBe('');
    expect(normalizeFreeAgentType('any')).toBe('');
    expect(normalizeFreeAgentType('Any Type')).toBe('');
  });

  it('getPlayerFreeAgentType extracts from currentContractView', () => {
    const player = {
      currentContractView: {
        freeAgentType: 'UFA',
      },
    };
    expect(getPlayerFreeAgentType(player)).toBe('ufa');
  });

  it('getPlayerFreeAgentType extracts from bio.display (legacy)', () => {
    const player = {
      bio: {
        display: {
          freeAgentType: 'RFA',
        },
      },
    };
    expect(getPlayerFreeAgentType(player)).toBe('rfa');
  });

  it('getPlayerFreeAgentType extracts from primaryContract.freeAgency', () => {
    const player = {
      primaryContract: {
        freeAgency: {
          freeAgentType: 'TWO_WAY',
        },
      },
    };
    expect(getPlayerFreeAgentType(player)).toBe('two_way');
  });

  it('getPlayerFreeAgentType returns null for players without FA type', () => {
    const player = {
      bio: {
        displayName: 'Test Player',
      },
    };
    expect(getPlayerFreeAgentType(player)).toBe(null);
  });

  it('getPlayerFreeAgentType prioritizes currentContractView over other sources', () => {
    const player = {
      currentContractView: {
        freeAgentType: 'UFA',
      },
      bio: {
        display: {
          freeAgentType: 'RFA',
        },
      },
      primaryContract: {
        freeAgency: {
          freeAgentType: 'SFA',
        },
      },
    };
    expect(getPlayerFreeAgentType(player)).toBe('ufa');
  });

  // ===== playerHasOptionType Tests =====
  describe('playerHasOptionType', () => {
    it('detects Team Option from optionByYear map', () => {
      const player = {
        optionByYear: {
          2026: 'TO',
          2027: null,
        },
      };
      expect(playerHasOptionType(player, 'to')).toBe(true);
      expect(playerHasOptionType(player, 'po')).toBe(false);
      expect(playerHasOptionType(player, 'eto')).toBe(false);
    });

    it('detects Player Option from optionByYear map', () => {
      const player = {
        optionByYear: {
          2025: 'PO',
        },
      };
      expect(playerHasOptionType(player, 'po')).toBe(true);
      expect(playerHasOptionType(player, 'to')).toBe(false);
    });

    it('detects ETO from optionByYear map', () => {
      const player = {
        optionByYear: {
          2026: 'ETO',
        },
      };
      expect(playerHasOptionType(player, 'eto')).toBe(true);
      expect(playerHasOptionType(player, 'to')).toBe(false);
    });

    it('detects option from options array (AddPlayerDrawer format)', () => {
      const player = {
        options: [
          { year: 2026, type: 'TO' },
          { year: 2027, type: 'PO' },
        ],
      };
      expect(playerHasOptionType(player, 'to')).toBe(true);
      expect(playerHasOptionType(player, 'po')).toBe(true);
      expect(playerHasOptionType(player, 'eto')).toBe(false);
    });

    it('handles nested original format', () => {
      const player = {
        original: {
          optionByYear: { 2026: 'TO' },
        },
      };
      expect(playerHasOptionType(player, 'to')).toBe(true);
    });

    it('returns false for players without options', () => {
      const player = { bio: { displayName: 'Test Player' } };
      expect(playerHasOptionType(player, 'to')).toBe(false);
      expect(playerHasOptionType(player, 'po')).toBe(false);
      expect(playerHasOptionType(player, 'eto')).toBe(false);
    });

    it('returns false for null/undefined player', () => {
      expect(playerHasOptionType(null, 'to')).toBe(false);
      expect(playerHasOptionType(undefined, 'po')).toBe(false);
    });
  });

  // ===== isPlayerTwoWay Tests =====
  describe('isPlayerTwoWay', () => {
    it('detects two-way from contract.contractType', () => {
      const player = {
        contract: {
          contractType: 'Two-Way',
        },
      };
      expect(isPlayerTwoWay(player)).toBe(true);
    });

    it('detects two-way from primaryContract.contractType', () => {
      const player = {
        primaryContract: {
          contractType: 'two-way',
        },
      };
      expect(isPlayerTwoWay(player)).toBe(true);
    });

    it('detects two-way from contract.signedUsing', () => {
      const player = {
        contract: {
          signedUsing: 'Two-Way Contract',
        },
      };
      expect(isPlayerTwoWay(player)).toBe(true);
    });

    it('handles nested original format', () => {
      const player = {
        original: {
          contract: {
            contractType: 'TWO-WAY',
          },
        },
      };
      expect(isPlayerTwoWay(player)).toBe(true);
    });

    it('returns false for standard contracts', () => {
      const player = {
        contract: {
          contractType: 'Standard',
        },
      };
      expect(isPlayerTwoWay(player)).toBe(false);
    });

    it('returns false for players without contract', () => {
      const player = { bio: { displayName: 'Test Player' } };
      expect(isPlayerTwoWay(player)).toBe(false);
    });

    it('returns false for null/undefined player', () => {
      expect(isPlayerTwoWay(null)).toBe(false);
      expect(isPlayerTwoWay(undefined)).toBe(false);
    });
  });
});
