// TradeSummaryPanel.jsx

import React from 'react';
import { formatCurrency } from '@/utils/architect/tradeHelpers';

const getPickLabel = (p) => {
  let label = `${p.year} ${p.round} Round`;
  if (p.via) label += ` (via ${p.via})`;
  if (p.protection) label += ` 🛡 ${p.protection}`;
  if (p.isSwap) label += ' 🔁 Swap';
  if (p.note) label += ` 📝 ${p.note}`;
  return label;
};

const TradeSummaryPanel = ({ result, teams, forceTrade }) => {
  if (!result) return null;

  const illegalTeams = new Set(
    (result.teamResults || []).filter((t) => !t.legal).map((t) => t.teamName)
  );

  return (
    <div className="mt-6 text-sm border-t border-white/10 pt-4 space-y-6">
      {/* Top Status Message */}
      <div>
        <strong className="text-base">
          {forceTrade
            ? '⚠️ Trade Forced – Not CBA Legal'
            : result.legal
              ? '✅ Trade Approved'
              : '❌ Trade Rejected'}
        </strong>
        <p className="mt-1 text-white/80">
          {result.reason || 'Trade complies with all CBA rules.'}
        </p>
      </div>

      {/* Team Summaries */}
      <div className="grid md:grid-cols-2 gap-4">
        {result.summaryByTeamIndex?.map((t, i) => {
          if (!t) return null;

          const isIllegal = illegalTeams.has(t.teamName);

          return (
            <div
              key={t.teamName}
              className={`border p-4 rounded bg-[#111] space-y-2 ${
                isIllegal ? 'border-red-500' : 'border-white/10'
              }`}
            >
              <div className="flex justify-between items-center">
                <h4 className="font-semibold">{t.teamName}</h4>
                {isIllegal && (
                  <span className="text-xs text-red-400 font-semibold">
                    ❌ Rejected
                  </span>
                )}
              </div>

              <div className="text-white/90">
                <strong>Gained:</strong>{' '}
                {t.playersIn.length ? t.playersIn.join(', ') : 'None'}
              </div>

              <div className="text-white/90">
                <strong>Lost:</strong>{' '}
                {t.playersOut.length ? t.playersOut.join(', ') : 'None'}
              </div>

              <div className="text-white/90">
                <strong>Picks In:</strong>
                <ul className="list-disc ml-5 mt-1">
                  {t.picksIn.length ? (
                    t.picksIn.map((p, idx) => (
                      <li key={idx}>{getPickLabel(p)}</li>
                    ))
                  ) : (
                    <li className="text-white/50">None</li>
                  )}
                </ul>
              </div>

              <div className="text-white/90">
                <strong>Picks Out:</strong>
                <ul className="list-disc ml-5 mt-1">
                  {t.picksOut.length ? (
                    t.picksOut.map((p, idx) => (
                      <li key={idx}>{getPickLabel(p)}</li>
                    ))
                  ) : (
                    <li className="text-white/50">None</li>
                  )}
                </ul>
              </div>

              <div className="text-white/90">
                <strong>Roster Change:</strong> {t.rosterDelta >= 0 ? '+' : ''}
                {t.rosterDelta}
              </div>

              <div className="text-white/90">
                <strong>Cap Change:</strong>{' '}
                <span
                  className={
                    t.capDelta > 0
                      ? 'text-red-400'
                      : t.capDelta < 0
                        ? 'text-green-400'
                        : ''
                  }
                >
                  {formatCurrency(t.capDelta)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-Team Legal Status (Summary) */}
      <div className="space-y-1 text-white/80 text-sm">
        <h4 className="font-semibold text-sm mt-2">CBA Validation:</h4>
        {result.teamResults?.map((tr, i) => (
          <p key={i}>
            <strong>{tr.teamName || `Team ${i + 1}`}:</strong>{' '}
            {tr.legal ? '✅ Legal' : `❌ ${tr.reason}`}
          </p>
        ))}
      </div>
    </div>
  );
};

export default TradeSummaryPanel;
