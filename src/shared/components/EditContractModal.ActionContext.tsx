import React from 'react';

type ContractActionContextProps = {
  title: string;
  stageLabel: string;
  playerName: string;
  seasonLabel: string | null;
};

export const ContractActionContext = ({
  title,
  stageLabel,
  playerName,
  seasonLabel,
}: ContractActionContextProps) => (
  <div
    data-testid="contract-modal-action-context"
    className="mb-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
  >
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Team Plan action
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-white">{title}</span>
          <span
            data-testid="contract-modal-action-stage"
            className="rounded border border-orange-400/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200"
          >
            {stageLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded border border-white/10 bg-black/25 px-2.5 py-1 font-medium text-white/80">
          {playerName}
        </span>
        {seasonLabel && (
          <span className="rounded border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 font-mono font-semibold text-cyan-100">
            {seasonLabel}
          </span>
        )}
      </div>
    </div>
  </div>
);
