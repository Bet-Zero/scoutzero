/** Accounts for ordinary Contracts in the bounded mixed-pick lanes.
 * This establishes consideration identity, never whole-trade legality.
 */
import { isTwoWayTradePlayer } from '../tradeMachine/utils/twoWayTradeSalary';
import { GovernedTradeSalaryBasisZ } from '@/schemas/governedTradeSalaryBasis';
import { TradeSalaryMatchingElectionZ } from '@/schemas/tradeSalaryMatchingPath';
import { normalizeCurrentStatePlayerContract } from '../mutationPipeline.helpers';
import { mutationSnapshotText } from '../mutationPipeline.snapshotDigest';
import { LIVE_GOVERNED_TRADE_SALARY_AUTHORITY } from '../tradeContext/tradeContext.payloadNormalization';
import type { ApplyWorldMutationArgs } from '../mutationPipeline.types.ingress';

type RecordLike = Record<string, unknown>;
export function simulationPlayerMovements(
  args: ApplyWorldMutationArgs,
  branch: string,
  state: { teams?: readonly { teamCode?: string | null; team?: unknown }[] }
) {
  const slots = args.payload.teams ?? [];
  const movements: {
    playerId: string;
    contractId: string;
    fromTeam: string;
    toTeam: string;
  }[] = [];
  const hasPlayers = slots.some((s) => s.sends?.length);
  const supportedPath = (path: string) =>
    path === 'STANDARD_TPE' ||
    (branch === 'native-selections' && path === 'ROOM');
  if (
    hasPlayers &&
    (args.payload.capProjections != null ||
      args.payload.tradeCtx?.tradeDate != null ||
      args.payload.tradeCtx?.offseason != null)
  )
    throw new Error(
      'Mixed trades use the governed world date, calendar and cap levels.'
    );
  for (const slot of slots) {
    if (
      slot.receives?.length ||
      slot.receiving?.length ||
      slot.playersReceiving?.length
    )
      throw new Error(
        'Incoming players must be derived from the other team’s outgoing Contracts.'
      );
    const election = TradeSalaryMatchingElectionZ.safeParse(
      slot.salaryMatchingElection
    );
    if (
      hasPlayers &&
      (!election.success ||
        !supportedPath(election.data.path) ||
        Object.keys(election.data.tradedPlayerPreTradeSalaries).length !==
          (slot.sends?.length ?? 0))
    )
      throw new Error(
        'Each team in a mixed trade needs a supported explicit matching path and exact outgoing player salaries.'
      );
    if (!slot.sends?.length) continue;
    if (
      ![
        'unconditional',
        'protection-programs',
        'native-selections',
        'ordered-swap-rights',
      ].includes(branch) ||
      slot.sends.length !== 1 ||
      args.payload.tradeCtx?.source !== 'tradeMachine'
    )
      throw new Error(
        'Mixed trades support one ordinary player per team with original firsts, complete protection programs, admitted unresolved 2026 swap rights or resolved 2028 selections.'
      );
    const team = state.teams?.find((t) => t.teamCode === slot.teamCode)
      ?.team as RecordLike | undefined;
    const player = slot.sends[0];
    const aliases = [player.playerId, player.id, player.player_id].filter(
      (id) => id != null
    );
    const id = aliases[0];
    const stored = (Array.isArray(team?.players) ? team.players : []).filter(
      (p): p is RecordLike =>
        !!p &&
        typeof p === 'object' &&
        (p.playerId ?? p.id ?? p.player_id) === id
    );
    const roster = Array.isArray(team?.roster) ? team.roster : [];
    if (
      typeof id !== 'string' ||
      !id ||
      aliases.some((alias) => alias !== id) ||
      movements.some((m) => m.playerId === id) ||
      stored.length !== 1 ||
      !roster.includes(id) ||
      !(team as Record<PropertyKey, unknown>)[
        LIVE_GOVERNED_TRADE_SALARY_AUTHORITY
      ]
    )
      throw new Error(
        'Each outgoing player requires unique current roster ownership and live governed Contract authority.'
      );
    const authoritative = stored[0];
    const routes = [
      player.tradeTo,
      player.receivingTeamId,
      player.toTeamId,
      player.destTeamId,
    ].filter((route) => route != null);
    const toTeam = routes[0];
    if (
      typeof toTeam !== 'string' ||
      toTeam === slot.teamCode ||
      !slots.some((s) => s.teamCode === toTeam) ||
      routes.some((route) => route !== toTeam) ||
      (player.receivingTeamIndex != null &&
        slots[Number(player.receivingTeamIndex)]?.teamCode !== toTeam)
    )
      throw new Error(
        'Each outgoing player must have one explicit destination among the other participating teams.'
      );
    const contract = Reflect.get(player, 'contract') as Parameters<
      typeof normalizeCurrentStatePlayerContract
    >[0];
    if (
      player.signAndTrade ||
      player.signAndTradeContract ||
      isTwoWayTradePlayer(player) ||
      isTwoWayTradePlayer(authoritative) ||
      (player.absorptionMode && player.absorptionMode !== 'MATCH') ||
      player.tpeId ||
      (contract != null &&
        mutationSnapshotText(normalizeCurrentStatePlayerContract(contract)) !==
          mutationSnapshotText(authoritative.contract))
    )
      throw new Error(
        'Mixed trades require unchanged ordinary standard Contracts.'
      );
    const parsed = GovernedTradeSalaryBasisZ.safeParse(
      authoritative.governedTradeSalaryBasis
    );
    const basis = parsed.success ? parsed.data : null;
    if (
      !basis ||
      basis.status !== 'ready' ||
      basis.worldId !== args.worldId ||
      basis.teamId !== slot.teamCode ||
      basis.playerId !== id ||
      basis.asOfDate !== args.payload.asOfDate ||
      basis.salaryCapYear !== args.payload.tradeCtx?.yearKey ||
      basis.poisonPillIncomingSalary != null
    )
      throw new Error(
        'The outgoing player needs a complete ordinary governed salary basis; unsupported bonuses remain blocked.'
      );
    if (
      !election.success ||
      !supportedPath(election.data.path) ||
      Object.keys(election.data.tradedPlayerPreTradeSalaries).length !== 1 ||
      election.data.tradedPlayerPreTradeSalaries[id] !== basis.outgoingSalary
    )
      throw new Error(
        'Mixed trades require a supported matching path with the exact governed outgoing Salary for each player.'
      );
    movements.push({
      playerId: id,
      contractId: basis.contractId!,
      fromTeam: String(slot.teamCode),
      toTeam,
    });
  }
  return movements;
}
