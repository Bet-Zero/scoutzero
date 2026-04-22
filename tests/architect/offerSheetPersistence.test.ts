/**
 * Phase 18.1/18.2: Offer Sheet Persistence Tests
 *
 * Tests for:
 * - Idempotency (dedupKey prevents duplicates on retries)
 * - Finalize DECLINED explicit cleanup
 * - Rule scope (DECLINED allowed for offering team, blocked for home team)
 * - Phase 18.2: True idempotency proof, worldId required, cleanup by dedupKey
 */

import { describe, it, expect } from 'vitest';
import { validateOfferSheetResolution } from '../../src/features/architect/utils/capLegalityValidation';
import {
  computeWorldMutation,
  findUpdatedTeamSnapshot,
  type ArchitectMutationOfferSheet,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationResult,
  type ArchitectMutationTeamRecord,
} from '../../src/features/architect/utils/mutationPipeline';

type ComputeWorldMutationArgs = Parameters<typeof computeWorldMutation>[0];
type StoreOfferSheetArgs = Extract<
  ComputeWorldMutationArgs,
  { mutationType: 'storeOfferSheet' }
>;
type StoreOfferSheetState = Extract<
  StoreOfferSheetArgs['currentState'],
  { team?: unknown; player?: unknown; teamCode?: unknown; homeTeam?: unknown }
>;
type StoreOfferSheetTeam = NonNullable<StoreOfferSheetState['team']>;
type StoreOfferSheetPlayer = NonNullable<StoreOfferSheetState['player']>;
type StoreOfferSheetHomeTeam = NonNullable<StoreOfferSheetState['homeTeam']>;
type UpdatedTeamSnapshot = NonNullable<
  ReturnType<typeof findUpdatedTeamSnapshot>
>;

type StoreOfferSheetStateOverrides = {
  team?: Partial<StoreOfferSheetTeam> | UpdatedTeamSnapshot;
  player?: Partial<StoreOfferSheetPlayer>;
  teamCode?: string;
  homeTeam?: Partial<StoreOfferSheetHomeTeam> | UpdatedTeamSnapshot | null;
};

type OfferSheetContractPayload = {
  rfaOfferSheet: boolean;
  rfaOfferSheetOnly: boolean;
  rfaOfferSheetStatus?: string;
  contractYears: number;
  totalValue: number;
  salariesByYear: Array<{
    season: string;
    salary: number;
    capHit: number;
    guaranteed: boolean;
  }>;
};

type StoreOfferSheetPayload = {
  teamCode: string;
  playerId: string;
  worldId: string;
  offerSheetId?: string;
  contract: OfferSheetContractPayload;
};

type StoreOfferSheetPayloadOverrides = Partial<
  Omit<StoreOfferSheetPayload, 'contract'>
> & {
  contract?: Partial<Omit<OfferSheetContractPayload, 'salariesByYear'>> & {
    salariesByYear?: OfferSheetContractPayload['salariesByYear'];
  };
};

function requireValue<T>(value: T | null | undefined, message: string): T {
  expect(value, message).toBeDefined();

  if (value == null) {
    throw new Error(message);
  }

  return value;
}

function getUpdatedTeam(
  result: ArchitectMutationResult,
  teamCode: string
): NonNullable<ReturnType<typeof findUpdatedTeamSnapshot>> {
  return requireValue(
    findUpdatedTeamSnapshot(result.teamUpdates, teamCode),
    `Expected updated team for ${teamCode}`
  );
}

function getOfferSheets(
  team: Pick<ArchitectMutationTeamRecord, 'offerSheets'>,
  teamCode: string
): ArchitectMutationOfferSheet[] {
  expect(
    Array.isArray(team.offerSheets),
    `Expected offerSheets for ${teamCode}`
  ).toBe(true);
  return team.offerSheets ?? [];
}

function getIncomingOfferSheets(
  team: Pick<ArchitectMutationTeamRecord, 'incomingOfferSheets'>,
  teamCode: string
): ArchitectMutationOfferSheet[] {
  expect(
    Array.isArray(team.incomingOfferSheets),
    `Expected incomingOfferSheets for ${teamCode}`
  ).toBe(true);
  return team.incomingOfferSheets ?? [];
}

function getUpdatedPlayer(
  result: ArchitectMutationResult,
  playerId: string
): ArchitectMutationPlayerRecord {
  const playerUpdate = (result.playerUpdates ?? []).find(
    (candidate) => candidate.playerId === playerId && candidate.player
  );

  return requireValue(
    playerUpdate?.player,
    `Expected updated player ${playerId}`
  );
}

describe('Phase 18.1: Offer Sheet Persistence & Idempotency', () => {
  // Mock offer sheet with dedupKey
  const mockOfferSheet: ArchitectMutationOfferSheet = {
    id: 'os_LAL_player123_1705700000000',
    dedupKey: 'os:world1:LAL:player123:2025-26',
    offeringTeamCode: 'LAL',
    homeTeamCode: 'BOS',
    playerId: 'player123',
    playerName: 'Test Player',
    status: 'PENDING_MATCH',
    seasonKey: '2025-26',
    year: 2026,
    contractYears: 4,
    salariesByYear: [
      { season: '2025-26', salary: 20000000, capHit: 20000000 },
      { season: '2026-27', salary: 21000000, capHit: 21000000 },
    ],
    totalValue: 100000000,
  };

  describe('Idempotency via dedupKey', () => {
    it('should have dedupKey format: os:{worldId}:{offeringTeamCode}:{playerId}:{seasonKey}', () => {
      // Verify the dedupKey is deterministic and follows spec
      const expectedPattern = /^os:[^:]+:[A-Z]+:[^:]+:\d{4}-\d{2}$/;
      expect(mockOfferSheet.dedupKey).toMatch(expectedPattern);
    });

    it('should be deterministic - same inputs produce same dedupKey', () => {
      const worldId = 'world1';
      const offeringTeamCode = 'LAL';
      const playerId = 'player123';
      const seasonKey = '2025-26';

      const dedupKey1 = `os:${worldId}:${offeringTeamCode}:${playerId}:${seasonKey}`;
      const dedupKey2 = `os:${worldId}:${offeringTeamCode}:${playerId}:${seasonKey}`;

      expect(dedupKey1).toBe(dedupKey2);
    });

    it('should produce different dedupKeys for different seasons', () => {
      const worldId = 'world1';
      const offeringTeamCode = 'LAL';
      const playerId = 'player123';

      const dedupKey2025 = `os:${worldId}:${offeringTeamCode}:${playerId}:2025-26`;
      const dedupKey2026 = `os:${worldId}:${offeringTeamCode}:${playerId}:2026-27`;

      expect(dedupKey2025).not.toBe(dedupKey2026);
    });

    it('should produce different dedupKeys for different teams', () => {
      const worldId = 'world1';
      const playerId = 'player123';
      const seasonKey = '2025-26';

      const dedupKeyLAL = `os:${worldId}:LAL:${playerId}:${seasonKey}`;
      const dedupKeyNYK = `os:${worldId}:NYK:${playerId}:${seasonKey}`;

      expect(dedupKeyLAL).not.toBe(dedupKeyNYK);
    });
  });

  describe('DECLINED Rule Scope (Phase 18.1)', () => {
    it('should ALLOW offering team finalization when status is DECLINED', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { ...mockOfferSheet, status: 'DECLINED' },
        actingTeamCode: 'LAL', // Offering team
        action: 'finalize',
      });
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should BLOCK home team finalization when status is DECLINED (new rule)', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { ...mockOfferSheet, status: 'DECLINED' },
        actingTeamCode: 'BOS', // Home team
        action: 'finalize',
      });
      expect(result.valid).toBe(false);
      expect(result.violations[0].rule).toBe(
        'rfa_offer_sheet_declined_home_team_cannot_finalize'
      );
    });

    it('should BLOCK offering team finalization when status is MATCHED', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { ...mockOfferSheet, status: 'MATCHED' },
        actingTeamCode: 'LAL', // Offering team
        action: 'finalize',
      });
      expect(result.valid).toBe(false);
      expect(result.violations[0].rule).toBe(
        'rfa_offer_sheet_matched_offering_team_cannot_finalize'
      );
    });

    it('should ALLOW home team finalization when status is MATCHED', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { ...mockOfferSheet, status: 'MATCHED' },
        actingTeamCode: 'BOS', // Home team
        action: 'finalize',
      });
      expect(result.valid).toBe(true);
    });

    it('should BLOCK offering team finalization when status is PENDING_MATCH', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { ...mockOfferSheet, status: 'PENDING_MATCH' },
        actingTeamCode: 'LAL', // Offering team
        action: 'finalize',
      });
      expect(result.valid).toBe(false);
      expect(result.violations[0].rule).toBe(
        'rfa_offer_sheet_resolution_required'
      );
    });

    it('should BLOCK home team finalization when status is PENDING_MATCH', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { ...mockOfferSheet, status: 'PENDING_MATCH' },
        actingTeamCode: 'BOS', // Home team
        action: 'finalize',
      });
      expect(result.valid).toBe(false);
      expect(result.violations[0].rule).toBe(
        'rfa_offer_sheet_resolution_required'
      );
    });
  });

  describe('Complete Decision Table Verification', () => {
    // Status x Actor -> Expected Result
    const testCases = [
      // PENDING_MATCH
      {
        status: 'PENDING_MATCH',
        actor: 'offering',
        action: 'finalize',
        expectValid: false,
        expectedRule: 'rfa_offer_sheet_resolution_required',
      },
      {
        status: 'PENDING_MATCH',
        actor: 'home',
        action: 'finalize',
        expectValid: false,
        expectedRule: 'rfa_offer_sheet_resolution_required',
      },
      {
        status: 'PENDING_MATCH',
        actor: 'home',
        action: 'match',
        expectValid: true,
        expectedRule: null,
      },
      {
        status: 'PENDING_MATCH',
        actor: 'home',
        action: 'decline',
        expectValid: true,
        expectedRule: null,
      },
      {
        status: 'PENDING_MATCH',
        actor: 'offering',
        action: 'match',
        expectValid: false,
        expectedRule: 'rfa_offer_sheet_resolution_required',
      },

      // MATCHED
      {
        status: 'MATCHED',
        actor: 'offering',
        action: 'finalize',
        expectValid: false,
        expectedRule: 'rfa_offer_sheet_matched_offering_team_cannot_finalize',
      },
      {
        status: 'MATCHED',
        actor: 'home',
        action: 'finalize',
        expectValid: true,
        expectedRule: null,
      },

      // DECLINED
      {
        status: 'DECLINED',
        actor: 'offering',
        action: 'finalize',
        expectValid: true,
        expectedRule: null,
      },
      {
        status: 'DECLINED',
        actor: 'home',
        action: 'finalize',
        expectValid: false,
        expectedRule: 'rfa_offer_sheet_declined_home_team_cannot_finalize',
      },
    ];

    testCases.forEach(
      ({ status, actor, action, expectValid, expectedRule }) => {
        const actorTeam = actor === 'offering' ? 'LAL' : 'BOS';
        it(`${status} + ${actor} team + ${action} => ${expectValid ? 'ALLOWED' : 'BLOCKED'} ${expectedRule ? `(${expectedRule})` : ''}`, () => {
          const result = validateOfferSheetResolution({
            offerSheet: { ...mockOfferSheet, status },
            actingTeamCode: actorTeam,
            action,
          });

          expect(result.valid).toBe(expectValid);
          if (expectedRule) {
            expect(result.violations[0]?.rule).toBe(expectedRule);
          }
        });
      }
    );
  });
});

// ==============================================================================
// Phase 18.2: Idempotency Proof Tests
// ==============================================================================

describe('Phase 18.2: Idempotency Proof - storeOfferSheet', () => {
  // Helper to create minimal mock state for storeOfferSheet
  const createMockState = (
    overrides: StoreOfferSheetStateOverrides = {}
  ): StoreOfferSheetState => {
    const baseTeam: StoreOfferSheetTeam = {
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      players: [],
      roster: [],
      offerSheets: [],
    };

    const basePlayer: StoreOfferSheetPlayer = {
      player_id: 'player123',
      id: 'player123',
      name: 'Test Player',
      displayName: 'Test Player',
      teamCode: 'BOS',
      contract: { signingTeam: 'BOS' },
    };

    const baseHomeTeam: StoreOfferSheetHomeTeam = {
      teamCode: 'BOS',
      teamName: 'Boston Celtics',
      players: [
        {
          player_id: 'player123',
          id: 'player123',
          name: 'Test Player',
          contract: { signingTeam: 'BOS' },
        },
      ],
      roster: ['player123'],
      incomingOfferSheets: [],
    };

    return {
      team: {
        ...baseTeam,
        ...overrides.team,
      },
      player: {
        ...basePlayer,
        ...overrides.player,
      },
      teamCode: overrides.teamCode ?? 'LAL',
      homeTeam:
        overrides.homeTeam === null
          ? null
          : {
              ...baseHomeTeam,
              ...overrides.homeTeam,
            },
    };
  };

  const createMockPayload = (
    overrides: StoreOfferSheetPayloadOverrides = {}
  ): StoreOfferSheetPayload => {
    const contractOverrides = overrides.contract ?? {};

    return {
      teamCode: overrides.teamCode ?? 'LAL',
      playerId: overrides.playerId ?? 'player123',
      worldId: overrides.worldId ?? 'world_test_123',
      ...(overrides.offerSheetId
        ? { offerSheetId: overrides.offerSheetId }
        : {}),
      contract: {
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaOfferSheetStatus: 'PENDING_MATCH',
        contractYears: 4,
        totalValue: 100000000,
        salariesByYear: contractOverrides.salariesByYear ?? [
          {
            season: '2025-26',
            salary: 25000000,
            capHit: 25000000,
            guaranteed: true,
          },
        ],
        ...contractOverrides,
      },
    };
  };

  describe('A1: Store twice with different offerSheetId → Still 1 entry', () => {
    it('should produce only 1 offer sheet when stored twice with different IDs but same dedupKey inputs', () => {
      const currentState = createMockState();

      // First store
      const payload1 = createMockPayload({ offerSheetId: 'os_test_1' });
      const result1 = computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload: payload1,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result1.success).toBe(true);
      const offeringTeamAfter1 = getUpdatedTeam(result1, 'LAL');
      const offeringTeamAfter1OfferSheets = getOfferSheets(
        offeringTeamAfter1,
        'LAL'
      );
      expect(offeringTeamAfter1OfferSheets).toHaveLength(1);
      expect(
        requireValue(
          offeringTeamAfter1OfferSheets[0],
          'Expected first stored offer sheet'
        ).id
      ).toBe('os_test_1');

      // Second store with DIFFERENT offerSheetId but same identity
      const stateAfterFirst = createMockState({
        team: offeringTeamAfter1,
        homeTeam: getUpdatedTeam(result1, 'BOS'),
      });

      const payload2 = createMockPayload({ offerSheetId: 'os_test_2' });
      const result2 = computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload: payload2,
        currentState: stateAfterFirst,
        seasonId: '2025-26',
        timestamp: Date.now() + 1000, // Different timestamp
      });

      expect(result2.success).toBe(true);
      const offeringTeamAfter2 = getUpdatedTeam(result2, 'LAL');
      const offeringTeamAfter2OfferSheets = getOfferSheets(
        offeringTeamAfter2,
        'LAL'
      );

      // CRITICAL: Should still be only 1 entry (deduped by dedupKey)
      expect(offeringTeamAfter2OfferSheets).toHaveLength(1);
      // Original ID should be preserved
      expect(
        requireValue(
          offeringTeamAfter2OfferSheets[0],
          'Expected deduped offer sheet'
        ).id
      ).toBe('os_test_1');
      // dedupKey should match expected format
      expect(
        requireValue(
          offeringTeamAfter2OfferSheets[0],
          'Expected deduped offer sheet'
        ).dedupKey
      ).toBe('os:world_test_123:LAL:player123:2025-26');
    });

    it('should update contract terms in place on second store', () => {
      const currentState = createMockState();

      // First store with original salary
      const payload1 = createMockPayload({
        offerSheetId: 'os_test_1',
        contract: {
          rfaOfferSheet: true,
          rfaOfferSheetOnly: true,
          contractYears: 4,
          totalValue: 100000000,
          salariesByYear: [
            {
              season: '2025-26',
              salary: 25000000,
              capHit: 25000000,
              guaranteed: true,
            },
          ],
        },
      });
      const result1 = computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload: payload1,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      const offeringTeamAfter1 = getUpdatedTeam(result1, 'LAL');

      // Second store with UPDATED salary
      const stateAfterFirst = createMockState({
        team: offeringTeamAfter1,
        homeTeam: getUpdatedTeam(result1, 'BOS'),
      });

      const payload2 = createMockPayload({
        offerSheetId: 'os_test_2',
        contract: {
          rfaOfferSheet: true,
          rfaOfferSheetOnly: true,
          contractYears: 4,
          totalValue: 120000000, // Changed
          salariesByYear: [
            {
              season: '2025-26',
              salary: 30000000,
              capHit: 30000000,
              guaranteed: true,
            }, // Changed
          ],
        },
      });
      const result2 = computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload: payload2,
        currentState: stateAfterFirst,
        seasonId: '2025-26',
        timestamp: Date.now() + 1000,
      });

      const offeringTeamAfter2 = getUpdatedTeam(result2, 'LAL');
      const offeringTeamAfter2OfferSheets = getOfferSheets(
        offeringTeamAfter2,
        'LAL'
      );
      const updatedOfferSheet = requireValue(
        offeringTeamAfter2OfferSheets[0],
        'Expected updated offer sheet after second store'
      );

      // Should still be 1 entry
      expect(offeringTeamAfter2OfferSheets).toHaveLength(1);
      // Should have UPDATED totalValue
      expect(updatedOfferSheet.totalValue).toBe(120000000);
      expect(
        requireValue(
          updatedOfferSheet.salariesByYear?.[0],
          'Expected updated salary row'
        ).salary
      ).toBe(30000000);
    });
  });

  describe('A2: Store twice with NO offerSheetId → Still 1 entry', () => {
    it('should produce only 1 offer sheet when stored twice without explicit ID', () => {
      const currentState = createMockState();
      const timestamp1 = Date.now();

      // First store with NO offerSheetId
      const payload1 = createMockPayload();
      delete payload1.offerSheetId;

      const result1 = computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload: payload1,
        currentState,
        seasonId: '2025-26',
        timestamp: timestamp1,
      });

      expect(result1.success).toBe(true);
      const offeringTeamAfter1 = getUpdatedTeam(result1, 'LAL');
      const offeringTeamAfter1OfferSheets = getOfferSheets(
        offeringTeamAfter1,
        'LAL'
      );
      expect(offeringTeamAfter1OfferSheets).toHaveLength(1);

      const firstOfferSheet = requireValue(
        offeringTeamAfter1OfferSheets[0],
        'Expected first auto-generated offer sheet'
      );
      const firstId = firstOfferSheet.id;
      const firstCreatedAt = firstOfferSheet.createdAt;

      // Second store with NO offerSheetId (different timestamp generates different ID)
      const stateAfterFirst = createMockState({
        team: offeringTeamAfter1,
        homeTeam: getUpdatedTeam(result1, 'BOS'),
      });

      const payload2 = createMockPayload();
      delete payload2.offerSheetId;

      const result2 = computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload: payload2,
        currentState: stateAfterFirst,
        seasonId: '2025-26',
        timestamp: timestamp1 + 5000, // Different timestamp
      });

      expect(result2.success).toBe(true);
      const offeringTeamAfter2 = getUpdatedTeam(result2, 'LAL');
      const offeringTeamAfter2OfferSheets = getOfferSheets(
        offeringTeamAfter2,
        'LAL'
      );
      const dedupedOfferSheet = requireValue(
        offeringTeamAfter2OfferSheets[0],
        'Expected deduped auto-generated offer sheet'
      );

      // CRITICAL: Should still be only 1 entry (deduped by dedupKey)
      expect(offeringTeamAfter2OfferSheets).toHaveLength(1);
      // Original ID should be preserved
      expect(dedupedOfferSheet.id).toBe(firstId);
      // Original createdAt should be preserved
      expect(dedupedOfferSheet.createdAt).toBe(firstCreatedAt);
    });
  });

  describe('Strict home-team truth guardrails', () => {
    it('fails closed when authoritative home team is missing', () => {
      const result = computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload: createMockPayload(),
        currentState: {
          team: createMockState().team,
          player: createMockState().player,
          teamCode: 'LAL',
          homeTeam: null,
        },
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(String(result.error)).toContain(
        'resolved authoritative home-team truth'
      );
    });

    it('fails closed when home team resolves to the offering team', () => {
      const result = computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload: createMockPayload(),
        currentState: createMockState({
          homeTeam: {
            teamCode: 'LAL',
            teamName: 'Los Angeles Lakers',
            players: [
              {
                player_id: 'player123',
                id: 'player123',
                name: 'Test Player',
                displayName: 'Test Player',
                contract: { signingTeam: 'LAL' },
              },
            ],
            roster: ['player123'],
            incomingOfferSheets: [],
          },
        }),
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(String(result.error)).toContain(
        'home team distinct from the offering team'
      );
    });

    it('fails closed when canonical player truth is not backed by the home-team snapshot player', () => {
      const result = computeWorldMutation({
        mutationType: 'storeOfferSheet',
        payload: createMockPayload(),
        currentState: createMockState({
          homeTeam: {
            teamCode: 'BOS',
            teamName: 'Boston Celtics',
            players: [],
            roster: ['player123'],
            incomingOfferSheets: [],
          },
        }),
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(String(result.error)).toContain('home-team snapshot player truth');
    });
  });
});

// ==============================================================================
// Phase 18.2: worldId Required Tests
// ==============================================================================

describe('Phase 18.2: worldId Required for Offer Sheet Identity', () => {
  const createMockState = () => ({
    team: {
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      players: [],
      roster: [],
      offerSheets: [],
    },
    player: {
      player_id: 'player123',
      id: 'player123',
      name: 'Test Player',
      displayName: 'Test Player',
      teamCode: 'BOS',
      contract: { signingTeam: 'BOS' },
    },
    teamCode: 'LAL',
    homeTeam: {
      teamCode: 'BOS',
      teamName: 'Boston Celtics',
      players: [{ player_id: 'player123', name: 'Test Player' }],
      roster: ['player123'],
      incomingOfferSheets: [],
    },
  });

  it('should FAIL FAST when worldId is missing from payload', () => {
    const currentState = createMockState();

    const payload = {
      teamCode: 'LAL',
      playerId: 'player123',
      // worldId is MISSING
      contract: {
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        contractYears: 4,
        totalValue: 100000000,
        salariesByYear: [
          {
            season: '2025-26',
            salary: 25000000,
            capHit: 25000000,
            guaranteed: true,
          },
        ],
      },
    };

    const result = computeWorldMutation({
      mutationType: 'storeOfferSheet',
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('worldId');
  });

  it('should FAIL FAST when worldId is undefined', () => {
    const currentState = createMockState();

    const payload = {
      teamCode: 'LAL',
      playerId: 'player123',
      worldId: undefined, // Explicitly undefined
      contract: {
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        contractYears: 4,
        totalValue: 100000000,
        salariesByYear: [
          {
            season: '2025-26',
            salary: 25000000,
            capHit: 25000000,
            guaranteed: true,
          },
        ],
      },
    };

    const result = computeWorldMutation({
      mutationType: 'storeOfferSheet',
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('worldId');
  });

  it('should SUCCEED when worldId is provided', () => {
    const currentState = createMockState();

    const payload = {
      teamCode: 'LAL',
      playerId: 'player123',
      worldId: 'world_test_123', // Valid worldId
      contract: {
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        contractYears: 4,
        totalValue: 100000000,
        salariesByYear: [
          {
            season: '2025-26',
            salary: 25000000,
            capHit: 25000000,
            guaranteed: true,
          },
        ],
      },
    };

    const result = computeWorldMutation({
      mutationType: 'storeOfferSheet',
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);
  });
});

// ==============================================================================
// Phase 18.2: Cleanup by dedupKey Tests
// ==============================================================================

describe('Phase 18.2: finalizeDeclinedOfferSheet Cleanup by dedupKey', () => {
  it('should remove offer sheet from BOTH teams when arrays have different IDs but same dedupKey', () => {
    const dedupKey = 'os:world1:LAL:player123:2025-26';

    // Create state where offering team and home team have DIFFERENT IDs for same offer
    const currentState = {
      offeringTeam: {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        offerSheets: [
          {
            id: 'os_offering_id_1', // Different ID
            dedupKey,
            playerId: 'player123',
            playerName: 'Test Player',
            offeringTeamCode: 'LAL',
            homeTeamCode: 'BOS',
            status: 'DECLINED',
            seasonKey: '2025-26',
            contractYears: 4,
            salariesByYear: [
              {
                season: '2025-26',
                salary: 25000000,
                capHit: 25000000,
                guaranteed: true,
              },
            ],
          },
        ],
      },
      homeTeam: {
        teamCode: 'BOS',
        teamName: 'Boston Celtics',
        players: [{ player_id: 'player123', name: 'Test Player' }],
        roster: ['player123'],
        incomingOfferSheets: [
          {
            id: 'os_home_id_2', // Different ID from offering team
            dedupKey,
            playerId: 'player123',
            playerName: 'Test Player',
            offeringTeamCode: 'LAL',
            homeTeamCode: 'BOS',
            status: 'DECLINED',
            seasonKey: '2025-26',
            contractYears: 4,
            salariesByYear: [
              {
                season: '2025-26',
                salary: 25000000,
                capHit: 25000000,
                guaranteed: true,
              },
            ],
          },
        ],
      },
      offerSheetId: 'os_offering_id_1', // Use offering team's ID
    };

    const payload = {
      teamCode: 'LAL',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
      offerSheetId: 'os_offering_id_1',
      dedupKey, // Include dedupKey for dual cleanup
      playerId: 'player123',
      seasonKey: '2025-26',
    };

    const result = computeWorldMutation({
      mutationType: 'finalizeDeclinedOfferSheet',
      payload,
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);

    const offeringTeamResult = getUpdatedTeam(result, 'LAL');
    const homeTeamResult = getUpdatedTeam(result, 'BOS');

    // Both arrays should be empty
    expect(getOfferSheets(offeringTeamResult, 'LAL')).toHaveLength(0);
    expect(getIncomingOfferSheets(homeTeamResult, 'BOS')).toHaveLength(0);

    // Player should be added to offering team roster
    expect(offeringTeamResult.roster).toContain('player123');
  });
});

describe('E4: Offer sheet finalization canonical persistence manifests', () => {
  it('finalizeMatchedOfferSheet emits a same-team player upsert with no delete path', () => {
    const offerSheet = {
      id: 'os_match_e4',
      dedupKey: 'os:world1:LAL:player123:2025-26',
      playerId: 'player123',
      playerName: 'Fragment Name',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
      status: 'MATCHED',
      seasonKey: '2025-26',
      contractYears: 4,
      totalValue: 100000000,
      salariesByYear: [
        {
          season: '2025-26',
          salary: 25000000,
          capHit: 25000000,
          guaranteed: true,
        },
      ],
    };

    const currentState = {
      offeringTeam: {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        offerSheets: [offerSheet],
      },
      homeTeam: {
        teamCode: 'BOS',
        teamName: 'Boston Celtics',
        players: [
          {
            player_id: 'player123',
            id: 'player123',
            name: 'Canonical Matched Name',
            displayName: 'Canonical Matched Name',
            teamCode: 'BOS',
            teamName: 'Boston Celtics',
            contract: {
              contractType: 'Standard',
              salariesByYear: [
                {
                  season: '2024-25',
                  salary: 8000000,
                  capHit: 8000000,
                  guaranteed: true,
                },
              ],
            },
          },
        ],
        roster: ['player123'],
        capHolds: [
          {
            playerId: 'player123',
            playerName: 'Canonical Matched Name',
            amount: 12000000,
            active: true,
          },
        ],
        incomingOfferSheets: [offerSheet],
      },
      offerSheetId: 'os_match_e4',
    };

    const result = computeWorldMutation({
      mutationType: 'finalizeMatchedOfferSheet',
      payload: {
        teamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId: 'os_match_e4',
      },
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);
    expect(result.playerUpdates ?? []).toHaveLength(1);
    expect(result.playerDeletes).toEqual([]);
    const matchedPlayer = getUpdatedPlayer(result, 'player123');
    expect(matchedPlayer.playerId).toBe('player123');
    expect(matchedPlayer.teamCode).toBe('BOS');
    expect(matchedPlayer.displayName).toBe('Canonical Matched Name');
    expect(matchedPlayer.contract?.signedUsing).toBe('Match');

    const homeTeamResult = getUpdatedTeam(result, 'BOS');
    expect(getIncomingOfferSheets(homeTeamResult, 'BOS')).toHaveLength(0);
    expect(homeTeamResult.capHolds).toHaveLength(0);
  });

  it('finalizeDeclinedOfferSheet emits move manifest and preserves canonical source player identity', () => {
    const offerSheet = {
      id: 'os_decline_e4',
      dedupKey: 'os:world1:LAL:player123:2025-26',
      playerId: 'player123',
      playerName: 'Fragment-Only Name',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
      status: 'DECLINED',
      seasonKey: '2025-26',
      contractYears: 4,
      totalValue: 100000000,
      salariesByYear: [
        {
          season: '2025-26',
          salary: 25000000,
          capHit: 25000000,
          guaranteed: true,
        },
      ],
    };

    const currentState = {
      offeringTeam: {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        capHolds: [
          {
            playerId: 'player123',
            playerName: 'Canonical Source Name',
            amount: 3000000,
            active: true,
          },
        ],
        offerSheets: [offerSheet],
      },
      homeTeam: {
        teamCode: 'BOS',
        teamName: 'Boston Celtics',
        players: [
          {
            player_id: 'player123',
            id: 'player123',
            name: 'Canonical Source Name',
            displayName: 'Canonical Source Name',
            teamCode: 'BOS',
            teamName: 'Boston Celtics',
            contract: {
              contractType: 'Standard',
              salariesByYear: [
                {
                  season: '2024-25',
                  salary: 9000000,
                  capHit: 9000000,
                  guaranteed: true,
                },
              ],
            },
          },
        ],
        roster: ['player123'],
        capHolds: [
          {
            playerId: 'player123',
            playerName: 'Canonical Source Name',
            amount: 12000000,
            active: true,
          },
        ],
        incomingOfferSheets: [offerSheet],
      },
      offerSheetId: 'os_decline_e4',
    };

    const result = computeWorldMutation({
      mutationType: 'finalizeDeclinedOfferSheet',
      payload: {
        teamCode: 'LAL',
        homeTeamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId: 'os_decline_e4',
        dedupKey: offerSheet.dedupKey,
      },
      currentState,
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);
    expect(result.playerUpdates ?? []).toHaveLength(1);
    expect(result.playerDeletes).toEqual([
      { playerId: 'player123', teamCode: 'BOS' },
    ]);
    const declinedPlayer = getUpdatedPlayer(result, 'player123');
    expect(declinedPlayer.teamCode).toBe('LAL');
    expect(declinedPlayer.displayName).toBe('Canonical Source Name');
    expect(declinedPlayer.displayName).not.toBe('Fragment-Only Name');
    expect(declinedPlayer.contract?.signedUsing).toBe('Offer Sheet');

    const offeringTeamResult = getUpdatedTeam(result, 'LAL');
    const homeTeamResult = getUpdatedTeam(result, 'BOS');
    expect(offeringTeamResult.roster).toContain('player123');
    expect(offeringTeamResult.capHolds).toHaveLength(0);
    expect(homeTeamResult.roster).not.toContain('player123');
    expect(homeTeamResult.capHolds).toHaveLength(0);
  });

  it('finalizeDeclinedOfferSheet fails closed when canonical source player cannot be resolved', () => {
    const offerSheet = {
      id: 'os_decline_missing_player',
      dedupKey: 'os:world1:LAL:missing_player:2025-26',
      playerId: 'missing_player',
      playerName: 'Fragment Name',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
      status: 'DECLINED',
      seasonKey: '2025-26',
      contractYears: 4,
      salariesByYear: [
        {
          season: '2025-26',
          salary: 25000000,
          capHit: 25000000,
          guaranteed: true,
        },
      ],
    };

    const result = computeWorldMutation({
      mutationType: 'finalizeDeclinedOfferSheet',
      payload: {
        teamCode: 'LAL',
        homeTeamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId: offerSheet.id,
        dedupKey: offerSheet.dedupKey,
      },
      currentState: {
        offeringTeam: {
          teamCode: 'LAL',
          teamName: 'Los Angeles Lakers',
          players: [],
          roster: [],
          offerSheets: [offerSheet],
        },
        homeTeam: {
          teamCode: 'BOS',
          teamName: 'Boston Celtics',
          players: [],
          roster: [],
          incomingOfferSheets: [offerSheet],
        },
        offerSheetId: offerSheet.id,
      },
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('not found on home team roster');
  });
});
