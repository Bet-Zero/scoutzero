/**
 * Wave 23 Step 1: Signing utilities and computeSigningResult extracted from
 * mutationPipeline.compute.signings.ts (lines 62–480).
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { normalizeContractForWorld } from '@/features/architect/utils/contractNormalization';
import {
  getCanonicalExceptionAvailability,
  getCanonicalExceptionKeyForSigningMechanism,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import { getSigningHardCapTriggerMetadata } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import { isTwoWayContract } from '@/features/architect/utils/contractUtils';
import { contractOverlaySetDigest } from '@/features/architect/utils/optionDecisions';
import {
  applyGovernedSigningSetOff,
  buildGovernedSigningHistory,
  resolveGovernedSigningAuthority,
} from '@/features/architect/utils/signings';
import type { GovernedSigningAuthority } from '@/features/architect/utils/signings';
import {
  getMutationPlayerId,
  getMutationRosterEntryId,
  getTeamSourceRecord,
  normalizeMutationExceptionsFromIngress,
  requireSigningState,
  synchronizeTeamTotalsSnapshotOrTeam,
} from './mutationPipeline.helpers';
import type {
  ArchitectMutationContract,
  ArchitectMutationExceptionEntry,
  ArchitectMutationExceptions,
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
  ArchitectMutationTeamUpdate,
  CapHoldComputationPlayer,
  ComputeMutationParamsWithCurrentState,
  ComputeResultLike,
  MutationPayloadInputByType,
  MutationSigningCurrentState,
} from './mutationPipeline';

export function resolveSigningMechanismForPipeline(
  contract: ArchitectMutationContract | null | undefined,
  signedUsing: string | null | undefined
) {
  const normalize = (source: unknown) => {
    const normalized = String(source || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    if (!normalized) return 'UNKNOWN';
    if (
      ['none', 'capspace', 'capspacerights', 'rights'].includes(normalized)
    ) {
      return 'CAP_SPACE_OR_RIGHTS';
    }
    if (['fullmle', 'ntmle', 'mle', 'full'].includes(normalized)) {
      return 'FULL_MLE';
    }
    if (
      ['tpmle', 'taxpayermle'].includes(normalized) ||
      normalized.includes('taxpayer')
    ) {
      return 'TPMLE';
    }
    if (
      ['roommle', 'rmle'].includes(normalized) ||
      normalized.includes('room')
    ) {
      return 'ROOM_MLE';
    }
    if (['bae', 'biannual'].includes(normalized)) return 'BAE';
    if (['minimum', 'min', 'vetminimum', 'vetmin'].includes(normalized)) {
      return 'MINIMUM';
    }
    if (normalized === 'tenday' || normalized.includes('tenday')) {
      return 'TEN_DAY';
    }
    return 'UNKNOWN';
  };
  const contractRoute = normalize(contract?.exceptionType);
  const payloadRoute = normalize(signedUsing);
  if (
    contractRoute !== 'UNKNOWN' &&
    payloadRoute !== 'UNKNOWN' &&
    contractRoute !== payloadRoute
  ) {
    return 'CONFLICT';
  }
  return contractRoute !== 'UNKNOWN' ? contractRoute : payloadRoute;
}

function standardRosterCount(players: ArchitectMutationPlayerRecord[]): number {
  return players.filter((player) => !isTwoWayContract(player)).length;
}

function updateIncompleteRosterChargeAfterSigning({
  beforeTeam,
  afterTeam,
  salaryCapYear,
}: {
  beforeTeam: ArchitectMutationTeamRecord;
  afterTeam: ArchitectMutationTeamRecord;
  salaryCapYear: number;
}): string | null {
  const salaryBookInputs = afterTeam.salaryBookInputs;
  const input = salaryBookInputs?.incompleteRosterCharge;
  const minRoster = getCapRulesForYear(salaryCapYear).roster.minStandard;
  const beforeMissing = Math.max(
    0,
    minRoster - standardRosterCount(beforeTeam.players || [])
  );
  const afterMissing = Math.max(
    0,
    minRoster - standardRosterCount(afterTeam.players || [])
  );
  if (beforeMissing === afterMissing) return null;
  // The validation stage owns missing-input failure. Pure compute remains a
  // compatibility surface, while a present authenticated aggregate must be
  // transformed exactly for the roster-slot change.
  if (!salaryBookInputs || !input || beforeMissing === 0) return null;
  const perSlot = input.amount / beforeMissing;
  const nextAmount = perSlot * afterMissing;
  if (!Number.isSafeInteger(perSlot) || !Number.isSafeInteger(nextAmount)) {
    return 'The authenticated incomplete-roster charge cannot be reconciled to the exact roster-slot change.';
  }
  const apronInput = salaryBookInputs.apronAdjustments;
  if (apronInput.status !== 'ready') {
    return 'Apron Team Salary needs its authenticated CBA2-C07.11 incomplete-roster adjustment.';
  }
  const apronIncompleteRows = apronInput.lineItems.filter((lineItem) =>
    lineItem.canonLeafIds.includes('CBA2-C07.11')
  );
  if (
    apronIncompleteRows.length !== 1 ||
    apronIncompleteRows[0].amount !== -input.amount
  ) {
    return 'Apron Team Salary needs one CBA2-C07.11 adjustment that exactly reverses the authenticated incomplete-roster charge.';
  }
  afterTeam.salaryBookInputs = {
    ...salaryBookInputs,
    incompleteRosterCharge: { ...input, amount: nextAmount },
    apronAdjustments: {
      ...apronInput,
      lineItems: apronInput.lineItems.map((lineItem) =>
        lineItem.id === apronIncompleteRows[0].id
          ? { ...lineItem, amount: -nextAmount }
          : lineItem
      ),
    },
  };
  return null;
}

function appendSigningSalaryBookAdjustments({
  team,
  player,
  authority,
  mechanism,
  operationId,
}: {
  team: ArchitectMutationTeamRecord;
  player: ArchitectMutationPlayerRecord;
  authority: GovernedSigningAuthority;
  mechanism: string;
  operationId: string;
}): string | null {
  const inputs = team.salaryBookInputs;
  if (!inputs) return null;
  const taxInput = inputs.taxSalary;
  if (taxInput.status !== 'ready') return null;
  const taxBaselines = taxInput.lineItems.filter((lineItem) =>
    lineItem.canonLeafIds.includes('CBA2-C08.1')
  );
  if (taxBaselines.length !== 1) {
    return 'Tax Salary needs exactly one CBA2-C08.1 baseline before signing compensation can be added.';
  }
  const taxBaselineAt = Date.parse(taxBaselines[0].effectiveFrom);
  const signingAt = Date.parse(authority.effectiveAt);
  const taxLineItems = [...taxInput.lineItems];
  const taxSigningLineId = `tax-salary:signing:${operationId}`;
  if (
    Number.isFinite(taxBaselineAt) &&
    Number.isFinite(signingAt) &&
    signingAt > taxBaselineAt &&
    !taxLineItems.some((lineItem) => lineItem.id === taxSigningLineId)
  ) {
    taxLineItems.push({
      id: taxSigningLineId,
      ledger: 'tax-salary',
      label: 'Post-baseline signed Contract compensation',
      amount: authority.firstYearCapHit,
      effectiveFrom: authority.effectiveAt,
      canonLeafIds: ['CBA2-C08.2'],
      source: {
        authority: 'team-state',
        reference: `signing-operation:${operationId}`,
      },
    });
  }

  const apronInput = inputs.apronAdjustments;
  const apronLineItems =
    apronInput.status === 'ready' ? [...apronInput.lineItems] : null;
  const rawYearsOfService =
    player.bio?.yearsExperience ??
    player.bio?.experience ??
    player.contract?.birdRights?.yearsOfService ??
    (typeof player.birdRights === 'object'
      ? player.birdRights?.yearsOfService
      : null);
  const numericYearsOfService = Number(rawYearsOfService);
  const yearsOfService =
    rawYearsOfService != null &&
    Number.isFinite(numericYearsOfService) &&
    Number.isSafeInteger(numericYearsOfService)
      ? numericYearsOfService
      : null;
  if (
    mechanism === 'MINIMUM' &&
    (yearsOfService === null || yearsOfService < 0)
  ) {
    return 'Minimum signing needs exact nonnegative years of service before Apron Team Salary can be governed.';
  }
  if (
    apronLineItems &&
    mechanism === 'MINIMUM' &&
    yearsOfService !== null &&
    yearsOfService <= 1
  ) {
    const twoYosMinimum = getCapRulesForYear(
      authority.salaryCapYear
    ).salaries.getMinimumForYOS(2);
    const uplift = Math.max(0, twoYosMinimum - authority.firstYearCapHit);
    const apronSigningLineId = `apron-team-salary:minimum-uplift:${operationId}`;
    if (
      uplift > 0 &&
      !apronLineItems.some((lineItem) => lineItem.id === apronSigningLineId)
    ) {
      apronLineItems.push({
        id: apronSigningLineId,
        ledger: 'apron-team-salary',
        label: 'Qualifying zero/one-YOS Minimum Contract uplift',
        amount: uplift,
        effectiveFrom: authority.effectiveAt,
        canonLeafIds: ['CBA2-C07.3'],
        source: {
          authority: 'team-state',
          reference: `signing-operation:${operationId}`,
        },
      });
    }
  }

  team.salaryBookInputs =
    apronInput.status === 'ready' && apronLineItems
      ? {
          ...inputs,
          taxSalary: { ...taxInput, lineItems: taxLineItems },
          apronAdjustments: {
            ...apronInput,
            lineItems: apronLineItems,
          },
        }
      : {
          ...inputs,
          taxSalary: { ...taxInput, lineItems: taxLineItems },
        };
  return null;
}

export function toFiniteAmount(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function toFiniteIntegerOrNull(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

export function sumContractValueFromRows(
  contract:
    | ArchitectMutationContract
    | {
        salariesByYear?: Array<{
          salary?: number | string | null;
          capHit?: number | string | null;
        }> | null;
      }
    | null
    | undefined
) {
  if (!Array.isArray(contract?.salariesByYear)) {
    return 0;
  }

  return contract.salariesByYear.reduce(
    (total, row) => total + toFiniteAmount(row?.salary ?? row?.capHit, 0),
    0
  );
}

export function toCapHoldComputationPlayer(
  player: ArchitectMutationPlayerRecord
): CapHoldComputationPlayer {
  const yearsExperience = toFiniteIntegerOrNull(player.bio?.yearsExperience);
  const draftRound = toFiniteIntegerOrNull(player.draft?.round);
  const draftPick = toFiniteIntegerOrNull(player.draft?.pick);
  const contractBirdRightsStatus =
    typeof player.contract?.birdRights?.status === 'string'
      ? player.contract.birdRights.status
      : typeof player.contract?.birdRights?.type === 'string'
        ? player.contract.birdRights.type
        : undefined;
  const fallbackBirdRights =
    typeof player.birdRights === 'string'
      ? player.birdRights
      : typeof player.birdRights?.status === 'string'
        ? player.birdRights.status
        : typeof player.birdRights?.type === 'string'
          ? player.birdRights.type
          : undefined;

  return {
    renounced: player.renounced === true,
    bio:
      player.bio || yearsExperience != null
        ? {
            yearsExperience: yearsExperience ?? undefined,
          }
        : undefined,
    contract:
      player.contract || contractBirdRightsStatus
        ? {
            birdRights: contractBirdRightsStatus
              ? { status: contractBirdRightsStatus }
              : undefined,
            salariesByYear: Array.isArray(player.contract?.salariesByYear)
              ? player.contract.salariesByYear.map((row) => ({
                  season:
                    typeof row?.season === 'string' ? row.season : undefined,
                  salary:
                    typeof row?.salary === 'number' ? row.salary : undefined,
                  capHit:
                    typeof row?.capHit === 'number' ? row.capHit : undefined,
                }))
              : undefined,
          }
        : undefined,
    draft:
      player.draft || draftRound != null || draftPick != null
        ? {
            round: draftRound ?? undefined,
            pick: draftPick ?? undefined,
          }
        : undefined,
    birdRights: fallbackBirdRights,
  };
}

export function consumeSigningExceptionUsage({
  updatedTeam,
  mechanism,
  contractValue,
  timestamp,
  effectiveAt,
  seasonEndYear = null,
}: {
  updatedTeam: ArchitectMutationTeamRecord;
  mechanism: string;
  contractValue: number;
  timestamp: number;
  effectiveAt?: string | null;
  /** Season end-year of the signing, recorded for BAE biennial enforcement. */
  seasonEndYear?: number | null;
}) {
  const exceptionKey = getCanonicalExceptionKeyForSigningMechanism(mechanism);
  if (!exceptionKey) {
    return { consumedExceptionKey: null, error: null };
  }

  updatedTeam.exceptions = normalizeMutationExceptionsFromIngress(
    updatedTeam.exceptions
  );

  const availability = getCanonicalExceptionAvailability(
    updatedTeam,
    exceptionKey
  );
  if (!availability.present) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner is missing.`,
    };
  }
  if (!availability.enabled) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner is disabled.`,
    };
  }
  if (!availability.usable) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - canonical ${exceptionKey.toUpperCase()} owner has no remaining amount.`,
    };
  }

  if (contractValue > availability.remainingAmount) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - first-year charge exceeds remaining ${exceptionKey.toUpperCase()} amount.`,
    };
  }

  if (contractValue <= 0) {
    return {
      consumedExceptionKey: null,
      error: `Cannot use ${mechanism} - signing contract value is missing or zero, so canonical exception usage cannot be consumed.`,
    };
  }

  const currentState = availability.entry;
  const normalizedState: ArchitectMutationExceptionEntry = currentState
    ? { ...(currentState as ArchitectMutationExceptionEntry) }
    : {
        enabled: true,
        maxAmount: 0,
        totalAmount: 0,
        amount: 0,
        usedAmount: 0,
        remainingAmount: 0,
      };

  normalizedState.enabled = true;
  normalizedState.available = true;
  normalizedState.maxAmount = availability.totalAmount;
  normalizedState.totalAmount = availability.totalAmount;
  normalizedState.amount = availability.totalAmount;
  normalizedState.usedAmount = availability.usedAmount + contractValue;
  normalizedState.remainingAmount = Math.max(
    0,
    availability.remainingAmount - contractValue
  );
  normalizedState.lastUsedAt = effectiveAt || new Date(timestamp).toISOString();
  // Record the season the BAE was consumed so the biennial ("every other
  // season") restriction can be enforced after the next season rollover.
  if (exceptionKey === 'bae' && Number.isFinite(seasonEndYear)) {
    normalizedState.lastUsedSeasonEndYear = seasonEndYear;
  }

  updatedTeam.exceptions = {
    ...updatedTeam.exceptions,
    [exceptionKey]: normalizedState,
  };
  return {
    consumedExceptionKey: exceptionKey,
    error: null,
  };
}

export function computeSigningResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  asOfDate = null,
  worldId,
  operationId,
  authoringIdentity,
  recordedAt,
}: ComputeMutationParamsWithCurrentState<
  MutationSigningCurrentState,
  MutationPayloadInputByType['signFreeAgent']
> & {
  asOfDate?: string | number | null;
  worldId?: string;
  operationId?: string;
  authoringIdentity?: string;
  recordedAt?: string;
}): ComputeResultLike {
  const { team, player } = requireSigningState(currentState, 'signFreeAgent');
  const teamCode = currentState.teamCode || team.teamCode || null;
  const { contract, signedUsing } = payload;
  const signingMechanism = resolveSigningMechanismForPipeline(
    contract,
    signedUsing
  );
  const salaryCapYear = toEndYear(seasonId);
  // Only the persisted saved-world loader can supply this immutable receipt.
  // Pure compute callers remain a compatibility surface; they cannot author a
  // governed signing or persist its history without the receipt.
  const governedMode = currentState.signingTeamSnapshot != null;
  if (
    governedMode &&
    (!worldId ||
      !operationId ||
      !authoringIdentity ||
      !recordedAt ||
      typeof asOfDate !== 'string' ||
      salaryCapYear === null)
  ) {
    return {
      success: false,
      error:
        'Governed signing requires an exact saved-world date, Salary Cap Year, operation identity, and author provenance.',
    };
  }
  const governedSigning = governedMode
    ? resolveGovernedSigningAuthority({
        team,
        contract,
        mechanism: signingMechanism,
        worldDate: String(asOfDate),
        salaryCapYear: salaryCapYear as number,
      })
    : null;
  if (governedSigning?.status === 'needs-input') {
    return {
      success: false,
      error:
        governedSigning.reasons[0] ||
        'Signing needs complete governed authority inputs.',
    };
  }
  const signingAuthority =
    governedSigning?.status === 'complete' ? governedSigning.authority : null;

  const updatedTeam = { ...team };
  updatedTeam.exceptions = normalizeMutationExceptionsFromIngress(
    updatedTeam.exceptions
  );

  // Add player to roster if not already present
  const playerId = String(
    payload.playerId || player.player_id || player.id || ''
  ).trim();
  if (!playerId) {
    return {
      success: false,
      error: 'Player ID is required for signing.',
    };
  }
  const rosterEntries = Array.isArray(updatedTeam.roster)
    ? updatedTeam.roster
    : [];
  if (
    !rosterEntries.some((entry) => getMutationRosterEntryId(entry) === playerId)
  ) {
    updatedTeam.roster = [...rosterEntries, playerId];
  }

  // Update or add player to players array
  const existingPlayers = updatedTeam.players || [];
  const existingIndex = existingPlayers.findIndex(
    (existingPlayer) => getMutationPlayerId(existingPlayer) === playerId
  );

  // Normalize contract for world persistence (canonical field names/types)
  const normalizedContract = normalizeContractForWorld({
    ...contract,
    signingTeam: teamCode,
    signingDate: signingAuthority?.worldDate || new Date(timestamp).toISOString(),
  }) as ArchitectMutationContract | null;
  if (!normalizedContract) {
    return { success: false, error: 'Signing contract could not be normalized.' };
  }

  const signingHistory =
    signingAuthority && worldId && operationId && authoringIdentity && recordedAt
      ? buildGovernedSigningHistory({
          contract: normalizedContract,
          playerId,
          teamId: String(teamCode),
          worldId,
          operationId,
          authoringIdentity,
          recordedAt,
          authority: signingAuthority,
        })
      : null;

  const updatedPlayer = {
    ...player,
    teamCode,
    teamName: team.teamName,
    contract: normalizedContract,
  };

  if (existingIndex >= 0) {
    updatedTeam.players = [...existingPlayers];
    updatedTeam.players[existingIndex] = updatedPlayer;
  } else {
    updatedTeam.players = [...existingPlayers, updatedPlayer];
  }

  // Update exceptions if signing consumed one
  const contractValue = signingAuthority
    ? signingAuthority.exceptionCharge
    : toFiniteAmount(
        contract?.totalValue,
        toFiniteAmount(
          normalizedContract.totalValue,
          sumContractValueFromRows(normalizedContract)
        )
      );
  const exceptionConsumption = consumeSigningExceptionUsage({
    updatedTeam,
    mechanism: signingMechanism,
    contractValue,
    timestamp,
    effectiveAt: signingAuthority?.effectiveAt,
    seasonEndYear: seasonId != null ? toEndYear(seasonId) : null,
  });
  if (exceptionConsumption.error) {
    return {
      success: false,
      error: exceptionConsumption.error,
    };
  }
  const consumedExceptionKey = exceptionConsumption.consumedExceptionKey;

  if (signingHistory) {
    updatedTeam.contractEventLedgers = [
      ...(updatedTeam.contractEventLedgers || []).filter(
        (ledger) => ledger.ledgerId !== signingHistory.ledger.ledgerId
      ),
      signingHistory.ledger,
    ];
  }

  const signingHardCapTrigger =
    consumedExceptionKey && getSigningHardCapTriggerMetadata(signingMechanism);
  if (signingHardCapTrigger) {
    updatedTeam.hardCapped = 1;
    updatedTeam.hardCapLevel = signingHardCapTrigger.hardCapLevel;
    updatedTeam.hardCapReason = signingHardCapTrigger.hardCapReason;
    updatedTeam.hardCapTriggeredBy = signingHardCapTrigger.hardCapTriggeredBy;
  }

  // Remove cap hold if player had one
  if (updatedTeam.capHolds) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter(
      (hold) => hold.playerId !== playerId
    );
  }

  if (signingAuthority) {
    const rosterChargeError = updateIncompleteRosterChargeAfterSigning({
      beforeTeam: team,
      afterTeam: updatedTeam,
      salaryCapYear: signingAuthority.salaryCapYear,
    });
    if (rosterChargeError) {
      return { success: false, error: rosterChargeError };
    }
    const salaryBookAdjustmentError = appendSigningSalaryBookAdjustments({
      team: updatedTeam,
      player,
      authority: signingAuthority,
      mechanism: signingMechanism,
      operationId: operationId!,
    });
    if (salaryBookAdjustmentError) {
      return { success: false, error: salaryBookAdjustmentError };
    }
  }

  // Remove pending offer sheet if finalizing an RFA offer
  if (
    normalizedContract?.rfaOfferSheet &&
    'offerSheets' in updatedTeam &&
    Array.isArray(updatedTeam.offerSheets)
  ) {
    updatedTeam.offerSheets = updatedTeam.offerSheets.filter(
      (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
    );
  }

  // Update source metadata
  updatedTeam.source = {
    ...getTeamSourceRecord(updatedTeam.source),
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
    updatedTeam,
    toEndYear(seasonId),
    asOfDate
  ).totals;

  const teamUpdates: ArchitectMutationTeamUpdate[] = [
    { teamCode, team: updatedTeam },
  ];

  let waiverSetOffReduction = 0;
  if (currentState.homeTeam && currentState.homeTeam.teamCode !== teamCode) {
    let updatedHomeTeam = {
      ...currentState.homeTeam,
    };
    let homeTeamChanged = false;
    if (
      normalizedContract.rfaOfferSheet &&
      Array.isArray(updatedHomeTeam.incomingOfferSheets)
    ) {
      const incomingOfferSheets = updatedHomeTeam.incomingOfferSheets.filter(
        (offerSheet) => String(offerSheet.playerId || '').trim() !== playerId
      );
      homeTeamChanged =
        incomingOfferSheets.length !== updatedHomeTeam.incomingOfferSheets.length;
      updatedHomeTeam.incomingOfferSheets = incomingOfferSheets;
    }
    if (
      signingAuthority &&
      signingHistory &&
      operationId &&
      authoringIdentity &&
      recordedAt
    ) {
      const setOff = applyGovernedSigningSetOff({
        priorTeam: updatedHomeTeam,
        signingTeamId: String(teamCode),
        player,
        contract: normalizedContract,
        contractId: signingHistory.contractId,
        operationId,
        authoringIdentity,
        recordedAt,
        authority: signingAuthority,
      });
      updatedHomeTeam = setOff.team;
      waiverSetOffReduction = setOff.reduction;
      homeTeamChanged ||= setOff.applied;
    }
    if (homeTeamChanged) {
      updatedHomeTeam.source = {
        ...getTeamSourceRecord(updatedHomeTeam.source),
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      updatedHomeTeam.totals = synchronizeTeamTotalsSnapshotOrTeam(
        updatedHomeTeam,
        salaryCapYear,
        asOfDate
      ).totals;
      teamUpdates.push({
        teamCode: updatedHomeTeam.teamCode,
        team: updatedHomeTeam,
      });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'signing',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      contract: normalizedContract,
      rightsUsed: consumedExceptionKey || undefined,
      timestamp,
      signedUsing,
      contractId: signingHistory?.contractId,
      contractEventId: signingHistory?.eventId,
      contractLedgerId: signingHistory?.ledger.ledgerId,
      contractLedgerVersion: signingHistory?.ledger.ledgerVersion,
      expectedContractLedgerId: signingHistory?.ledger.ledgerId,
      expectedContractLedgerVersion: signingHistory?.ledger.ledgerVersion,
      expectedContractOverlayLedgerVersion: null,
      expectedContractOverlaySetDigest: contractOverlaySetDigest(
        team.contractEventLedgers
      ),
      governedSeasonInputManifest: signingAuthority?.seasonInputManifest,
      governedSigningWorldDate: signingAuthority?.worldDate,
      governedSigningEffectiveAt: signingAuthority?.effectiveAt,
      waiverSetOffReduction,
      expectedTeamSnapshotExists: currentState.signingTeamSnapshot?.exists,
      expectedTeamSnapshotDigest: currentState.signingTeamSnapshot?.digest,
      expectedTeamSourceWorldId:
        currentState.signingTeamSnapshot?.sourceWorldId,
      expectedTeamSourceSnapshotDigest:
        currentState.signingTeamSnapshot?.sourceDigest,
      expectedTeamSourceLineage:
        currentState.signingTeamSnapshot?.sourceLineage,
      expectedPlayerSnapshotExists: currentState.signingPlayerSnapshot?.exists,
      expectedPlayerSnapshotDigest: currentState.signingPlayerSnapshot?.digest,
      expectedPlayerSourceWorldId:
        currentState.signingPlayerSnapshot?.sourceWorldId,
      expectedPlayerSourceSnapshotDigest:
        currentState.signingPlayerSnapshot?.sourceDigest,
      expectedPlayerSourceLineage:
        currentState.signingPlayerSnapshot?.sourceLineage,
      expectedPriorTeamSnapshot: currentState.signingPriorTeamSnapshot,
    },
  };
}
