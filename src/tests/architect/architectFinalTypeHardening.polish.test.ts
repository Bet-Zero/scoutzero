/**
 * FILE: src/tests/architect/architectFinalTypeHardening.polish.test.ts
 * PURPOSE: Narrow regression proof for the final Architect type-hardening polish pass.
 * Covers the exported pure helper surfaces and typed cache contract tightened in this lane.
 * OWNERSHIP: Feature: architect/ts-hardening
 */

import { describe, expect, it } from 'vitest';
import {
  deriveSigningMechanism,
  ensureContractStructure,
} from '@/features/architect/GMDashboard/hooks/useArchitectActions';
import { mergeWorldPlayerOverride } from '@/features/architect/GMDashboard/hooks/useArchitectState';
import { ValidationCacheManager } from '@/features/architect/utils/tradeMachine/cache/validationCacheService';
import { normalizeContractActionResult } from '@/shared/components/EditContractModal';

describe('Architect final type hardening polish regression', () => {
  it('canonicalizes legacy contract salary arrays into salariesByYear rows', () => {
    const contract = ensureContractStructure({
      salaries: [12_000_000, '13500000', { salary: '14999999.6' }],
      years: 2,
      startYear: 2026,
      contractType: 'Standard',
    });

    expect(contract).not.toBeNull();
    expect(contract?.salariesByYear).toEqual([
      {
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
        guaranteed: true,
        guaranteedAmount: 12_000_000,
        option: null,
        optionType: null,
        optionUsed: null,
      },
      {
        season: '2026-27',
        salary: 13_500_000,
        capHit: 13_500_000,
        guaranteed: true,
        guaranteedAmount: 13_500_000,
        option: null,
        optionType: null,
        optionUsed: null,
      },
    ]);
  });

  it('derives signing mechanism from signedUsing or exceptionType and ignores None', () => {
    expect(
      deriveSigningMechanism({
        signedUsing: '  Non-Taxpayer MLE  ',
      })
    ).toBe('Non-Taxpayer MLE');
    expect(
      deriveSigningMechanism({
        exceptionType: 'Bi-Annual Exception',
      })
    ).toBe('Bi-Annual Exception');
    expect(
      deriveSigningMechanism({
        signedUsing: 'None',
      })
    ).toBeNull();
  });

  it('merges world player overrides without dropping base contract or bio fields', () => {
    const merged = mergeWorldPlayerOverride(
      {
        id: 'player_1',
        teamCode: 'LAL',
        contract: {
          contractType: 'Standard',
          signingTeam: 'LAL',
          salariesByYear: [
            {
              season: '2025-26',
              salary: 8_000_000,
              capHit: 8_000_000,
              guaranteed: true,
            },
          ],
        },
        bio: {
          displayName: 'Base Name',
          playerId: 'player_1',
        },
      },
      {
        id: 'player_1',
        contract: {
          signedUsing: 'Room MLE',
        },
        bio: {
          displayName: 'Override Name',
        },
      }
    );

    expect(merged.contract).toMatchObject({
      contractType: 'Standard',
      signingTeam: 'LAL',
      signedUsing: 'Room MLE',
    });
    expect(merged.bio).toMatchObject({
      displayName: 'Override Name',
      playerId: 'player_1',
    });
    expect(merged.teamCode).toBe('LAL');
  });

  it('stores, retrieves, reports metrics, and invalidates typed cache entries', () => {
    const cache = new ValidationCacheManager();

    expect(cache.getCachedResult<{ legal: boolean }>('missing-key')).toBeNull();

    cache.cacheResult('salary-match-key', {
      legal: true,
      allowableIncoming: 18_000_000,
    });

    expect(
      cache.getCachedResult<{
        legal: boolean;
        allowableIncoming: number;
      }>('salary-match-key')
    ).toEqual({
      legal: true,
      allowableIncoming: 18_000_000,
    });

    expect(cache.getMetrics()).toMatchObject({
      hits: 1,
      misses: 1,
      invalidations: 0,
      size: 1,
    });

    cache.invalidateCache();

    expect(cache.getMetrics()).toMatchObject({
      invalidations: 1,
      size: 0,
    });
  });

  it('preserves persisted-write gating when normalizing contract action results', () => {
    expect(
      normalizeContractActionResult({
        success: true,
        appliedToLocalState: true,
        persistedToWorld: true,
        writesSummary: {
          eventsWritten: 1,
          worldMetadataPatched: 1,
          teamsPatched: 1,
        },
      })
    ).toEqual({
      success: true,
      message: '',
    });

    expect(
      normalizeContractActionResult({
        success: true,
        appliedToLocalState: true,
        persistedToWorld: true,
        writesSummary: {
          eventsWritten: 1,
          worldMetadataPatched: 1,
          teamsPatched: 0,
        },
      })
    ).toEqual({
      success: false,
      message: 'Action did not complete required save writes.',
    });
  });
});
