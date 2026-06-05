import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { TeamLogo } from '@/shared/components/TeamLogo';
import { getYearsRemaining } from '@/shared/utils/contracts';
import { formatSalary } from '@/shared/utils/formatting';
import { getTeamColors } from '@/shared/utils/formatting/teamColors';
import {
  formatCurrency,
  getSalaryForYear,
} from '@/features/architect/utils/tradeHelpers';
import { getEntitlementKindBadge } from '@/features/architect/tradeMachine/utils/entitlementWarnings';
import {
  formatEntitlementTermsShort,
  normalizeEntitlementTerms,
} from '@/features/architect/utils/entitlements/entitlementTerms';
import { sanitizeEntitlement } from '@/features/architect/utils/entitlements/sanitizeVacuumMetadata';
import type {
  IncomingTradeAssets,
  TradeExportCaptureProps,
  TradePreviewEntitlementLike,
  TradePreviewPlayerLike,
} from './tradePreviewExportTypes';

const toStringKey = (value: string | number | null | undefined): string | undefined =>
  value === null || value === undefined ? undefined : String(value);

const toSeasonYear = (value: string | number | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const year = Number(value.match(/\d{4}/)?.[0]);
    return Number.isFinite(year) ? year : null;
  }

  return null;
};

const TradeExportCapture = React.forwardRef<HTMLDivElement, TradeExportCaptureProps>(
  function TradeExportCapture(
    {
      teams = [],
      previewAuthority,
      snapshotValidationDetails,
      yearKey,
      label = 'Trade Summary',
      date = new Date(),
    },
    ref
  ) {
    const captureDate = date ?? new Date();
    const formattedDate = format(
      captureDate instanceof Date ? captureDate : new Date(captureDate),
      'MMMM d, yyyy'
    );

    // 🧮 Preprocess incoming assets by team (Phase 15: entitlements-only)
    // TMUI-18: memoized so the height-measuring effect doesn't re-run every render
    const incomingAssets: IncomingTradeAssets[] = useMemo(() => teams.map((tm, idx) => {
      const players: TradePreviewPlayerLike[] = [];
      const entitlements: TradePreviewEntitlementLike[] = [];
      const targetTeam = tm.team;
      const targetTeamId = targetTeam?.id ?? targetTeam?.teamId;

      teams.forEach((t, j) => {
        const sourceTeam = t.team;
        if (j !== idx && sourceTeam) {
          (t.sends || []).forEach((p) => {
            if (
              !p.tradeTo ||
              p.tradeTo === targetTeamId
            ) {
              players.push({
                ...p,
                originTeamId: p.originTeamId || p.teamId || sourceTeam.id,
              });
            }
          });

          // Phase 15: Use entitlementsOut instead of picksOut
          (t.entitlementsOut || []).forEach((e) => {
            if (
              !e.toTeamId ||
              e.toTeamId === targetTeamId
            ) {
              entitlements.push(
                sanitizeEntitlement({
                  ...e,
                  fromTeamId: e.fromTeamId || sourceTeam.id,
                }) as TradePreviewEntitlementLike
              );
            }
          });
        }
      });

      return { players, entitlements };
    }), [teams]);

    const playerRefs = useRef<Array<HTMLDivElement | null>>([]);
    const [maxHeight, setMaxHeight] = useState(0);
    const activeCount = teams.filter((t) => t.team).length;

    useEffect(() => {
      const heights = playerRefs.current.map((playerRef) => playerRef?.offsetHeight || 0);
      const tallest = Math.max(...heights);
      setMaxHeight(tallest);
    }, [teams, incomingAssets]);

    return (
      <div
        ref={ref}
        className="w-[1200px] bg-[#0b0b0b] text-white rounded-xl overflow-hidden shadow-2xl border border-white/10"
        style={{ fontFamily: 'AntonLocal, AntonBase64, sans-serif' }}
      >
        {/* 🧾 Font Preload - forces AntonLocal to render before html2canvas capture */}
        <div
          style={{
            opacity: 0,
            position: 'absolute',
            fontFamily: 'AntonLocal, AntonBase64, sans-serif',
          }}
        >
          preload
        </div>

        <div className="bg-[#111] border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <div className="text-4xl tracking-wider uppercase font-extrabold">
            {label}
          </div>
          <div className="text-sm text-neutral-400">{formattedDate}</div>
        </div>

        {/* 🧱 Team Cards */}
        <div className="flex flex-wrap justify-center gap-6 p-6">
          {teams.map((tm, idx) => {
            if (!tm.team) return null;
            const { players, entitlements } = incomingAssets[idx] || {};
            const summary = snapshotValidationDetails?.summaryByTeamIndex?.find(
              (s) => s?.teamName === tm.team?.teamName
            );
            const capDelta = summary?.capDelta || 0;
            const { primary } = getTeamColors(toStringKey(tm.team.id));

            return (
              <div
                key={tm.team.id}
                className="shrink-0"
                style={{
                  width: Math.min(
                    420,
                    Math.floor(
                      (1152 - (activeCount - 1) * 24) / Math.min(activeCount, 3)
                    )
                  ),
                }}
              >
                <div className="h-full flex flex-col bg-gradient-to-br from-neutral-800 via-neutral-850 to-neutral-900 border border-neutral-600/30 rounded-3xl shadow-2xl relative overflow-hidden">
                  {/* 🟥 Top Border Accent */}
                  <div
                    className="absolute top-0 left-0 w-full h-2 z-10"
                    style={{ backgroundColor: primary }}
                  ></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent"></div>

                  <div className="relative z-10 p-6 flex flex-col flex-grow">
                    {/* 🧢 Team Info */}
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
                      {/* 🧍 Player Row */}
                      <div
                        ref={(el) => {
                          playerRefs.current[idx] = el;
                        }}
                        className="space-y-3"
                        style={{ minHeight: maxHeight }}
                      >
                        <h4 className="text-neutral-300 font-semibold text-sm uppercase tracking-wide border-l-4 border-neutral-500 pl-3">
                          Players Received
                        </h4>
                        <div className="bg-black/25 rounded-2xl p-3 border border-neutral-700/30 backdrop-blur-sm space-y-3">
                          {players.length ? (
                            players.map((p, i) => {
                              // Phase 2.2: Export uses BASE salary only (roster reality)
                              // Matching values should never appear here unless explicitly labeled
                              const baseSalary =
                                p.baseSalary ?? getSalaryForYear([p], yearKey);
                              const years = getYearsRemaining(
                                toSeasonYear(
                                  p.contract?.freeAgency?.year ??
                                    p.fa_year ??
                                    p.freeAgentYear
                                ),
                                toSeasonYear(yearKey) ?? undefined
                              );
                              const headshot =
                                p.headshotUrl ||
                                p.headshot ||
                                `/assets/headshots/${p.id || p.player_id}.png`;

                              return (
                                <div
                                  key={i}
                                  className="flex items-center gap-4 bg-neutral-800/40 rounded-xl px-3 py-2 border border-neutral-600/20"
                                >
                                  <img
                                    src={headshot}
                                    alt={p.name}
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        '/assets/headshots/default.png';
                                    }}
                                    className="w-14 h-14 object-cover rounded-lg bg-neutral-700 shadow-md"
                                  />
                                  <div className="flex flex-col justify-center flex-1 overflow-hidden">
                                    <div className="text-white font-semibold text-[15px] truncate">
                                      {p.bio?.displayName || p.name}
                                    </div>
                                    <div className="text-neutral-400 text-xs font-medium">
                                      {baseSalary ? formatSalary(baseSalary) : '—'} • {years}{' '}
                                      yrs
                                    </div>
                                  </div>
                                  <TeamLogo
                                    teamId={
                                      p.originTeamId ||
                                      p.teamId ||
                                      p.team ||
                                      p.teamAbbr ||
                                      p.bio?.display?.team
                                    }
                                    className="w-8 h-8 ml-2 shrink-0"
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

                      {/* 🧾 Entitlements Section (Phase 15) */}
                      <div className="min-h-[150px] mt-6 flex flex-col justify-end">
                        <h4 className="text-neutral-300 font-semibold text-sm uppercase tracking-wide border-l-4 border-neutral-500 pl-3">
                          Entitlements Received
                        </h4>
                        <div className="space-y-2 min-h-[60px] mt-2">
                          {entitlements.length ? (
                            entitlements.map((e, i) => {
                              const badge = getEntitlementKindBadge(e.kind);
                              const termsShort =
                                typeof e.termsShort === 'string'
                                  ? e.termsShort
                                  : formatEntitlementTermsShort(
                                      normalizeEntitlementTerms({ ...e })
                                    );

                              return (
                                <div
                                  key={e.id || e.entitlementId || i}
                                  className="flex flex-col bg-neutral-800/50 border border-neutral-600/30 rounded-xl px-4 py-2 text-neutral-200 font-medium text-sm backdrop-blur-sm"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span>
                                        {e.seasonYear} R{e.round}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.colorClass}`}
                                      >
                                        {badge.label}
                                      </span>
                                    </div>
                                    <TeamLogo
                                      teamId={
                                        e.originalTeam ||
                                        e.originTeamId ||
                                        e.fromTeamId
                                      }
                                      className="w-5 h-5 ml-2 shrink-0"
                                    />
                                  </div>
                                  {termsShort ? (
                                    <div className="text-[10px] text-neutral-400 mt-1 truncate">
                                      {termsShort}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-neutral-500 text-center py-2 italic text-sm">
                              No entitlements received
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 💰 Cap Impact */}
                      <div className="mt-4">
                        <div className="bg-gradient-to-r from-neutral-800/60 to-neutral-700/60 rounded-xl p-2 border border-neutral-600/30 backdrop-blur-sm text-center">
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

        {/* P1: Base vs Matching disclaimer note */}
        <div className="text-center text-xs text-neutral-500 py-2 border-t border-neutral-700/30">
          Salaries shown are base contract values. Matching values for trade
          legality may differ (BYC, trade kicker, poison pill adjustments).
        </div>

        {/* ✅ Trade Result Footer */}
        {previewAuthority && (
          <div className="border-t border-black/20 relative -mt-1">
            {' '}
            {/* Subtle pull-up */}
            {/* Depth shadow - perfectly aligned */}
            <div className="absolute inset-x-0 bottom-0 h-4 bg-black/30 blur-md"></div>
            {/* Main footer - full width, proper depth */}
            <div
              className="w-full text-center py-4 text-xl font-bold uppercase tracking-wider text-white"
              style={{
                background: previewAuthority.legal
                  ? 'linear-gradient(to bottom, #14532d, #15803d)'
                  : 'linear-gradient(to bottom, #7f1d1d, #991b1b)',
                boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.3)',
                position: 'relative',
                zIndex: 10,
              }}
            >
              {previewAuthority.legal ? 'Trade Passed' : 'Trade Failed'}
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default TradeExportCapture;
