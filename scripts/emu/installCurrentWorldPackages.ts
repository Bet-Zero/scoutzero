/** Install the two pinned SIMULATION releases atomically using an authorized Admin session. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { brotliCompressSync, constants } from 'node:zlib';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { parseSimulationDraftBaseline } from '../../functions/src/architect/simulationDraftBaseline';
import { parseSimulationFinancialBaseline } from '../../functions/src/architect/simulationFinancialBaseline';
import {
  PRIVATE_PACKAGES_COLLECTION,
  readSimulationPackageBytes,
} from '../../functions/src/architect/simulationPackageSource';

const pins = {
  financial: '577df3452b1c54cfcd80d14d96f7b1adb35dff2c967bf386c7171190eee05419',
  draft: '43d725448133c416b93af0d82529cb3f6c6021a01be07a6030b493987ffbf331',
} as const;
const projectId = 'scoutzero-bf1ae';
const demoProjectId = 'demo-architect-review';
const [operation, target, financialFile, draftFile, ...extra] = process.argv.slice(2);
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

if (
  !['--plan', '--install'].includes(operation) ||
  !financialFile ||
  !draftFile ||
  extra.length ||
  (target !== projectId && target !== demoProjectId) ||
  (target === demoProjectId ? !/^127\.0\.0\.1:\d+$/.test(emulator ?? '') : emulator)
) {
  throw new Error('Usage: installCurrentWorldPackages.ts --plan|--install <scoutzero-bf1ae|demo-architect-review> <financial-file> <draft-file>');
}

const financial = readFileSync(financialFile);
const draft = readFileSync(draftFile);
const records = (['financial', 'draft'] as const).map((kind) => {
  const raw = kind === 'financial' ? financial : draft;
  if (createHash('sha256').update(raw).digest('hex') !== pins[kind])
    throw new Error(`Starting-data release digest mismatch for ${kind}.`);
  const brotli = brotliCompressSync(raw, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
  });
  if (brotli.length > 1_000_000)
    throw new Error(`Compressed ${kind} release exceeds the Firestore limit.`);
  return { kind, brotli, documentId: `${kind}-${pins[kind]}` };
});
const finance = parseSimulationFinancialBaseline(financial);
const draftData = parseSimulationDraftBaseline(draft);
if (
  finance.seasonId !== '2026-27' ||
  finance.seasonId !== draftData.baseline.seasonId ||
  finance.asOf !== draftData.baseline.asOf ||
  Object.keys(finance.teams).sort().join() !==
    Object.keys(draftData.baseline.initialTeams).sort().join()
) throw new Error('The current financial and draft release coverage differs.');

for (const { documentId, brotli } of records) {
  console.log(`${target}/${PRIVATE_PACKAGES_COLLECTION}/${documentId} (${brotli.length} compressed bytes)`);
}
if (operation === '--install') {
  const app = initializeApp({
    projectId: target,
    ...(target === projectId ? { credential: applicationDefault() } : {}),
  });
  const db = getFirestore(app);
  const refs = records.map(({ documentId }) =>
    db.collection(PRIVATE_PACKAGES_COLLECTION).doc(documentId)
  );
  const env = {
    SCOUTZERO_SIMULATION_LIVE: 'true',
    SCOUTZERO_SIMULATION_PACKAGE_SOURCE: 'firestore',
    SCOUTZERO_SIMULATION_FINANCIAL_SHA256: pins.financial,
    SCOUTZERO_SIMULATION_DRAFT_SHA256: pins.draft,
  };
  const added = await db.runTransaction(async (tx) => {
    const snapshots = await tx.getAll(...refs);
    let created = 0;
    for (const [index, snapshot] of snapshots.entries()) {
      const { kind, brotli } = records[index];
      if (snapshot.exists) {
        await readSimulationPackageBytes(kind, undefined, async () => snapshot.data()?.brotli, env);
      } else {
        tx.create(refs[index], { brotli });
        created++;
      }
    }
    return created;
  });
  console.log(`Created ${added} release documents. Verified ${2 - added} existing release documents.`);
  await db.terminate();
}
