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
  worldOfferSheetAuthorizationRef,
  basePlayerRef,
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
import {
  GovernedOfferSheetAuthorizationZ,
  GovernedOfferSheetEvidenceZ,
  GovernedOfferSheetLifecycleZ,
} from '@/schemas/governedOfferSheet';
import { buildGovernedOfferSheetAuthorization } from '@/features/architect/utils/offerSheets';

type ExpectedRightsLedgerReference = Readonly<{
  ledgerId: string;
  ledgerVersion: number;
}>;

type ExpectedLocalDocumentSnapshotReference = Readonly<{
  exists: boolean;
  digest: string | null;
}>;

type ExpectedDocumentSnapshotReference =
  ExpectedLocalDocumentSnapshotReference &
    Readonly<{
      sourceWorldId: string | null;
      sourceDigest: string | null;
      sourceLineage: readonly Readonly<{
        worldId: string;
        exists: boolean;
        digest: string | null;
      }>[];
    }>;

type ExpectedOfferSheetCreationSnapshots = Readonly<{
  homeTeamCode: string;
  offeringTeamCode: string;
  homeTeam: ExpectedDocumentSnapshotReference;
  offeringTeam: ExpectedDocumentSnapshotReference;
}>;

type ExpectedOfferSheetResolutionSnapshots = Readonly<{
  playerId: string;
  homeTeamCode: string;
  offeringTeamCode: string;
  homeTeam: ExpectedLocalDocumentSnapshotReference;
  offeringTeam: ExpectedLocalDocumentSnapshotReference;
  homePlayer: ExpectedLocalDocumentSnapshotReference;
  offeringPlayer: ExpectedLocalDocumentSnapshotReference;
  authorization: ExpectedLocalDocumentSnapshotReference;
  immutableEvidenceDigest: string;
}>;

type ExpectedGovernedOfferSheetLifecycleReference = Readonly<{
  ledgerId: string;
  ledgerVersion: number;
  digest: string;
  homeTeamCode: string;
  offeringTeamCode: string;
  offerSheetId: string;
  dedupKey: string;
  snapshots: ExpectedOfferSheetResolutionSnapshots;
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

function requireDocumentSnapshotReference(
  raw: unknown,
  label: string
): ExpectedDocumentSnapshotReference {
  const receipt =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const local = requireLocalDocumentSnapshotReference(raw, label);
  const sourceWorldId = receipt?.sourceWorldId;
  const sourceDigest = receipt?.sourceDigest;
  const sourceLineage = receipt?.sourceLineage;
  if (
    (sourceWorldId !== null &&
      (typeof sourceWorldId !== 'string' || !sourceWorldId.trim())) ||
    (sourceDigest !== null &&
      (typeof sourceDigest !== 'string' || !sourceDigest.trim())) ||
    !Array.isArray(sourceLineage)
  ) {
    throw new Error(
      `Offer Sheet creation is missing the expected ${label} source receipt.`
    );
  }
  return Object.freeze({
    ...local,
    sourceWorldId:
      typeof sourceWorldId === 'string' ? sourceWorldId.trim() : null,
    sourceDigest:
      typeof sourceDigest === 'string' ? sourceDigest.trim() : null,
    sourceLineage: Object.freeze(
      sourceLineage.map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          throw new Error(
            `Offer Sheet creation is missing the expected ${label} source receipt.`
          );
        }
        const record = entry as Record<string, unknown>;
        const worldId = String(record.worldId || '').trim();
        const exists = record.exists;
        const digest = record.digest;
        if (
          !worldId ||
          typeof exists !== 'boolean' ||
          (exists && (typeof digest !== 'string' || !digest.trim())) ||
          (!exists && digest !== null)
        ) {
          throw new Error(
            `Offer Sheet creation is missing the expected ${label} source receipt.`
          );
        }
        return Object.freeze({
          worldId,
          exists,
          digest: exists ? String(digest).trim() : null,
        });
      })
    ),
  });
}

function requireExpectedOfferSheetCreationSnapshots({
  metadata,
  lifecycle,
}: {
  metadata: Record<string, unknown>;
  lifecycle: ReturnType<typeof GovernedOfferSheetLifecycleZ.parse>;
}): ExpectedOfferSheetCreationSnapshots {
  const raw = metadata.expectedOfferSheetCreationSnapshots;
  const snapshots =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const homeTeamCode = String(snapshots?.homeTeamCode || '').trim();
  const offeringTeamCode = String(snapshots?.offeringTeamCode || '').trim();
  if (
    !snapshots ||
    homeTeamCode !== lifecycle.homeTeamId ||
    offeringTeamCode !== lifecycle.offeringTeamId
  ) {
    throw new Error(
      'Offer Sheet creation is missing the expected Team snapshot receipts.'
    );
  }
  return Object.freeze({
    homeTeamCode,
    offeringTeamCode,
    homeTeam: requireDocumentSnapshotReference(
      snapshots.homeTeam,
      `${homeTeamCode} Team`
    ),
    offeringTeam: requireDocumentSnapshotReference(
      snapshots.offeringTeam,
      `${offeringTeamCode} Team`
    ),
  });
}

function requireLocalDocumentSnapshotReference(
  raw: unknown,
  label: string
): ExpectedLocalDocumentSnapshotReference {
  const receipt =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const exists = receipt?.exists;
  const digest = receipt?.digest;
  if (
    typeof exists !== 'boolean' ||
    (exists && (typeof digest !== 'string' || !digest.trim())) ||
    (!exists && digest !== null)
  ) {
    throw new Error(
      `Offer Sheet resolution is missing the expected ${label} snapshot receipt.`
    );
  }
  return Object.freeze({
    exists,
    digest: exists ? String(digest).trim() : null,
  });
}

function requireExpectedOfferSheetResolutionSnapshots({
  metadata,
  lifecycle,
}: {
  metadata: Record<string, unknown>;
  lifecycle: ReturnType<typeof GovernedOfferSheetLifecycleZ.parse>;
}): ExpectedOfferSheetResolutionSnapshots {
  const raw = metadata.expectedOfferSheetResolutionSnapshots;
  const snapshots =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const playerId = String(snapshots?.playerId || '').trim();
  const homeTeamCode = String(snapshots?.homeTeamCode || '').trim();
  const offeringTeamCode = String(snapshots?.offeringTeamCode || '').trim();
  if (
    !snapshots ||
    !playerId ||
    playerId !== String(metadata.playerId || '').trim() ||
    playerId !== lifecycle.playerId ||
    homeTeamCode !== lifecycle.homeTeamId ||
    offeringTeamCode !== lifecycle.offeringTeamId
  ) {
    throw new Error(
      'Offer Sheet resolution is missing the expected document snapshot receipts.'
    );
  }
  const homeTeam = requireLocalDocumentSnapshotReference(
    snapshots.homeTeam,
    `${homeTeamCode} Team`
  );
  const offeringTeam = requireLocalDocumentSnapshotReference(
    snapshots.offeringTeam,
    `${offeringTeamCode} Team`
  );
  if (!homeTeam.exists || !offeringTeam.exists) {
    throw new Error(
      'Offer Sheet resolution requires existing snapshot receipts for both Teams.'
    );
  }
  const authorization = requireLocalDocumentSnapshotReference(
    snapshots.authorization,
    `${lifecycle.ledgerId} authorization`
  );
  const immutableEvidenceDigest = String(
    snapshots.immutableEvidenceDigest || ''
  ).trim();
  if (!authorization.exists || !immutableEvidenceDigest) {
    throw new Error(
      'Offer Sheet resolution is missing its immutable authorization receipt.'
    );
  }
  return Object.freeze({
    playerId,
    homeTeamCode,
    offeringTeamCode,
    homeTeam,
    offeringTeam,
    homePlayer: requireLocalDocumentSnapshotReference(
      snapshots.homePlayer,
      `${homeTeamCode}/${playerId} player`
    ),
    offeringPlayer: requireLocalDocumentSnapshotReference(
      snapshots.offeringPlayer,
      `${offeringTeamCode}/${playerId} player`
    ),
    authorization,
    immutableEvidenceDigest,
  });
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
  const snapshots = requireExpectedOfferSheetResolutionSnapshots({
    metadata,
    lifecycle: resolved.data,
  });
  if (
    mutationSnapshotDigest(resolved.data.evidenceSnapshot) !==
    snapshots.immutableEvidenceDigest
  ) {
    throw new Error(
      'Offer Sheet resolution lifecycle does not match immutable base evidence.'
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
    snapshots,
  });
}

function assertSnapshotReferenceStillCurrent({
  exists,
  data,
  expected,
  label,
}: {
  exists: boolean;
  data: unknown;
  expected: ExpectedLocalDocumentSnapshotReference;
  label: string;
}): void {
  if (
    exists !== expected.exists ||
    (exists && mutationSnapshotDigest(data) !== expected.digest)
  ) {
    throw new Error(
      `${label} changed before commit. Reload and try again.`
    );
  }
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

async function recheckExactSourceLineage({
  transaction,
  rawLineage,
  expectedSourceWorldIdValue,
  expectedSourceDigest,
  currentWorldId,
  sourceRef,
  receiptLabel,
  changedLabel,
  changedIdentifier,
  operationLabel,
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
  operationLabel: string;
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
    throw new Error(`${operationLabel} is missing the exact ${receiptLabel}.`);
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
      throw new Error(`${operationLabel} is missing the exact ${receiptLabel}.`);
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
      throw new Error(`${operationLabel} is missing the exact ${receiptLabel}.`);
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
    throw new Error(`${operationLabel} is missing the exact ${receiptLabel}.`);
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

    const metadata = computeResult.metadata as Record<string, unknown>;
    const isOfferSheetCreation = mutationType === 'storeOfferSheet';
    const creationLifecycleParse = isOfferSheetCreation
      ? GovernedOfferSheetLifecycleZ.safeParse(
          metadata.governedOfferSheetLifecycle
        )
      : null;
    if (
      isOfferSheetCreation &&
      (!creationLifecycleParse?.success ||
        creationLifecycleParse.data.status !== 'pending-match')
    ) {
      throw new Error(
        'Offer Sheet creation is missing its governed pending lifecycle.'
      );
    }
    const creationLifecycle = creationLifecycleParse?.success
      ? creationLifecycleParse.data
      : null;
    const expectedOfferSheetCreationSnapshots = creationLifecycle
      ? requireExpectedOfferSheetCreationSnapshots({
          metadata,
          lifecycle: creationLifecycle,
        })
      : null;
    const creationAuthorization = creationLifecycle
      ? buildGovernedOfferSheetAuthorization({
          lifecycle: creationLifecycle,
          offerSheetId: String(metadata.offerSheetId || ''),
          dedupKey: String(metadata.dedupKey || ''),
        })
      : null;
    const isOfferSheetResolution = isOfferSheetResolutionMutation(mutationType);
    const expectedOfferSheetLifecycle = isOfferSheetResolution
      ? requireExpectedOfferSheetLifecycleReference({
          metadata,
          mutationType,
        })
      : null;
    if (expectedOfferSheetCreationSnapshots) {
      const creationTeamCodes = new Set(
        teamUpdates.map(({ teamCode }) => String(teamCode || '').trim())
      );
      if (
        creationTeamCodes.size !== 2 ||
        !creationTeamCodes.has(
          expectedOfferSheetCreationSnapshots.homeTeamCode
        ) ||
        !creationTeamCodes.has(
          expectedOfferSheetCreationSnapshots.offeringTeamCode
        )
      ) {
        throw new Error(
          'Offer Sheet creation must atomically replace both governed Team mirrors.'
        );
      }
    }
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
      mutationType === 'waivePlayer' ||
      mutationType === 'signFreeAgent' ||
      isOfferSheetCreation ||
      isOfferSheetResolution
    ) {
      await runTransaction(db, async (transaction) => {
        for (const { teamCode, team } of teamUpdates) {
          const normalizedTeamCode = String(teamCode || '').trim();
          if (!team || !normalizedTeamCode) continue;
          const teamRef = worldTeamRef(worldId, normalizedTeamCode);
          const currentTeamSnapshot = await transaction.get(teamRef);
          const currentTeamExists = currentTeamSnapshot.exists();
          if (
            !currentTeamExists &&
            mutationType !== 'extendPlayer' &&
            mutationType !== 'waivePlayer' &&
            mutationType !== 'signFreeAgent' &&
            !isOfferSheetCreation
          ) {
            throw new Error(
              `Team ${normalizedTeamCode} changed before the governed history append could commit. Reload and try again.`
            );
          }
          const currentTeamData = currentTeamExists
            ? currentTeamSnapshot.data()
            : {};
          let contractSourceTeamData = currentTeamData;
          if (expectedOfferSheetCreationSnapshots) {
            const expectedTeamSnapshot =
              normalizedTeamCode ===
              expectedOfferSheetCreationSnapshots.homeTeamCode
                ? expectedOfferSheetCreationSnapshots.homeTeam
                : expectedOfferSheetCreationSnapshots.offeringTeam;
            assertSnapshotReferenceStillCurrent({
              exists: currentTeamExists,
              data: currentTeamData,
              expected: expectedTeamSnapshot,
              label: `Team snapshot for ${normalizedTeamCode}`,
            });
            if (expectedTeamSnapshot.exists) {
              if (
                expectedTeamSnapshot.sourceWorldId !== worldId ||
                expectedTeamSnapshot.sourceDigest !==
                  expectedTeamSnapshot.digest ||
                expectedTeamSnapshot.sourceLineage.length !== 0
              ) {
                throw new Error(
                  `Offer Sheet creation is missing the exact Team source receipt for ${normalizedTeamCode}.`
                );
              }
            } else {
              await recheckExactSourceLineage({
                transaction,
                rawLineage: expectedTeamSnapshot.sourceLineage,
                expectedSourceWorldIdValue:
                  expectedTeamSnapshot.sourceWorldId,
                expectedSourceDigest: expectedTeamSnapshot.sourceDigest,
                currentWorldId: worldId,
                sourceRef: (sourceWorldId) =>
                  worldTeamRef(sourceWorldId, normalizedTeamCode),
                receiptLabel: `Team source receipt for ${normalizedTeamCode}`,
                changedLabel: 'Team',
                changedIdentifier: normalizedTeamCode,
                operationLabel: 'Offer Sheet creation',
              });
            }
          } else if (mutationType === 'renounceRights') {
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
            const expectedTeamSnapshot =
              normalizedTeamCode ===
              expectedOfferSheetLifecycle.snapshots.homeTeamCode
                ? expectedOfferSheetLifecycle.snapshots.homeTeam
                : expectedOfferSheetLifecycle.snapshots.offeringTeam;
            assertSnapshotReferenceStillCurrent({
              exists: currentTeamExists,
              data: currentTeamData,
              expected: expectedTeamSnapshot,
              label: `Team snapshot for ${normalizedTeamCode}`,
            });
            recheckOfferSheetLifecycleBeforeCommit({
              currentTeamData,
              teamCode: normalizedTeamCode,
              expected: expectedOfferSheetLifecycle,
            });
          } else {
            const signingTeamCode = String(metadata.teamCode || '').trim();
            const isSigningTargetTeam =
              mutationType === 'signFreeAgent' &&
              normalizedTeamCode === signingTeamCode;
            const isSigningPriorTeam =
              mutationType === 'signFreeAgent' &&
              normalizedTeamCode !== signingTeamCode;
            if (mutationType === 'signFreeAgent' && !signingTeamCode) {
              throw new Error(
                'Signing is missing its governed destination Team identifier.'
              );
            }
            if (isSigningPriorTeam) {
              const expectedPriorTeam = requireDocumentSnapshotReference(
                metadata.expectedPriorTeamSnapshot,
                `prior Team snapshot for ${normalizedTeamCode}`
              );
              assertSnapshotReferenceStillCurrent({
                exists: currentTeamExists,
                data: currentTeamData,
                expected: expectedPriorTeam,
                label: `Prior Team snapshot for ${normalizedTeamCode}`,
              });
              if (expectedPriorTeam.exists) {
                if (
                  expectedPriorTeam.sourceWorldId !== worldId ||
                  expectedPriorTeam.sourceDigest !== expectedPriorTeam.digest ||
                  expectedPriorTeam.sourceLineage.length !== 0
                ) {
                  throw new Error(
                    `Signing is missing the exact prior Team source receipt for ${normalizedTeamCode}.`
                  );
                }
              } else {
                await recheckExactSourceLineage({
                  transaction,
                  rawLineage: expectedPriorTeam.sourceLineage,
                  expectedSourceWorldIdValue:
                    expectedPriorTeam.sourceWorldId,
                  expectedSourceDigest: expectedPriorTeam.sourceDigest,
                  currentWorldId: worldId,
                  sourceRef: (sourceWorldId) =>
                    worldTeamRef(sourceWorldId, normalizedTeamCode),
                  receiptLabel: `prior Team source receipt for ${normalizedTeamCode}`,
                  changedLabel: 'prior Team',
                  changedIdentifier: normalizedTeamCode,
                  operationLabel: 'Signing',
                });
              }
            }
            if (
              mutationType === 'extendPlayer' ||
              mutationType === 'waivePlayer' ||
              isSigningTargetTeam
            ) {
              const operationLabel =
                mutationType === 'waivePlayer'
                  ? 'Waiver'
                  : mutationType === 'signFreeAgent'
                    ? 'Signing'
                    : 'Extension';
              const expectedTeamExists = metadata.expectedTeamSnapshotExists;
              const expectedTeamDigest = metadata.expectedTeamSnapshotDigest;
              if (
                typeof expectedTeamExists !== 'boolean' ||
                (expectedTeamExists && typeof expectedTeamDigest !== 'string') ||
                (!expectedTeamExists && expectedTeamDigest !== null)
              ) {
                throw new Error(
                  `${operationLabel} is missing the expected team-snapshot receipt for ${normalizedTeamCode}.`
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
                    `${operationLabel} is missing the exact team-source receipt for ${normalizedTeamCode}.`
                  );
                }
              } else {
                contractSourceTeamData = await recheckExactSourceLineage({
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
                  operationLabel,
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
                  `${operationLabel} is missing the expected player-snapshot receipt for ${normalizedTeamCode}.`
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
                    `${operationLabel} is missing the exact player-source receipt for ${expectedPlayerId}.`
                  );
                }
              } else {
                await recheckExactSourceLineage({
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
                  operationLabel,
                });
              }
            }
            if (!isSigningPriorTeam) {
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
              if (
                !expectedLedgerId ||
                !Number.isInteger(expectedLedgerVersion)
              ) {
                throw new Error(
                  `${mutationType === 'extendPlayer' ? 'Extension' : mutationType === 'waivePlayer' ? 'Waiver' : mutationType === 'signFreeAgent' ? 'Signing' : 'Option decision'} is missing the expected contract-ledger reference for ${normalizedTeamCode}.`
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
                    `${mutationType === 'extendPlayer' ? 'Extension' : mutationType === 'waivePlayer' ? 'Waiver' : mutationType === 'signFreeAgent' ? 'Signing' : 'Option decision'} is missing the expected writable overlay version for ${normalizedTeamCode}.`
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
        }
        if (creationAuthorization) {
          const authorizationRef = worldOfferSheetAuthorizationRef(
            worldId,
            creationAuthorization.offerSheetId
          );
          const authorizationSnapshot = await transaction.get(
            authorizationRef
          );
          if (authorizationSnapshot.exists()) {
            const currentAuthorization =
              GovernedOfferSheetAuthorizationZ.safeParse(
                authorizationSnapshot.data()
              );
            if (
              !currentAuthorization.success ||
              mutationSnapshotDigest(currentAuthorization.data) !==
                mutationSnapshotDigest(creationAuthorization)
            ) {
              throw new Error(
                'Offer Sheet authorization changed before commit. Reload and try again.'
              );
            }
          } else {
            transaction.set(authorizationRef, creationAuthorization);
          }
        }
        if (expectedOfferSheetLifecycle) {
          const { snapshots } = expectedOfferSheetLifecycle;
          const authorizationRef = worldOfferSheetAuthorizationRef(
            worldId,
            expectedOfferSheetLifecycle.offerSheetId
          );
          const authorizationSnapshot = await transaction.get(
            authorizationRef
          );
          assertSnapshotReferenceStillCurrent({
            exists: authorizationSnapshot.exists(),
            data: authorizationSnapshot.exists()
              ? authorizationSnapshot.data()
              : {},
            expected: snapshots.authorization,
            label: 'Offer Sheet authorization',
          });
          const expectedAuthorization = GovernedOfferSheetAuthorizationZ.parse({
            authorizationVersion: 1,
            worldId,
            offerSheetId: expectedOfferSheetLifecycle.offerSheetId,
            dedupKey: expectedOfferSheetLifecycle.dedupKey,
            playerId: snapshots.playerId,
            homeTeamId: snapshots.homeTeamCode,
            offeringTeamId: snapshots.offeringTeamCode,
            salaryCapYear: GovernedOfferSheetLifecycleZ.parse(
              metadata.governedOfferSheetLifecycle
            ).salaryCapYear,
            pendingLifecycleDigest: expectedOfferSheetLifecycle.digest,
            immutableEvidenceDigest: snapshots.immutableEvidenceDigest,
          });
          const currentAuthorization = authorizationSnapshot.exists()
            ? GovernedOfferSheetAuthorizationZ.safeParse(
                authorizationSnapshot.data()
              )
            : null;
          if (
            !currentAuthorization?.success ||
            mutationSnapshotDigest(currentAuthorization.data) !==
              mutationSnapshotDigest(expectedAuthorization)
          ) {
            throw new Error(
              'Offer Sheet resolution authorization changed before commit. Reload and try again.'
            );
          }
          const immutableBasePlayer = await transaction.get(
            basePlayerRef(snapshots.playerId)
          );
          const rawBasePlayer = immutableBasePlayer.exists()
            ? immutableBasePlayer.data()
            : {};
          const immutableEvidence = GovernedOfferSheetEvidenceZ.safeParse(
            rawBasePlayer.rfaContext?.governedEvidence
          );
          if (
            !immutableEvidence.success ||
            mutationSnapshotDigest(immutableEvidence.data) !==
              snapshots.immutableEvidenceDigest
          ) {
            throw new Error(
              'Offer Sheet resolution authorization no longer matches immutable base evidence.'
            );
          }
          for (const [teamCode, expectedPlayerSnapshot] of [
            [snapshots.homeTeamCode, snapshots.homePlayer],
            [snapshots.offeringTeamCode, snapshots.offeringPlayer],
          ] as const) {
            const currentPlayerSnapshot = await transaction.get(
              worldPlayerRef(worldId, teamCode, snapshots.playerId)
            );
            assertSnapshotReferenceStillCurrent({
              exists: currentPlayerSnapshot.exists(),
              data: currentPlayerSnapshot.exists()
                ? currentPlayerSnapshot.data()
                : {},
              expected: expectedPlayerSnapshot,
              label: `Player snapshot for ${snapshots.playerId} on ${teamCode}`,
            });
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
