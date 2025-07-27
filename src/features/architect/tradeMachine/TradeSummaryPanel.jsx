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

const RuleExplanation = ({ rule, description }) => (
  <div className="mt-2 p-2 bg-[#222] rounded border border-white/10">
    <strong className="text-sm">{rule}:</strong>
    <p className="text-xs text-white/80 mt-1">{description}</p>
  </div>
);

const TradeSummaryPanel = ({ result, teams, forceTrade }) => {
  if (!result) return null;

  const illegalTeams = new Set(
    (result.teamResults || []).filter((t) => !t.legal).map((t) => t.teamName)
  );

  const violatedRules =
    result.teamResults?.flatMap((tr) => (!tr.legal ? tr.reasons : [])) || [];

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
          const teamResult = result.teamResults[i];

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

              {teamResult && (
                <div className="text-xs mt-2">
                  <div>Status: {teamResult.apronStatus}</div>
                  <div>
                    Projected Total:{' '}
                    {formatCurrency(teamResult.projectedSalary)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rule Explanations */}
      {violatedRules.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">CBA Rule Violations:</h4>
          {violatedRules.map((rule, i) => (
            <div key={i} className="text-red-400 text-sm">
              • {rule}
            </div>
          ))}
        </div>
      )}

      {/* Rule Reference */}
      <div className="border-t border-white/10 pt-4">
        <h4 className="font-semibold mb-2">CBA Rules Reference:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RuleExplanation
            rule="Salary Matching (Over Cap)"
            description="Teams over the cap can take back 125% of outgoing salary + $100k (up to $6.5M outgoing), 175% + $100k (under $6.5M), or just 125% (over $19.6M)"
          />
          <RuleExplanation
            rule="Second Apron Restrictions"
            description="Teams above the second apron cannot aggregate salaries in trades, take back more salary than they send, or include cash in trades"
          />
          <RuleExplanation
            rule="Sign-and-Trade"
            description="Sign-and-trade players must be traded alone, and receiving team cannot be above the first apron"
          />
          <RuleExplanation
            rule="Stepien Rule"
            description="Teams cannot trade consecutive future first-round picks unless protected"
          />
        </div>
      </div>
    </div>
  );
};

export default TradeSummaryPanel;
