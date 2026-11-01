/** Shared exact Trade Machine proposal for validation and Apply. */
import { resolveTeamCode } from '@/features/architect/utils/worldTeamData';
import { validateSignAndTradeContractPayload } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import { toSignAndTradeValidationContract } from './useArchitectActions.types';
import type {
  ArchitectMutationContract,
  ArchitectMutationPayload,
} from '@/features/architect/utils/mutationPipeline';
import type {
  ArchitectPlayer,
  TradeDataItem,
  TradeExecutionHandoff,
  TradeExecutionPayload,
  TradeMutationPayloadTeam,
} from './useArchitectActions.types';
import toast from 'react-hot-toast';

export function buildTradeExecutionHandoff(
  tradeData: Array<
    Omit<TradeDataItem, 'teamId' | 'outgoingPlayers' | 'incomingPlayers'> & {
      teamId?: string | null;
      outgoingPlayers?: unknown[];
      incomingPlayers?: unknown[];
    }
  >,
  {
    currentYear,
    worldId,
    worldAsOfDate,
  }: {
    currentYear: number;
    worldId: string | null | undefined;
    worldAsOfDate: string | null | undefined;
  }
): TradeExecutionHandoff {
  const resolvedTeamCodes = tradeData.map(
    (t) => resolveTeamCode(String(t.teamId ?? '')) || String(t.teamId ?? '')
  );
  const teamIndexByCode = new Map<string, number>();
  resolvedTeamCodes.forEach((code, index) => {
    teamIndexByCode.set(code, index);
  });

  const teams: NonNullable<ArchitectMutationPayload['teams']> = tradeData.map(
    (t, teamIndex): TradeMutationPayloadTeam => ({
      teamCode: resolvedTeamCodes[teamIndex],
      sends: ((t.outgoing || t.outgoingPlayers || []) as ArchitectPlayer[]).map(
        (p) => {
          const rawDestination =
            p.receivingTeamId || p.tradeTo || p.toTeamId || p.destTeamId;
          const destinationTeamCode = rawDestination
            ? resolveTeamCode(String(rawDestination)) || String(rawDestination)
            : undefined;
          const receivingTeamIndex =
            destinationTeamCode != null
              ? teamIndexByCode.get(destinationTeamCode)
              : undefined;

          const tradeContract =
            toSignAndTradeValidationContract(p.signAndTradeContract) ||
            (p.contract ? toSignAndTradeValidationContract(p.contract) : null);
          const signAndTradeValidation = p.signAndTrade
            ? validateSignAndTradeContractPayload(tradeContract, currentYear, {
                requireActiveYearRow: true,
              })
            : null;

          if (
            p.signAndTrade &&
            (!destinationTeamCode ||
              destinationTeamCode ===
                (resolveTeamCode(String(t.teamId ?? '')) ||
                  String(t.teamId ?? '')))
          ) {
            throw new Error(
              `Sign-and-trade asset "${p.name || p.id || p.player_id}" must include a valid destination team`
            );
          }

          if (
            p.signAndTrade &&
            (!signAndTradeValidation?.valid || !signAndTradeValidation.contract)
          ) {
            throw new Error(
              `Sign-and-trade asset "${p.name || p.id || p.player_id}" is missing valid contract details`
            );
          }

          return {
            ...p,
            // Explicitly map ID for pipeline consumption
            playerId: p.id || p.player_id,
            // Normalize routing fields so apply-time pipeline can consume either path.
            tradeTo: destinationTeamCode,
            receivingTeamId: destinationTeamCode,
            receivingTeamIndex,
            signAndTrade: !!p.signAndTrade,
            signAndTradeContract:
              signAndTradeValidation?.contract ||
              p.signAndTradeContract ||
              undefined,
            contract:
              // Cast: SignAndTradeNormalizedContract is validated (requireActiveYearRow: true)
              // so seasons are always present — compatible with ArchitectMutationContract at runtime.
              (signAndTradeValidation?.contract || p.contract || undefined) as
                | ArchitectMutationContract
                | undefined,
            contractYears:
              signAndTradeValidation?.contract?.contractYears ||
              p.contractYears ||
              undefined,
            firstYearGuaranteed:
              signAndTradeValidation?.contract?.firstYearGuaranteed ??
              p.firstYearGuaranteed ??
              undefined,
          };
        }
      ),
      picksOut: [],
      // TM-PICKS-E1: Include outgoing entitlements in persistence payload
      outgoingEntitlements: t.outgoingEntitlements || [],
      entitlementsOut: t.outgoingEntitlements || [],
      salaryMatchingElection: t.salaryMatchingElection ?? null,
      cashSent: t.cashSent ?? 0,
      cashToTeamId: t.cashToTeamId
        ? resolveTeamCode(t.cashToTeamId) || t.cashToTeamId
        : null,
    })
  );

  for (const team of teams) {
    for (const player of team.sends || []) {
      if (!player.playerId) {
        console.error('Trade missing playerId', { player, team });
        toast.error('Cannot save trade: Player ID missing');
        throw new Error(
          `Trade missing playerId for ${player.name || 'unknown'}`
        );
      }
    }
  }

  const authoritativeTradeCtx = {
    source: 'tradeMachine' as const,
    worldId: worldId ?? null,
    yearKey: currentYear,
    ...(worldAsOfDate ? { asOfDate: worldAsOfDate } : {}),
  };
  const payload = {
    teams,
    ...(worldAsOfDate ? { asOfDate: worldAsOfDate } : {}),
    tradeCtx: authoritativeTradeCtx,
  } satisfies TradeExecutionPayload;

  return {
    resolvedTeamCodes,
    payload,
  };
}
