/**
 * Tests for TPE Expiration Logic (Phase 1)
 *
 * Verifies that processTradeExceptions correctly identifies active and expired TPEs
 * relative to season boundaries.
 *
 * @file src/tests/architect/utils/seasonManager.tpe.test.js
 */

import { describe, it, expect } from 'vitest';
import { processTradeExceptions } from '@/features/architect/utils/tpeLifecycle';
import { createTPE } from '@/features/architect/utils/tradeMachine/utils/tpeValidation.js';

describe('TPE Expiration Lifecycle', () => {
  // Test Context: Transitioning to 2026-27 season
  // Boundary: July 1, 2026
  const TO_SEASON = '2026-27';
  const BOUNDARY_DATE_ISO = '2026-07-01T00:00:00.000Z'; // Approximate via UTC

  it('removes TPEs expiring before the season start boundary (July 1)', () => {
    const expiredTPE = {
      id: 'tpe1',
      amount: 1000000,
      expiresOn: '2026-06-30T23:59:59Z', // Just before July 1
    };
    
    // Also test with legacy expiryISO
    const expiredLegacyTPE = {
      id: 'tpe2',
      amount: 2000000,
      expiryISO: '2026-02-15T00:00:00Z',
    };

    const tradeExceptions = [expiredTPE, expiredLegacyTPE];
    const result = processTradeExceptions(tradeExceptions, TO_SEASON);

    expect(result.hasChanges).toBe(true);
    expect(result.expiredTPEs).toHaveLength(2);
    expect(result.activeTPEs).toHaveLength(0);
    expect(result.expiredTPEs[0].id).toBe('tpe1');
    expect(result.expiredTPEs[1].id).toBe('tpe2');
  });

  it('keeps TPEs expiring on or after season start boundary', () => {
    const activeTPE = {
      id: 'tpe3',
      amount: 3000000,
      expiresOn: '2026-07-02T00:00:00Z', // After July 1
    };

    const boundaryTPE = {
      id: 'tpe4',
      amount: 4000000,
      expiresOn: '2026-07-01T00:00:00.000Z', // Exactly on boundary (should keep?)
      // Plan: "Treat a TPE as expired if expiryDate < seasonStartBoundary"
      // So expiry == boundary should NOT be expired.
    };
    
    const futureTPE = {
      id: 'tpe5',
      amount: 5000000,
      expiryISO: '2027-02-10T00:00:00Z', // Next year
    };

    const tradeExceptions = [activeTPE, boundaryTPE, futureTPE];
    const result = processTradeExceptions(tradeExceptions, TO_SEASON);

    expect(result.hasChanges).toBe(true); // True because of backfill logic for futureTPE (expiryISO -> expiresOn)
    expect(result.activeTPEs).toHaveLength(3);
    expect(result.expiredTPEs).toHaveLength(0);
  });

  it('handles mixed list of active and expired TPEs', () => {
    const expired = { id: 'expired', expiresOn: '2026-06-01T00:00:00Z' };
    const active = { id: 'active', expiresOn: '2026-08-01T00:00:00Z' };

    const result = processTradeExceptions([expired, active], TO_SEASON);

    expect(result.hasChanges).toBe(true);
    expect(result.activeTPEs).toHaveLength(1);
    expect(result.activeTPEs[0].id).toBe('active');
    expect(result.expiredTPEs).toHaveLength(1);
    expect(result.expiredTPEs[0].id).toBe('expired');
  });

  it('handles invalid or missing expiry dates safely (preserves them)', () => {
    const noDate = { id: 'noDate', amount: 100 };
    const invalidDate = { id: 'invalid', expiresOn: 'invalid-date' };

    const result = processTradeExceptions([noDate, invalidDate], TO_SEASON);

    expect(result.hasChanges).toBe(false);
    expect(result.expiredTPEs).toHaveLength(0);
  });

  it('backfills expiresOn field for legacy TPEs that are still active', () => {
    const legacyTPE = {
      id: 'legacyActive',
      amount: 5000000,
      expiryISO: '2027-02-10T00:00:00Z', // Active (future)
    };

    const result = processTradeExceptions([legacyTPE], TO_SEASON);

    expect(result.hasChanges).toBe(true); // Should trigger save due to backfill
    expect(result.activeTPEs).toHaveLength(1);
    expect(result.activeTPEs[0].expiresOn).toBe(legacyTPE.expiryISO);
    expect(result.activeTPEs[0].expiryISO).toBe(legacyTPE.expiryISO); // Preserves original
  });

  it('prioritizes expiresOn over expiryISO if both exist', () => {
    // TPE with conflicting dates
    // expiresOn says active (after boundary), expiryISO says expired (before boundary)
    const conflictingTPE = {
      id: 'conflict',
      amount: 1000000,
      expiresOn: '2026-07-02T00:00:00Z', // Active (July 2)
      expiryISO: '2026-06-01T00:00:00Z', // Expired (June 1)
    };

    const result = processTradeExceptions([conflictingTPE], TO_SEASON);

    expect(result.activeTPEs).toHaveLength(1);
    expect(result.activeTPEs[0].id).toBe('conflict');
    expect(result.expiredTPEs).toHaveLength(0);
  });
});

describe('TPE Schema Hygiene', () => {
  it('createTPE produces only expiresOn field (Phase 2)', () => {
    const tradeDate = '2025-10-01';
    const teamCtx = { isOverCap: true };
    const outgoing = 10000000;
    const incoming = 5000000;

    const tpe = createTPE({ teamCtx, outgoing, incoming, tradeDate });
    
    expect(tpe).not.toBeNull();
    expect(tpe.expiresOn).toBeDefined();
    expect(tpe.expiryISO).toBeUndefined(); // Phase 2: Removed
    // expect(tpe.expiresOn).toBe(tpe.expiryISO); // Removed
    
    // Check it is 1 year later
    const expectedYear = 2026;
    expect(new Date(tpe.expiresOn).getUTCFullYear()).toBe(expectedYear);
  });
});
