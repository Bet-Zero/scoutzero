// src/features/architect/tradeMachine/TradeSummaryPanel.jsx
// Purpose: keep your top status & rule explanations, revamp Team Summaries into branded cards,
// and move deep references into a collapsible section.

import React from 'react';
import { formatCurrency } from '@/utils/architect/tradeHelpers';
import { getTeamColors } from '@/utils/formatting';
import TeamLogo from '@/components/shared/TeamLogo';

// Helper used for pick chip text
const getPickLabel = (p) => {
  if (!p) return '';
  let label = `${p.year} ${p.round} Round`;
  if (p.via) label += ` (via ${p.via})`;
  if (p.protection) label += ` 🛡 ${p.protection}`;
  if (p.isSwap) label += ` 🔄 Swap`;
  return label;
};

function TradeSummaryPanel({
  result,
  teams = [],
  forceTrade = false,
  showRuleExplanations = true,
}) {
  if (!result) return null;

  const failureMessages =
    result.teamResults?.flatMap((tr) => tr.violations || []) || [];

  // Top status banner text
  const topStatus = forceTrade
    ? '⚠️ Trade Forced – Not CBA Legal'
    : result.legal
      ? '✅ Trade is CBA Legal'
      : '❌ Trade is NOT CBA Legal';

  return (
    <div className="mt-6 text-sm border-t border-white/10 pt-4 space-y-6">
      {/* Top Status Message */}
      <div>
        <strong className="text-base">{topStatus}</strong>
        {!result.legal && !forceTrade && (
          <div className="text-xs text-white/60 mt-1">
            Fix the issues below or toggle Force Trade to proceed (for sandbox
            testing).
          </div>
        )}
      </div>

      {/* Rule Explanations (surface-level) */}
      {showRuleExplanations && failureMessages.length > 0 && (
        <div className="bg-[#121212] border border-red-500/30 rounded p-3">
          <div className="font-semibold mb-2">Why it fails</div>
          <ul className="list-disc list-inside space-y-1">
            {failureMessages.map((f, idx) => (
              <li key={idx} className="text-red-300">
                {f.message || f.reason || String(f)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Team Summaries — revamped to cards with logo/color + rows */}
      <div className="grid md:grid-cols-2 gap-4">
        {result.summaryByTeamIndex?.map((t, i) => {
          if (!t) return null;

          const teamResult = result.teamResults?.[i];
          const isIllegal = teamResult ? !teamResult.legal : false;

          const teamMeta =
            teams.find((te) => te.teamName === t.teamName) ||
            teams.find((te) => te.id === t.teamId) ||
            null;
          const colors = teamMeta ? getTeamColors(teamMeta.id) : null;
          const primary = colors?.primary;

          // Derive incoming assets (players/picks) if present on result
          const incomingPlayers = teamResult?.incomingPlayers || [];
          const incomingPicks = teamResult?.picksIn || t.picksIn || [];

          return (
            <div
              key={t.teamName || teamMeta?.id || i}
              className={`border rounded bg-[#111] overflow-hidden ${
                isIllegal ? 'border-red-500' : 'border-white/10'
              }`}
            >
              {/* color accent bar */}
              <div
                className="h-1.5"
                style={primary ? { backgroundColor: primary } : undefined}
              />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {teamMeta && (
                      <TeamLogo teamId={teamMeta.id} className="w-6 h-6" />
                    )}
                    <h4 className="font-semibold">{t.teamName}</h4>
                  </div>
                  {isIllegal && (
                    <span className="text-xs text-red-400 font-semibold">
                      ❌ Rejected
                    </span>
                  )}
                </div>

                {/* Salary snapshot */}
                {teamResult?.calculations?.salaryMatching && (
                  <p className="text-xs text-white/70">
                    Incoming / Allowed:{' '}
                    {formatCurrency(
                      teamResult.calculations?.salaryIn ??
                        teamResult.salaryIn ??
                        0
                    )}{' '}
                    /{' '}
                    {formatCurrency(
                      teamResult.calculations.salaryMatching
                        .allowableIncoming ?? 0
                    )}
                    {Number(teamResult.calculations.salaryMatching.difference) >
                      0 && (
                      <>
                        {' '}
                        — Over by{' '}
                        {formatCurrency(
                          teamResult.calculations.salaryMatching.difference
                        )}
                      </>
                    )}
                  </p>
                )}

                {/* Assets in */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-white/60 mb-1">
                      Players Received
                    </div>
                    {incomingPlayers.length ? (
                      <div className="space-y-1">
                        {incomingPlayers.map((p) => (
                          <div
                            key={p.player_id || p.id}
                            className="flex items-center justify-between bg-white/5 px-2 py-1 rounded"
                          >
                            <div className="truncate">
                              {p.name || p.fullName}
                            </div>
                            <div className="text-white/50">
                              {p.salary ? formatCurrency(p.salary) : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-white/40 italic">None</div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-white/60 mb-1">
                      Picks Received
                    </div>
                    {incomingPicks.length ? (
                      <div className="space-y-1">
                        {incomingPicks.map((pk, idx2) => (
                          <div
                            key={`${pk?.year || 'y'}-${pk?.round || 'r'}-${idx2}`}
                            className="flex items-center justify-between bg-white/5 px-2 py-1 rounded"
                          >
                            <div className="truncate">{getPickLabel(pk)}</div>
                            <div className="text-white/50">
                              {pk?.toTeamId ? 'Incoming' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-white/40 italic">None</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TradeSummaryPanel;
