
import { describe, it, expect } from 'vitest';
import { validateOfferSheetResolution } from '../../src/features/architect/utils/capLegalityValidation'; // Adjust path if needed

describe('Phase 17: Offer Sheet Resolution Validation', () => {
    const mockOfferSheet = {
        id: 'os_1',
        offeringTeamCode: 'LAL',
        homeTeamCode: 'BOS',
        status: 'PENDING_MATCH',
        contractYears: 4,
        totalValue: 100000000
    };

    describe('Offering Team Actions', () => {
        it('should BLOCK offering team finalization if status is MATCHED', () => {
             const result = validateOfferSheetResolution({
                 offerSheet: { ...mockOfferSheet, status: 'MATCHED' },
                 actingTeamCode: 'LAL',
                 action: 'finalize'
             });
             expect(result.valid).toBe(false);
             expect(result.violations[0].rule).toBe('rfa_offer_sheet_matched_offering_team_cannot_finalize');
        });

        it('should ALLOW offering team finalization if status is DECLINED', () => {
             const result = validateOfferSheetResolution({
                 offerSheet: { ...mockOfferSheet, status: 'DECLINED' },
                 actingTeamCode: 'LAL',
                 action: 'finalize'
             });
             // Note: Returns valid=true, warnings=[], etc.
             expect(result.valid).toBe(true);
        });
        
        it('should BLOCK offering team finalization if status is PENDING_MATCH', () => {
             const result = validateOfferSheetResolution({
                 offerSheet: { ...mockOfferSheet, status: 'PENDING_MATCH' },
                 actingTeamCode: 'LAL',
                 action: 'finalize'
             });
             expect(result.valid).toBe(false);
             expect(result.violations[0].rule).toBe('rfa_offer_sheet_resolution_required');
        });
    });

    describe('Home Team Actions', () => {
        it('should ALLOW home team validation of match if status is MATCHED', () => {
             const result = validateOfferSheetResolution({
                 offerSheet: { ...mockOfferSheet, status: 'MATCHED' },
                 actingTeamCode: 'BOS',
                 action: 'finalize'
             });
             expect(result.valid).toBe(true);
        });

        it('should BLOCK home team finalization if status is PENDING_MATCH', () => {
             const result = validateOfferSheetResolution({
                 offerSheet: { ...mockOfferSheet, status: 'PENDING_MATCH' },
                 actingTeamCode: 'BOS',
                 action: 'finalize'
             });
             expect(result.valid).toBe(false);
             // Message should indicate it needs to be matched
             expect(result.violations.length).toBeGreaterThan(0);
        });
        
        it('should BLOCK home team from DECLINING if not home team', () => {
             const result = validateOfferSheetResolution({
                 offerSheet: { ...mockOfferSheet, status: 'PENDING_MATCH' },
                 actingTeamCode: 'LAL', // Wrong team
                 action: 'decline'
             });
             expect(result.valid).toBe(false);
             expect(result.violations[0].rule).toBe('rfa_team_identity_unverifiable'); // As defined in code
        });
    });
});
