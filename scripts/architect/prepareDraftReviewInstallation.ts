import { readFile, writeFile } from 'node:fs/promises';
import { digest, validateInstallation } from './draftReviewInstallation.js';

// Offline only: input rules must first be independently reconciled and tested.
const [snapshotFile, snapshotDigest, proposedFile, documentsFile, output] =
  process.argv.slice(2);
if (
  !output ||
  process.argv.length !== 7 ||
  !/^[a-f0-9]{64}$/.test(snapshotDigest)
)
  throw new Error(
    'Usage: node --import tsx scripts/architect/prepareDraftReviewInstallation.ts <private-snapshot.json> <snapshot-sha256-from-run> <reviewed-rules> <private-five-documents.json> <new-private-output.json>'
  );
const snapshotBytes = await readFile(snapshotFile);
if (digest(snapshotBytes) !== snapshotDigest)
  throw new Error('Snapshot integrity mismatch');
const snapshot = JSON.parse(snapshotBytes.toString('utf8'));
if (digest(snapshot.content) !== snapshot.sha256)
  throw new Error('Rules integrity mismatch');
const installation = validateInstallation({
  baselineRuleset: snapshot.rulesetName,
  baselineRules: snapshot.content,
  proposedRules: await readFile(proposedFile, 'utf8'),
  documents: JSON.parse(await readFile(documentsFile, 'utf8')).documents,
});
const bytes = JSON.stringify(installation);
await writeFile(output, bytes, { mode: 0o600, flag: 'wx' });
console.log(
  JSON.stringify({
    preparedOnly: true,
    sha256: digest(bytes),
    records: 5,
    writesPerformed: 0,
  })
);
