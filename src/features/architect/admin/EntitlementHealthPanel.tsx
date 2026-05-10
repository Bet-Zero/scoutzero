/**
 * FILE: src/features/architect/admin/EntitlementHealthPanel.tsx
 * PURPOSE: Admin-only panel that runs the entitlement health diagnostic
 *          and displays copy-pastable issue output.
 * OWNERSHIP: Feature: architect/admin (TM-EXCL-E6)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E6 (Entitlement Inventory Health Diagnostic).
 *
 * USAGE:
 *  Render inside the Development Tools panel of ValidationDetailsPanel
 *  or any admin surface. Requires entitlementsByTeam data.
 */

import React, { useCallback, useState } from 'react';
import {
  runEntitlementHealthReport,
  formatHealthReport,
  type HealthReport,
  type HealthReportEntitlement,
} from '@/features/architect/utils/entitlements/entitlementHealthReport';

// ─── types ───────────────────────────────────────────────────────────────────

interface EntitlementHealthPanelProps {
  /**
   * Map of teamCode → entitlements for that team.
   * Accepts both Map and plain objects.
   */
  entitlementsByTeam:
    | Map<string, HealthReportEntitlement[]>
    | Record<string, HealthReportEntitlement[]>;
  /** Whether to show in compact inline mode (vs full panel). */
  compact?: boolean;
}

// ─── severity colors ─────────────────────────────────────────────────────────

const ISSUE_TYPE_COLORS: Record<string, string> = {
  DUP_OWNERSHIP_UNDERLIER: 'text-red-400',
  DUP_SWAP_CONTROLLER: 'text-red-400',
  CONVEYANCE_OVERLAP: 'text-amber-400',
  CROSS_TEAM_OWNERSHIP_CONFLICT: 'text-red-500',
  ORPHAN_PHYSICAL_SLOT: 'text-yellow-300',
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  DUP_OWNERSHIP_UNDERLIER: 'Duplicate Ownership',
  DUP_SWAP_CONTROLLER: 'Duplicate Swap Controller',
  CONVEYANCE_OVERLAP: 'Conveyance Overlap',
  CROSS_TEAM_OWNERSHIP_CONFLICT: 'Cross-Team Conflict',
  ORPHAN_PHYSICAL_SLOT: 'Orphan Slot',
};

// ─── component ───────────────────────────────────────────────────────────────

export const EntitlementHealthPanel: React.FC<EntitlementHealthPanelProps> = ({
  entitlementsByTeam,
  compact = false,
}) => {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRunReport = useCallback(() => {
    const result = runEntitlementHealthReport({ entitlementsByTeam });
    setReport(result);
    setCopied(false);
  }, [entitlementsByTeam]);

  const handleCopy = useCallback(() => {
    if (!report) return;
    const text = formatHealthReport(report);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [report]);

  // ── Compact mode: just a button + status badge ──
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={handleRunReport}
          className="px-2 py-1 text-xs rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition-colors"
          title="Run entitlement exclusivity health check"
        >
          🩺 Health Check
        </button>
        {report && (
          <span
            className={`text-xs font-medium ${report.healthy ? 'text-green-400' : 'text-red-400'}`}
          >
            {report.healthy ? '✅' : `❌ ${report.issues.length} issues`}
          </span>
        )}
      </div>
    );
  }

  // ── Full panel mode ──
  return (
    <div
      className="border border-indigo-500/20 rounded-lg bg-[#0d0d14] p-4"
      data-testid="entitlement-health-panel"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
          <span>🩺</span>
          <span>Exclusivity Health Check</span>
        </h4>
        <div className="flex items-center gap-2">
          {report && (
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 transition-colors"
              title="Copy report to clipboard"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          )}
          <button
            type="button"
            onClick={handleRunReport}
            className="px-3 py-1 text-xs rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 font-medium transition-colors"
            data-testid="run-health-report"
          >
            Run Report
          </button>
        </div>
      </div>

      {!report && (
        <p className="text-xs text-white/40 italic">
          Click &ldquo;Run Report&rdquo; to scan all team entitlements for
          integrity issues.
        </p>
      )}

      {report && (
        <div className="space-y-3">
          {/* Status banner */}
          <div
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              report.healthy
                ? 'bg-green-900/20 border border-green-600/30 text-green-300'
                : 'bg-red-900/20 border border-red-600/30 text-red-300'
            }`}
            data-testid="health-status"
          >
            {report.healthy
              ? '✅ All Clear — No integrity issues detected'
              : `❌ ${report.issues.length} issue${report.issues.length === 1 ? '' : 's'} found`}
          </div>

          {/* Summary stats */}
          <div className="flex gap-4 text-xs text-white/50">
            <span>Teams: {report.teamsScanned}</span>
            <span>Entitlements: {report.entitlementsScanned}</span>
          </div>

          {/* Issues list */}
          {report.issues.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {report.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="bg-white/5 rounded p-2 text-xs border border-white/5"
                  data-testid="health-issue"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`font-semibold ${ISSUE_TYPE_COLORS[issue.type] || 'text-white/70'}`}
                    >
                      {ISSUE_TYPE_LABELS[issue.type] || issue.type}
                    </span>
                    <span className="text-white/30">•</span>
                    <span className="text-white/50">
                      {issue.teams.join(', ')}
                    </span>
                  </div>
                  <div className="text-white/60">{issue.message}</div>
                  <div className="text-white/30 mt-1 font-mono text-[10px]">
                    IDs: {issue.entitlementIds.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

