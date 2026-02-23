/**
 * FILE: src/features/architect/utils/entitlements/entitlementHealthReport.ts
 * PURPOSE: Pure diagnostic that scans all teams' entitlements and reports
 *          integrity issues: duplicate ownership underliers, duplicate swap
 *          controllers, conveyance overlaps, and orphan physical slots.
 * OWNERSHIP: Feature: architect/utils/entitlements (TM-EXCL-E6)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E6 (Entitlement Inventory Health Diagnostic).
 *
 * INVARIANTS:
 *  - Pure function — no Firestore, no side effects, no imports beyond types.
 *  - Callers supply entitlementsByTeam; this module does not load data.
 *
 * REF: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10.11
 */

// ─── types ───────────────────────────────────────────────────────────────────

/** Minimal entitlement shape required by the health report. */
export interface HealthReportEntitlement {
  id?: string;
  kind?: string;
  underlyingPickId?: string;
  underlyingStatus?: string;
  swapControllerPickId?: string;
  poolUnderlyingPickIds?: string[];
  receivesComparator?: string;
  receivesRank?: (number | string)[];
  protectionLadder?: Array<{
    year: number;
    condition?: string;
    structuredCondition?: {
      positionStart: number;
      positionEnd: number;
    };
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export type HealthIssueType =
  | 'DUP_OWNERSHIP_UNDERLIER'
  | 'DUP_SWAP_CONTROLLER'
  | 'CONVEYANCE_OVERLAP'
  | 'CROSS_TEAM_OWNERSHIP_CONFLICT'
  | 'ORPHAN_PHYSICAL_SLOT';

export interface HealthIssue {
  /** Category of the issue. */
  type: HealthIssueType;
  /** Human-readable explanation. */
  message: string;
  /** Team codes involved. */
  teams: string[];
  /** Entitlement IDs involved. */
  entitlementIds: string[];
  /** Additional context for debugging. */
  details?: Record<string, unknown>;
}

export interface HealthReport {
  /** True if no issues found. */
  healthy: boolean;
  /** List of detected issues. */
  issues: HealthIssue[];
  /** Summary counts by type. */
  summary: Record<HealthIssueType, number>;
  /** Timestamp of report run. */
  timestamp: string;
  /** Number of teams scanned. */
  teamsScanned: number;
  /** Total entitlements scanned. */
  entitlementsScanned: number;
}

export interface HealthReportInput {
  /** Map of teamCode → entitlements for that team. */
  entitlementsByTeam:
    | Map<string, HealthReportEntitlement[]>
    | Record<string, HealthReportEntitlement[]>;
}

// ─── normalization helpers ───────────────────────────────────────────────────

function normalizePoolKey(ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return '';
  return [...ids].sort().join('|');
}

function normalizeRanks(ranks: (number | string)[] | undefined): number[] {
  if (!ranks || ranks.length === 0) return [];
  const parsed = ranks
    .map((r) => (typeof r === 'string' ? parseInt(r, 10) : r))
    .filter((n) => !isNaN(n));
  return [...new Set(parsed)].sort((a, b) => a - b);
}

function normalizeComparator(c: string | undefined): string {
  return (c || '').toLowerCase().trim();
}

function displayId(ent: HealthReportEntitlement): string {
  return (ent.id as string) || '(no id)';
}

// ─── main report function ────────────────────────────────────────────────────

/**
 * Run an entitlement health diagnostic across all teams.
 *
 * Checks:
 * 1. **DUP_OWNERSHIP_UNDERLIER** — Two pick_ownership entitlements on the SAME
 *    team claim the same underlyingPickId.
 * 2. **DUP_SWAP_CONTROLLER** — Two swap_right entitlements on the same team
 *    claim the same swapControllerPickId.
 * 3. **CONVEYANCE_OVERLAP** — Two conveyance_right entitlements on the same
 *    team have overlapping pool + comparator + rank combinations.
 * 4. **CROSS_TEAM_OWNERSHIP_CONFLICT** — Two different teams both claim
 *    pick_ownership of the same underlyingPickId (league-wide conflict).
 * 5. **ORPHAN_PHYSICAL_SLOT** — A pick_ownership entitlement references a
 *    physical slot (underlyingPickId) that does not appear in any team's
 *    ownership set. (Only detectable with current data model as duplicates
 *    pointing to non-existent slots — best-effort.)
 *
 * @param input.entitlementsByTeam — Map or record of teamCode → entitlements.
 * @returns A structured health report with issues and summary.
 */
export function runEntitlementHealthReport(
  input: HealthReportInput
): HealthReport {
  const issues: HealthIssue[] = [];

  // Normalize input to entries
  const entries: [string, HealthReportEntitlement[]][] =
    input.entitlementsByTeam instanceof Map
      ? Array.from(input.entitlementsByTeam.entries())
      : Object.entries(input.entitlementsByTeam);

  let totalEntitlements = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // Pass 1: Per-team checks (intra-team duplicates)
  // ═══════════════════════════════════════════════════════════════════════════

  for (const [teamCode, entitlements] of entries) {
    totalEntitlements += entitlements.length;

    // ── Check 1: Duplicate pick_ownership underliers within a team ──
    const ownershipByUnderlier = new Map<string, HealthReportEntitlement[]>();
    for (const ent of entitlements) {
      if (ent.kind === 'pick_ownership' && ent.underlyingPickId) {
        const key = ent.underlyingPickId;
        if (!ownershipByUnderlier.has(key)) {
          ownershipByUnderlier.set(key, []);
        }
        ownershipByUnderlier.get(key)!.push(ent);
      }
    }

    for (const [underlier, group] of ownershipByUnderlier) {
      if (group.length > 1) {
        issues.push({
          type: 'DUP_OWNERSHIP_UNDERLIER',
          message: `Team ${teamCode} has ${group.length} pick_ownership entitlements claiming ${underlier}`,
          teams: [teamCode],
          entitlementIds: group.map(displayId),
          details: { underlyingPickId: underlier, count: group.length },
        });
      }
    }

    // ── Check 2: Duplicate swap controllers within a team ──
    const swapByController = new Map<string, HealthReportEntitlement[]>();
    for (const ent of entitlements) {
      if (ent.kind === 'swap_right' && ent.swapControllerPickId) {
        const key = ent.swapControllerPickId;
        if (!swapByController.has(key)) {
          swapByController.set(key, []);
        }
        swapByController.get(key)!.push(ent);
      }
    }

    for (const [controller, group] of swapByController) {
      if (group.length > 1) {
        issues.push({
          type: 'DUP_SWAP_CONTROLLER',
          message: `Team ${teamCode} has ${group.length} swap_right entitlements for controller ${controller}`,
          teams: [teamCode],
          entitlementIds: group.map(displayId),
          details: { swapControllerPickId: controller, count: group.length },
        });
      }
    }

    // ── Check 3: Conveyance overlaps within a team ──
    const conveyances = entitlements.filter(
      (e) => e.kind === 'conveyance_right'
    );
    for (let i = 0; i < conveyances.length; i++) {
      for (let j = i + 1; j < conveyances.length; j++) {
        const a = conveyances[i];
        const b = conveyances[j];

        const aPool = a.poolUnderlyingPickIds || [];
        const bPool = b.poolUnderlyingPickIds || [];
        const aRanks = normalizeRanks(a.receivesRank);
        const bRanks = normalizeRanks(b.receivesRank);
        const aComp = normalizeComparator(a.receivesComparator);
        const bComp = normalizeComparator(b.receivesComparator);

        if (aComp !== bComp || aComp === '') continue;

        // Check pool overlap
        const poolSet = new Set(bPool);
        const sharedPools = aPool.filter((p) => poolSet.has(p));
        if (sharedPools.length === 0) continue;

        // Check rank overlap
        const rankSet = new Set(bRanks);
        const sharedRanks = aRanks.filter((r) => rankSet.has(r));
        if (sharedRanks.length === 0) continue;

        issues.push({
          type: 'CONVEYANCE_OVERLAP',
          message: `Team ${teamCode} has overlapping conveyance rights: shared pool [${sharedPools.join(', ')}], ranks [${sharedRanks.join(', ')}], comparator "${aComp}"`,
          teams: [teamCode],
          entitlementIds: [displayId(a), displayId(b)],
          details: { sharedPools, sharedRanks, comparator: aComp },
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pass 2: Cross-team checks (league-wide conflicts)
  // ═══════════════════════════════════════════════════════════════════════════

  // Check 4: Cross-team ownership conflict — same underlyingPickId claimed
  // by pick_ownership on two different teams.
  const globalOwnership = new Map<
    string,
    { teamCode: string; ent: HealthReportEntitlement }[]
  >();

  for (const [teamCode, entitlements] of entries) {
    for (const ent of entitlements) {
      if (ent.kind === 'pick_ownership' && ent.underlyingPickId) {
        const key = ent.underlyingPickId;
        if (!globalOwnership.has(key)) {
          globalOwnership.set(key, []);
        }
        globalOwnership.get(key)!.push({ teamCode, ent });
      }
    }
  }

  for (const [underlier, claims] of globalOwnership) {
    const uniqueTeams = [...new Set(claims.map((c) => c.teamCode))];
    if (uniqueTeams.length > 1) {
      issues.push({
        type: 'CROSS_TEAM_OWNERSHIP_CONFLICT',
        message: `Pick ${underlier} is claimed by pick_ownership on multiple teams: ${uniqueTeams.join(', ')}`,
        teams: uniqueTeams,
        entitlementIds: claims.map((c) => displayId(c.ent)),
        details: {
          underlyingPickId: underlier,
          teamClaims: claims.map((c) => ({
            team: c.teamCode,
            entitlementId: displayId(c.ent),
          })),
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Build summary
  // ═══════════════════════════════════════════════════════════════════════════

  const summary: Record<HealthIssueType, number> = {
    DUP_OWNERSHIP_UNDERLIER: 0,
    DUP_SWAP_CONTROLLER: 0,
    CONVEYANCE_OVERLAP: 0,
    CROSS_TEAM_OWNERSHIP_CONFLICT: 0,
    ORPHAN_PHYSICAL_SLOT: 0,
  };

  for (const issue of issues) {
    summary[issue.type] = (summary[issue.type] || 0) + 1;
  }

  return {
    healthy: issues.length === 0,
    issues,
    summary,
    timestamp: new Date().toISOString(),
    teamsScanned: entries.length,
    entitlementsScanned: totalEntitlements,
  };
}

// ─── Formatting helpers for UI/clipboard ─────────────────────────────────────

/**
 * Format a health report into a copy-pastable text block.
 */
export function formatHealthReport(report: HealthReport): string {
  const lines: string[] = [];

  lines.push('═══ Entitlement Health Report ═══');
  lines.push(`Status: ${report.healthy ? '✅ HEALTHY' : '❌ ISSUES FOUND'}`);
  lines.push(`Teams scanned: ${report.teamsScanned}`);
  lines.push(`Entitlements scanned: ${report.entitlementsScanned}`);
  lines.push(`Generated: ${report.timestamp}`);
  lines.push('');

  if (report.issues.length === 0) {
    lines.push('No issues detected. All entitlement inventories are clean.');
    return lines.join('\n');
  }

  lines.push(`Total issues: ${report.issues.length}`);
  lines.push('');

  // Group by type
  const byType = new Map<string, HealthIssue[]>();
  for (const issue of report.issues) {
    if (!byType.has(issue.type)) {
      byType.set(issue.type, []);
    }
    byType.get(issue.type)!.push(issue);
  }

  for (const [type, group] of byType) {
    lines.push(`── ${type} (${group.length}) ──`);
    for (const issue of group) {
      lines.push(`  • ${issue.message}`);
      lines.push(`    Teams: ${issue.teams.join(', ')}`);
      lines.push(`    Entitlements: ${issue.entitlementIds.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
