/**
 * FILE: src/tests/architect/entitlementHealthReport.test.ts
 * PURPOSE: Pure tests for runEntitlementHealthReport diagnostic.
 *          Validates detection of duplicate ownership, swap controllers,
 *          conveyance overlaps, and cross-team ownership conflicts.
 * OWNERSHIP: Test suite (TM-EXCL-E6: Entitlement Inventory Health Diagnostic)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E6 execution.
 */

import { describe, it, expect } from 'vitest';
import {
  runEntitlementHealthReport,
  formatHealthReport,
  type HealthReportEntitlement,
  type HealthReport,
} from '@/features/architect/utils/entitlements/entitlementHealthReport';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makePickOwnership(
  id: string,
  underlyingPickId: string
): HealthReportEntitlement {
  return { id, kind: 'pick_ownership', underlyingPickId };
}

function makeSwapRight(
  id: string,
  swapControllerPickId: string
): HealthReportEntitlement {
  return { id, kind: 'swap_right', swapControllerPickId };
}

function makeConveyance(
  id: string,
  poolUnderlyingPickIds: string[],
  receivesComparator: string,
  receivesRank: number[]
): HealthReportEntitlement {
  return {
    id,
    kind: 'conveyance_right',
    poolUnderlyingPickIds,
    receivesComparator,
    receivesRank,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Healthy scenarios
// ═══════════════════════════════════════════════════════════════════════════════

describe('Healthy scenarios', () => {
  it('returns healthy for empty input', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: new Map(),
    });
    expect(report.healthy).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.teamsScanned).toBe(0);
    expect(report.entitlementsScanned).toBe(0);
  });

  it('returns healthy when teams have no conflicts', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [
          makePickOwnership('ent-1', 'LAL_2026_1st'),
          makeSwapRight('ent-2', 'BOS_2027_1st'),
        ],
        BOS: [
          makePickOwnership('ent-3', 'BOS_2026_1st'),
          makeConveyance('ent-4', ['MIA_2026_1st'], 'more_favorable', [1]),
        ],
      },
    });
    expect(report.healthy).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.teamsScanned).toBe(2);
    expect(report.entitlementsScanned).toBe(4);
  });

  it('accepts a Map as entitlementsByTeam', () => {
    const map = new Map<string, HealthReportEntitlement[]>();
    map.set('LAL', [makePickOwnership('ent-1', 'LAL_2026_1st')]);
    map.set('BOS', [makePickOwnership('ent-2', 'BOS_2026_1st')]);

    const report = runEntitlementHealthReport({ entitlementsByTeam: map });
    expect(report.healthy).toBe(true);
    expect(report.teamsScanned).toBe(2);
  });

  it('returns a timestamp', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {},
    });
    expect(report.timestamp).toBeDefined();
    expect(typeof report.timestamp).toBe('string');
    // Should be a valid ISO string
    expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DUP_OWNERSHIP_UNDERLIER (intra-team)
// ═══════════════════════════════════════════════════════════════════════════════

describe('DUP_OWNERSHIP_UNDERLIER', () => {
  it('detects duplicate pick_ownership underliers on same team', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [
          makePickOwnership('ent-1', 'LAL_2026_1st'),
          makePickOwnership('ent-2', 'LAL_2026_1st'),
        ],
      },
    });
    expect(report.healthy).toBe(false);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0];
    expect(issue.type).toBe('DUP_OWNERSHIP_UNDERLIER');
    expect(issue.teams).toEqual(['LAL']);
    expect(issue.entitlementIds).toContain('ent-1');
    expect(issue.entitlementIds).toContain('ent-2');
    expect(issue.details?.underlyingPickId).toBe('LAL_2026_1st');
  });

  it('detects triple duplicate', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [
          makePickOwnership('ent-1', 'LAL_2026_1st'),
          makePickOwnership('ent-2', 'LAL_2026_1st'),
          makePickOwnership('ent-3', 'LAL_2026_1st'),
        ],
      },
    });
    expect(report.healthy).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].entitlementIds).toHaveLength(3);
  });

  it('different underliers on same team are clean', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [
          makePickOwnership('ent-1', 'LAL_2026_1st'),
          makePickOwnership('ent-2', 'LAL_2027_1st'),
        ],
      },
    });
    expect(report.healthy).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DUP_SWAP_CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

describe('DUP_SWAP_CONTROLLER', () => {
  it('detects duplicate swap controllers on same team', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        BOS: [
          makeSwapRight('ent-1', 'LAL_2026_1st'),
          makeSwapRight('ent-2', 'LAL_2026_1st'),
        ],
      },
    });
    expect(report.healthy).toBe(false);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0];
    expect(issue.type).toBe('DUP_SWAP_CONTROLLER');
    expect(issue.teams).toEqual(['BOS']);
    expect(issue.entitlementIds).toContain('ent-1');
    expect(issue.entitlementIds).toContain('ent-2');
    expect(issue.details?.swapControllerPickId).toBe('LAL_2026_1st');
  });

  it('different swap controllers are clean', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        BOS: [
          makeSwapRight('ent-1', 'LAL_2026_1st'),
          makeSwapRight('ent-2', 'BOS_2026_1st'),
        ],
      },
    });
    expect(report.healthy).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONVEYANCE_OVERLAP
// ═══════════════════════════════════════════════════════════════════════════════

describe('CONVEYANCE_OVERLAP', () => {
  it('detects exact duplicate conveyance rights', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        MIA: [
          makeConveyance(
            'ent-1',
            ['LAL_2026_1st', 'BOS_2026_1st'],
            'more_favorable',
            [1]
          ),
          makeConveyance(
            'ent-2',
            ['LAL_2026_1st', 'BOS_2026_1st'],
            'more_favorable',
            [1]
          ),
        ],
      },
    });
    expect(report.healthy).toBe(false);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0];
    expect(issue.type).toBe('CONVEYANCE_OVERLAP');
    expect(issue.teams).toEqual(['MIA']);
  });

  it('detects overlapping conveyance rights (shared pool + rank subset)', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        MIA: [
          makeConveyance(
            'ent-1',
            ['LAL_2026_1st', 'BOS_2026_1st'],
            'more_favorable',
            [1, 2]
          ),
          makeConveyance(
            'ent-2',
            ['LAL_2026_1st', 'NYK_2026_1st'],
            'more_favorable',
            [2, 3]
          ),
        ],
      },
    });
    expect(report.healthy).toBe(false);
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0];
    expect(issue.type).toBe('CONVEYANCE_OVERLAP');
    expect(issue.details?.sharedPools).toContain('LAL_2026_1st');
    expect(issue.details?.sharedRanks).toContain(2);
  });

  it('different comparators do not conflict', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        MIA: [
          makeConveyance('ent-1', ['LAL_2026_1st'], 'more_favorable', [1]),
          makeConveyance('ent-2', ['LAL_2026_1st'], 'less_favorable', [1]),
        ],
      },
    });
    expect(report.healthy).toBe(true);
  });

  it('non-overlapping pools are clean', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        MIA: [
          makeConveyance('ent-1', ['LAL_2026_1st'], 'more_favorable', [1]),
          makeConveyance('ent-2', ['BOS_2026_1st'], 'more_favorable', [1]),
        ],
      },
    });
    expect(report.healthy).toBe(true);
  });

  it('non-overlapping ranks are clean', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        MIA: [
          makeConveyance('ent-1', ['LAL_2026_1st'], 'more_favorable', [1]),
          makeConveyance('ent-2', ['LAL_2026_1st'], 'more_favorable', [2]),
        ],
      },
    });
    expect(report.healthy).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS_TEAM_OWNERSHIP_CONFLICT
// ═══════════════════════════════════════════════════════════════════════════════

describe('CROSS_TEAM_OWNERSHIP_CONFLICT', () => {
  it('detects same pick_ownership underlier on two different teams', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [makePickOwnership('ent-1', 'LAL_2026_1st')],
        BOS: [makePickOwnership('ent-2', 'LAL_2026_1st')],
      },
    });
    expect(report.healthy).toBe(false);
    // Should have both a cross-team conflict
    const crossTeam = report.issues.filter(
      (i) => i.type === 'CROSS_TEAM_OWNERSHIP_CONFLICT'
    );
    expect(crossTeam).toHaveLength(1);
    expect(crossTeam[0].teams).toContain('LAL');
    expect(crossTeam[0].teams).toContain('BOS');
    expect(crossTeam[0].entitlementIds).toContain('ent-1');
    expect(crossTeam[0].entitlementIds).toContain('ent-2');
  });

  it('three teams claiming same pick', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [makePickOwnership('ent-1', 'NYK_2026_1st')],
        BOS: [makePickOwnership('ent-2', 'NYK_2026_1st')],
        MIA: [makePickOwnership('ent-3', 'NYK_2026_1st')],
      },
    });
    const crossTeam = report.issues.filter(
      (i) => i.type === 'CROSS_TEAM_OWNERSHIP_CONFLICT'
    );
    expect(crossTeam).toHaveLength(1);
    expect(crossTeam[0].teams).toHaveLength(3);
  });

  it('different picks on different teams are clean', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [makePickOwnership('ent-1', 'LAL_2026_1st')],
        BOS: [makePickOwnership('ent-2', 'BOS_2026_1st')],
      },
    });
    const crossTeam = report.issues.filter(
      (i) => i.type === 'CROSS_TEAM_OWNERSHIP_CONFLICT'
    );
    expect(crossTeam).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

describe('Summary counts', () => {
  it('counts issues by type correctly', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [
          makePickOwnership('ent-1', 'LAL_2026_1st'),
          makePickOwnership('ent-2', 'LAL_2026_1st'),
          makeSwapRight('ent-3', 'BOS_2027_1st'),
          makeSwapRight('ent-4', 'BOS_2027_1st'),
        ],
      },
    });
    expect(report.summary.DUP_OWNERSHIP_UNDERLIER).toBe(1);
    expect(report.summary.DUP_SWAP_CONTROLLER).toBe(1);
    expect(report.summary.CONVEYANCE_OVERLAP).toBe(0);
    expect(report.summary.CROSS_TEAM_OWNERSHIP_CONFLICT).toBe(0);
    expect(report.summary.ORPHAN_PHYSICAL_SLOT).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Mixed scenario
// ═══════════════════════════════════════════════════════════════════════════════

describe('Mixed scenario', () => {
  it('detects multiple issue types across teams', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [
          makePickOwnership('ent-1', 'LAL_2026_1st'),
          makePickOwnership('ent-2', 'LAL_2026_1st'), // intra-team dup
          makeSwapRight('ent-3', 'MIA_2026_1st'),
          makeSwapRight('ent-4', 'MIA_2026_1st'), // intra-team dup swap
        ],
        BOS: [
          makePickOwnership('ent-5', 'LAL_2026_1st'), // cross-team conflict with LAL
          makeConveyance('ent-6', ['NYK_2026_1st'], 'more_favorable', [1]),
          makeConveyance('ent-7', ['NYK_2026_1st'], 'more_favorable', [1]), // conveyance overlap
        ],
      },
    });
    expect(report.healthy).toBe(false);

    expect(report.summary.DUP_OWNERSHIP_UNDERLIER).toBe(1);
    expect(report.summary.DUP_SWAP_CONTROLLER).toBe(1);
    expect(report.summary.CONVEYANCE_OVERLAP).toBe(1);
    expect(report.summary.CROSS_TEAM_OWNERSHIP_CONFLICT).toBe(1);
    expect(report.issues.length).toBe(4);
    expect(report.teamsScanned).toBe(2);
    expect(report.entitlementsScanned).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// formatHealthReport
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatHealthReport', () => {
  it('formats a healthy report', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: { LAL: [makePickOwnership('ent-1', 'LAL_2026_1st')] },
    });
    const text = formatHealthReport(report);
    expect(text).toContain('HEALTHY');
    expect(text).toContain('No issues detected');
  });

  it('formats a report with issues', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: {
        LAL: [
          makePickOwnership('ent-1', 'LAL_2026_1st'),
          makePickOwnership('ent-2', 'LAL_2026_1st'),
        ],
      },
    });
    const text = formatHealthReport(report);
    expect(text).toContain('ISSUES FOUND');
    expect(text).toContain('DUP_OWNERSHIP_UNDERLIER');
    expect(text).toContain('ent-1');
    expect(text).toContain('ent-2');
    expect(text).toContain('LAL');
  });

  it('includes summary statistics', () => {
    const report = runEntitlementHealthReport({
      entitlementsByTeam: { LAL: [] },
    });
    const text = formatHealthReport(report);
    expect(text).toContain('Teams scanned: 1');
    expect(text).toContain('Entitlements scanned: 0');
  });
});
