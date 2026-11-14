/** Trusted callable that establishes governed Architect world contract roots. */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  CallableRequest,
  HttpsError,
  onCall,
} from 'firebase-functions/v2/https';

import {
  branchTrustedContractBaselineDocuments,
  buildTrustedContractBaselineDocuments,
  canonicalStringify,
  CONTRACT_BASELINE_WORLD_VERSION,
  resolveFreshWorldSeason,
  seasonForSalaryCapYear,
  trustedContractBaselineMetadata,
  type TrustedContractReleasePin,
} from './trustedContractBaseline';
import {
  loadSimulationFinancialBaseline,
  simulationContractRelease,
  loadParentContractRelease,
} from './simulationFinancialBaseline';
import { loadTrustedDraftBaseline } from './trustedDraftBaseline';
import { loadSimulationDraftBaseline } from './simulationDraftBaseline';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const ARCHITECT_WORLDS_COLLECTION = 'architect_worlds';
const CONTRACT_BASELINES_SUBCOLLECTION = 'contractBaselines';
const RIGHTS_LEDGER_WORLD_VERSION = 1;
const WORLD_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const SEASON_PATTERN = /^\d{4}-\d{2}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type JsonRecord = Record<string, unknown>;

type InitializeArchitectWorldRequest = {
  worldId: string;
  worldName: string;
  description?: string;
  userId: string;
  currentSeason?: string | null;
  parentWorldId?: string | null;
  /** SIMULATION copy: the parent draft revision the client read at. */
  expectedParentDraftRevision?: number | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireIdentifier(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !WORLD_ID_PATTERN.test(value) ||
    value.trim() !== value
  ) {
    throw new HttpsError('invalid-argument', `${field} is invalid.`);
  }
  return value;
}

function requireText(
  value: unknown,
  field: string,
  maximumLength: number,
  allowEmpty = false
): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${field} must be a string.`);
  }
  const normalized = value.trim();
  if ((!allowEmpty && normalized === '') || normalized.length > maximumLength) {
    throw new HttpsError('invalid-argument', `${field} is invalid.`);
  }
  return normalized;
}

function defaultStats(): JsonRecord {
  return {
    totalTrades: 0,
    totalSignings: 0,
    totalWaives: 0,
    totalRenounces: 0,
    teamsInvolved: 0,
  };
}

function contractReleasePinFromParent(
  parent: JsonRecord
): TrustedContractReleasePin {
  const value = parent.contractSourceRelease;
  if (
    !isRecord(value) ||
    typeof value.releaseId !== 'string' ||
    value.releaseId.trim() === '' ||
    typeof value.releaseVersion !== 'number' ||
    !Number.isInteger(value.releaseVersion) ||
    value.releaseVersion < 1 ||
    typeof value.releaseDigest !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/.test(value.releaseDigest)
  ) {
    throw new HttpsError(
      'failed-precondition',
      'The parent world has a malformed governed contract-source release pin.'
    );
  }
  return {
    releaseId: value.releaseId,
    releaseVersion: value.releaseVersion,
    releaseDigest: value.releaseDigest,
  };
}

function requireFreshWorldSeason(
  salaryCapYear: number,
  requestedSeason: string | null
): string {
  try {
    return resolveFreshWorldSeason({ salaryCapYear }, requestedSeason);
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      error instanceof Error ? error.message : 'currentSeason is invalid.'
    );
  }
}

function isDateWithinSeason(date: string, season: string): boolean {
  if (
    !DATE_ONLY_PATTERN.test(date) ||
    !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    return false;
  }
  const startYear = Number(season.slice(0, 4));
  const endYear = startYear + 1;
  if (season !== `${startYear}-${String(endYear).slice(-2)}`) return false;
  return date >= `${startYear}-07-01` && date <= `${endYear}-06-30`;
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? cloneJson(value) : [];
}

function objectOrDefault(value: unknown, fallback: JsonRecord): JsonRecord {
  return isRecord(value) ? cloneJson(value) : fallback;
}

function contractMetadataFromParent(
  parent: JsonRecord,
  trustedMetadata: JsonRecord
): { release: JsonRecord; total: number } {
  const parentRelease = parent.contractSourceRelease;
  const trustedRelease = trustedMetadata.contractSourceRelease;
  const coverage = parent.contractBaselineCoverage;
  const trustedCoverage = trustedMetadata.contractBaselineCoverage;
  if (
    parent.contractBaselineVersion !== CONTRACT_BASELINE_WORLD_VERSION ||
    !isRecord(parentRelease) ||
    !isRecord(trustedRelease) ||
    canonicalStringify(parentRelease) !== canonicalStringify(trustedRelease) ||
    parent.contractBaselineEffectiveAt !==
      trustedMetadata.contractBaselineEffectiveAt ||
    parent.contractBaselineSalaryCapYear !==
      trustedMetadata.contractBaselineSalaryCapYear ||
    !isRecord(coverage) ||
    !isRecord(trustedCoverage) ||
    canonicalStringify(coverage) !== canonicalStringify(trustedCoverage) ||
    typeof coverage.total !== 'number' ||
    !Number.isInteger(coverage.total) ||
    coverage.total < 1
  ) {
    throw new HttpsError(
      'failed-precondition',
      'The parent world does not contain the deployed governed contract baseline.'
    );
  }
  return { release: parentRelease, total: coverage.total };
}

function freshWorldMetadata(args: {
  worldId: string;
  worldName: string;
  description: string;
  userId: string;
  season: string;
  releaseEffectiveAt: string;
  contractMetadata: JsonRecord;
}): JsonRecord {
  return {
    worldId: args.worldId,
    worldName: args.worldName,
    description: args.description,
    createdBy: args.userId,
    createdAt: FieldValue.serverTimestamp(),
    lastModifiedAt: FieldValue.serverTimestamp(),
    currentSeason: args.season,
    baselineSeason: args.season,
    parentWorldId: null,
    branchedFrom: null,
    childWorlds: [],
    modifiedTeams: [],
    actionCount: 0,
    tags: [],
    isArchived: false,
    isFavorite: false,
    stats: defaultStats(),
    rightsLedgerVersion: RIGHTS_LEDGER_WORLD_VERSION,
    asOfDate: args.releaseEffectiveAt.slice(0, 10),
    ...args.contractMetadata,
  };
}

function branchWorldMetadata(args: {
  worldId: string;
  worldName: string;
  description: string;
  userId: string;
  parentWorldId: string;
  parent: JsonRecord;
  contractMetadata: JsonRecord;
}): JsonRecord {
  const salaryCapYear = args.contractMetadata.contractBaselineSalaryCapYear;
  if (typeof salaryCapYear !== 'number') {
    throw new HttpsError(
      'failed-precondition',
      'The parent world has no supported Salary Cap Year.'
    );
  }
  const governedBaselineSeason = seasonForSalaryCapYear(salaryCapYear);
  if (args.parent.baselineSeason !== governedBaselineSeason) {
    throw new HttpsError(
      'failed-precondition',
      'The parent world baseline season contradicts its governed Salary Cap Year.'
    );
  }
  const currentSeason =
    typeof args.parent.currentSeason === 'string'
      ? args.parent.currentSeason
      : governedBaselineSeason;
  if (
    !SEASON_PATTERN.test(currentSeason) ||
    Number(currentSeason.slice(0, 4)) < salaryCapYear - 1
  ) {
    throw new HttpsError(
      'failed-precondition',
      'The parent world current season predates its governed baseline season.'
    );
  }
  const asOfDate = args.parent.asOfDate;
  const releaseEffectiveAt = args.contractMetadata.contractBaselineEffectiveAt;
  if (
    typeof asOfDate !== 'string' ||
    !DATE_ONLY_PATTERN.test(asOfDate) ||
    !isDateWithinSeason(asOfDate, currentSeason) ||
    typeof releaseEffectiveAt !== 'string' ||
    asOfDate < releaseEffectiveAt.slice(0, 10)
  ) {
    throw new HttpsError(
      'failed-precondition',
      'The parent world date contradicts its current season.'
    );
  }
  const metadata: JsonRecord = {
    worldId: args.worldId,
    worldName: args.worldName,
    description: args.description,
    createdBy: args.userId,
    createdAt: FieldValue.serverTimestamp(),
    lastModifiedAt: FieldValue.serverTimestamp(),
    currentSeason,
    baselineSeason: governedBaselineSeason,
    parentWorldId: args.parentWorldId,
    branchedFrom: FieldValue.serverTimestamp(),
    childWorlds: [],
    modifiedTeams: arrayOrEmpty(args.parent.modifiedTeams),
    actionCount:
      typeof args.parent.actionCount === 'number' ? args.parent.actionCount : 0,
    tags: arrayOrEmpty(args.parent.tags),
    isArchived: true,
    isFavorite: false,
    stats: objectOrDefault(args.parent.stats, defaultStats()),
    rightsLedgerVersion: RIGHTS_LEDGER_WORLD_VERSION,
    asOfDate,
    ...args.contractMetadata,
  };
  if (isRecord(args.parent.draftPositionsByYear)) {
    metadata.draftPositionsByYear = cloneJson(args.parent.draftPositionsByYear);
  }
  return metadata;
}

const SIMULATION_NAME_PREFIX = 'SIMULATION — ';
const SIMULATION_DESCRIPTION_NOTE =
  'Public-data simulation. Unidentified grievances and first-round Required Tenders are assumed not applicable only where explicitly recorded; this is not certified historical compliance.';

/**
 * Copy of a SIMULATION world (V1 item A6). The child carries the parent's
 * immutable financial and draft identities. Each existing draft transfer keeps
 * its receipt from the world that committed it, recorded in server-only
 * metadata so a client can never rebind custody history.
 */
async function simulationCopyMetadata(
  parentRef: FirebaseFirestore.DocumentReference,
  parentWorldId: string,
  parent: JsonRecord,
  expectedRevision: unknown
): Promise<{ metadata: JsonRecord; draftRoot: JsonRecord | null }> {
  const metadata: JsonRecord = {
    simulationFinancialBaseline: cloneJson(parent.simulationFinancialBaseline),
  };
  if (parent.draftBaseline == null) return { metadata, draftRoot: null };
  const root = (
    await parentRef.collection('draftBaselines').doc('root').get()
  ).data();
  const revision = parent.draftInventoryRevision;
  const transfers = parent.draftWorldTransfers;
  const parentCopy = parent.draftCopy;
  if (
    !root ||
    root.worldId !== parentWorldId ||
    !isRecord(root.release) ||
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    !Array.isArray(transfers) ||
    (parent.parentWorldId != null &&
      (!isRecord(parentCopy) ||
        parentCopy.parentWorldId !== parent.parentWorldId)) ||
    (parentCopy != null &&
      (!isRecord(parentCopy) || !isRecord(parentCopy.receiptWorldIds)))
  )
    throw new HttpsError(
      'failed-precondition',
      'The SIMULATION world has no complete draft source to copy. The parent is unchanged.'
    );
  // The client read the parent's documents at this revision. Any draft or
  // roster commit since then would pair old documents with new custody.
  if (expectedRevision !== revision)
    throw new HttpsError(
      'aborted',
      'The SIMULATION world changed while it was being copied. Try again; the parent is unchanged.'
    );
  const inherited = isRecord(parentCopy)
    ? (parentCopy.receiptWorldIds as JsonRecord)
    : {};
  const receiptWorldIds: Record<string, string> = {};
  for (const transfer of transfers) {
    const operationId = isRecord(transfer) ? transfer.operationId : null;
    if (typeof operationId !== 'string' || operationId === '')
      throw new HttpsError(
        'failed-precondition',
        'A SIMULATION draft transfer has no operation identity. The parent is unchanged.'
      );
    const receiptWorld = Object.prototype.hasOwnProperty.call(
      inherited,
      operationId
    )
      ? inherited[operationId]
      : parentWorldId;
    if (typeof receiptWorld !== 'string' || receiptWorld === '')
      throw new HttpsError(
        'failed-precondition',
        'A copied draft receipt has no source world. The parent is unchanged.'
      );
    receiptWorldIds[operationId] = receiptWorld;
  }
  Object.assign(metadata, {
    draftBaseline: cloneJson(parent.draftBaseline),
    draftInventoryRevision: 0,
    draftWorldTransfers: cloneJson(transfers),
    draftCopy: { parentWorldId, receiptWorldIds },
  });
  return { metadata, draftRoot: cloneJson(root.release as JsonRecord) };
}

export const initializeArchitectWorld = onCall(
  {
    enforceAppCheck: false,
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  async (request: CallableRequest<InitializeArchitectWorldRequest>) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to create worlds.'
      );
    }

    const worldId = requireIdentifier(request.data?.worldId, 'worldId');
    const userId = requireText(request.data?.userId, 'userId', 128);
    if (userId !== request.auth.uid) {
      throw new HttpsError(
        'permission-denied',
        'The requested world owner does not match the authenticated user.'
      );
    }
    const worldName = requireText(request.data?.worldName, 'worldName', 120);
    const description = requireText(
      request.data?.description ?? '',
      'description',
      2_000,
      true
    );
    const requestedSeason = request.data?.currentSeason ?? null;
    if (
      requestedSeason !== null &&
      (typeof requestedSeason !== 'string' ||
        !SEASON_PATTERN.test(requestedSeason))
    ) {
      throw new HttpsError(
        'invalid-argument',
        'currentSeason must be a season key such as 2025-26.'
      );
    }
    const parentWorldId =
      request.data?.parentWorldId == null
        ? null
        : requireIdentifier(request.data.parentWorldId, 'parentWorldId');
    if (parentWorldId && requestedSeason !== null) {
      throw new HttpsError(
        'invalid-argument',
        'currentSeason cannot be supplied when branching a world.'
      );
    }

    try {
      const worldRef = db.collection(ARCHITECT_WORLDS_COLLECTION).doc(worldId);
      if ((await worldRef.get()).exists) {
        throw new HttpsError(
          'already-exists',
          `World ${worldId} already exists.`
        );
      }

      let metadata: JsonRecord;
      let documents;
      let trustedMetadata: JsonRecord;
      let simulationBaseline: Awaited<
        ReturnType<typeof loadSimulationFinancialBaseline>
      > = null;
      let draftBaseline: ReturnType<typeof loadTrustedDraftBaseline> = null;
      let simulationDraft: Awaited<
        ReturnType<typeof loadSimulationDraftBaseline>
      > = null;
      let simulationCopy: Awaited<
        ReturnType<typeof simulationCopyMetadata>
      > | null = null;
      if (parentWorldId) {
        const parentRef = db
          .collection(ARCHITECT_WORLDS_COLLECTION)
          .doc(parentWorldId);
        const parentSnapshot = await parentRef.get();
        if (!parentSnapshot.exists) {
          throw new HttpsError(
            'not-found',
            `Parent world ${parentWorldId} not found.`
          );
        }
        const parent = parentSnapshot.data() ?? {};
        if (parent.createdBy !== request.auth.uid) {
          throw new HttpsError(
            'permission-denied',
            'You do not have permission to branch this world.'
          );
        }
        const governedParent =
          parent.draftBaseline != null ||
          parent.simulationFinancialBaseline != null;
        if (
          governedParent &&
          (!isRecord(parent.simulationFinancialBaseline) ||
            (parent.draftBaseline != null &&
              (!isRecord(parent.draftBaseline) ||
                parent.draftBaseline.classification !== 'simulation')))
        ) {
          // Software draft fixtures keep their single-world custody proofs.
          throw new HttpsError(
            'failed-precondition',
            'Only a SIMULATION world can be copied. The parent is unchanged.'
          );
        }
        const release = await loadParentContractRelease(
          contractReleasePinFromParent(parent)
        );
        trustedMetadata = trustedContractBaselineMetadata(release);
        const parentContract = contractMetadataFromParent(
          parent,
          trustedMetadata
        );
        const parentDocuments = await parentRef
          .collection(CONTRACT_BASELINES_SUBCOLLECTION)
          .get();
        documents = branchTrustedContractBaselineDocuments(
          parentDocuments.docs.map((entry) => entry.data()),
          parentWorldId,
          worldId,
          parentContract.release,
          release.source.evidenceCatalog,
          parentContract.total
        );
        metadata = branchWorldMetadata({
          worldId,
          worldName,
          description,
          userId: request.auth.uid,
          parentWorldId,
          parent,
          contractMetadata: trustedMetadata,
        });
        if (governedParent) {
          simulationCopy = await simulationCopyMetadata(
            parentRef,
            parentWorldId,
            parent,
            request.data?.expectedParentDraftRevision
          );
          Object.assign(metadata, simulationCopy.metadata, {
            worldName: worldName.startsWith(SIMULATION_NAME_PREFIX)
              ? worldName
              : `${SIMULATION_NAME_PREFIX}${worldName}`,
            description: `${description}\n${SIMULATION_DESCRIPTION_NOTE}`,
          });
        }
      } else {
        simulationBaseline = await loadSimulationFinancialBaseline();
        const release = simulationContractRelease(simulationBaseline);
        trustedMetadata = trustedContractBaselineMetadata(release);
        const season = requireFreshWorldSeason(
          release.salaryCapYear,
          requestedSeason
        );
        documents = buildTrustedContractBaselineDocuments(release, worldId);
        metadata = freshWorldMetadata({
          worldId,
          worldName,
          description,
          userId: request.auth.uid,
          season,
          releaseEffectiveAt: release.effectiveAt,
          contractMetadata: trustedMetadata,
        });
        if (simulationBaseline) {
          if (
            simulationBaseline.asOf !== release.effectiveAt ||
            simulationBaseline.seasonId !== season
          )
            throw new Error('Simulation and Contract baseline dates differ.');
          Object.assign(metadata, {
            simulationFinancialBaseline: {
              classification: 'SIMULATION',
              asOf: simulationBaseline.asOf,
              sha256: process.env.SCOUTZERO_SIMULATION_FINANCIAL_SHA256,
            },
            worldName: `${SIMULATION_NAME_PREFIX}${worldName}`,
            description: `${description}\n${SIMULATION_DESCRIPTION_NOTE}`,
          });
        }
        draftBaseline = loadTrustedDraftBaseline();
        if (draftBaseline && simulationBaseline)
          throw new Error(
            'Software draft fixtures and public-data simulation inputs cannot be combined.'
          );
        if (draftBaseline) {
          if (
            draftBaseline.baseline.asOf !== release.effectiveAt ||
            draftBaseline.baseline.seasonId !== season
          )
            throw new Error('Draft and Contract baseline dates differ.');
          Object.assign(metadata, {
            draftBaseline: draftBaseline.metadata,
            draftInventoryRevision: 0,
            draftWorldTransfers: [],
            worldName: `Software fixture — ${worldName}`,
          });
        }
        simulationDraft = await loadSimulationDraftBaseline();
        if (simulationDraft) {
          if (!simulationBaseline || draftBaseline)
            throw new Error(
              'A SIMULATION draft baseline requires the SIMULATION financial baseline and no software fixture.'
            );
          if (
            simulationDraft.baseline.asOf !== release.effectiveAt ||
            simulationDraft.baseline.seasonId !== season
          )
            throw new Error('Draft and Contract baseline dates differ.');
          const financialTeams = Object.keys(simulationBaseline.teams).sort();
          if (
            financialTeams.join() !==
            Object.keys(simulationDraft.baseline.initialTeams).sort().join()
          )
            throw new Error(
              'SIMULATION draft and financial baselines cover different teams.'
            );
          Object.assign(metadata, {
            draftBaseline: simulationDraft.metadata,
            draftInventoryRevision: 0,
            draftWorldTransfers: [],
          });
        }
      }

      const draftWrites = draftBaseline
        ? 1 +
          Object.keys(draftBaseline.baseline.initialTeams).length +
          Object.keys(draftBaseline.baseline.retainedEntitlements).length
        : simulationDraft
          ? 1 +
            Object.keys(simulationDraft.baseline.retainedEntitlements).length
          : simulationCopy?.draftRoot
            ? 1
            : 0;
      if (documents.length + 1 + draftWrites > 500) {
        throw new Error('Governed contract baseline exceeds one atomic batch.');
      }
      if (simulationBaseline) {
        // Full SIMULATION team documents exceed one request with the contract
        // baseline. Stage them first under the not-yet-existing world; the
        // world only appears when the batch below creates its document.
        const entries = Object.entries(simulationBaseline.teams);
        for (let index = 0; index < entries.length; index += 5) {
          const staged = db.batch();
          for (const [code, team] of entries.slice(index, index + 5))
            staged.set(
              worldRef.collection('teams').doc(code),
              simulationDraft
                ? {
                    ...team,
                    // Draft custody comes only from the SIMULATION draft baseline.
                    entitlementIds:
                      simulationDraft.baseline.initialTeams[code]
                        .entitlementIds,
                  }
                : team
            );
          await staged.commit();
        }
      }
      const batch = db.batch();
      batch.create(worldRef, metadata);
      for (const document of documents) {
        batch.create(
          worldRef
            .collection(CONTRACT_BASELINES_SUBCOLLECTION)
            .doc(document.shardId),
          document
        );
      }
      if (draftBaseline) {
        batch.create(worldRef.collection('draftBaselines').doc('root'), {
          worldId,
          release: draftBaseline.baseline,
        });
        for (const [code, team] of Object.entries(
          draftBaseline.baseline.initialTeams
        ))
          batch.create(worldRef.collection('teams').doc(code), team);
        for (const [id, entitlement] of Object.entries(
          draftBaseline.baseline.retainedEntitlements
        ))
          batch.create(
            worldRef.collection('entitlements').doc(id),
            entitlement
          );
      }
      if (simulationDraft) {
        batch.create(worldRef.collection('draftBaselines').doc('root'), {
          worldId,
          release: simulationDraft.baseline,
        });
        for (const [id, entitlement] of Object.entries(
          simulationDraft.baseline.retainedEntitlements
        ))
          batch.create(
            worldRef.collection('entitlements').doc(id),
            entitlement
          );
      }
      if (simulationCopy?.draftRoot) {
        // The client copies mutable world state; the immutable draft source
        // can only be carried by this trusted route.
        batch.create(worldRef.collection('draftBaselines').doc('root'), {
          worldId,
          release: simulationCopy.draftRoot,
        });
      }
      await batch.commit();
      return {
        ok: true,
        worldId,
        contractSourceRelease: trustedMetadata.contractSourceRelease,
        contractBaselineCoverage: trustedMetadata.contractBaselineCoverage,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('Governed Architect world initialization failed.', error);
      throw new HttpsError(
        'failed-precondition',
        error instanceof Error
          ? error.message
          : 'Governed contract baseline initialization failed.'
      );
    }
  }
);
