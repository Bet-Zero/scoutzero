/**
 * Wave 29 Step 2: Primary team initialization effect extracted from useTradeMachine.ts
 * (lines 215–365).
 *
 * Owns the async init flow: load team data, resolve entitlements, augment
 * exceptions, compute baseline payroll, and populate slot 0.
 */

import { useEffect } from 'react';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';
import { type PickRuleDoc } from '@/features/architect/utils/entitlements/pickRulesResolver';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import {
  attachGovernedTradeSalaryBasisToRoster,
  loadWorldGovernedTradeSalaryBasisEntries,
  resolveTradeSalaryBasisPlayerId,
} from '@/features/architect/utils/tradeMachine/utils/governedTradeSalaryBasis';
import { type TeamEntry } from '@/constants/teamList';
import {
  DEBUG_ENT,
  ENABLE_PICK_RULES,
  getErrorMessage,
  resolveBaseTeamLike,
  resolveTeamCodeLike,
  resolveTradeSalaryBasisTeamId,
  resolvePickRulesForEntitlements,
  augmentTeamWithExceptions,
  getCapTotalsForYear,
} from './useTradeMachine.helpers';
import type {
  UnknownRecord,
  TradeMachineTeam,
  TradeMachineTeamSlot,
} from './useTradeMachine.types';

export type UseTradeMachineInitParams = {
  primaryTeam: string | null | undefined;
  primaryTeamData: TradeMachineTeam | null;
  capProjections: UnknownRecord | null | undefined;
  yearKey: number;
  worldId: string | null;
  worldAsOfDate: string | null;
  setTeams: React.Dispatch<React.SetStateAction<TradeMachineTeamSlot[]>>;
  setInitError: React.Dispatch<React.SetStateAction<string | null>>;
  lastInitInputsRef: React.MutableRefObject<{
    primaryTeam: string | null | undefined;
    primaryTeamData: TradeMachineTeam | null;
    yearKey: string | number;
    worldId: string | null;
    worldAsOfDate: string | null;
  } | null>;
};

export function useTradeMachineInit({
  primaryTeam,
  primaryTeamData,
  capProjections,
  yearKey,
  worldId,
  worldAsOfDate,
  setTeams,
  setInitError,
  lastInitInputsRef,
}: UseTradeMachineInitParams): void {
  // Initialize teams (slot 0 = primary team, slot 1 = empty)
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!primaryTeam) return;

      if (
        lastInitInputsRef.current?.primaryTeam === primaryTeam &&
        lastInitInputsRef.current?.primaryTeamData === primaryTeamData &&
        lastInitInputsRef.current?.yearKey === yearKey &&
        lastInitInputsRef.current?.worldId === worldId &&
        lastInitInputsRef.current?.worldAsOfDate === worldAsOfDate
      ) {
        return;
      }

      // React Strict Mode immediately cleans up and replays this effect in
      // development. Yield once so the cancelled probe exits before issuing
      // Firestore reads; the replacement pass then performs the real load.
      await Promise.resolve();
      if (cancelled) return;

      try {
        // Phase 16.3: Clear any previous init error on new init attempt
        setInitError(null);

        const baseTeam = resolveBaseTeamLike(primaryTeam, primaryTeamData);
        // Use primaryTeamData if provided (already world-aware from GMDashboard)
        // Otherwise load with world-awareness via loadWorldTeamData
        const data = (primaryTeamData ||
          (await loadWorldTeamData(
            worldId,
            primaryTeam
          ))) as TradeMachineTeam | null;

        if (cancelled) return;
        if (!baseTeam || !data) return;

        if (baseTeam && data) {
          // Build team object, augment exceptions/tpes
          // Phase 16.3: Draft assets are entitlements-only, no legacy picks processing
          const teamObj = {
            ...baseTeam,
            ...data,
            // Phase 65: Use canonical accessor but store in tradeExceptions for runtime compatibility
            tradeExceptions: getTeamTpeList(data),
          } as TradeMachineTeam & Partial<TeamEntry>;

          if (worldId && worldAsOfDate) {
            const rosterPlayers = Array.isArray(teamObj.players)
              ? teamObj.players
              : [];
            const rosterPlayerIds = rosterPlayers
              .map((player) => resolveTradeSalaryBasisPlayerId(player))
              .filter(Boolean);
            const salaryBasisTeamId = resolveTradeSalaryBasisTeamId(
              baseTeam,
              data
            );
            if (!salaryBasisTeamId) {
              teamObj.governedTradeSalaryBasisLoadError =
                'Governed Trade Machine salary authority requires a Team identity.';
            } else {
              try {
                const salaryBasis =
                  await loadWorldGovernedTradeSalaryBasisEntries({
                    worldId,
                    teamId: salaryBasisTeamId,
                    rosterPlayerIds,
                    worldAsOfDate,
                    salaryCapYear: yearKey,
                  });
                teamObj.players = attachGovernedTradeSalaryBasisToRoster(
                  rosterPlayers,
                  salaryBasis
                );
              } catch (error) {
                teamObj.governedTradeSalaryBasisLoadError =
                  error instanceof Error
                    ? error.message
                    : 'Governed Trade Machine salary authority could not be loaded.';
              }
            }
          }

          if (worldId || (data.entitlementIds && data.entitlementIds.length)) {
            try {
              const resolvedTeamCode = resolveTeamCodeLike(baseTeam, data);
              if (DEBUG_ENT) {
                console.log('[DEBUG_ENT] init slot 0:', {
                  slotIndex: 0,
                  teamCode: resolvedTeamCode,
                  worldId,
                  hasEntitlementIds: Boolean(data.entitlementIds?.length),
                });
              }
              if (resolvedTeamCode) {
                const entitlements = await resolveEntitlementsForTeam(
                  worldId,
                  resolvedTeamCode
                );
                teamObj.entitlements = entitlements;

                // Phase 12.3B: Fetch pick rules for entitlements
                let pickRulesById: Record<string, PickRuleDoc> = {};
                if (ENABLE_PICK_RULES) {
                  pickRulesById =
                    await resolvePickRulesForEntitlements(entitlements);
                }
                teamObj.pickRulesById = pickRulesById;

                if (DEBUG_ENT) {
                  console.log('[DEBUG_ENT] init slot 0 resolved:', {
                    teamCode: resolvedTeamCode,
                    entitlementsCount: entitlements?.length ?? 0,
                    pickRulesCount: Object.keys(pickRulesById).length,
                    usingLegacyFallback: false,
                  });
                }
              } else {
                console.warn('[init] Could not resolve team code for slot 0');
                teamObj.entitlements = [];
                teamObj.pickRulesById = {};
              }
            } catch (err) {
              console.warn('Failed to resolve team entitlements:', err);
              teamObj.entitlements = [];
              teamObj.pickRulesById = {};
            }
          }
          augmentTeamWithExceptions(teamObj, yearKey, capProjections);

          // === Baseline payroll wiring (SSOT) ===
          const {
            playersTotal: baseline,
            deadMoneyTotal: dead,
            teamSalary,
            apronTeamSalary,
            taxSalary,
            salaryBooks,
          } = getCapTotalsForYear(teamObj, yearKey, worldAsOfDate);
          // The legacy trade-rule bridge measures apron restrictions. Keep it
          // explicitly wired to Apron Team Salary while retaining each named
          // book on the team object for its own consumers and receipts.
          teamObj.teamTotalSalary = apronTeamSalary;
          teamObj.projectedSalary = apronTeamSalary;
          teamObj.teamSalary = teamSalary;
          teamObj.apronTeamSalary = apronTeamSalary;
          teamObj.taxSalary = taxSalary;
          teamObj.salaryBooks = salaryBooks;

          if (import.meta.env.DEV)
            console.log(
              '[init payroll SSOT]',
              teamObj.nickname || teamObj.teamName || teamObj.id,
            {
              year: yearKey,
              baseline,
              dead,
              teamTotalSalary: teamObj.teamTotalSalary,
              projectedSalary: teamObj.projectedSalary,
            }
          );

          if (cancelled) return;
          // Record completion only after the async initialization survives its
          // effect lifetime. React Strict Mode intentionally cancels the first
          // development pass; recording the inputs before this point caused
          // its replacement pass to deduplicate itself and leave both slots
          // empty forever.
          lastInitInputsRef.current = {
            primaryTeam,
            primaryTeamData,
            yearKey,
            worldId,
            worldAsOfDate,
          };
          setTeams([
            {
              team: teamObj,
              sends: [],
              // Phase 14.2: Removed picksOut - draft assets are entitlements-only
              entitlementsOut: [],
            },
            { team: null, sends: [], entitlementsOut: [] },
          ]);
        }
      } catch (err) {
        if (cancelled) return;
        // Phase 16.3: Surface init failures instead of silent blank UI
        console.error('[tradeMachine:init] failed to init trade teams', err);
        setInitError(
          getErrorMessage(err) ||
            'Unknown error during trade machine initialization'
        );
        // Attempt safe fallback: if primaryTeamData exists, try to set minimal slot0
        if (primaryTeamData) {
          const baseTeam = resolveBaseTeamLike(primaryTeam, primaryTeamData);
          if (baseTeam) {
            const fallbackTeamObj = {
              ...baseTeam,
              ...primaryTeamData,
              tradeExceptions: getTeamTpeList(primaryTeamData),
              entitlements: [],
              pickRulesById: {},
            };
            lastInitInputsRef.current = {
              primaryTeam,
              primaryTeamData,
              yearKey,
              worldId,
              worldAsOfDate,
            };
            setTeams([
              { team: fallbackTeamObj, sends: [], entitlementsOut: [] },
              { team: null, sends: [], entitlementsOut: [] },
            ]);
          }
        }
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [
    primaryTeam,
    primaryTeamData,
    capProjections,
    yearKey,
    worldId,
    worldAsOfDate,
  ]);
}
