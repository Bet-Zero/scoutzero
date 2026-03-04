#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const WORLD_COLLECTION = 'architect_worlds';
const LISTS_COLLECTION = 'lists';
const TIER_LISTS_COLLECTION = 'tierLists';
const MAX_SAMPLE_IDS = 50;
const MAX_BATCH_OPS = 400;

interface CliOptions {
  apply: boolean;
  dryRun: boolean;
  verbose: boolean;
  defaultWorldOwnerUid: string | null;
  defaultListOwnerUid: string | null;
}

interface WorldAuditIssue {
  docId: string;
  missingWorldId: boolean;
  missingCreatedBy: boolean;
  worldIdMismatch: boolean;
  currentWorldId: unknown;
}

interface OwnerAuditIssue {
  collectionName: string;
  docId: string;
  inferredOwnerUid: string | null;
  inferredFromField: string | null;
  requiresDefault: boolean;
}

interface AuditReport {
  worlds: {
    total: number;
    missingWorldId: WorldAuditIssue[];
    missingCreatedBy: WorldAuditIssue[];
    worldIdMismatch: WorldAuditIssue[];
    offenderDocIds: string[];
  };
  lists: {
    total: number;
    missingOwnerUid: OwnerAuditIssue[];
    offenderDocIds: string[];
  };
  tierLists: {
    total: number;
    missingOwnerUid: OwnerAuditIssue[];
    offenderDocIds: string[];
  };
}

interface ApplyPlan {
  worldUpdates: Array<{
    docId: string;
    updates: Record<string, string>;
  }>;
  listUpdates: Array<{
    collectionName: typeof LISTS_COLLECTION | typeof TIER_LISTS_COLLECTION;
    docId: string;
    ownerUid: string;
    source: string;
  }>;
}

function parseCliOptions(argv: string[]): CliOptions {
  const flags = new Set(argv);

  const readValue = (name: string): string | null => {
    const exact = argv.find((arg) => arg.startsWith(`${name}=`));
    if (exact) {
      const value = exact.slice(name.length + 1).trim();
      return value.length > 0 ? value : null;
    }
    const index = argv.findIndex((arg) => arg === name);
    if (index === -1) return null;
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) return null;
    return next.trim() || null;
  };

  const apply = flags.has('--apply');
  const dryRun = flags.has('--dryRun') || !apply;
  const verbose = flags.has('--verbose');

  return {
    apply,
    dryRun,
    verbose,
    defaultWorldOwnerUid: readValue('--defaultWorldOwnerUid'),
    defaultListOwnerUid: readValue('--defaultListOwnerUid'),
  };
}

function loadServiceAccountFromFile(serviceAccountPath: string) {
  if (!fs.existsSync(serviceAccountPath)) return null;
  try {
    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse service account at ${serviceAccountPath}: ${String(error)}`
    );
  }
}

function initializeAdmin() {
  if (getApps().length > 0) return;

  const credentialEnvPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const candidatePaths = [
    credentialEnvPath,
    path.resolve('serviceAccountKey.json'),
    path.resolve('../serviceAccountKey.json'),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidatePaths) {
    const serviceAccount = loadServiceAccountFromFile(candidate);
    if (!serviceAccount) continue;
    initializeApp({ credential: cert(serviceAccount) });
    console.log(
      `✅ Firebase Admin initialized with credentials from ${candidate}`
    );
    return;
  }

  throw new Error(
    'Unable to initialize Firebase Admin. Provide GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json in repo root.'
  );
}

function isLikelyUid(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return false;
  return /^[A-Za-z0-9:_-]+$/.test(trimmed);
}

function inferOwnerUid(data: Record<string, unknown>): {
  ownerUid: string | null;
  sourceField: string | null;
} {
  const candidates = [
    'createdBy',
    'ownerId',
    'ownerUID',
    'ownerUid',
    'userId',
    'uid',
    'created_by',
  ];

  for (const field of candidates) {
    const value = data[field];
    if (isLikelyUid(value)) {
      return { ownerUid: value.trim(), sourceField: field };
    }
  }

  return { ownerUid: null, sourceField: null };
}

function printSample(header: string, docIds: string[]) {
  console.log(`\n${header}`);
  if (docIds.length === 0) {
    console.log('  none');
    return;
  }

  docIds.slice(0, MAX_SAMPLE_IDS).forEach((docId) => {
    console.log(`  - ${docId}`);
  });
  if (docIds.length > MAX_SAMPLE_IDS) {
    console.log(`  ... (+${docIds.length - MAX_SAMPLE_IDS} more)`);
  }
}

function printAuditReport(report: AuditReport, options: CliOptions) {
  console.log('\n=== ARCHITECT SECURITY BACKFILL AUDIT ===');
  console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY RUN / AUDIT'}`);

  console.log('\nTotals by collection:');
  console.log(
    `- ${WORLD_COLLECTION}: total=${report.worlds.total}, missingCreatedBy=${report.worlds.missingCreatedBy.length}, missingWorldId=${report.worlds.missingWorldId.length}, worldIdMismatch=${report.worlds.worldIdMismatch.length}`
  );
  console.log(
    `- ${LISTS_COLLECTION}: total=${report.lists.total}, missingOwnerUid=${report.lists.missingOwnerUid.length}`
  );
  console.log(
    `- ${TIER_LISTS_COLLECTION}: total=${report.tierLists.total}, missingOwnerUid=${report.tierLists.missingOwnerUid.length}`
  );

  printSample(
    `${WORLD_COLLECTION} offenders (missing createdBy or missing/mismatched worldId)`,
    report.worlds.offenderDocIds
  );
  printSample(
    `${LISTS_COLLECTION} offenders (missing ownerUid)`,
    report.lists.offenderDocIds
  );
  printSample(
    `${TIER_LISTS_COLLECTION} offenders (missing ownerUid)`,
    report.tierLists.offenderDocIds
  );

  console.log('\nNext steps:');
  console.log(
    '1) Review the audit output and determine default owner UIDs if needed.'
  );
  console.log('2) Apply fixes only after confirming defaults:');
  console.log(
    '   npm run admin:security:apply -- --defaultWorldOwnerUid <uid> --defaultListOwnerUid <uid>'
  );
  console.log('3) Re-run audit to confirm zero offenders.');
}

function buildApplyPlan(report: AuditReport, options: CliOptions): ApplyPlan {
  const worldUpdates: ApplyPlan['worldUpdates'] = [];
  const listUpdates: ApplyPlan['listUpdates'] = [];

  const worldIssueByDoc = new Map<string, WorldAuditIssue>();
  [
    ...report.worlds.missingWorldId,
    ...report.worlds.missingCreatedBy,
    ...report.worlds.worldIdMismatch,
  ].forEach((issue) => {
    worldIssueByDoc.set(issue.docId, issue);
  });

  worldIssueByDoc.forEach((issue) => {
    const updates: Record<string, string> = {};
    if (issue.missingWorldId || issue.worldIdMismatch) {
      updates.worldId = issue.docId;
    }
    if (issue.missingCreatedBy) {
      if (!options.defaultWorldOwnerUid) {
        throw new Error(
          `Missing createdBy in ${WORLD_COLLECTION}/${issue.docId}. Supply --defaultWorldOwnerUid <uid> to apply.`
        );
      }
      updates.createdBy = options.defaultWorldOwnerUid;
    }
    if (Object.keys(updates).length > 0) {
      worldUpdates.push({ docId: issue.docId, updates });
    }
  });

  const queueListFixes = (
    collectionName: typeof LISTS_COLLECTION | typeof TIER_LISTS_COLLECTION,
    issues: OwnerAuditIssue[]
  ) => {
    issues.forEach((issue) => {
      if (issue.inferredOwnerUid) {
        listUpdates.push({
          collectionName,
          docId: issue.docId,
          ownerUid: issue.inferredOwnerUid,
          source: `inferred:${issue.inferredFromField}`,
        });
        return;
      }

      if (!options.defaultListOwnerUid) {
        throw new Error(
          `Missing ownerUid in ${collectionName}/${issue.docId} and no inferable owner field. Supply --defaultListOwnerUid <uid> to apply.`
        );
      }

      listUpdates.push({
        collectionName,
        docId: issue.docId,
        ownerUid: options.defaultListOwnerUid,
        source: 'defaultListOwnerUid',
      });
    });
  };

  queueListFixes(LISTS_COLLECTION, report.lists.missingOwnerUid);
  queueListFixes(TIER_LISTS_COLLECTION, report.tierLists.missingOwnerUid);

  return { worldUpdates, listUpdates };
}

async function commitInChunks(
  db: FirebaseFirestore.Firestore,
  applyPlan: ApplyPlan,
  verbose: boolean
) {
  let committedBatches = 0;
  let committedOps = 0;
  let currentBatch = db.batch();
  let currentOps = 0;

  const flush = async () => {
    if (currentOps === 0) return;
    await currentBatch.commit();
    committedBatches += 1;
    committedOps += currentOps;
    if (verbose) {
      console.log(`Committed batch #${committedBatches} (${currentOps} ops)`);
    }
    currentBatch = db.batch();
    currentOps = 0;
  };

  const writeQueue: Array<{
    collectionName: string;
    docId: string;
    updates: Record<string, unknown>;
  }> = [
    ...applyPlan.worldUpdates.map((item) => ({
      collectionName: WORLD_COLLECTION,
      docId: item.docId,
      updates: item.updates,
    })),
    ...applyPlan.listUpdates.map((item) => ({
      collectionName: item.collectionName,
      docId: item.docId,
      updates: { ownerUid: item.ownerUid },
    })),
  ];

  for (const write of writeQueue) {
    const ref = db.collection(write.collectionName).doc(write.docId);
    currentBatch.update(ref, write.updates);
    currentOps += 1;
    if (currentOps >= MAX_BATCH_OPS) {
      await flush();
    }
  }

  await flush();
  return { committedBatches, committedOps };
}

async function auditCollectionMissingOwner(
  db: FirebaseFirestore.Firestore,
  collectionName: typeof LISTS_COLLECTION | typeof TIER_LISTS_COLLECTION,
  verbose: boolean
) {
  const snapshot = await db.collection(collectionName).get();
  const missingOwnerUid: OwnerAuditIssue[] = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const ownerUid = data.ownerUid;
    if (isLikelyUid(ownerUid)) return;

    const inferred = inferOwnerUid(data);
    const issue: OwnerAuditIssue = {
      collectionName,
      docId: doc.id,
      inferredOwnerUid: inferred.ownerUid,
      inferredFromField: inferred.sourceField,
      requiresDefault: !inferred.ownerUid,
    };

    if (verbose) {
      const source = issue.inferredFromField
        ? `inferred from ${issue.inferredFromField}`
        : 'requires defaultListOwnerUid';
      console.log(
        `[audit] ${collectionName}/${doc.id} missing ownerUid (${source})`
      );
    }

    missingOwnerUid.push(issue);
  });

  return {
    total: snapshot.size,
    missingOwnerUid,
    offenderDocIds: missingOwnerUid.map((entry) => entry.docId),
  };
}

async function runAudit(
  db: FirebaseFirestore.Firestore,
  options: CliOptions
): Promise<AuditReport> {
  const worldsSnapshot = await db.collection(WORLD_COLLECTION).get();
  const missingWorldId: WorldAuditIssue[] = [];
  const missingCreatedBy: WorldAuditIssue[] = [];
  const worldIdMismatch: WorldAuditIssue[] = [];

  worldsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const hasCreatedBy = isLikelyUid(data.createdBy);
    const worldIdValue = data.worldId;
    const hasWorldId =
      typeof worldIdValue === 'string' && worldIdValue.trim().length > 0;
    const matchesDocId = hasWorldId && worldIdValue === doc.id;

    if (hasCreatedBy && matchesDocId) return;

    const issue: WorldAuditIssue = {
      docId: doc.id,
      missingWorldId: !hasWorldId,
      missingCreatedBy: !hasCreatedBy,
      worldIdMismatch: hasWorldId && !matchesDocId,
      currentWorldId: worldIdValue,
    };

    if (issue.missingWorldId) missingWorldId.push(issue);
    if (issue.missingCreatedBy) missingCreatedBy.push(issue);
    if (issue.worldIdMismatch) worldIdMismatch.push(issue);

    if (options.verbose) {
      console.log(
        `[audit] ${WORLD_COLLECTION}/${doc.id} -> missingCreatedBy=${issue.missingCreatedBy}, missingWorldId=${issue.missingWorldId}, worldIdMismatch=${issue.worldIdMismatch}`
      );
    }
  });

  const worldOffenders = new Set<string>();
  missingWorldId.forEach((issue) => worldOffenders.add(issue.docId));
  missingCreatedBy.forEach((issue) => worldOffenders.add(issue.docId));
  worldIdMismatch.forEach((issue) => worldOffenders.add(issue.docId));

  const lists = await auditCollectionMissingOwner(
    db,
    LISTS_COLLECTION,
    options.verbose
  );
  const tierLists = await auditCollectionMissingOwner(
    db,
    TIER_LISTS_COLLECTION,
    options.verbose
  );

  return {
    worlds: {
      total: worldsSnapshot.size,
      missingWorldId,
      missingCreatedBy,
      worldIdMismatch,
      offenderDocIds: Array.from(worldOffenders),
    },
    lists,
    tierLists,
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  initializeAdmin();

  const db = getFirestore();
  const report = await runAudit(db, options);
  printAuditReport(report, options);

  if (!options.apply) {
    console.log('\nDRY RUN complete. No writes performed.');
    return;
  }

  const applyPlan = buildApplyPlan(report, options);
  const worldUpdateCount = applyPlan.worldUpdates.length;
  const listUpdateCount = applyPlan.listUpdates.filter(
    (w) => w.collectionName === LISTS_COLLECTION
  ).length;
  const tierListUpdateCount = applyPlan.listUpdates.filter(
    (w) => w.collectionName === TIER_LISTS_COLLECTION
  ).length;

  if (worldUpdateCount + listUpdateCount + tierListUpdateCount === 0) {
    console.log('\nNo updates required. Exiting cleanly.');
    return;
  }

  const { committedBatches, committedOps } = await commitInChunks(
    db,
    applyPlan,
    options.verbose
  );

  console.log('\n=== APPLY SUMMARY ===');
  console.log(`Updated ${WORLD_COLLECTION}: ${worldUpdateCount}`);
  console.log(`Updated ${LISTS_COLLECTION}: ${listUpdateCount}`);
  console.log(`Updated ${TIER_LISTS_COLLECTION}: ${tierListUpdateCount}`);
  console.log(
    `Committed operations: ${committedOps} in ${committedBatches} batch(es)`
  );
}

main().catch((error) => {
  console.error('\n❌ architectSecurityBackfill failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
