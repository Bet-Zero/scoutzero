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

type ContractSummaryPanelProps = {
  summary: ContractSummary;
  contractYears: ContractYearWithNumberYear[];
  currentYear: number;
};

export const ContractSummaryPanel = ({
  summary,
  contractYears,
  currentYear,
}: ContractSummaryPanelProps) => (
  <div className="w-full lg:w-[35%] bg-[#161616] border-r border-white/10 p-8 flex flex-col">
    <div className="text-center mb-6">
      <div className="text-2xl font-bold text-white tracking-tight">
        {formatCurrency(summary.totalValue)}{' '}
        <span className="text-white/40 mx-1">-</span> {summary.totalYears} yrs
      </div>
      <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">
        Total Contract
      </div>
    </div>

    <div className="flex-1 overflow-y-auto space-y-1 pr-2">
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
              className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
                isCurrent
                  ? 'bg-white/10'
                  : isExtension
                    ? 'bg-cyan-500/10 border border-cyan-500/20'
                    : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white/60">{y.season}</span>
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
    </div>

    <div className="text-center mt-6 pt-6 border-t border-white/5">
      <div className="text-xl font-bold text-white tracking-tight">
        {formatCurrency(summary.remainingValue)}{' '}
        <span className="text-white/40 mx-1">-</span> {summary.remainingYears} yrs
      </div>
      <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">
        Remaining
      </div>

      {summary.extensionYears > 0 && (
        <div className="mt-4 pt-4 border-t border-cyan-500/20">
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
);
