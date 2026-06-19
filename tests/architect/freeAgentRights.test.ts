/**
 * Free Agent Rights Resolver — canonical single-source tests.
 *
 * Uses real 2025-26 Lakers shapes:
 *  - LeBron James : Full Bird UFA for 2026 → first-class re-sign decision.
 *  - Carmelo / Dwight : stale "FA Cap Hold" zombies → dead, renounce-able.
 *  - Austin Reaves : UFA for 2027 → future hold, side section.
 *
 * @file tests/architect/freeAgentRights.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  resolveFreeAgentRights,
  deriveBirdType,
  isDeadCapHold,
} from '@/features/architect/utils/freeAgentRights';

const ACTIVE_SEASON_START = 2026; // planning the 2026-27 offseason

const lebron = {
  playerId: 'lebron_james',
  bio: { yearsExperience: 22 },
  contract: {
    birdRights: { status: 'Bird' },
    freeAgency: { type: 'UFA', year: 2026, capHold: 57915200 },
    salariesByYear: [{ season: '2025-26', salary: 48700000 }],
  },
};

const carmelo = {
  playerId: 'carmelo_anthony',
  bio: { yearsExperience: 19 },
  contract: {}, // no rights, no active free agency — long departed
};

const reaves = {
  playerId: 'austin_reaves',
  bio: { yearsExperience: 4 },
  contract: {
    birdRights: { status: 'Bird' },
    freeAgency: { type: 'UFA', year: 2027, capHold: 28307693 },
    salariesByYear: [{ season: '2025-26', salary: 13900000 }],
  },
};

describe('deriveBirdType', () => {
  it('maps SalarySwish "Bird" to Full Bird', () => {
    expect(deriveBirdType(lebron)).toBe('Full Bird');
  });
  it('recognizes Early Bird and Non-Bird', () => {
    expect(
      deriveBirdType({ contract: { birdRights: { status: 'Early Bird' } } })
    ).toBe('Early Bird');
    expect(
      deriveBirdType({ contract: { birdRights: { status: 'Non-Bird' } } })
    ).toBe('Non-Bird');
  });
  it('defaults missing/unknown rights to None', () => {
    expect(deriveBirdType(carmelo)).toBe('None');
    expect(deriveBirdType(null)).toBe('None');
  });
});

describe('resolveFreeAgentRights — own current-season free agent', () => {
  const result = resolveFreeAgentRights(lebron, {
    activeSeasonStartYear: ACTIVE_SEASON_START,
    holdType: 'UFA',
    isOnRoster: true,
  });

  it('places LeBron inline in the main cap table', () => {
    expect(result.placement).toBe('main');
    expect(result.isDeadHold).toBe(false);
  });
  it('routes him through the Bird-rights re-sign lane', () => {
    expect(result.lane).toBe('bird-rights');
    expect(result.canResignWithRights).toBe(true);
    expect(result.signingMechanism).toBe('Full Bird');
  });
  it('uses the player-record cap hold instead of a raw Bird multiplier', () => {
    expect(result.capHoldAmount).toBe(57_915_200);
    expect(result.capHoldReason).toBe('Full Bird (source)');
  });
});

describe('resolveFreeAgentRights — missing player record', () => {
  it('does not promote an unresolved hold into the main decision table', () => {
    const result = resolveFreeAgentRights(null, {
      activeSeasonStartYear: ACTIVE_SEASON_START,
      holdType: 'UFA',
      holdSeasonStartYear: ACTIVE_SEASON_START,
      isOnRoster: false,
    });

    expect(result.placement).toBe('side');
    expect(result.canResignWithRights).toBe(false);
  });
});

describe('resolveFreeAgentRights — stale zombie hold', () => {
  const result = resolveFreeAgentRights(carmelo, {
    activeSeasonStartYear: ACTIVE_SEASON_START,
    holdType: 'FA Cap Hold',
    holdSeasonStartYear: 2025,
    isOnRoster: false,
  });

  it('flags Carmelo as a dead, renounce-able hold', () => {
    expect(result.placement).toBe('dead');
    expect(result.isDeadHold).toBe(true);
    expect(
      isDeadCapHold(carmelo, {
        activeSeasonStartYear: ACTIVE_SEASON_START,
        holdType: 'FA Cap Hold',
        holdSeasonStartYear: 2025,
        isOnRoster: false,
      })
    ).toBe(true);
  });
  it('does not put dead holds in the main table', () => {
    expect(result.placement).not.toBe('main');
  });
});

describe('resolveFreeAgentRights — future-year hold', () => {
  it('keeps a 2027 UFA out of the active decision set', () => {
    const result = resolveFreeAgentRights(reaves, {
      activeSeasonStartYear: ACTIVE_SEASON_START,
      holdType: 'UFA',
      isOnRoster: true,
    });
    expect(result.placement).toBe('side');
  });
});

describe('resolveFreeAgentRights — renounced own free agent', () => {
  it('drops a renounced FA out of the main table and rights lane', () => {
    const result = resolveFreeAgentRights(lebron, {
      activeSeasonStartYear: ACTIVE_SEASON_START,
      holdType: 'UFA',
      isOnRoster: true,
      renounced: true,
    });
    expect(result.placement).toBe('side');
    expect(result.lane).toBe('rights-renounced');
    expect(result.canResignWithRights).toBe(false);
  });
});
