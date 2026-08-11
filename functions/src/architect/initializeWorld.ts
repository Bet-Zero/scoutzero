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
  loadTrustedContractRelease,
  resolveFreshWorldSeason,
  seasonForSalaryCapYear,
  trustedContractBaselineMetadata,
  type TrustedContractReleasePin,
} from './trustedContractBaseline';

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
  const releaseEffectiveAt =
    args.contractMetadata.contractBaselineEffectiveAt;
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
        const release = loadTrustedContractRelease(
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
      } else {
        const release = loadTrustedContractRelease();
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
      }

      if (documents.length + 1 > 500) {
        throw new Error('Governed contract baseline exceeds one atomic batch.');
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
