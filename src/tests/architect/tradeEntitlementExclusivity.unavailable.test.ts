/**
 * FILE: src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts
 * PURPOSE: Tests for trade-time exclusivity error handling (integrity-first).
 *          Validates that trades are BLOCKED when exclusivity cannot be validated.
 * OWNERSHIP: Test suite (TM-EXCL-E1.1: Integrity-First Exclusivity Gating)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E1.1 execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock computePostTradeEntitlements to simulate failures ─────────────────

const mockComputePostTradeEntitlements = vi.fn();
vi.mock(
  '@/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js',
  async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
      ...actual,
      computePostTradeEntitlements: (...args: unknown[]) =>
        mockComputePostTradeEntitlements(...args),
    };
  }
);

// Mock validateEntitlementExclusivity — normal behavior by default
const mockValidateExclusivity = vi
  .fn()
  .mockReturnValue({ valid: true, violations: [] });
vi.mock(
  '@/features/architect/utils/entitlements/entitlementExclusivityValidator',
  () => ({
    validateEntitlementExclusivity: (...args: unknown[]) =>
      mockValidateExclusivity(...args),
  })
);

// Mock decorateEntitlementForTrade (imported by tradeValidator)
vi.mock(
  '@/features/architect/utils/entitlements/entitlementTerms',
  async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
      ...actual,
      decorateEntitlementForTrade: vi.fn((e: unknown) => e),
    };
  }
);

// ─── Import module under test AFTER mocks ────────────────────────────────────

import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeMinimalTeam(
  teamId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    teamId,
    team: {
      teamId,
      id: teamId,
      teamCode: teamId,
      teamName: `Team ${teamId}`,
      entitlementIds: [] as string[],
      ...((overrides.teamOverrides as Record<string, unknown>) || {}),
    },
    sends: [],
    receives: [],
    entitlementsOut: [],
    validationEntitlements: [],
    teamTotalSalary: 100_000_000,
    projectedSalary: 100_000_000,
    salaryOut: 0,
    salaryIn: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Trade exclusivity: integrity-first error handling (TM-EXCL-E1.1)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Trade exclusivity: error handling (integrity-first)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: compute returns empty (no entitlements)
    mockComputePostTradeEntitlements.mockReturnValue([]);
    mockValidateExclusivity.mockReturnValue({ valid: true, violations: [] });
  });

  it('computePostTradeEntitlements throw → rule fails and blocks trade', () => {
    mockComputePostTradeEntitlements.mockImplementation(() => {
      throw new Error('Simulated compute failure');
    });

    const result = validateTrade({
      teams: [
        makeMinimalTeam('LAL', {
          teamOverrides: { entitlementIds: ['ent-1'] },
          entitlementsOut: [
            {
              id: 'ent-1',
              entitlementId: 'ent-1',
              kind: 'swap_right',
              holderTeam: 'LAL',
              swapControllerPickId: 'BOS_2027_1st',
              toTeamId: 'BOS',
            },
          ],
          validationEntitlements: [
            {
              id: 'ent-1',
              entitlementId: 'ent-1',
              kind: 'swap_right',
              holderTeam: 'LAL',
              swapControllerPickId: 'BOS_2027_1st',
            },
          ],
        }),
        makeMinimalTeam('BOS'),
      ],
      capProjections: {},
      currentYear: 2026,
    });

    // Both teams should have results
    expect(result.teamResults).toBeDefined();
    expect(result.teamResults.length).toBe(2);

    // Check that at least one team's exclusivity rule failed
    const anyExclusivityFailed = result.teamResults.some(
      (r: Record<string, unknown>) => {
        const rules = r.rules as Record<string, unknown> | undefined;
        const excl = rules?.entitlementExclusivity as
          | Record<string, unknown>
          | undefined;
        return excl?.passed === false;
      }
    );
    expect(anyExclusivityFailed).toBe(true);

    // Verify the failure message references the compute error
    const failedTeam = result.teamResults.find((r: Record<string, unknown>) => {
      const rules = r.rules as Record<string, unknown> | undefined;
      const excl = rules?.entitlementExclusivity as
        | Record<string, unknown>
        | undefined;
      return excl?.passed === false;
    });
    const failedRule = (failedTeam as Record<string, unknown>).rules as Record<
      string,
      unknown
    >;
    const exclRule = failedRule.entitlementExclusivity as Record<
      string,
      unknown
    >;
    expect(exclRule.details).toContain(
      'Error computing post-trade entitlement set'
    );
    expect(exclRule.violations).toBeDefined();
  });

  it('validateEntitlementExclusivity throw → rule fails and blocks trade', () => {
    // Compute succeeds, but the validator itself throws
    mockComputePostTradeEntitlements.mockReturnValue([
      {
        id: 'ent-post',
        kind: 'pick_ownership',
        underlyingPickId: 'LAL_2026_1st',
      },
    ]);
    mockValidateExclusivity.mockImplementation(() => {
      throw new Error('Unexpected validator crash');
    });

    const result = validateTrade({
      teams: [
        makeMinimalTeam('LAL', {
          validationEntitlements: [
            {
              id: 'ent-1',
              kind: 'pick_ownership',
              underlyingPickId: 'LAL_2026_1st',
            },
          ],
        }),
        makeMinimalTeam('BOS'),
      ],
      capProjections: {},
      currentYear: 2026,
    });

    expect(result.teamResults).toBeDefined();
    expect(result.teamResults.length).toBe(2);

    // Check that at least one team's exclusivity rule failed
    const anyExclusivityFailed = result.teamResults.some(
      (r: Record<string, unknown>) => {
        const rules = r.rules as Record<string, unknown> | undefined;
        const excl = rules?.entitlementExclusivity as
          | Record<string, unknown>
          | undefined;
        return excl?.passed === false;
      }
    );
    expect(anyExclusivityFailed).toBe(true);

    const failedTeam = result.teamResults.find((r: Record<string, unknown>) => {
      const rules = r.rules as Record<string, unknown> | undefined;
      const excl = rules?.entitlementExclusivity as
        | Record<string, unknown>
        | undefined;
      return excl?.passed === false;
    });
    const failedRule = (failedTeam as Record<string, unknown>).rules as Record<
      string,
      unknown
    >;
    const exclRule = failedRule.entitlementExclusivity as Record<
      string,
      unknown
    >;
    expect(exclRule.details).toContain(
      'Error computing post-trade entitlement set'
    );
  });

  it('normal path still passes when no conflicts exist', () => {
    mockComputePostTradeEntitlements.mockReturnValue([]);
    mockValidateExclusivity.mockReturnValue({ valid: true, violations: [] });

    const result = validateTrade({
      teams: [makeMinimalTeam('LAL'), makeMinimalTeam('BOS')],
      capProjections: {},
      currentYear: 2026,
    });

    const lalResult = result.teamResults?.[0];
    expect(lalResult.rules?.entitlementExclusivity).toBeDefined();
    expect(lalResult.rules.entitlementExclusivity.passed).toBe(true);
    expect(mockComputePostTradeEntitlements).toHaveBeenCalledTimes(2);

    const firstCall = mockComputePostTradeEntitlements.mock.calls[0]?.[0] as {
      teamId?: string;
      currentEntitlements?: unknown[];
      entitlementsOut?: unknown[];
      allTeamsEntitlementsOut?: unknown[];
      tradeParticipantIds?: Set<string>;
    };
    expect(firstCall.teamId).toBe('LAL');
    expect(firstCall.currentEntitlements).toEqual([]);
    expect(firstCall.entitlementsOut).toEqual([]);
    expect(Array.isArray(firstCall.allTeamsEntitlementsOut)).toBe(true);
    expect(Array.from(firstCall.tradeParticipantIds || [])).toEqual([
      'LAL',
      'BOS',
    ]);
  });

  it('normal path still blocks when real conflicts exist', () => {
    mockComputePostTradeEntitlements.mockReturnValue([
      { id: 'ent-1', kind: 'pick_ownership', underlyingPickId: 'LAL_2026_1st' },
      { id: 'ent-2', kind: 'pick_ownership', underlyingPickId: 'LAL_2026_1st' },
    ]);
    mockValidateExclusivity.mockReturnValue({
      valid: false,
      violations: [
        {
          type: 'DUP_PICK_OWNERSHIP_UNDERLIER',
          message: 'Duplicate pick ownership for LAL_2026_1st',
          entitlementIds: ['ent-1', 'ent-2'],
          underlyingPickIds: ['LAL_2026_1st'],
        },
      ],
    });

    const result = validateTrade({
      teams: [makeMinimalTeam('LAL'), makeMinimalTeam('BOS')],
      capProjections: {},
      currentYear: 2026,
    });

    const lalResult = result.teamResults?.[0];
    expect(lalResult.rules?.entitlementExclusivity).toBeDefined();
    expect(lalResult.rules.entitlementExclusivity.passed).toBe(false);
    expect(lalResult.rules.entitlementExclusivity.violations).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TM-EXCL-E2: Routing-based failures cause Pick Exclusivity to fail
  // ═══════════════════════════════════════════════════════════════════════════

  it('missing routing causes Pick Exclusivity to fail with routing message (TM-EXCL-E2)', () => {
    // Compute will return normally, but the routing map will fail
    // because 3-team trade has no toTeamId on an entitlement
    mockComputePostTradeEntitlements.mockReturnValue([]);
    mockValidateExclusivity.mockReturnValue({ valid: true, violations: [] });

    const result = validateTrade({
      teams: [
        makeMinimalTeam('LAL', {
          teamOverrides: { entitlementIds: ['ent-1'] },
          entitlementsOut: [
            {
              id: 'ent-1',
              entitlementId: 'ent-1',
              kind: 'swap_right',
              holderTeam: 'LAL',
              swapControllerPickId: 'BOS_2027_1st',
              // NO toTeamId in a 3-team trade!
            },
          ],
          validationEntitlements: [
            {
              id: 'ent-1',
              entitlementId: 'ent-1',
              kind: 'swap_right',
              holderTeam: 'LAL',
              swapControllerPickId: 'BOS_2027_1st',
            },
          ],
        }),
        makeMinimalTeam('BOS'),
        makeMinimalTeam('CHI'),
      ],
      capProjections: {},
      currentYear: 2026,
    });

    // With 3 teams and a missing toTeamId, the pre-validation entitlement routing check
    // should catch this and return early with ENTITLEMENT_ROUTING_ERROR
    // OR the per-team exclusivity check should catch it via buildEntitlementRoutingMap
    expect(result.legal).toBe(false);

    // Check for routing error — either at top level or in team rules
    const hasRoutingError =
      result.error === 'ENTITLEMENT_ROUTING_ERROR' ||
      result.teamResults?.some((r: Record<string, unknown>) => {
        const rules = r.rules as Record<string, unknown> | undefined;
        const excl = rules?.entitlementExclusivity as
          | Record<string, unknown>
          | undefined;
        return (
          excl?.passed === false &&
          typeof excl?.details === 'string' &&
          excl.details.includes('routing')
        );
      });
    expect(hasRoutingError).toBe(true);
  });

  it('strict compute failure causes Pick Exclusivity to fail (TM-EXCL-E2)', () => {
    // Simulate computePostTradeEntitlements throwing due to strict routing check
    mockComputePostTradeEntitlements.mockImplementation(() => {
      throw new Error(
        'Pick Exclusivity: Entitlement "ent-1" from LAL has no destination team (toTeamId missing in multi-team trade)'
      );
    });

    const result = validateTrade({
      teams: [
        makeMinimalTeam('LAL', {
          teamOverrides: { entitlementIds: ['ent-1'] },
          entitlementsOut: [
            {
              id: 'ent-1',
              entitlementId: 'ent-1',
              kind: 'swap_right',
              holderTeam: 'LAL',
              swapControllerPickId: 'BOS_2027_1st',
              toTeamId: 'BOS',
            },
          ],
          validationEntitlements: [],
        }),
        makeMinimalTeam('BOS'),
      ],
      capProjections: {},
      currentYear: 2026,
    });

    expect(result.teamResults).toBeDefined();

    // At least one team's exclusivity rule should fail
    const anyExclusivityFailed = result.teamResults.some(
      (r: Record<string, unknown>) => {
        const rules = r.rules as Record<string, unknown> | undefined;
        const excl = rules?.entitlementExclusivity as
          | Record<string, unknown>
          | undefined;
        return excl?.passed === false;
      }
    );
    expect(anyExclusivityFailed).toBe(true);

    // The failure message should reference Pick Exclusivity
    const failedTeam = result.teamResults.find((r: Record<string, unknown>) => {
      const rules = r.rules as Record<string, unknown> | undefined;
      const excl = rules?.entitlementExclusivity as
        | Record<string, unknown>
        | undefined;
      return excl?.passed === false;
    });
    if (failedTeam) {
      const rules = (failedTeam as Record<string, unknown>).rules as Record<
        string,
        unknown
      >;
      const exclRule = rules.entitlementExclusivity as Record<string, unknown>;
      expect(
        typeof exclRule.details === 'string' &&
          exclRule.details.includes('Pick Exclusivity')
      ).toBe(true);
    }
  });
});
