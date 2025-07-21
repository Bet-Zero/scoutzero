// TradeTeamCard.jsx

import React from 'react';
import { TeamList } from '@/constants/teamList';
import TeamLogo from '@/components/shared/TeamLogo';
import { getTeamColors } from '@/utils/formatting';
import {
  getSalaryForYear,
  areSamePick,
  formatPick,
  formatCurrency,
} from '@/utils/architect/tradeHelpers';
import { formatSalary } from '@/utils/formatting';

const TradeTeamCard = ({
  team,
  sends,
  picks,
  yearKey,
  tradePartnerName,
  incomingPlayers = [],
  incomingPicks = [],
  capImpact = null,
  onSetPlayerTrade,
  onTogglePick,
  onEditPick,
  onSelectTeam,
  onRemove,
}) => {
  if (!team) {
    return (
      <div className="flex-1 border border-white/20 rounded-lg p-4 bg-[#1a1a1a] relative">
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 text-red-400 text-xs"
          >
            ✕
          </button>
        )}
        <label className="text-sm mb-1 block text-white/80">Select Team</label>
        <select
          className="w-full bg-[#111] text-white p-2 rounded text-sm"
          onChange={(e) => onSelectTeam(e.target.value)}
        >
          <option value="">Select Team</option>
          {TeamList.map((t) => (
            <option key={t} value={t.toLowerCase()}>
              {t}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const outgoingSalary = getSalaryForYear(sends, yearKey);
  const { primary } = getTeamColors(team.teamName);

  return (
    <div
      className="flex-1 rounded-lg p-4 bg-[#111] relative space-y-4 shadow-inner border"
      style={{ borderColor: primary }}
    >
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 text-red-400 text-xs"
        >
          ✕
        </button>
      )}

      {/* Team Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <TeamLogo teamAbbr={team.teamName} className="w-8 h-8" />
          <h3 className="text-lg font-semibold" style={{ color: primary }}>
            {team.teamName}
          </h3>
        </div>
        <div className="text-sm text-white/60">
          Outgoing Salary:{' '}
          <span className="font-medium">{formatCurrency(outgoingSalary)}</span>
        </div>
      </div>

      {/* Outgoing Players */}
      <div>
        <h4 className="text-sm text-white/70 mb-1">Outgoing Players</h4>
        <div className="space-y-1">
          {team.players?.map((p) => {
            const included = sends.includes(p);
            const salary =
              p.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;
            return (
              <div
                key={p.id || p.name}
                className={`flex items-center px-3 py-1 rounded-md text-sm transition-colors ${
                  included ? 'bg-green-800/40' : 'bg-white/10'
                }`}
              >
                <span className="flex-1">{p.name}</span>
                <span className="w-20 text-right text-white/70">
                  {formatSalary(salary)}
                </span>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() =>
                      onSetPlayerTrade(p, included ? 'keep' : 'trade')
                    }
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {included ? 'Remove' : 'Trade'}
                  </button>
                  {included && (
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={!!p.signAndTrade}
                        onChange={() =>
                          onSetPlayerTrade(p, 'signAndTrade', !p.signAndTrade)
                        }
                      />
                      S&T
                    </label>
                  )}
                </div>
              </div>
            );
          })}
          {team.players?.length === 0 && (
            <div className="text-xs text-white/40">No players available</div>
          )}
        </div>
      </div>

      {/* Outgoing Picks */}
      <div>
        <h4 className="text-sm text-white/70 mb-1">Outgoing Picks</h4>
        <div className="space-y-1">
          {team.picks?.map((p) => {
            const exists = picks.some((pk) => areSamePick(pk, p));
            return (
              <div
                key={`${p.year}-${p.round}-${p.via || ''}`}
                className={`flex items-start justify-between px-3 py-1 rounded-md text-xs transition-colors ${
                  exists ? 'bg-purple-800/30' : 'bg-white/10'
                }`}
              >
                <div>
                  <div>{formatPick(p)}</div>
                  {exists && (
                    <div className="text-white/50 mt-1 space-y-1">
                      <input
                        className="bg-black/30 p-1 rounded w-full"
                        value={p.protection || ''}
                        placeholder="Protection"
                        onChange={(e) =>
                          onEditPick(p, 'protection', e.target.value)
                        }
                      />
                      <input
                        className="bg-black/30 p-1 rounded w-full"
                        value={p.note || ''}
                        placeholder="Note"
                        onChange={(e) => onEditPick(p, 'note', e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onTogglePick(p)}
                  className="text-blue-400 hover:underline"
                >
                  {exists ? 'Remove' : 'Trade'}
                </button>
              </div>
            );
          })}
          {team.picks?.length === 0 && (
            <div className="text-xs text-white/40">No picks available</div>
          )}
        </div>
      </div>

      {/* Incoming Summary */}
      {(incomingPlayers.length > 0 || incomingPicks.length > 0) && (
        <div
          className="bg-[#222] border rounded p-3 text-sm"
          style={{ borderColor: primary }}
        >
          <h4 className="text-white/70 text-sm mb-2">Incoming</h4>
          <div className="text-white/90">
            {incomingPlayers.map((p) => (
              <div key={p.id || p.name} className="mb-1">
                • {p.name}
              </div>
            ))}
            {incomingPicks.map((p) => (
              <div key={`${p.year}-${p.round}-${p.via || ''}`}>
                • {formatPick(p)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeTeamCard;
