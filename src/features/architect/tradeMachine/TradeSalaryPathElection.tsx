import React from 'react';
import {
  createEmptyTradeSalaryMatchingElection,
  type TradeSalaryMatchingElection,
  type TradeSalaryMatchingPath,
} from '@/schemas/tradeSalaryMatchingPath';

type ElectionPlayer = {
  id?: string | number | null;
  player_id?: string | number | null;
  name?: string | null;
  bio?: { displayName?: string | null } | null;
};

type TradeSalaryPathElectionProps = {
  election?: TradeSalaryMatchingElection | null;
  outgoingPlayers: ElectionPlayer[];
  onChange: (election: TradeSalaryMatchingElection | null) => void;
  compact?: boolean;
};

const PATH_LABELS: Record<TradeSalaryMatchingPath, string> = {
  STANDARD_TPE: 'Standard TPE',
  AGGREGATED_STANDARD_TPE: 'Aggregated Standard TPE',
  ROOM: 'Room path',
};

function playerId(player: ElectionPlayer): string {
  return String(player.player_id ?? player.id ?? '');
}

function playerName(player: ElectionPlayer): string {
  return player.name ?? player.bio?.displayName ?? playerId(player) ?? 'Player';
}

export const TradeSalaryPathElection = ({
  election,
  outgoingPlayers,
  onChange,
  compact = false,
}: TradeSalaryPathElectionProps) => (
  <section
    className="rounded-md border border-cockpit-info/30 bg-cockpit-info/10 p-3 space-y-3"
    data-testid="trade-salary-path-election"
  >
    <div>
      <div className="text-xs font-semibold text-cockpit-info">Salary path</div>
      <div className="text-[11px] text-cockpit-text-muted">
        Choose the legal component this team is using. Validation stays blocked
        until every exact input is supplied.
      </div>
    </div>

    <label className="block text-xs text-cockpit-text-secondary">
      Elected path
      <select
        aria-label="Elected path"
        className="mt-1 w-full rounded border border-cockpit-edge bg-cockpit-raised px-2 py-1.5 text-cockpit-text-primary"
        value={election?.path ?? ''}
        onChange={(event) => {
          const path = event.target.value as TradeSalaryMatchingPath | '';
          onChange(path ? createEmptyTradeSalaryMatchingElection(path) : null);
        }}
      >
        <option value="">Select a path…</option>
        {Object.entries(PATH_LABELS).map(([path, label]) => (
          <option key={path} value={path}>
            {label}
          </option>
        ))}
      </select>
    </label>

    {election && (
      <>
        <label className="block text-xs text-cockpit-text-secondary">
          Post-assignment Apron Team Salary
          <input
            aria-label="Post-assignment Apron Team Salary"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className="mt-1 w-full rounded border border-cockpit-edge bg-cockpit-raised px-2 py-1.5 font-mono text-cockpit-text-primary"
            placeholder="Exact amount"
            value={election.postAssignmentApronTeamSalary ?? ''}
            onChange={(event) =>
              onChange({
                ...election,
                postAssignmentApronTeamSalary:
                  event.target.value === '' ? null : Number(event.target.value),
              })
            }
          />
          <span className="mt-1 block text-[10px] text-cockpit-text-muted">
            Exact Apron Team Salary—not projected Team Salary—determines whether
            the $250,000 allowance remains.
          </span>
        </label>

        {outgoingPlayers.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-cockpit-text-secondary">
              Exact pre-trade Salary by Traded Player
            </div>
            {outgoingPlayers.map((player) => {
              const id = playerId(player);
              return (
                <label
                  key={id}
                  className={`grid items-center gap-2 text-[11px] text-cockpit-text-muted ${
                    compact ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_8rem]'
                  }`}
                >
                  <span className="truncate">{playerName(player)}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    aria-label={`${playerName(player)} exact pre-trade Salary`}
                    className="rounded border border-cockpit-edge bg-cockpit-raised px-2 py-1 font-mono text-cockpit-text-primary"
                    placeholder="Exact amount"
                    value={election.tradedPlayerPreTradeSalaries[id] ?? ''}
                    onChange={(event) => {
                      const next = {
                        ...election.tradedPlayerPreTradeSalaries,
                      };
                      if (event.target.value === '') delete next[id];
                      else next[id] = Number(event.target.value);
                      onChange({
                        ...election,
                        tradedPlayerPreTradeSalaries: next,
                      });
                    }}
                  />
                </label>
              );
            })}
            <div className="text-[10px] text-cockpit-text-muted">
              This governed input carries any required pre-trade Salary
              adjustment; the generic matching estimate is never substituted.
            </div>
          </div>
        )}
      </>
    )}
  </section>
);
