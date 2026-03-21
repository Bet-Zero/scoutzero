/**
 * FILE: src/tests/architect/architectHardening.polish.test.ts
 * PURPOSE: Narrow regression proof for the TS hardening pass.
 * Validates that hardened parser/validator/helper surfaces still return the same runtime shapes.
 * OWNERSHIP: Feature: architect/ts-hardening
 */

import { describe, expect, it } from 'vitest';
import { parseContractSituation } from '@/shared/utils/contracts/contractParser';

describe('Architect TypeScript hardening regression', () => {
  describe('contractParser — option normalization', () => {
    it('returns PO for player-option variations', () => {
      const result = parseContractSituation(
        {
          playerId: 'opt-po',
          contract: {
            startSeason: '2025-26',
            endSeason: '2025-26',
            salariesByYear: [
              { season: '2025-26', salary: 5000000, guaranteed: true, option: 'Player Option' },
            ],
          },
        },
        '2025-26'
      );
      expect(result.contracts[0].salariesByYear[0].option).toBe('PO');
    });

    it('returns TO for team-option variations', () => {
      const result = parseContractSituation(
        {
          playerId: 'opt-to',
          contract: {
            startSeason: '2025-26',
            endSeason: '2025-26',
            salariesByYear: [
              { season: '2025-26', salary: 5000000, guaranteed: true, option: 'TO' },
            ],
          },
        },
        '2025-26'
      );
      expect(result.contracts[0].salariesByYear[0].option).toBe('TO');
    });

    it('returns null for unrecognized option strings', () => {
      const result = parseContractSituation(
        {
          playerId: 'opt-null',
          contract: {
            startSeason: '2025-26',
            endSeason: '2025-26',
            salariesByYear: [
              { season: '2025-26', salary: 5000000, guaranteed: true, option: 'Unknown' },
            ],
          },
        },
        '2025-26'
      );
      expect(result.contracts[0].salariesByYear[0].option).toBe(null);
    });
  });

  describe('contractParser — signing method normalization', () => {
    it('normalizes MLE variations to Mid-Level Exception', () => {
      const result = parseContractSituation(
        {
          playerId: 'mle-test',
          contract: {
            startSeason: '2025-26',
            endSeason: '2025-26',
            signedUsing: 'mid-level exception',
            salariesByYear: [
              { season: '2025-26', salary: 5000000, guaranteed: true, option: null },
            ],
          },
        },
        '2025-26'
      );
      expect(result.contracts[0].signedUsing).toBe('Mid-Level Exception');
    });

    it('normalizes Bird exception variations', () => {
      const result = parseContractSituation(
        {
          playerId: 'bird-test',
          contract: {
            startSeason: '2025-26',
            endSeason: '2025-26',
            signedUsing: 'Early Bird Rights',
            salariesByYear: [
              { season: '2025-26', salary: 5000000, guaranteed: true, option: null },
            ],
          },
        },
        '2025-26'
      );
      expect(result.contracts[0].signedUsing).toBe('Early Bird Exception');
    });
  });

  describe('contractParser — signing date normalization', () => {
    it('preserves ISO dates', () => {
      const result = parseContractSituation(
        {
          playerId: 'date-iso',
          contract: {
            startSeason: '2025-26',
            endSeason: '2025-26',
            signingDate: '2025-07-01',
            salariesByYear: [
              { season: '2025-26', salary: 5000000, guaranteed: true, option: null },
            ],
          },
        },
        '2025-26'
      );
      expect(result.contracts[0].signingDate).toBe('2025-07-01');
    });

    it('returns null for unparseable dates', () => {
      const result = parseContractSituation(
        {
          playerId: 'date-bad',
          contract: {
            startSeason: '2025-26',
            endSeason: '2025-26',
            signingDate: 'not-a-date-at-all-really',
            salariesByYear: [
              { season: '2025-26', salary: 5000000, guaranteed: true, option: null },
            ],
          },
        },
        '2025-26'
      );
      expect(result.contracts[0].signingDate).toBe(null);
    });
  });

  describe('contractParser — max contract detection', () => {
    it('detects 30% tier max with computed basis', () => {
      const result = parseContractSituation(
        {
          playerId: 'max-30',
          contract: {
            startSeason: '2025-26',
            endSeason: '2027-28',
            salariesByYear: [
              { season: '2025-26', salary: 42000000, guaranteed: true, option: null },
              { season: '2026-27', salary: 44100000, guaranteed: true, option: null },
              { season: '2027-28', salary: 46300000, guaranteed: true, option: null },
            ],
          },
        },
        '2025-26',
        { leagueCaps: { '2025-26': 140000000 } }
      );
      expect(result.contracts[0].max.isMax).toBe(true);
      expect(result.contracts[0].max.tierPercent).toBe(30);
      expect(result.contracts[0].max.basis).toBe('computed');
    });

    it('returns isMax false when no cap data available', () => {
      const result = parseContractSituation(
        {
          playerId: 'max-none',
          contract: {
            startSeason: '2025-26',
            endSeason: '2025-26',
            salariesByYear: [
              { season: '2025-26', salary: 42000000, guaranteed: true, option: null },
            ],
          },
        },
        '2025-26'
      );
      expect(result.contracts[0].max.isMax).toBe(false);
      expect(result.contracts[0].max.basis).toBe('unknown');
    });
  });

  describe('contractParser — season input handling', () => {
    it('accepts numeric season input', () => {
      const result = parseContractSituation(
        {
          playerId: 'numeric-season',
          contract: {
            startSeason: 2025,
            endSeason: 2027,
            salariesByYear: [
              { season: 2025, salary: 5000000, guaranteed: true, option: null },
            ],
          },
        },
        2025
      );
      expect(result.currentSeason).toBe('2025-26');
      expect(result.contracts[0].startSeason).toBe('2025-26');
    });

    it('returns stable shape with empty input', () => {
      const result = parseContractSituation({}, null);
      expect(result).toEqual({
        playerId: undefined,
        currentSeason: null,
        contracts: [],
      });
    });
  });

  describe('contractParser — extension linking', () => {
    it('links extension to its base contract', () => {
      const result = parseContractSituation(
        {
          playerId: 'ext-link',
          contracts: [
            {
              startSeason: '2023-24',
              endSeason: '2025-26',
              isExtension: false,
              salariesByYear: [
                { season: '2023-24', salary: 10000000, guaranteed: true, option: null },
                { season: '2024-25', salary: 10500000, guaranteed: true, option: null },
                { season: '2025-26', salary: 11000000, guaranteed: true, option: null },
              ],
            },
            {
              startSeason: '2026-27',
              endSeason: '2028-29',
              isExtension: true,
              salariesByYear: [
                { season: '2026-27', salary: 12000000, guaranteed: true, option: null },
                { season: '2027-28', salary: 12600000, guaranteed: true, option: null },
                { season: '2028-29', salary: 13200000, guaranteed: true, option: null },
              ],
            },
          ],
        },
        '2025-26'
      );

      const [base, ext] = result.contracts;
      expect(base.kind).toBe('std');
      expect(ext.kind).toBe('ext');
      expect(ext.extensionOf).toBe(base.docId);
      expect(base.extendedBy).toBe(ext.docId);
      expect(base.contractGroupId).toBe(base.docId);
      expect(ext.contractGroupId).toBe(base.docId);
    });
  });
});
