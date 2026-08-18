import React from 'react';
import { formatCurrencyFull } from '@/shared/utils/formatting';
import { TeamSelectDropdown } from '@/shared/components/TeamSelectDropdown';
import type { GovernedExtensionAvailability } from '@/features/architect/utils/extensions';
import type {
  SelectedContractAction,
  ExtensionStateLike,
  ExtMaxState,
  PlayerRulesProfileLike,
  SigningExceptionOption,
} from './EditContractModal.types';

type SigningGuardrailsLike = {
  source?: string;
  minFirstYear?: number;
  maxFirstYear?: number | null;
  raisePct?: number | null;
  maxYears?: number | null;
};

type ContractDetailsFormProps = {
  selectedAction: SelectedContractAction;
  isSigningAction: boolean;
  extension: ExtensionStateLike;
  setExtension: React.Dispatch<React.SetStateAction<ExtensionStateLike>>;
  salaryInputs: string[];
  setSalaryInputs: React.Dispatch<React.SetStateAction<string[]>>;
  selectedException: string;
  setSelectedException: (e: string) => void;
  isOfferSheet: boolean;
  setIsOfferSheet: (v: boolean) => void;
  destinationTeamId: string | null;
  setDestinationTeamId: (id: string | null) => void;
  buyoutAmountInput: string;
  setBuyoutAmountInput: (v: string) => void;
  extMax: ExtMaxState | null;
  extReason: string;
  isExtendEligible: boolean;
  extensionAvailability: GovernedExtensionAvailability | null;
  availableSigningExceptions: SigningExceptionOption[];
  signingGuardrails: SigningGuardrailsLike | null;
  remainingGuaranteedForBuyout: number;
  parsedBuyoutAmount: number | null;
  buyoutAmountIsValid: boolean;
  CURRENT_YEAR: number;
  extensionStartYear: number;
  resolvedShowOfferSheetToggle: boolean;
  playerRulesProfile: PlayerRulesProfileLike | null | undefined;
  clampFirstYearToGuardrails: (value: number | null | undefined) => number;
  buildSalarySeries: (
    firstYear: number,
    years: number,
    raisePct: number | null | undefined
  ) => number[];
  toSalaryInputs: (series: number[], years: number) => string[];
  onTermsChange: () => void;
};

export const ContractDetailsForm = ({
  selectedAction,
  isSigningAction,
  extension,
  setExtension,
  salaryInputs,
  setSalaryInputs,
  selectedException,
  setSelectedException,
  isOfferSheet,
  setIsOfferSheet,
  destinationTeamId,
  setDestinationTeamId,
  buyoutAmountInput,
  setBuyoutAmountInput,
  extMax,
  extReason,
  isExtendEligible,
  extensionAvailability,
  availableSigningExceptions,
  signingGuardrails,
  remainingGuaranteedForBuyout,
  parsedBuyoutAmount,
  buyoutAmountIsValid,
  CURRENT_YEAR,
  extensionStartYear,
  resolvedShowOfferSheetToggle,
  playerRulesProfile,
  clampFirstYearToGuardrails,
  buildSalarySeries,
  toSalaryInputs,
  onTermsChange,
}: ContractDetailsFormProps) => (
  <>
    {['signNew', 'resign', 'extend', 'signAndTrade'].includes(selectedAction) && (
      <div className="bg-white/5 rounded-lg border border-white/20 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-sm text-white flex items-center gap-2">
            <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
            New Contract Preview
          </h4>
          <div className="flex items-center gap-2">
            {selectedAction === 'extend' ? (
              <select
                data-testid="governed-extension-route"
                value={extension.route || extensionAvailability?.suggestedRoute || 'veteran'}
                onChange={(e) => {
                  const route = e.target.value as ExtensionStateLike['route'];
                  setExtension({
                    ...extension,
                    route,
                    conditionalHigherMaxPercentage:
                      route === 'rookie-scale'
                        ? extension.conditionalHigherMaxPercentage ?? null
                        : null,
                    agreedDesignatedVeteranPercentage:
                      route === 'designated-veteran'
                        ? extension.agreedDesignatedVeteranPercentage ?? 30
                        : null,
                  });
                }}
                disabled={!extensionAvailability}
                className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
              >
                <option value="rookie-scale">Rookie Scale</option>
                <option value="veteran">Veteran</option>
                <option value="designated-veteran">Designated Veteran</option>
              </select>
            ) : (
              <select
                value={extension.contractType}
                onChange={(e) =>
                  setExtension({ ...extension, contractType: e.target.value })
                }
                className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
              >
                <option value="Standard">Standard</option>
                <option value="Rookie Scale">Rookie Scale</option>
                <option value="Designated veteran">Designated Veteran</option>
              </select>
            )}

            {['signNew', 'resign'].includes(selectedAction) && (
              <select
                value={selectedException}
                onChange={(e) => setSelectedException(e.target.value)}
                className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
              >
                {availableSigningExceptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {selectedAction === 'signNew' && resolvedShowOfferSheetToggle && (
              <label className="flex items-center gap-1.5 cursor-pointer ml-2 bg-black px-2 py-1 rounded border border-white/20 select-none">
                <input
                  type="checkbox"
                  checked={isOfferSheet}
                  onChange={(e) => setIsOfferSheet(e.target.checked)}
                  className="accent-cyan-500"
                />
                <span
                  className={`text-xs font-bold ${isOfferSheet ? 'text-cyan-400' : 'text-white/50'}`}
                >
                  Offer Sheet
                </span>
              </label>
            )}

            <select
              data-testid="contract-years"
              value={extension.years}
              onChange={(e) => {
                const guardrailYears =
                  isSigningAction && signingGuardrails?.maxYears
                    ? Math.min(signingGuardrails.maxYears, 5)
                    : null;
                const maxYearsOption =
                  selectedAction === 'extend' && extensionAvailability
                    ? 5
                    : selectedAction === 'extend' && extMax?.maxYears
                      ? extMax.maxYears
                    : guardrailYears || 5;
                const yrs = Math.min(Number(e.target.value), maxYearsOption);
                const raisePct =
                  signingGuardrails?.raisePct ?? extension.raisePct ?? 0.05;
                const firstYear = isSigningAction
                  ? clampFirstYearToGuardrails(
                      extension.salaries?.[0] ??
                        signingGuardrails?.minFirstYear ??
                        0
                    )
                  : extension.salaries?.[0] || 0;
                const salaries = isSigningAction
                  ? buildSalarySeries(firstYear, yrs, raisePct)
                  : Array.from(
                      { length: yrs },
                      (_, i) => extension.salaries[i] || 0
                    );
                setExtension({ ...extension, years: yrs, salaries, raisePct });
                setSalaryInputs(toSalaryInputs(salaries, yrs));
              }}
              className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
            >
              {[1, 2, 3, 4, 5].map((yr) => {
                const maxYearsOption =
                  selectedAction === 'extend' && extensionAvailability
                    ? 5
                    : selectedAction === 'extend' && extMax?.maxYears
                      ? extMax.maxYears
                    : isSigningAction && signingGuardrails?.maxYears
                      ? Math.min(signingGuardrails.maxYears, 5)
                      : 5;
                return (
                  <option key={yr} value={yr} disabled={yr > maxYearsOption}>
                    {yr}yr
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {selectedAction === 'extend' && extensionAvailability && (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/70">
              Exact signature time
              <input
                data-testid="governed-extension-signed-at"
                value={extension.signedAt || ''}
                onChange={(event) => {
                  onTermsChange();
                  setExtension({ ...extension, signedAt: event.target.value });
                }}
                placeholder="2026-10-19T18:00:00-04:00"
                className="mt-1 w-full rounded border border-white/15 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-orange-400/50"
              />
              <span className="mt-1 block text-[10px] text-white/45">
                Include the UTC offset. No signing time is inferred.
              </span>
            </label>
            {(extension.route || extensionAvailability.suggestedRoute) ===
              'rookie-scale' && (
              <label className="text-xs text-white/70">
                Conditional Higher Max percentage
                <input
                  data-testid="governed-extension-higher-max-percentage"
                  type="number"
                  min="25"
                  max="30"
                  step="0.0001"
                  value={extension.conditionalHigherMaxPercentage ?? ''}
                  onChange={(event) => {
                    onTermsChange();
                    setExtension({
                      ...extension,
                      conditionalHigherMaxPercentage:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                    });
                  }}
                  placeholder="Optional"
                  className="mt-1 w-full rounded border border-white/15 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-orange-400/50"
                />
                <span className="mt-1 block text-[10px] text-white/45">
                  Optional 25% through 30% clause; qualification remains pending
                  until governed award evidence resolves it.
                </span>
              </label>
            )}
            {(extension.route || extensionAvailability.suggestedRoute) ===
              'designated-veteran' && (
              <label className="text-xs text-white/70">
                Agreed cap percentage
                <input
                  data-testid="governed-extension-dv-percentage"
                  type="number"
                  min="30"
                  max="35"
                  step="0.0001"
                  value={extension.agreedDesignatedVeteranPercentage ?? ''}
                  onChange={(event) => {
                    onTermsChange();
                    setExtension({
                      ...extension,
                      agreedDesignatedVeteranPercentage:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                    });
                  }}
                  className="mt-1 w-full rounded border border-white/15 bg-black/35 px-3 py-2 text-xs text-white outline-none focus:border-orange-400/50"
                />
                <span className="mt-1 block text-[10px] text-white/45">
                  Must be 30% through 35% of the first extended Season cap.
                </span>
              </label>
            )}
          </div>
        )}

        {isSigningAction && signingGuardrails && (
          <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-white/70">
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
              Rights/Exception: {signingGuardrails.source}
              {playerRulesProfile?.birdRights?.type
                ? ` (${playerRulesProfile.birdRights.type})`
                : ''}
            </span>
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
              First-year range:{' '}
              {formatCurrencyFull(signingGuardrails.minFirstYear || 0)} -{' '}
              {signingGuardrails.maxFirstYear != null
                ? formatCurrencyFull(signingGuardrails.maxFirstYear)
                : 'Max'}
            </span>
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
              Raises up to {Math.round((signingGuardrails.raisePct || 0) * 100)}% •
              Max {signingGuardrails.maxYears || '—'} yrs
            </span>
            {playerRulesProfile?.restrictedFreeAgency?.qualifyingOfferAmount ? (
              <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-100">
                QO:{' '}
                {formatCurrencyFull(
                  playerRulesProfile.restrictedFreeAgency.qualifyingOfferAmount
                )}
              </span>
            ) : null}
          </div>
        )}

        {selectedAction === 'signAndTrade' && (
          <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <label className="block text-xs font-bold text-blue-200 uppercase tracking-wider mb-2">
              Destination Team
            </label>
            <TeamSelectDropdown
              selectedTeamId={destinationTeamId}
              onChange={setDestinationTeamId}
              valueFormat="teamCode"
            />
            <p className="mt-2 text-[11px] text-white/60">
              The player will be signed to your team, then immediately traded to
              this destination.
            </p>
          </div>
        )}

        <div className="grid grid-cols-5 gap-2 bg-white/5 rounded-lg p-3">
          {Array.from({ length: 5 }, (_, idx) => {
            const isActive = idx < extension.years;
            const year =
              (selectedAction === 'extend' ? extensionStartYear : CURRENT_YEAR) +
              idx;
            return (
              <div
                key={idx}
                className={`${isActive ? 'opacity-100' : 'opacity-30'}`}
              >
                <div className="text-[10px] text-white/50 text-center mb-1 font-medium">
                  {year - 1}-{String(year % 100).padStart(2, '00')}
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-xs">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    disabled={!isActive}
                    value={salaryInputs[idx] || ''}
                    onChange={(e) => {
                      onTermsChange();
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      const parsed = Number(raw);
                      const nextSalaries = (() => {
                        const arr = [...extension.salaries];
                        let nextVal = parsed;
                        if (isSigningAction && signingGuardrails) {
                          if (idx === 0) {
                            nextVal = clampFirstYearToGuardrails(parsed);
                          } else if (signingGuardrails.raisePct != null) {
                            const prevSalary = arr[idx - 1] || 0;
                            const allowed = Math.round(
                              prevSalary * (1 + signingGuardrails.raisePct)
                            );
                            nextVal = Math.min(parsed || 0, allowed);
                          }
                        }
                        arr[idx] = nextVal;
                        return arr;
                      })();
                      const activeYears =
                        extension.years || nextSalaries.length || 0;
                      setExtension((prev) => ({
                        ...prev,
                        salaries: nextSalaries,
                      }));
                      setSalaryInputs(toSalaryInputs(nextSalaries, activeYears));
                    }}
                    className="w-full pl-5 pr-2 py-2 rounded bg-black/50 border border-white/10 text-xs text-white font-medium text-center focus:border-cyan-500 focus:bg-cyan-500/10 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {selectedAction === 'extend' && (
          <div className="mt-3 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-200 space-y-1">
            {extensionAvailability ? (
              <>
                <div className="font-medium">
                  {extensionAvailability.status === 'ready'
                    ? 'Governed extension evidence ready'
                    : extensionAvailability.status === 'incompatible'
                      ? 'Governed Contract history is incompatible'
                      : 'Needs governed input'}
                </div>
                <div className="text-[11px] text-orange-100/75">
                  {extensionAvailability.status === 'ready'
                    ? `${extensionAvailability.firstExtendedSeason || 'The next Contract Season'} begins the extension. Exact route, timing, term, salary, bonus, and annual-change rules are checked again when saved.`
                    : extensionAvailability.reasons[0] ||
                      'Required Contract or league evidence is unavailable.'}
                </div>
              </>
            ) : (
              <>
                <div className="font-medium">Needs governed input</div>
                <div className="text-[11px] text-orange-100/80">
                  Governed Contract and league evidence are required before an
                  extension can be saved.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )}

    {selectedAction === 'buyout' && (
      <div className="bg-white/5 rounded-lg border border-white/20 p-4 space-y-3">
        <h4 className="font-semibold text-sm text-white flex items-center gap-2">
          <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
          Buyout Terms
        </h4>
        <div className="text-xs text-white/70">
          Remaining guaranteed salary:{' '}
          <span className="text-white font-semibold">
            {formatCurrencyFull(remainingGuaranteedForBuyout)}
          </span>
        </div>
        <div>
          <label
            htmlFor="buyout-amount-input"
            className="block text-xs font-medium text-white/80 mb-1"
          >
            Buyout Amount
          </label>
          <input
            id="buyout-amount-input"
            type="number"
            min={0}
            max={remainingGuaranteedForBuyout || undefined}
            step="1000"
            value={buyoutAmountInput}
            onChange={(event) => setBuyoutAmountInput(event.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 rounded bg-black/50 border border-white/20 text-sm text-white outline-none focus:border-orange-500"
          />
        </div>
        <div className="text-[11px] text-white/60">
          Resulting dead cap:{' '}
          <span className="text-white">
            {formatCurrencyFull(
              Math.max(0, remainingGuaranteedForBuyout - (parsedBuyoutAmount || 0))
            )}
          </span>
        </div>
        {!buyoutAmountIsValid && (
          <p className="text-[11px] text-red-300">
            Enter a value between 0 and{' '}
            {formatCurrencyFull(remainingGuaranteedForBuyout)}.
          </p>
        )}
      </div>
    )}
  </>
);
