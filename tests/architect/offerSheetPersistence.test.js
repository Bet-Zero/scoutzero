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
import { computeWorldMutation } from '../../src/features/architect/utils/mutationPipeline';

describe('Phase 18.1: Offer Sheet Persistence & Idempotency', () => {
    // Mock offer sheet with dedupKey
    const mockOfferSheet = {
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
        totalValue: 100000000
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
                action: 'finalize'
            });
            expect(result.valid).toBe(true);
            expect(result.violations).toHaveLength(0);
        });

        it('should BLOCK home team finalization when status is DECLINED (new rule)', () => {
            const result = validateOfferSheetResolution({
                offerSheet: { ...mockOfferSheet, status: 'DECLINED' },
                actingTeamCode: 'BOS', // Home team
                action: 'finalize'
            });
            expect(result.valid).toBe(false);
            expect(result.violations[0].rule).toBe('rfa_offer_sheet_declined_home_team_cannot_finalize');
        });

        it('should BLOCK offering team finalization when status is MATCHED', () => {
            const result = validateOfferSheetResolution({
                offerSheet: { ...mockOfferSheet, status: 'MATCHED' },
                actingTeamCode: 'LAL', // Offering team
                action: 'finalize'
            });
            expect(result.valid).toBe(false);
            expect(result.violations[0].rule).toBe('rfa_offer_sheet_matched_offering_team_cannot_finalize');
        });

        it('should ALLOW home team finalization when status is MATCHED', () => {
            const result = validateOfferSheetResolution({
                offerSheet: { ...mockOfferSheet, status: 'MATCHED' },
                actingTeamCode: 'BOS', // Home team
                action: 'finalize'
            });
            expect(result.valid).toBe(true);
        });

        it('should BLOCK offering team finalization when status is PENDING_MATCH', () => {
            const result = validateOfferSheetResolution({
                offerSheet: { ...mockOfferSheet, status: 'PENDING_MATCH' },
                actingTeamCode: 'LAL', // Offering team
                action: 'finalize'
            });
            expect(result.valid).toBe(false);
            expect(result.violations[0].rule).toBe('rfa_offer_sheet_resolution_required');
        });

        it('should BLOCK home team finalization when status is PENDING_MATCH', () => {
            const result = validateOfferSheetResolution({
                offerSheet: { ...mockOfferSheet, status: 'PENDING_MATCH' },
                actingTeamCode: 'BOS', // Home team
                action: 'finalize'
            });
            expect(result.valid).toBe(false);
            expect(result.violations[0].rule).toBe('rfa_offer_sheet_resolution_required');
        });
    });

    describe('Complete Decision Table Verification', () => {
        // Status x Actor -> Expected Result
        const testCases = [
            // PENDING_MATCH
            { status: 'PENDING_MATCH', actor: 'offering', action: 'finalize', expectValid: false, expectedRule: 'rfa_offer_sheet_resolution_required' },
            { status: 'PENDING_MATCH', actor: 'home', action: 'finalize', expectValid: false, expectedRule: 'rfa_offer_sheet_resolution_required' },
            { status: 'PENDING_MATCH', actor: 'home', action: 'match', expectValid: true, expectedRule: null },
            { status: 'PENDING_MATCH', actor: 'home', action: 'decline', expectValid: true, expectedRule: null },
            { status: 'PENDING_MATCH', actor: 'offering', action: 'match', expectValid: false, expectedRule: 'rfa_offer_sheet_resolution_required' },
            
            // MATCHED
            { status: 'MATCHED', actor: 'offering', action: 'finalize', expectValid: false, expectedRule: 'rfa_offer_sheet_matched_offering_team_cannot_finalize' },
            { status: 'MATCHED', actor: 'home', action: 'finalize', expectValid: true, expectedRule: null },
            
            // DECLINED
            { status: 'DECLINED', actor: 'offering', action: 'finalize', expectValid: true, expectedRule: null },
            { status: 'DECLINED', actor: 'home', action: 'finalize', expectValid: false, expectedRule: 'rfa_offer_sheet_declined_home_team_cannot_finalize' },
        ];

        testCases.forEach(({ status, actor, action, expectValid, expectedRule }) => {
            const actorTeam = actor === 'offering' ? 'LAL' : 'BOS';
            it(`${status} + ${actor} team + ${action} => ${expectValid ? 'ALLOWED' : 'BLOCKED'} ${expectedRule ? `(${expectedRule})` : ''}`, () => {
                const result = validateOfferSheetResolution({
                    offerSheet: { ...mockOfferSheet, status },
                    actingTeamCode: actorTeam,
                    action
                });
                
                expect(result.valid).toBe(expectValid);
                if (expectedRule) {
                    expect(result.violations[0]?.rule).toBe(expectedRule);
                }
            });
        });
    });
});

// ==============================================================================
// Phase 18.2: Idempotency Proof Tests
// ==============================================================================

describe('Phase 18.2: Idempotency Proof - storeOfferSheet', () => {
    // Helper to create minimal mock state for storeOfferSheet
    const createMockState = (overrides = {}) => ({
        team: {
            teamCode: 'LAL',
            teamName: 'Los Angeles Lakers',
            players: [],
            roster: [],
            offerSheets: [],
            ...overrides.team
        },
        player: {
            player_id: 'player123',
            id: 'player123',
            name: 'Test Player',
            displayName: 'Test Player',
            teamCode: 'BOS', // Home team
            contract: { signingTeam: 'BOS' },
            ...overrides.player
        },
        teamCode: 'LAL',
        homeTeam: {
            teamCode: 'BOS',
            teamName: 'Boston Celtics',
            players: [{
                player_id: 'player123',
                id: 'player123',
                name: 'Test Player',
                contract: { signingTeam: 'BOS' }
            }],
            roster: ['player123'],
            incomingOfferSheets: [],
            ...overrides.homeTeam
        }
    });

    const createMockPayload = (overrides = {}) => ({
        teamCode: 'LAL',
        playerId: 'player123',
        worldId: 'world_test_123',
        contract: {
            rfaOfferSheet: true,
            rfaOfferSheetOnly: true,
            rfaOfferSheetStatus: 'PENDING_MATCH',
            contractYears: 4,
            totalValue: 100000000,
            salariesByYear: [
                { season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true },
            ]
        },
        ...overrides
    });

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
            const offeringTeamAfter1 = result1.teamUpdates.find(u => u.teamCode === 'LAL').team;
            expect(offeringTeamAfter1.offerSheets).toHaveLength(1);
            expect(offeringTeamAfter1.offerSheets[0].id).toBe('os_test_1');
            
            // Second store with DIFFERENT offerSheetId but same identity
            const stateAfterFirst = createMockState({
                team: offeringTeamAfter1,
                homeTeam: result1.teamUpdates.find(u => u.teamCode === 'BOS')?.team || currentState.homeTeam
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
            const offeringTeamAfter2 = result2.teamUpdates.find(u => u.teamCode === 'LAL').team;
            
            // CRITICAL: Should still be only 1 entry (deduped by dedupKey)
            expect(offeringTeamAfter2.offerSheets).toHaveLength(1);
            // Original ID should be preserved
            expect(offeringTeamAfter2.offerSheets[0].id).toBe('os_test_1');
            // dedupKey should match expected format
            expect(offeringTeamAfter2.offerSheets[0].dedupKey).toBe('os:world_test_123:LAL:player123:2025-26');
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
                        { season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true },
                    ]
                }
            });
            const result1 = computeWorldMutation({
                mutationType: 'storeOfferSheet',
                payload: payload1,
                currentState,
                seasonId: '2025-26',
                timestamp: Date.now(),
            });
            
            const offeringTeamAfter1 = result1.teamUpdates.find(u => u.teamCode === 'LAL').team;
            
            // Second store with UPDATED salary
            const stateAfterFirst = createMockState({
                team: offeringTeamAfter1,
                homeTeam: result1.teamUpdates.find(u => u.teamCode === 'BOS')?.team || currentState.homeTeam
            });
            
            const payload2 = createMockPayload({ 
                offerSheetId: 'os_test_2',
                contract: {
                    rfaOfferSheet: true,
                    rfaOfferSheetOnly: true,
                    contractYears: 4,
                    totalValue: 120000000, // Changed
                    salariesByYear: [
                        { season: '2025-26', salary: 30000000, capHit: 30000000, guaranteed: true }, // Changed
                    ]
                }
            });
            const result2 = computeWorldMutation({
                mutationType: 'storeOfferSheet',
                payload: payload2,
                currentState: stateAfterFirst,
                seasonId: '2025-26',
                timestamp: Date.now() + 1000,
            });
            
            const offeringTeamAfter2 = result2.teamUpdates.find(u => u.teamCode === 'LAL').team;
            
            // Should still be 1 entry
            expect(offeringTeamAfter2.offerSheets).toHaveLength(1);
            // Should have UPDATED totalValue
            expect(offeringTeamAfter2.offerSheets[0].totalValue).toBe(120000000);
            expect(offeringTeamAfter2.offerSheets[0].salariesByYear[0].salary).toBe(30000000);
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
            const offeringTeamAfter1 = result1.teamUpdates.find(u => u.teamCode === 'LAL').team;
            expect(offeringTeamAfter1.offerSheets).toHaveLength(1);
            
            const firstId = offeringTeamAfter1.offerSheets[0].id;
            const firstCreatedAt = offeringTeamAfter1.offerSheets[0].createdAt;
            
            // Second store with NO offerSheetId (different timestamp generates different ID)
            const stateAfterFirst = createMockState({
                team: offeringTeamAfter1,
                homeTeam: result1.teamUpdates.find(u => u.teamCode === 'BOS')?.team || currentState.homeTeam
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
            const offeringTeamAfter2 = result2.teamUpdates.find(u => u.teamCode === 'LAL').team;
            
            // CRITICAL: Should still be only 1 entry (deduped by dedupKey)
            expect(offeringTeamAfter2.offerSheets).toHaveLength(1);
            // Original ID should be preserved
            expect(offeringTeamAfter2.offerSheets[0].id).toBe(firstId);
            // Original createdAt should be preserved
            expect(offeringTeamAfter2.offerSheets[0].createdAt).toBe(firstCreatedAt);
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
        }
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
                    { season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true },
                ]
            }
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
                    { season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true },
                ]
            }
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
                    { season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true },
                ]
            }
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
                offerSheets: [{
                    id: 'os_offering_id_1', // Different ID
                    dedupKey,
                    playerId: 'player123',
                    playerName: 'Test Player',
                    offeringTeamCode: 'LAL',
                    homeTeamCode: 'BOS',
                    status: 'DECLINED',
                    seasonKey: '2025-26',
                    contractYears: 4,
                    salariesByYear: [{ season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true }],
                }],
            },
            homeTeam: {
                teamCode: 'BOS',
                teamName: 'Boston Celtics',
                players: [{ player_id: 'player123', name: 'Test Player' }],
                roster: ['player123'],
                incomingOfferSheets: [{
                    id: 'os_home_id_2', // Different ID from offering team
                    dedupKey,
                    playerId: 'player123',
                    playerName: 'Test Player',
                    offeringTeamCode: 'LAL',
                    homeTeamCode: 'BOS',
                    status: 'DECLINED',
                    seasonKey: '2025-26',
                    contractYears: 4,
                    salariesByYear: [{ season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true }],
                }],
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
        
        const offeringTeamResult = result.teamUpdates.find(u => u.teamCode === 'LAL').team;
        const homeTeamResult = result.teamUpdates.find(u => u.teamCode === 'BOS').team;
        
        // Both arrays should be empty
        expect(offeringTeamResult.offerSheets).toHaveLength(0);
        expect(homeTeamResult.incomingOfferSheets).toHaveLength(0);
        
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
                { season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true },
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
                                { season: '2024-25', salary: 8000000, capHit: 8000000, guaranteed: true },
                            ],
                        },
                    },
                ],
                roster: ['player123'],
                capHolds: [
                    { playerId: 'player123', playerName: 'Canonical Matched Name', amount: 12000000, active: true },
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
        expect(result.playerUpdates).toHaveLength(1);
        expect(result.playerDeletes).toEqual([]);
        expect(result.playerUpdates[0].playerId).toBe('player123');
        expect(result.playerUpdates[0].player.teamCode).toBe('BOS');
        expect(result.playerUpdates[0].player.displayName).toBe('Canonical Matched Name');
        expect(result.playerUpdates[0].player.contract.signedUsing).toBe('Match');

        const homeTeamResult = result.teamUpdates.find((u) => u.teamCode === 'BOS').team;
        expect(homeTeamResult.incomingOfferSheets).toHaveLength(0);
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
                { season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true },
            ],
        };

        const currentState = {
            offeringTeam: {
                teamCode: 'LAL',
                teamName: 'Los Angeles Lakers',
                players: [],
                roster: [],
                capHolds: [
                    { playerId: 'player123', playerName: 'Canonical Source Name', amount: 3000000, active: true },
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
                                { season: '2024-25', salary: 9000000, capHit: 9000000, guaranteed: true },
                            ],
                        },
                    },
                ],
                roster: ['player123'],
                capHolds: [
                    { playerId: 'player123', playerName: 'Canonical Source Name', amount: 12000000, active: true },
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
        expect(result.playerUpdates).toHaveLength(1);
        expect(result.playerDeletes).toEqual([
            { playerId: 'player123', teamCode: 'BOS' },
        ]);
        expect(result.playerUpdates[0].player.teamCode).toBe('LAL');
        expect(result.playerUpdates[0].player.displayName).toBe('Canonical Source Name');
        expect(result.playerUpdates[0].player.displayName).not.toBe('Fragment-Only Name');
        expect(result.playerUpdates[0].player.contract.signedUsing).toBe('Offer Sheet');

        const offeringTeamResult = result.teamUpdates.find((u) => u.teamCode === 'LAL').team;
        const homeTeamResult = result.teamUpdates.find((u) => u.teamCode === 'BOS').team;
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
                { season: '2025-26', salary: 25000000, capHit: 25000000, guaranteed: true },
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
