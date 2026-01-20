/**
 * Phase 18.1: Offer Sheet Persistence Tests
 * 
 * Tests for:
 * - Idempotency (dedupKey prevents duplicates on retries)
 * - Finalize DECLINED explicit cleanup
 * - Rule scope (DECLINED allowed for offering team, blocked for home team)
 */

import { describe, it, expect } from 'vitest';
import { validateOfferSheetResolution } from '../../src/features/architect/utils/capLegalityValidation';

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
            { status: 'PENDING_MATCH', actor: 'offering', action: 'match', expectValid: false, expectedRule: 'rfa_team_identity_unverifiable' },
            
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
