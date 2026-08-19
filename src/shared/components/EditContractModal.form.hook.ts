import { useState, useMemo, useCallback, useEffect } from 'react';
import { formatCurrencyFull } from '@/shared/utils/formatting';
import { buildSigningGuardrails } from '@/features/architect/hooks/useCapValidation';
import { validateExceptionEligibility } from '@/features/architect/utils/capLegalityValidation';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import {
  getExtensionProfile,
  buildMinimalRuleContext,
} from '@/features/architect/utils/salaryEngine';
import {
  getCanonicalExceptionAvailability,
  getCanonicalExceptionKeyForSigningMechanism,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import {
  SIGNING_EXCEPTION_OPTIONS,
  isContractActionKey,
} from './EditContractModal.helpers';
import type {
  PlayerLike,
  PlayerRulesProfileLike,
  TeamCapSheetLike,
  ExtensionStateLike,
  ExtMaxState,
  StagedSigningPayloadLike,
  SelectedContractAction,
  SigningExceptionOption,
  HookContractDataLike,
  OfferSheetTimingLike,
} from './EditContractModal.types';

type GetCapSettingsResult = ReturnType<
  typeof import('@/features/architect/utils/capHelpers').getCapSettings
>;

type UseEditContractModalFormParams = {
  player: PlayerLike | null | undefined;
  playerRulesProfile: PlayerRulesProfileLike | null | undefined;
  capSettings: GetCapSettingsResult | null | undefined;
  teamCapSheet: TeamCapSheetLike | null | undefined;
  ACTION_YEAR: number;
  CURRENT_YEAR: number;
  lastSalaryForPrefill: number;
  initialAction: string | null | undefined;
  isSigningAction: boolean;
  selectedAction: SelectedContractAction;
  isOpen: boolean;
  resolvedShowOfferSheetToggle: boolean;
};

const getSalaryRowEndYear = (row: { season?: unknown; year?: unknown }) => {
  if (typeof row.year === 'number' && Number.isFinite(row.year)) {
    return row.year;
  }

  const season = String(row.season || '').trim();
  const seasonMatch = season.match(/^(\d{4})-(\d{2})$/);
  if (seasonMatch) {
    return 2000 + Number(seasonMatch[2]);
  }

  const parsed = Number(season || row.year);
  return Number.isFinite(parsed) ? parsed : null;
};

const getContractSalaryForEndYear = (
  player: PlayerLike | null | undefined,
  endYear: number
) => {
  const rows = Array.isArray(player?.contract?.salariesByYear)
    ? player.contract.salariesByYear
    : [];
  const row = rows.find((salaryRow) => getSalaryRowEndYear(salaryRow) === endYear);
  const salary = Number(row?.salary ?? row?.capHit ?? 0);
  return Number.isFinite(salary) && salary > 0 ? salary : null;
};

export const useEditContractModalForm = ({
  player,
  playerRulesProfile,
  capSettings,
  teamCapSheet,
  ACTION_YEAR,
  CURRENT_YEAR,
  lastSalaryForPrefill,
  initialAction,
  isSigningAction,
  selectedAction,
  isOpen,
  resolvedShowOfferSheetToggle,
}: UseEditContractModalFormParams) => {
  const [extension, setExtension] = useState<ExtensionStateLike>({
    years: 1,
    contractType: 'Standard',
    salaries: [0],
  });
  const [salaryInputs, setSalaryInputs] = useState<string[]>(['']);
  const [selectedException, setSelectedException] = useState('None');
  const [isOfferSheet, setIsOfferSheet] = useState(false);
  const [offerSheetTiming, setOfferSheetTiming] = useState<OfferSheetTimingLike>({
    signedAt: '',
    receivedAt: '',
  });
  const [extReason, setExtReason] = useState('');
  const [extMax, setExtMax] = useState<ExtMaxState | null>(null);

  const extensionMutationFirstYearMax = useMemo(() => {
    const currentSeasonSalary = getContractSalaryForEndYear(
      player,
      CURRENT_YEAR
    );
    return currentSeasonSalary ? Math.round(currentSeasonSalary * 1.05) : null;
  }, [CURRENT_YEAR, player]);

  const signingGuardrails = useMemo(() => {
    if (!isSigningAction) return null;
    return buildSigningGuardrails(
      playerRulesProfile,
      capSettings ?? undefined,
      selectedException
    );
  }, [isSigningAction, playerRulesProfile, capSettings, selectedException]);

  const availableSigningExceptions = useMemo<SigningExceptionOption[]>(() => {
    return SIGNING_EXCEPTION_OPTIONS.filter((option) => {
      if (option.value === 'None' || option.value === 'Minimum') return true;
      if (!teamCapSheet) return false;
      const exceptionKey = getCanonicalExceptionKeyForSigningMechanism(option.value);
      if (!exceptionKey) return false;
      const availability = getCanonicalExceptionAvailability(teamCapSheet, exceptionKey);
      if (!availability.present || !availability.enabled || !availability.usable) return false;
      return !validateExceptionEligibility({
        team: teamCapSheet as Parameters<typeof validateExceptionEligibility>[0]['team'],
        signedUsing: option.value,
        year: ACTION_YEAR,
      }).blocked;
    });
  }, [ACTION_YEAR, teamCapSheet]);

  const contractDataForValidation = useMemo<HookContractDataLike>(
    () => ({
      ...extension,
      salaries: (extension.salaries || []).slice(
        0,
        extension.years || extension.salaries.length || 0
      ),
      guardrails: signingGuardrails,
      exceptionType: selectedException,
    }),
    [extension, signingGuardrails, selectedException]
  );

  useEffect(() => {
    if (!isSigningAction) return;
    if (availableSigningExceptions.some((option) => option.value === selectedException)) return;
    setSelectedException('None');
  }, [availableSigningExceptions, isSigningAction, selectedException]);

  useEffect(() => {
    if (!resolvedShowOfferSheetToggle && isOfferSheet) {
      setIsOfferSheet(false);
    }
  }, [isOfferSheet, resolvedShowOfferSheetToggle]);

  const clampFirstYearToGuardrails = useCallback(
    (value: number | null | undefined): number => {
      if (!signingGuardrails) return value || 0;
      const min = signingGuardrails.minFirstYear || 0;
      const max = signingGuardrails.maxFirstYear;
      let next = Math.max(min, value || 0);
      if (max != null) next = Math.min(next, max);
      return next;
    },
    [signingGuardrails]
  );

  const buildSalarySeries = useCallback(
    (firstYear: number, years: number, raisePct: number | null | undefined): number[] => {
      const totalYears = Math.min(Math.max(years, 1), 5);
      const series: number[] = [];
      for (let i = 0; i < totalYears; i += 1) {
        series.push(i === 0 ? Math.round(firstYear) : Math.round(series[i - 1] * (1 + (raisePct || 0))));
      }
      return series;
    },
    []
  );

  const toSalaryInputs = useCallback(
    (series: number[], years: number): string[] =>
      Array.from({ length: 5 }, (_, idx) =>
        idx < years && series[idx] ? formatCurrencyFull(series[idx]) : ''
      ),
    []
  );

  const buildSigningDispatchPayload = useCallback(
    (overrides: Partial<StagedSigningPayloadLike> = {}): StagedSigningPayloadLike => {
      const years = extension.years || extension.salaries?.length || 0;
      const salaries = (extension.salaries || []).slice(0, years);
      const signedUsing =
        selectedException && selectedException !== 'None' ? selectedException : null;
      return {
        ...extension,
        years,
        salaries,
        exceptionType: selectedException,
        signedUsing,
        startYear: ACTION_YEAR,
        guardrails: signingGuardrails,
        raisePct: extension.raisePct ?? signingGuardrails?.raisePct ?? 0.05,
        ...overrides,
      };
    },
    [ACTION_YEAR, extension, selectedException, signingGuardrails]
  );

  const buildCanonicalSigningDispatchPayload = useCallback(
    (overrides: Partial<StagedSigningPayloadLike> = {}): StagedSigningPayloadLike => {
      const stagedPayload = buildSigningDispatchPayload(overrides);
      const salaries = (stagedPayload.salaries || []).map((value) =>
        Math.round(Number(value) || 0)
      );
      const totalValue = salaries.reduce((sum, value) => sum + value, 0);
      const salariesByYear = salaries.map((value, index) => ({
        season: toSeasonCode(ACTION_YEAR + index),
        salary: value,
        capHit: value,
        guaranteed: true,
        option: null,
        optionType: null,
        optionUsed: null,
      }));
      return {
        ...stagedPayload,
        contractYears: stagedPayload.contractYears ?? stagedPayload.years,
        salariesByYear,
        base: salaries[0] || 0,
        totalValue,
        averageAnnualValue:
          stagedPayload.years > 0 ? Math.round(totalValue / stagedPayload.years) : 0,
        firstYearGuaranteed: salariesByYear[0]?.guaranteed !== false,
      };
    },
    [ACTION_YEAR, buildSigningDispatchPayload]
  );

  const buildOfferSheetDispatchPayload = useCallback(
    (overrides: Partial<StagedSigningPayloadLike> = {}): StagedSigningPayloadLike => {
      const staged = buildCanonicalSigningDispatchPayload({
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaOfferSheetStatus: 'PENDING_MATCH',
        contractType: 'Offer Sheet',
        ...overrides,
      });
      const playerId = String(
        player?.id || player?.player_id || player?.playerId || 'unknown-player'
      );
      return {
        ...staged,
        offerSheetProposal: {
          proposalVersion: 1,
          signedAt: offerSheetTiming.signedAt,
          receivedAt: offerSheetTiming.receivedAt,
          principalTermsDocumentId: `architect-principal-terms:${playerId}:v1`,
          noticeDocumentId: `architect-offer-sheet-notice:${playerId}:v1`,
          salariesByYear: (staged.salariesByYear || []).map((row) => ({
            season: row.season,
            salaryExcludingIncentive: row.salary,
            regularSalary: row.salary,
            bonuses: [],
            guaranteedForLackOfSkill: row.guaranteed,
            guaranteedForInjuryOrIllness: row.guaranteed,
            individuallyNegotiatedProtectionConditions: false,
            option: null,
          })),
        },
      };
    },
    [buildCanonicalSigningDispatchPayload, offerSheetTiming, player]
  );

  const signAndTradeDispatchPayload = useMemo(
    () => buildSigningDispatchPayload({ signAndTrade: true, contractType: 'Sign & Trade' }),
    [buildSigningDispatchPayload]
  );

  const offerSheetDispatchPayload = useMemo(
    () => buildOfferSheetDispatchPayload(),
    [buildOfferSheetDispatchPayload]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!player) return;
    const defaultYears = 3;
    const baseSalary = lastSalaryForPrefill || 0;
    setExtension({
      years: defaultYears,
      contractType: 'Standard',
      salaries: Array(5).fill(baseSalary),
      raisePct: 0.05,
    });
    setSalaryInputs(
      Array(5)
        .fill(baseSalary)
        .map((s) => (s ? formatCurrencyFull(s) : ''))
    );
    setSelectedException('None');

    const eligibility = playerRulesProfile?.extensionEligibility;
    const terms = playerRulesProfile?.extensionTerms;
    if (eligibility) {
      setExtReason(eligibility.isEligible ? 'Eligible' : eligibility.reason || 'Not eligible');
      setExtMax(
        terms
          ? {
              maxYears: terms.maxYears,
              maxFirstYearSalary: terms.maxFirstYearSalary,
              minFirstYearSalary: terms.minFirstYearSalary,
              baseRaisePct: terms.raisePercentage ?? null,
              type: terms.extensionType,
              basedOn: terms.basedOn ?? null,
              notes: terms.notes ?? null,
            }
          : null
      );
      return;
    }

    try {
      const seasonId = toSeasonCode(CURRENT_YEAR);
      const ruleCtx = buildMinimalRuleContext(seasonId, 'VETERAN_EXTENSION');
      const playerCtx = {
        ...ruleCtx,
        player: {
          ...ruleCtx.player,
          playerId: String(player.id || player.player_id || 'unknown'),
          displayName: player.displayName || player.name || 'Unknown',
          yearsOfServiceAtOperation:
            Number(player.yearsOfService || player.bio?.experience || 0),
          priorSeasonSalary: lastSalaryForPrefill || null,
          currentSeasonSalary: lastSalaryForPrefill || null,
          isRookieScale:
            player.contract?.isRookieScale ||
            player.contract?.contractType === 'Rookie Scale',
          draftInfo: player.bio?.draftYear
            ? {
                year: Number(player.bio.draftYear),
                round: Number(player.bio.draftRound || 0),
                pick: Number(player.bio.draftPick || 0),
              }
            : null,
        },
      };
      const extProfile = getExtensionProfile(playerCtx);
      if (!extProfile?.eligibility?.isEligible) {
        setExtReason(extProfile?.eligibility?.reason || 'Not eligible');
        setExtMax(null);
        return;
      }
      setExtReason('Eligible');
      const extTerms = extProfile.terms;
      setExtMax(
        extTerms
          ? {
              maxYears: extTerms.maxYears || 4,
              maxFirstYearSalary: extTerms.maxFirstYearSalary || 0,
              minFirstYearSalary:
                extTerms.minFirstYearSalary || extTerms.maxFirstYearSalary || 0,
              baseRaisePct: extTerms.raisePercentage || 0.08,
              type: extTerms.extensionType || 'Standard',
              basedOn: extTerms.basedOn || '',
              notes: extTerms.notes || '',
            }
          : null
      );
    } catch (err) {
      console.warn('Extension eligibility check failed:', err);
      setExtReason('Unable to determine eligibility');
      setExtMax(null);
    }
  }, [CURRENT_YEAR, initialAction, lastSalaryForPrefill, player, playerRulesProfile]);

  useEffect(() => {
    if (selectedAction !== 'extend') return;
    if (!extMax) {
      setExtension((prev) => ({
        ...prev,
        years: prev.years || 1,
        salaries: prev.salaries || [0],
      }));
      setSalaryInputs((prev) => (prev.length ? prev : ['']));
      return;
    }
    const firstYearSalary = (() => {
      const min = extMax.minFirstYearSalary ?? 0;
      const max = extMax.maxFirstYearSalary ?? min;
      const target = extMax.maxFirstYearSalary ?? min;
      const effectiveMax =
        extensionMutationFirstYearMax != null
          ? Math.min(max || target, extensionMutationFirstYearMax)
          : max || target;
      const clamped = Math.min(Math.max(min, target), effectiveMax);
      return clamped;
    })();
    setExtension((prev) => {
      const years = extMax.maxYears || prev.years || 1;
      const safeRaisePct = Math.max(0, (extMax.baseRaisePct ?? 0.08) - 0.0001);
      const salaries = buildSalarySeries(
        firstYearSalary,
        years,
        safeRaisePct
      );
      setSalaryInputs(toSalaryInputs(salaries, years));
      return {
        years,
        contractType: 'Standard',
        salaries,
        raisePct: safeRaisePct,
      };
    });
  }, [
    buildSalarySeries,
    extMax,
    extensionMutationFirstYearMax,
    selectedAction,
    toSalaryInputs,
  ]);

  useEffect(() => {
    if (!signingGuardrails || !isSigningAction) return;
    setExtension((prev) => {
      const maxYears =
        signingGuardrails.maxYears && signingGuardrails.maxYears > 0
          ? Math.min(signingGuardrails.maxYears, 5)
          : Math.min(prev.years || 3, 5);
      const baseFirstYear = clampFirstYearToGuardrails(
        (selectedException !== 'None' && signingGuardrails.maxFirstYear != null
          ? signingGuardrails.maxFirstYear
          : prev.salaries?.[0]) ??
          signingGuardrails.maxFirstYear ??
          lastSalaryForPrefill ??
          signingGuardrails.minFirstYear ??
          0
      );
      const raisePct = signingGuardrails.raisePct ?? prev.raisePct ?? 0.05;
      const series = buildSalarySeries(baseFirstYear, maxYears, raisePct);
      setSalaryInputs(toSalaryInputs(series, maxYears));
      return { ...prev, years: maxYears, salaries: series, raisePct };
    });
  }, [
    isSigningAction,
    signingGuardrails,
    lastSalaryForPrefill,
    selectedException,
    clampFirstYearToGuardrails,
    buildSalarySeries,
    toSalaryInputs,
  ]);

  // Reset non-buyout form state when action changes or modal closes
  useEffect(() => {
    setIsOfferSheet(false);
    setOfferSheetTiming({ signedAt: '', receivedAt: '' });
  }, [selectedAction, isOpen]);

  return {
    extension,
    setExtension,
    salaryInputs,
    setSalaryInputs,
    selectedException,
    setSelectedException,
    isOfferSheet,
    setIsOfferSheet,
    offerSheetTiming,
    setOfferSheetTiming,
    extReason,
    extMax,
    signingGuardrails,
    availableSigningExceptions,
    contractDataForValidation,
    clampFirstYearToGuardrails,
    buildSalarySeries,
    toSalaryInputs,
    buildSigningDispatchPayload,
    buildCanonicalSigningDispatchPayload,
    buildOfferSheetDispatchPayload,
    signAndTradeDispatchPayload,
    offerSheetDispatchPayload,
  };
};
