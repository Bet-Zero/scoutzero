/**
 * FILE: src/tests/architect/phase42_apron_derivation_consolidation.test.js
 * PURPOSE: Guardrail tests for Phase 42 apron derivation consolidation.
 *          Ensures all consolidated call sites behave identically to SSOT at boundaries.
 *
 * HISTORY:
 *  - 2026-01-28: Created for Phase 42 execution (apron derivation consolidation sweep)
 *
 * BOUNDARY SEMANTICS (CBA Art VII Sec 2(f)):
 *  - Second apron: STRICTLY > secondApron (salary exactly == secondApron is NOT second apron)
 *  - First apron: >= firstApron (salary exactly == firstApron IS first apron)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// SSOT imports
import {
  getTeamApronStatus,
  isSecondApronTeam,
  isFirstApronTeam,
} from '../../features/architect/utils/tradeMachine/utils/capUtils.js';

// Architect capUtils (canonical Architect surface)
import {
  getApronStatus as getLegacyApronStatus,
  getTeamApronStatus as getTeamApronStatusFromCapUtils,
  isSecondApronTeam as isSecondApronTeamFromCapUtils,
  isFirstApronTeam as isFirstApronTeamFromCapUtils,
} from '../../features/architect/utils/capUtils.js';

// tradeHelpers consolidated function
import { getApronStatus as getTradeHelpersApronStatus } from '../../features/architect/utils/tradeHelpers.js';

// faExceptionUtils consolidated function
import { canUseFaException } from '../../features/architect/utils/faExceptionUtils.js';

describe('Phase 42: Apron Derivation Consolidation Guardrails', () => {
  const CAP_SETTINGS = {
    salaryCap: 140_000_000,
    firstApron: 178_000_000,
    secondApron: 190_000_000,
  };

  const EXACTLY_AT_FIRST_APRON = 178_000_000;
  const EXACTLY_AT_SECOND_APRON = 190_000_000;
  const BELOW_FIRST_APRON = 177_999_999;
  const ABOVE_FIRST_BELOW_SECOND = 180_000_000;
  const ABOVE_SECOND_APRON = 190_000_001;
  const UNDER_CAP = 100_000_000;

  describe('SSOT Baseline (tradeMachine capUtils)', () => {
    describe('getTeamApronStatus', () => {
      it('returns SECOND_APRON only when strictly > secondApron', () => {
        expect(
          getTeamApronStatus({ totalSalary: ABOVE_SECOND_APRON }, CAP_SETTINGS)
        ).toBe('SECOND_APRON');
        expect(
          getTeamApronStatus(
            { totalSalary: EXACTLY_AT_SECOND_APRON },
            CAP_SETTINGS
          )
        ).toBe('FIRST_APRON');
      });

      it('returns FIRST_APRON when >= firstApron and <= secondApron', () => {
        expect(
          getTeamApronStatus(
            { totalSalary: EXACTLY_AT_FIRST_APRON },
            CAP_SETTINGS
          )
        ).toBe('FIRST_APRON');
        expect(
          getTeamApronStatus(
            { totalSalary: ABOVE_FIRST_BELOW_SECOND },
            CAP_SETTINGS
          )
        ).toBe('FIRST_APRON');
        expect(
          getTeamApronStatus(
            { totalSalary: EXACTLY_AT_SECOND_APRON },
            CAP_SETTINGS
          )
        ).toBe('FIRST_APRON');
      });

      it('returns OVER_CAP when >= salaryCap and < firstApron', () => {
        expect(
          getTeamApronStatus(
            { totalSalary: CAP_SETTINGS.salaryCap },
            CAP_SETTINGS
          )
        ).toBe('OVER_CAP');
        expect(
          getTeamApronStatus({ totalSalary: BELOW_FIRST_APRON }, CAP_SETTINGS)
        ).toBe('OVER_CAP');
      });

      it('returns UNDER_CAP when < salaryCap', () => {
        expect(
          getTeamApronStatus({ totalSalary: UNDER_CAP }, CAP_SETTINGS)
        ).toBe('UNDER_CAP');
      });
    });

    describe('isSecondApronTeam', () => {
      it('returns true only when strictly > secondApron', () => {
        expect(
          isSecondApronTeam({ totalSalary: ABOVE_SECOND_APRON }, CAP_SETTINGS)
        ).toBe(true);
        expect(
          isSecondApronTeam(
            { totalSalary: EXACTLY_AT_SECOND_APRON },
            CAP_SETTINGS
          )
        ).toBe(false);
        expect(
          isSecondApronTeam(
            { totalSalary: ABOVE_FIRST_BELOW_SECOND },
            CAP_SETTINGS
          )
        ).toBe(false);
      });
    });

    describe('isFirstApronTeam', () => {
      it('returns true when >= firstApron', () => {
        expect(
          isFirstApronTeam(
            { totalSalary: EXACTLY_AT_FIRST_APRON },
            CAP_SETTINGS
          )
        ).toBe(true);
        expect(
          isFirstApronTeam(
            { totalSalary: ABOVE_FIRST_BELOW_SECOND },
            CAP_SETTINGS
          )
        ).toBe(true);
        expect(
          isFirstApronTeam({ totalSalary: ABOVE_SECOND_APRON }, CAP_SETTINGS)
        ).toBe(true);
      });

      it('returns false when < firstApron', () => {
        expect(
          isFirstApronTeam({ totalSalary: BELOW_FIRST_APRON }, CAP_SETTINGS)
        ).toBe(false);
        expect(isFirstApronTeam({ totalSalary: UNDER_CAP }, CAP_SETTINGS)).toBe(
          false
        );
      });
    });
  });

  describe('Architect capUtils (Canonical import surface)', () => {
    it('re-exports SSOT helpers correctly', () => {
      // Verify re-exports point to same functions
      expect(getTeamApronStatusFromCapUtils).toBe(getTeamApronStatus);
      expect(isSecondApronTeamFromCapUtils).toBe(isSecondApronTeam);
      expect(isFirstApronTeamFromCapUtils).toBe(isFirstApronTeam);
    });

    describe('Legacy getApronStatus (deprecated)', () => {
      it('maps SSOT values to legacy format correctly', () => {
        expect(getLegacyApronStatus(ABOVE_SECOND_APRON, CAP_SETTINGS)).toBe(
          'ABOVE_SECOND_APRON'
        );
        expect(
          getLegacyApronStatus(EXACTLY_AT_SECOND_APRON, CAP_SETTINGS)
        ).toBe('ABOVE_FIRST_APRON');
        expect(getLegacyApronStatus(EXACTLY_AT_FIRST_APRON, CAP_SETTINGS)).toBe(
          'ABOVE_FIRST_APRON'
        );
        expect(getLegacyApronStatus(BELOW_FIRST_APRON, CAP_SETTINGS)).toBe(
          'OVER_CAP'
        );
        expect(getLegacyApronStatus(UNDER_CAP, CAP_SETTINGS)).toBe('UNDER_CAP');
      });
    });
  });

  describe('tradeHelpers.getApronStatus (consolidated)', () => {
    it('returns correct UI labels with SSOT semantics', () => {
      expect(getTradeHelpersApronStatus(ABOVE_SECOND_APRON, CAP_SETTINGS)).toBe(
        '2nd Apron'
      );
      expect(
        getTradeHelpersApronStatus(EXACTLY_AT_SECOND_APRON, CAP_SETTINGS)
      ).toBe('1st Apron');
      expect(
        getTradeHelpersApronStatus(EXACTLY_AT_FIRST_APRON, CAP_SETTINGS)
      ).toBe('1st Apron');
      expect(getTradeHelpersApronStatus(BELOW_FIRST_APRON, CAP_SETTINGS)).toBe(
        'Below Aprons'
      );
    });

    it('treats salary exactly at second apron as first apron (strict > for second)', () => {
      // Critical boundary test
      expect(
        getTradeHelpersApronStatus(EXACTLY_AT_SECOND_APRON, CAP_SETTINGS)
      ).toBe('1st Apron');
      expect(
        getTradeHelpersApronStatus(EXACTLY_AT_SECOND_APRON + 1, CAP_SETTINGS)
      ).toBe('2nd Apron');
    });

    it('treats salary exactly at first apron as first apron (>= for first)', () => {
      // Critical boundary test
      expect(
        getTradeHelpersApronStatus(EXACTLY_AT_FIRST_APRON, CAP_SETTINGS)
      ).toBe('1st Apron');
      expect(
        getTradeHelpersApronStatus(EXACTLY_AT_FIRST_APRON - 1, CAP_SETTINGS)
      ).toBe('Below Aprons');
    });
  });

  describe('faExceptionUtils.canUseFaException (consolidated)', () => {
    const mockBucket = {
      type: 'NTMLE',
      remaining: 5_000_000,
      expiresAt: null,
    };

    const buildTeamCtx = (salary, capSettingsOverride = CAP_SETTINGS) => ({
      teamTotalSalary: salary,
      teamSeasonState: { faExceptionBuckets: [mockBucket] },
      context: { capSettings: capSettingsOverride },
    });

    it('blocks at first apron (uses >= for first apron)', () => {
      // Exactly at first apron should block
      expect(
        canUseFaException(buildTeamCtx(EXACTLY_AT_FIRST_APRON), 'NTMLE')
      ).toBe(false);
      // Just below first apron should allow
      expect(canUseFaException(buildTeamCtx(BELOW_FIRST_APRON), 'NTMLE')).toBe(
        true
      );
    });

    it('blocks at second apron (uses > for second apron)', () => {
      // Above second apron should block
      expect(canUseFaException(buildTeamCtx(ABOVE_SECOND_APRON), 'NTMLE')).toBe(
        false
      );
      // Exactly at second apron - still blocked by first apron check
      expect(
        canUseFaException(buildTeamCtx(EXACTLY_AT_SECOND_APRON), 'NTMLE')
      ).toBe(false);
    });

    it('allows usage under first apron', () => {
      expect(canUseFaException(buildTeamCtx(UNDER_CAP), 'NTMLE')).toBe(true);
      expect(canUseFaException(buildTeamCtx(BELOW_FIRST_APRON), 'NTMLE')).toBe(
        true
      );
    });

    it('skips second apron check when secondApron not defined (guards with threshold existence)', () => {
      // When secondApron is undefined, only firstApron check applies
      const capSettingsNoSecond = { ...CAP_SETTINGS, secondApron: undefined };
      // Salary above where second apron would be, but no second apron defined
      expect(
        canUseFaException(
          buildTeamCtx(ABOVE_SECOND_APRON, capSettingsNoSecond),
          'NTMLE'
        )
      ).toBe(false);
      // Still blocked by first apron
    });

    it('skips first apron check when firstApron not defined (guards with threshold existence)', () => {
      // When firstApron is undefined, only secondApron check applies
      const capSettingsNoFirst = { ...CAP_SETTINGS, firstApron: undefined };
      // Exactly at second apron should allow (190 is NOT > 190)
      expect(
        canUseFaException(
          buildTeamCtx(EXACTLY_AT_SECOND_APRON, capSettingsNoFirst),
          'NTMLE'
        )
      ).toBe(true);
      // Above second apron should block
      expect(
        canUseFaException(
          buildTeamCtx(ABOVE_SECOND_APRON, capSettingsNoFirst),
          'NTMLE'
        )
      ).toBe(false);
    });
  });

  describe('Boundary Drift Prevention', () => {
    it('all consolidated sites agree on second apron boundary', () => {
      // All should treat exactly-at-second-apron as NOT second apron
      const exactlyAtSecond = EXACTLY_AT_SECOND_APRON;
      const justAboveSecond = EXACTLY_AT_SECOND_APRON + 1;

      // SSOT
      expect(
        getTeamApronStatus({ totalSalary: exactlyAtSecond }, CAP_SETTINGS)
      ).not.toBe('SECOND_APRON');
      expect(
        getTeamApronStatus({ totalSalary: justAboveSecond }, CAP_SETTINGS)
      ).toBe('SECOND_APRON');

      // Legacy capUtils
      expect(getLegacyApronStatus(exactlyAtSecond, CAP_SETTINGS)).not.toBe(
        'ABOVE_SECOND_APRON'
      );
      expect(getLegacyApronStatus(justAboveSecond, CAP_SETTINGS)).toBe(
        'ABOVE_SECOND_APRON'
      );

      // tradeHelpers
      expect(
        getTradeHelpersApronStatus(exactlyAtSecond, CAP_SETTINGS)
      ).not.toBe('2nd Apron');
      expect(getTradeHelpersApronStatus(justAboveSecond, CAP_SETTINGS)).toBe(
        '2nd Apron'
      );
    });

    it('all consolidated sites agree on first apron boundary', () => {
      // All should treat exactly-at-first-apron as first apron (inclusive)
      const exactlyAtFirst = EXACTLY_AT_FIRST_APRON;
      const justBelowFirst = EXACTLY_AT_FIRST_APRON - 1;

      // SSOT
      expect(
        getTeamApronStatus({ totalSalary: exactlyAtFirst }, CAP_SETTINGS)
      ).toBe('FIRST_APRON');
      expect(
        getTeamApronStatus({ totalSalary: justBelowFirst }, CAP_SETTINGS)
      ).toBe('OVER_CAP');

      // Legacy capUtils
      expect(getLegacyApronStatus(exactlyAtFirst, CAP_SETTINGS)).toBe(
        'ABOVE_FIRST_APRON'
      );
      expect(getLegacyApronStatus(justBelowFirst, CAP_SETTINGS)).not.toBe(
        'ABOVE_FIRST_APRON'
      );

      // tradeHelpers
      expect(getTradeHelpersApronStatus(exactlyAtFirst, CAP_SETTINGS)).toBe(
        '1st Apron'
      );
      expect(getTradeHelpersApronStatus(justBelowFirst, CAP_SETTINGS)).toBe(
        'Below Aprons'
      );
    });
  });
});
