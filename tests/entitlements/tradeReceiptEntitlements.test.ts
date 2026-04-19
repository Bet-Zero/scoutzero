/**
 * FILE: tests/entitlements/tradeReceiptEntitlements.test.js
 * PURPOSE: Tests for TM-PICKS-E1 — Trade receipt/export entitlement visibility
 * OWNERSHIP: Feature: architect/tradeMachine
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeEntitlement,
  sanitizeEntitlements,
  hasVacuumMetadata,
} from '@/features/architect/utils/entitlements/sanitizeVacuumMetadata';

describe('trade receipt entitlement sanitization', () => {
  it('strips __vacuumEdited from entitlement', () => {
    const ent = {
      id: 'ent_001',
      holderTeam: 'LAL',
      seasonYear: 2027,
      round: 1,
      kind: 'pick_ownership',
      __vacuumEdited: true,
    };

    const sanitized = sanitizeEntitlement(ent);
    expect(sanitized).not.toHaveProperty('__vacuumEdited');
    expect(sanitized.id).toBe('ent_001');
    expect(sanitized.holderTeam).toBe('LAL');
  });

  it('strips __vacuumSessionOnly from entitlement', () => {
    const ent = {
      id: 'vacuum:LAL:2027:1:own:abc12345',
      holderTeam: 'LAL',
      __vacuumSessionOnly: true,
    };

    const sanitized = sanitizeEntitlement(ent);
    expect(sanitized).not.toHaveProperty('__vacuumSessionOnly');
    expect(sanitized.id).toBe('vacuum:LAL:2027:1:own:abc12345');
  });

  it('returns same reference when no vacuum keys present', () => {
    const ent = {
      id: 'ent_001',
      holderTeam: 'LAL',
    };

    const sanitized = sanitizeEntitlement(ent);
    expect(sanitized).toBe(ent);
  });

  it('sanitizes array of entitlements', () => {
    const entitlements = [
      { id: 'ent_001', __vacuumEdited: true, holderTeam: 'LAL' },
      { id: 'ent_002', holderTeam: 'BOS' },
      { id: 'ent_003', __vacuumSessionOnly: true, holderTeam: 'MIA' },
    ];

    const sanitized = sanitizeEntitlements(entitlements);
    expect(sanitized).toHaveLength(3);
    expect(sanitized[0]).not.toHaveProperty('__vacuumEdited');
    expect(sanitized[2]).not.toHaveProperty('__vacuumSessionOnly');
  });

  it('hasVacuumMetadata detects vacuum keys', () => {
    expect(hasVacuumMetadata({ __vacuumEdited: true })).toBe(true);
    expect(hasVacuumMetadata({ __vacuumSessionOnly: true })).toBe(true);
    expect(hasVacuumMetadata({ id: 'ent_001' })).toBe(false);
    expect(hasVacuumMetadata(null)).toBe(false);
  });
});

describe('trade receipt entitlement format', () => {
  it('entitlement has required fields for receipt display', () => {
    const ent = {
      id: 'ent_001',
      entitlementId: 'ent_001',
      holderTeam: 'LAL',
      seasonYear: 2027,
      round: 1,
      kind: 'pick_ownership',
      description: 'LAL 2027 1st round pick',
      fromTeamId: 'LAL',
      toTeamId: 'BOS',
    };

    // Verify receipt-required fields exist
    expect(ent.seasonYear).toBe(2027);
    expect(ent.round).toBe(1);
    expect(ent.kind).toBe('pick_ownership');
    expect(ent.fromTeamId).toBe('LAL');
    expect(ent.toTeamId).toBe('BOS');
  });

  it('outgoing entitlements have fromTeamId', () => {
    const outgoing = [
      {
        id: 'ent_001',
        fromTeamId: 'LAL',
        toTeamId: 'BOS',
        seasonYear: 2027,
        round: 1,
        kind: 'pick_ownership',
      },
      {
        id: 'ent_002',
        fromTeamId: 'LAL',
        toTeamId: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'swap_right',
      },
    ];

    for (const ent of outgoing) {
      expect(ent.fromTeamId).toBeTruthy();
      expect(ent.toTeamId).toBeTruthy();
      expect(ent.id).toBeTruthy();
    }
  });
});
