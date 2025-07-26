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

    // === REPLACEMENT BLOCK STARTS HERE ===
    // This is the exact return statement to replace your original
    return (
      <div
        ref={ref}
        className="w-[1400px] bg-neutral-900 text-white relative overflow-hidden shadow-2xl"
        style={{ fontFamily: 'AntonLocal, sans-serif' }}
      >
        <div style={{ opacity: 0, position: 'absolute' }}>preload</div>

        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        ></div>

        <div className="relative z-10 p-8">
          {/* Header section */}
          <div className="text-center mb-10 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-600/20 via-neutral-500/20 to-neutral-600/20 blur-xl"></div>
            <div className="relative bg-black/40 backdrop-blur-sm rounded-2xl p-8 border border-neutral-700/50 shadow-xl">
              <h2 className="text-6xl font-black tracking-wider uppercase mb-3 bg-gradient-to-r from-neutral-100 via-white to-neutral-300 bg-clip-text text-transparent">
                {label}
              </h2>
              <div className="text-neutral-400 text-lg font-medium mb-4">
                {formattedDate}
              </div>
              {result && (
                <div
                  className={`inline-flex items-center gap-3 px-8 py-3 border-2 rounded-xl font-bold text-xl tracking-wide ${
                    result.legal
                      ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300 shadow-emerald-500/20'
                      : 'border-red-500/50 bg-red-950/50 text-red-300 shadow-red-500/20'
                  } shadow-lg backdrop-blur-sm`}
                >
                  <div
                    className={`w-3 h-3 rounded-full ${
                      result.legal ? 'bg-emerald-400' : 'bg-red-400'
                    } shadow-lg`}
                  ></div>
                  {result.legal ? 'TRADE APPROVED' : 'TRADE REJECTED'}
                </div>
              )}
            </div>
          </div>

          {/* Team cards layout - FIXED HEIGHT VERSION */}
          <div className="flex gap-10 justify-center items-stretch">
            {teams.map((tm, idx) => {
              if (!tm.team) return null;
              const { players, picks } = incomingAssets[idx] || {};
              const summary = result?.summaryByTeamIndex?.[idx];
              const capDelta = summary?.capDelta || 0;
              const { primary } = getTeamColors(tm.team.id) || {};

              return (
                <div key={tm.team.id} className="flex-1 max-w-md">
                  <div className="h-full flex flex-col bg-gradient-to-br from-neutral-800 via-neutral-850 to-neutral-900 border border-neutral-600/30 rounded-3xl shadow-2xl relative overflow-hidden">
                    {/* Team color top strip - prominent accent line */}
                    <div
                      className="absolute top-0 left-0 w-full h-2 z-10"
                      style={{ backgroundColor: primary }}
                    ></div>

                    {/* Card subtle glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent"></div>

                    <div className="relative z-10 p-8 flex flex-col flex-grow">
                      {/* Team header */}
                      <div className="text-center pb-6 border-b border-neutral-700/50">
                        <div className="relative mb-4">
                          <div className="absolute inset-0 bg-neutral-700/20 rounded-full blur-lg"></div>
                          <TeamLogo
                            teamId={tm.team.id}
                            className="relative w-24 h-24 mx-auto shadow-xl"
                          />
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-2 tracking-wide">
                          {tm.team.teamName}
                        </h3>
                      </div>

                      {/* Scrollable content area with fixed space for cap impact */}
                      <div className="flex-grow overflow-y-auto space-y-6 mb-6">
                        {/* Players section */}
                        <div className="space-y-4">
                          <h4 className="text-neutral-300 font-semibold text-xl uppercase tracking-wider border-l-4 border-neutral-500 pl-3">
                            Players Received
                          </h4>
                          <div className="bg-black/25 rounded-2xl p-4 border border-neutral-700/30 backdrop-blur-sm">
                            <div className="space-y-4">
                              {players.length ? (
                                players.map((p, i) => {
                                  const salary = getSalaryForYear([p], yearKey);
                                  const years = getYearsRemaining(
                                    p.contract_clean?.fa_year ||
                                      p.fa_year ||
                                      p.free_agency_year,
                                    parseInt(
                                      String(yearKey).match(/\d{4}/)?.[0] ||
                                        yearKey
                                    )
                                  );
                                  const headshot =
                                    p.headshotUrl ||
                                    p.headshot ||
                                    `/assets/headshots/${p.id || p.player_id}.png`;
                                  return (
                                    <div
                                      key={i}
                                      className="flex items-center gap-4 bg-neutral-800/40 rounded-xl p-4 border border-neutral-600/20"
                                    >
                                      <img
                                        src={headshot}
                                        alt={p.name}
                                        onError={(e) => {
                                          e.target.src =
                                            '/assets/headshots/default.png';
                                        }}
                                        className="w-16 h-16 object-cover rounded-lg bg-neutral-700 shadow-md"
                                      />
                                      <div className="flex-1">
                                        <div className="text-white font-bold text-lg">
                                          {p.display_name || p.name}
                                        </div>
                                        <div className="text-neutral-400 text-base font-medium">
                                          {formatSalary(salary)} • {years}y
                                          remaining
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-neutral-500 text-center py-6 italic text-lg">
                                  No players received
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Picks section */}
                        <div className="space-y-4">
                          <h4 className="text-neutral-300 font-semibold text-xl uppercase tracking-wider border-l-4 border-neutral-500 pl-3">
                            Picks Received
                          </h4>
                          <div className="space-y-3">
                            {picks.length ? (
                              picks.map((p, i) => (
                                <div
                                  key={i}
                                  className="bg-neutral-800/50 border border-neutral-600/30 rounded-xl px-5 py-3 text-neutral-200 font-medium text-lg backdrop-blur-sm"
                                >
                                  {formatPick(p)}
                                </div>
                              ))
                            ) : (
                              <div className="text-neutral-500 text-center py-3 italic text-lg">
                                No picks received
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Fixed position cap impact at bottom */}
                      <div className="mt-auto pt-4">
                        <div className="bg-gradient-to-r from-neutral-800/60 to-neutral-700/60 rounded-2xl p-6 border border-neutral-600/30 backdrop-blur-sm">
                          <div className="text-center">
                            <div className="text-neutral-400 text-lg font-medium uppercase tracking-wide mb-2">
                              Salary Cap Impact
                            </div>
                            <div
                              className={`text-4xl font-black tracking-wide ${
                                capDelta > 0
                                  ? 'text-red-400'
                                  : capDelta < 0
                                    ? 'text-emerald-400'
                                    : 'text-neutral-300'
                              }`}
                            >
                              {formatCurrency(capDelta)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
    // === REPLACEMENT BLOCK ENDS HERE ===
  }
);

export default TradeExportCapture;
