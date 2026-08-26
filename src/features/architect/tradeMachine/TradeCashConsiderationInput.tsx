import React from 'react';
import type { TeamOptionLike } from '@/features/architect/tradeMachine/TradeTeamCard.helpers';

interface TradeCashConsiderationInputProps {
  teamLabel: string;
  cashSent: number;
  cashToTeamId: string | null;
  otherTeams: TeamOptionLike[];
  disabled: boolean;
  onChange: (cashSent: number, cashToTeamId: string | null) => void;
}

function teamId(team: TeamOptionLike): string {
  return String(team.teamCode ?? team.id ?? '').trim();
}

function teamLabel(team: TeamOptionLike): string {
  return String(
    team.teamName ??
      team.name ??
      team.nickname ??
      team.teamCode ??
      team.id ??
      ''
  ).trim();
}

export function TradeCashConsiderationInput({
  teamLabel: sourceTeamLabel,
  cashSent,
  cashToTeamId,
  otherTeams,
  disabled,
  onChange,
}: TradeCashConsiderationInputProps) {
  const recipients = otherTeams
    .map((team) => ({ id: teamId(team), label: teamLabel(team) }))
    .filter((team) => team.id && team.label);
  const onlyRecipient = recipients.length === 1 ? recipients[0] : null;
  const selectedRecipient = cashToTeamId ?? onlyRecipient?.id ?? '';

  return (
    <section className="border-y border-cockpit-edge py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <label className="min-w-0 text-[11px] text-cockpit-text-secondary">
          Cash sent
          <div className="mt-1 flex h-8 items-center rounded-md border border-cockpit-edge bg-cockpit-raised px-2 focus-within:border-cockpit-info">
            <span className="mr-1 text-cockpit-text-muted">$</span>
            <input
              aria-label={`${sourceTeamLabel} cash sent`}
              className="min-w-0 flex-1 bg-transparent text-right text-xs text-cockpit-text-primary outline-none"
              disabled={disabled}
              inputMode="decimal"
              min="0"
              placeholder="0.00"
              step="0.01"
              type="number"
              value={cashSent || ''}
              onChange={(event) => {
                const raw = event.target.value;
                const amount = raw === '' ? 0 : Number(raw);
                if (Number.isFinite(amount) && amount >= 0) {
                  onChange(
                    amount,
                    amount > 0 ? selectedRecipient || null : null
                  );
                }
              }}
            />
          </div>
        </label>

        <label className="min-w-0 text-[11px] text-cockpit-text-secondary">
          Recipient
          <select
            aria-label={`${sourceTeamLabel} cash recipient`}
            className="mt-1 h-8 w-full truncate rounded-md border border-cockpit-edge bg-cockpit-raised px-2 text-xs text-cockpit-text-primary outline-none focus:border-cockpit-info disabled:text-cockpit-text-muted"
            disabled={disabled || cashSent <= 0 || recipients.length <= 1}
            value={selectedRecipient}
            onChange={(event) => onChange(cashSent, event.target.value || null)}
          >
            <option value="">Select team</option>
            {recipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
