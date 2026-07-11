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

export const TradeSalaryCalculator = ({
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
      <div className="border border-cockpit-edge rounded-lg p-4 mt-4 bg-cockpit-slab">
        <h3 className="font-medium mb-3">Salary Matching Calculator</h3>
        <p className="text-cockpit-text-secondary text-sm">
          Missing cap settings or team salary data
        </p>
      </div>
    );
  }

  return (
    <div className="border border-cockpit-edge rounded-lg p-4 mt-4 bg-cockpit-slab">
      <div className="mb-4 px-3 py-2 bg-cockpit-watch/20 border border-cockpit-watch/30 rounded text-xs text-cockpit-watch">
        ⚠️ <strong>Exploratory tool</strong> — validator is authoritative for
        final trade legality.
      </div>

      <h3 className="font-medium mb-3">Salary Matching Calculator</h3>

      <div className="space-y-4">
        {hasValidatorResult && (
          <div className="bg-cockpit-info/20 border border-cockpit-info/30 rounded p-3">
            <div className="text-xs font-semibold text-cockpit-info mb-2 flex items-center gap-1">
              <span>✓</span> Official Validator Result
            </div>
            {validatorSkipReason ? (
              <div className="text-sm text-cockpit-info">
                <span className="text-cockpit-info/60">Status: </span>
                Salary matching not applicable ({validatorSkipReason})
              </div>
            ) : validatorAllowableIncoming != null ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-cockpit-info/60 mb-1">
                    Allowable Incoming
                  </div>
                  <div className="font-mono text-cockpit-info">
                    {formatCurrency(validatorAllowableIncoming)}
                  </div>
                </div>
                {validatorRule && (
                  <div>
                    <div className="text-xs text-cockpit-info/60 mb-1">
                      Rule Applied
                    </div>
                    <div className="text-cockpit-info">{validatorRule}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-cockpit-info/60">
                Validator result available but no allowable incoming value
              </div>
            )}
          </div>
        )}

        <div
          className={`rounded p-3 ${hasValidatorResult ? 'bg-cockpit-raised border border-cockpit-edge' : ''}`}
        >
          <div className="text-xs font-semibold text-cockpit-text-secondary mb-3 flex items-center gap-1">
            {hasValidatorResult ? (
              <>
                <span className="text-cockpit-watch">⚡</span> Sandbox Estimate
                (local calculation)
              </>
            ) : (
              'Sandbox Estimate'
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-cockpit-text-secondary mb-1">
                Outgoing Salary
              </label>
              <div className="font-mono bg-cockpit-raised p-2 rounded">
                {formatCurrency(outgoingSalary)}
              </div>
            </div>
            <div>
              <label className="block text-xs text-cockpit-text-secondary mb-1">
                Allowable Incoming
              </label>
              <div
                className={`font-mono p-2 rounded ${
                  isValid ? 'bg-cockpit-safe/30' : 'bg-cockpit-danger/30'
                }`}
              >
                {formatCurrency(allowableIncoming)}
              </div>
              {officialDiffers && (
                <div className="text-xs text-cockpit-info mt-1">
                  Validator will use:{' '}
                  {formatCurrency(validatorAllowableIncoming)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-cockpit-raised p-3 rounded border border-cockpit-edge mt-4">
            <div className="text-xs text-cockpit-text-secondary mb-2">
              <span className="font-semibold">Rule Applied:</span>{' '}
              {breakdown.rule}
              {hasValidatorResult &&
                validatorRule &&
                validatorRule !== breakdown.rule && (
                  <span className="text-cockpit-info ml-2">
                    (Validator: {validatorRule})
                  </span>
                )}
            </div>
            {breakdown.formula && (
              <div className="text-xs text-cockpit-text-muted mb-2 font-mono">
                {breakdown.formula}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-cockpit-text-secondary">Base</div>
                <div>{formatCurrency(breakdown.base)}</div>
              </div>
              <div className="text-center">
                <div className="text-cockpit-text-secondary">TPEs</div>
                <div className={breakdown.tpe > 0 ? 'text-cockpit-info' : ''}>
                  +{formatCurrency(breakdown.tpe)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-cockpit-text-secondary">Min Ex</div>
                <div className={breakdown.min > 0 ? 'text-cockpit-safe' : ''}>
                  +{formatCurrency(breakdown.min)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-cockpit-text-secondary mb-1">
            Test Incoming Salary
          </label>
          <input
            type="number"
            value={incomingSalary || ''}
            onChange={(event) => setIncomingSalary(Number(event.target.value) || 0)}
            className="w-full bg-cockpit-raised border border-cockpit-edge rounded px-3 py-2 font-mono"
            placeholder="Enter amount to test"
          />
        </div>

        {isSandboxDisabled ? (
          <div className="p-3 rounded-md bg-cockpit-slab border border-cockpit-edge">
            <div className="font-medium flex items-center text-cockpit-text-muted">
              <span className="mr-2">⊘</span>
              <span>Sandbox Disabled</span>
            </div>
            <div className="text-sm mt-1 text-cockpit-text-muted">
              {sandboxDisabledReason}
            </div>
          </div>
        ) : validatorContradictsSandbox ? (
          <div className="p-3 rounded bg-cockpit-watch/20 border border-cockpit-watch/30">
            <div className="font-medium flex items-center text-cockpit-watch">
              <span className="mr-2">⚠️</span>
              <span>Sandbox vs Validator Mismatch</span>
            </div>
            <div className="text-sm mt-1 text-cockpit-watch/80">
              Sandbox: {incomingSalary <= allowableIncoming ? 'Valid' : 'Invalid'}{' '}
              |
              <span className="font-semibold text-cockpit-info ml-1">
                Validator (authoritative):{' '}
                {incomingSalary <= validatorAllowableIncoming ? 'Valid' : 'Invalid'}
              </span>
            </div>
            <div className="text-xs mt-2 text-cockpit-watch/60 italic">
              The official validator result takes precedence over sandbox
              estimates.
            </div>
          </div>
        ) : (
          <div
            className={`p-3 rounded ${
              isValid ? 'bg-cockpit-safe/20' : 'bg-cockpit-danger/20'
            }`}
          >
            <div className="font-medium flex items-center">
              {isValid ? (
                <>
                  <span className="text-cockpit-safe mr-2">✓</span>
                  <span>Sandbox Result (salary matching only)</span>
                </>
              ) : (
                <>
                  <span className="text-cockpit-danger mr-2">✗</span>
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

