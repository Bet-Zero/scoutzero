/**
 * FILE: src/tests/architect/tradeEntitlementRouting.test.ts
 * PURPOSE: Tests for buildEntitlementRoutingMap — explicit entitlement routing
 *          map builder that eliminates silent skips in multi-team trades.
 * OWNERSHIP: Test suite (TM-EXCL-E2: No Silent Skips)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E2 execution.
 */

import { describe, it, expect } from 'vitest';
import { buildEntitlementRoutingMap } from '@/features/architect/utils/tradeMachine/utils/buildEntitlementRoutingMap';
import {
  validateEntitlementLinkageLegality,
} from '@/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeTeamSlot(
  teamId: string,
  entitlementsOut: Array<{
    id: string;
    toTeamId?: string | null;
    [key: string]: unknown;
  }> = []
) {
  return {
    teamId,
    team: { id: teamId, teamCode: teamId },
    entitlementsOut: entitlementsOut.map((e) => ({
      entitlementId: e.id,
      ...e,
    })),
  };
}

function makeTradeTeamSlot(
  teamCode: string,
  options: {
    entitlementsOut?: Array<Record<string, unknown>>;
    validationEntitlements?: Array<Record<string, unknown>>;
    entitlementIds?: string[];
  } = {}
) {
  const entitlementsOut = options.entitlementsOut || [];
  const entitlementIds =
    options.entitlementIds ||
    entitlementsOut
      .map((entitlement) =>
        (entitlement.entitlementId as string) || (entitlement.id as string)
      )
      .filter(Boolean);

  return {
    teamId: teamCode,
    team: {
      id: teamCode,
      teamId: teamCode,
      teamCode,
      teamName: teamCode,
      totalSalary: 100_000_000,
      teamTotalSalary: 100_000_000,
      entitlementIds,
    },
    sends: [],
    receives: [],
    entitlementsOut,
    validationEntitlements: options.validationEntitlements || [],
    teamTotalSalary: 100_000_000,
    projectedSalary: 100_000_000,
    salaryOut: 0,
    salaryIn: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2-team trades: auto-routing
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildEntitlementRoutingMap: 2-team trades', () => {
  it('auto-resolves toTeamId for 2-team trades', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1' }]),
      makeTeamSlot('BOS', [{ id: 'ent-2' }]),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.map.get('LAL::ent-1')).toBe('BOS');
    expect(result.map.get('BOS::ent-2')).toBe('LAL');
    expect(result.entries).toHaveLength(2);
  });

  it('succeeds with explicit toTeamId in 2-team trade', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1', toTeamId: 'BOS' }]),
      makeTeamSlot('BOS', []),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.map.get('LAL::ent-1')).toBe('BOS');
  });

  it('succeeds when no entitlements are being traded', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', []),
      makeTeamSlot('BOS', []),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.map.size).toBe(0);
    expect(result.entries).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3-team trades: explicit routing required
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildEntitlementRoutingMap: 3-team trades', () => {
  it('builds routing map for 3-team cycle trade', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1', toTeamId: 'BOS' }]),
      makeTeamSlot('BOS', [{ id: 'ent-2', toTeamId: 'CHI' }]),
      makeTeamSlot('CHI', [{ id: 'ent-3', toTeamId: 'LAL' }]),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.map.get('LAL::ent-1')).toBe('BOS');
    expect(result.map.get('BOS::ent-2')).toBe('CHI');
    expect(result.map.get('CHI::ent-3')).toBe('LAL');
    expect(result.entries).toHaveLength(3);
  });

  it('builds multi-entitlement routing map', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [
        { id: 'ent-1', toTeamId: 'BOS' },
        { id: 'ent-2', toTeamId: 'CHI' },
      ]),
      makeTeamSlot('BOS', [{ id: 'ent-3', toTeamId: 'LAL' }]),
      makeTeamSlot('CHI', []),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.map.get('LAL::ent-1')).toBe('BOS');
    expect(result.map.get('LAL::ent-2')).toBe('CHI');
    expect(result.map.get('BOS::ent-3')).toBe('LAL');
    expect(result.entries).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Failure cases: missing destination
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildEntitlementRoutingMap: missing destination', () => {
  it('fails when 3-team trade has entitlement with no toTeamId', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1' }]), // No toTeamId!
      makeTeamSlot('BOS', [{ id: 'ent-2', toTeamId: 'CHI' }]),
      makeTeamSlot('CHI', []),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const failure = result as { reason: string; errors: string[] };

    expect(failure.reason).toContain('Entitlement routing incomplete');
    expect(failure.errors).toHaveLength(1);
    expect(failure.errors[0]).toContain('ent-1');
    expect(failure.errors[0]).toContain('no destination team');
  });

  it('fails when multiple entitlements lack routing in 3-team trade', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1' }]),
      makeTeamSlot('BOS', [{ id: 'ent-2' }]),
      makeTeamSlot('CHI', [{ id: 'ent-3', toTeamId: 'LAL' }]),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const failure = result as { errors: string[] };

    expect(failure.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Failure cases: duplicate routing (same entitlement from two teams)
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildEntitlementRoutingMap: routing conflicts', () => {
  it('fails when same entitlement appears in two teams outgoing', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1', toTeamId: 'CHI' }]),
      makeTeamSlot('BOS', [{ id: 'ent-1', toTeamId: 'CHI' }]), // Duplicate!
      makeTeamSlot('CHI', []),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const failure = result as { errors: string[] };

    expect(failure.errors[0]).toContain('Routing conflict');
    expect(failure.errors[0]).toContain('ent-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Failure cases: invalid destination
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildEntitlementRoutingMap: invalid destination', () => {
  it('fails when toTeamId references team not in the trade', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1', toTeamId: 'MIA' }]), // MIA not in trade
      makeTeamSlot('BOS', []),
      makeTeamSlot('CHI', []),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const failure = result as { errors: string[] };

    expect(failure.errors[0]).toContain('not in trade');
  });

  it('fails when toTeamId equals fromTeamId', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1', toTeamId: 'LAL' }]), // Self-routing
      makeTeamSlot('BOS', []),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const failure = result as { errors: string[] };

    expect(failure.errors[0]).toContain('cannot be routed to the same team');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildEntitlementRoutingMap: edge cases', () => {
  it('returns ok for empty teams array', () => {
    const result = buildEntitlementRoutingMap([]);
    expect(result.ok).toBe(true);
  });

  it('returns ok for single team (no trade)', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1' }]),
    ]);
    expect(result.ok).toBe(true);
  });

  it('handles teams without team object (inactive slots)', () => {
    const result = buildEntitlementRoutingMap([
      makeTeamSlot('LAL', [{ id: 'ent-1' }]),
      { entitlementsOut: [] } as any, // No team selected
      makeTeamSlot('BOS', []),
    ]);

    // Only 2 active slots → auto-resolve works
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2 linkage legality rules
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateEntitlementLinkageLegality: E2 blocking rules', () => {
  it('rejects outgoing entitlement when linkedEntitlementIds contains missing ids', () => {
    const result = validateEntitlementLinkageLegality({
      teams: [
        makeTradeTeamSlot('LAL', {
          entitlementsOut: [
            {
              id: 'ent-LAL-A',
              entitlementId: 'ent-LAL-A',
              linkedEntitlementIds: ['ent-missing'],
            },
          ],
        }),
        makeTradeTeamSlot('BOS'),
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' | ')).toContain('missing linked references');
  });

  it('rejects outgoing entitlement when residualOfEntitlementId is missing', () => {
    const result = validateEntitlementLinkageLegality({
      teams: [
        makeTradeTeamSlot('LAL', {
          entitlementsOut: [
            {
              id: 'ent-LAL-A',
              entitlementId: 'ent-LAL-A',
              residualOfEntitlementId: 'ent-missing-residual',
            },
          ],
        }),
        makeTradeTeamSlot('BOS'),
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' | ')).toContain('missing residual reference');
  });

  it('rejects partial linked-package trades', () => {
    const linkedPackage = [
      {
        id: 'ent-LAL-A',
        entitlementId: 'ent-LAL-A',
        linkedEntitlementIds: ['ent-LAL-B'],
      },
      {
        id: 'ent-LAL-B',
        entitlementId: 'ent-LAL-B',
      },
    ];

    const result = validateEntitlementLinkageLegality({
      teams: [
        makeTradeTeamSlot('LAL', {
          entitlementsOut: [linkedPackage[0]],
          validationEntitlements: linkedPackage,
          entitlementIds: ['ent-LAL-A', 'ent-LAL-B'],
        }),
        makeTradeTeamSlot('BOS'),
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' | ')).toContain('complete linked package');
  });

  it('passes when linked package is complete in same trade', () => {
    const linkedPackage = [
      {
        id: 'ent-LAL-A',
        entitlementId: 'ent-LAL-A',
        linkedEntitlementIds: ['ent-LAL-B'],
      },
      {
        id: 'ent-LAL-B',
        entitlementId: 'ent-LAL-B',
      },
    ];

    const result = validateEntitlementLinkageLegality({
      teams: [
        makeTradeTeamSlot('LAL', {
          entitlementsOut: linkedPackage,
          validationEntitlements: linkedPackage,
          entitlementIds: ['ent-LAL-A', 'ent-LAL-B'],
        }),
        makeTradeTeamSlot('BOS'),
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validateTrade returns ENTITLEMENT_LINKAGE_ERROR for illegal linked package movement', () => {
    const result = validateTrade({
      teams: [
        makeTradeTeamSlot('LAL', {
          entitlementsOut: [
            {
              id: 'ent-LAL-A',
              entitlementId: 'ent-LAL-A',
              linkedEntitlementIds: ['ent-LAL-B'],
            },
          ],
          validationEntitlements: [
            {
              id: 'ent-LAL-A',
              entitlementId: 'ent-LAL-A',
              linkedEntitlementIds: ['ent-LAL-B'],
            },
            {
              id: 'ent-LAL-B',
              entitlementId: 'ent-LAL-B',
            },
          ],
          entitlementIds: ['ent-LAL-A', 'ent-LAL-B'],
        }),
        makeTradeTeamSlot('BOS'),
      ],
      capProjections: {},
      currentYear: 2026,
    });

    expect(result.legal).toBe(false);
    expect(result.error).toBe('ENTITLEMENT_LINKAGE_ERROR');
    expect((result.violations || []).join(' | ')).toContain(
      'complete linked package'
    );
  });
});
