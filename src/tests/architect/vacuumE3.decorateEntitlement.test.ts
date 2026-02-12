/**
 * FILE: src/tests/architect/vacuumE3.decorateEntitlement.test.ts
 * PURPOSE: TM-VACUUM-E3 — Verify decorateEntitlementForTrade strips vacuum metadata.
 *
 * HISTORY:
 *  - 2026-02-12: Created for TM-VACUUM-E3 sanitization validation.
 */

import { describe, it, expect } from 'vitest';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';

describe('decorateEntitlementForTrade — vacuum metadata sanitization', () => {
  it('strips __vacuumEdited from payload', () => {
    const ent = {
      id: 'ent:BOS:2027:1:own:abc',
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'pick_ownership',
      __vacuumEdited: true,
    };
    const result = decorateEntitlementForTrade(ent);
    expect(result).not.toHaveProperty('__vacuumEdited');
    expect(result).toHaveProperty('id', 'ent:BOS:2027:1:own:abc');
    expect(result).toHaveProperty('draftKey');
  });

  it('strips __vacuumSessionOnly from payload', () => {
    const ent = {
      id: 'vacuum:BOS:2028:1:own:abcd1234',
      holderTeam: 'BOS',
      seasonYear: 2028,
      round: 1,
      kind: 'pick_ownership',
      __vacuumSessionOnly: true,
    };
    const result = decorateEntitlementForTrade(ent);
    expect(result).not.toHaveProperty('__vacuumSessionOnly');
    expect(result).toHaveProperty('id', 'vacuum:BOS:2028:1:own:abcd1234');
  });

  it('strips both vacuum keys simultaneously', () => {
    const ent = {
      id: 'test',
      holderTeam: 'LAL',
      seasonYear: 2027,
      round: 1,
      kind: 'swap_right',
      __vacuumEdited: true,
      __vacuumSessionOnly: true,
    };
    const result = decorateEntitlementForTrade(ent);
    expect(result).not.toHaveProperty('__vacuumEdited');
    expect(result).not.toHaveProperty('__vacuumSessionOnly');
    expect(result).toHaveProperty('holderTeam', 'LAL');
  });

  it('preserves all non-vacuum fields', () => {
    const ent = {
      id: 'ent:BOS:2027:1:own:abc',
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'pick_ownership',
      description: 'test entitlement',
      underlyingPickId: 'pick:BOS:2027:1',
      __vacuumEdited: true,
    };
    const result = decorateEntitlementForTrade(ent);
    expect(result).toHaveProperty('description', 'test entitlement');
    expect(result).toHaveProperty('underlyingPickId', 'pick:BOS:2027:1');
    expect(result).toHaveProperty('terms');
    expect(result).toHaveProperty('termsShort');
  });

  it('returns null/undefined unchanged', () => {
    expect(decorateEntitlementForTrade(null)).toBeNull();
    expect(decorateEntitlementForTrade(undefined)).toBeUndefined();
  });
});
