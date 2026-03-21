import { describe, it, expect, vi } from 'vitest';
import { validateOfferSheetResolution, validateWaive } from '@/features/architect/utils/capLegalityValidation';

// Mock dependencies for validateWaive
vi.mock('@/features/architect/utils/capRulesProfile', () => ({
  getCapRulesForYear: () => ({
    roster: { minStandard: 14, graceMin: 14 },
    salaries: { getMinimumForYOS: () => 1000000 },
  }),
  evaluateDataConfidence: () => ({ blocked: false }),
}));

// Mock countStandardRoster
vi.mock('@/features/architect/utils/capLegalityValidation', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;
    return {
        ...actual,
    };
});


describe('Phase 21: Timing Warnings', () => {

  describe('validateOfferSheetResolution - 48h Window', () => {
    const createdAt = '2024-07-01T12:00:00.000Z'; // July 1 Noon UTC
    // Deadline: July 3 Noon UTC.
    // Logic compares asOfDate (YYYY-MM-DD) vs Deadline Date (YYYY-MM-DD).
    // Deadline Date: 2024-07-03.
    
    it('1. should not warn if matching on day 1 (well within 48h)', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { status: 'PENDING_MATCH', homeTeamCode: 'HOU', createdAt },
        actingTeamCode: 'HOU',
        action: 'match',
        asOfDate: '2024-07-01',
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.rule === 'offer_sheet_window_expired')).toBe(false);
    });

    it('2. should not warn if matching on day 2 (within 48h)', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { status: 'PENDING_MATCH', homeTeamCode: 'HOU', createdAt },
        actingTeamCode: 'HOU',
        action: 'match',
        asOfDate: '2024-07-02',
      });
      expect(result.warnings.some(w => w.rule === 'offer_sheet_window_expired')).toBe(false);
    });

    it('3. should not warn if matching on day 3 (deadline day, ambiguous but technically allowed if before exact time, here we check strictly > date)', () => {
      // The logic: if (asOfDate > deadlineDateStr) warn.
      // asOfDate="2024-07-03". deadlineDateStr="2024-07-03". 
      // "2024-07-03" > "2024-07-03" is false. So NO warning.
      const result = validateOfferSheetResolution({
        offerSheet: { status: 'PENDING_MATCH', homeTeamCode: 'HOU', createdAt },
        actingTeamCode: 'HOU',
        action: 'match',
        asOfDate: '2024-07-03',
      });
      expect(result.warnings.some(w => w.rule === 'offer_sheet_window_expired')).toBe(false);
    });

    it('4. should warn if matching on day 4 (strictly after deadline date)', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { status: 'PENDING_MATCH', homeTeamCode: 'HOU', createdAt },
        actingTeamCode: 'HOU',
        action: 'match',
        asOfDate: '2024-07-04',
      });
      expect(result.valid).toBe(true); // Warning only
      expect(result.warnings.some(w => w.rule === 'offer_sheet_window_expired')).toBe(true);
    });

    it('5. should NOT warn if declining (deadline applies to matching only)', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { status: 'PENDING_MATCH', homeTeamCode: 'HOU', createdAt },
        actingTeamCode: 'HOU',
        action: 'decline',
        asOfDate: '2024-07-10', // Way late
      });
      expect(result.warnings.some(w => w.rule === 'offer_sheet_window_expired')).toBe(false);
    });

    it('6. should ignore if asOfDate is missing', () => {
      const result = validateOfferSheetResolution({
        offerSheet: { status: 'PENDING_MATCH', homeTeamCode: 'HOU', createdAt },
        actingTeamCode: 'HOU',
        action: 'match',
        asOfDate: null,
      });
      expect(result.warnings.some(w => w.rule === 'offer_sheet_window_expired')).toBe(false);
    });
  });

  describe('validateWaive - Stretch Timing', () => {
    // Mock getSeasonStartDate behavior via inputs
    // The helper inside is hardcoded:
    // 2024-25 -> Oct 22, 2024
    const YEAR = 2025; // Season 2024-25
    const START_DATE = '2024-10-22';

    it('1. should not warn if stretch used before season start', () => {
      const result = validateWaive({
        team: { players: [] },
        player: { contract: { salariesByYear: [] } },
        stretch: true,
        year: YEAR,
        asOfDate: '2024-10-01', // Before Oct 22
      });
      expect(result.warnings.some(w => w.rule === 'stretch_timing_suspicious')).toBe(false);
    });

    it('2. should warn if stretch used after season start', () => {
      const result = validateWaive({
        team: { players: [] },
        player: { contract: { salariesByYear: [] } },
        stretch: true,
        year: YEAR,
        asOfDate: '2024-11-01', // After Oct 22
      });
      expect(result.warnings.some(w => w.rule === 'stretch_timing_suspicious')).toBe(true);
    });

    it('3. should warn if season start date is unknown (missing boundary)', () => {
      // 2030-31 is not in the hardcoded list
      const result = validateWaive({
        team: { players: [] },
        player: { contract: { salariesByYear: [] } },
        stretch: true,
        year: 2031, // Season 2030-31
        asOfDate: '2030-11-01',
      });
      expect(result.warnings.some(w => w.rule === 'stretch_timing_not_enforced_missing_season_boundary')).toBe(true);
      expect(result.warnings.some(w => w.rule === 'stretch_timing_suspicious')).toBe(false);
    });

    it('4. should not warn if stretch is false', () => {
      const result = validateWaive({
        team: { players: [] },
        player: { contract: { salariesByYear: [] } },
        stretch: false,
        year: YEAR,
        asOfDate: '2024-11-01',
      });
      expect(result.warnings.some(w => w.rule === 'stretch_timing_suspicious')).toBe(false);
    });
  });
});
