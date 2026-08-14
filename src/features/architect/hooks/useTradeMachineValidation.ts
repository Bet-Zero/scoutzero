/**
 * Wave 29 Step 4: Validation callbacks extracted from useTradeMachine.ts
 * (lines 228–447 of the pre-extraction file).
 *
 * Owns buildCurrentTradePreviewContext (payload assembly + trade preparation),
 * validateCurrentTrade, and handleValidate (the user-triggered validation entry point).
 */

import { useCallback } from 'react';
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';
import {
  buildTradeApplyPreparation,
  getTradePreviewAuthority,
} from '@/features/architect/utils/tradeContext/tradeContext';
import { validateTradeData } from '@/features/architect/utils/tradeMachine/utils/dataValidation';
import {
  hasTeamSlot,
  asUnknownRecord,
  getCapTotalsForYear,
} from './useTradeMachine.helpers';
import type {
  UnknownRecord,
  TradeMachineTeamSlot,
  TradeMachinePreviewAuthority,
  TradeMachineSnapshotValidationDetails,
  PreparedTradePreviewContext,
  ValidateCurrentTradeOutcome,
} from './useTradeMachine.types';
import type {
  TradeContextPayload,
  TradeContextCurrentState,
} from '@/features/architect/utils/tradeContext/types';

export type UseTradeMachineValidationParams = {
  teams: TradeMachineTeamSlot[];
  capProjections: UnknownRecord | null | undefined;
  yearKey: number;
  worldId: string | null;
  worldAsOfDate: string | null;
  forceTrade: boolean;
  currentDraftKey: string;
  setSnapshotValidationDetails: (
    v: TradeMachineSnapshotValidationDetails | null
  ) => void;
  setPreviewAuthority: (v: TradeMachinePreviewAuthority | null) => void;
  setIsValidating: (v: boolean) => void;
  lastValidatedDraftKeyRef: React.MutableRefObject<string | null>;
  validatedAtRef: React.MutableRefObject<number | null>;
};

export type UseTradeMachineValidationResult = {
  // Returns synchronously whether validation could start. 'insufficient' means
  // there are not enough active teams to validate (caller surfaces feedback).
  handleValidate: () => 'insufficient' | 'started';
};

export function useTradeMachineValidation({
  teams,
  capProjections,
  yearKey,
  worldId,
  worldAsOfDate,
  forceTrade,
  currentDraftKey,
  setSnapshotValidationDetails,
  setPreviewAuthority,
  setIsValidating,
  lastValidatedDraftKeyRef,
  validatedAtRef,
}: UseTradeMachineValidationParams): UseTradeMachineValidationResult {
  const buildCurrentTradePreviewContext =
    useCallback((): PreparedTradePreviewContext | null => {
      const patchedTeams = teams.map((teamSlot) => {
        if (!teamSlot.team) {
          return teamSlot;
        }

        if (
          !Number.isFinite(teamSlot.team.teamTotalSalary) ||
          teamSlot.team.teamTotalSalary === 0
        ) {
          const { totalWithDead } = getCapTotalsForYear(teamSlot.team, yearKey);
          return {
            ...teamSlot,
            team: {
              ...teamSlot.team,
              teamTotalSalary: totalWithDead,
              projectedSalary: totalWithDead,
            },
          };
        }

        return teamSlot;
      });
      const activeTeams = patchedTeams.filter(hasTeamSlot);

      if (activeTeams.length < 2) {
        return null;
      }

      const seasonId = toSeasonKey(yearKey) ?? String(yearKey);
      const payload: TradeContextPayload = {
        teams: activeTeams.map((slot) => ({
          teamCode: String(slot.team.teamCode || slot.team.id || ''),
          teamId: String(slot.team.id || slot.team.teamCode || ''),
          sends: slot.sends,
          entitlementsOut: slot.entitlementsOut || [],
          salaryMatchingElection: slot.salaryMatchingElection ?? null,
        })),
        capProjections: capProjections as TradeContextPayload['capProjections'],
        tradeCtx: {
          worldId: worldId ?? undefined,
          yearKey,
          source: 'tradeMachine',
          ...(worldAsOfDate ? { asOfDate: worldAsOfDate } : {}),
        },
      };
      const currentState: TradeContextCurrentState = {
        teams: activeTeams.map((slot) => ({
          teamCode: String(slot.team.teamCode || slot.team.id || '') || null,
          team: slot.team,
        })),
      };

      return {
        activeTeams,
        payload,
        currentState,
        seasonId,
        preparation: buildTradeApplyPreparation({
          payload,
          currentState,
          seasonId,
          timestamp: Date.now(),
        }),
      };
    }, [teams, capProjections, yearKey, worldId, worldAsOfDate]);

  // Core validation compute. Runs the (synchronous) validation for a prepared
  // preview context and writes the snapshot details. Intentionally does NOT
  // toggle isValidating or build the context — the caller owns those — so the
  // compute can be deferred a tick for UI feedback (TMUI-01).
  const runValidation = useCallback(
    (
      previewContext: PreparedTradePreviewContext
    ): ValidateCurrentTradeOutcome | null => {
      try {
        const { activeTeams, preparation } = previewContext;

        if (import.meta.env.DEV) {
          // TMUI-06: debug logging gated to dev builds
          console.log(
            '[validate -> teams payroll]',
            activeTeams.map((teamSlot) => ({
              team:
                teamSlot.team.nickname ||
                teamSlot.team.name ||
                teamSlot.team.id,
              teamTotalSalary: teamSlot.team.teamTotalSalary,
              projectedSalary: teamSlot.team.projectedSalary,
            }))
          );
        }

        const validation = asUnknownRecord(
          preparation.validatedContext._rawValidation ||
            preparation.validatedContext
        ) as UnknownRecord & {
          teamResults?: UnknownRecord[] | null;
          violations?: unknown[];
          warnings?: unknown[];
          reason?: unknown;
          error?: unknown;
        };
        // TM_DATAWARN_UI_E1: Validate data quality for all players in trade
        const allPlayers = activeTeams.flatMap(
          (teamSlot) => teamSlot.sends || []
        );
        const dataValidation = validateTradeData(
          allPlayers,
          yearKey
        ) as UnknownRecord & {
          hasIssues?: boolean;
          warnings?: unknown[];
          summary?: unknown;
        };

        // Environment flag to enable force trade bypass
        // In production (canOverride=false), forceTrade has no effect
        const canOverride = import.meta.env.VITE_ENABLE_CBA_OVERRIDE === 'true';

        const snapshotValidationDetails: TradeMachineSnapshotValidationDetails =
          {
            summaryByTeamIndex: Array.isArray(validation.summaryByTeamIndex)
              ? validation.summaryByTeamIndex
              : [],
            teamResults: Array.isArray(validation.teamResults)
              ? validation.teamResults
              : preparation.validatedContext.teamResults,
            capSettings: validation.capSettings ?? null,
            tradeReceipt: validation.tradeReceipt ?? null,
            override: {
              requested: Boolean(forceTrade),
              enabled: canOverride,
              appliedToLegality: false,
              message: forceTrade
                ? canOverride
                  ? 'Force-trade was requested, but authoritative legality remains unchanged.'
                  : 'Force-trade was requested, but override is disabled in this environment.'
                : null,
            },
            // TM_DATAWARN_UI_E1: Attach data warnings to snapshot detail payload
            hasDataIssues: dataValidation.hasIssues,
            dataWarnings: dataValidation.warnings,
            dataValidationSummary: dataValidation.summary,
          };

        setSnapshotValidationDetails(snapshotValidationDetails);

        if (import.meta.env.DEV) {
          // TMUI-06: debug logging gated to dev builds
          console.log(
            '[after validate]',
            (Array.isArray(validation.teamResults)
              ? validation.teamResults
              : []
            ).map((teamResult) => {
              const result = asUnknownRecord(teamResult);
              const team = asUnknownRecord(result.team);
              const preTradeStatus = asUnknownRecord(result.preTradeStatus);
              const postTradeStatus = asUnknownRecord(result.postTradeStatus);

              return {
                team: team.nickname || team.name || team.id,
                pre: preTradeStatus.projectedSalary,
                post: postTradeStatus.projectedSalary,
                apron: postTradeStatus.isAtOrAboveSecondApron,
              };
            })
          );
        }

        return { snapshotValidationDetails, previewContext };
      } catch (error) {
        console.error(
          '[useTradeMachine] runValidation unexpected error:',
          error
        );
        setSnapshotValidationDetails(null);
        setPreviewAuthority(null);
        return null;
      }
    },
    [yearKey, forceTrade, setSnapshotValidationDetails, setPreviewAuthority]
  );

  // REMOVED: Auto-validation effect was causing stale "Validated" state
  // Validation now ONLY happens when user clicks "Validate Trade" (explicit action)

  // Manual validation trigger - the ONLY way validation should happen.
  // Returns synchronously whether validation could start; the compute itself is
  // deferred one tick (TMUI-01) so the "Validating…" state can paint, and the
  // caller can surface feedback when there aren't enough teams (TMUI-03).
  const handleValidate = useCallback((): 'insufficient' | 'started' => {
    const previewContext = buildCurrentTradePreviewContext();
    if (!previewContext) {
      setSnapshotValidationDetails(null);
      setPreviewAuthority(null); // TM-1A / TM-3D: clear stale preview authority
      setIsValidating(false);
      return 'insufficient';
    }

    setIsValidating(true);
    // Defer the synchronous compute one tick so React can paint the
    // "Validating…" state before the results land.
    setTimeout(() => {
      try {
        const outcome = runValidation(previewContext);
        if (outcome) {
          // Stale validation fix: Record the draft key that was validated
          lastValidatedDraftKeyRef.current = currentDraftKey;
          validatedAtRef.current = Date.now();

          try {
            const previewAuthority = getTradePreviewAuthority({
              payload: previewContext.payload,
              currentState: previewContext.currentState,
              seasonId: previewContext.seasonId,
              preparation: previewContext.preparation,
            });
            setPreviewAuthority(previewAuthority);
          } catch (err) {
            console.error(
              '[useTradeMachine] getTradePreviewAuthority unexpected error:',
              err
            );
            setPreviewAuthority(null);
          }
        }
      } finally {
        setIsValidating(false);
      }
    }, 0);

    return 'started';
  }, [
    buildCurrentTradePreviewContext,
    runValidation,
    currentDraftKey,
    setSnapshotValidationDetails,
    setPreviewAuthority,
    setIsValidating,
    lastValidatedDraftKeyRef,
    validatedAtRef,
  ]);

  return { handleValidate };
}
