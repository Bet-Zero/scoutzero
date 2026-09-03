import React, { useState } from 'react';
import { formatCurrency } from '@/features/architect/utils/tradeHelpers';
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

const CurrencyInput = ({
  value,
  onChange,
  ariaLabel,
  className,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  ariaLabel: string;
  className: string;
}) => {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <input
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder="$0"
      value={focused ? draft : value == null ? '' : formatCurrency(value)}
      onFocus={() => {
        setDraft(value == null ? '' : String(value));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        const normalized = event.target.value.replace(/[^\d.-]/g, '');
        setDraft(normalized);
        if (!normalized) return onChange(null);
        const nextValue = Number(normalized);
        if (Number.isFinite(nextValue) && nextValue >= 0) onChange(nextValue);
      }}
    />
  );
};

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
        Choose how this team will match salary. Complete every required amount
        before validation.
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
          Apron salary after the trade
          <CurrencyInput
            ariaLabel="Post-assignment Apron Team Salary"
            className="mt-1 w-full rounded border border-cockpit-edge bg-cockpit-raised px-2 py-1.5 font-mono text-cockpit-text-primary"
            value={election.postAssignmentApronTeamSalary ?? null}
            onChange={(value) =>
              onChange({
                ...election,
                postAssignmentApronTeamSalary: value,
              })
            }
          />
          <span className="mt-1 block text-[10px] text-cockpit-text-muted">
            The $250,000 trade allowance is based on this amount.
          </span>
        </label>

        {outgoingPlayers.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-cockpit-text-secondary">
              Player salaries used for this trade
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
                  <CurrencyInput
                    ariaLabel={`${playerName(player)} exact pre-trade Salary`}
                    className="rounded border border-cockpit-edge bg-cockpit-raised px-2 py-1 font-mono text-cockpit-text-primary"
                    value={election.tradedPlayerPreTradeSalaries[id] ?? null}
                    onChange={(value) => {
                      const next = {
                        ...election.tradedPlayerPreTradeSalaries,
                      };
                      if (value === null) delete next[id];
                      else next[id] = value;
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
              Enter the salary used for each player in this trade.
            </div>
          </div>
        )}
      </>
    )}
  </section>
);
