// src/features/architect/tradeMachine/TradeReceiptPanel.jsx
// Trade Receipt debug panel - gated behind VITE_SHOW_TRADE_RECEIPT env var
import React, { useState } from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';

/**
 * TradeReceiptPanel displays the detailed Trade Receipt JSON for debugging.
 * This panel is gated behind the VITE_SHOW_TRADE_RECEIPT environment variable.
 * 
 * To enable: Set VITE_SHOW_TRADE_RECEIPT=true in your .env file
 */
const TradeReceiptPanel = ({ receipt }) => {
  const [expanded, setExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  // Gate behind env var - only show when VITE_SHOW_TRADE_RECEIPT=true
  const showReceipt = import.meta.env.VITE_SHOW_TRADE_RECEIPT === 'true';
  
  if (!showReceipt) {
    return null;
  }

  if (!receipt) {
    return (
      <div className="mt-6 p-4 bg-[#111] border border-yellow-500/30 rounded text-xs">
        <div className="flex items-center gap-2 text-yellow-400">
          <span className="text-lg">📋</span>
          <span className="font-medium">Trade Receipt Debug Panel</span>
          <span className="text-white/40">(No receipt data available yet - construct a trade)</span>
        </div>
      </div>
    );
  }

  const handleCopyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  };

  return (
    <div className="mt-6 p-4 bg-[#111] border border-purple-500/30 rounded text-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="font-medium text-purple-400">Trade Receipt (Debug Mode)</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            receipt.isLegal 
              ? 'bg-green-900/30 text-green-400 border border-green-500/30' 
              : 'bg-red-900/30 text-red-400 border border-red-500/30'
          }`}>
            {receipt.isLegal ? '✓ LEGAL' : '✗ ILLEGAL'}
          </span>
          <span className="text-white/40 text-xs">
            v{receipt.validatorVersion}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyReceipt}
            className="px-2 py-1 bg-[#222] text-white/70 hover:text-white rounded border border-white/20 hover:bg-[#333] text-xs"
          >
            {copyFeedback || 'Copy JSON'}
          </button>
          <button
            className="px-3 py-1 bg-[#222] text-white rounded border border-white/20 hover:bg-[#333]"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      {/* Quick Summary */}
      <div className="flex gap-4 text-white/60 mb-3">
        <span>Year: {receipt.yearKey}</span>
        <span>Teams: {receipt.teams?.length || 0}</span>
        <span>Violations: {receipt.allViolations?.length || 0}</span>
        <span className="text-white/40">
          ({receipt.performance?.validationTimeMs?.toFixed(2)}ms)
        </span>
      </div>

      {/* Primary Violation Alert */}
      {receipt.primaryViolation && (
        <div className="p-2 mb-3 bg-red-900/20 border border-red-500/30 rounded text-red-400">
          <strong>Primary Violation:</strong> {receipt.primaryViolation}
        </div>
      )}

      {expanded && (
        <div className="space-y-4">
          {/* Per-Team Summary Cards */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {receipt.teams?.map((team, idx) => (
              <div key={idx} className="bg-[#181818] rounded-lg p-3 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-white">{team.teamName}</h4>
                  <span className="text-white/40 text-xs">{team.teamCode}</span>
                </div>
                
                {/* Pre-trade salary */}
                <div className="text-white/60 text-xs mb-2">
                  Pre-trade Salary: {formatCurrency(team.preTradeTeamSalary)}
                  <span className="text-white/30 ml-1">({team.preTradeTeamSalarySource})</span>
                </div>

                {/* Salary Matching Rule Applied */}
                <div className="p-2 mb-2 bg-[#222] rounded border border-white/10">
                  <div className="text-xs font-medium text-blue-400 mb-1">
                    Rule: {team.salaryMatchingEvaluation?.ruleApplied || 'N/A'}
                  </div>
                  <div className="text-xs text-white/60 font-mono break-all">
                    {team.salaryMatchingEvaluation?.formulaUsed || 'No formula'}
                  </div>
                </div>

                {/* Salary Flow */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <div className="text-white/40">Outgoing (Base)</div>
                    <div className="font-mono">{formatCurrency(team.totals?.outgoingBaseTotal)}</div>
                  </div>
                  <div>
                    <div className="text-white/40">Outgoing (Match)</div>
                    <div className="font-mono">{formatCurrency(team.totals?.outgoingMatchingTotal)}</div>
                  </div>
                  <div>
                    <div className="text-white/40">Incoming (Base)</div>
                    <div className="font-mono">{formatCurrency(team.totals?.incomingBaseTotal)}</div>
                  </div>
                  <div>
                    <div className="text-white/40">Incoming (Match)</div>
                    <div className="font-mono">{formatCurrency(team.totals?.incomingMatchingTotal)}</div>
                  </div>
                </div>

                {/* Allowable vs Actual */}
                <div className="p-2 rounded border border-white/10 mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Allowable Incoming:</span>
                    <span className="font-mono text-green-400">
                      {formatCurrency(team.salaryMatchingEvaluation?.allowableIncoming)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Actual Incoming:</span>
                    <span className="font-mono">
                      {formatCurrency(team.salaryMatchingEvaluation?.actualIncoming)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-white/10 pt-1 mt-1">
                    <span className="text-white/60">Margin:</span>
                    <span className={`font-mono ${
                      (team.salaryMatchingEvaluation?.margin || 0) >= 0 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {formatCurrency(team.salaryMatchingEvaluation?.margin)}
                    </span>
                  </div>
                </div>

                {/* Players */}
                {team.outgoingPlayers?.length > 0 && (
                  <div className="mb-2">
                    <div className="text-white/40 text-xs mb-1">Outgoing Players:</div>
                    {team.outgoingPlayers.map((p, pIdx) => (
                      <div key={pIdx} className="text-xs pl-2 py-1 border-l border-white/10">
                        <div className="flex justify-between items-center">
                          <span>
                            {p.name}
                            {p.flags?.isBYC && <span className="text-yellow-400 ml-1" title="Base Year Compensation - uses max(prior, 50% new)">BYC</span>}
                            {p.flags?.hasTradeKicker && <span className="text-orange-400 ml-1" title="Trade Kicker">TK</span>}
                          </span>
                          <span className="font-mono text-white/60">{formatCurrency(p.matchingValue)}</span>
                        </div>
                        {/* Show breakdown when BYC applies and values differ */}
                        {p.flags?.isBYC && p.baseSalary !== p.matchingValue && (
                          <div className="text-white/40 text-xs mt-0.5 pl-2">
                            Base: {formatCurrency(p.baseSalary)} → Match: {formatCurrency(p.matchingValue)} (BYC: max(prior, 50% new))
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {team.incomingPlayers?.length > 0 && (
                  <div className="mb-2">
                    <div className="text-white/40 text-xs mb-1">Incoming Players:</div>
                    {team.incomingPlayers.map((p, pIdx) => (
                      <div key={pIdx} className="text-xs pl-2 py-1 border-l border-white/10">
                        <div className="flex justify-between items-center">
                          <span>
                            {p.name}
                            {p.flags?.isPoisonPill && <span className="text-purple-400 ml-1" title="Poison Pill - uses averaged salary">PP</span>}
                            {p.flags?.hasTradeKicker && <span className="text-orange-400 ml-1" title={`Trade Kicker (${((p.flags?.tradeKickerPct || 0) * 100).toFixed(0)}%)`}>TK</span>}
                          </span>
                          <span className="font-mono text-white/60">{formatCurrency(p.matchingValue)}</span>
                        </div>
                        {/* Show breakdown when poison pill or trade kicker applies */}
                        {(p.flags?.isPoisonPill || p.flags?.hasTradeKicker) && p.baseSalary !== p.matchingValue && (
                          <div className="text-white/40 text-xs mt-0.5 pl-2">
                            Base: {formatCurrency(p.baseSalary)} → Match: {formatCurrency(p.matchingValue)}
                            {p.flags?.isPoisonPill && ' (Poison Pill avg)'}
                            {p.flags?.hasTradeKicker && ` (+${((p.flags?.tradeKickerPct || 0) * 100).toFixed(0)}% kicker)`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Violations/Warnings for this team */}
                {team.violations?.length > 0 && (
                  <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded">
                    <div className="text-red-400 text-xs font-medium mb-1">Violations:</div>
                    {team.violations.map((v, vIdx) => (
                      <div key={vIdx} className="text-xs text-red-300 pl-2">• {v}</div>
                    ))}
                  </div>
                )}
                {team.warnings?.length > 0 && (
                  <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
                    <div className="text-yellow-400 text-xs font-medium mb-1">Warnings:</div>
                    {team.warnings.map((w, wIdx) => (
                      <div key={wIdx} className="text-xs text-yellow-300 pl-2">• {w}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Full JSON */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-xs">Full Receipt JSON:</span>
            </div>
            <pre className="p-3 bg-[#0a0a0a] border border-white/10 rounded overflow-auto max-h-96 text-xs font-mono text-white/80">
              {JSON.stringify(receipt, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Dev mode indicator */}
      <div className="mt-2 text-white/30 text-xs text-right">
        Debug panel enabled via VITE_SHOW_TRADE_RECEIPT=true
      </div>
    </div>
  );
};

export default TradeReceiptPanel;
