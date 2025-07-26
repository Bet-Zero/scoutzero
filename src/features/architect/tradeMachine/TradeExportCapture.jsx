import React from 'react';
import TeamLogo from '@/components/shared/TeamLogo';
import { getTeamColors } from '@/utils/formatting/teamColors';
import { getYearsRemaining } from '@/utils/contracts';
import { formatSalary } from '@/utils/formatting';
import {
  formatPick,
  getSalaryForYear,
  formatCurrency,
} from '@/utils/architect/tradeHelpers';
import { format } from 'date-fns';

const TradeExportCapture = React.forwardRef(
  (
    { teams = [], result, yearKey, label = 'Trade Summary', date = new Date() },
    ref
  ) => {
    const formattedDate = format(new Date(date), 'MMMM d, yyyy');

    const incomingAssets = teams.map((tm, idx) => {
      const players = [];
      const picks = [];
      teams.forEach((t, j) => {
        if (j !== idx && t.team) {
          t.sends.forEach((p) => {
            if (
              !p.tradeTo ||
              p.tradeTo === tm.team?.id ||
              p.tradeTo === tm.team?.teamId
            ) {
              players.push(p);
            }
          });
          t.picksOut.forEach((p) => {
            if (
              !p.toTeamId ||
              p.toTeamId === tm.team?.id ||
              p.toTeamId === tm.team?.teamId
            ) {
              picks.push(p);
            }
          });
        }
      });
      return { players, picks };
    });

    return (
      <div
        ref={ref}
        className="w-[1200px] bg-neutral-900 text-white rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
        style={{ fontFamily: 'AntonLocal, sans-serif' }}
      >
        <div style={{ opacity: 0, position: 'absolute' }}>preload</div>
        <div className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-5xl font-black tracking-wide uppercase">
              {label}
            </h2>
            <div className="text-neutral-400 text-sm">{formattedDate}</div>
            {result && (
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-lg font-semibold ${
                  result.legal
                    ? 'bg-green-600 text-black'
                    : 'bg-red-600 text-black'
                }`}
              >
                {result.legal ? 'PASSED' : 'FAILED'}
              </span>
            )}
          </div>

          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${teams.length}, 1fr)` }}
          >
            {teams.map((tm, idx) => {
              if (!tm.team) return null;
              const { players, picks } = incomingAssets[idx] || {};
              const summary = result?.summaryByTeamIndex?.[idx];
              const capDelta = summary?.capDelta || 0;
              const { primary } = getTeamColors(tm.team.id) || {};
              return (
                <div
                  key={tm.team.id}
                  className="bg-[#111] rounded p-4 border space-y-3"
                  style={{ borderColor: primary }}
                >
                  <div className="flex flex-col items-center">
                    <TeamLogo teamId={tm.team.id} className="w-12 h-12 mb-1" />
                    <h3 className="text-lg font-semibold text-center">
                      {tm.team.teamName}
                    </h3>
                  </div>

                  <div>
                    <h4 className="text-sm text-neutral-400 font-semibold mb-1">
                      Players Received
                    </h4>
                    <div className="space-y-1">
                      {players.length ? (
                        players.map((p, i) => {
                          const salary = getSalaryForYear([p], yearKey);
                          const years = getYearsRemaining(
                            p.contract_clean?.fa_year ||
                              p.fa_year ||
                              p.free_agency_year,
                            parseInt(
                              String(yearKey).match(/\d{4}/)?.[0] || yearKey
                            )
                          );
                          const headshot =
                            p.headshotUrl ||
                            p.headshot ||
                            `/assets/headshots/${p.id || p.player_id}.png`;
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-sm"
                            >
                              <img
                                src={headshot}
                                alt={p.name}
                                onError={(e) => {
                                  e.target.src =
                                    '/assets/headshots/default.png';
                                }}
                                className="w-8 h-8 object-cover bg-[#2a2a2a]"
                              />
                              <span className="flex-1 truncate">
                                {p.display_name || p.name}
                              </span>
                              <span>{formatSalary(salary)}</span>
                              <span className="text-neutral-400 text-xs ml-1">
                                {years}y
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-neutral-500 text-xs">None</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm text-neutral-400 font-semibold mb-1">
                      Picks Received
                    </h4>
                    <div className="space-y-1 text-xs">
                      {picks.length ? (
                        picks.map((p, i) => <div key={i}>{formatPick(p)}</div>)
                      ) : (
                        <div className="text-neutral-500">None</div>
                      )}
                    </div>
                  </div>

                  <div className="text-sm">
                    Cap Impact:{' '}
                    <span
                      className={
                        capDelta > 0
                          ? 'text-red-400'
                          : capDelta < 0
                            ? 'text-green-400'
                            : ''
                      }
                    >
                      {formatCurrency(capDelta)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

export default TradeExportCapture;
