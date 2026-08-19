/**
 * FILE: src/features/architect/utils/mutationPipeline.persist.ts
 * PURPOSE: PHASE 4 persist function — the only place that writes to Firestore for mutations.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 7 Step 3: Extracted from mutationPipeline.ts (PHASE 4 section).
 */

import { db } from '@/firebaseConfig';
import {
  writeBatch,
  runTransaction,
  serverTimestamp,
  collection,
  doc,
  type DocumentData,
  type DocumentReference,
  type SetOptions,
  type Transaction,
  type WriteBatch,
} from 'firebase/firestore';
import {
  worldTeamRef,
  worldPlayerRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
} from '@/constants/collections';
import {
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
} from '@/features/architect/utils/persistenceContracts';
import { sanitizeTransientFieldsForPersistence } from '@/features/architect/utils/persistenceContracts/enforcement';
import {
  buildWorldMutationEventPayload,
  guardAgainstUndefined,
} from './mutationPipeline.read';
import {
  removeUndefinedDeep,
  getMutationPlayerId,
  toPersistablePlayerOverrideFromSnapshot,
  cloneWritesSummary,
} from './mutationPipeline.helpers';
import type {
  ArchitectGeneralMutationCommittedTeamUpdate,
  ArchitectMutationBridgeResult,
  ArchitectWorldMutationPatch,
  AuditContextLike,
  MutationEventMetadataLike,
  PersistWorldMutationResult,
} from './mutationPipeline.types';
import { createRightsEventLedger } from '@/features/architect/utils/rightsHistory';
import { createContractEventLedger } from '@/features/architect/utils/contractHistory';
import { contractOverlaySetDigest } from '@/features/architect/utils/optionDecisions/contractOverlaySetDigest';
import { mutationSnapshotDigest } from './mutationPipeline.snapshotDigest';
import { GovernedOfferSheetLifecycleZ } from '@/schemas/governedOfferSheet';

type ExpectedRightsLedgerReference = Readonly<{
  ledgerId: string;
  ledgerVersion: number;
}>;

type ExpectedGovernedOfferSheetLifecycleReference = Readonly<{
  ledgerId: string;
  ledgerVersion: number;
  digest: string;
  homeTeamCode: string;
  offeringTeamCode: string;
  offerSheetId: string;
  dedupKey: string;
}>;

type PreparedMutationWrite =
  | {
      kind: 'set';
      ref: DocumentReference;
      data: unknown;
      options?: SetOptions;
    }
  | {
      kind: 'update';
      ref: DocumentReference;
      data: unknown;
    }
  | {
      kind: 'delete';
      ref: DocumentReference;
    };

function requireDocumentData(value: unknown): DocumentData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A prepared Firestore mutation write must be an object.');
  }
  return value as DocumentData;
}

function isOfferSheetResolutionMutation(mutationType: string): boolean {
  return (
    mutationType === 'matchOfferSheet' ||
    mutationType === 'declineOfferSheet' ||
    mutationType === 'finalizeMatchedOfferSheet' ||
    mutationType === 'finalizeDeclinedOfferSheet'
  );
}

function requireExpectedOfferSheetLifecycleReference({
  metadata,
  mutationType,
}: {
  metadata: Record<string, unknown>;
  mutationType: string;
}): ExpectedGovernedOfferSheetLifecycleReference {
  const rawExpected = metadata.expectedGovernedOfferSheetLifecycle;
  const expected =
    rawExpected && typeof rawExpected === 'object' && !Array.isArray(rawExpected)
      ? (rawExpected as Record<string, unknown>)
      : null;
  const resolved = GovernedOfferSheetLifecycleZ.safeParse(
    metadata.governedOfferSheetLifecycle
  );
  const offerSheetId = String(metadata.offerSheetId || '').trim();
  const dedupKey = String(metadata.dedupKey || '').trim();
  const expectedOutcome =
    mutationType === 'matchOfferSheet' ||
    mutationType === 'finalizeMatchedOfferSheet'
      ? 'matched'
      : 'declined';
  const ledgerId = String(expected?.ledgerId || '').trim();
  const ledgerVersion = Number(expected?.ledgerVersion);
  const digest = String(expected?.digest || '').trim();
  if (
    !expected ||
    !resolved.success ||
    !offerSheetId ||
    !dedupKey ||
    !ledgerId ||
    !Number.isInteger(ledgerVersion) ||
    ledgerVersion < 1 ||
    !digest ||
    resolved.data.ledgerId !== ledgerId ||
    resolved.data.ledgerVersion !== ledgerVersion + 1 ||
    resolved.data.status !== expectedOutcome
  ) {
    throw new Error(
      'Offer Sheet resolution is missing the expected governed lifecycle reference.'
    );
  }
  return Object.freeze({
    ledgerId,
    ledgerVersion,
    digest,
    homeTeamCode: resolved.data.homeTeamId,
    offeringTeamCode: resolved.data.offeringTeamId,
    offerSheetId,
    dedupKey,
  });
}

function recheckOfferSheetLifecycleBeforeCommit({
  currentTeamData,
  teamCode,
  expected,
}: {
  currentTeamData: DocumentData;
  teamCode: string;
  expected: ExpectedGovernedOfferSheetLifecycleReference;
}): void {
  const rawSheets =
    teamCode === expected.homeTeamCode
      ? currentTeamData.incomingOfferSheets
      : teamCode === expected.offeringTeamCode
        ? currentTeamData.offerSheets
        : null;
  if (!Array.isArray(rawSheets)) {
    throw new Error(
      `Offer Sheet lifecycle for ${teamCode} changed before commit. Reload and try again.`
    );
  }
  const matches = rawSheets.filter((rawSheet: unknown) => {
    if (!rawSheet || typeof rawSheet !== 'object' || Array.isArray(rawSheet)) {
      return false;
    }
    const sheet = rawSheet as Record<string, unknown>;
    return (
      String(sheet.id || '').trim() === expected.offerSheetId ||
      String(sheet.dedupKey || '').trim() === expected.dedupKey
    );
  });
  const lifecycle =
    matches.length === 1 &&
    matches[0] &&
    typeof matches[0] === 'object' &&
    !Array.isArray(matches[0])
      ? GovernedOfferSheetLifecycleZ.safeParse(
          (matches[0] as Record<string, unknown>).governedLifecycle
        )
      : null;
  if (
    !lifecycle?.success ||
    lifecycle.data.status !== 'pending-match' ||
    lifecycle.data.ledgerId !== expected.ledgerId ||
    lifecycle.data.ledgerVersion !== expected.ledgerVersion ||
    mutationSnapshotDigest(lifecycle.data) !== expected.digest
  ) {
    throw new Error(
      `Offer Sheet lifecycle for ${teamCode} changed before commit. Reload and try again.`
    );
  }
}

async function recheckExtensionSourceLineage({
  transaction,
  rawLineage,
  expectedSourceWorldIdValue,
  expectedSourceDigest,
  currentWorldId,
  sourceRef,
  receiptLabel,
  changedLabel,
  changedIdentifier,
}: {
  transaction: Transaction;
  rawLineage: unknown;
  expectedSourceWorldIdValue: unknown;
  expectedSourceDigest: unknown;
  currentWorldId: string;
  sourceRef: (sourceWorldId: string) => DocumentReference;
  receiptLabel: string;
  changedLabel: string;
  changedIdentifier: string;
}): Promise<DocumentData> {
  const expectedSourceWorldId =
    expectedSourceWorldIdValue === null
      ? null
      : typeof expectedSourceWorldIdValue === 'string'
        ? expectedSourceWorldIdValue.trim()
        : undefined;
  if (
    expectedSourceWorldId === undefined ||
    (expectedSourceWorldId === null && expectedSourceDigest !== null) ||
    (expectedSourceWorldId !== null &&
      (expectedSourceWorldId.length === 0 ||
        expectedSourceWorldId === currentWorldId ||
        typeof expectedSourceDigest !== 'string' ||
        expectedSourceDigest.length === 0)) ||
    !Array.isArray(rawLineage)
  ) {
    throw new Error(`Extension is missing the exact ${receiptLabel}.`);
  }

  const seenWorldIds = new Set<string>();
  let winningSourceWorldId: string | null = null;
  let winningSourceDigest: string | null = null;
  let winningSourceData: DocumentData = {};
  for (const rawEntry of rawLineage) {
    if (
      !rawEntry ||
      typeof rawEntry !== 'object' ||
      Array.isArray(rawEntry)
    ) {
      throw new Error(`Extension is missing the exact ${receiptLabel}.`);
    }
    const entry = rawEntry as Record<string, unknown>;
    const entryWorldId =
      typeof entry.worldId === 'string' ? entry.worldId.trim() : '';
    const entryExists = entry.exists;
    const entryDigest = entry.digest;
    if (
      !entryWorldId ||
      entryWorldId === currentWorldId ||
      seenWorldIds.has(entryWorldId) ||
      typeof entryExists !== 'boolean' ||
      (entryExists
        ? typeof entryDigest !== 'string' || entryDigest.length === 0
        : entryDigest !== null) ||
      winningSourceWorldId !== null
    ) {
      throw new Error(`Extension is missing the exact ${receiptLabel}.`);
    }
    seenWorldIds.add(entryWorldId);

    const sourceSnapshot = await transaction.get(sourceRef(entryWorldId));
    const sourceExists = sourceSnapshot.exists();
    if (
      sourceExists !== entryExists ||
      (entryExists &&
        mutationSnapshotDigest(sourceSnapshot.data()) !== entryDigest)
    ) {
      throw new Error(
        `Inherited ${changedLabel} snapshot for ${changedIdentifier} changed before commit. Reload and try again.`
      );
    }
    if (
      entryExists === true &&
      typeof entryDigest === 'string' &&
      sourceExists
    ) {
      winningSourceWorldId = entryWorldId;
      winningSourceDigest = entryDigest;
      winningSourceData = sourceSnapshot.data() ?? {};
    }
  }

  if (
    (expectedSourceWorldId === null && winningSourceWorldId !== null) ||
    (expectedSourceWorldId !== null &&
      (winningSourceWorldId !== expectedSourceWorldId ||
        winningSourceDigest !== expectedSourceDigest))
  ) {
    throw new Error(`Extension is missing the exact ${receiptLabel}.`);
  }

  return winningSourceData;
}

function applyWritesToBatch(
  batch: WriteBatch,
  writes: readonly PreparedMutationWrite[]
): void {
  for (const write of writes) {
    if (write.kind === 'delete') {
      batch.delete(write.ref);
    } else if (write.kind === 'update') {
      batch.update(write.ref, requireDocumentData(write.data));
    } else if (write.options) {
      batch.set(write.ref, requireDocumentData(write.data), write.options);
    } else {
      batch.set(write.ref, requireDocumentData(write.data));
    }
  }
}

function applyWritesToTransaction(
  transaction: Transaction,
  writes: readonly PreparedMutationWrite[]
): void {
  for (const write of writes) {
    if (write.kind === 'delete') {
      transaction.delete(write.ref);
    } else if (write.kind === 'update') {
      transaction.update(write.ref, requireDocumentData(write.data));
    } else if (write.options) {
      transaction.set(
        write.ref,
        requireDocumentData(write.data),
        write.options
      );
    } else {
      transaction.set(write.ref, requireDocumentData(write.data));
    }
  }
}

/**
 * Persist mutation to Firestore.
 * THIS IS THE ONLY PLACE THAT WRITES TO FIRESTORE FOR MUTATIONS.
 * It owns sanitization, persistence contract enforcement, canonical writes,
 * and event emission only.
 *
 * It must not absorb legality/business-rule ownership, authority sequencing,
 * or mutation computation.
 */
export async function persistWorldMutation({
  worldId,
  seasonId,
  mutationType,
  computeResult,
  committedTeamUpdates,
  timestamp,
  payloadAsOfDate, // Phase 20: Only write asOfDate if explicitly provided in payload
  auditContext = {},
  expectedRightsLedgersByTeam = {},
}: {
  worldId: string;
  seasonId: string;
  mutationType: string;
  computeResult: ArchitectMutationBridgeResult;
  committedTeamUpdates: ArchitectGeneralMutationCommittedTeamUpdate[];
  timestamp: number;
  payloadAsOfDate?: string | null;
  auditContext?: AuditContextLike;
  expectedRightsLedgersByTeam?: Readonly<
    Record<string, ExpectedRightsLedgerReference>
  >;
}): Promise<PersistWorldMutationResult> {
  const writes: PreparedMutationWrite[] = [];
  const teamCodesPatched = [];
  const playerIdsPatched = new Set<string>();
  const entitlementIdsPatched = [];
  let eventId: string | null = null;
  const teamUpdates = committedTeamUpdates || [];
  const playerUpdates = computeResult.playerUpdates || [];
  const playerDeletes = computeResult.playerDeletes || [];
  const entitlementUpdates = computeResult.entitlementUpdates || [];

  try {
    // 1. Write team snapshots
    for (const { teamCode, team } of teamUpdates) {
      if (!team) {
        continue;
      }

      const persistenceReadyTeam = team;
      // Guard against undefined values (dev throws, prod allows)
      guardAgainstUndefined(
        persistenceReadyTeam,
        `architect_worlds/${worldId}/teams/${teamCode}`
      );
      // Phase 61: Validate against persistence contract (test-only enforcement)
      // Ordering: sanitize → normalize TPE → validate contract → removeUndefined
      assertPersistableOrThrow({
        obj: persistenceReadyTeam,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      // Then remove undefined values
      const sanitizedTeam = removeUndefinedDeep(persistenceReadyTeam);
      if (!teamCode) {
        continue;
      }
      const teamRef = worldTeamRef(worldId, teamCode);
      writes.push({ kind: 'set', ref: teamRef, data: sanitizedTeam });
      teamCodesPatched.push(String(teamCode));
    }

    // 2. Write player overrides (if any)
    for (const { playerId, player } of playerUpdates) {
      // Player overrides go in the team's players subcollection
      if (!player) {
        continue;
      }
      const normalizedPlayerId = String(
        playerId || getMutationPlayerId(player) || ''
      ).trim();
      const persistablePlayer = toPersistablePlayerOverrideFromSnapshot(player);
      const teamCode = persistablePlayer?.teamCode;
      if (teamCode && persistablePlayer && normalizedPlayerId) {
        // Guard against undefined values (dev throws, prod allows)
        guardAgainstUndefined(
          persistablePlayer,
          `architect_worlds/${worldId}/teams/${teamCode}/players/${normalizedPlayerId}`
        );
        // Phase 60: Sanitize transient fields first
        const afterSanitize =
          sanitizeTransientFieldsForPersistence(persistablePlayer);
        // Phase 61: Validate against persistence contract (test-only enforcement)
        // Ordering: sanitize → validate contract → removeUndefined
        assertPersistableOrThrow({
          obj: afterSanitize,
          contract: PERSISTENCE_CONTRACTS.PLAYER,
          label: 'PLAYER',
        });
        // Then remove undefined values
        const sanitizedPlayer = removeUndefinedDeep(afterSanitize);
        const playerRef = worldPlayerRef(worldId, teamCode, normalizedPlayerId);
        writes.push({ kind: 'set', ref: playerRef, data: sanitizedPlayer });
        playerIdsPatched.add(normalizedPlayerId);
      }
    }

    // 2.25 Delete superseded player overrides for canonical move flows
    for (const { playerId, teamCode } of playerDeletes) {
      const normalizedPlayerId = String(playerId || '').trim();
      const normalizedTeamCode = String(teamCode || '').trim();
      if (!normalizedPlayerId || !normalizedTeamCode) {
        continue;
      }
      const playerRef = worldPlayerRef(
        worldId,
        normalizedTeamCode,
        normalizedPlayerId
      );
      writes.push({ kind: 'delete', ref: playerRef });
      playerIdsPatched.add(normalizedPlayerId);
    }

    // 2.5 TM-PICKS-E1: Write entitlement overrides (holderTeam patches)
    if (entitlementUpdates.length > 0) {
      for (const entitlementUpdate of entitlementUpdates) {
        const entitlementId = entitlementUpdate.entitlementId as
          | string
          | null
          | undefined;
        const holderTeam = entitlementUpdate.holderTeam;
        if (!entitlementId) continue;
        const entitlementRef = doc(
          db,
          ARCHITECT_WORLDS_COLLECTION,
          worldId,
          ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
          entitlementId
        );
        // Merge holderTeam onto existing override doc (or create if none exists)
        writes.push({
          kind: 'set',
          ref: entitlementRef,
          data: { holderTeam },
          options: { merge: true },
        });
        entitlementIdsPatched.push(String(entitlementId));
      }
    }

    // 3. Write event log entry
    // Use timestamp + random suffix to avoid collisions if multiple mutations occur at same millisecond
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    eventId = `${mutationType}_${timestamp}_${randomSuffix}`;
    const eventsCol = collection(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_EVENTS_SUBCOLLECTION
    );
    const eventRef = doc(eventsCol, eventId);

    // Phase 60/61: Sanitize and validate metadata first
    const sanitizedMetadataRaw = sanitizeTransientFieldsForPersistence(
      computeResult.metadata
    );
    // Phase 61: Validate metadata against persistence contract (test-only enforcement)
    assertPersistableOrThrow({
      obj: sanitizedMetadataRaw,
      contract: PERSISTENCE_CONTRACTS.EVENT_METADATA,
      label: 'EVENT_METADATA',
    });
    const sanitizedMetadata = removeUndefinedDeep(sanitizedMetadataRaw);

    const event = buildWorldMutationEventPayload({
      mutationType,
      eventId,
      seasonId,
      worldId,
      timestamp,
      computeResult: {
        ...computeResult,
        metadata: sanitizedMetadata as MutationEventMetadataLike,
      },
      auditContext,
    });

    // Phase 60: Sanitize entire event (defense-in-depth)
    const afterEventSanitize = sanitizeTransientFieldsForPersistence(event);
    // Phase 61: Validate event against persistence contract (test-only enforcement)
    // Ordering: sanitize → validate contract → removeUndefined
    assertPersistableOrThrow({
      obj: afterEventSanitize,
      contract: PERSISTENCE_CONTRACTS.EVENT,
      label: 'EVENT',
    });
    const sanitizedEvent = removeUndefinedDeep(afterEventSanitize);
    writes.push({ kind: 'set', ref: eventRef, data: sanitizedEvent });

    // 4. Update world metadata
    // Use lastModifiedTeams (not modifiedTeams) to clarify this field records
    // only teams modified by this single mutation, not cumulative history
    const worldPatch: ArchitectWorldMutationPatch = {
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: teamUpdates.map((u) => u.teamCode),
    };

    // Phase 20: Only update asOfDate if explicitly provided in payload
    // This prevents silent overwrites and allows mutations to reference a date
    // without advancing world time
    if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
      worldPatch.asOfDate = payloadAsOfDate;
    }

    const metadataRef = worldMetadataRef(worldId);
    writes.push({ kind: 'update', ref: metadataRef, data: worldPatch });

    const isOfferSheetResolution = isOfferSheetResolutionMutation(mutationType);
    const expectedOfferSheetLifecycle = isOfferSheetResolution
      ? requireExpectedOfferSheetLifecycleReference({
          metadata: computeResult.metadata as Record<string, unknown>,
          mutationType,
        })
      : null;
    if (expectedOfferSheetLifecycle) {
      const resolutionTeamCodes = new Set(
        teamUpdates.map(({ teamCode }) => String(teamCode || '').trim())
      );
      if (
        resolutionTeamCodes.size !== 2 ||
        !resolutionTeamCodes.has(expectedOfferSheetLifecycle.homeTeamCode) ||
        !resolutionTeamCodes.has(expectedOfferSheetLifecycle.offeringTeamCode)
      ) {
        throw new Error(
          'Offer Sheet resolution must atomically replace both governed Team mirrors.'
        );
      }
    }

    // A governed ledger append must compare the exact history it consumed in
    // the same atomic commit that publishes the replacement ledger. Otherwise
    // two tabs can both report success while the later whole-team write
    // silently erases the earlier immutable event.
    if (
      mutationType === 'renounceRights' ||
      mutationType === 'optionDecision' ||
      mutationType === 'extendPlayer' ||
      isOfferSheetResolution
    ) {
      await runTransaction(db, async (transaction) => {
        for (const { teamCode, team } of teamUpdates) {
          const normalizedTeamCode = String(teamCode || '').trim();
          if (!team || !normalizedTeamCode) continue;
          const teamRef = worldTeamRef(worldId, normalizedTeamCode);
          const currentTeamSnapshot = await transaction.get(teamRef);
          const currentTeamExists = currentTeamSnapshot.exists();
          if (!currentTeamExists && mutationType !== 'extendPlayer') {
            throw new Error(
              `Team ${normalizedTeamCode} changed before the governed history append could commit. Reload and try again.`
            );
          }
          const currentTeamData = currentTeamExists
            ? currentTeamSnapshot.data()
            : {};
          let contractSourceTeamData = currentTeamData;
          if (mutationType === 'renounceRights') {
            const expected = expectedRightsLedgersByTeam[normalizedTeamCode];
            if (!expected) {
              throw new Error(
                `Renunciation is missing the expected rights-ledger reference for ${normalizedTeamCode}.`
              );
            }
            const currentLedger = createRightsEventLedger(
              currentTeamData.rightsLedger
            );
            if (
              currentLedger.ledgerId !== expected.ledgerId ||
              currentLedger.ledgerVersion !== expected.ledgerVersion
            ) {
              throw new Error(
                `Rights history for ${normalizedTeamCode} changed before commit. Reload and try again.`
              );
            }
          } else if (expectedOfferSheetLifecycle) {
            recheckOfferSheetLifecycleBeforeCommit({
              currentTeamData,
              teamCode: normalizedTeamCode,
              expected: expectedOfferSheetLifecycle,
            });
          } else {
            const metadata = computeResult.metadata as Record<string, unknown>;
            if (mutationType === 'extendPlayer') {
              const expectedTeamExists = metadata.expectedTeamSnapshotExists;
              const expectedTeamDigest = metadata.expectedTeamSnapshotDigest;
              if (
                typeof expectedTeamExists !== 'boolean' ||
                (expectedTeamExists && typeof expectedTeamDigest !== 'string') ||
                (!expectedTeamExists && expectedTeamDigest !== null)
              ) {
                throw new Error(
                  `Extension is missing the expected team-snapshot receipt for ${normalizedTeamCode}.`
                );
              }
              if (
                currentTeamSnapshot.exists() !== expectedTeamExists ||
                (expectedTeamExists &&
                  mutationSnapshotDigest(currentTeamData) !==
                    expectedTeamDigest)
              ) {
                throw new Error(
                  `Team snapshot for ${normalizedTeamCode} changed before commit. Reload and try again.`
                );
              }
              if (expectedTeamExists) {
                if (
                  metadata.expectedTeamSourceWorldId !== worldId ||
                  metadata.expectedTeamSourceSnapshotDigest !==
                    expectedTeamDigest ||
                  !Array.isArray(metadata.expectedTeamSourceLineage) ||
                  metadata.expectedTeamSourceLineage.length !== 0
                ) {
                  throw new Error(
                    `Extension is missing the exact team-source receipt for ${normalizedTeamCode}.`
                  );
                }
              } else {
                contractSourceTeamData = await recheckExtensionSourceLineage({
                  transaction,
                  rawLineage: metadata.expectedTeamSourceLineage,
                  expectedSourceWorldIdValue:
                    metadata.expectedTeamSourceWorldId,
                  expectedSourceDigest:
                    metadata.expectedTeamSourceSnapshotDigest,
                  currentWorldId: worldId,
                  sourceRef: (sourceWorldId) =>
                    worldTeamRef(sourceWorldId, normalizedTeamCode),
                  receiptLabel: `team-source lineage receipt for ${normalizedTeamCode}`,
                  changedLabel: 'team',
                  changedIdentifier: normalizedTeamCode,
                });
              }

              const expectedPlayerExists =
                metadata.expectedPlayerSnapshotExists;
              const expectedPlayerDigest =
                metadata.expectedPlayerSnapshotDigest;
              const expectedPlayerId = String(metadata.playerId || '').trim();
              if (
                !expectedPlayerId ||
                typeof expectedPlayerExists !== 'boolean' ||
                (expectedPlayerExists &&
                  typeof expectedPlayerDigest !== 'string') ||
                (!expectedPlayerExists && expectedPlayerDigest !== null)
              ) {
                throw new Error(
                  `Extension is missing the expected player-snapshot receipt for ${normalizedTeamCode}.`
                );
              }
              const currentPlayerSnapshot = await transaction.get(
                worldPlayerRef(
                  worldId,
                  normalizedTeamCode,
                  expectedPlayerId
                )
              );
              if (
                currentPlayerSnapshot.exists() !== expectedPlayerExists ||
                (expectedPlayerExists &&
                  mutationSnapshotDigest(currentPlayerSnapshot.data()) !==
                    expectedPlayerDigest)
              ) {
                throw new Error(
                  `Player snapshot for ${expectedPlayerId} changed before commit. Reload and try again.`
                );
              }
              if (expectedPlayerExists) {
                if (
                  metadata.expectedPlayerSourceWorldId !== worldId ||
                  metadata.expectedPlayerSourceSnapshotDigest !==
                    expectedPlayerDigest ||
                  !Array.isArray(metadata.expectedPlayerSourceLineage) ||
                  metadata.expectedPlayerSourceLineage.length !== 0
                ) {
                  throw new Error(
                    `Extension is missing the exact player-source receipt for ${expectedPlayerId}.`
                  );
                }
              } else {
                await recheckExtensionSourceLineage({
                  transaction,
                  rawLineage: metadata.expectedPlayerSourceLineage,
                  expectedSourceWorldIdValue:
                    metadata.expectedPlayerSourceWorldId,
                  expectedSourceDigest:
                    metadata.expectedPlayerSourceSnapshotDigest,
                  currentWorldId: worldId,
                  sourceRef: (sourceWorldId) =>
                    worldPlayerRef(
                      sourceWorldId,
                      normalizedTeamCode,
                      expectedPlayerId
                    ),
                  receiptLabel: `player-source lineage receipt for ${expectedPlayerId}`,
                  changedLabel: 'player',
                  changedIdentifier: expectedPlayerId,
                });
              }
            }
            const expectedLedgerId = String(
              metadata.expectedContractLedgerId || ''
            );
            const expectedLedgerVersion = Number(
              metadata.expectedContractLedgerVersion
            );
            const expectedOverlayVersion =
              metadata.expectedContractOverlayLedgerVersion === null
                ? null
                : Number(metadata.expectedContractOverlayLedgerVersion);
            if (!expectedLedgerId || !Number.isInteger(expectedLedgerVersion)) {
              throw new Error(
                `${mutationType === 'extendPlayer' ? 'Extension' : 'Option decision'} is missing the expected contract-ledger reference for ${normalizedTeamCode}.`
              );
            }
            const overlays = Array.isArray(
              contractSourceTeamData.contractEventLedgers
            )
              ? contractSourceTeamData.contractEventLedgers
              : [];
            const expectedOverlaySetDigest =
              metadata.expectedContractOverlaySetDigest;
            if (
              typeof expectedOverlaySetDigest !== 'string' ||
              contractOverlaySetDigest(overlays) !== expectedOverlaySetDigest
            ) {
              throw new Error(
                `Contract history for ${normalizedTeamCode} changed before commit. Reload and try again.`
              );
            }
            const currentOverlay = overlays.find(
              (ledger: unknown) =>
                ledger &&
                typeof ledger === 'object' &&
                !Array.isArray(ledger) &&
                (ledger as Record<string, unknown>).ledgerId ===
                  expectedLedgerId
            );
            if (expectedOverlayVersion === null) {
              if (currentOverlay) {
                throw new Error(
                  `Contract history for ${normalizedTeamCode} changed before commit. Reload and try again.`
                );
              }
            } else {
              if (!Number.isInteger(expectedOverlayVersion)) {
                throw new Error(
                  `${mutationType === 'extendPlayer' ? 'Extension' : 'Option decision'} is missing the expected writable overlay version for ${normalizedTeamCode}.`
                );
              }
              if (!currentOverlay) {
                throw new Error(
                  `Contract history for ${normalizedTeamCode} changed before commit. Reload and try again.`
                );
              }
              const currentContractLedger = createContractEventLedger(
                currentOverlay as Parameters<
                  typeof createContractEventLedger
                >[0]
              );
              if (
                currentContractLedger.ledgerId !== expectedLedgerId ||
                currentContractLedger.ledgerVersion !== expectedOverlayVersion
              ) {
                throw new Error(
                  `Contract history for ${normalizedTeamCode} changed before commit. Reload and try again.`
                );
              }
            }
            const expectedRightsId = metadata.rightsLedgerId;
            const expectedRightsVersion = metadata.rightsLedgerVersion;
            if (
              typeof expectedRightsId === 'string' &&
              typeof expectedRightsVersion === 'number'
            ) {
              const currentRights = createRightsEventLedger(
                currentTeamData.rightsLedger
              );
              if (
                currentRights.ledgerId !== expectedRightsId ||
                currentRights.ledgerVersion !== expectedRightsVersion
              ) {
                throw new Error(
                  `Rights history for ${normalizedTeamCode} changed before commit. Reload and try again.`
                );
              }
            }
          }
        }
        applyWritesToTransaction(transaction, writes);
      });
    } else {
      const batch = writeBatch(db);
      applyWritesToBatch(batch, writes);
      await batch.commit();
    }

    const writesSummary = {
      ...cloneWritesSummary(),
      teamsPatched: teamCodesPatched.length,
      teamCodes: teamCodesPatched,
      playersPatched: playerIdsPatched.size,
      playerIds: Array.from(playerIdsPatched),
      entitlementsPatched: entitlementIdsPatched.length,
      entitlementIds: entitlementIdsPatched,
      eventsWritten: eventId ? 1 : 0,
      eventIds: eventId ? [eventId] : [],
      worldMetadataPatched: 1,
      worldStatsUpdated: false,
    };

    return {
      success: true,
      worldPatch,
      event,
      writesSummary,
    };
  } catch (error) {
    console.error('persistWorldMutation failed:', error);
    const writesSummary = {
      ...cloneWritesSummary(),
      teamsPatched: teamCodesPatched.length,
      teamCodes: teamCodesPatched,
      playersPatched: playerIdsPatched.size,
      playerIds: Array.from(playerIdsPatched),
      entitlementsPatched: entitlementIdsPatched.length,
      entitlementIds: entitlementIdsPatched,
      eventsWritten: 0,
      eventIds: [] as string[],
      worldMetadataPatched: 0,
      worldStatsUpdated: false,
    };
    return {
      success: false,
      error:
        (error instanceof Error ? error.message : String(error)) ||
        'Failed to persist mutation',
      writesSummary,
    };
  }
}
