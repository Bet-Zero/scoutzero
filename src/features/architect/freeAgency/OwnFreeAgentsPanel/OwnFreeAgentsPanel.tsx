/**
 * FILE: src/features/architect/freeAgency/OwnFreeAgentsPanel/OwnFreeAgentsPanel.tsx
 * PURPOSE: The Free Agency room's sign-and-trade start point for the GM's own
 *          free agents (BZE-249). Lists the team's own free agents — the same
 *          set the Full Cap Table shows as FA decision rows — each with a
 *          Sign & Trade action that hands the player to the Trade Machine via
 *          the proven `openTradeForSignAndTrade` seed.
 * OWNERSHIP: Feature: architect/freeAgency (own free agents)
 *
 * Re-sign and absolve stay on the Full Cap Table own-FA row (owner-decided W6
 * placement); this panel adds only the Free Agency start point for W8.
 */

import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { OwnFreeAgentEntry } from '@/features/architect/utils/ownFreeAgents';

export interface OwnFreeAgentsPanelProps {
  ownFreeAgents: OwnFreeAgentEntry[];
  /** Hands the free agent to the Trade Machine as a sign-and-trade seed. */
  onSignAndTrade: (player: Record<string, unknown>) => void;
}

const formatMoney = (amount: number) => `$${Number(amount || 0).toLocaleString()}`;

const TAG_STYLES: Record<string, string> = {
  UFA: 'border-cockpit-info/40 bg-cockpit-info/15 text-cockpit-info',
  RFA: 'border-cockpit-watch/40 bg-cockpit-watch/15 text-cockpit-watch',
};

const FaTag = ({ faType }: { faType: string }) => (
  <span
    className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
      TAG_STYLES[faType] ||
      'border-cockpit-edge bg-cockpit-raised text-cockpit-text-secondary'
    }`}
  >
    {faType}
  </span>
);

export const OwnFreeAgentsPanel = ({
  ownFreeAgents,
  onSignAndTrade,
}: OwnFreeAgentsPanelProps) => {
  if (ownFreeAgents.length === 0) return null;

  return (
    <section
      data-testid="own-free-agents-panel"
      aria-label="Your free agents"
      className="shrink-0 rounded-md border border-cockpit-edge bg-cockpit-raised"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-cockpit-edge px-3 py-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-secondary">
          Your Free Agents
        </h3>
        <p className="truncate text-[10px] text-cockpit-text-muted">
          Sign &amp; trade below · re-sign or absolve on the Full Cap Table
        </p>
      </div>
      <ul className="max-h-[150px] divide-y divide-cockpit-edge overflow-y-auto">
        {ownFreeAgents.map((entry) => (
          <li
            key={entry.key}
            data-testid="own-free-agent-row"
            className="flex items-center gap-2.5 px-3 py-1.5"
          >
            <FaTag faType={entry.faType} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-cockpit-text-primary">
              {entry.playerName}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-cockpit-text-muted">
              {formatMoney(entry.capHoldAmount)} hold
            </span>
            <button
              type="button"
              data-testid="own-free-agent-sign-and-trade-button"
              onClick={() =>
                onSignAndTrade(
                  (entry.player ?? {
                    playerId: entry.playerId,
                    displayName: entry.playerName,
                  }) as Record<string, unknown>
                )
              }
              title={`Sign & Trade ${entry.playerName} — assemble the deal in the Trade Machine`}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-cockpit-info/40 bg-cockpit-info/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cockpit-info transition-colors hover:bg-cockpit-info/25"
            >
              <ArrowLeftRight size={11} />
              Sign &amp; Trade
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
