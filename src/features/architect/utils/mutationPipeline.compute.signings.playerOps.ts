/**
 * Wave 23 Step 2: Player operation compute functions extracted from
 * mutationPipeline.compute.signings.ts (lines 485–1036).
 * Contains computeWaiveResult, computeExtensionResult, computeOptionResult,
 * computeRenounceResult.
 */

import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import {
  getTeamSourceRecord,
  requireBasicTeamAndPlayerState,
  synchronizeTeamTotalsSnapshotOrTeam,
} from './mutationPipeline.helpers';
import type {
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationDocumentSnapshotReceipt,
  MutationPayloadInputByType,
  MutationTeamAndPlayerCurrentState,
} from './mutationPipeline';
import { renounceGovernedRights } from '@/features/architect/utils/rightsHistory';
import {
  applyGovernedOptionResult,
  contractOverlaySetDigest,
  decideGovernedOption,
} from '@/features/architect/utils/optionDecisions';
import {
  applyGovernedExtensionResult,
  decideGovernedExtension,
} from '@/features/architect/utils/extensions';
import {
  applyGovernedWaiverResult,
  decideGovernedWaiver,
  readGovernedWaiverLifecycles,
  resolveGovernedWaiverTerminationContext,
} from '@/features/architect/utils/waivers';
import { resolveGovernedSeasonEnvelope } from '@/features/architect/utils/governedSeason';

function isExactPlayerOpsSnapshotReceipt(
  receipt: MutationDocumentSnapshotReceipt | null | undefined,
  worldId: string | undefined
): receipt is MutationDocumentSnapshotReceipt {
  if (!receipt || !worldId) return false;
  const sourceLineage = receipt.sourceLineage;
  if (!Array.isArray(sourceLineage)) return false;
  if (receipt.exists) {
    return (
      typeof receipt.digest === 'string' &&
      receipt.digest.length > 0 &&
      receipt.sourceWorldId === worldId &&
      receipt.sourceDigest === receipt.digest &&
      sourceLineage.length === 0
    );
  }
  if (receipt.digest !== null) return false;
  const seenWorldIds = new Set<string>();
  let winningSource:
    | Readonly<{ worldId: string; digest: string }>
    | null = null;
  for (const entry of sourceLineage) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return false;
    }
    const worldIdValue = (entry as Record<string, unknown>).worldId;
    const exists = (entry as Record<string, unknown>).exists;
    const digest = (entry as Record<string, unknown>).digest;
    if (
      typeof worldIdValue !== 'string' ||
      worldIdValue.trim().length === 0 ||
      worldIdValue === worldId ||
      seenWorldIds.has(worldIdValue) ||
      typeof exists !== 'boolean' ||
      (exists
        ? typeof digest !== 'string' || digest.length === 0
        : digest !== null) ||
      winningSource !== null
    ) {
      return false;
    }
    seenWorldIds.add(worldIdValue);
    if (exists === true && typeof digest === 'string') {
      winningSource = { worldId: worldIdValue, digest };
    }
  }
  if (receipt.sourceWorldId === null) {
    return receipt.sourceDigest === null && winningSource === null;
  }
  return (
    typeof receipt.sourceWorldId === 'string' &&
    receipt.sourceWorldId.trim().length > 0 &&
    receipt.sourceWorldId !== worldId &&
    typeof receipt.sourceDigest === 'string' &&
    receipt.sourceDigest.length > 0 &&
    winningSource?.worldId === receipt.sourceWorldId &&
    winningSource.digest === receipt.sourceDigest
  );
}

export function computeWaiveResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
  operationId,
  authoringIdentity,
  recordedAt,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['waivePlayer']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  operationId?: string;
  authoringIdentity?: string;
  recordedAt?: string;
}): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'waivePlayer'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const playerId = payload.playerId || player.player_id || player.id;
  if (
    !teamCode ||
    !playerId ||
    !payload.contractId ||
    !payload.waiverProposal ||
    !currentState.waiverAuthority ||
    !isExactPlayerOpsSnapshotReceipt(currentState.waiverTeamSnapshot, worldId) ||
    !isExactPlayerOpsSnapshotReceipt(currentState.waiverPlayerSnapshot, worldId) ||
    typeof asOfDate !== 'string' ||
    !worldId ||
    !operationId ||
    !authoringIdentity ||
    !recordedAt
  ) {
    return {
      success: false,
      error:
        'Governed waiver requires the pinned Contract, exact local and fallback source-snapshot receipts, an exact League receipt, governed season levels, and author provenance.',
    };
  }
  const salaryCapYear = toEndYear(seasonId);
  if (salaryCapYear === null) {
    return {
      success: false,
      error: 'The waiver Salary Cap Year is unavailable.',
    };
  }
  const terminationContext = resolveGovernedWaiverTerminationContext(
    payload.waiverProposal.leagueReceivedAt,
    salaryCapYear
  );
  if (!terminationContext) {
    return {
      success: false,
      error:
        'The exact Eastern waiver termination and its governed Salary Cap Year are unavailable.',
    };
  }
  const seasonEnvelope = resolveGovernedSeasonEnvelope({
    asOfDate: terminationContext.expiryAt,
    salaryCapYear: terminationContext.salaryCapYear,
    requiredAuthority: 'official',
    team: { teamId: String(teamCode), teamCode: String(teamCode), worldId },
  });
  const salaryCap = seasonEnvelope.systemLevels['salary-cap']?.amount ?? null;
  if (seasonEnvelope.status !== 'complete' || salaryCap === null) {
    return {
      success: false,
      error:
        seasonEnvelope.unavailableReasons[0] ||
        'Governed Salary Cap and calendar inputs are unavailable for this waiver.',
    };
  }
  const playerName = String(
    player.displayName || player.name || playerId
  );
  let existingLifecycles;
  try {
    existingLifecycles = readGovernedWaiverLifecycles(team);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Persisted governed waiver history could not be read.',
    };
  }
  const result = decideGovernedWaiver({
    authority: currentState.waiverAuthority,
    existingLifecycles,
    existingDeadCap: team.deadCap,
    worldId,
    teamId: String(teamCode),
    playerId: String(playerId),
    playerName,
    contractId: String(payload.contractId),
    worldAsOfDate: asOfDate,
    salaryCapYear,
    salaryCapAtElection: salaryCap,
    proposal: payload.waiverProposal,
    operationId,
    authoringIdentity,
    recordedAt,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.reasons[0] || 'Governed waiver needs input.',
    };
  }
  let updatedTeam;
  try {
    updatedTeam = applyGovernedWaiverResult({
      team,
      playerId: String(playerId),
      result,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'The governed waiver could not be applied.',
    };
  }

  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    playerDeletes: [{ playerId, teamCode: String(teamCode) }],
    metadata: {
      type: 'waive',
      teamCode,
      playerId,
      playerName,
      contractId: payload.contractId,
      waiverLifecycleId: result.lifecycle.lifecycleId,
      waiverStatus: 'pending-unclaimed-expiry',
      waiverReceivedAt: result.lifecycle.leagueReceivedAt,
      waiverExpiresAt: result.lifecycle.expiresAt,
      contractTerminatesAt: result.lifecycle.terminationAt,
      stretched: result.lifecycle.path === 'waive-and-stretch',
      buyout: result.lifecycle.path === 'buyout',
      buyoutAmount: result.lifecycle.buyoutReduction,
      stretchYears: result.lifecycle.stretchYears ?? undefined,
      deadCapAmount: result.lifecycle.allocations.reduce(
        (sum, row) => sum + row.teamSalary,
        0
      ),
      contractLedgerId: result.expectedContractLedger.ledgerId,
      contractLedgerVersion: result.expectedContractLedger.ledgerVersion,
      expectedContractLedgerId: result.expectedContractLedger.ledgerId,
      expectedContractLedgerVersion:
        result.expectedContractLedger.ledgerVersion,
      expectedContractOverlayLedgerVersion:
        result.expectedContractLedger.overlayLedgerVersion,
      expectedContractOverlaySetDigest: contractOverlaySetDigest(
        team.contractEventLedgers
      ),
      expectedTeamSnapshotExists: currentState.waiverTeamSnapshot.exists,
      expectedTeamSnapshotDigest: currentState.waiverTeamSnapshot.digest,
      expectedTeamSourceWorldId:
        currentState.waiverTeamSnapshot.sourceWorldId,
      expectedTeamSourceSnapshotDigest:
        currentState.waiverTeamSnapshot.sourceDigest,
      expectedTeamSourceLineage:
        currentState.waiverTeamSnapshot.sourceLineage,
      expectedPlayerSnapshotExists: currentState.waiverPlayerSnapshot.exists,
      expectedPlayerSnapshotDigest: currentState.waiverPlayerSnapshot.digest,
      expectedPlayerSourceWorldId:
        currentState.waiverPlayerSnapshot.sourceWorldId,
      expectedPlayerSourceSnapshotDigest:
        currentState.waiverPlayerSnapshot.sourceDigest,
      expectedPlayerSourceLineage:
        currentState.waiverPlayerSnapshot.sourceLineage,
      timestamp,
    },
  };
}

export function computeExtensionResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
  operationId,
  authoringIdentity,
  recordedAt,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['extendPlayer']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  operationId?: string;
  authoringIdentity?: string;
  recordedAt?: string;
}): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'extendPlayer'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const playerId = payload.playerId || player.player_id || player.id;
  if (
    !teamCode ||
    !playerId ||
    !payload.contractId ||
    !payload.extensionProposal ||
    !currentState.extensionAuthority ||
    !isExactPlayerOpsSnapshotReceipt(
      currentState.extensionTeamSnapshot,
      worldId
    ) ||
    !isExactPlayerOpsSnapshotReceipt(
      currentState.extensionPlayerSnapshot,
      worldId
    ) ||
    typeof asOfDate !== 'string' ||
    !worldId ||
    !operationId ||
    !authoringIdentity ||
    !recordedAt
  ) {
    return {
      success: false,
      error:
        'Governed extension requires the pinned Contract, retained extension evidence, exact local and fallback source-snapshot receipts, an exact proposal and world date, and author provenance.',
    };
  }
  const result = decideGovernedExtension({
    authority: currentState.extensionAuthority,
    worldId,
    teamId: String(teamCode),
    playerId: String(playerId),
    contractId: String(payload.contractId),
    worldAsOfDate: asOfDate,
    proposal: payload.extensionProposal,
    operationId,
    authoringIdentity,
    recordedAt,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.reasons[0] || 'Governed extension needs input.',
    };
  }
  let applied;
  try {
    applied = applyGovernedExtensionResult({
      team,
      playerId: String(playerId),
      result,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'The governed extension result could not be applied.',
    };
  }
  const updatedTeam = applied.team;
  const updatedPlayer = applied.updatedPlayer;

  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'extension',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      extensionYears: result.extensionSalaries.length,
      extensionTerms: {
        years: result.extensionSalaries.length,
        salariesByYear: result.extensionSalaries,
      },
      extensionRoute: result.route,
      contractId: payload.contractId,
      contractEventId: result.event.eventId,
      contractLedgerId: result.ledger.ledgerId,
      contractLedgerVersion: result.ledger.ledgerVersion,
      expectedContractLedgerId: result.expectedContractLedger.ledgerId,
      expectedContractLedgerVersion:
        result.expectedContractLedger.ledgerVersion,
      expectedContractOverlayLedgerVersion:
        result.expectedContractLedger.overlayLedgerVersion,
      expectedContractOverlaySetDigest: contractOverlaySetDigest(
        team.contractEventLedgers
      ),
      expectedTeamSnapshotExists: currentState.extensionTeamSnapshot.exists,
      expectedTeamSnapshotDigest: currentState.extensionTeamSnapshot.digest,
      expectedTeamSourceWorldId:
        currentState.extensionTeamSnapshot.sourceWorldId,
      expectedTeamSourceSnapshotDigest:
        currentState.extensionTeamSnapshot.sourceDigest,
      expectedTeamSourceLineage:
        currentState.extensionTeamSnapshot.sourceLineage,
      expectedPlayerSnapshotExists:
        currentState.extensionPlayerSnapshot.exists,
      expectedPlayerSnapshotDigest:
        currentState.extensionPlayerSnapshot.digest,
      expectedPlayerSourceWorldId:
        currentState.extensionPlayerSnapshot.sourceWorldId,
      expectedPlayerSourceSnapshotDigest:
        currentState.extensionPlayerSnapshot.sourceDigest,
      expectedPlayerSourceLineage:
        currentState.extensionPlayerSnapshot.sourceLineage,
      timestamp,
    },
  };
}

export function computeOptionResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
  operationId,
  authoringIdentity,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['optionDecision']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  operationId?: string;
  authoringIdentity?: string;
}): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'optionDecision'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const playerId = payload.playerId || player.player_id || player.id;
  const targetYear = Number(payload.targetYear);
  if (
    !teamCode ||
    !playerId ||
    !payload.contractId ||
    typeof payload.accepted !== 'boolean' ||
    !payload.optionNotice ||
    !currentState.optionAuthority ||
    !Number.isInteger(targetYear) ||
    typeof asOfDate !== 'string' ||
    !worldId ||
    !operationId ||
    !authoringIdentity
  ) {
    return {
      success: false,
      error:
        'Governed option decision requires the pinned contract, explicit world date, exact notice evidence, and author provenance.',
    };
  }
  const result = decideGovernedOption({
    authority: currentState.optionAuthority,
    rightsLedger: team.rightsLedger,
    worldId,
    teamId: String(teamCode),
    playerId: String(playerId),
    contractId: String(payload.contractId),
    baselineSalaryCapYear: currentState.optionAuthority.baselineSalaryCapYear,
    worldAsOfDate: asOfDate,
    targetYear,
    choice: payload.accepted ? 'exercise' : 'decline',
    notice: payload.optionNotice,
    operationId,
    authoringIdentity,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.reasons[0] || 'Governed option decision needs input.',
    };
  }

  let applied;
  try {
    applied = applyGovernedOptionResult({
      team,
      playerId: String(playerId),
      result,
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'The governed option result could not be applied.',
    };
  }
  const updatedTeam = applied.team;
  const updatedPlayer = applied.updatedPlayer;

  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: result.endsContract
      ? []
      : [{ playerId, player: updatedPlayer }],
    playerDeletes: result.endsContract
      ? [{ playerId, teamCode: String(teamCode) }]
      : [],
    metadata: {
      type: result.optionType === 'ETO' ? 'eto' : 'option',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      optionType: result.optionType,
      optionDecision: result.choice,
      accepted: payload.accepted,
      targetYear,
      contractId: payload.contractId,
      contractEventId: result.event.eventId,
      contractLedgerId: result.ledger.ledgerId,
      contractLedgerVersion: result.ledger.ledgerVersion,
      expectedContractLedgerId: result.expectedContractLedger.ledgerId,
      expectedContractLedgerVersion:
        result.expectedContractLedger.ledgerVersion,
      expectedContractOverlayLedgerVersion:
        result.expectedContractLedger.overlayLedgerVersion,
      expectedContractOverlaySetDigest: contractOverlaySetDigest(
        team.contractEventLedgers
      ),
      rightsLedgerId: result.expectedRightsLedger?.ledgerId,
      rightsLedgerVersion: result.expectedRightsLedger?.ledgerVersion,
      freeAgentStatus: result.freeAgentStatus,
      freeAgentAmount: result.freeAgentAmount,
      birdRightsType: result.birdType,
      priorTeamOfferCeiling: result.priorTeamOfferCeiling,
      timestamp,
    },
  };
}

export function computeRenounceResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate,
  worldId,
  operationId,
  authoringIdentity,
  recordedAt,
}: ComputeMutationParamsWithCurrentState<
  MutationTeamAndPlayerCurrentState,
  MutationPayloadInputByType['renounceRights']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  operationId?: string;
  authoringIdentity?: string;
  recordedAt?: string;
}): ComputeResultLike {
  const { team, player } = requireBasicTeamAndPlayerState(
    currentState,
    'renounceRights'
  );
  const teamCode = currentState.teamCode || team.teamCode || null;
  const playerId = payload.playerId || player.player_id || player.id;
  const playerName = player.displayName || player.name;

  if (
    !team.rightsLedger ||
    typeof asOfDate !== 'string' ||
    !worldId ||
    !operationId ||
    !authoringIdentity ||
    !recordedAt ||
    !teamCode ||
    !playerId
  ) {
    return {
      success: false,
      error:
        'Renunciation requires a compatible saved world, an explicit governed date, author provenance, and a complete rights ledger.',
    };
  }

  const salaryCapYear = toEndYear(seasonId);
  if (!salaryCapYear) {
    return {
      success: false,
      error: 'Renunciation requires an explicit Salary Cap Year.',
    };
  }

  const renunciation = renounceGovernedRights({
    ledger: team.rightsLedger,
    worldId,
    teamId: teamCode,
    playerId: String(playerId),
    asOfDate,
    salaryCapYear,
    operationId,
    authoringIdentity,
    recordedAt,
  });
  if (!renunciation.success) {
    return { success: false, error: renunciation.error };
  }

  const updatedTeam = { ...team, rightsLedger: renunciation.ledger };

  if (updatedTeam.capHolds && Array.isArray(updatedTeam.capHolds)) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter((hold) => {
      return String(hold.playerId ?? '') !== String(playerId);
    });
  }

  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId)
  ).totals;

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'renounce',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      rightsUsed: 'Renounced',
      birdRightsType: renunciation.before.birdType,
      freeAgentStatus: renunciation.before.freeAgentStatus,
      rightOfFirstRefusal: renunciation.before.rightOfFirstRefusal,
      freeAgentAmountRemoved: renunciation.before.freeAgentAmount,
      rightsLedgerId: renunciation.ledger.ledgerId,
      rightsLedgerVersion: renunciation.ledger.ledgerVersion,
      rightsStateId: renunciation.after.stateReference?.stateId,
      rightsStateVersion: renunciation.after.stateReference?.stateVersion,
      summary: `${playerName || playerId}: ${renunciation.before.birdType} rights and $${(
        renunciation.before.freeAgentAmount ?? 0
      ).toLocaleString()} Free Agent Amount renounced.`,
      timestamp,
    },
  };
}
