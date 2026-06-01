import React from 'react';
import { formatCurrency, formatCurrencyFull } from '@/shared/utils/formatting';
import type { ContractYearWithNumberYear } from './EditContractModal.types';

type ContractSummary = {
  totalValue: number;
  totalYears: number;
  remainingValue: number;
  remainingYears: number;
  extensionValue: number;
  extensionYears: number;
};

type FreeAgencyYear = {
  year: number;
  season: string;
  qualifyingOffer: number | null;
  capHold: number | null;
  isRFA: boolean;
};

type ContractSummaryPanelProps = {
  summary: ContractSummary;
  contractYears: ContractYearWithNumberYear[];
  currentYear: number;
  freeAgencyYears?: FreeAgencyYear[];
};

export const ContractSummaryPanel = ({
  summary,
  contractYears,
  currentYear,
  freeAgencyYears = [],
}: ContractSummaryPanelProps) => (
  // No internal scroll — the panel sizes to its content so every contract
  // year stays visible.
  <div className="w-full lg:w-[35%] bg-[#161616] border-r border-white/10 flex flex-col">
    <div className="flex flex-1 flex-col px-8 pt-5 pb-6">
      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-white tracking-tight">
          {formatCurrency(summary.totalValue)}{' '}
          <span className="text-white/40 mx-1">-</span> {summary.totalYears} yrs
        </div>
        <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">
          Total Contract
        </div>
      </div>

      <div className="space-y-1">
        {contractYears
          .filter((y) => {
            if (summary.extensionYears > 0) return y.year >= currentYear;
            return true;
          })
          .map((y) => {
            const isFuture = y.year > currentYear;
            const isCurrent = y.year === currentYear;
            const isOption = !!y.option;
            const isExtension = y.isExtension;
            return (
              <div
                key={y.year}
                className={`flex items-center justify-between py-1.5 px-3 rounded-lg text-sm ${
                  isCurrent
                    ? 'bg-white/10'
                    : isExtension
                      ? 'bg-cyan-500/10 border border-cyan-500/20'
                      : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white/60">
                    {y.season}
                  </span>
                  {isExtension && (
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                      EXT
                    </span>
                  )}
                  {isOption && (
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        y.option === 'TO' || y.option === 'Team Option'
                          ? 'text-orange-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {y.option}
                    </span>
                  )}
                </div>
                <span
                  className={`font-mono text-sm ${
                    isOption
                      ? y.option === 'TO' || y.option === 'Team Option'
                        ? 'text-orange-400 font-bold'
                        : 'text-emerald-400 font-bold'
                      : isExtension
                        ? 'text-cyan-300 font-bold'
                        : isFuture || isCurrent
                          ? 'text-white font-medium'
                          : 'text-white/60'
                  }`}
                >
                  {formatCurrencyFull(y.salary)}
                </span>
              </div>
            );
          })}

        {freeAgencyYears.map((fa) => {
          const primary = fa.qualifyingOffer ?? fa.capHold ?? 0;
          const isQO = fa.qualifyingOffer != null;
          return (
            <div
              key={`fa-${fa.year}`}
              data-testid="contract-modal-fa-year"
              className="flex items-center justify-between py-1.5 px-3 rounded-lg text-sm bg-white/[0.04] border border-white/5"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white/50">
                  {fa.season}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isQO ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {isQO ? 'QO' : 'Hold'}
                </span>
              </div>
              <div className="text-right leading-tight">
                <span
                  data-testid={
                    isQO
                      ? 'contract-modal-qualifying-offer'
                      : 'contract-modal-cap-hold'
                  }
                  className={`font-mono text-sm font-bold ${
                    isQO ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {formatCurrencyFull(primary)}
                </span>
                {isQO && fa.capHold != null && (
                  <div
                    data-testid="contract-modal-cap-hold"
                    className="font-mono text-[10px] text-white/40"
                  >
                    Hold {formatCurrencyFull(fa.capHold)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center mt-auto pt-5 border-t border-white/5">
        <div className="text-xl font-bold text-white tracking-tight">
          {formatCurrency(summary.remainingValue)}{' '}
          <span className="text-white/40 mx-1">-</span> {summary.remainingYears}{' '}
          yrs
        </div>
        <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">
          Remaining
        </div>

        {summary.extensionYears > 0 && (
          <div className="mt-3 pt-3 border-t border-cyan-500/20">
            <div className="text-lg font-bold text-cyan-100 tracking-tight">
              {formatCurrency(summary.extensionValue)}{' '}
              <span className="text-cyan-400/40 mx-1">-</span>{' '}
              {summary.extensionYears} yrs
            </div>
            <div className="text-xs uppercase tracking-wider text-cyan-400/60 font-semibold mt-1">
              Extension
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
