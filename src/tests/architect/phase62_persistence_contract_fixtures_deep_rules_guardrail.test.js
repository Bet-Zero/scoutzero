/**
 * FILE: src/tests/architect/phase62_persistence_contract_fixtures_deep_rules_guardrail.test.js
 * PURPOSE: Phase 62 guardrail tests for deep rules expansion + fixture-based drift detection.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-30: Phase 62 - Created for deep rules and fixture-based persistence contract tests
 *
 * LINKS:
 *  - Contracts: src/features/architect/utils/persistenceContracts/
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *
 * TEST CATEGORIES:
 * A) Deep rules validation: deadCap[], capHolds[], amountByYear[]
 * B) Fixture-based validation: captured shapes validate against contracts
 * C) Keyset snapshot drift guardrails: deterministic key detection
 * D) Actionable error tests: path-level error messages for nested violations
 */

import { describe, it, expect } from 'vitest';

import {
  findDisallowedKeyPaths,
  validatePersistableShape,
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
  TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
  PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST,
  EVENT_TOP_LEVEL_ALLOWLIST,
  EVENT_METADATA_TOP_LEVEL_ALLOWLIST,
  TRADE_EXCEPTION_ITEM_ALLOWLIST,
  EXCEPTION_HISTORY_ITEM_ALLOWLIST,
  DEAD_CAP_ITEM_ALLOWLIST,
  DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST,
  CAP_HOLD_ITEM_ALLOWLIST,
  TEAM_DEEP_RULES,
} from '@/features/architect/utils/persistenceContracts';

// ==============================================================================
// HELPER: Build representative fixture objects
// ==============================================================================

/**
 * Create a representative TEAM overlay fixture with all nested arrays populated.
 * This represents a realistic persisted team document.
 */
function createTeamFixture() {
  return {
    teamCode: 'BOS',
    teamName: 'Boston Celtics',
    abbreviation: 'BOS',
    city: 'Boston',
    conference: 'Eastern',
    division: 'Atlantic',
    season: '2025-26',
    roster: ['player_001', 'player_002'],
    deadCap: [
      {
        playerId: 'player_waived_001',
        playerName: 'Waived Player',
        originalSalary: 10000000,
        amountByYear: [
          { season: '2025-26', amount: 3333333, isStretched: true },
          { season: '2026-27', amount: 3333333, isStretched: true },
          { season: '2027-28', amount: 3333334, isStretched: true },
        ],
        waiveDate: '2025-10-15',
        notes: 'Stretched via waive-and-stretch',
      },
    ],
    capHolds: [
      {
        playerId: 'player_rfa_001',
        playerName: 'RFA Player',
        amount: 5000000,
        type: 'bird',
        season: '2025-26',
        isSigned: false,
        expiresOn: '2025-07-01',
        notes: 'Qualifying offer extended',
      },
    ],
    exceptions: {
      mle: { available: true, totalAmount: 12000000 },
      tpe: [
        {
          id: 'tpe_001',
          totalAmount: 8000000,
          usedAmount: 0,
          remainingAmount: 8000000,
          createdFrom: 'Trade with LAL',
          createdOn: '2025-11-01',
          createdSeason: '2025-26',
          expiresOn: '2026-11-01',
          isUsed: false,
        },
      ],
    },
    exceptionHistory: [
      {
        historyKey: 'trade:world_001:BOS:tpe_001:created:sig123',
        type: 'TPE_CREATED',
        teamCode: 'BOS',
        tpeId: 'tpe_001',
        timestamp: '2025-11-01T00:00:00.000Z',
        seasonId: '2025-26',
        seasonYear: 2026,
        amountCreated: 8000000,
        createdFrom: 'Trade with LAL',
        createdSeason: '2025-26',
        expiresOn: '2026-11-01',
      },
    ],
    draftPicksInventory: [],
    draftPicksObligations: [],
    draftPicksContested: [],
    entitlementIds: [],
    totals: { salaryTotal: 150000000 },
    source: { provider: 'test', lastSync: '2025-11-01' },
    lastUpdated: '2025-11-01T00:00:00.000Z',
    version: 1,
    _meta: { computedAt: Date.now() },
  };
}

/**
 * Create a representative PLAYER override fixture.
 */
function createPlayerFixture() {
  return {
    playerId: 'player_001',
    displayName: 'Test Player',
    teamCode: 'BOS',
    teamName: 'Boston Celtics',
    bio: { position: 'PG', age: 25 },
    contract: {
      currentSalary: 10000000,
      years: 3,
      startSeason: '2025-26',
    },
    source: { provider: 'test' },
    lastUpdated: '2025-11-01T00:00:00.000Z',
    version: 1,
  };
}

/**
 * Create a representative EVENT fixture.
 */
function createEventFixture() {
  return {
    eventId: 'executeTrade_1700000000000_abc123',
    type: 'executeTrade',
    timestamp: '2025-11-01T00:00:00.000Z',
    seasonId: '2025-26',
    metadata: {
      type: 'executeTrade',
      timestamp: '2025-11-01T00:00:00.000Z',
      teamsInvolved: ['BOS', 'LAL'],
      playersTraded: [{ playerId: 'player_002', name: 'Traded Player' }],
    },
    teamsAffected: ['BOS', 'LAL'],
  };
}

// ==============================================================================
// CATEGORY A: Deep rules validation for deadCap[], capHolds[], amountByYear[]
// ==============================================================================

describe('Phase 62: Deep rules for deadCap[] items', () => {
  it('TEST 1: validates conforming deadCap[] items with no violations', () => {
    const team = {
      teamCode: 'BOS',
      deadCap: [
        {
          playerId: 'player_001',
          playerName: 'Waived Player',
          originalSalary: 10000000,
          amountByYear: [{ season: '2025-26', amount: 5000000 }],
          waiveDate: '2025-10-01',
        },
      ],
    };
    const violations = findDisallowedKeyPaths({
      obj: team,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
      deepRules: TEAM_DEEP_RULES,
    });
    expect(violations).toEqual([]);
  });

  it('TEST 2: detects unknown field in deadCap[] item', () => {
    const team = {
      teamCode: 'BOS',
      deadCap: [
        {
          playerId: 'player_001',
          playerName: 'Waived Player',
          originalSalary: 10000000,
          debugInternalFlag: true, // DISALLOWED
        },
      ],
    };
    const violations = findDisallowedKeyPaths({
      obj: team,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
      deepRules: TEAM_DEEP_RULES,
    });
    expect(violations).toContain('team.deadCap[0].debugInternalFlag');
    expect(violations.length).toBe(1);
  });

  it('TEST 3: validates conforming deadCap[].amountByYear[] items (3-level nesting)', () => {
    const team = {
      teamCode: 'BOS',
      deadCap: [
        {
          playerId: 'player_001',
          playerName: 'Stretched Player',
          originalSalary: 9000000,
          amountByYear: [
            { season: '2025-26', amount: 3000000, isStretched: true },
            { season: '2026-27', amount: 3000000, isStretched: true },
            { season: '2027-28', amount: 3000000, isStretched: true },
          ],
        },
      ],
    };
    const violations = findDisallowedKeyPaths({
      obj: team,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
      deepRules: TEAM_DEEP_RULES,
    });
    expect(violations).toEqual([]);
  });

  it('TEST 4: detects unknown field in deadCap[].amountByYear[] item (3-level nesting)', () => {
    const team = {
      teamCode: 'BOS',
      deadCap: [
        {
          playerId: 'player_001',
          playerName: 'Stretched Player',
          originalSalary: 9000000,
          amountByYear: [
            { season: '2025-26', amount: 3000000, isStretched: true },
            {
              season: '2026-27',
              amount: 3000000,
              debugComputedFlag: true, // DISALLOWED in nested array
            },
          ],
        },
      ],
    };
    const violations = findDisallowedKeyPaths({
      obj: team,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
      deepRules: TEAM_DEEP_RULES,
    });
    expect(violations).toContain(
      'team.deadCap[0].amountByYear[1].debugComputedFlag'
    );
    expect(violations.length).toBe(1);
  });
});

describe('Phase 62: Deep rules for capHolds[] items', () => {
  it('TEST 5: validates conforming capHolds[] items with no violations', () => {
    const team = {
      teamCode: 'BOS',
      capHolds: [
        {
          playerId: 'player_rfa_001',
          playerName: 'RFA Player',
          amount: 5000000,
          type: 'bird',
          season: '2025-26',
          isSigned: false,
          expiresOn: '2025-07-01',
          notes: 'QO extended',
        },
      ],
    };
    const violations = findDisallowedKeyPaths({
      obj: team,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
      deepRules: TEAM_DEEP_RULES,
    });
    expect(violations).toEqual([]);
  });

  it('TEST 6: detects unknown field in capHolds[] item', () => {
    const team = {
      teamCode: 'BOS',
      capHolds: [
        {
          playerId: 'player_rfa_001',
          playerName: 'RFA Player',
          amount: 5000000,
          type: 'bird',
          _computedFromProvider: true, // DISALLOWED
        },
      ],
    };
    const violations = findDisallowedKeyPaths({
      obj: team,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
      deepRules: TEAM_DEEP_RULES,
    });
    expect(violations).toContain('team.capHolds[0]._computedFromProvider');
    expect(violations.length).toBe(1);
  });

  it('TEST 7: detects multiple violations across capHolds[] items', () => {
    const team = {
      teamCode: 'BOS',
      capHolds: [
        {
          playerId: 'p1',
          playerName: 'Player 1',
          amount: 1000000,
          type: 'bird',
          debugA: 1,
        },
        {
          playerId: 'p2',
          playerName: 'Player 2',
          amount: 2000000,
          type: 'early',
          debugB: 2,
        },
      ],
    };
    const violations = findDisallowedKeyPaths({
      obj: team,
      allowlist: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
      pathPrefix: 'team',
      deepRules: TEAM_DEEP_RULES,
    });
    expect(violations).toContain('team.capHolds[0].debugA');
    expect(violations).toContain('team.capHolds[1].debugB');
    expect(violations.length).toBe(2);
  });
});

// ==============================================================================
// CATEGORY B: Fixture-based validation - captured shapes validate against contracts
// ==============================================================================

describe('Phase 62: Fixture-based contract validation', () => {
  it('TEST 8: TEAM fixture validates against TEAM contract (full shape)', () => {
    const team = createTeamFixture();
    const result = validatePersistableShape({
      obj: team,
      allowlist: PERSISTENCE_CONTRACTS.TEAM.topLevel,
      label: 'TEAM',
      deepRules: PERSISTENCE_CONTRACTS.TEAM.deepRules,
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('TEST 9: PLAYER fixture validates against PLAYER contract', () => {
    const player = createPlayerFixture();
    const result = validatePersistableShape({
      obj: player,
      allowlist: PERSISTENCE_CONTRACTS.PLAYER.topLevel,
      label: 'PLAYER',
      deepRules: PERSISTENCE_CONTRACTS.PLAYER.deepRules,
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('TEST 10: EVENT fixture validates against EVENT contract', () => {
    const event = createEventFixture();
    const result = validatePersistableShape({
      obj: event,
      allowlist: PERSISTENCE_CONTRACTS.EVENT.topLevel,
      label: 'EVENT',
      deepRules: PERSISTENCE_CONTRACTS.EVENT.deepRules,
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('TEST 11: EVENT.metadata validates against EVENT_METADATA contract', () => {
    const event = createEventFixture();
    const result = validatePersistableShape({
      obj: event.metadata,
      allowlist: PERSISTENCE_CONTRACTS.EVENT_METADATA.topLevel,
      label: 'EVENT_METADATA',
      deepRules: PERSISTENCE_CONTRACTS.EVENT_METADATA.deepRules,
    });
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('TEST 12: assertPersistableOrThrow does NOT throw for valid TEAM fixture', () => {
    const team = createTeamFixture();
    expect(() =>
      assertPersistableOrThrow({
        obj: team,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      })
    ).not.toThrow();
  });
});

// ==============================================================================
// CATEGORY C: Keyset snapshot drift guardrails
// ==============================================================================

/**
 * Helper to extract sorted top-level keys from an object.
 */
function extractSortedKeys(obj) {
  return Object.keys(obj).sort();
}

/**
 * Helper to extract sorted item keys from the first item of an array (if present).
 * Returns union of all item keys if multiple items exist.
 */
function extractArrayItemKeys(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const keySet = new Set();
  arr.forEach((item) => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach((k) => keySet.add(k));
    }
  });
  return [...keySet].sort();
}

describe('Phase 62: Keyset snapshot drift guardrails', () => {
  // Expected keysets - any change to these triggers drift detection
  const EXPECTED_TEAM_TOP_LEVEL_KEYS = [
    '_meta',
    'abbreviation',
    'capHolds',
    'city',
    'conference',
    'deadCap',
    'division',
    'draftPicksContested',
    'draftPicksInventory',
    'draftPicksObligations',
    'entitlementIds',
    'exceptionHistory',
    'exceptions',
    'lastUpdated',
    'roster',
    'season',
    'source',
    'teamCode',
    'teamName',
    'totals',
    'version',
  ];

  const EXPECTED_DEAD_CAP_ITEM_KEYS = [
    'amountByYear',
    'notes',
    'originalSalary',
    'playerId',
    'playerName',
    'waiveDate',
  ];

  const EXPECTED_AMOUNT_BY_YEAR_ITEM_KEYS = ['amount', 'isStretched', 'season'];

  const EXPECTED_CAP_HOLD_ITEM_KEYS = [
    'amount',
    'expiresOn',
    'isSigned',
    'notes',
    'playerId',
    'playerName',
    'season',
    'type',
  ];

  const EXPECTED_PLAYER_TOP_LEVEL_KEYS = [
    'bio',
    'contract',
    'displayName',
    'lastUpdated',
    'playerId',
    'source',
    'teamCode',
    'teamName',
    'version',
  ];

  const EXPECTED_EVENT_TOP_LEVEL_KEYS = [
    'eventId',
    'metadata',
    'seasonId',
    'teamsAffected',
    'timestamp',
    'type',
  ];

  it('TEST 13: TEAM fixture top-level keyset is stable', () => {
    const team = createTeamFixture();
    const actualKeys = extractSortedKeys(team);
    expect(actualKeys).toEqual(EXPECTED_TEAM_TOP_LEVEL_KEYS);
  });

  it('TEST 14: deadCap[] item keyset is stable', () => {
    const team = createTeamFixture();
    const actualKeys = extractArrayItemKeys(team.deadCap);
    expect(actualKeys).toEqual(EXPECTED_DEAD_CAP_ITEM_KEYS);
  });

  it('TEST 15: deadCap[].amountByYear[] item keyset is stable', () => {
    const team = createTeamFixture();
    const actualKeys = extractArrayItemKeys(team.deadCap[0].amountByYear);
    expect(actualKeys).toEqual(EXPECTED_AMOUNT_BY_YEAR_ITEM_KEYS);
  });

  it('TEST 16: capHolds[] item keyset is stable', () => {
    const team = createTeamFixture();
    const actualKeys = extractArrayItemKeys(team.capHolds);
    expect(actualKeys).toEqual(EXPECTED_CAP_HOLD_ITEM_KEYS);
  });

  it('TEST 17: PLAYER fixture top-level keyset is stable', () => {
    const player = createPlayerFixture();
    const actualKeys = extractSortedKeys(player);
    expect(actualKeys).toEqual(EXPECTED_PLAYER_TOP_LEVEL_KEYS);
  });

  it('TEST 18: EVENT fixture top-level keyset is stable', () => {
    const event = createEventFixture();
    const actualKeys = extractSortedKeys(event);
    expect(actualKeys).toEqual(EXPECTED_EVENT_TOP_LEVEL_KEYS);
  });

  it('TEST 19: snapshot output is deterministic (repeated calls match)', () => {
    const team1 = createTeamFixture();
    const team2 = createTeamFixture();
    expect(extractSortedKeys(team1)).toEqual(extractSortedKeys(team2));
    expect(extractArrayItemKeys(team1.deadCap)).toEqual(
      extractArrayItemKeys(team2.deadCap)
    );
  });
});

// ==============================================================================
// CATEGORY D: Actionable error tests - path-level error messages
// ==============================================================================

describe('Phase 62: Actionable error messages for nested violations', () => {
  it('TEST 20: error for deadCap[0].debugFoo includes label, path, and allowlist hint', () => {
    const badTeam = {
      teamCode: 'BOS',
      deadCap: [
        {
          playerId: 'p1',
          playerName: 'Player',
          originalSalary: 1000000,
          debugFoo: true, // DISALLOWED
        },
      ],
    };

    try {
      assertPersistableOrThrow({
        obj: badTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).toContain('TEAM');
      expect(error.message).toContain('team.deadCap[0].debugFoo');
      expect(error.message).toContain('persistenceContracts/contracts.js');
    }
  });

  it('TEST 21: error for capHolds[0].debugFoo includes label, path, and allowlist hint', () => {
    const badTeam = {
      teamCode: 'BOS',
      capHolds: [
        {
          playerId: 'p1',
          playerName: 'Player',
          amount: 1000000,
          type: 'bird',
          debugFoo: true, // DISALLOWED
        },
      ],
    };

    try {
      assertPersistableOrThrow({
        obj: badTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).toContain('TEAM');
      expect(error.message).toContain('team.capHolds[0].debugFoo');
      expect(error.message).toContain('persistenceContracts/contracts.js');
    }
  });

  it('TEST 22: error for deadCap[0].amountByYear[0].debugFoo includes 3-level path', () => {
    const badTeam = {
      teamCode: 'BOS',
      deadCap: [
        {
          playerId: 'p1',
          playerName: 'Player',
          originalSalary: 1000000,
          amountByYear: [
            { season: '2025-26', amount: 500000, debugFoo: true }, // DISALLOWED
          ],
        },
      ],
    };

    try {
      assertPersistableOrThrow({
        obj: badTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).toContain('TEAM');
      expect(error.message).toContain(
        'team.deadCap[0].amountByYear[0].debugFoo'
      );
      expect(error.message).toContain('persistenceContracts/contracts.js');
    }
  });

  it('TEST 23: error for exceptions.tpe[0].debugFoo includes nested path (existing Phase 61)', () => {
    const badTeam = {
      teamCode: 'BOS',
      exceptions: {
        tpe: [
          {
            id: 'tpe_001',
            totalAmount: 5000000,
            debugFoo: true, // DISALLOWED
          },
        ],
      },
    };

    try {
      assertPersistableOrThrow({
        obj: badTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).toContain('TEAM');
      expect(error.message).toContain('team.exceptions.tpe[0].debugFoo');
      expect(error.message).toContain('persistenceContracts/contracts.js');
    }
  });

  it('TEST 24: error for exceptionHistory[0].debugFoo includes path (existing Phase 61)', () => {
    const badTeam = {
      teamCode: 'BOS',
      exceptionHistory: [
        {
          historyKey: 'key_001',
          type: 'TPE_CREATED',
          teamCode: 'BOS',
          debugFoo: true, // DISALLOWED
        },
      ],
    };

    try {
      assertPersistableOrThrow({
        obj: badTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).toContain('TEAM');
      expect(error.message).toContain('team.exceptionHistory[0].debugFoo');
      expect(error.message).toContain('persistenceContracts/contracts.js');
    }
  });
});

// ==============================================================================
// CATEGORY E: Contract structure validation (Phase 62 additions)
// ==============================================================================

describe('Phase 62: Contract structure validation for new allowlists', () => {
  it('TEST 25: DEAD_CAP_ITEM_ALLOWLIST is frozen and non-empty', () => {
    expect(Object.isFrozen(DEAD_CAP_ITEM_ALLOWLIST)).toBe(true);
    expect(DEAD_CAP_ITEM_ALLOWLIST.length).toBeGreaterThan(0);
  });

  it('TEST 26: DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST is frozen and non-empty', () => {
    expect(Object.isFrozen(DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST)).toBe(true);
    expect(DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST.length).toBeGreaterThan(0);
  });

  it('TEST 27: CAP_HOLD_ITEM_ALLOWLIST is frozen and non-empty', () => {
    expect(Object.isFrozen(CAP_HOLD_ITEM_ALLOWLIST)).toBe(true);
    expect(CAP_HOLD_ITEM_ALLOWLIST.length).toBeGreaterThan(0);
  });

  it('TEST 28: TEAM_DEEP_RULES includes deadCap entry', () => {
    expect(TEAM_DEEP_RULES.deadCap).toBeDefined();
    expect(TEAM_DEEP_RULES.deadCap).toBe(DEAD_CAP_ITEM_ALLOWLIST);
  });

  it('TEST 29: TEAM_DEEP_RULES includes deadCap.amountByYear entry', () => {
    expect(TEAM_DEEP_RULES['deadCap.amountByYear']).toBeDefined();
    expect(TEAM_DEEP_RULES['deadCap.amountByYear']).toBe(
      DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST
    );
  });

  it('TEST 30: TEAM_DEEP_RULES includes capHolds entry', () => {
    expect(TEAM_DEEP_RULES.capHolds).toBeDefined();
    expect(TEAM_DEEP_RULES.capHolds).toBe(CAP_HOLD_ITEM_ALLOWLIST);
  });

  it('TEST 31: DEAD_CAP_ITEM_ALLOWLIST has expected fields', () => {
    expect(DEAD_CAP_ITEM_ALLOWLIST).toContain('playerId');
    expect(DEAD_CAP_ITEM_ALLOWLIST).toContain('playerName');
    expect(DEAD_CAP_ITEM_ALLOWLIST).toContain('originalSalary');
    expect(DEAD_CAP_ITEM_ALLOWLIST).toContain('amountByYear');
    expect(DEAD_CAP_ITEM_ALLOWLIST).toContain('waiveDate');
    expect(DEAD_CAP_ITEM_ALLOWLIST).toContain('notes');
  });

  it('TEST 32: DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST has expected fields', () => {
    expect(DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST).toContain('season');
    expect(DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST).toContain('amount');
    expect(DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST).toContain('isStretched');
  });

  it('TEST 33: CAP_HOLD_ITEM_ALLOWLIST has expected fields', () => {
    expect(CAP_HOLD_ITEM_ALLOWLIST).toContain('playerId');
    expect(CAP_HOLD_ITEM_ALLOWLIST).toContain('playerName');
    expect(CAP_HOLD_ITEM_ALLOWLIST).toContain('amount');
    expect(CAP_HOLD_ITEM_ALLOWLIST).toContain('type');
    expect(CAP_HOLD_ITEM_ALLOWLIST).toContain('season');
    expect(CAP_HOLD_ITEM_ALLOWLIST).toContain('isSigned');
    expect(CAP_HOLD_ITEM_ALLOWLIST).toContain('expiresOn');
    expect(CAP_HOLD_ITEM_ALLOWLIST).toContain('notes');
  });
});
