import React, { useMemo, useState } from 'react';
import {
  formatCurrency,
  getSalaryForYear,
  MIN_SALARY,
} from '@/features/architect/utils/tradeHelpers';
import {
  getSalaryMatchingResult,
  SALARY_MATCHING_RULE_LABELS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';
import type {
  CapSettingsLike,
  TeamPlayerLike,
  TpeLike,
} from './validationPresentationTypes';

interface NormalizedCapSettings {
  salaryCap: number;
  firstApron: number;
  secondApron: number;
  hasValidCapSettings: boolean;
}

interface TradeSalaryCalculatorProps {
  teamSalary?: number;
  outgoingSalary?: number;
  incomingPlayers?: TeamPlayerLike[];
  tpes?: TpeLike[];
  capSettings?: CapSettingsLike | null;
  yearKey?: string | number | null;
  validatorAllowableIncoming?: number | null;
  validatorRule?: string | null;
  hasValidatorResult?: boolean;
  validatorSkipReason?: string | null;
}

function normalizeCapSettings(
  rawCapSettings: Record<string, unknown> | null | undefined,
  yearKey: string | number | null = null
): NormalizedCapSettings {
  if (!rawCapSettings || typeof rawCapSettings !== 'object') {
    return {
      salaryCap: 0,
      firstApron: 0,
      secondApron: 0,
      hasValidCapSettings: false,
    };
  }

  let settings: Record<string, unknown> = rawCapSettings;

  if (yearKey && typeof settings[yearKey] === 'object' && settings[yearKey] !== null) {
    settings = settings[yearKey] as Record<string, unknown>;
  } else if (yearKey) {
    const seasonKey =
      typeof yearKey === 'number'
        ? `${yearKey - 1}-${String(yearKey).slice(-2)}`
        : yearKey;

    if (
      typeof settings[seasonKey] === 'object' &&
      settings[seasonKey] !== null
    ) {
      settings = settings[seasonKey] as Record<string, unknown>;
    }
  }

  const salaryCap = Number(settings.salaryCap) || Number(settings.cap) || 0;
  const firstApron =
    Number(settings.firstApron) || Number(settings.firstApronLine) || 0;
  const secondApron =
    Number(settings.secondApron) || Number(settings.secondApronLine) || 0;
  const hasValidCapSettings = salaryCap > 0;

  return { salaryCap, firstApron, secondApron, hasValidCapSettings };
}

const TradeSalaryCalculator = ({
  teamSalary,
  outgoingSalary,
  incomingPlayers = [],
  tpes = [],
  capSettings,
  yearKey,
  validatorAllowableIncoming = null,
  validatorRule = null,
  hasValidatorResult = false,
  validatorSkipReason = null,
}: TradeSalaryCalculatorProps) => {
  const [incomingSalary, setIncomingSalary] = useState(0);

  const normalizedCap = useMemo(
    () => normalizeCapSettings(capSettings ? { ...capSettings } : null, yearKey),
    [capSettings, yearKey]
  );
  const { hasValidCapSettings } = normalizedCap;

  const matchingResult = useMemo(() => {
    if (!teamSalary || !hasValidCapSettings) return null;

    return getSalaryMatchingResult({
      teamTotalSalary: teamSalary,
      outgoingSalary: outgoingSalary || 0,
      capSettings: {
        salaryCap: normalizedCap.salaryCap,
        firstApron: normalizedCap.firstApron,
        secondApron: normalizedCap.secondApron,
      },
    });
  }, [teamSalary, outgoingSalary, normalizedCap, hasValidCapSettings]);

  const breakdown = useMemo(() => {
    if (!matchingResult || !teamSalary || !hasValidCapSettings) {
      return { base: 0, min: 0, tpe: 0, rule: '', formula: '' };
    }

    const base = matchingResult.allowableIncoming;
    const min =
      teamSalary > normalizedCap.salaryCap
        ? incomingPlayers.reduce((sum, player) => {
            const salary = getSalaryForYear([player], yearKey);
            return salary <= MIN_SALARY ? sum + salary : sum;
          }, 0)
        : 0;
    const tpe = tpes.reduce(
      (sum, tpeEntry) => sum + (tpeEntry.remaining ?? tpeEntry.amount ?? 0),
      0
    );

    return {
      base,
      min,
      tpe,
      rule: matchingResult.ruleLabel,
      formula: matchingResult.formulaUsed,
    };
  }, [
    matchingResult,
    teamSalary,
    normalizedCap,
    hasValidCapSettings,
    incomingPlayers,
    tpes,
    yearKey,
  ]);

  const allowableIncoming = breakdown.base + breakdown.min + breakdown.tpe;
  const sandboxDisabledReason = useMemo(() => {
    if (!hasValidCapSettings) {
      return 'Missing or invalid cap settings';
    }
    if (validatorSkipReason) {
      return `Salary matching not applicable (${validatorSkipReason})`;
    }
    return null;
  }, [hasValidCapSettings, validatorSkipReason]);
  const isSandboxDisabled = !!sandboxDisabledReason;
  const isValid = !isSandboxDisabled && incomingSalary <= allowableIncoming;
  const officialDiffers =
    hasValidatorResult &&
    validatorAllowableIncoming != null &&
    Math.abs(allowableIncoming - validatorAllowableIncoming) > 1;
  const validatorContradictsSandbox =
    hasValidatorResult &&
    validatorAllowableIncoming != null &&
    !isSandboxDisabled &&
    ((incomingSalary <= allowableIncoming) !==
      (incomingSalary <= validatorAllowableIncoming));

  if (!matchingResult) {
    return (
      <div className="border border-white/10 rounded-lg p-4 mt-4 bg-[#111]">
        <h3 className="font-medium mb-3">Salary Matching Calculator</h3>
        <p className="text-white/60 text-sm">
          Missing cap settings or team salary data
        </p>
      </div>
    );
  }

  return (
    <div className="border border-white/10 rounded-lg p-4 mt-4 bg-[#111]">
      <div className="mb-4 px-3 py-2 bg-amber-900/20 border border-amber-600/30 rounded text-xs text-amber-300">
        ⚠️ <strong>Exploratory tool</strong> — validator is authoritative for
        final trade legality.
      </div>

      <h3 className="font-medium mb-3">Salary Matching Calculator</h3>

      <div className="space-y-4">
        {hasValidatorResult && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
            <div className="text-xs font-semibold text-blue-300 mb-2 flex items-center gap-1">
              <span>✓</span> Official Validator Result
            </div>
            {validatorSkipReason ? (
              <div className="text-sm text-blue-100">
                <span className="text-blue-200/60">Status: </span>
                Salary matching not applicable ({validatorSkipReason})
              </div>
            ) : validatorAllowableIncoming != null ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-blue-200/60 mb-1">
                    Allowable Incoming
                  </div>
                  <div className="font-mono text-blue-100">
                    {formatCurrency(validatorAllowableIncoming)}
                  </div>
                </div>
                {validatorRule && (
                  <div>
                    <div className="text-xs text-blue-200/60 mb-1">
                      Rule Applied
                    </div>
                    <div className="text-blue-100">{validatorRule}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-blue-100/60">
                Validator result available but no allowable incoming value
              </div>
            )}
          </div>
        )}

        <div
          className={`rounded p-3 ${hasValidatorResult ? 'bg-white/5 border border-white/10' : ''}`}
        >
          <div className="text-xs font-semibold text-white/60 mb-3 flex items-center gap-1">
            {hasValidatorResult ? (
              <>
                <span className="text-yellow-400">⚡</span> Sandbox Estimate
                (local calculation)
              </>
            ) : (
              'Sandbox Estimate'
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">
                Outgoing Salary
              </label>
              <div className="font-mono bg-[#222] p-2 rounded">
                {formatCurrency(outgoingSalary)}
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">
                Allowable Incoming
              </label>
              <div
                className={`font-mono p-2 rounded ${
                  isValid ? 'bg-green-900/30' : 'bg-red-900/30'
                }`}
              >
                {formatCurrency(allowableIncoming)}
              </div>
              {officialDiffers && (
                <div className="text-xs text-blue-300 mt-1">
                  Validator will use:{' '}
                  {formatCurrency(validatorAllowableIncoming)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#222] p-3 rounded border border-white/10 mt-4">
            <div className="text-xs text-white/70 mb-2">
              <span className="font-semibold">Rule Applied:</span>{' '}
              {breakdown.rule}
              {hasValidatorResult &&
                validatorRule &&
                validatorRule !== breakdown.rule && (
                  <span className="text-blue-300 ml-2">
                    (Validator: {validatorRule})
                  </span>
                )}
            </div>
            {breakdown.formula && (
              <div className="text-xs text-white/50 mb-2 font-mono">
                {breakdown.formula}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-white/60">Base</div>
                <div>{formatCurrency(breakdown.base)}</div>
              </div>
              <div className="text-center">
                <div className="text-white/60">TPEs</div>
                <div className={breakdown.tpe > 0 ? 'text-blue-300' : ''}>
                  +{formatCurrency(breakdown.tpe)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-white/60">Min Ex</div>
                <div className={breakdown.min > 0 ? 'text-green-300' : ''}>
                  +{formatCurrency(breakdown.min)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/60 mb-1">
            Test Incoming Salary
          </label>
          <input
            type="number"
            value={incomingSalary}
            onChange={(event) => setIncomingSalary(Number(event.target.value) || 0)}
            className="w-full bg-[#222] border border-white/10 rounded px-3 py-2 font-mono"
            placeholder="Enter amount to test"
          />
        </div>

        {isSandboxDisabled ? (
          <div className="p-3 rounded bg-neutral-800/50 border border-neutral-600/30">
            <div className="font-medium flex items-center text-neutral-400">
              <span className="mr-2">⊘</span>
              <span>Sandbox Disabled</span>
            </div>
            <div className="text-sm mt-1 text-neutral-400">
              {sandboxDisabledReason}
            </div>
          </div>
        ) : validatorContradictsSandbox ? (
          <div className="p-3 rounded bg-amber-900/20 border border-amber-600/30">
            <div className="font-medium flex items-center text-amber-300">
              <span className="mr-2">⚠️</span>
              <span>Sandbox vs Validator Mismatch</span>
            </div>
            <div className="text-sm mt-1 text-amber-200/80">
              Sandbox: {incomingSalary <= allowableIncoming ? 'Valid' : 'Invalid'}{' '}
              |
              <span className="font-semibold text-blue-300 ml-1">
                Validator (authoritative):{' '}
                {incomingSalary <= validatorAllowableIncoming ? 'Valid' : 'Invalid'}
              </span>
            </div>
            <div className="text-xs mt-2 text-amber-200/60 italic">
              The official validator result takes precedence over sandbox
              estimates.
            </div>
          </div>
        ) : (
          <div
            className={`p-3 rounded ${
              isValid ? 'bg-green-900/20' : 'bg-red-900/20'
            }`}
          >
            <div className="font-medium flex items-center">
              {isValid ? (
                <>
                  <span className="text-green-400 mr-2">✓</span>
                  <span>Sandbox Result (salary matching only)</span>
                </>
              ) : (
                <>
                  <span className="text-red-400 mr-2">✗</span>
                  <span>Sandbox Result (salary matching only)</span>
                </>
              )}
            </div>
            <div className="text-sm mt-1">
              {isValid ? (
                'Test incoming salary passes salary matching check'
              ) : (
                <>
                  Exceeds allowable incoming by{' '}
                  <span className="font-semibold">
                    {formatCurrency(incomingSalary - allowableIncoming)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeSalaryCalculator;
