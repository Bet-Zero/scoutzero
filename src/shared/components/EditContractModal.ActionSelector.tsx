import React from 'react';
import {
  ACTION_LABELS,
  ACTION_DESCRIPTIONS,
  ACTION_TEST_IDS,
} from './EditContractModal.helpers';
import type {
  ContractActionKey,
  SelectedContractAction,
  ActionSetKey,
} from './EditContractModal.types';

type ContractActionSelectorProps = {
  playerName: string;
  hasOption: boolean;
  actionSet: ActionSetKey | null;
  isExpiring: boolean;
  optionType: string | null;
  optionYear: number | null;
  optionTimingError: string | null;
  actions: ContractActionKey[];
  isExtendEligible: boolean;
  signAndTradeActionDisabledReason: string | null;
  isOptionActionable: boolean;
  selectedAction: SelectedContractAction;
  onSelectAction: (action: SelectedContractAction) => void;
  actionLabelsOverride: Partial<Record<string, string>>;
  extensionEligibilityReason?: string | null;
};

export const ContractActionSelector = ({
  playerName,
  hasOption,
  actionSet,
  isExpiring,
  optionType,
  optionYear,
  optionTimingError,
  actions,
  isExtendEligible,
  signAndTradeActionDisabledReason,
  isOptionActionable,
  selectedAction,
  onSelectAction,
  actionLabelsOverride,
  extensionEligibilityReason,
}: ContractActionSelectorProps) => (
  <>
    <div className="mb-6 text-sm text-white/70 leading-relaxed">
      {hasOption && (
        <p>
          <span className="text-white font-semibold">{playerName}</span>{' '}
          has a <span className="text-orange-400">{optionType}</span> for the{' '}
          {optionYear
            ? `${optionYear - 1}-${String(optionYear % 100).padStart(2, '0')}`
            : 'upcoming'}{' '}
          season. You may choose to accept it to retain him, decline it to make
          him a Free Agent, or negotiate a new contract.
        </p>
      )}
      {actionSet === 'freeAgent' && (
        <p>
          <span className="text-white font-semibold">{playerName}</span> is
          currently a Free Agent (Cap Hold). You can re-sign him using Bird
          Rights (if applicable), renounce his rights to clear cap space, or
          execute a sign-and-trade.
        </p>
      )}
      {actionSet === 'underContract' && isExpiring && (
        <p>
          <span className="text-white font-semibold">{playerName}</span> is on
          an expiring contract. You can extend his deal if eligible, or waive
          him to clear a roster spot (with potential dead cap implications). He
          will become a free agent after this season.
        </p>
      )}
      {actionSet === 'underContract' && !isExpiring && (
        <p>
          <span className="text-white font-semibold">{playerName}</span> is
          under contract. You can extend his deal if eligible, or waive him to
          clear a roster spot (with potential dead cap implications).
        </p>
      )}
    </div>

    <div className="space-y-3 mb-6">
      {optionTimingError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded border bg-red-500/10 border-red-500/30 mb-3">
          <span className="shrink-0 text-sm">❌</span>
          <span className="text-xs text-red-300">{optionTimingError}</span>
        </div>
      )}

      {actions.map((type) => {
        const isOptionAction = type === 'accept' || type === 'decline';
        const extendBlocked = type === 'extend' && !isExtendEligible;
        const signAndTradeBlocked =
          type === 'signAndTrade' && !!signAndTradeActionDisabledReason;
        const isDisabled =
          (isOptionAction && !isOptionActionable) ||
          extendBlocked ||
          signAndTradeBlocked;

        return (
          <label
            key={type}
            className={`flex items-start gap-3 p-3 rounded border transition-all ${
              isDisabled
                ? 'cursor-not-allowed opacity-40 bg-white/[0.01] border-white/5'
                : selectedAction === type
                  ? 'bg-orange-500/10 border-orange-500/50 cursor-pointer'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/5 cursor-pointer'
            }`}
          >
            <input
              type="radio"
              value={type}
              data-testid={ACTION_TEST_IDS[type] || undefined}
              checked={selectedAction === type}
              onChange={() => !isDisabled && onSelectAction(type)}
              disabled={isDisabled}
              className="mt-1 accent-orange-500 disabled:opacity-50"
            />
            <div>
              <div
                className={`font-medium ${
                  isDisabled
                    ? 'text-white/40'
                    : selectedAction === type
                      ? 'text-orange-400'
                      : 'text-white'
                }`}
              >
                {actionLabelsOverride[type] || ACTION_LABELS[type]}
              </div>
              <div className="text-xs text-white/50 mt-0.5">
                {ACTION_DESCRIPTIONS[type]}
                {extendBlocked && (
                  <span className="block text-red-300 mt-1">
                    {extensionEligibilityReason || 'Not extension eligible'}
                  </span>
                )}
                {signAndTradeBlocked && (
                  <span className="block text-red-300 mt-1">
                    {signAndTradeActionDisabledReason}
                  </span>
                )}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  </>
);
