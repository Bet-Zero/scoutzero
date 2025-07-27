import React, { useEffect, useRef, useState } from 'react';
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
              players.push({
                ...p,
                originTeamId: p.originTeamId || p.teamId || t.team.id,
              });
            }
          });
          t.picksOut.forEach((p) => {
            if (
              !p.toTeamId ||
              p.toTeamId === tm.team?.id ||
              p.toTeamId === tm.team?.teamId
            ) {
              picks.push({
                ...p,
                fromTeamId: p.fromTeamId || t.team.id,
              });
            }
          });
        }
      });
      return { players, picks };
    });

    const playerRefs = useRef([]);
    const [maxHeight, setMaxHeight] = useState(0);

    useEffect(() => {
      const heights = playerRefs.current.map((ref) => ref?.offsetHeight || 0);
      const tallest = Math.max(...heights);
      setMaxHeight(tallest);
    }, [teams]);

    return (
      <div
        ref={ref}
        className="w-[1200px] bg-[#0b0b0b] text-white rounded-xl overflow-hidden shadow-2xl border border-white/10"
        style={{ fontFamily: 'AntonLocal, sans-serif' }}
      >
        <div style={{ opacity: 0, position: 'absolute' }}>preload</div>

        {/* Header */}
        <div className="bg-[#111] border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <div className="text-4xl tracking-wider uppercase font-extrabold">
            {label}
          </div>
          <div className="text-sm text-neutral-400">{formattedDate}</div>
        </div>

        {/* Team cards layout */}
        <div className="flex flex-wrap justify-center gap-6 p-6">
          {teams.map((tm, idx) => {
            if (!tm.team) return null;
            const { players, picks } = incomingAssets[idx] || {};
            const summary = result?.summaryByTeamIndex?.[idx];
            const capDelta = summary?.capDelta || 0;
            const { primary } = getTeamColors(tm.team.id) || {};

            return (
              <div key={tm.team.id} className="w-[420px] shrink-0">
                <div className="h-full flex flex-col bg-gradient-to-br from-neutral-800 via-neutral-850 to-neutral-900 border border-neutral-600/30 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 w-full h-2 z-10"
                    style={{ backgroundColor: primary }}
                  ></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent"></div>

                  <div className="relative z-10 p-6 flex flex-col flex-grow">
                    <div className="text-center pb-4 border-b border-neutral-700/50">
                      <div className="relative mb-3">
                        <div className="absolute inset-0 bg-neutral-700/20 rounded-full blur-lg"></div>
                        <TeamLogo
                          teamId={tm.team.id}
                          className="relative w-20 h-20 mx-auto shadow-xl"
                        />
                      </div>
                      <h3 className="text-2xl font-bold text-white tracking-wide">
                        {tm.team.teamName}
                      </h3>
                    </div>

                    <div className="flex flex-col flex-grow mt-4">
                      {/* Players Received */}
                      <div
                        ref={(el) => (playerRefs.current[idx] = el)}
                        className="space-y-3"
                        style={{ minHeight: maxHeight }}
                      >
                        <h4 className="text-neutral-300 font-semibold text-sm uppercase tracking-wide border-l-4 border-neutral-500 pl-3">
                          Players Received
                        </h4>
                        <div className="bg-black/25 rounded-2xl p-3 border border-neutral-700/30 backdrop-blur-sm space-y-3">
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
                                  className="flex items-center gap-3 bg-neutral-800/40 rounded-xl p-3 border border-neutral-600/20"
                                >
                                  <img
                                    src={headshot}
                                    alt={p.name}
                                    onError={(e) => {
                                      e.target.src =
                                        '/assets/headshots/default.png';
                                    }}
                                    className="w-12 h-12 object-cover rounded-md bg-neutral-700 shadow-md"
                                  />
                                  <div className="flex-1">
                                    <div className="text-white font-bold text-base">
                                      {p.display_name || p.name}
                                    </div>
                                    <div className="text-neutral-400 text-sm font-medium">
                                      {formatSalary(salary)} • {years} yrs
                                    </div>
                                  </div>
                                  <TeamLogo
                                    teamId={
                                      p.originTeamId ||
                                      p.teamId ||
                                      p.team ||
                                      p.teamAbbr ||
                                      p.bio?.Team
                                    }
                                    className="w-6 h-6 ml-2 shrink-0"
                                  />
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-neutral-500 text-center py-4 italic text-sm">
                              No players received
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Picks Received */}
                      <div className="mt-6 space-y-3">
                        <h4 className="text-neutral-300 font-semibold text-sm uppercase tracking-wide border-l-4 border-neutral-500 pl-3">
                          Picks Received
                        </h4>
                        <div className="space-y-2 min-h-[60px]">
                          {picks.length ? (
                            picks.map((p, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between bg-neutral-800/50 border border-neutral-600/30 rounded-xl px-4 py-2 text-neutral-200 font-medium text-sm backdrop-blur-sm"
                              >
                                <span>{formatPick(p)}</span>
                                <TeamLogo
                                  teamId={
                                    p.fromTeamId ||
                                    p.originTeamId ||
                                    p.teamId ||
                                    p.teamAbbr ||
                                    p.team
                                  }
                                  className="w-5 h-5 ml-2 shrink-0"
                                />
                              </div>
                            ))
                          ) : (
                            <div className="text-neutral-500 text-center py-2 italic text-sm">
                              No picks received
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cap Impact */}
                      <div className="mt-auto pt-3">
                        <div className="bg-gradient-to-r from-neutral-800/60 to-neutral-700/60 rounded-xl p-3 border border-neutral-600/30 backdrop-blur-sm text-center">
                          <div className="text-neutral-400 text-xs font-medium uppercase tracking-widest mb-1">
                            Cap Impact
                          </div>
                          <div
                            className={`text-xl font-extrabold tracking-wide ${
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

        {/* Footer */}
        {result && (
          <div
            className={`text-center py-3 text-xl font-bold uppercase tracking-wider ${
              result.legal ? 'bg-green-700 text-black' : 'bg-red-700 text-black'
            }`}
          >
            {result.legal ? 'Trade Passed' : 'Trade Failed'}
          </div>
        )}
      </div>
    );
  }
);

export default TradeExportCapture;
